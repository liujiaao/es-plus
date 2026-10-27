#!/usr/bin/env node
/**
 * 生成器**属性式**守卫（fuzz 语料）：任何通过 schema 校验的配置，都必须产出**能编译**的产物。
 *
 * ## 与 `check-generator-escaping.mjs` 的分工（两条腿，不是两次同样的检查）
 *
 *   - escaping 守卫是**定点的**：四个载荷各自钉一个上下文（JSON / JS / 属性 / mustache），
 *     判据是「这个上下文的定界符有没有被撑破」。它证明了「已想到的四个点」是对的。
 *   - 本守卫是**属性式的**：不给判据，直接把各种「在某个上下文中是恶意字符」的串灌进
 *     **每一个自由的字符串槽**，然后问真编译器：产物还能编译吗？
 *     判据是 `compile-leg.mjs` 的 Tier A 编译器本身（与 eval / score-golden 同一把尺子），
 *     所以它能抓到「谁也没想到的那个上下文」—— 这正是定点探针结构性抓不到的那一类。
 *
 * 两件事只有合起来才成立：定点探针证明已知上下文被正确转义；属性式探针证明**未知**的
 * 插值点也不会把产物弄坏。前者若单独存在，一次新增的插值点可以静默破坏产物
 * （转义守卫全绿，因为它根本没看那里）。
 *
 * ## 语料的选取（为什么是这些字符）
 *
 * 每一类都对应一个**具体的历史或可推演缺陷**，不是随机串：
 *
 *   · 孤立 `\r`（老 Mac 换行）—— `q()` 的换行归一化写的是 `/\r?\n/`，抓不到一个单独的 `\r`，
 *     而裸 CR 在 JS 字符串字面量里就是行终止符 ⟹ 产物语法错。
 *   · 反斜杠 + 单引号组合 —— 转义**顺序**错（先引号后反斜杠）会产出 `\\'`，把字面量撑破。
 *   · 反引号与 `${` —— 模板字面量上下文（`qBt`）的注入面。
 *   · `</script>` / `</template>` / `<!--` / `-->` —— HTML 解析**先于** JS，字符串里的结束标签
 *     照样闭合宿主块。
 *   · `}}` —— mustache 的结束定界符是「其后第一个 `}}`」，插值会提前收尾。
 *   · `"` + `@事件` —— HTML 属性值注入（写成伪属性）。
 *   · 空白 / `=` —— 静态插槽名（`#column-x`）**属性名**位置不可表达，必须整条不发射。
 *   · 预编码实体 `&quot;` —— 双重转义面：多转一次虽然不错，但要保证不把实体当定界符。
 *   · U+2028/U+2029 —— JSON 里合法，ES2019 之前在 JS 字符串字面量里是行终止符。
 *   · NUL、双向控制符、非 ASCII —— 编码/转义层最容易「按字节处理」时踩到的字符。
 *   · 长串（1500 个单引号）—— 转义是线性的，但截断/折叠/正则回溯类缺陷只在大输入上出现。
 *
 * ## 两类槽位（为什么必须分开判）
 *
 *   · **自由槽**（label / name / title / width / apiUrl / 弹窗键 …）：schema 只限定类型，
 *     任何字符串都能合法到达发射器 ⟹ 判据是「不抛错 ∧ 哨兵出现在产物里 ∧ 产物能编译」。
 *     哨兵是必需的：值被静默丢弃时产物当然能编译 —— 那样的绿是假绿。
 *   · **身份槽**（`prop` / `field` / `defaultSort.prop`）：被 `isSafeProp` 限定，含 `\` `/` 的
 *     载荷本来就该被 Zod 拒绝。判据因此是**析取**：「Zod 拒绝（fail-closed）」∨「产物能编译」。
 *     唯一不允许的状态是第三种：**放行了校验，却产出编译不过的代码**。
 *     `columns[].prop` 刻意也进这一组 —— 它没有 `isSafeProp` refine，正是最裸露的那个槽。
 *
 * ## 非空证明（守在自己身上）
 *
 * 把转义器整体换成恒等函数后再跑一遍**同一份语料**：必须至少有载荷变红。若恒等转义器下
 * 依然全绿，说明编译判据对这些输入没有约束力（等于没有守卫），直接 exit 1 ——
 * 与 `check-generator-escaping.mjs` 的非空证明同一原则。
 *
 * ## 首版即咬出的三处真实缺陷（保留在语料里的理由）
 *
 * 这三条都**不是**靠读代码发现的，且现有守卫全绿：
 *
 *   1. **`sfc` 模式 + `actions` 含 `export` + `typescript: false`**：导出 handler 里写死了
 *      `new URLSearchParams(queryForm as any)` —— `as any` 在 JS/JSX 产物里是**语法错**。
 *      这与载荷无关、是结构性的：只要选了 sfc 模式又要导出按钮，产物必然编译不过。
 *      修法是把 `as any` 跟着 `typescript` 走（`structured-generator.ts`）。
 *   2. **孤立 `\r`**：`q()` 原本用 `/\r?\n/` 归一化换行，抓不到单独的 `\r`，而裸 CR 在
 *      单引号字面量里就是行终止符 ⟹ `Unterminated string constant`（`codegen-escape.ts`）。
 *   3. **编译腿把模块误判成 SFC**：内联 JSON 只转义 `</script`，**开标签 `<script>` 原样保留**，
 *      于是 `compile-leg` 的「全文含 `<script>`」判据把 TS 模块送去 SFC 编译，报
 *      `Element is missing end tag` 的**假编译失败**（`compile-leg.mjs` 改为只看起头）。
 *
 * 前两条是**产物**缺陷，第三条是**尺子**缺陷 —— 守卫必须能同时咬住这两类，否则它会
 * 一边漏掉真缺陷、一边制造假红。自由槽的 `actions` 里保留 `export` 就是为了钉住第 1 条。
 *
 * 用法：node scripts/check-generator-fuzz.mjs
 * 退出码：0 = 全部载荷都产出可编译产物且守卫自证有效；1 = 发现未转义 / 守卫失效。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileProduct } from './eval/compile-leg.mjs'
import { loadGenerator, crippleEscaperSource } from './lib/generator-loader.mjs'

const TARGETS = ['vue3', 'vue2', 'antdv']
const MODES = ['schema', 'sfc']

/** 载荷 = 唯一哨兵 + 恶意体。哨兵在前，便于「值确实落进了产物」的断言。 */
const P = (id, body) => ({ id, value: `ZZF${id}` + body })

