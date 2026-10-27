#!/usr/bin/env node
/**
 * 回归防线自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 防线自己也会错。这里钉三件事：
 *   1) **纯函数边界**：地板/棘轮/防删的判定边界（恰好等于地板 → 过；差 0.01 → 红），
 *      以及「无基线」时**必须跳过而不误红**（新克隆不该被红）。
 *   2) **每条变异都咬得住**：给每个防线喂一处外科手术式改动，断言报出的消息**包含预期子串**
 *      —— 只断「红了」不够，红了但报错跑偏等于没定位能力。
 *   3) **真实语料上的防删守卫**：对 186 条 crud 语料算逐维 applicable 计数，与基线
 *      `__tests__/golden/accuracy-baseline.json` 比对。这条**离线**（不需要付费跑），
 *      故「删难例洗分」在每次 PR 上就被拦下——一个只在夜间才生效的防线，白天等于不存在。
 *
 * 与 eval 的分工：eval 用同一批函数比对**真跑产物**的比率；本文件比对**语料级计数**
 * 与合成数据的比率边界。两者共用 `ratchet.mjs`，不各自重实现。
 */
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { StructuredCrudConfigSchema } from '@es-plus/shared'
import { CAPABILITY_SCORERS } from './scorers.mjs'
import { corpusFingerprint } from './artifact.mjs'
import { isCrudCase } from './scenes.mjs'
import { FEWSHOT_DERIVED } from './fewshot-derived.mjs'
import {
  CORE_FLOOR,
  HELDOUT_FLOOR,
  evaluateFloor,
  checkCorpusSize,
  checkConvergenceSample,
  compareToBaseline,
  guardAntiDelete,
  deriveMinApplicable,
  applicableCountsFromCases,
  combine,
  evaluateHealth,
  orderPlanGatedFirst,
  MAX_ERRORED_ROWS,
} from './ratchet.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const BASELINE_FILE = join(ROOT, '__tests__', 'golden', 'accuracy-baseline.json')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

/** 断言某次判定**红了**且消息命中预期子串（只断「红了」会掩盖报错跑偏）。 */
function checkFails(result, substr, label) {
  check(!result.ok, `${label}: 应当判红，实际通过`)
  check(
    result.failures.some((m) => m.includes(substr)),
    `${label}: 报错未命中预期子串 ${JSON.stringify(substr)}；实际 = ${JSON.stringify(result.failures)}`
  )
}

// ─── ④ core 非回归地板 ───────────────────────────────────────────────
{
  const at = evaluateFloor({ coreRate: CORE_FLOOR, heldoutCases: 100 })
  check(at.ok, `地板边界：coreRate 恰等于 ${CORE_FLOOR} 应判过（>= 而非 >）`)

  checkFails(
    evaluateFloor({ coreRate: CORE_FLOOR - 0.01, heldoutCases: 100 }),
    '跌破非回归地板',
    '地板：跌 0.01'
  )
  checkFails(evaluateFloor({ coreRate: 0.9, heldoutCases: 0 }), '无分母', '地板：零分母')
  checkFails(evaluateFloor({ coreRate: 0, heldoutCases: 0 }), '无分母', '地板：零分母优先于 0 分')
}

// ─── ⑦ heldout 规模地板 ─────────────────────────────────────────────
{
  check(checkCorpusSize({ heldoutCases: HELDOUT_FLOOR }).ok, `heldout 地板边界：恰等于 ${HELDOUT_FLOOR} 应判过`)
  checkFails(checkCorpusSize({ heldoutCases: HELDOUT_FLOOR - 1 }), '低于地板', 'heldout：差 1 条')
  checkFails(checkCorpusSize({}), '低于地板', 'heldout：字段缺失')
}

// ─── ⑩ 收敛腿样本数（AN-02） ─────────────────────────────────────────
{
  check(checkConvergenceSample(30).ok, '收敛样本：恰等于 30 应判过')
  check(checkConvergenceSample(31).ok, '收敛样本：多于 30 应判过')
  checkFails(checkConvergenceSample(5), '低于地板 30', '收敛样本：5 条（AN-02 之前的真实状态）必须红')
  checkFails(checkConvergenceSample(0), '低于地板 30', '收敛样本：零条必须红（没跑 ≠ 收敛率为 0）')
  checkFails(checkConvergenceSample(undefined), '低于地板 30', '收敛样本：缺失必须红')
}

