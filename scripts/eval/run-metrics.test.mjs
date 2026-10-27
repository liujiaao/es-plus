#!/usr/bin/env node
/**
 * 跑批指标聚合自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * ## 为什么值得单测
 *
 * `run-metrics.mjs` 是 **eval-llm.mjs 与 rescore.mjs 共用的唯一聚合实现**。
 * 它一旦算错，跑批产物与离线复算会**同时**算错 —— 而且错得一致，于是
 * `check:rescore-parity` 会绿着骗人。所以这里用构造行把每条口径钉死：
 *
 *   1) 空行集 → rate 一律 null（不能是 0 或 1）；
 *   2) 95% 定义 = scoped zero-edit ∨ ≤K 收敛，按 per-row OR；
 *   3) ≤K 的边界（K 本身进 / K+1 出）；
 *   4) few-shot 派生行不进 heldout 分母；
 *   5) 属性准确率只对**可测行**取均值（null 行不参与，也不被当成 0）；
 *   6) Tier A 编译门分母只数**有产物**的行（`error` 行不算编译失败）；
 *   7) 逐维分母只数 `applicable` 的行，留出集非空时不含 en 行；
 *   8) 片段腿：未测到的行不进 scoped 分母，但计入 notMeasured；编译分母只数有产物行。
 *
 * 用法：node scripts/eval/run-metrics.test.mjs
 * 退出码：0 = 口径全部成立；1 = 至少一条失效。
 */
import { computeCrudMetrics, computeFragmentMetrics, CONVERGE_K } from './run-metrics.mjs'
import { CAPABILITY_SCORERS } from './scorers.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const eq = (a, b, msg) => check(a === b, `${msg}（期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}）`)
const near = (a, b, msg) => check(Math.abs(a - b) < 1e-9, `${msg}（期望 ${b}，实得 ${a}）`)

/** 一行最小可用的 CRUD 结果。 */
function row(over = {}) {
  return {
    file: 'case',
    lang: 'zh',
    fewshotDerived: false,
    exactIntentCore: false,
    exactIntentFull: false,
    exactIntentScoped: false,
    propF1: { f1: 0 },
    attrAcc: null,
    actionsF1: { f1: 0 },
    byCapability: {},
    convergence: null,
    compiles: false,
    noThrow: true,
    compileError: null,
    error: null,
    errorKind: null,
    ...over,
  }
}

/** 全维 pass 的 byCapability。 */
function capsAll(pass) {
  const out = {}
  for (const { key } of CAPABILITY_SCORERS) out[key] = { applicable: true, pass }
  return out
}

// ── 1. 空行集 ────────────────────────────────────────────────────────────────
{
  const m = computeCrudMetrics([])
  eq(m.n, 0, '空行集：n = 0')
  eq(m.def95.rate, null, '空行集：95% 定义 rate 必须是 null')
  eq(m.compileRate, null, '空行集：compileRate 必须是 null')
  eq(m.attrAcc, null, '空行集：attrAcc 必须是 null')
  eq(m.coreRate, 0, '空行集：coreRate 退化为 0（沿用既有行为）')
  eq(m.gateRate, 0, '空行集：gateRate 退化为 0（沿用既有行为）')
  for (const { key } of CAPABILITY_SCORERS) eq(m.byCapability[key].rate, null, `空行集：${key} rate 必须是 null`)
}

// ── 2. 95% 定义 = scoped ∨ ≤K 收敛（per-row OR）────────────────────────────────
{
  const rows = [
    row({ file: 'a', exactIntentScoped: true }), // 腿 1
    row({ file: 'b', convergence: { firstTurn: 0 }, exactIntentScoped: false }), // 精修语料，turn-0 命中
    row({ file: 'c', convergence: { firstTurn: 2 } }), // 腿 2（≤K）
    row({ file: 'd', convergence: { firstTurn: 4 } }), // 超 K
    row({ file: 'e' }), // 两条腿都不过
  ]
  const m = computeCrudMetrics(rows)
  eq(m.def95.total, 5, '95% 定义：分母 = heldout 行数')
  eq(m.def95.pass, 3, '95% 定义：a/b/c 命中，d/e 不命中')
  near(m.def95.rate, 3 / 5, '95% 定义：rate = 3/5')
  eq(m.gateRate, 3 / 5, 'gateRate 与 95% 定义同源')

  // 边界：K 本身进、K+1 出（K 从 run-metrics 单点读，防止 rescore 用另一个 K）。
  const atK = computeCrudMetrics([row({ convergence: { firstTurn: CONVERGE_K } })])
  eq(atK.def95.pass, 1, `firstTurn === K(${CONVERGE_K}) 必须算收敛`)
  const overK = computeCrudMetrics([row({ convergence: { firstTurn: CONVERGE_K + 1 } })])
  eq(overK.def95.pass, 0, `firstTurn === K+1 必须不算收敛`)

  // 收敛腿的旁证拆分（turn0 / scripted）——AN-02 要求两条腿可分开读。
  eq(m.convStats.total, 3, '收敛语料只数带 convergence 的行')
  eq(m.convStats.turn0, 1, 'turn-0 命中单独计数')
  eq(m.convStats.scripted, 1, 'scripted（纠正后 ≤K）单独计数')
  eq(m.convStats.withinK, 2, 'withinK = turn0 + scripted')
}

