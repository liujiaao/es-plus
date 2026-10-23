/**
 * 跑批指标聚合（纯函数）—— **唯一实现**。
 *
 * ## 为什么抽出来
 *
 * `scripts/eval/rescore.mjs` 要用一份落盘的预测（dump）离线重算同一批指标。
 * 如果 rescore 另写一份聚合，两段代码迟早漂移，而漂移的表现是「复算与产物对不上」——
 * 读者会先怀疑打分器，实际是复制品不同步。
 *
 * 因此本文件是 CRUD / 片段两条腿指标聚合的唯一实现：`eval-llm.mjs`（真跑批）与
 * `rescore.mjs`（离线复算）都调它。**判据（`definition95` / `core` / `scoped` / 各维度）
 * 的定义仍只在 `scorers.mjs`**——这里只做「把逐行结果按同一口径求和」，不含任何新口径。
 *
 * ## 口径纪律（与 eval-llm.mjs 头部一致，改动前先读那里）
 *
 *   - 门禁语言是 zh；en 只观测，不进门禁数字。
 *   - heldout = zh 行中非 few-shot 派生的那些；留出集为空时才退回全量（避免除零）。
 *   - `model-failure` 行（模型答错）**在成绩里**并按 0 计；它由逐行 `byCapability` 的
 *     applicable=false 体现 —— 这里不改写任何行的分数。
 *   - 片段腿与 CRUD 腿是两套独立分母，绝不合并。
 */

import { CAPABILITY_SCORERS, meets95Definition, summarize95, summarizeConvergence } from './scorers.mjs'
import { summarizeCompile } from './compile-leg.mjs'

/**
 * 「≤K 轮收敛」的 K。
 *
 * 用户拍板的 95% 定义是「scoped zero-edit ∨ ≤K 轮收敛」，K 与 scoped 维度集同源
 * （AI-33②）。此前它是 `eval-llm.mjs` 里的一个裸常量，rescore 无法引用 ⟹ 复算会
 * 悄悄用另一个 K。现在单点定义在这里，两处都 import。
 */
export const CONVERGE_K = 3

const meanOf = (rows) => (sel) => (rows.length ? rows.reduce((a, r) => a + sel(r), 0) / rows.length : 0)

/**
 * CRUD 腿指标聚合。
 *
 * @param {Array<object>} rows 逐行结果（含 lang / fewshotDerived / exactIntent* / propF1 /
 *        attrAcc / actionsF1 / byCapability / convergence / compiles / error）
 * @param {{convergeK?: number}} [opts]
 * @returns {object} 与 eval-llm.mjs 原内联聚合逐字段同名，便于直接解构替换
 */
export function computeCrudMetrics(rows, { convergeK = CONVERGE_K } = {}) {
  const zhRows = rows.filter((r) => r.lang === 'zh')
  const enRows = rows.filter((r) => r.lang === 'en')
  const n = zhRows.length
  const heldout = zhRows.filter((r) => !r.fewshotDerived)
  const fewshotRows = zhRows.filter((r) => r.fewshotDerived)

  const meanAll = meanOf(zhRows)
  const meanHeldout = meanOf(heldout)
  const meanFewshot = meanOf(fewshotRows)

  const exact = meanAll((r) => (r.exactIntentCore ? 1 : 0))
  const exactHeldout = heldout.length ? meanHeldout((r) => (r.exactIntentCore ? 1 : 0)) : null
  const exactFewshot = fewshotRows.length ? meanFewshot((r) => (r.exactIntentCore ? 1 : 0)) : null
  const exactFull = meanAll((r) => (r.exactIntentFull ? 1 : 0))
  const exactFullHeldout = heldout.length ? meanHeldout((r) => (r.exactIntentFull ? 1 : 0)) : null
  const exactScoped = meanAll((r) => (r.exactIntentScoped ? 1 : 0))
  const exactScopedHeldout = heldout.length ? meanHeldout((r) => (r.exactIntentScoped ? 1 : 0)) : null
  const propF1 = meanAll((r) => r.propF1?.f1 ?? 0)
  // 属性准确率只在「有共享字段」的行上有定义（scorers 返回 null）。对 null 行取 0 会把
  // 「无可测项」当成「全错」，取 1 又会真空抬高 —— 故只在可测行上取均值并公布分母。
  const attrRows = zhRows.filter((r) => typeof r.attrAcc === 'number')
  const attrAcc = attrRows.length ? attrRows.reduce((a, r) => a + r.attrAcc, 0) / attrRows.length : null
  const actF1 = meanAll((r) => r.actionsF1?.f1 ?? 0)

  // B3 收敛（只观测、不门禁）：收敛语料 = 标了 refinements 的中文行；heldout 优先、空则退全量。
  // firstTurn=0 即 zero-edit 收敛（0 次纠正）；null = 喂完所有纠正仍未 scoped 命中。
  const convZhRows = zhRows.filter((r) => r.convergence)
  const convHeldout = convZhRows.filter((r) => !r.fewshotDerived)
  const convSource = convHeldout.length ? convHeldout : convZhRows
  const convStats = summarizeConvergence(
    convSource.map((r) => ({ firstTurn: r.convergence.firstTurn })),
    convergeK
  )

  // 「95% 定义」统一数：scoped zero-edit ∨ ≤K 轮收敛，按 per-row OR 聚合。
  const def95Rows = heldout.length ? heldout : zhRows
  const def95 = summarize95(def95Rows, convergeK)

  // Tier A 编译门（AN-13）：分母 = **真有产物的行**（`error` 为空）。
  const compileStats = summarizeCompile(zhRows, (r) => meets95Definition(r, convergeK))

  // 按维度在留出集上聚合：applicable=被多少 case 用到，pass=命中数，rate=命中率。
  // 注意 capRows 用的是 `rows`（含 en），与留出集口径**刻意不同**——沿用既有行为，
  // rescore 也必须一致，否则复算的 byCapability 会与产物对不上。
  const capRows = heldout.length ? heldout : rows
  const byCapability = {}
  for (const { key } of CAPABILITY_SCORERS) {
    let applicable = 0
    let pass = 0
    for (const r of capRows) {
      const c = r.byCapability?.[key]
      if (c && c.applicable) {
        applicable++
        if (c.pass) pass++
      }
    }
    byCapability[key] = {
      applicable,
      pass,
      rate: applicable ? Number((pass / applicable).toFixed(4)) : null,
    }
  }

  // 门禁数字 = 用户拍板的「95% 定义」；core（四维 exactIntentCore）降为并列诊断。
  const coreRate = exactHeldout ?? exact
  const gateRate = def95.rate ?? 0

  return {
    zhRows,
    enRows,
    n,
    heldout,
    fewshotRows,
    exact,
    exactHeldout,
    exactFewshot,
    exactFull,
    exactFullHeldout,
    exactScoped,
    exactScopedHeldout,
    propF1,
    attrRows,
    attrAcc,
    actF1,
    convZhRows,
    convHeldout,
    convStats,
    def95,
    compileStats,
    compileRate: compileStats.rate,
    byCapability,
    coreRate,
    gateRate,
  }
}