// ─── ⑤ 比率棘轮 ────────────────────────────────────────────────────
{
  const base = { definition95: 0.95, coreRate: 0.5, byDimension: { membership: 0.9, reactions: 1.0 } }

  const green = compareToBaseline({ definition95: 0.95, coreRate: 0.5, byDimension: { membership: 0.9, reactions: 1.0 } }, base)
  check(green.ok, '棘轮：与基线持平应判过')

  const better = compareToBaseline({ definition95: 1.0, coreRate: 0.9, byDimension: { membership: 1, reactions: 1 } }, base)
  check(better.ok, '棘轮：优于基线应判过（棘轮只拦退步）')

  checkFails(
    compareToBaseline({ definition95: 0.94, coreRate: 0.5, byDimension: { membership: 0.9, reactions: 1 } }, base),
    'definition95（∨） 退步',
    '棘轮：∨ 退步'
  )
  // 零容差：0.0001 的退步也必须红 —— 证明 RATCHET_TOL 真的是 0 而不是被悄悄放宽
  checkFails(
    compareToBaseline({ definition95: 0.95 - 0.0001, coreRate: 0.5, byDimension: {} }, base),
    'definition95（∨） 退步',
    '棘轮：零容差'
  )
  checkFails(
    compareToBaseline({ definition95: 0.95, coreRate: 0.49, byDimension: {} }, base),
    'coreRate 退步',
    '棘轮：core 退步'
  )
  // 维度在基线里有、当前缺席 → 必须红（按**基线的键集**迭代，否则删维度会静默缩小比较集）
  checkFails(
    compareToBaseline({ definition95: 0.95, coreRate: 0.5, byDimension: { membership: 0.95 } }, base),
    '维度 reactions 在基线里有、本次缺席',
    '棘轮：维度被删'
  )
  checkFails(
    compareToBaseline({ definition95: 0.95, coreRate: 0.5, byDimension: { membership: 0.89, reactions: 1 } }, base),
    '维度 membership 退步',
    '棘轮：单维退步'
  )
  // 无基线 → 跳过 + warn，不得误红（新克隆/首跑）
  const boot = compareToBaseline({ definition95: 0, coreRate: 0, byDimension: {} }, null)
  check(boot.ok, '棘轮：无基线应跳过而非误红')
  check(boot.warnings.length > 0, '棘轮：无基线应给出 warn（不许静默）')

  // 「基线存在但比率为 null / 逐维为空」也必须可见：这类基线下 cmp 全部直接 return、
  // 逐维循环一次不进 —— 结论是绿，但一个数都没比过。此前没有任何提示（"all OK" 是错觉）。
  const inert = compareToBaseline(
    { definition95: 0.5, coreRate: 0.5, byDimension: {} },
    { definition95: null, coreRate: null, byDimension: {} }
  )
  check(inert.ok, '棘轮：惰性基线（null 比率）不得判红 —— 首次跑批前确实没有真值')
  check(
    inert.warnings.some((w) => w.includes('基线未填 definition95')),
    `棘轮：基线 definition95 为 null 时必须提示「未填」，实际 = ${JSON.stringify(inert.warnings)}`
  )
  check(
    inert.warnings.some((w) => w.includes('基线未填 coreRate')),
    `棘轮：基线 coreRate 为 null 时必须提示「未填」，实际 = ${JSON.stringify(inert.warnings)}`
  )
  check(
    inert.warnings.some((w) => w.includes('byDimension 为空')),
    `棘轮：逐维基线为空时必须提示「不生效」，实际 = ${JSON.stringify(inert.warnings)}`
  )

  // ── 跨尺子版本（Ruler v3）：必须**拒绝比较**，而不是猜个容差糊过去 ──
  const cur = { definition95: 1.0, coreRate: 0.9, byDimension: { membership: 1, reactions: 1 } }
  const sameRuler = { ...base, rulerVersion: 'label-identity-v1+deco-projection-v1' }
  check(
    compareToBaseline(cur, sameRuler, { rulerVersion: 'label-identity-v1+deco-projection-v1' }).ok,
    '跨版本：同一把尺子应正常比'
  )
  checkFails(
    compareToBaseline(cur, sameRuler, { rulerVersion: 'label-identity-v2' }),
    '尺子版本不同，拒绝比较',
    '跨版本：不同尺子版本必须硬失败（即使本次数字更高）'
  )
  // 基线是 Ruler v3 之前写的（无 rulerVersion）⟹ 只能警告，不能红（否则升级当天恒红）
  const legacy = compareToBaseline(cur, base, { rulerVersion: 'label-identity-v1+deco-projection-v1' })
  check(legacy.ok, '跨版本：基线无 rulerVersion 时不得误红（升级当天不能恒红）')
  check(
    legacy.warnings.some((w) => w.includes('基线无 rulerVersion')),
    `跨版本：基线无 rulerVersion 必须提示，实际 = ${JSON.stringify(legacy.warnings)}`
  )
  // 未传 rulerVersion（旧调用点）⟹ 行为与改造前完全一致
  check(compareToBaseline(cur, sameRuler).ok, '跨版本：未传 rulerVersion 时应保持旧行为')
}

