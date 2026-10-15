#!/usr/bin/env node
/**
 * 准确率回归防线（AI-33 ④⑤⑦）—— 纯函数，无 I/O、无 key、无 `Date`。
 *
 * ## 为什么单独一个模块
 *
 * 门禁迁到 `∨`（definition95 = scoped zero-edit ∨ ≤K 轮收敛）之后，门禁**变松**：
 * `∨ ≥ core` 恒成立（第二条腿是 OR，第一条腿钉的是 NL 锁定的子集，通常宽于四维 core）。
 * AI-33 的论证是——三种失效模式各有补丁，缺一不可：
 *
 *   · **core 当门禁** → 永久红 → 红盲（比无门禁更糟）
 *   · **∨ 单独当门禁** → 加简单语料即可稀释均值
 *   · **∨ + 逐维棘轮 + core 非回归地板** → 无已知失效模式
 *
 * 故本模块把后两条腿做成**可离线验证的纯函数**：eval 是付费的、只在夜间跑，
 * 但「这些防线逻辑本身对不对」必须能在每次 PR 上免费验。`ratchet.test.mjs` 用
 * 合成数据 + 真实语料把这些函数打穿（每条变异都必须报出预期消息）。
 *
 * ## 两类棘轮为什么分开
 *
 * · **计数棘轮（防删难例）**：某维的 `applicable` 数**只由语料 + scorer 注册表决定**，
 *   与模型无关 → 基线立刻能填真值 → **不需要付费跑就能咬人**。
 * · **比率棘轮**：`definition95` / `coreRate` / `byDimension.*.rate` 只能来自 eval 产物 →
 *   基线缺这些字段时 skip 并 warn（新克隆不红），首跑后填上即生效。
 *
 * 这个分离是刻意的：一个只在夜间才生效的防线，白天等于不存在。
 */

/** ④ core 非回归地板。core 是四维硬诚实口径；跌破此线视为灾难性回归（如 system prompt 被改坏）。 */
export const CORE_FLOOR = 0.2

/** ⑦ heldout 绝对地板。相对守卫（heldout ≥ 半数）防洗白，绝对地板防语料整体缩水。 */
export const HELDOUT_FLOOR = 60

/** ⑤ 棘轮容差。0 = 只要退步就红（比率噪声由「基线只经人工 PR 上调」治理，不靠容差）。 */
export const RATCHET_TOL = 0

const pct = (x) => `${(x * 100).toFixed(1)}%`

/**
 * ④ core 非回归地板。
 * @param {{coreRate:number, heldoutCases:number}} summary
 */
export function evaluateFloor(summary, { floor = CORE_FLOOR } = {}) {
  const failures = []
  if (!summary?.heldoutCases) {
    // 没有分母时**不能**静默放过：零分母会让 rate 变成 0 或 NaN，两种都像「崩塌」，
    // 但真实原因是「没测」—— F6 健康门治的是同一类混淆。
    failures.push('core 地板无分母：heldoutCases 为 0，无法判断 core 是否崩塌')
  } else if (summary.coreRate < floor) {
    failures.push(
      `core 口径 ${pct(summary.coreRate)} 跌破非回归地板 ${pct(floor)} ` +
        `—— 收敛腿不得掩盖 core 崩塌（core 是四维硬诚实口径，门禁迁 ∨ 后它降为并列诊断，但跌破地板仍必须红）`
    )
  }
  return { ok: failures.length === 0, failures }
}

/** ⑦ heldout 规模地板（绝对）。 */
export function checkCorpusSize(summary, { floor = HELDOUT_FLOOR } = {}) {
  const failures = []
  if ((summary?.heldoutCases ?? 0) < floor) {
    failures.push(
      `heldout 仅 ${summary?.heldoutCases ?? 0} 条，低于地板 ${floor} ` +
        `—— 语料规模不足以支撑泛化结论（单例噪声过大，门禁会落在噪声上）`
    )
  }
  return { ok: failures.length === 0, failures }
}