/**
 * 片段腿汇总（AI-SCENE-COVERAGE §1.2；只观测）。
 *
 * 口径纪律与 CRUD 一致：`model-failure` = 模型答错了 ⟹ **在成绩里**（记 0 分）；
 * `no-answer`/`truncated` = 没测到 ⟹ 不进分母，但必须显式报出条数。
 * 编译口径与 CRUD 的 Tier A 腿（AN-13）同一把尺子：分母 = **真有产物**的行。
 *
 * @param {Array<{error?:string|null, errorKind?:string|null, scene?:string, score?:object|null, compiles?:boolean}>} fragmentRows
 * @param {(kind: string|null|undefined) => boolean} isNotMeasured 未测到判据（repair-loop 提供）
 */
export function computeFragmentMetrics(fragmentRows, isNotMeasured) {
  const fragNotMeasuredRows = fragmentRows.filter((r) => r.error && isNotMeasured(r.errorKind))
  const fragMeasured = fragmentRows.filter((r) => !(r.error && isNotMeasured(r.errorKind)))
  const fragCompile = summarizeCompile(fragmentRows)
  const fragHit = (r, sel) => (r.score ? (sel(r.score) ? 1 : 0) : 0)
  const fragMean = (rs, sel) => (rs.length ? rs.reduce((a, r) => a + fragHit(r, sel), 0) / rs.length : null)

  const summary = {
    cases: fragmentRows.length,
    measured: fragMeasured.length,
    notMeasured: fragNotMeasuredRows.length,
    core: fragMean(fragMeasured, (s) => s.exactIntentCore),
    full: fragMean(fragMeasured, (s) => s.exactIntentFull),
    scoped: fragMean(fragMeasured, (s) => s.exactIntentScoped),
    stated: fragMean(fragMeasured, (s) => s.exactIntentStated),
    compileRate: fragCompile.rate,
    compileMeasured: fragCompile.measured,
    compileCompiled: fragCompile.compiled,
    compileFailure: fragCompile.failure,
    byScene: {},
    byDim: {},
  }
  for (const scene of ['table', 'form', 'dialog']) {
    const rs = fragMeasured.filter((r) => r.scene === scene)
    if (!rs.length) {
      summary.byScene[scene] = null
      continue
    }
    const sceneCompile = summarizeCompile(fragmentRows.filter((r) => r.scene === scene))
    summary.byScene[scene] = {
      cases: rs.length,
      core: fragMean(rs, (s) => s.exactIntentCore),
      full: fragMean(rs, (s) => s.exactIntentFull),
      scoped: fragMean(rs, (s) => s.exactIntentScoped),
      stated: fragMean(rs, (s) => s.exactIntentStated),
      compileRate: sceneCompile.rate,
    }
  }

  const fragDimAgg = {}
  for (const r of fragMeasured) {
    for (const [dim, v] of Object.entries(r.score?.byDim ?? {})) {
      if (!v.applicable) continue
      const a = (fragDimAgg[dim] ??= { applicable: 0, pass: 0 })
      a.applicable++
      if (v.pass) a.pass++
    }
  }
  for (const [dim, a] of Object.entries(fragDimAgg)) {
    summary.byDim[dim] = {
      applicable: a.applicable,
      pass: a.pass,
      rate: Number((a.pass / a.applicable).toFixed(4)),
    }
  }

  return { fragmentSummary: summary, fragNotMeasuredRows }
}