// ─── ⑤ 防删难例（合成） ─────────────────────────────────────────────
{
  // legacy（v1）：只有 applicableCounts → 精确相等（升级前的行为，保持不误红）
  const old = { applicableCounts: { mergeConfig: 15, reactions: 15 } }
  check(guardAntiDelete({ mergeConfig: 15, reactions: 15 }, old).ok, '防删(v1)：计数持平应判过')
  check(guardAntiDelete({ mergeConfig: 15, reactions: 15, columns: 34 }, old).ok, '防删(v1)：新增维度/语料应判过')
  checkFails(guardAntiDelete({ mergeConfig: 13, reactions: 15 }, old), '从 15 掉到 13', '防删(v1)：删 2 例')
  checkFails(guardAntiDelete({ reactions: 15 }, old), '疑似删除了该维度', '防删(v1)：整维消失')
  const boot = guardAntiDelete({}, null)
  check(boot.ok && boot.warnings.length > 0, '防删：无基线应跳过 + warn')

  // v2（AN-04）：硬地板 + ±10% 漂移提示。
  const counts = { mergeConfig: 15, reactions: 15 }
  const v2 = { applicableCounts: counts, minApplicable: deriveMinApplicable(counts) }
  check(v2.minApplicable.mergeConfig === 13, 'deriveMinApplicable: 15 的下限应为 13（留 10% 余量）')
  check(guardAntiDelete(counts, v2).ok, '防删(v2)：计数持平应判过')
  check(guardAntiDelete({ mergeConfig: 16, reactions: 20 }, v2).ok, '防删(v2)：语料**增长**不得判红（这是旧精确相等的主要假红源）')
  check(guardAntiDelete({ mergeConfig: 13, reactions: 15 }, v2).ok, '防删(v2)：恰在下限（15→13）应判过')
  checkFails(guardAntiDelete({ mergeConfig: 12, reactions: 15 }, v2), '低于地板', '防删(v2)：跌破下限（删 3 例）必须红')
  checkFails(guardAntiDelete({ reactions: 15 }, v2), '疑似删除了该维度', '防删(v2)：整维消失')
  const drift = guardAntiDelete({ mergeConfig: 15, reactions: 19 }, v2)
  check(drift.ok, '防删(v2)：+27% 漂移只提示、不判红')
  check(
    drift.warnings.some((w) => w.includes('跨越 ±10%')),
    `防删(v2)：跨越 ±10% 必须提示写回基线，实际 = ${JSON.stringify(drift.warnings)}`
  )
}