/**
 * ⑤ 比率棘轮：与基线比 `definition95` / `coreRate` / 逐维 rate。
 *
 * 逐维比较**按基线的键集迭代**，而不是当前结果的键集 —— 否则「删掉一个 scorer 维度」
 * 会让比较集静默缩小，退步反而看不见。
 *
 * @param {{definition95:number|null, coreRate:number, byDimension?:Record<string,number>}} current
 * @param {null|{definition95?:number, coreRate?:number, byDimension?:Record<string,number>}} baseline
 */
export function compareToBaseline(current, baseline, { tol = RATCHET_TOL } = {}) {
  const failures = []
  const warnings = []
  if (!baseline) {
    warnings.push('无基线文件（首次跑批）—— 跳过比率棘轮，仅门禁与地板生效')
    return { ok: true, failures, warnings }
  }

  const cmp = (label, cur, base) => {
    if (typeof base !== 'number') return
    if (typeof cur !== 'number' || Number.isNaN(cur)) {
      failures.push(`${label} 在基线里是 ${pct(base)}，本次却没有数字（测量缺失或该口径被移除）`)
      return
    }
    if (cur < base - tol) failures.push(`${label} 退步：本次 ${pct(cur)} < 基线 ${pct(base)}（容差 ${tol}）`)
  }

  cmp('definition95（∨）', current.definition95, baseline.definition95)
  cmp('coreRate', current.coreRate, baseline.coreRate)

  for (const [dim, base] of Object.entries(baseline.byDimension ?? {})) {
    const cur = current.byDimension?.[dim]
    if (typeof cur !== 'number') {
      failures.push(`维度 ${dim} 在基线里有、本次缺席 —— 疑似删除了该 scorer 维度（或它不再被任何用例触发）`)
      continue
    }
    if (cur < base - tol) failures.push(`维度 ${dim} 退步：本次 ${pct(cur)} < 基线 ${pct(base)}`)
  }
  return { ok: failures.length === 0, failures, warnings }
}

/**
 * ⑤ 防「删难例洗分」守卫（计数棘轮，**离线可跑**）。
 *
 * 比率棘轮护不住**分母**：删掉那 15 条 `mergeConfig` 用例后，
 * `byDimension.mergeConfig.rate` 可能仍是 1.0，而该能力已经无人验收。
 * 故另立一条**计数**断言：某维的适用用例数（语料级）不得低于基线。
 *
 * @param {Record<string, number>} currentCounts 语料级 applicable 计数
 * @param {null|{applicableCounts?:Record<string, number>}} baseline
 */
export function guardAntiDelete(currentCounts, baseline) {
  const failures = []
  const warnings = []
  const base = baseline?.applicableCounts
  if (!base) {
    warnings.push('基线无 applicableCounts（首跑前）—— 跳过防删守卫')
    return { ok: true, failures, warnings }
  }
  for (const [dim, n] of Object.entries(base)) {
    const cur = currentCounts?.[dim]
    if (cur === undefined) {
      failures.push(`维度 ${dim} 在基线的计数表里存在、本次却完全缺席 —— 疑似删除了该维度`)
      continue
    }
    if (cur < n) {
      failures.push(
        `维度 ${dim} 的适用用例数从 ${n} 掉到 ${cur} —— 疑似删除了难例` +
          `（删例可稀释均值：比率棘轮看得见 rate，看不见分母）`
      )
    }
  }
  return { ok: failures.length === 0, failures, warnings }
}

/**
 * 语料级逐维 applicable 计数。
 *
 * scorer 注册表**原样传入**（不重推导）：`applicable` 是 scorer 对一条 gold config 的
 * 适用性判断，任何本地重写都会与真正的打分口径漂移。
 *
 * @param {object[]} goldConfigs 已 Zod 解析的 gold config 列表
 * @param {{key:string, applicable:(g:object)=>boolean}[]} scorers
 */
export function applicableCountsFromCases(goldConfigs, scorers) {
  const counts = {}
  for (const { key, applicable } of scorers) {
    counts[key] = goldConfigs.reduce((n, g) => n + (applicable(g) ? 1 : 0), 0)
  }
  return counts
}

/** 把若干 {ok,failures,warnings} 合成一个，便于 eval 与守卫统一处理。 */
export function combine(...results) {
  const failures = results.flatMap((r) => r?.failures ?? [])
  const warnings = results.flatMap((r) => r?.warnings ?? [])
  return { ok: failures.length === 0, failures, warnings }
}
