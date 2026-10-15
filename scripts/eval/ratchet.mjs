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

/**
 * ⑨ 健康门允许的「未打分行」上限。**0 是刻意的**，理由见 `evaluateHealth`。
 * 留成常量是为了让「放宽这条」成为一个**显式的、要在 PR 里辩护的**决定。
 */
export const MAX_ERRORED_ROWS = 0

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

/**
 * ⑨ 跑批顺序：**门禁语言优先**。
 *
 * 中继额度是有限的（2026-10-15 那一跑在 133/186 处撞上 `403 not enough member budget`）。
 * 逐文件「zh 然后 en」交错执行时，额度耗尽会同时砍掉两种语言的同一段语料尾部 —— 于是连
 * **门禁语言 zh** 都只剩一个按语料顺序偏置的半截样本（实测丢失的正是 46–99 整段、若干完整
 * 特性族），既不能出分、也不能当基线。
 *
 * 门禁只读 zh 行、en 纯属观测，故把门禁语言整体排在前面：额度再耗尽，最坏只是观测腿残缺，
 * 而门禁那一份是**完整且无偏**的。这把一次基础设施故障从「抹掉整次测量」降级为「少一列观测」，
 * 并且失败**可诊断**：zh 满、en 缺 ⟺ 后段额度耗尽。
 *
 * 稳定排序：门禁语言内部保持语料顺序（报告可读、可与历史逐条对齐）。
 *
 * @param {object[]} plan 每项须带 `lang`
 * @param {string} gatedLang 门禁语言（默认 zh，与 eval-llm 的 zhRows 一致）
 */
export function orderPlanGatedFirst(plan, gatedLang = 'zh') {
  return [...plan].sort((a, b) => (a.lang === b.lang ? 0 : a.lang === gatedLang ? -1 : 1))
}

/**
 * ⑨ 测量健康门：「**测量没发生**」必须与「**模型得低分**」长得不一样。
 *
 * ## 为什么需要它（2026-10-15 首跑证实）
 *
 * eval 把每条打不开的行都写成**全红行**（`compiles:false`、四维全 false），并且
 * **照常计入每一个分母**。于是：
 *
 *   · 中继 401/403（key 错 / `not enough member budget` 额度耗尽）在语料尾部成片失败时，
 *     产物仍带着一个**看似合理的低分**——`compileRate` 71.5% 其实就是 133/186，
 *     也就是 **53 条 403 被当成 53 次编译失败**（而实测部分 compiles = 133/133 = 100%）。
 *
 * 这比「全 0」危险得多：全 0 一眼假，而 71.5% 看起来就像一个**真实的灾难性回归**，
 * 会被当成结论、写进基线、再去驱动一轮无用的排查。
 *
 * ## 为什么阈值是 0 而不是「允许几条」
 *
 * 错误行不是噪声，是**系统性偏差**：每一条都以 0 计入分子/分母，且失败位置与语料顺序
 * 强相关（今晚丢失的是 46–99 整段、若干完整特性族）——即活下来的子集是**选择偏置**样本，
 * 既不能当分数、也不能当基线。故没有「小到可忽略」的错误数；**任何**打不开的行都让这次
 * 运行不构成一次测量。
 *
 * @param {{applicableTotal:number, def95:{rate:number|null,total:number}, erroredRows:number, rows:number}} s
 */
export function evaluateHealth(s) {
  const failures = []
  if (!s || !s.rows) {
    failures.push(`本次没有产出任何一行（rows=${s ? s.rows : 'n/a'}）—— 测量没发生`)
    return { ok: false, failures }
  }
  if (!s.applicableTotal) {
    // 四维 scorer 里 propSet/formtype/membership/actions 恒 applicable:true，
    // 故凡**成功打分**的行至少累加 4。合计为 0 ⟺ 没有任何 gold 走到打分器。
    failures.push('四维 applicable 合计为 0 —— 没有任何 gold 走到打分器，测量没发生')
  }
  if (s.def95?.rate === null || s.def95?.rate === undefined || !s.def95?.total) {
    // 门禁已迁到 ∨，而 ∨ 的分母与四维**来源不同**（scoped/convergence 两条腿）。
    // 两者必须各自检查，否则一条腿哑了会被另一条腿的绿灯遮住。
    failures.push(`95% 定义（∨）没有分母或没算出来（total ${s.def95?.total} / rate ${s.def95?.rate}）—— 门禁数字会是 0，那是「没测」不是「得 0」`)
  }
  if (s.erroredRows > MAX_ERRORED_ROWS) {
    const pctScored = s.rows ? ((s.rows - s.erroredRows) / s.rows) * 100 : 0
    failures.push(
      `${s.rows} 行里 ${s.erroredRows} 行打不开（仅 ${pctScored.toFixed(1)}% 走到打分器）—— ` +
        `错误行以 0 计入所有分母，故本次每一个百分比都是系统性偏低估，且活下来的子集按语料顺序偏置（非随机抽样）。` +
        `拒绝把它发布成成绩。`
    )
  }
  return { ok: failures.length === 0, failures }
}
