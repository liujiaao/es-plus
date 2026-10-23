#!/usr/bin/env node
/**
 * 离线复算：用**另一套尺子**重算一份已落盘的模型产出，不调用任何 API。
 *
 * ## 它解决的问题
 *
 * 一次全量跑批 3.5 小时 + 一份配额。在预测落盘之前，改一次 scorer 就必须再跑一次；
 * 而且新旧口径无法在同一批模型产出上对照 —— 只能跨批次比，而模型/语料/中继都在变，
 * 于是"口径调整的效果"和"环境漂移"永远混在一起。
 *
 * 有了 `--dump-pred`，`rescore` 把这件事变成纯离线计算：
 *
 *   node scripts/eval/rescore.mjs .tmp-audit/pred.jsonl                  # 新尺子下的数字
 *   node scripts/eval/rescore.mjs .tmp-audit/pred.jsonl --expect __tests__/golden/last-accuracy.json
 *                                                                        # 与当次产物逐字段比对
 *
 * ## 口径一致性（关键）
 *
 * 聚合**复用** `eval/run-metrics.mjs` —— 与 `eval-llm.mjs` 是同一份实现。判据复用
 * `eval/scorers.mjs`。因此本文件里**没有**任何独立的口径逻辑；它只做三件事：
 * 重建逐行结果 → 调同一套聚合 → 打印/比对。
 *
 * ## 它**不**复算什么
 *
 * `compile / typecheck / front-door` 是确定性代码的产物，dump 里只带了当次布尔值。
 * 本工具不伪造它们：能读到的（`compiles`）照常进 Tier A 数字，读不到的（typecheck /
 * front-door）显式标注「需重跑（确定性、无 API 成本）」。
 *
 * PRD 腿同理：surfaces 需要前门 project 上下文，本工具暂不重建，只报条数。
 */

import { readFileSync } from 'node:fs'
import { StructuredCrudConfigSchema } from '@es-plus/shared'
import { scoreAll, CAPABILITY_SCORERS, firstConvergedTurn } from './scorers.mjs'
import { computeCrudMetrics, computeFragmentMetrics, CONVERGE_K } from './run-metrics.mjs'
import { readDump } from './dump.mjs'
import { scoreFragment } from './fragment-scorers.mjs'
import { isNotMeasured } from './repair-loop.mjs'

const argv = process.argv.slice(2)
let DUMP = null
let EXPECT = null
let AS_JSON = false
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--expect') {
    EXPECT = argv[++i] ?? null
    if (!EXPECT || EXPECT.startsWith('--')) {
      console.error('✗ --expect 需要一个产物路径，例如 --expect __tests__/golden/last-accuracy.json')
      process.exit(2)
    }
  } else if (a === '--json') {
    AS_JSON = true
  } else if (a.startsWith('--')) {
    console.error(`✗ 未知参数 ${a}`)
    process.exit(2)
  } else if (DUMP === null) {
    DUMP = a
  } else {
    console.error(`✗ 多余的参数 ${a}`)
    process.exit(2)
  }
}

if (!DUMP) {
  console.error('用法: node scripts/eval/rescore.mjs <dump.jsonl> [--expect <last-accuracy.json>] [--json]')
  process.exit(2)
}

/** 反序列化后的配置必须重新过 schema：Zod 默认值在 JSON 往返中会丢，不重解析就不是同一份配置。 */
function reparse(config, what) {
  const r = StructuredCrudConfigSchema.safeParse(config)
  if (!r.success) {
    throw new Error(`${what} 无法通过 schema（dump 损坏？）：${r.error.issues[0]?.message ?? 'unknown'}`)
  }
  return r.data
}

const { meta, rows: entries, skipped } = readDump(DUMP)
if (!meta) {
  console.error(`✗ ${DUMP} 缺少 meta 首行 —— 不是本工具能复算的 dump`)
  process.exit(2)
}

const convergeK = Number.isInteger(meta.convergeK) ? meta.convergeK : CONVERGE_K

