#!/usr/bin/env node
/**
 * 离线复算端到端自测（meta-eval，无需 API key；需先 `npm run build:libs`——
 * CI 的 consistency job 在跑 `check:consistency` 前已 build `@es-plus/shared`）。
 *
 * ## 为什么必须端到端
 *
 * `run-metrics` 与 `dump` 各自的单测证明不了**拼起来**是对的：dump 的字段名、
 * rescore 的重建路径（成功行 / 错误行 / 收敛轮）、以及 `--expect` 的比对清单，
 * 任何一处错位都会让"复算与产物一致"这条结论失真，而跑批本身仍是绿的。
 *
 * 这里用一份**真实语料**构造 dump（gold 当 pred = 必过；删一个字段 = 必不过；一行报错 = 分母仍在），
 * 然后跑真 `rescore.mjs`：
 *
 *   1) 95% 定义 = 1/3（只有 gold 那一行过；错误行按 0 计、分母不缩水）；
 *   2) 带 `--expect` 且产物一致 → 退出 0；
 *   3) 产物被改一位 → 退出 1（守卫必须咬得住）。
 *
 * 用法：node scripts/eval/rescore.test.mjs
 * 退出码：0 = 端到端链路成立；1 = 至少一条失效。
 */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { isCrudCase } from './scenes.mjs'
import { RULER_VERSION } from './dump.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const RESCORE = join(__dirname, 'rescore.mjs')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const eq = (a, b, msg) => check(a === b, `${msg}（期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}）`)

// 挑一条至少有 2 个字段的 CRUD 语料，且带 pinnedDims 更好（走真实 mask 路径）。
let picked = null
for (const f of readdirSync(CASES_DIR).filter((x) => x.endsWith('.json')).sort()) {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
  if (!isCrudCase(raw)) continue
  if (!Array.isArray(raw.config?.fields) || raw.config.fields.length < 2) continue
  picked = { file: f, raw }
  break
}
if (!picked) {
  console.error('✗ 找不到可用的 CRUD 语料（至少 2 个字段）')
  process.exit(1)
}

const { raw } = picked
const mask = { pinnedDims: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [] }
const gold = raw.config
const worse = { ...raw.config, fields: raw.config.fields.slice(1) }