const PAYLOADS = [
  P('00', ''), // 控制组：不含恶意字符 —— 有它才能区分「转义坏了」与「语料本身就走不到」
  P('01', '\r'), // 孤立 CR：旧 q() 用 /\r?\n/ 归一化，抓不到它，而裸 CR 就是行终止符（已修，此处钉住）
  P('02', '\r\n'), // CRLF
  P('03', '\n'), // LF
  P('04', '\\'), // 末尾反斜杠（转义后是 `\\`，不能把收尾引号吃掉）
  P('05', "a\\'b"), // 反斜杠 + 单引号（顺序错就产出 `\\'`）
  P('06', '`${globalThis.__ZZF06__}`'), // 反引号 + ${} 模板注入
  P('07', '</script><script>globalThis.__ZZF07__</script>'),
  P('08', '</SCRIPT >'), // 大小写 + 空白变体（HTML 标签名大小写不敏感）
  P('09', '</template>'),
  P('10', '<!-- ZZF10 -->'), // HTML 注释起止
  P('11', '}}{{globalThis.__ZZF11__'), // mustache 提前收尾
  P('12', 'x"@mouseover="globalThis.__ZZF12__'), // 属性值注入
  P('13', 'a b\tc'), // 空白：静态插槽名不可表达
  P('14', '&quot;&amp;&lt;'), // 预编码实体（双重转义面）
  P('15', '\u2028\u2029'), // JS 行分隔符（JSON 合法；ES2019 之前在 JS 字符串里是行终止符）
  P('16', '\u0000'), // NUL
  P('17', "'".repeat(1500) + 'ZZF17'), // 长串（转义线性、截断/折叠类缺陷只在大输入上现形）
  P('18', '\u{1F600}中文\u202eRTL'), // 非 ASCII + 双向控制符（裸控制符在编辑器里不可见，故写转义）
]

/** 与 `StructuredCrudConfigSchema.name` 的 refine **逐字同规**（改一边必须改另一边）。 */
const nameAccepts = (v) => !/[\\/]/.test(v) && v !== '.' && v !== '..' && !/^[A-Za-z]:/.test(v)

/**
 * 一套把载荷灌进**每一个自由字符串槽**的配置。
 *
 * 槽位清单与 `check-generator-escaping.mjs` 的 `buildConfig` 对齐 —— 两处若分叉，
 * 就会出现「escaping 守卫覆盖了、fuzz 语料没走到」的静默缺口。刻意**不**灌
 * `formatter` / `render`：它们是**文档化的源码扩展点**（配置里就是 JS 源码），
 * 转义它们才是错的；它们由发射前语法闸 `assertEmittableExpr` 单独把关。
 */