// ── 重建 CRUD 逐行结果（与 eval-llm.mjs 的成功/错误两条路径同构）──────────────
const rows = []
for (const e of entries) {
  if (e.kind !== 'crud') continue
  let gold
  try {
    gold = reparse(e.gold, `${e.file} gold`)
  } catch (err) {
    console.error(`✗ ${err.message}`)
    process.exit(1)
  }
  const mask = e.mask ?? { pinnedDims: [] }

  if (e.error) {
    // 模型答错 / 没测到：维度适用性由 gold 决定、命中一律 false，与 eval-llm 完全一致。
    const errCaps = {}
    for (const s of CAPABILITY_SCORERS) {
      errCaps[s.key] = s.applicable(gold)
        ? { applicable: true, pass: false }
        : { applicable: false, pass: null }
    }
    rows.push({
      file: e.file,
      lang: e.lang,
      exactIntentCore: false,
      exactIntentFull: false,
      exactIntentScoped: false,
      byCapability: errCaps,
      attrAcc: null,
      compiles: false,
      noThrow: true,
      compileError: null,
      error: e.error,
      errorKind: e.errorKind ?? null,
      fewshotDerived: !!e.fewshotDerived,
      gold,
    })
    continue
  }

  let pred
  try {
    pred = reparse(e.turn0, `${e.file} turn0`)
  } catch (err) {
    console.error(`✗ ${err.message}`)
    process.exit(1)
  }
  const s = scoreAll(gold, pred, mask)

  let convergence = null
  if (e.hasRefinements) {
    const scopedSeq = [s.exactIntentScoped]
    for (const raw of e.turns ?? []) {
      const rPred = reparse(raw, `${e.file} refinement`)
      scopedSeq.push(scoreAll(gold, rPred, mask).exactIntentScoped)
    }
    const firstTurn = firstConvergedTurn(scopedSeq.map((v) => ({ exactIntentScoped: v })))
    convergence = { firstTurn, attempts: scopedSeq.length - 1, convergesBy: e.convergesBy ?? null }
  }

  rows.push({
    file: e.file,
    lang: e.lang,
    ...s,
    compiles: !!e.compiles,
    noThrow: e.noThrow !== false,
    compileError: e.compileError ?? null,
    error: null,
    errorKind: null,
    fewshotDerived: !!e.fewshotDerived,
    convergence,
    gold,
  })
}

// ── 重建片段逐行结果 ────────────────────────────────────────────────────────
const fragmentRows = []
for (const e of entries) {
  if (e.kind !== 'fragment') continue
  if (e.error || !e.pred) {
    fragmentRows.push({
      file: e.file,
      scene: e.scene,
      compiles: false,
      noThrow: true,
      compileError: null,
      error: e.error ?? 'no pred',
      errorKind: e.errorKind ?? null,
      score: null,
      fewshotDerived: !!e.fewshotDerived,
    })
    continue
  }
  const s = scoreFragment(e.scene, e.gold, e.pred, e.mask ?? { pinnedDims: [], statedDims: [] })
  fragmentRows.push({
    file: e.file,
    scene: e.scene,
    compiles: !!e.compiles,
    noThrow: e.noThrow !== false,
    compileError: e.compileError ?? null,
    error: null,
    errorKind: null,
    score: s,
    fewshotDerived: !!e.fewshotDerived,
  })
}

const m = computeCrudMetrics(rows, { convergeK })
const { fragmentSummary } = computeFragmentMetrics(fragmentRows, isNotMeasured)
const prdCount = entries.filter((e) => e.kind === 'prd').length

// ── 输出 ────────────────────────────────────────────────────────────────────
const r4 = (x) => (typeof x === 'number' ? Number(x.toFixed(4)) : null)
const pct = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)

const out = {
  rulerVersion: meta.rulerVersion ?? null,
  corpusHash: meta.corpusHash ?? null,
  corpusFiles: meta.corpusFiles ?? null,
  model: meta.model ?? null,
  fixedFieldsUsed: !!meta.fixedFieldsUsed,
  convergeK,
  skippedLines: skipped,
  cases: m.n,
  heldout: m.heldout.length,
  definition95: m.def95.rate === null ? null : { rate: r4(m.def95.rate), pass: m.def95.pass, total: m.def95.total },
  coreRate: r4(m.coreRate),
  scoped: r4(m.exactScopedHeldout ?? m.exactScoped),
  scopedAll: r4(m.exactScoped),
  full: r4(m.exactFullHeldout ?? m.exactFull),
  fullAll: r4(m.exactFull),
  propSetF1: r4(m.propF1),
  attributeAccuracy: r4(m.attrAcc),
  attributeRows: m.attrRows.length,
  actionsF1: r4(m.actF1),
  compileRate: r4(m.compileRate),
  compileMeasured: m.compileStats.measured,
  compileCompiled: m.compileStats.compiled,
  convergence: m.convStats.total
    ? {
        rateAtK: r4(m.convStats.rateAtK),
        meanTurnsToConverge: m.convStats.meanTurnsToConverge === null ? null : Number(m.convStats.meanTurnsToConverge.toFixed(2)),
        converged: m.convStats.converged,
        total: m.convStats.total,
        turn0: m.convStats.turn0,
        scripted: m.convStats.scripted,
        withinK: m.convStats.withinK,
      }
    : null,
  byCapability: m.byCapability,
  fragments: {
    cases: fragmentSummary.cases,
    measured: fragmentSummary.measured,
    notMeasured: fragmentSummary.notMeasured,
    core: r4(fragmentSummary.core),
    scoped: r4(fragmentSummary.scoped),
    full: r4(fragmentSummary.full),
    compileRate: r4(fragmentSummary.compileRate),
  },
  notRescored: {
    typecheck: 'checks are deterministic; dump carries no typecheck verdict — rerun without API cost',
    frontDoor: 'same — deterministic handler; rerun without API cost',
    prd: prdCount ? `${prdCount} PRD row(s) in dump; surfaces need front-door project context — not rebuilt here` : 'none',
  },
}

