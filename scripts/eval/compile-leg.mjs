/**
 * Tier A 编译腿（AN-12）：把「产物字符串」变成**真的编译过**的产物。
 *
 * ## 为什么需要它
 *
 * 在此之前，`compiles` 的含义是「`generateFromConfig(config)` 没抛错」——那是
 * **配置合法**，不是**产物能编译**。两者之间隔着一整层：配置只要过 Zod 就必然生成，
 * 而产物里的模板（mustache 插值、属性名、`<template #column-x>` 插槽名）从未被
 * Vue 编译器看过。于是两类真实故障在 eval 与 PR 门禁里都是绿的：
 *
 *   - `prop` 含 `"`：`qAttr` 把属性值实体化了，但 Vue **解码实体后**仍会因属性名含
 *     `U+0022` 报 `Attribute name cannot contain U+0022`（见 check-generator-escaping 的
 *     「已登记残留」）。产物编译不过，`compiles` 却是 yes。
 *   - 模板里的表达式被截断/拼坏：`<script>` 块能解析（esbuild 只看脚本），模板编译照样炸。
 *
 * 既有尺子（`scripts/lib/compile-check.mjs`）只解析 `<script>` 块，**刻意**不做模板编译
 * （它的头注把模板交给 e2e 的 `vite build`）。但 e2e 是夜间/手动的，不阻塞合并 ——
 * 本腿把「模板也必须编译过」带回**每次 PR** 的确定性门禁（`score-golden`）与付费 eval。
 *
 * ## 判定口径
 *
 *   - **SFC**（`.vue`）：`@vue/compiler-sfc` 的 `parse` + `compileScript` +
 *     `compileTemplate`。脚本用 Vue 自己的 SFC 编译器解析（含 `<script setup lang="ts">`），
 *     模板**真的编译**（插槽名、属性、mustache 都会在这里被校验）。
 *   - **模块**（`.ts` / `.tsx` / `.js` / `.jsx`）：esbuild `transformSync`，**不是**
 *     TS `transpileModule`（计划原文的字面）。理由：esbuild 是本仓的规范解析器
 *     （`codegen-escape.ts` 的发射前语法闸、`score-golden`、`compile-smoke` 全用它），
 *     换 TS 只会在「发射前校验」与「发射后校验」之间制造第二把尺子；且 esbuild 同时吃
 *     TS 与 JSX，错误自带 `location`（行/列）。这条偏差已记入落地记录。
 *   - **围栏**（模型/前门输出的 markdown）：`extractFences` → 逐块走上面两条。围栏抽取
 *     复用 `compile-check.mjs` 的单源实现（迁移自 `front-door.mjs`，re-export 保留）。
 *
 * 返回形状统一为 `{ ok: true } | { ok: false, error: { message, file, line, column } }`。
 * **只解析/编译，不执行、不解析依赖** —— 这与既有尺子同一口径，不会因为第三方包没装而红。
 */