function freeSlotConfig(v, target, mode) {
  // `name` 是**带约束**的自由槽（schema 把它当文件/目录名：不得含 `\` `/`、不得是 `.`/`..`、
  // 不得像盘符）。约束本身是 fail-closed 的正确行为，但把它当自由槽灌载荷会让整份配置被
  // Zod 拒掉 —— 于是自由槽腿一条都走不到发射器，守卫变成「假绿的空跑」。故：
  // 载荷能合法通过 schema 时才用载荷，否则退回一个安全常量；含路径分隔符的载荷本来也
  // 到不了那个插值点（schema 先拦了），这不是覆盖缺口。
  return {
    name: nameAccepts(v) ? v : 'FuzzFree',
    apiUrl: `/api/${v}`,
    actions: ['add', 'edit', 'delete', 'export'],
    target,
    mode,
    fields: [
      { prop: 'a', label: v, formtype: 'Input', width: v, minWidth: v, attrs: { 'data-x': v } },
      { prop: 'b', label: v, formtype: 'Select', render: 'statusTag' },
      { prop: 'c', label: v, formtype: 'Input', inTable: false },
    ],
    toolbarBtns: [{ name: v, key: v, type: v, icon: v }],
    tableBtns: [{ name: v, key: v, type: v, icon: v }],
    operationColumn: { label: v, btns: [{ name: v, key: v, type: v, icon: v }] },
    dialogs: {
      [v]: {
        title: v,
        width: v,
        formItems: [{ prop: 'x', label: v, formtype: 'Input' }],
        appendTo: v,
        cacheKey: v,
        configBtn: [{ name: v, action: 'confirm' }],
      },
    },
  }
}

/**
 * 一套把载荷灌进**身份槽**的配置：`fields[].prop`、`columns[].prop`、`dialogs[].formItems[].prop`、
 * `tableOptions.defaultSort.prop`，以及 `isHidden[].field`（与 prop 同规）。
 */
function identitySlotConfig(v, target, mode) {
  return {
    name: 'FuzzIdentity',
    apiUrl: '/api/fuzz',
    actions: ['add', 'edit', 'delete'],
    target,
    mode,
    fields: [
      { prop: v, label: 'A', formtype: 'Input', width: 120 },
      { prop: 'keep', label: 'K', formtype: 'Input', isHidden: [{ field: v, op: 'eq', value: 1 }] },
    ],
    columns: [{ prop: v, label: 'A' }],
    tableOptions: { defaultSort: { prop: v, order: 'descending' } },
    dialogs: { add: { title: 'Add', formItems: [{ prop: v, label: 'A', formtype: 'Input' }] } },
  }
}

/** Zod 拒绝的可识别文案（`assertValidConfig` 的唯一出口）。 */
const SCHEMA_REJECT = '配置未通过 StructuredCrudConfigSchema 校验'

/** 某个 (载荷, 槽族) 一份配置 → 一组判定。 */
function probe(gen, cfg, { family, payload, target, mode }) {
  const where = `${family}/${payload.id}/${target}/${mode}`
  let result
  try {
    result = gen.generateFromConfig(cfg)
  } catch (e) {
    const msg = String(e && e.message)
    if (msg.includes(SCHEMA_REJECT)) {
      // 身份槽被 schema 拒绝 = fail-closed，是**正确**行为；自由槽被拒绝则是语料写错了
      // （那些槽只限定 z.string()），必须报出来，否则「语料根本没走到发射器」会被读成通过。
      return family === 'identity' ? { kind: 'schema-rejected', where } : { kind: 'bad', where, reason: `自由槽被 schema 拒绝：${msg.split('\n')[0]}` }
    }
    return { kind: 'bad', where, reason: `生成抛错：${msg.split('\n')[0]}` }
  }

  const fields = ['code', 'wrapperCode'].filter((f) => typeof result?.[f] === 'string' && result[f].trim())
  if (!fields.length) return { kind: 'bad', where, reason: '生成器没有返回任何产物字段' }

  if (family === 'free') {
    // 值必须真的落进产物：否则「能编译」可能只是因为它被静默丢弃了（假绿）。
    const whole = fields.map((f) => result[f]).join('\n')
    if (!whole.includes(`ZZF${payload.id}`)) {
      return { kind: 'bad', where, reason: `哨兵 ZZF${payload.id} 未出现在产物里 —— 值被静默丢弃，编译断言形同虚设` }
    }
  }

  for (const f of fields) {
    const r = compileProduct(f === 'code' ? { code: result.code } : { wrapperCode: result.wrapperCode }, {
      filename: 'fuzz',
    })
    if (!r.ok) {
      // 排障开关：`FUZZ_DUMP=<dir>` 时把出问题的产物原样落盘（默认不写任何文件）。
      if (process.env.FUZZ_DUMP) {
        const dir = process.env.FUZZ_DUMP
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, `${where.replace(/[\\/]/g, '_')}.${f}.txt`), result[f])
      }
      return { kind: 'bad', where, reason: `${f} 编译不过 —— ${r.error.message.split('\n')[0]}` }
    }
  }
  return { kind: 'ok', where }
}

