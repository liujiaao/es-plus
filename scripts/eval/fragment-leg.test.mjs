#!/usr/bin/env node
/**
 * 片段腿门禁自测（AN-18，meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 为什么值得单测：这条腿决定了**夜间是否红**。它有两种相反方向的骗人方式——
 *   · 把「模型答错（没有产物）」算成编译失败 ⟹ 准确率目标下门禁恒红（红盲）；
 *   · 把「未测到 / 零分母 / 基线缺阈值」放行 ⟹ 门禁绿只是因为**没看**。
 * 故这里用构造行把每种分类钉死。
 *
 * 钉住的九条：
 *   1) 健康：63/63 测到、产物全编译、scoped = 地板 ⟹ ok；
 *   2) 浮点尾数不得假红：49/63=0.77777… vs 地板 0.7778 ⟹ ok；
 *   3) 有产物但编译失败 ⟹ 红（发射器缺陷）；
 *   4) 模型答错（error 非空、compiles=false）不计入编译分母 ⟹ 不因此红；
 *   5) 未测到 1 行 ⟹ 红（测量不完整）；
 *   6) cases=0 / measured=0 ⟹ 红（零分母不是全对）；
 *   7) 基线缺 fragmentScopedMin ⟹ 红（fail closed，不静默放行）；
 *   8) scoped 低于地板 ⟹ 红；
 *   9) 全部行没有产物（全 model-failure）⟹ 红（编译门无分母）。
 */
import { summarizeFragmentLeg, fragmentScopedFloor, FRAGMENT_COMPILE_FLOOR } from './fragment-leg.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const has = (r, re) => r.failures.some((f) => re.test(f))

/** 一条「测到且编译通过」的片段行。 */
const okRow = (file = 'frag-table-01-vue3.json', scene = 'table') => ({
  file,
  scene,
  error: null,
  errorKind: null,
  compiles: true,
  compileError: null,
})
/** 模型答错：有 error、没有产物（compiles=false 是「没有产物」的既有占位）。 */
const modelFailRow = (file = 'frag-form-01-vue3.json', scene = 'form') => ({
  file,
  scene,
  error: 'model-failure: 3 轮均未产出合法工具入参',
  errorKind: 'model-failure',
  compiles: false,
  compileError: null,
})
/** 有产物但编译不过。 */
const compileBadRow = (file = 'frag-dialog-01-vue3.json', scene = 'dialog') => ({
  file,
  scene,
  error: null,
  errorKind: null,
  compiles: false,
  compileError: { message: 'Unexpected token', file: 'dialog-fragment.tsx', line: 2, column: 5 },
})

function summary({ rows, scoped, cases = rows.length, measured = rows.length, notMeasured = 0 }) {
  return { cases, measured, notMeasured, scoped }
}

const BASE = { fragmentScopedMin: 0.7778 }

// ① 健康
{
  const rows = Array.from({ length: 63 }, (_, i) => okRow(`frag-${i}.json`))
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 49 / 63 }), BASE)
  check(r.ok === true, `① 63 条全测到、全编译、scoped 达地板时应 ok（failures: ${r.failures.join(' | ')}）`)
  check(r.compileMeasured === 63 && r.compileFailure === 0, '① 编译口径应为 63 有产物 / 0 失败')
  check(r.floor === 0.7778, '① 地板应从基线读出')
}

// ② 浮点尾数：同一次跑批不得因 0.77777… < 0.7778 假红
{
  const rows = [okRow()]
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 49 / 63 }), BASE)
  check(r.ok === true, `② 49/63=0.77777… 与地板 0.7778 应判等（实得 failures: ${r.failures.join(' | ')}）`)
}

// ③ 有产物但编译失败
{
  const rows = Array.from({ length: 9 }, (_, i) => okRow(`frag-${i}.json`)).concat([compileBadRow()])
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 0.9 }), BASE)
  check(r.ok === false, '③ 有产物但编译失败必须红')
  check(r.compileFailure === 1 && r.compileMeasured === 10, `③ 编译分母应含该行（实得 ${r.compileCompiled}/${r.compileMeasured}）`)
  check(has(r, /发射器缺陷/), '③ 失败文案应指明这是发射器缺陷而非模型准确率')
  check(r.failures.join(' ').includes('dialog-fragment.tsx:2:5'), '③ 应带 file:line:col 便于定位')
}

// ④ 模型答错不计入编译分母
{
  const rows = Array.from({ length: 9 }, (_, i) => okRow(`frag-${i}.json`)).concat([modelFailRow()])
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 0.9 }), BASE)
  check(r.ok === true, `④ 唯一的失败是模型答错（无产物）时不得红（failures: ${r.failures.join(' | ')}）`)
  check(r.compileMeasured === 9, `④ 编译分母必须排除无产物行（实得 ${r.compileMeasured}）`)
}

// ⑤ 未测到
{
  const rows = Array.from({ length: 62 }, (_, i) => okRow(`frag-${i}.json`))
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 0.9, cases: 63, measured: 62, notMeasured: 1 }), BASE)
  check(r.ok === false && has(r, /未测到/), '⑤ 任一未测到的行必须判红（测量不完整）')
}

// ⑥ 零分母
{
  check(summarizeFragmentLeg([], summary({ rows: [], scoped: null, cases: 0, measured: 0 }), BASE).ok === false, '⑥ cases=0 必须红')
  const r0 = summarizeFragmentLeg([], summary({ rows: [], scoped: null, cases: 5, measured: 0 }), BASE)
  check(r0.ok === false && has(r0, /全部未测到/), '⑥ measured=0 必须红，且文案区分「没测」')
}

// ⑦ 基线缺阈值（fail closed）
{
  const rows = [okRow()]
  for (const baseline of [null, {}, { fragmentScopedMin: null }, { fragmentScopedMin: 1.2 }]) {
    const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 1 }), baseline)
    check(r.ok === false && has(r, /fragmentScopedMin/), `⑦ 基线 ${JSON.stringify(baseline)} 缺/非法阈值时必须红`)
  }
  check(fragmentScopedFloor({ fragmentScopedMin: 0 }) === 0, '⑦ 地板 0 是合法值（不能按 falsy 判缺失）')
}

// ⑧ scoped 退步
{
  const rows = [okRow()]
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 0.75 }), BASE)
  check(r.ok === false && has(r, /退步/), '⑧ 低于地板必须红')
  check(FRAGMENT_COMPILE_FLOOR === 1, '⑧ 编译地板必须是显式的 1（放宽要成为 PR 里的显式决定）')
}

// ⑨ 全部行没有产物
{
  const rows = [modelFailRow(), modelFailRow('frag-form-02-vue3.json')]
  const r = summarizeFragmentLeg(rows, summary({ rows, scoped: 0 }), BASE)
  check(r.ok === false && has(r, /没有任何可编译产物/), '⑨ 所有行都没有产物时编译门必须红（零分母不是全对）')
}

if (failures) {
  console.error(`\n[fragment-leg] ${failures} 条断言失败`)
  process.exit(1)
}
console.log('[fragment-leg] 编译分母 / 未测到 / 零分母 / 基线缺失 / 浮点精度 全部通过 ✔')