// ─── 真实语料上的防删守卫（离线，不需要付费跑） ─────────────────────────
{
  const golds = []
  const crudFiles = []
  for (const f of readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
    if (!isCrudCase(raw)) continue
    crudFiles.push(f)
    golds.push(StructuredCrudConfigSchema.parse(raw.config))
  }
  const counts = applicableCountsFromCases(golds, CAPABILITY_SCORERS)
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))

  const r = guardAntiDelete(counts, baseline)
  check(r.ok, `真实语料防删守卫判红：\n      ${r.failures.join('\n      ')}`)
  // 漂移提示必须进测试输出（AN-04）：语料跨越 ±10% 时，红/绿之外还要让人看见
  // 「基线该更新了」。只写进返回值等于没写 —— check:ratchet 是唯一会跑这段的入口。
  for (const w of r.warnings) console.warn(`[ratchet] ⚠️  ${w}`)

  // AN-04 v2：基线必须带 version / heldoutCases —— 二者曾是无人的死字段。
  // `heldoutCases` 是公开的**语料规模**声明（README/站点引用它），必须与语料实际一致：
  // 216 条 crud − 22 条 few-shot 派生 = 194 条 heldout。若只把它当注释，语料缩水时
  // 文案会继续宣称旧规模；这里让它在每次 PR 上咬人。
  check(
    Number.isInteger(baseline.version) && baseline.version >= 3,
    `accuracy-baseline.json 的 version 必须是整数且 ≥3（AN-04 v2），实际 = ${JSON.stringify(baseline.version)}`
  )
  const heldoutCount = crudFiles.filter((f) => !FEWSHOT_DERIVED.has(f)).length
  check(
    baseline.heldoutCases === heldoutCount,
    `accuracy-baseline.json 的 heldoutCases=${baseline.heldoutCases} 与语料实际 heldout ` +
      `${heldoutCount}（crud ${crudFiles.length} − few-shot 派生）不符 —— 语料规模变了就要同步基线`
  )

  // 语料级计数必须覆盖基线声明的**每一维**（缺一维即为该维零语料/被删）
  const missing = Object.keys(baseline.applicableCounts ?? {}).filter((k) => counts[k] === undefined)
  check(missing.length === 0, `真实语料缺少基线声明的维度：${missing.join(', ')}`)

  // AN-04 v2：基线必须带 minApplicable，否则会退回「精确相等」——语料一长就假红。
  check(!!baseline.minApplicable, 'accuracy-baseline.json 必须带 minApplicable（AN-04 v2）')
  // AN-18：片段腿的 scoped 地板必须在基线里（fail closed：没有阈值 = 绿灯只因为没人设线）。
  check(
    typeof baseline.fragmentScopedMin === 'number' &&
      baseline.fragmentScopedMin >= 0 &&
      baseline.fragmentScopedMin <= 1,
    'accuracy-baseline.json 必须带 fragmentScopedMin（0..1，AN-18 片段腿门禁）'
  )
  check(
    Object.keys(baseline.minApplicable ?? {}).length === Object.keys(baseline.applicableCounts ?? {}).length,
    'minApplicable 与 applicableCounts 必须覆盖同一组维度'
  )
  for (const [dim, floor] of Object.entries(baseline.minApplicable ?? {})) {
    check(floor <= counts[dim], `基线下限 ${dim}:${floor} 高于当前语料计数 ${counts[dim]}（基线写超前了）`)
  }

  // 变异自检：抽掉两条 mergeConfig 用例后，真实守卫必须红（证明这条断言真有分辨力，
  // 而不是因为恒真才通过）。
  const withoutMerge = golds.filter((g) => !g.mergeConfig)
  const mutated = applicableCountsFromCases(withoutMerge, CAPABILITY_SCORERS)
  checkFails(
    guardAntiDelete(mutated, baseline),
    '低于地板',
    '真实语料变异：抽掉 mergeConfig 用例'
  )

  console.log(
    `[ratchet] 语料级逐维计数（${golds.length} 条 crud）：` +
      Object.entries(counts)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ')
  )
}

// ─── combine 语义 ──────────────────────────────────────────────────
{
  const ok = combine(evaluateFloor({ coreRate: 0.5, heldoutCases: 10 }), checkCorpusSize({ heldoutCases: 100 }))
  check(ok.ok, 'combine：全过 → ok')
  checkFails(combine(checkCorpusSize({ heldoutCases: 1 })), '低于地板', 'combine：任一项红 → 红')
}