// ── 3. heldout / few-shot 分母 ────────────────────────────────────────────────
{
  const rows = [
    row({ file: 'ho', exactIntentCore: true }),
    row({ file: 'fs', fewshotDerived: true, exactIntentCore: true }),
  ]
  const m = computeCrudMetrics(rows)
  eq(m.n, 2, 'n = 全部 zh 行')
  eq(m.heldout.length, 1, 'heldout 排除 few-shot 派生行')
  eq(m.fewshotRows.length, 1, 'few-shot 行单独成组')
  near(m.exact, 1, 'ALL 口径含 few-shot')
  near(m.exactHeldout, 1, 'HELDOUT 口径只算留出集')
  near(m.exactFewshot, 1, 'few-shot recall 单独公布')
  eq(m.coreRate, m.exactHeldout, 'coreRate 取 heldout 优先')
}

// ── 4. 属性准确率只对可测行取均值 ─────────────────────────────────────────────
{
  const rows = [
    row({ file: 'a', attrAcc: 1 }),
    row({ file: 'b', attrAcc: 0.5 }),
    row({ file: 'c', attrAcc: null }), // 零共享字段：不可测
  ]
  const m = computeCrudMetrics(rows)
  eq(m.attrRows.length, 2, 'attrRows 只数 attrAcc 为数字的行')
  near(m.attrAcc, 0.75, 'attrAcc 均值不含 null 行，也不把 null 当 0')
}

// ── 5. Tier A 编译门分母（A5：含 en 腿） ─────────────────────────────────────
{
  const rows = [
    row({ file: 'ok', compiles: true }),
    row({ file: 'bad', compiles: false }),
    row({ file: 'err', compiles: false, error: 'boom', errorKind: 'model-failure' }), // 没产物
    row({ file: 'en', lang: 'en', compiles: true }),
    row({ file: 'en-bad', lang: 'en', compiles: false }),
  ]
  const m = computeCrudMetrics(rows)
  eq(m.compileStats.measured, 4, '编译分母 = **两条腿**里有产物的行（error 行仍不计）')
  eq(m.compileStats.compiled, 2, '编译通过数（zh 1 + en 1）')
  near(m.compileRate, 0.5, 'compileRate = 2/4')
  eq(m.compileStats.failure, 2, '真编译失败单列（zh 1 + en 1）')
  eq(m.compileStats.byLang.zh.measured, 2, 'byLang.zh 只数 zh 的有产物行')
  eq(m.compileStats.byLang.en.failure, 1, 'byLang.en 把 en 腿的编译失败计入（A5 的意义）')

  // 反证：A5 之前 en 不进分母，一条 en 编译失败会被完全漏掉 —— 这条测试钉住那个缺口。
  const enOnlyBad = [row({ file: 'ok', compiles: true }), row({ file: 'en-bad', lang: 'en', compiles: false })]
  check(computeCrudMetrics(enOnlyBad).compileRate < 1, 'en 腿的编译失败必须拉低门槛（否则编译门被 zh 单腿撑绿）')
}

// ── 6. 逐维分母：留出集非空时不含 en ──────────────────────────────────────────
{
  const rows = [
    row({ file: 'ho', byCapability: capsAll(true) }),
    row({ file: 'en', lang: 'en', byCapability: capsAll(false) }),
  ]
  const m = computeCrudMetrics(rows)
  const k = CAPABILITY_SCORERS[0].key
  eq(m.byCapability[k].applicable, 1, '留出集非空：逐维分母只含 zh heldout')
  eq(m.byCapability[k].pass, 1, 'pass 只数 zh heldout 的命中')
}