import { parse as parseSfcDescriptor, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { transformSync } from 'esbuild'
import { fencedBlocks } from '../lib/compile-check.mjs'

/**
 * 产物是 SFC 而不是纯模块的判据：**以** `<template>` / `<script>` 起头（允许前导空白与注释）。
 *
 * ⚠️ 这里**不能**用「全文出现过 `<template>`/`<script>`」：
 *   - 内联 JSON 会把字符串里的 `</script` 转义成 `<\/script`，但**开标签 `<script>` 原样保留**
 *     —— 于是一个 `label` 含 `<script>x</script>` 的 schema 产物（`code` 是 TS 模块）
 *     会被「包含」判据误判成 SFC，报出 `Element is missing end tag` 的**假编译失败**。
 *   - TSX 产物里出现 `<template>` 同理。
 * 由 `check:generator-fuzz` 的载荷 07 实测咬出（真实生成物、真实误判）。
 */
const SFC_RE = /^(?:\s|<!--[\s\S]*?-->)*<\s*(?:template|script)\b/i

/** 编译失败的统一形状：位置信息缺失时给 `null`，绝不猜。 */
function fail(file, e, fallbackMessage) {
  if (typeof e === 'string') return { ok: false, error: { message: e, file, line: null, column: null } }
  const message = String((e && e.message) || fallbackMessage || e)
  const start = e && e.loc && e.loc.start
  // `compileScript` 对语法错抛的是普通 Error，位置只写在文案里（`Unexpected token (2:18)`）。
  // 不解析它，错误定位就只能靠人肉数行；解析失败也只是退回 null，不猜。
  const inline = !start && message.match(/\((\d+):(\d+)\)/)
  return {
    ok: false,
    error: {
      message,
      file,
      line: start && typeof start.line === 'number' ? start.line : inline ? Number(inline[1]) : null,
      // compiler-sfc 的列是 0 基；对外统一成 1 基，和编辑器/TS 诊断一致
      column: start && typeof start.column === 'number'
        ? start.column + 1
        : inline
          ? Number(inline[2])
          : null,
    },
  }
}

/**
 * 编译一个 SFC：脚本过 `compileScript`（含 `<script setup lang="ts">`），模板过
 * `compileTemplate`（插槽名 / 属性 / mustache 在这里被真校验）。
 *
 * 刻意**不**处理 `<style>`：样式语法错误不影响组件可编译性，且编译样式需要
 * `@vue/compiler-sfc` 的 `compileStyle`（要 postcss 上下文），收益与成本不成比例。
 */
export function compileSfc(source, filename = 'generated.vue') {
  let descriptor
  let errors
  try {
    ;({ descriptor, errors } = parseSfcDescriptor(source, { filename }))
  } catch (e) {
    return fail(filename, e)
  }
  if (Array.isArray(errors) && errors.length) return fail(filename, errors[0])

  const id = 'esplus-compile-leg'
  if (descriptor.script || descriptor.scriptSetup) {
    try {
      compileScript(descriptor, { id })
    } catch (e) {
      return fail(filename, e)
    }
  }

  if (descriptor.template) {
    let res
    try {
      res = compileTemplate({
        source: descriptor.template.content,
        filename,
        id,
        compilerOptions: { expressionPlugins: ['typescript'] },
      })
    } catch (e) {
      return fail(filename, e)
    }
    if (res.errors && res.errors.length) return fail(filename, res.errors[0])
  }

  return { ok: true }
}

/**
 * 编译一个模块（TS/TSX/JS/JSX）。按扩展名挑 esbuild loader —— 扩展名由调用方按产物
 * 自报的形态给出（dialog composable 是 `.tsx`/`.jsx`，schema 模式的 pageSchema 是 `.ts`）。
 */
export function compileModule(source, filename = 'generated.ts') {
  const ext = String(filename).split('.').pop()
  const loader = ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : ext === 'js' ? 'js' : 'ts'
  try {
    transformSync(source, { loader, logLevel: 'silent' })
  } catch (e) {
    const first = e && e.errors && e.errors[0]
    const loc = first && first.location
    return {
      ok: false,
      error: {
        message: first ? first.text : String((e && e.message) || e),
        file: filename,
        line: loc && typeof loc.line === 'number' ? loc.line : null,
        column: loc && typeof loc.column === 'number' ? loc.column : null,
      },
    }
  }
  return { ok: true }
}

/** 按源码形态分派：SFC → 模板+脚本真编译；否则按扩展名走模块解析。 */
export function compileSource(source, { filename = 'generated.ts', lang } = {}) {
  const isSfc = lang === 'vue' || (lang === undefined && SFC_RE.test(source))
  return isSfc ? compileSfc(source, filename) : compileModule(source, filename)
}

/** `a.ts` → `a.vue`；`a` → `a.vue`。 */
function withExt(filename, ext) {
  return String(filename).replace(/\.[jt]sx?$/, '') + ext
}

/**
 * 编译一份 `generateFromConfig` 产物：schema 模式是 `code`（TS 模块）+ `wrapperCode`（SFC）
 * 两个字段，sfc 模式只有一个整份 SFC 的 `code`。任一字段失败即整份失败（返回首个错误）。
 */
export function compileProduct(result, { filename = 'generated.ts' } = {}) {
  if (!result) return { ok: false, error: { message: '生成器没有返回产物', file: filename, line: null, column: null } }

  // 形态由**产物结构**决定，而非靠内容猜：schema 模式是「code（pageSchema 模块）+ wrapperCode
  // （SFC）」两段，sfc 模式只有一份 SFC。有 wrapper 时 `code` 一定是模块 —— 即使它的字符串
  // 值里带着 `<script>`（内联 JSON 只转义 `</`，开标签会原样留下）。
  const hasWrapper = typeof result.wrapperCode === 'string' && result.wrapperCode.trim()
  if (typeof result.code === 'string' && result.code.trim()) {
    const isSfc = hasWrapper ? false : SFC_RE.test(result.code)
    const r = compileSource(result.code, { filename: isSfc ? withExt(filename, '.vue') : filename })
    if (!r.ok) return r
  }
  if (typeof result.wrapperCode === 'string' && result.wrapperCode.trim()) {
    const r = compileSfc(result.wrapperCode, withExt(filename, '.wrapper.vue'))
    if (!r.ok) return r
  }
  return { ok: true }
}

/**
 * 编译一份片段产物。形态由产物**自报**的 `fence` 决定（AI-28）：
 *   - `'vue'`：自包含 SFC；
 *   - `'tsx'`：composable 模块（`.tsx` / `.jsx` 取决于 `typescript`）。
 * 不读 `fence` 而靠正则猜，正是 `check-scene-coverage` 里被咬住的那类错配。
 */
export function compileFragment(result, { typescript = true, filename = 'fragment' } = {}) {
  if (!result || typeof result.code !== 'string') {
    return { ok: false, error: { message: '片段生成器没有返回 code', file: filename, line: null, column: null } }
  }
  if (result.fence === 'tsx') {
    return compileModule(result.code, withExt(filename, typescript ? '.tsx' : '.jsx'))
  }
  return compileSfc(result.code, withExt(filename, '.vue'))
}

/** 抽取 markdown 里的围栏代码块（单源在 `compile-check.mjs`）。 */
export function extractFences(text) {
  return fencedBlocks(text)
}

/**
 * 编译一段 markdown 里的**全部**围栏块；返回失败描述列表（空数组 = 全过）。
 * `label` 用于把错误定位到「哪条用例的哪个围栏」。
 */
export function compileFences(text, label = 'fences') {
  const failures = []
  const fences = extractFences(text)
  if (fences.length === 0) return [`${label} — 产物里没有任何围栏代码块`]
  fences.forEach(({ lang, code }, i) => {
    if (lang === 'json') {
      try {
        JSON.parse(code)
      } catch (e) {
        failures.push(`${label} #${i + 1} (json) — ${String(e.message).split('\n')[0]}`)
      }
      return
    }
    const filename = lang === 'vue' ? `fence-${i + 1}.vue` : `fence-${i + 1}.${lang}`
    const r = compileSource(code, { filename, lang: lang === 'vue' ? 'vue' : undefined })
    if (!r.ok) failures.push(`${label} #${i + 1} (${lang}) — ${fmtError(r.error)}`)
  })
  return failures
}

/**
 * 编译门汇总（AN-13，纯函数；树外即可单测，CI 上免费可验）。
 *
 * ## 分母为什么是「有产物的行」而不是「所有 measured 行」
 *
 * `measured` 在记分口径里含**模型答错**（`model-failure`）的行 —— 那是一次合法测量，
 * 按 0 分计入准确率。但这类行**没有产物**（`driveToValidConfig` 从未产出合法 config），
 * 把它们记成「编译失败」有两重错：
 *   1. 归因错：那是模型语义错误，不是发射器缺陷；
 *   2. 门禁恒红：`compileRate === 1` 在 95% 准确率目标下永远到不了（总允许有答错行），
 *      退化成「永久红 = 红盲」。
 * 未测到（`no-answer` / `truncated`）同理没有产物；它们仍由健康门对**门禁腿**零容忍判红
 * （`eval/ratchet.mjs` 的 `evaluateHealth`），不靠这里兜底。
 *
 * ## 分母为什么**含 en 腿**（A5）
 *
 * 编译门问的是「发射器能不能把合法配置变成能编译的产物」，与模型答得对不对、与观测腿
 * 有没有样本偏置都无关：每条产物都是独立的一次发射，少几条只是少几条证据（不像准确率
 * 那样把「没测到」按 0 计入分母）。而 en 行喂的是**英文 NL → 另一批配置**——正是
 * 「这类输入结构性过」里此前没被覆盖的那一半。只数 zh 时，`compileRate === 1` 的真实
 * 含义只是「这批中文用例碰巧过」。`byLang` 只做诊断拆分，**不是**第二个分母。
 *
 * ## 两个失败口径分开（AN-13③）
 *
 *   - `failure` = 有产物但编译不过 ⟹ **真编译失败**（发射器/产物缺陷，必须为 0）；
 *   - `modelFailureCompile` = 产物编译通过、但该行**不满足 95% 定义** ⟹ 模型语义 miss。
 *     它属于准确率门禁，不该让编译门变红；分开计数是为了让读者一眼分清两类 0。
 *
 * @param {Array<{error?:string|null, compiles?:boolean, file?:string, lang?:string, compileError?:object|null}>} rows
 * @param {(row:object)=>boolean} [passes95] 该行是否满足 95% 定义；默认全 true（= 不制造告警）。
 */
export function summarizeCompile(rows, passes95 = () => true) {
  const all = Array.isArray(rows) ? rows : []
  const measuredRows = all.filter((r) => !r.error)
  const compiledRows = measuredRows.filter((r) => r.compiles)
  const failureRows = measuredRows.filter((r) => !r.compiles)
  // 按语言拆开（只对带 `lang` 的行；片段腿的行没有 lang，byLang 为空对象）。
  // 拆开是**诊断**需要，不是第二个分母：编译门的分子分母仍是全局那一对 —— 否则
  // 「en 腿只跑了一半」会让一个不变的口径看起来变好（分母变小、比率不变）。
  const byLang = {}
  for (const r of measuredRows) {
    if (typeof r.lang !== 'string') continue
    const b = (byLang[r.lang] ??= { measured: 0, compiled: 0, failure: 0 })
    b.measured += 1
    if (r.compiles) b.compiled += 1
    else b.failure += 1
  }
  return {
    measured: measuredRows.length,
    compiled: compiledRows.length,
    rate: measuredRows.length ? compiledRows.length / measuredRows.length : null,
    failure: failureRows.length,
    byLang,
    modelFailureCompile: compiledRows.filter((r) => !passes95(r)).length,
    failureSamples: failureRows
      .slice(0, 5)
      .map((r) => `${r.file ?? '(row)'}${r.lang ? ` [${r.lang}]` : ''} — ${fmtError(r.compileError)}`),
  }
}

/** `file:line:col — message`，缺失的位置字段直接省略。 */
export function fmtError(error) {
  if (!error) return '(unknown compile error)'
  const where = [
    error.file || '',
    error.line != null ? String(error.line) : '',
    error.column != null ? String(error.column) : '',
  ].filter(Boolean).join(':')
  return `${where ? where + ' — ' : ''}${String(error.message).split('\n')[0]}`
}
