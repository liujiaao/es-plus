#!/usr/bin/env node
/**
 * 生成器转义守卫（反向探针）
 *
 * 背景：`generateFromConfig` 把用户/LLM 给的配置**拼进源码字符串**（`mode=schema` 产出一个
 * 内联 JSON 的对象字面量 + 包装 SFC；`mode=sfc` 直接产出整份 SFC）。任何一个插值点漏了
 * 转义，配置里的引号/`</script>` 就会从「一个字符串值」变成「一段可执行代码」——生成物是
 * 字符串，类型检查与所有既有守卫都看不见它。
 *
 * 本守卫不做「某字段出现过」式的文本检查，而是**跑真生成器、验真产物**：
 *
 *   1. **JSON 上下文**：`</script>` 必须被写成 `<\/script>`（否则内联 JSON 会提前闭合宿主
 *      `<script>` 标签），且原样的 `</script>` 不得出现在产物的任何位置。
 *   2. **JS 上下文**：产物里的每一段 `<script>` 块都必须能被 esbuild 解析。载荷里带一个
 *      落单的单引号 —— 未转义时产出的 `label: 'x''` 是**语法错误**，转义后是 `label: 'x\''`。
 *      「能解析」是语义判据，不受「值出现在哪个上下文」影响。
 *   3. **HTML 属性上下文**：SFC `<template>` 里的属性（`#column-<prop>` 插槽名等）必须把
 *      `"` 写成 `&quot;`。**只在 `<template>` 块内断言** —— 同一个 prop 在 JS 字符串上下文
 *      （`row['b<prop>']`）里原样带 `"` 是合法的，全产物范围断言会误判。
 *   4. **mustache 上下文**：`{{ … }}` 由**其后第一个** `}}` 收尾，所以插值内容里的 `}}` 会让
 *      表达式被截断成语法错。判据是**语义**的 —— 按 Vue 的规则取出插值内容（只在文本区取，
 *      属性值与注释不参与插值），要求它能被 esbuild 当表达式解析。「文本里出现了 `}}`」这种
 *      子串判据在这里是错的：载荷的 `}}` 出现在插槽名属性值与 HTML 注释里是合法的。
 *
 * **载荷自检**：先用 `PAYLOAD_SHAPE` 断言每个载荷真的带着自己的触发点（单引号 / `</script>`
 * / 双引号 / `}}`）。载荷写错的后果是「永远不可能变红」——与没有守卫等价，却依然打印全绿。
 * 本守卫的 `P_MUST` 就曾因 `${S_MUST}}{{…` 里那个 `}` 被 `${…}` 吃掉而退化成 `}{{`（实测），
 * 于是 mustache 断言对着一个不可能失败的载荷全绿。
 *
 * **非空证明（守在自己身上）**：跑完正向检查后，用 esbuild 插件把 `codegen-escape.ts` 的
 * 转义器整体替换成恒等函数，再跑一遍同一组载荷 —— 必须**每一项都变红**。若替换成恒等后
 * 仍然全绿，说明本守卫的判据没有约束力（等于没有），直接 exit 1。这照的是
 * `check-data-schemas.mjs` 的负向验证写法：守卫必须自证能红。
 *
 * 用法：node scripts/check-generator-escaping.mjs
 * 退出码：0 = 全部上下文均已正确转义且守卫自证有效；1 = 发现未转义 / 守卫失效。
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, transform } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SHARED_SRC = join(ROOT, 'packages/shared/src')
const ESCAPE_MODULE = join(SHARED_SRC, 'codegen-escape.ts')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

// ── 载荷 ────────────────────────────────────────────────
// 每个载荷都带一个唯一哨兵，用来断言「值确实落进了产物」（否则「转义正确」可能只是
// 因为值被静默丢弃 —— 那样的绿是假绿）。
const S_JS = 'ESPRBJS'
const S_JSON = 'ESPRBJSON'
const S_ATTR = 'ESPRBATTR'
const S_MUST = 'ESPRBMUST'

/** 落单单引号：未转义时把 `'…'` 撑破成语法错误 */
const P_JS = `${S_JS}'+(globalThis.__ES_P_JS__=1)+'`
/** `</script>` 会提前闭合内联 JSON 所在的外层 script 标签 */
const P_JSON = `${S_JSON}</script><script>globalThis.__ES_P_JSON__</script>`
/** 双引号：未转义时把 HTML 属性值撑破，注入事件处理器 */
const P_ATTR = `${S_ATTR}"@mouseover="globalThis.__ES_P_ATTR__`
/**
 * 两个右花括号：未转义时让 `{{ … }}` 插值提前收尾、表达式被截断。
 *
 * 刻意用 `+` 拼而不是写进模板字面量：写在 `` `${S_MUST}}{{…` `` 里，**紧邻 `S_MUST` 的那个 `}`
 * 会被当成 `${…}` 的收尾**，值只剩 `}{{` —— 载荷里根本没有 `}}`，永远触发不了它要探的缺陷。
 * 本守卫最初就是这么写的（实测 `P_MUST` 求值为 `ESPRBMUST}{{globalThis.__ES_P_MUST__`），
 * 于是 mustache 断言对着一个不可能失败的载荷全绿。见下方 PAYLOAD_SHAPE 的自检。
 */