// ─── ⑨ 健康门（AI-34）：拒绝发布「部分测量」的百分比 ────────────────────
// 2026-10-15 首跑的真实形状：186 例 zh 里 133 例实测、53 例 403（`not enough member budget`）。
// 旧健康门只判「全 0」，于是这次运行**照常发布**了 47.0% 红徽章 —— 而那个数其实是
// 「133/186 里含 53 个零」的产物（compileRate 71.5% = 133/186，实测部分 133/133 = 100%）。
// 低但合理的假分比全 0 危险得多：它看起来就像一次真实回归。以下用**那次运行的真实数字**
// 作回归样本，钉住「部分失败 = 没测到」。
{
  // 首跑真实形状：zh 腿 133/186 实测、53 条 403 —— 门禁腿残缺 ⟹ 整次作废。
  // 旧健康门只判「全 0」且不分语言，于是这次运行照常发布了 47.0% 红徽章。
  const tonightsRun = evaluateHealth({
    applicableTotal: 456,
    def95: { rate: 0.4695, total: 164 },
    rows: 372,
    gated: { lang: 'zh', rows: 186, errored: 53 },
    observed: { lang: 'en', rows: 186, errored: 54 },
  })
  checkFails(tonightsRun, '53 行**未测到**', '健康门：首跑形状（门禁腿残缺）必须被拦下')
  checkFails(tonightsRun, '门禁语言 zh', '健康门：报错必须点名是**门禁腿**残缺（否则读者以为只是随便一条腿）')
  checkFails(tonightsRun, '系统性偏低估', '健康门：必须说清偏差方向（措辞钉住，否则换个说法就没人看懂）')
  // 判据数的是「**未测到**」的行，不是一切 error —— 2026-10-16 那次中继健康（servedModel 在、
  // 364/372 行走到打分器）却因 zh 腿 3 行打不开整次作废，其中 2 行其实是模型真答错（= 成绩）。
  // 措辞必须说清这条边界，否则读者会把「模型真答不出」也当成测量故障。
  checkFails(tonightsRun, '答错', '健康门：必须写明模型**答错**的行不在此列（否则「真答不出」会被当成测量故障）')

  // 完整测量必须过（回归样本的另一半：不能把健康运行也拦掉）。
  const clean = evaluateHealth({
    applicableTotal: 456, def95: { rate: 0.4695, total: 164 }, rows: 372,
    gated: { lang: 'zh', rows: 186, errored: 0 }, observed: { lang: 'en', rows: 186, errored: 0 },
  })
  check(clean.ok, '健康门：两条腿都完整的测量必须放行（否则门禁是恒红的）')
  check(clean.warnings.length === 0, '健康门：完整测量不该有警告')

  // 门禁腿完整 + 观测腿残缺 ⟹ **放行门禁数字，但必须警告并要求抑制观测腿**。
  // 这条是刻意的：额度硬约束下「截断即全废」会让门禁永远测不出来（= 永久红 = 红盲）。
  const enLost = evaluateHealth({
    applicableTotal: 456, def95: { rate: 0.4695, total: 164 }, rows: 372,
    gated: { lang: 'zh', rows: 186, errored: 0 }, observed: { lang: 'en', rows: 186, errored: 107 },
  })
  check(enLost.ok, '健康门：门禁腿完整时，观测腿残缺不得作废整次运行（额度硬约束下的可用性）')
  check(
    enLost.warnings.some((w) => w.includes('必须抑制不发布')),
    `健康门：观测腿残缺必须警告「抑制其数字」，实际 = ${JSON.stringify(enLost.warnings)}`
  )

  // 三条子判据各自独立咬合（一条腿哑了不许被另一条腿遮住）。
  checkFails(
    evaluateHealth({ applicableTotal: 0, def95: { rate: 0.5, total: 164 }, rows: 372, gated: { lang: 'zh', rows: 186, errored: 0 }, observed: { lang: 'en', rows: 0, errored: 0 } }),
    '没有任何 gold 走到打分器',
    '健康门：四维全零'
  )
  checkFails(
    evaluateHealth({ applicableTotal: 456, def95: { rate: null, total: 0 }, rows: 372, gated: { lang: 'zh', rows: 186, errored: 0 }, observed: { lang: 'en', rows: 186, errored: 0 } }),
    '95% 定义（∨）没有分母',
    '健康门：∨ 没算出数（旧 F6 的那条）'
  )
  checkFails(evaluateHealth({ applicableTotal: 1, def95: { rate: 1, total: 1 }, rows: 0 }), '测量没发生', '健康门：零行')

  // 自检：把门禁腿判据去掉，同一形状必须咬不住 —— 证明拦住首跑的不是「恒红」蒙对的。
  const blind = evaluateHealth({
    applicableTotal: 456, def95: { rate: 0.4695, total: 164 }, rows: 372,
    gated: { lang: 'zh', rows: 186, errored: 0 }, observed: { lang: 'en', rows: 186, errored: 53 },
  })
  check(blind.ok, '自检：同样 53 条错误，但落在**观测腿**时必须放行 —— 说明拦住首跑的是「门禁腿残缺」这条判据')
}

