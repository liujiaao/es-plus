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

/**
 * ⑩ 收敛腿的最小样本数（AN-02）。
 *
 * 只有 5 条时，「≤3 轮收敛 4/5 = 80%」的置信区间宽到没有意义 —— 删掉一条就摆动 20pp。
 * 30 是能让「第二条腿」被当作能力结论而非个例的最低门槛（也意味着它真的在贡献 95% 定义）。
 */
export const CONVERGE_SAMPLE_FLOOR = 30

/** ⑤ 棘轮容差。0 = 只要退步就红（比率噪声由「基线只经人工 PR 上调」治理，不靠容差）。 */
export const RATCHET_TOL = 0

/**
 * 适用用例数的**漂移提示**阈值（AN-04）。
 *
 * 为什么防删守卫不能再用「精确相等」：语料是会长的（AI-47..AI-52 一轮就加了 60+ 条），
 * 而旧基线把 188 条时代的计数写死 —— 于是**每一次语料变更都会红一次**，守卫随即变成
 * 噪声（恒红 = 红盲，本仓最贵的教训之一）。
 *
 * 新判据分两层：
 *   · **硬地板** `minApplicable[dim]`：低于它 = 真的删了难例 → 红；
 *   · **漂移提示** ±10%：跨越就要求「在基线里更新并说明」，否则说明语料正在悄悄变，
 *     比率棘轮的分母失去参照。
 */
export const APPLICABLE_DRIFT = 0.1

/** 由观测计数推导硬地板（向下取整，留出 10% 的合法语料微调空间）。 */
export function deriveMinApplicable(counts, { drift = APPLICABLE_DRIFT } = {}) {
  return Object.fromEntries(
    Object.entries(counts).map(([dim, n]) => [dim, Math.floor(n * (1 - drift))])
  )
}

/**
 * ⑨ 健康门允许的「未测到行」上限。**0 是刻意的**，理由见 `evaluateHealth`。
 * 留成常量是为了让「放宽这条」成为一个**显式的、要在 PR 里辩护的**决定。
 *
 * 注意它数的是**未测到**（`err.kind` ∈ no-answer/truncated/未知），不是一切 error ——
 * 模型答错的行是一次合法测量，按 0 分计入成绩，不在此列。见 `evaluateHealth` 头注。
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
 * ⑩ 收敛腿样本数地板（AN-02）：`total` = 本次真正跑了精修语料的行数。
 *
 * 注意判据是「**跑了**多少条」，不是「收敛了多少条」—— 收敛率低是模型问题（该发布），
 * 样本太少是度量问题（不该发布）。这与健康门同一原则：没测到 ≠ 得 0 分。
 */