const P_MUST = S_MUST + '}}{{globalThis.__ES_P_MUST__'

/**
 * 每个载荷**必须**含有的特征串。少一个，对应上下文的探针就永远不可能变红 —— 那样的
 * 「全绿」与「没有守卫」等价。这几个字符序列正是各自缺陷的触发点：
 *   - 单引号 → 撑破 JS 字符串字面量
 *   - `</script>` → 提前闭合宿主 script 标签
 *   - 双引号 → 撑破 HTML 属性值
 *   - 两个右花括号 → 提前收尾 mustache 插值
 * 之所以固化成断言而不是「写的时候小心点」：上面 P_MUST 的坑（`}` 被 `${…}` 吃掉）
 * 是**语法层面**的，肉眼看不出、测试也不会报错，只会静默退化成假绿。
 */
const PAYLOAD_SHAPE = [
  [P_JS, "'", '单引号'],
  [P_JSON, '</script>', 'script 结束标签'],
  [P_ATTR, '"', '双引号'],
  [P_MUST, '}}', '两个右花括号'],
]

/**
 * 载荷落点。
 *
 * 覆盖面刻意铺到**每一个能从配置流进生成物的字符串槽**（含 `dialogs` 的**键** ——
 * 它同样是用户可控的，会落进 `if (dialogKey === '…')`）。
 * `align`/`fixed` 不在此列：schema 里它们是枚举，载荷到不了生成器，属不可达面。
 */
function buildConfig(target, mode) {
  return {
    name: `Probe${P_JS}`,
    apiUrl: `/api/p${P_JS}`,
    actions: ['add', 'edit', 'delete', 'export'],
    target,
    mode,
    fields: [
      { prop: `a${P_JS}`, label: P_JS, formtype: 'Input', width: P_JS, minWidth: P_JS, attrs: { 'data-x': P_JSON } },
      { prop: `b${P_ATTR}`, label: P_ATTR, formtype: 'Select', render: 'statusTag' },
      { prop: `c${P_MUST}`, label: P_MUST, formtype: 'Input', render: 'statusTag' },
      { prop: 'd', label: 'D', formtype: 'DatePicker', inTable: false },
    ],
    toolbarBtns: [{ name: P_JS, key: P_JS, type: P_JS, icon: P_JS }],
    tableBtns: [{ name: P_JS, key: P_JS, type: P_JS, icon: P_JS }],
    operationColumn: { label: P_JS, btns: [{ name: P_JS, key: P_JS, type: P_JS, icon: P_JS }] },
    dialogs: { [`d${P_ATTR}`]: { title: P_JS, width: P_JS, formItems: [{ prop: 'x', label: P_JS, formtype: 'Input' }] } },
  }
}

// ── 载入生成器（从 TS 源码直接打包，不依赖 dist） ──────
/**
 * @param {false | ((source: string, path: string) => string | null)} cripple
 *   传函数时，该函数返回的字符串会**替换**对应源文件内容（用于非空证明：把转义器打成恒等）。
 */
async function loadGenerator(cripple = false) {
  const tmp = mkdtempSync(join(tmpdir(), 'es-esc-'))
  const outfile = join(tmp, 'gen.mjs')
  const plugin = {
    name: 'cripple-escaper',
    setup(b) {
      if (!cripple) return
      b.onLoad({ filter: /codegen-escape\.ts$/ }, (args) => {
        const src = cripple(null, args.path)
        return src == null ? null : { contents: src, loader: 'ts' }
      })
    },
  }
  await build({
    entryPoints: [join(SHARED_SRC, 'structured-generator.ts')],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    plugins: plugin ? [plugin] : [],
  })
  return import(pathToFileURL(outfile).href)
}