// ─── ⑨ 跑批顺序：门禁语言必须整体排在观测语言之前 ──────────────────────
// 这条与上面那条是**同一个故障的两半**：首跑丢掉 zh 尾部的直接原因就是「逐文件 zh+en 交错」。
// 排序不是取舍问题，是「额度耗尽时先牺牲谁」——门禁语言显然不能先牺牲。
{
  const plan = [
    { file: 'a.json', lang: 'zh' },
    { file: 'a.json', lang: 'en' },
    { file: 'b.json', lang: 'zh' },
    { file: 'b.json', lang: 'en' },
    { file: 'c.json', lang: 'zh' }, // c 无英文
  ]
  const out = orderPlanGatedFirst(plan)
  check(
    out.every((x, i) => (i === 0 ? true : !(x.lang === 'zh' && out[i - 1].lang === 'en'))),
    `门禁语言必须整体在前：实际顺序 = ${out.map((x) => `${x.file}:${x.lang}`).join(' ')}`
  )
  check(out.length === plan.length, '排序不得增删条目')
  check(
    out.filter((x) => x.lang === 'zh').map((x) => x.file).join() === 'a.json,b.json,c.json',
    '语言内部必须保持原语料顺序（稳定排序；报告要能逐条对齐历史）'
  )
  // 反例自检：交错顺序喂进去，必须被上面第一条咬住。
  const interleaved = orderPlanGatedFirst([{ file: 'a.json', lang: 'en' }, { file: 'a.json', lang: 'zh' }], 'en')
  check(
    interleaved.filter((x) => x.lang === 'en').map((x) => x.file).join() === 'a.json',
    '自检：换门禁语言为 en 时，en 必须整体在前（函数不是硬编码 zh）'
  )
  check(typeof MAX_ERRORED_ROWS === 'number' && MAX_ERRORED_ROWS === 0, '阈值必须显式为 0（放宽要成为 PR 里的显式决定）')
}

