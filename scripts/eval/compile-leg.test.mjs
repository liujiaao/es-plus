#!/usr/bin/env node
/**
 * Tier A 编译腿自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 为什么值得单测：这条腿是 `compiles` 的**唯一**语义来源。它若对某类坏产物失明，
 * 「compileRate 100%」就只是「全部产物都是字符串」。故这里用最小的好坏样本把
 * 每条分派路径与每条错误位置钉死：
 *
 *   1) TS 语法错误 → 红，且给出**行/列**；
 *   2) TSX（JSX render）合法 → 绿（不能因为「不是纯 TS」误判）；
 *   3) SFC 脚本语法错误 → 红；
 *   4) SFC **模板**错误（非法 mustache 表达式）→ 红 —— 这是旧尺子（只看 <script>）
 *      **看不见**的那一类，也是本腿存在的理由；
 *   5) SFC 合法产物（script setup + template + 插槽）→ 绿；
 *   6) `compileProduct`：schema 模式的 code+wrapper 两段任一坏 → 红；
 *   7) `compileFragment` 按产物自报的 `fence` 分派：`tsx` 的 SFC 体 → 红（错配会被咬住）；
 *   8) `extractFences` 的 lang 归一化 + `compileFences` 逐块报错（含空围栏）；
 *   9) `summarizeCompile` 的编译门口径（AN-13）：分母只数**有产物**的行，
 *      「真编译失败」与「模型答错但产物能编译」分开计数，失败样本带 file:line:col。
 *
 * 用法：node scripts/eval/compile-leg.test.mjs
 * 退出码：0 = 腿的判据全部成立；1 = 至少一条失效。
 */
import {
  compileSource,
  compileProduct,
  compileFragment,
  extractFences,
  compileFences,
  summarizeCompile,
  fmtError,
} from './compile-leg.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

/** 断言「红，且带位置」。 */
function checkFail(result, label, { needLine = true } = {}) {
  check(result && result.ok === false, `${label}：应当编译失败，实际通过`)
  if (!result || result.ok !== false) return
  check(typeof result.error.message === 'string' && result.error.message.length > 0, `${label}：缺少错误信息`)
  if (needLine) check(typeof result.error.line === 'number', `${label}：错误没有行号（${fmtError(result.error)}）`)
}

// ── 1) 模块：TS 语法错误 ─────────────────────────────
checkFail(
  compileSource('export const a: number = 1\nexport const b: = 2\n', { filename: 'bad.ts' }),
  'TS 语法错误'
)

// ── 2) 模块：TSX 合法 ────────────────────────────────
check(
  compileSource('export const r = (h) => <div class="x" />\n', { filename: 'good.tsx' }).ok,
  'TSX 合法产物被误判为失败'
)
// 反证：同一个 JSX 内容用 .ts 扩展名 → 必须红（扩展名决定 loader，不能一律 tsx 放行）
check(!compileSource('export const r = () => <div />\n', { filename: 'jsx-in-ts.ts' }).ok, 'JSX 写进 .ts 应当失败')

// ── 3) SFC 脚本错误 ─────────────────────────────────
checkFail(
  compileSource(
    '<template><div /></template>\n<script setup lang="ts">\nconst a: number = ;\n</script>\n',
    { filename: 'bad-script.vue' }
  ),
  'SFC 脚本语法错误'
)

// ── 4) SFC 模板错误（旧尺子看不见）────────────────────
const badTemplate = compileSource(
  '<template><div>{{ a + }}</div></template>\n<script setup lang="ts">\nconst a = 1\n</script>\n',
  { filename: 'bad-template.vue' }
)
checkFail(badTemplate, 'SFC 模板表达式错误')

// 反证：模板错、脚本对 —— 只解析 <script> 的旧尺子会绿。这里显式记录这个差异。
const scriptOnlyOk = !/<script[\s\S]*?<\/script>/i.test('<template />')
check(scriptOnlyOk, '测试自检：坏模板样本必须仍含合法脚本（否则无法证明差异）')

// ── 5) SFC 合法 ─────────────────────────────────────
const goodSfc = [
  '<template>',
  '  <es-table :columns="columns">',
  '    <template #column-name="{ row }">{{ row.name }}</template>',
  '  </es-table>',
  '</template>',
  '<script setup lang="ts">',
  'const columns = [{ prop: "name", label: "姓名" }]',
  '</script>',
].join('\n')
check(compileSource(goodSfc, { filename: 'good.vue' }).ok, '合法 SFC 被误判为失败')