// ── 产物切块 ────────────────────────────────────────────
/** 取出产物里所有 `<script …>…</script>` 块（含其 lang，决定 esbuild 的 loader） */
function scriptBlocks(src) {
  return [...src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({
    lang: (m[1].match(/lang\s*=\s*"([^"]+)"/) || [])[1] || 'js',
    body: m[2],
  }))
}
/**
 * 取出产物里每个**顶层** `<template>…</template>` 块的内容。
 *
 * 为什么不能写成 `<template>([\s\S]*?)<\/template>`：非贪婪会停在**第一个** `<\/template>`
 * 上，而 SFC 里列插槽是嵌套的 `<template #column-x="{ row }">…</template>` —— 于是根模板的
 * 捕获在第一个列插槽处就提前收尾，其后所有列的属性与 mustache 都落在窗口之外。
 * 实测后果：把 `qMustache` 退回 `q()`（真实回归）后，载荷明明在产物里（`whole.includes` 为真），
 * `tpls` 里却找不到 —— mustache 断言对着空气通过，守卫漏报。
 *
 * 这里改成按标签配对深度扫描：只有深度回到 0 才收尾，嵌套 slot 一并纳入顶层块的窗口。
 * 无属性根 `<template lang="pug">` 也照样能起头（起头标签的属性不参与配对）。
 */
function templateBlocks(src) {
  const out = []
  const re = /<template(?:\s[^>]*)?>|<\/template>/g
  let depth = 0
  let start = -1
  let m
  while ((m = re.exec(src)) !== null) {
    if (m[0].startsWith('</')) {
      if (depth === 0) continue // 多余的闭合标签：忽略，不让计数变负
      depth -= 1
      if (depth === 0 && start >= 0) {
        out.push(src.slice(start, m.index))
        start = -1
      }
    } else {
      if (depth === 0) start = re.lastIndex
      depth += 1
    }
  }
  return out
}

/**
 * 按 HTML 的引号规则扫出一个 template 里所有**真正作为属性**出现的 `{name, value}`。
 *
 * 为什么必须按引号规则扫、而不是直接对整段文本做子串匹配：**同一个 prop 在 mustache
 * 里原样带 `"` 是合法的**（`{{ row['b"x'] === 1 ? … }}` 的插值定界符是 `{{ }}`，`"` 不参与），
 * 只有属性值位置才怕裸 `"`。全文本子串匹配会把合法的 mustache 判红 —— 那是误判。
 *
 * 正确产物里属性值中不含裸 `"`，所以这个解析是良定义的；一旦某个值漏了转义，解析就会在
 * 那个裸 `"` 处**提前收尾**，把后面注入进来的伪属性（`@mouseover="…"`）读成真正的属性名
 * —— 这正好是我们要抓的信号。
 *
 * 属性名前的分隔符用 `(?<![\w.:-])` 而不是 `(?:^|\s)`：伪属性紧跟在上一个属性值那个**裸引号**
 * 之后（`…"@mouseover="…`），前面既不是串首也不是空白，用 `(?:^|\s)` 根本扫不到它 ——
 * 断言会静默漏报（写这条时实测踩到）。而转义正确的产物里那个位置是 `&quot;`，
 * 伪属性名后面也不会有字面 `="`，所以放宽分隔符不会制造误报。
 *
 * **已登记的残留（不是本守卫的判据，仅供知情）**：`qAttr` 的实体转义挡住了「凭空多出一个
 * 属性」，但 Vue 会把属性名里的实体**解码**后再校验，于是 `prop` 里带 `"` 时插槽名
 * `#column-…&quot;…` 仍会被模板编译器判为非法属性名（实测 `compileTemplate` 报
 * `Attribute name cannot contain U+0022`）。这是 fail-closed：产物编译不过，而不是可执行注入，
 * 且只能由「本来就不可能是合法插槽名」的 `prop` 触发。`qAttr` 的实体化本身是**正确**的 ——
 * 实测 `:type="row[&#39;x&#39;] …"` 能正常编译（Vue 解析表达式前会解码实体）。
 */