// ── 7. 片段腿 ────────────────────────────────────────────────────────────────
{
  const isNotMeasured = (kind) => kind === 'no-answer'
  const fragmentRows = [
    { file: 'f1', scene: 'table', compiles: true, error: null, score: { exactIntentScoped: true, exactIntentCore: true, exactIntentFull: true, exactIntentStated: true, byDim: { x: { applicable: true, pass: true } } } },
    { file: 'f2', scene: 'table', compiles: false, error: null, score: { exactIntentScoped: false, exactIntentCore: false, exactIntentFull: false, exactIntentStated: false, byDim: { x: { applicable: true, pass: false } } } },
    { file: 'f3', scene: 'form', compiles: false, error: 'no text', errorKind: 'no-answer', score: null },
    { file: 'f4', scene: 'form', compiles: false, error: 'bad', errorKind: 'model-failure', score: null },
  ]
  const { fragmentSummary, fragNotMeasuredRows } = computeFragmentMetrics(fragmentRows, isNotMeasured)
  eq(fragmentSummary.cases, 4, '片段 cases = 全部行')
  eq(fragmentSummary.notMeasured, 1, '未测到只数 no-answer')
  eq(fragmentSummary.measured, 3, 'measured 排除未测到（model-failure 仍在成绩里）')
  near(fragmentSummary.scoped, 1 / 3, 'scoped 分母 = measured，未测到不进分母')
  eq(fragmentSummary.compileMeasured, 2, '片段编译分母 = 有产物的行')
  near(fragmentSummary.compileRate, 0.5, '片段 compileRate = 1/2')
  eq(fragmentSummary.byDim.x.pass, 1, '片段逐维命中数')
  eq(fragmentSummary.byDim.x.applicable, 2, '片段逐维分母只数 measured')
  eq(fragNotMeasuredRows.length, 1, '未测到行进单独列表（供告警）')
}

// ── 8. 门禁口径逐维视图（A3）：分母只数 pin 了该维的行 ─────────────────────────
{
  const k = CAPABILITY_SCORERS[0].key
  const rows = [
    row({ file: 'pinned-pass', pinnedDims: [k], byCapability: { [k]: { applicable: true, pass: true } } }),
    row({ file: 'pinned-field', pinnedDims: [`${k}:someField`], byCapability: { [k]: { applicable: true, pass: false } } }),
    row({ file: 'unpinned-fail', pinnedDims: [], byCapability: { [k]: { applicable: true, pass: false } } }),
    row({ file: 'pinned-err', pinnedDims: [k], byCapability: { [k]: { applicable: true, pass: false } }, error: 'boom' }),
  ]
  const m = computeCrudMetrics(rows)
  eq(m.byCapability[k].applicable, 4, 'all 口径分母 = 全部 heldout 行（含没 pin 的）')
  eq(m.byCapabilityOnPinned[k].applicable, 3, 'pinned 分母 = 钉了该维的行（字段级 pin 也算，答错行也要算）')
  eq(m.byCapabilityOnPinned[k].pass, 1, 'pinned 分子只数命中')
  // 逐维 rate 与 `byCapability` 同精度（4 位小数），断言用同一个精度，避免尾数假红。
  eq(m.byCapabilityOnPinned[k].rate, 0.3333, 'pinned rate = 1/3（4 位小数）')
  eq(m.byCapabilityOnPinned[CAPABILITY_SCORERS[1].key].rate, null, '没有任何行 pin 的维度 rate 必须是 null（不是 0）')
  // 反证：若两列恒等，A3 就没有信息量（这正是加它的理由 —— all 口径把未 pin 的失败也稀释进来）。
  check(
    m.byCapability[k].rate !== m.byCapabilityOnPinned[k].rate,
    'all 与 pinned 两个口径必须能给出不同数字（否则排序依据没变）'
  )
  // 旧 dump 重建出来的行没有 pinnedDims：不得抛错，也不得把缺省当「pin 了」。
  const legacy = computeCrudMetrics([row({ byCapability: { [k]: { applicable: true, pass: true } } })])
  eq(legacy.byCapabilityOnPinned[k].applicable, 0, '无 pinnedDims 的行不进 pinned 分母')
}

if (failures > 0) {
  console.error(`\nrun-metrics 自测失败：${failures} 条`)
  process.exit(1)
}
console.log('✅ 跑批指标聚合自测通过（95% 定义 OR / K 边界 / heldout / 属性分母 / 编译门 / 逐维 / 片段腿 / 门禁口径逐维）')