/** 跑一遍完整语料（两个槽族 × 全部载荷 × target × mode）。 */
async function runSuite(gen) {
  const out = []
  for (const payload of PAYLOADS) {
    for (const target of TARGETS) {
      for (const mode of MODES) {
        out.push(
          probe(gen, freeSlotConfig(payload.value, target, mode), { family: 'free', payload, target, mode })
        )
        out.push(
          probe(gen, identitySlotConfig(payload.value, target, mode), { family: 'identity', payload, target, mode })
        )
      }
    }
  }
  return out
}

/**
 * 打印并返回失败行。
 *
 * `tag` / `samples` 只给**非空证明**用：恒等转义器下失败是**预期的**，若照样逐条打 ❌，
 * 一次成功的守卫会吐出上百行红字 —— 读的人分不清「守卫抓到了真实缺陷」与「守在自己身上」。
 * 恒等腿只打前几条样例 + 总数（总数进 ✅ 行），真实腿保持逐条。
 */
function report(results, { tag = '', samples = Infinity } = {}) {
  const bad = results.filter((r) => r.kind === 'bad')
  const shown = bad.slice(0, samples)
  for (const b of shown) console.error(`❌ ${tag}${b.where} —— ${b.reason}`)
  if (bad.length > shown.length) console.error(`   …${tag}另有 ${bad.length - shown.length} 条，省略（总数见下行）`)
  return bad
}

async function main() {
  const gen = await loadGenerator()

  // 0. 载荷自检：每个载荷都必须自带唯一哨兵，否则「值落进产物」的断言无从谈起。
  const ids = new Set()
  for (const p of PAYLOADS) {
    if (!p.value.startsWith(`ZZF${p.id}`)) {
      console.error(`❌ 载荷自检失败：${JSON.stringify(p.value)} 不以哨兵 ZZF${p.id} 开头`)
      process.exit(1)
    }
    if (ids.has(p.id)) {
      console.error(`❌ 载荷自检失败：id ${p.id} 重复`)
      process.exit(1)
    }
    ids.add(p.id)
  }

  const results = await runSuite(gen)
  const bad = report(results)
  const ok = results.filter((r) => r.kind === 'ok').length
  const rejected = results.filter((r) => r.kind === 'schema-rejected').length
  const freeOk = results.filter((r) => r.kind === 'ok' && r.where.startsWith('free/')).length
  const freeTotal = results.filter((r) => r.where.startsWith('free/')).length

  // 1. 覆盖性：自由槽**不允许**出现「被 schema 拒绝」——那些槽只限定 z.string()，
  //    被拒只能说明本守卫的语料写错了（或被某个新加的 refine 挡住），此时它证明不了任何事。
  if (freeOk !== freeTotal) {
    bad.push({ where: 'coverage', reason: `自由槽只有 ${freeOk}/${freeTotal} 走到发射器` })
    console.error(`❌ 覆盖性：自由槽只有 ${freeOk}/${freeTotal} 真的产出了产物`)
  }
  // 2. 语料必须真的覆盖到「被 schema 拒绝」这条分支，否则 identity 槽的析取判据是空的。
  if (rejected === 0) {
    bad.push({ where: 'coverage', reason: 'identity 槽没有任何载荷被 schema 拒绝 —— 析取判据退化成单腿' })
    console.error('❌ 覆盖性：没有任何身份槽载荷被 schema 拒绝 —— 「拒绝也是合法结果」这条分支没被走到')
  }

  if (!bad.length) {
    console.log(
      `✅ 生成器 fuzz 语料通过（${PAYLOADS.length} 个载荷 × ${TARGETS.length} target × ${MODES.length} mode × 2 个槽族 = ` +
        `${results.length} 份配置；${ok} 份产出可编译产物，${rejected} 份被 schema fail-closed 拒绝）`
    )
  }

  // 3. 非空证明：恒等转义器下**同一份语料**必须至少有一条变红。
  const crippled = await loadGenerator((_, path) => crippleEscaperSource(path))
  const crippledBad = report(await runSuite(crippled), { tag: '[恒等转义器·预期变红] ', samples: 3 })
  if (!crippledBad.length) {
    console.error(
      '❌ 非空证明失败：把转义器换成恒等函数后，fuzz 语料**依然全绿** —— ' +
        '编译判据对这些输入没有约束力（等于没有守卫）。'
    )
    process.exit(1)
  }
  console.log(`✅ 非空证明：恒等转义器下 ${crippledBad.length} 条变红，编译判据确有约束力`)

  if (bad.length) {
    console.error('\n生成器 fuzz 守卫失败 —— 存在「放行校验却产出编译不过的代码」的输入。')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(`❌ 守卫自身抛错：${e.stack || e.message}`)
  process.exit(1)
})