function tagAttributes(tpl) {
  const attrs = []
  for (const tag of tpl.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const text = tag[0]
    const head = text.search(/[\s/]/)
    if (head < 0) continue
    for (const m of text.slice(head).matchAll(/(?<![\w.:-])([@:#v-]?[\w.:-]+)\s*=\s*"([^"]*)"/g)) {
      attrs.push({ name: m[1], value: m[2] })
    }
  }
  return attrs
}

/**
 * 扫出模板里的「文本区」—— 即**不属于标签、也不属于注释**的那些片段。
 *
 * 为什么必须区分文本区：Vue 只在文本里解析 `{{ }}`，标签内（属性值）里的 `{{` 与 `}}`
 * 一律不参与插值。而载荷恰恰会在属性值（插槽名 `#column-…`）和 HTML 注释里带上 `}}{{`，
 * 若对整段模板文本做 `{{…}}` 匹配，那些字符会撑出一个**假的插值起点**，把注释、标签、
 * 真正插值的内容一起吞进「插值内容」里 —— 于是判据要么漏报（真插值被吞掉）要么误报
 * （合法产物被判红）。这一条是写这个断言时实测踩出来的。
 *
 * 标签的结束位置按引号状态推进：`>` 出现在引号内不算标签结束（属性值里带 `>` 的载荷
 * 不会把标签切断）。
 */
function textRegions(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt < 0) {
      out.push(src.slice(i))
      break
    }
    out.push(src.slice(i, lt))
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4)
      i = end < 0 ? src.length : end + 3
      continue
    }
    let j = lt + 1
    let quote = null
    while (j < src.length) {
      const c = src[j]
      if (quote) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
      j += 1
    }
    i = j + 1
  }
  return out
}

/**
 * 按 **Vue 自己的规则**取出模板里的 mustache 插值内容：从 `{{` 起、到**其后第一个** `}}` 止。
 *
 * 拿非贪婪正则对整段文本匹配是等价的写法，但必须只在文本区里做（见 `textRegions`）。
 */
function mustacheInterpolations(tpl) {
  const out = []
  for (const region of textRegions(tpl)) {
    let k = 0
    for (;;) {
      const open = region.indexOf('{{', k)
      if (open < 0) break
      const close = region.indexOf('}}', open + 2)
      if (close < 0) break
      out.push(region.slice(open + 2, close))
      k = close + 2
    }
  }
  return out
}

/** 一组产物里，含哨兵的 mustache 插值内容 + 文本区里是否出现过哨兵（用于覆盖性判据）。 */
function mustacheEvidence(parts) {
  const tpls = parts.flatMap((p) => templateBlocks(p.src))
  return {
    interpolations: tpls.flatMap(mustacheInterpolations).filter((x) => x.includes(S_MUST)),
    sentinelInText: tpls.some((t) => textRegions(t).some((r) => r.includes(S_MUST))),
  }
}
/**
 * 对一组「同一 (target, mode) 的全部产物字段拼起来」的交付物跑全部上下文断言。
 * 必须按 target×mode 分组而非按单个字段：`mode=schema` 的 `code` 是纯 JSON 对象
 * （没有 `<template>`），模板在 `wrapperCode` 里 —— 逐字段断言会把这两个正常的
 * 分工判成「没有 template 块」。
 * @returns {string[]} 失败描述（空数组 = 全绿）
 */