const dir = mkdtempSync(join(tmpdir(), 'esplus-rescore-'))
try {
  const dumpPath = join(dir, 'pred.jsonl')
  const lines = [
    {
      kind: 'meta',
      schemaVersion: 1,
      rulerVersion: 'prop-identity-v1',
      corpusHash: 'testhash',
      corpusFiles: 1,
      model: 'test-model',
      fixedFieldsUsed: false,
      convergeK: 3,
    },
    { kind: 'crud', file: picked.file, lang: 'zh', gold, mask, fewshotDerived: false, convergesBy: null, hasRefinements: false, turn0: gold, turns: [], compiles: true, noThrow: true, compileError: null, error: null, errorKind: null },
    { kind: 'crud', file: picked.file, lang: 'zh', gold, mask, fewshotDerived: false, convergesBy: null, hasRefinements: false, turn0: worse, turns: [], compiles: true, noThrow: true, compileError: null, error: null, errorKind: null },
    { kind: 'crud', file: picked.file, lang: 'zh', gold, mask, fewshotDerived: false, convergesBy: null, hasRefinements: false, turn0: null, turns: [], compiles: false, noThrow: true, compileError: null, error: 'boom', errorKind: 'model-failure' },
  ]
  writeFileSync(dumpPath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')

  const run = (...args) => spawnSync(process.execPath, [RESCORE, ...args], { encoding: 'utf8', cwd: ROOT })

  // ── 1. 复算本身 ────────────────────────────────────────────────────────────
  const r1 = run(dumpPath, '--json')
  check(r1.status === 0, `rescore 应退出 0（实得 ${r1.status}）：${r1.stderr}`)
  let out = null
  try {
    out = JSON.parse(r1.stdout)
  } catch {
    /* 下面统一报错 */
  }
  check(!!out, `rescore --json 必须输出可解析 JSON（stdout=${r1.stdout.slice(0, 200)}）`)
  if (out) {
    eq(out.cases, 3, '分母 = 3 行（错误行也在分母里，不能被洗掉）')
    eq(out.heldout, 3, '三行都是 heldout')
    eq(out.definition95?.pass, 1, '只有 gold 那一行满足 95% 定义')
    eq(out.definition95?.total, 3, '95% 定义分母 = 3')
    eq(out.definition95?.rate, Number((1 / 3).toFixed(4)), '95% 定义 rate = 1/3')
    eq(out.compileMeasured, 2, '编译分母 = 有产物的两行（错误行不算编译失败）')
    eq(out.compileCompiled, 2, '两行产物都编译过')
    eq(out.compileRate, 1, 'compileRate = 1')
    eq(out.convergence, null, '无精修语料时 convergence 为 null')
    check(out.notRescored?.typecheck?.includes('deterministic'), 'typecheck 必须显式标注「需重跑」，不能伪造')
  }

  // ── 2. --expect 一致 → 0 ───────────────────────────────────────────────────
  const artifact = {
    // 产物必须带**当前尺子**的版本号，否则 `--expect` 会被判成跨版本比对（Ruler v3）。
    rulerVersion: RULER_VERSION,
    // `check:rescore-parity` 只在「产物自称完整测量」时才比对（见该脚本头注）：不全不成，
    // 探针/失败产物按定义没有可核对的分数。
    measurement: 'complete-gated-leg-only',
    definition95: { k: 3, rate: out?.definition95?.rate, pass: out?.definition95?.pass, total: out?.definition95?.total },
    inSchemaIntentZeroEdit: out?.definition95?.rate,
    coreRate: out?.coreRate,
    inSchemaIntentScoped: out?.scoped,
    inSchemaIntentScopedAll: out?.scopedAll,
    exactIntentFull: out?.full,
    exactIntentFullAll: out?.fullAll,
    propSetF1: out?.propSetF1,
    attributeAccuracy: out?.attributeAccuracy,
    attributeRows: out?.attributeRows,
    actionsF1: out?.actionsF1,
    compileRate: out?.compileRate,
    compileMeasured: out?.compileMeasured,
    compileCompiled: out?.compileCompiled,
    convergence: null,
    byCapability: out?.byCapability,
  }
  const goodPath = join(dir, 'good.json')
  writeFileSync(goodPath, JSON.stringify(artifact))
  const r2 = run(dumpPath, '--expect', goodPath)
  check(r2.status === 0, `一致的产物应退出 0（实得 ${r2.status}）：${r2.stdout}${r2.stderr}`)
  check(/逐字段一致/.test(r2.stdout), '一致时必须打印逐字段一致的结论')

  // ── 3. 产物被改一位 → 1（守卫必须咬得住）───────────────────────────────────
  const badPath = join(dir, 'bad.json')
  writeFileSync(badPath, JSON.stringify({ ...artifact, propSetF1: (artifact.propSetF1 ?? 0) + 0.5 }))
  const r3 = run(dumpPath, '--expect', badPath)
  eq(r3.status, 1, '产物不一致必须退出 1（否则 parity 守卫是装饰）')
  check(/不一致/.test(r3.stderr), '不一致时必须打印差异项')

  // ── 4. 跨尺子版本 → 1，且报错必须说「尺子不同」而不是「口径漂移」 ────────────
  // 数字在两边**完全一致**也要拒绝：比对本身无意义（两把尺子量的是不同的量）。
  const stalePath = join(dir, 'stale.json')
  writeFileSync(stalePath, JSON.stringify({ ...artifact, rulerVersion: 'prop-identity-v1+deco-projection-v1' }))
  const r4 = run(dumpPath, '--expect', stalePath)
  eq(r4.status, 1, '跨尺子版本必须退出 1')
  check(/尺子版本不同/.test(r4.stderr), `跨版本必须明说尺子不同，实得：${r4.stderr}`)
  check(!/不一致（/.test(r4.stderr), '跨版本不得退化成「逐字段不一致」的报错（会被误读成聚合漂移）')

  // ── 5. check:rescore-parity 的**跳过规则**（守卫最容易在这里变成红盲）─────────
  // 恒跳过 = 永远绿；恒比对 = 每次探针/失败跑批都红。四条分支逐条钉住。
  const PARITY = join(ROOT, 'scripts', 'check-rescore-parity.mjs')
  const parity = (args) => spawnSync(process.execPath, [PARITY, ...args], { cwd: ROOT, encoding: 'utf8' })

  const p1 = parity([dumpPath, '--expect', goodPath])
  check(p1.status === 0, `一致的产物必须让 parity 通过（实得 ${p1.status}）：${p1.stderr}`)
  check(/逐字段一致/.test(p1.stdout), 'parity 通过必须打印「逐字段一致」（否则是静默跳过）')

  const failedArtifact = join(dir, 'failed.json')
  writeFileSync(failedArtifact, JSON.stringify({ measurement: 'failed', failures: ['x'] }))
  const p2 = parity([dumpPath, '--expect', failedArtifact])
  check(p2.status === 0 && /跳过/.test(p2.stdout), 'measurement=failed 必须显式跳过（不是失败，也不是通过）')

  const p3 = parity([join(dir, 'missing.jsonl'), '--expect', goodPath])
  check(p3.status === 1, '产物自称完整测量却没有 dump ⟹ 必须红（否则「能不能复算」永远没人验证）')

  const fragOnly = join(dir, 'frag.jsonl')
  writeFileSync(fragOnly, JSON.stringify({ kind: 'meta', schemaVersion: 1, rulerVersion: RULER_VERSION }) + '\n')
  const p4 = parity([fragOnly, '--expect', goodPath])
  check(p4.status === 0 && /没有 CRUD 行/.test(p4.stdout), 'CRUD 零行的 dump 必须显式跳过（片段探针不写产物）')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\nrescore 端到端自测失败：${failures} 条`)
  process.exit(1)
}
console.log('✅ 离线复算端到端自测通过（分母完整 / 95% 定义 / 编译门 / --expect 双向）')