// ─── 门禁同源（AI-33②）：exit / 徽章 / passed 只读 gateRate ─────────────
// 门禁从「四维 core」迁到「95% 定义 ∨」时，四处必须**同时**改，否则会出现
// 「CI 红但徽章绿」（或反之）的红盲。这里把「同一文件内数字同源」钉成源码断言：
// 一旦有人把任一处改回 core，或把徽章再算一遍别的数，立刻红。
// （用源码断言而非跑真跑批，是因为 eval-llm 需要真 key；这条钉的是**结构**，
//   与 check-readme-claims 的文本断言同一类。）
{
  const src = readFileSync(join(ROOT, 'scripts', 'eval-llm.mjs'), 'utf8')
  const ratchetSrc = readFileSync(join(ROOT, 'scripts', 'eval', 'ratchet.mjs'), 'utf8')
  // 聚合已抽到 `eval/run-metrics.mjs`（跑批与离线复算共用的唯一实现），故「门禁数字
  // 来自 def95.rate」这条不变量现在钉在**那个文件**上；eval-llm 只允许消费，不许再算一份。
  const metricsSrc = readFileSync(join(ROOT, 'scripts', 'eval', 'run-metrics.mjs'), 'utf8')
  check(!/gateExact/.test(src), 'eval-llm.mjs 里不得再有 gateExact（core 当门禁的旧形态）')
  check(!/gateExact/.test(metricsSrc), 'run-metrics.mjs 里不得有 gateExact（口径唯一实现也不能回流）')
  check(/const gateRate = def95\.rate \?\? 0/.test(metricsSrc), '门禁数字必须来自 def95.rate（run-metrics 是唯一实现）')
  check(!/const gateRate =/.test(src), 'eval-llm.mjs 不得自行再算 gateRate —— 必须来自 computeCrudMetrics（否则双真源）')
  check(/const gateMetric = 'definition95'/.test(src), '产物必须记下门禁指标名 gateMetric')
  check(
    /passed:\s*gateRate >= TARGET_ACCURACY &&\s*guards\.ok &&\s*frontDoorStats\.ok &&\s*compileRate === 1 &&\s*fragmentStats\.ok,/.test(src),
    'passed 必须 = 门禁 ∧ 回归防线（另允许布尔守卫：前门腿 / AN-13 编译门 / AN-18 片段腿；准确率数字只能来自 gateRate）'
  )
  // AN-13：编译门是**确定性缺陷**守卫（产物编译不过 ≠ 准确率口径），必须真的进 passed，
  // 否则「compileRate 100%」又退回成一句没人执行的宣称。
  check(
    /passed:[\s\S]{0,220}?&&\s*compileRate === 1\b/.test(src),
    'AN-13：编译门（compileRate === 1）必须进入 passed'
  )
  // AN-18：片段腿（独立分母）同样必须是**布尔守卫**进 passed，且 exit code 与 passed 同源 ——
  // 否则「片段门禁化」只落在报告里，夜间照样绿。
  check(
    /passed:[\s\S]{0,220}?fragmentStats\.ok,/.test(src),
    'AN-18：片段腿（fragmentStats.ok）必须进入 passed'
  )
  check(
    /if \(\s*gateRate < TARGET_ACCURACY[\s\S]{0,220}?!fragmentStats\.ok\s*\)/.test(src),
    'AN-18：片段腿红时必须让 exit code 红（与 passed 同源）'
  )
  check(
    /import \{ summarizeFragmentLeg \} from '\.\/eval\/fragment-leg\.mjs'/.test(src),
    'AN-18：片段腿判据必须来自纯函数模块 eval/fragment-leg.mjs（可离线单测）'
  )
  check(/const pct = gateRate \* 100/.test(src), '徽章数字必须与门禁同源（gateRate）')
  // 准确率门禁只有 gateRate 一个数字来源；其余 disjunct 允许**布尔守卫**（回归防线 / 前门腿），
  // 因为它们是「确定性缺陷」而不是第二个准确率口径 —— 混进 core/scoped/full 才是红盲（AI-33②）。
  // 判据块允许换行排版（AN-18 加入片段腿后更长了），但主判据必须是 gateRate。
  const exitLine = (src.match(/if \(\s*gateRate < TARGET_ACCURACY[\s\S]*?\)\s*\{/) ?? [''])[0]
  check(
    /if \(\s*gateRate < TARGET_ACCURACY/.test(exitLine),
    'exit code 必须以 gateRate < TARGET_ACCURACY 为主判据'
  )
  check(
    !/coreRate|exactHeldout|exactScoped|exactFull|exactIntent/.test(exitLine),
    'exit code 不得引入 gateRate 以外的准确率数字（core/scoped/full 只能并列公布）'
  )
  check(
    /evaluateHealth/.test(src),
    'F6 健康门必须走 eval/ratchet.mjs 的 evaluateHealth（纯函数，CI 上免费可验；行为断言见上一块）'
  )
  check(
    /gated.errored > MAX_ERRORED_ROWS/.test(ratchetSrc),
    '健康门必须判门禁腿「未测到的行数」（2026-10-15 首跑的 107 条 403 曾被当成 107 次真实失败发布成 47.0%）'
  )
  // 「未测到」而不是「一切 error」：这一条钉的是**接线**（纯函数单测验不到它）——
  // evaluateHealth 收的必须是 isNotMeasured 筛过的数，否则模型真答错的行会把整次运行作废。
  check(
    /const notMeasuredIn = \(rs\) => rs\.filter\(\(r\) => r\.error && isNotMeasured\(r\.errorKind\)\)/.test(src) &&
      /errored: notMeasuredIn\(zhRows\)/.test(src),
    '喂给健康门的必须是 isNotMeasured 筛出的「未测到」行，而不是一切 error 行（否则模型答错 1 例就永远红）'
  )
  check(
    /errored: notMeasuredIn\(enRows\)/.test(src),
    '观测腿同理：抑制的是「未测到」的行数（答错的行是成绩，按 0 计）'
  )
  // 「一切 error」这个判据**只允许有一种判据**（notMeasuredIn）。run 38871648450 的产物里
  // 一句「观测腿 5/186 行打不开（中继故障）」，而日志里那 5 行全是 ERROR(model-failure) ——
  // 观测腿的**抑制**与产物里的 `errored` 当时走的是另一个判据（erroredIn = 一切 error），
  // 于是把模型的成绩上报成了中继的故障，且与健康门（走 notMeasuredIn，一条警告都没报）自相矛盾。
  check(
    !/erroredIn/.test(src),
    'eval-llm.mjs 不得再有「一切 error」的 erroredIn —— 观测腿抑制与产物里的 errored 都必须走 notMeasuredIn'
  )
  check(
    /const enNotMeasured = notMeasuredIn\(enRows\)/.test(src) && /const enIncomplete = enNotMeasured > 0/.test(src),
    '观测腿残缺必须按「未测到」判（否则模型真答错会被上报成中继故障）'
  )
  check(
    /gatedRows: \{ lang: 'zh', rows: zhRows\.length, errored: notMeasuredIn\(zhRows\) \}/.test(src) &&
      /observedRows: \{ lang: 'en', rows: enRows\.length, errored: notMeasuredIn\(enRows\) \}/.test(src),
    '产物里的 gatedRows/observedRows.errored 必须就是喂给健康门的那个数（产物自称是「自带证据」）'
  )
  check(
    /orderPlanGatedFirst\(plan\)/.test(src),
    '跑的确实得是门禁语言优先的那份计划 —— 光有 orderPlanGatedFirst 而调用点不用它，等于没改'
  )
  // 反例自检：把「core 当门禁」的旧写法喂进同一组断言，必须至少咬住一条。
  const legacy = metricsSrc.replace('const gateRate = def95.rate ?? 0', 'const gateRate = exactHeldout ?? exact')
  const caught = !/const gateRate = def95\.rate \?\? 0/.test(legacy)
  check(caught, '自检：旧写法（core 当门禁）必须被这组断言咬住')
}

// ── 语料指纹跨平台稳定（Windows CRLF 检出 vs CI LF 检出） ──────────────────
// 指纹进产物的 `corpusHash`，`check:artifact-freshness` 用它判断「语料变没变」。
// 若同一份语料在两个平台上算出两个哈希，守卫就会把行尾差异误报成语料变更。
{
  const tmp = mkdtempSync(join(tmpdir(), 'esplus-corpus-'))
  try {
    mkdirSync(join(tmp, 'lf'))
    mkdirSync(join(tmp, 'crlf'))
    const body = '{\n  "cases": 1\n}\n'
    writeFileSync(join(tmp, 'lf', 'a.json'), body)
    writeFileSync(join(tmp, 'crlf', 'a.json'), body.replace(/\n/g, '\r\n'))
    const lf = corpusFingerprint(['a.json'], join(tmp, 'lf'))
    check(
      corpusFingerprint(['a.json'], join(tmp, 'crlf')) === lf,
      '语料指纹必须对行尾不敏感（Windows CRLF 与 CI LF 得到同一哈希）'
    )
    writeFileSync(join(tmp, 'crlf', 'a.json'), body.replace('1', '2'))
    check(corpusFingerprint(['a.json'], join(tmp, 'crlf')) !== lf, '语料内容变化必须改变指纹')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — 地板/棘轮/防删的边界与变异全部咬得住，真实语料的逐维计数不低于基线。✔')