async function checkOutputs(produced) {
  const problems = []
  // 按 target×mode 合并
  const groups = new Map()
  for (const [target, mode, field, src] of produced) {
    const k = `${target}/${mode}`
    if (!groups.has(k)) groups.set(k, { target, mode, parts: [] })
    groups.get(k).parts.push({ field, src })
  }

  for (const { target, mode, parts } of groups.values()) {
    const where = `${target}/${mode}`
    const all = parts.map((p) => p.src)
    const whole = all.join('\n')
    const tpls = all.flatMap(templateBlocks)

    // 0. 覆盖性：三种上下文都必须在场，否则某个断言会对着空气通过（假绿）
    const scripts = all.flatMap(scriptBlocks)
    if (!scripts.length) problems.push(`${where}：产物里没有 <script> 块 —— JS 上下文未被检到（假绿）`)
    if (!tpls.length) problems.push(`${where}：产物里没有 <template> 块 —— 属性/mustache 上下文未被检到（假绿）`)
    const missingSentinels = [S_JS, S_ATTR, S_JSON, S_MUST].filter((s) => !whole.includes(s))
    if (missingSentinels.length) {
      problems.push(`${where}：载荷哨兵 ${missingSentinels.join(', ')} 未出现在任何产物字段中 —— 该落点已失效，断言形同虚设`)
    }

    // 1. JSON 上下文：`</script>` 必须以 `<\/script>` 出现，原样的一个都不许有
    if (whole.includes(P_JSON)) {
      problems.push(
        `${where}：出现原样的 \`</script>\` —— 内联 JSON 里的它会提前闭合宿主 script 标签。` +
          `（已正确转义的写法是 \`<\\/script>\`）`
      )
    }

    // 2. JS 上下文：每段 script 块必须能被 esbuild 解析
    //    （载荷里带落单单引号，未转义时 `label: 'x''` 是语法错）
    for (const b of scripts) {
      const loader = /^(tsx|jsx)$/.test(b.lang) ? 'tsx' : 'ts'
      try {
        await transform(b.body, { loader, logLevel: 'silent' })
      } catch (e) {
        const m = String(e.message).split('\n').find((l) => l.includes('ERROR')) || String(e.message).split('\n')[0]
        problems.push(
          `${where}：<script lang="${b.lang}"> 无法解析 —— 单引号载荷撑破了字符串字面量（${m.trim()}）`
        )
      }
    }

    // 3. HTML 属性上下文：属性值里的裸 `"` 会撑破属性、凭空多出一个伪属性
    const attrs = tpls.flatMap(tagAttributes)
    const injected = attrs.filter((a) => a.name.startsWith('@') && a.name.includes('mouseover'))
    if (injected.length) {
      problems.push(
        `${where}：双引号载荷撑破属性值，注入的 \`${injected[0].name}\` 被解析成了真正的属性名 —— ` +
          `属性值整体需要 HTML 实体转义（qAttr）`
      )
    }
    const boundWithSentinel = attrs.filter((a) => /^:(type|color)$/.test(a.name) && a.value.includes(S_ATTR))
    // 只在**该 mode 本来就产出绑定属性**时要求它带上载荷：
    //   - schema 模式把状态列渲染成 `<el-tag :type="…">` 模板片段 → 属性位置在场，必须被载荷走到；
    //   - sfc 模式把 render 内联进 `<script>`（`render: statusTag`），模板里根本没有属性位置，
    //     对它要求「属性里有哨兵」是误判。
    // 反过来，一旦某个 mode 出现了 `:type`/`:color` 却拿不到载荷，这里立刻变红 ——
    // 将来 sfc 模式若开始产属性，这条不会留下静默缺口。
    const hasBoundAttr = attrs.some((a) => /^:(type|color)$/.test(a.name))
    if (hasBoundAttr && !boundWithSentinel.length) {
      problems.push(
        `${where}：存在 \`:type\`/\`:color\` 属性，但没有一个属性值带上载荷哨兵 ${S_ATTR} —— ` +
          `属性上下文其实没被载荷走到，上面那条注入断言形同虚设（假绿）`
      )
    }

    // 4. mustache 上下文：`{{ … }}` 的结束定界符是 `}}`，载荷里的 `}}` 会让插值提前收尾、
    //    表达式被截断成语法错。判据用**语义**（能不能当 JS 表达式解析）而不是「文本里有没有
    //    出现 `}}`」：那个 `}}{{` 出现在**属性值**或**注释**里是合法的（插槽名与注释都不参与
    //    插值），全文本匹配会把合法产物判红 —— 误判。
    const { interpolations, sentinelInText } = mustacheEvidence(parts)
    if (sentinelInText && !interpolations.length) {
      problems.push(
        `${where}：文本区里出现了载荷哨兵 ${S_MUST}，却扫不出含它的 mustache 插值 —— ` +
          `插值扫描（textRegions/mustacheInterpolations）与真实产物已经脱节，下面这条断言形同虚设（假绿）`
      )
    }
    for (const expr of interpolations) {
      try {
        await transform(`(${expr.trim()})`, { loader: 'ts', logLevel: 'silent' })
      } catch (e) {
        const m = String(e.message).split('\n').find((l) => l.includes('ERROR')) || String(e.message).split('\n')[0]
        problems.push(
          `${where}：mustache 里的 \`}}\` 载荷让插值在第一个 \`}}\` 处提前收尾，表达式被截断成语法错` +
            `（${m.trim()}）—— 花括号需要写成 JS 的 Unicode 转义（qMustache）`
        )
      }
    }
  }
  return problems
}

