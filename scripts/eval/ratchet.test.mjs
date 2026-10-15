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
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { StructuredCrudConfigSchema } from '@es-plus/shared'
import { CAPABILITY_SCORERS } from './scorers.mjs'
import { isCrudCase } from './scenes.mjs'
import {
  CORE_FLOOR,
  HELDOUT_FLOOR,
  evaluateFloor,
  checkCorpusSize,
  compareToBaseline,
  guardAntiDelete,
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
}

// ─── ⑤ 防删难例（合成） ─────────────────────────────────────────────
{
  const base = { applicableCounts: { mergeConfig: 15, reactions: 15 } }
  check(
    guardAntiDelete({ mergeConfig: 15, reactions: 15 }, base).ok,
    '防删：计数持平应判过'
  )
  check(
    guardAntiDelete({ mergeConfig: 15, reactions: 15, columns: 34 }, base).ok,
    '防删：新增维度/语料应判过（棘轮只拦减少）'
  )
  checkFails(guardAntiDelete({ mergeConfig: 13, reactions: 15 }, base), '从 15 掉到 13', '防删：删 2 例')
  checkFails(guardAntiDelete({ reactions: 15 }, base), '疑似删除了该维度', '防删：整维消失')
  const boot = guardAntiDelete({}, null)
  check(boot.ok && boot.warnings.length > 0, '防删：无基线应跳过 + warn')
}

// ─── 真实语料上的防删守卫（离线，不需要付费跑） ─────────────────────────
{
  const golds = []
  for (const f of readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
    if (!isCrudCase(raw)) continue
    golds.push(StructuredCrudConfigSchema.parse(raw.config))
  }
  const counts = applicableCountsFromCases(golds, CAPABILITY_SCORERS)
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))

  const r = guardAntiDelete(counts, baseline)
  check(r.ok, `真实语料防删守卫判红：\n      ${r.failures.join('\n      ')}`)

  // 语料级计数必须覆盖基线声明的**每一维**（缺一维即为该维零语料/被删）
  const missing = Object.keys(baseline.applicableCounts ?? {}).filter((k) => counts[k] === undefined)
  check(missing.length === 0, `真实语料缺少基线声明的维度：${missing.join(', ')}`)

  // 变异自检：抽掉两条 mergeConfig 用例后，真实守卫必须红（证明这条断言真有分辨力，
  // 而不是因为恒真才通过）。
  const withoutMerge = golds.filter((g) => !g.mergeConfig)
  const mutated = applicableCountsFromCases(withoutMerge, CAPABILITY_SCORERS)
  checkFails(
    guardAntiDelete(mutated, baseline),
    'mergeConfig 的适用用例数从',
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
  const real = { cases: 186, heldoutCases: 164 }
  // 首跑真实形状：分母齐全、四维 applicable 巨大，只有 erroredRows 暴露了它。
  const tonightsRun = evaluateHealth({
    applicableTotal: 456,
    def95: { rate: 0.4695, total: 164 },
    erroredRows: 107,
    rows: 372,
  })
  checkFails(tonightsRun, '107 行打不开', '健康门：首跑形状必须被拦下')
  checkFails(tonightsRun, '系统性偏低估', '健康门：必须说清偏差方向（措辞钉住，否则换个说法就没人看懂）')
  check(
    tonightsRun.failures.some((f) => f.includes('107')),
    `健康门：报错必须带上真实的失败行数（实际 = ${JSON.stringify(tonightsRun.failures)}）`
  )

  // 完整测量必须过（回归样本的另一半：不能把健康运行也拦掉）。
  check(
    evaluateHealth({ applicableTotal: 456, def95: { rate: 0.4695, total: 164 }, erroredRows: 0, rows: 372 }).ok,
    '健康门：erroredRows 为 0 的完整测量必须放行（否则门禁是恒红的）'
  )

  // 三条子判据各自独立咬合（一条腿哑了不许被另一条腿遮住）。
  checkFails(
    evaluateHealth({ applicableTotal: 0, def95: { rate: 0.5, total: 164 }, erroredRows: 0, rows: 372 }),
    '没有任何 gold 走到打分器',
    '健康门：四维全零'
  )
  checkFails(
    evaluateHealth({ applicableTotal: 456, def95: { rate: null, total: 0 }, erroredRows: 0, rows: 372 }),
    '95% 定义（∨）没有分母',
    '健康门：∨ 没算出数（旧 F6 的那条）'
  )
  checkFails(evaluateHealth({ applicableTotal: 1, def95: { rate: 1, total: 1 }, erroredRows: 0, rows: 0 }), '测量没发生', '健康门：零行')

  // 自检：把 erroredRows 判据去掉，同一组断言必须咬不住 —— 证明上面对 `tonightsRun`
  // 的那条不是「恒红」蒙对的。
  const blind = evaluateHealth({ applicableTotal: 456, def95: { rate: 0.4695, total: 164 }, erroredRows: 0, rows: 372 })
  check(blind.ok, '自检：同一形状但 erroredRows=0 时本应放行 —— 说明拦住首跑形状的确实是「部分失败」这条判据')
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
  check(!/gateExact/.test(src), 'eval-llm.mjs 里不得再有 gateExact（core 当门禁的旧形态）')
  check(/const gateRate = def95\.rate \?\? 0/.test(src), '门禁数字必须来自 def95.rate')
  check(/const gateMetric = 'definition95'/.test(src), '产物必须记下门禁指标名 gateMetric')
  check(/passed: gateRate >= TARGET_ACCURACY && guards\.ok/.test(src), 'passed 必须 = 门禁 ∧ 回归防线')
  check(/const pct = gateRate \* 100/.test(src), '徽章数字必须与门禁同源（gateRate）')
  check(/if \(gateRate < TARGET_ACCURACY \|\| !guards\.ok\)/.test(src), 'exit code 必须只看 gateRate')
  check(
    /evaluateHealth/.test(src),
    'F6 健康门必须走 eval/ratchet.mjs 的 evaluateHealth（纯函数，CI 上免费可验；行为断言见上一块）'
  )
  check(
    /erroredRows > MAX_ERRORED_ROWS/.test(ratchetSrc),
    '健康门必须判「打不开的行数」（2026-10-15 首跑的 107 条 403 曾被当成 107 次真实失败发布成 47.0%）'
  )
  check(
    /orderPlanGatedFirst\(plan\)/.test(src),
    '跑的确实得是门禁语言优先的那份计划 —— 光有 orderPlanGatedFirst 而调用点不用它，等于没改'
  )
  // 反例自检：把「core 当门禁」的旧写法喂进同一组断言，必须至少咬住一条。
  const legacy = src.replace('const gateRate = def95.rate ?? 0', 'const gateExact = exactHeldout ?? exact')
  const caught = !/gateExact/.test(legacy) ? false : !/const gateRate = def95\.rate \?\? 0/.test(legacy)
  check(caught, '自检：旧写法（core 当门禁）必须被这组断言咬住')
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — 地板/棘轮/防删的边界与变异全部咬得住，真实语料的逐维计数不低于基线。✔')