export function checkConvergenceSample(total, { floor = CONVERGE_SAMPLE_FLOOR } = {}) {
  const failures = []
  const n = typeof total === 'number' ? total : 0
  if (n < floor) {
    failures.push(
      `收敛腿只有 ${n} 条语料，低于地板 ${floor} —— 「≤K 轮收敛 ∨」这条腿的比率会落在单例噪声上` +
        `（删掉一条即摆动 ${n ? (100 / n).toFixed(1) : '∞'}pp），不足以支撑 95% 定义`
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
 * @param {{tol?:number, rulerVersion?:string|null}} [opts] `rulerVersion` 给了才做跨尺子版本拦截
 */
export function compareToBaseline(current, baseline, { tol = RATCHET_TOL, rulerVersion = null } = {}) {
  const failures = []
  const warnings = []
  if (!baseline) {
    warnings.push('无基线文件（首次跑批）—— 跳过比率棘轮，仅门禁与地板生效')
    return { ok: true, failures, warnings }
  }

  // 跨尺子版本**拒绝比较**（Ruler v3）。
  //
  // 比率的含义依赖「同一份 pred 会得几分」的规则。规则一改（字段身份从 prop 换成 label、
  // 装饰键豁免、新增维度），基线里的 rate 与本次的 rate 就是两个不同的量 —— 用棘轮比它们，
  // 结果只会是两种坏情况之一：数字变松 ⟹ 假绿（看着守住了，其实没人守）；数字变紧 ⟹
  // 追着一个「口径已变、并非退步」的差值喊回归。两者都会在几次 PR 内把守卫变成噪声。
  // 故这里**硬失败**并要求重基线，而不是猜一个容差把差异糊过去。
  // 基线没写 rulerVersion（Ruler v3 之前的文件）时无法判断 ⟹ 只警告（否则升级当天恒红）。
  if (rulerVersion && typeof baseline.rulerVersion === 'string' && baseline.rulerVersion !== rulerVersion) {
    failures.push(
      `尺子版本不同，拒绝比较：基线 ${baseline.rulerVersion} vs 本次 ${rulerVersion} —— ` +
        '同一份 pred 在两把尺子下会得不同分。请在当前尺子下跑一次全量，人工把 definition95 / ' +
        'coreRate / byDimension 与 rulerVersion 一起写回 accuracy-baseline.json（见该文件头注）'
    )
    return { ok: false, failures, warnings }
  }
  if (rulerVersion && typeof baseline.rulerVersion !== 'string') {
    warnings.push(
      `基线无 rulerVersion（早于 Ruler v3 或未填）—— 无法证明基线与本次是同一把尺子；` +
        '首次全量跑批后请与比率一起写回'
    )
  }

  // 比率基线是**惰性**的：`null` 时 `cmp` 直接跳过，棘轮看起来绿，其实没在比。
  // 这不是错误（首次全量跑批前确实没有真值），但必须可见 —— 否则「防线已就绪」是错觉。
  // 批次 C：至少把「未填」这件事打出来；填数仍需人工 PR（见 accuracy-baseline.json 头注）。
  for (const [key, label] of [
    ['definition95', 'definition95（∨）'],
    ['coreRate', 'coreRate'],
  ]) {
    if (typeof baseline[key] !== 'number') {
      warnings.push(
        `基线未填 ${label}（null）—— 比率棘轮对这项不生效；首次 post-AN-01 全量跑批后请人工填入`
      )
    }
  }

  // 逐维基线同理：`{}` 会让下面的循环一次都不进 —— 看起来「逐维棘轮 all OK」，
  // 实际一个维度都没比。空表与 null 一样必须可见（否则「防线已就绪」是错觉）。
  const dimEntries = Object.entries(baseline.byDimension ?? {})
  if (dimEntries.length === 0) {
    warnings.push(
      '基线 byDimension 为空 —— 逐维比率棘轮不生效；首次完整跑批后请按 byCapability 的 rate 填入'
    )
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

  for (const [dim, base] of dimEntries) {
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
 * ## v2（AN-04）：地板 + 漂移提示，不再精确相等
 *
 * `minApplicable` = 由基线观测数推导的硬地板（见 `deriveMinApplicable`）。语料**增长**
 * 永远是安全的（不会红），只有**跌破地板**才红。跨过 ±10% 的增/减只发警告，要求把
 * 新计数写回基线 —— 既不误杀正常语料迭代，也不让分母悄悄漂走。
 *
 * 旧格式（只有 `applicableCounts`、无 `minApplicable`）按**精确相等**比较，行为不变，
 * 免得升级当天就出现一批无法解释的红。
 *
 * @param {Record<string, number>} currentCounts 语料级 applicable 计数
 * @param {null|{minApplicable?:Record<string,number>, applicableCounts?:Record<string,number>}} baseline
 */
export function guardAntiDelete(currentCounts, baseline, { drift = APPLICABLE_DRIFT } = {}) {
  const failures = []
  const warnings = []
  const floors = baseline?.minApplicable
  const observed = baseline?.applicableCounts
  if (!floors && !observed) {
    warnings.push('基线无 minApplicable/applicableCounts（首跑前）—— 跳过防删守卫')
    return { ok: true, failures, warnings }
  }

  const cur = (dim) => currentCounts?.[dim]
  const missing = (dim) =>
    failures.push(`维度 ${dim} 在基线的计数表里存在、本次却完全缺席 —— 疑似删除了该维度`)

  if (floors) {
    // v2：只对硬地板判红。计数增长不红（语料可以长大）。
    for (const [dim, floor] of Object.entries(floors)) {
      const n = cur(dim)
      if (n === undefined) {
        missing(dim)
      } else if (n < floor) {
        failures.push(
          `维度 ${dim} 的适用用例数 ${n} 低于地板 ${floor} —— 疑似删除了难例` +
            `（删例可稀释均值：比率棘轮看得见 rate，看不见分母）`
        )
      }
    }
    // 漂移提示：仍以「基线当时观测到的数」为参照（而不是地板），>±10% 要求写回并说明。
    for (const [dim, n] of Object.entries(observed ?? {})) {
      const now = cur(dim)
      if (typeof now === 'number' && n > 0 && Math.abs(now - n) / n > drift) {
        warnings.push(
          `维度 ${dim} 适用用例数 ${n} → ${now}（跨越 ±${drift * 100}%）—— ` +
            `若为有意增删语料，请更新 accuracy-baseline.json 的 applicableCounts 并说明`
        )
      }
    }
    return { ok: failures.length === 0, failures, warnings }
  }

  // v1（legacy）：精确相等，保持原行为。
  for (const [dim, n] of Object.entries(observed)) {
    const now = cur(dim)
    if (now === undefined) {
      missing(dim)
      continue
    }
    if (now < n) {
      failures.push(
        `维度 ${dim} 的适用用例数从 ${n} 掉到 ${now} —— 疑似删除了难例` +
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
 * **未测到**的行不是噪声，是**系统性偏差**：每一条都以 0 计入分子/分母，且失败位置可能与
 * 语料顺序强相关（2026-10-15 丢失的是 46–99 整段、若干完整特性族）——即活下来的子集是
 * **选择偏置**样本，既不能当分数、也不能当基线。故没有「小到可忽略」的未测到数；**任何**
 * 没测到的行都让这次运行不构成一次测量。
 *
 * ## 但「打不开」≠「没测到」（2026-10-16 run 38840019126 后补）
 *
 * 直到那天，判据把**一切**打不开的行都当成了测量故障。那次中继**完全健康**
 * （`servedModel=claude-sonnet-4-6`，364/372 行走到打分器），zh 腿 3 行打不开就把整次运行
 * 作废了 —— 可其中 2 行是**模型真的答错了**（三轮都不是合法 config）。那不是「没测到」，
 * 那正是**要测的东西**：正确答案就是给这 2 行记 0 分，再如实发布。
 *
 * 混作一谈的后果是**门禁恒红**：语料里恒有 1–2 例是模型当下真答不出来的，于是中继再健康
 * 也永远拒绝发布 —— 正是本文件下方为观测腿论证过的「永久红 = 红盲」。故判据只对**未测到**
 * 的行零容忍；归因由 `eval/repair-loop.mjs` 的 `err.kind` 给出（白名单方向见 `isNotMeasured`：
 * 只有被确证的 `model-failure` 才算测得的分，其余一律算没测到）。
 *
 * ## 为什么按语言分开判（门禁腿 vs 观测腿）
 *
 * 判据只对**门禁腿**用「零容忍」，对**观测腿**降级为警告 + 抑制其数字。理由是**可用性**
 * 而非宽松：中继额度是硬约束（首跑就死在 133/186），若截断一律让整次运行作废，那在额度
 * 压力下**每一次**运行都作废 ⟹ 门禁永远测不出来 ⟹ 退化成「永久红 = 红盲」，
 * 正是 AI-33 要消灭的那个失效模式。配合 `orderPlanGatedFirst`（门禁腿跑在前），
 * 额度耗尽时门禁腿**已经完整**，此时该做的不是扔掉结果，而是：发布完整的门禁腿、
 * **抑制**有偏的观测腿数字，并把「观测腿不全」显式记在产物里。
 * 反之，门禁腿只要缺一条，一律不许发布 —— 没有例外。
 *
 * @param {{rows:number, applicableTotal:number, def95:{rate:number|null,total:number},
 *          gated:{lang:string, rows:number, errored:number},
 *          observed:{lang:string, rows:number, errored:number}}} s
 */
export function evaluateHealth(s) {
  const failures = []
  const warnings = []
  if (!s || !s.rows) {
    failures.push(`本次没有产出任何一行（rows=${s ? s.rows : 'n/a'}）—— 测量没发生`)
    return { ok: false, failures, warnings }
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
  const gated = s.gated ?? { lang: 'zh', rows: 0, errored: 0 }
  if (gated.errored > MAX_ERRORED_ROWS) {
    const pctScored = gated.rows ? ((gated.rows - gated.errored) / gated.rows) * 100 : 0
    failures.push(
      `门禁语言 ${gated.lang}：${gated.rows} 行里 ${gated.errored} 行**未测到**（仅 ${pctScored.toFixed(1)}% 走到打分器）—— ` +
        `未测到的行以 0 计入所有分母，故本次每一个门禁百分比都是系统性偏低估，且活下来的子集可能是选择偏置的。` +
        `拒绝把它发布成成绩。（模型**答错**的行不在此列：那是一次合法测量，按 0 分计入成绩。）`
    )
  }
  const observed = s.observed ?? { lang: 'en', rows: 0, errored: 0 }
  if (observed.errored > 0) {
    warnings.push(
      `观测语言 ${observed.lang}：${observed.rows} 行里 ${observed.errored} 行未测到 —— 该腿数字有偏（同样以 0 计入分母），` +
        `**必须抑制不发布**；门禁腿 ${gated.lang} 完整，故门禁数值仍然有效。`
    )
  }
  return { ok: failures.length === 0, failures, warnings }
}