/** 跑一遍：三个 target × 两种 mode，检查 code 与 wrapperCode 两个产物字段 */
async function runSuite(gen) {
  const produced = []
  for (const target of ['vue3', 'vue2', 'antdv']) {
    for (const mode of ['schema', 'sfc']) {
      let r
      try {
        r = gen.generateFromConfig(buildConfig(target, mode))
      } catch (e) {
        produced.push([target, mode, '<生成抛错>', `__THROW__ ${e.message}`])
        continue
      }
      for (const field of ['code', 'wrapperCode']) {
        if (typeof r[field] === 'string' && r[field].length) produced.push([target, mode, field, r[field]])
      }
    }
  }
  return produced
}

// ── 主流程 ──────────────────────────────────────────────
async function main() {
  // 0. 载荷自检：先确认每个载荷真的带着各自的触发点 —— 否则下面的「全绿」是假绿。
  for (const [payload, landmark, what] of PAYLOAD_SHAPE) {
    if (!payload.includes(landmark)) {
      fail(
        `载荷自检失败：${what}载荷里没有 ${JSON.stringify(landmark)}（实际 ${JSON.stringify(payload)}）—— ` +
          `它不可能触发对应的缺陷，该上下文等于没有探针`
      )
    }
  }
  if (failed) process.exit(1)

  // 正向：真生成器必须全绿
  const gen = await loadGenerator()
  const produced = await runSuite(gen)
  if (!produced.length) {
    fail('没有产出任何生成物 —— 生成器入口或配置构造已失效，守卫无意义')
  }
  for (const [target, mode, field, src] of produced) {
    if (src.startsWith('__THROW__')) fail(`${target}/${mode} 生成抛错：${src.slice(9)}`)
  }
  const problems = await checkOutputs(produced)
  for (const p of problems) fail(p)
  if (!problems.length) {
    console.log(
      `✅ 生成物转义正确（${produced.length} 份产物 / ${new Set(produced.map(([t, m]) => `${t}/${m}`)).size} 个 target×mode` +
        ` × JSON / JS / HTML-属性 / mustache 四种上下文）`
    )
  }

  // 反向（非空证明）：把转义器换成恒等函数，同一组载荷必须**每一项都变红**
  const crippled = await loadGenerator((_, path) => crippleEscaperSource(path))
  const crippledProduced = await runSuite(crippled)
  const crippledProblems = await checkOutputs(crippledProduced)
  if (!crippledProblems.length) {
    fail(
      '非空证明失败：把 codegen-escape.ts 的转义器全部替换成恒等函数后，守卫**依然全绿** —— ' +
        '说明这些断言在结构上没有约束力（等于没有守卫）。'
    )
  } else {
    console.log(
      `✅ 非空证明：转义器替换为恒等函数后守卫变红（${crippledProblems.length} 条），判据确有约束力`
    )
  }

  if (failed) {
    console.error('\n生成器转义守卫失败 —— 产物里存在可被配置撑破的插值点，或守卫自身失效。')
    process.exit(1)
  }
}

/**
 * 把 `codegen-escape.ts` 的转义器整体替换成恒等实现（只用于非空证明）。
 * 保留 `BARE_IDENTIFIER` 与 `qMember` 的类型形状，否则生成器自身会先崩掉、掩盖真问题。
 */
function crippleEscaperSource(path) {
  return `// ⚠️ 由 check-generator-escaping.mjs 的非空证明临时注入：全部转义器 = 恒等函数
export const BARE_IDENTIFIER = /^[A-Za-z_$][\\w$]*$/
const id = (v) => String(v)
export function q(value) { return "'" + id(value) + "'" }
export function qBt(value) { return "\`" + id(value) + "\`" }
export function qAttr(value) { return '"' + id(value) + '"' }
export function qKey(prop) { return BARE_IDENTIFIER.test(prop) ? prop : "'" + prop + "'" }
export function qMember(prop) { return BARE_IDENTIFIER.test(prop) ? "." + prop : "['" + prop + "']" }
export function qMustache(value) { return "'" + id(value) + "'" }
export function numOrStr(v) { return typeof v === 'number' ? String(v) : "'" + v + "'" }
export function sanitizeForComment(src) { return String(src) }
export function inlineJson(value, space) { return JSON.stringify(value, null, space) }
`
}

main().catch((e) => {
  console.error(`❌ 守卫自身抛错：${e.stack || e.message}`)
  process.exit(1)
})