// ── 6) compileProduct：schema 模式两段 ───────────────
check(
  compileProduct(
    { code: 'export const pageSchema = { name: "x" }\n', wrapperCode: goodSfc },
    { filename: 'demo.ts' }
  ).ok,
  '合法 schema 产物被误判为失败'
)
checkFail(
  compileProduct(
    { code: 'export const pageSchema = { name: "x" }\n', wrapperCode: goodSfc.replace('{{ row.name }}', '{{ row.name + }}') },
    { filename: 'demo.ts' }
  ),
  'schema 产物：坏 wrapper 模板'
)
checkFail(
  compileProduct({ code: 'export const pageSchema = {{{\n', wrapperCode: goodSfc }, { filename: 'demo.ts' }),
  'schema 产物：坏 pageSchema 模块'
)
checkFail(compileProduct(null), 'compileProduct(null)', { needLine: false })

// ── 7) compileFragment 按 fence 分派 ──────────────────
check(
  compileFragment({ code: goodSfc, fence: 'vue' }, { filename: 'f-form' }).ok,
  'vue fence 的合法片段被误判为失败'
)
check(
  compileFragment({ code: 'export function useX() { return () => <div /> }\n', fence: 'tsx' }, { filename: 'f-dialog' }).ok,
  'tsx fence 的合法片段被误判为失败'
)
checkFail(
  // fence 自报 tsx，但产物是 SFC —— 形态错配必须红（不能靠正则猜着放行）
  compileFragment({ code: goodSfc, fence: 'tsx' }, { filename: 'f-mismatch' }),
  'fence 与产物形态错配',
  { needLine: false }
)

// ── 8) 围栏抽取 / 逐块报错 ────────────────────────────
const fences = extractFences(
  ['```vue', '<template><div /></template>', '```', '```json', '{"a":1}', '```', '```tsx', 'const x = <div />', '```'].join('\n')
)
check(fences.length === 3, `围栏抽取数量错：期望 3，实际 ${fences.length}`)
check(fences[0].lang === 'vue' && fences[1].lang === 'json' && fences[2].lang === 'tsx', '围栏 lang 归一化错误')
check(compileFences(['```ts', 'const a: number = 1', '```'].join('\n'), 'ok-fence').length === 0, '合法围栏被误判为失败')
check(compileFences(['```ts', 'const a: = 1', '```'].join('\n'), 'bad-fence').length === 1, '坏围栏没有被抓到')
check(compileFences('没有任何围栏', 'empty').length === 1, '空围栏应当报错（不是「无需编译」）')

// ── 9) summarizeCompile：编译门口径（AN-13）────────────────────────────
// 关键判据：**模型答错 / 未测到的行没有产物，不进编译分母** —— 否则一次语义 miss
// 就会把 compileRate 拉到 1 以下，而 95% 准确率目标必然允许若干 miss（永久红 = 红盲）。
const compileRows = [
  { file: 'a.json', lang: 'zh', compiles: true, error: null, wrong: false }, // 产物通过
  {
    file: 'b.json',
    lang: 'zh',
    compiles: false,
    error: null,
    wrong: false,
    compileError: { message: 'bad template', file: 'b.vue', line: 3, column: 7 },
  }, // 产物存在但编译失败
  { file: 'c.json', lang: 'zh', compiles: false, error: 'model failed', errorKind: 'model-failure' }, // 模型答错：无产物
  { file: 'd.json', lang: 'zh', compiles: false, error: 'truncated', errorKind: 'truncated' }, // 未测到：无产物
  { file: 'e.json', lang: 'zh', compiles: true, error: null, wrong: true }, // 能编译但语义 miss
]
const compileSummary = summarizeCompile(compileRows, (r) => !r.wrong)
check(compileSummary.measured === 3, `编译分母应只数有产物的行（期望 3，实得 ${compileSummary.measured}）`)
check(compileSummary.compiled === 2, `编译通过行数错（期望 2，实得 ${compileSummary.compiled}）`)
check(
  typeof compileSummary.rate === 'number' && Math.abs(compileSummary.rate - 2 / 3) < 1e-9,
  `compileRate 应为 2/3（实得 ${compileSummary.rate}）`
)
check(compileSummary.failure === 1, `真编译失败行数错（期望 1，实得 ${compileSummary.failure}）`)
check(
  compileSummary.modelFailureCompile === 1,
  `「模型答错但产物能编译」应单列（期望 1，实得 ${compileSummary.modelFailureCompile}）`
)
check(
  compileSummary.failureSamples.length === 1 && compileSummary.failureSamples[0].includes('b.vue:3:7'),
  `编译失败样本必须带 file:line:col（实得 ${JSON.stringify(compileSummary.failureSamples)}）`
)
check(summarizeCompile([]).rate === null, '空行集：rate 必须是 null（不能是 0 或 1）')
check(
  summarizeCompile([{ compiles: true, error: null }]).modelFailureCompile === 0,
  '默认 passes95 全 true：不制造「模型答错」告警'
)

if (failures > 0) {
  console.error(`\ncompile-leg 自测失败：${failures} 条`)
  process.exit(1)
}
console.log('✅ Tier A 编译腿自测通过（TS / TSX / SFC 脚本 / SFC 模板 / product / fragment / 围栏 / 编译门口径）')