if (AS_JSON) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log(`\n离线复算 — ${DUMP}`)
  console.log('==========================================')
  console.log(`  ruler:                 ${out.rulerVersion}（dump 身份，非本工具参数）`)
  console.log(`  corpus:                ${out.corpusFiles} files · hash ${out.corpusHash}`)
  console.log(`  model:                 ${out.model}${out.fixedFieldsUsed ? '  ⚠ fixedFields 曾喂给模型（诊断口径，不可当成绩）' : ''}`)
  if (skipped) console.log(`  skipped lines:         ${skipped}（半行 JSON，进程被杀时可能出现）`)
  console.log(`  cases:                 ${out.cases}  (heldout ${out.heldout})`)
  console.log(`  95%-definition:        ${pct(out.definition95?.rate)}${out.definition95 ? `  (${out.definition95.pass}/${out.definition95.total})` : ''}   ← 门禁口径`)
  console.log(`  core (diagnostic):     ${pct(out.coreRate)}`)
  console.log(`  scoped HELDOUT / ALL:  ${pct(out.scoped)} / ${pct(out.scopedAll)}`)
  console.log(`  prop-set F1:           ${pct(out.propSetF1)}`)
  console.log(`  attribute acc:         ${pct(out.attributeAccuracy)}  (${out.attributeRows}/${out.cases} rows)`)
  console.log(`  actions F1:            ${pct(out.actionsF1)}`)
  console.log(`  compiles (Tier A):     ${pct(out.compileRate)}  (${out.compileCompiled}/${out.compileMeasured})`)
  if (out.convergence) {
    console.log(
      `  convergence@${convergeK}:         ${pct(out.convergence.rateAtK)}` +
        `  (${out.convergence.converged}/${out.convergence.total}; turn-0 ${out.convergence.turn0} · scripted ${out.convergence.scripted})`
    )
  }
  console.log(`  fragments:             cases ${out.fragments.cases} · scoped ${pct(out.fragments.scoped)} · core ${pct(out.fragments.core)} · compiles ${pct(out.fragments.compileRate)}`)
  console.log('  NOT rescored:')
  for (const [k, v] of Object.entries(out.notRescored)) console.log(`    ${k.padEnd(10)} ${v}`)
}

// ── 与当次产物比对（`check:rescore-parity` 的实现）─────────────────────────────
if (EXPECT) {
  const exp = JSON.parse(readFileSync(EXPECT, 'utf8'))
  /** 可复算字段 ↔ 产物字段。每项都是「聚合口径」而非「跑批环境」。 */
  const pairs = [
    ['definition95.rate', out.definition95?.rate, exp.definition95?.rate],
    ['definition95.pass', out.definition95?.pass, exp.definition95?.pass],
    ['definition95.total', out.definition95?.total, exp.definition95?.total],
    ['coreRate', out.coreRate, exp.coreRate],
    ['inSchemaIntentZeroEdit', out.definition95?.rate, exp.inSchemaIntentZeroEdit],
    ['inSchemaIntentScoped', out.scoped, exp.inSchemaIntentScoped],
    ['inSchemaIntentScopedAll', out.scopedAll, exp.inSchemaIntentScopedAll],
    ['exactIntentFull', out.full, exp.exactIntentFull],
    ['exactIntentFullAll', out.fullAll, exp.exactIntentFullAll],
    ['propSetF1', out.propSetF1, exp.propSetF1],
    ['attributeAccuracy', out.attributeAccuracy, exp.attributeAccuracy],
    ['attributeRows', out.attributeRows, exp.attributeRows],
    ['actionsF1', out.actionsF1, exp.actionsF1],
    ['compileRate', out.compileRate, exp.compileRate],
    ['compileMeasured', out.compileMeasured, exp.compileMeasured],
    ['compileCompiled', out.compileCompiled, exp.compileCompiled],
    ['convergence.rateAtK', out.convergence?.rateAtK, exp.convergence?.rateAtK],
    ['convergence.converged', out.convergence?.converged, exp.convergence?.converged],
    ['convergence.turn0', out.convergence?.turn0, exp.convergence?.turn0],
    ['convergence.scripted', out.convergence?.scripted, exp.convergence?.scripted],
    ['definition95.k', convergeK, exp.definition95?.k],
  ]
  for (const { key } of CAPABILITY_SCORERS) {
    pairs.push([`byCapability.${key}.rate`, out.byCapability[key]?.rate, exp.byCapability?.[key]?.rate])
    pairs.push([`byCapability.${key}.applicable`, out.byCapability[key]?.applicable, exp.byCapability?.[key]?.applicable])
  }

  const diffs = pairs.filter(([, a, b]) => a !== b)
  if (diffs.length) {
    console.error(`\n✗ 复算与产物不一致（${diffs.length} 项）：`)
    for (const [k, a, b] of diffs) console.error(`    ${k}: rescore ${JSON.stringify(a)} ≠ artifact ${JSON.stringify(b)}`)
    console.error('  ⟹ 要么 dump 不完整，要么聚合口径已漂移。两者都必须先修，不能拿复算数字下结论。')
    process.exit(1)
  }
  console.log(`\n✔ 复算与产物逐字段一致（${pairs.length} 项）—— dump 完整、口径同源。`)
}
