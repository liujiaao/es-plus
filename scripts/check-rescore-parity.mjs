#!/usr/bin/env node
/**
 * 复算自洽守卫（`check:rescore-parity`）：**用今晚这批模型产出**证明「离线复算 == 当次产物」。
 *
 * ## 为什么需要一个单独的入口
 *
 * `rescore.mjs` 早就实现了 `--expect` 的逐字段比对，但**没有任何东西调用它**：每次改 scorer
 * 都能靠单测证明「新口径自洽」，却没有任何一次真跑批证明「产物里的数字 = 从 dump 复算出来的
 * 数字」。两者缺一，`--expect` 就只是一段没跑过的代码（D8：整条路线唯一的自洽证明从未执行）。
 *
 * 接入点只有夜间跑批：只有那里同时拥有「刚写下的产物」与「刚落盘的 dump」。
 *
 * ## 为什么「跳过」是合法结果，而「不比对」不是
 *
 * 产物里有三种情形不能比对，且都不是缺陷：
 *
 *   · `measurement: failed`（中继全灭 / 健康门拒绝发布）—— 产物里**没有分数**，逐字段比对
 *     必然「全不一致」，报出来只会教人忽略这条守卫；
 *   · 探针运行（`--limit` / `--fragments`）—— 按定义不写产物；
 *   · dump 里没有 CRUD 行（片段-only 探针）；
 *   · 本次跑批失败（旁路失败记录的 `runId` == 本 run，或产物与 dump 的 commit/corpusHash
 *     不同）—— P12 起失败夜不再覆盖主产物，主产物是上一次完整测量，本来就不可比。
 *
 * 这些情形都**显式打印跳过原因**并退出 0。反过来，`measurement: complete*` 却拿不出 dump，
 * 是**红**：那说明「产物说它是完整测量，但没法复算」，正是本守卫要防的形状。
 *
 * 用法：
 *   node scripts/check-rescore-parity.mjs .tmp-eval/pred.jsonl [--expect <artifact>]
 * 退出码：0 = 一致 / 合法跳过；1 = 不一致 或 完整测量却缺 dump。
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCURACY_FILE, FAILED_ACCURACY_FILE } from './eval/artifact.mjs'
import { readDump } from './eval/dump.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const argv = process.argv.slice(2)
let dumpPath = null
let expectPath = ACCURACY_FILE
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--expect') {
    expectPath = argv[++i] ?? null
    if (!expectPath || expectPath.startsWith('--')) {
      console.error('✗ --expect 需要一个产物路径')
      process.exit(2)
    }
  } else if (a.startsWith('--')) {
    console.error(`✗ 未知参数 ${a}`)
    process.exit(2)
  } else if (dumpPath === null) {
    dumpPath = a
  } else {
    console.error(`✗ 多余的参数 ${a}`)
    process.exit(2)
  }
}
if (!dumpPath) {
  console.error('用法: node scripts/check-rescore-parity.mjs <dump.jsonl> [--expect <last-accuracy.json>]')
  process.exit(2)
}

/** 读产物；缺失/畸形都不是「跳过」——那是守卫装错了地方。 */
function readArtifact(path) {
  if (!existsSync(path)) {
    console.error(`✗ 产物不存在：${path}（复算自洽只能对着「当次产物」比对）`)
    process.exit(1)
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`✗ 产物不是合法 JSON：${path} — ${err.message}`)
    process.exit(1)
  }
}

const artifact = readArtifact(expectPath)
const measurement = artifact.measurement

if (measurement && measurement !== 'complete' && measurement !== 'complete-gated-leg-only') {
  console.log(
    `⏭  跳过复算比对：产物 measurement=${measurement}（这次没有可核对的分数）。` +
      '这不是通过，也不是失败 —— 是「没有可比的东西」。'
  )
  process.exit(0)
}
if (!measurement) {
  // 早于 AN-03 的产物没有 measurement：数字可能来自诊断口径（fixedFields），比对无意义。
  console.log('⏭  跳过复算比对：产物无 `measurement` 字段（早于 AN-03 的格式），无法判定它是不是成绩。')
  process.exit(0)
}

// P12：本次跑批失败 ⟹ 产物**故意**保留上一次完整测量（失败记录写旁路）。此时当前产物
// 与本次 dump 不可比，且 dump 可能根本没来得及创建（`--require-key` 之类的前置失败）。
// 以 `runId` 判定「失败记录是不是本 run 写的」，是最精确的判据；拿不到 runId（本地跑批）
// 时退回下面的 commit/corpusHash 身份比较。
let sidecar = null
if (existsSync(FAILED_ACCURACY_FILE)) {
  try {
    sidecar = JSON.parse(readFileSync(FAILED_ACCURACY_FILE, 'utf8'))
  } catch {
    sidecar = null
  }
}
const runId = process.env.GITHUB_RUN_ID
if (sidecar && runId && String(sidecar.runId) === runId) {
  console.log(
    `⏭  跳过复算比对：本次跑批（run ${runId}）测量失败，失败记录已写旁路；` +
      `主产物保留 ${artifact.measuredAt ?? '上一次'} 的完整测量。`
  )
  process.exit(0)
}

if (!existsSync(dumpPath)) {
  console.error(
    `✗ 产物自称 ${measurement}，但 dump 不存在：${dumpPath}\n` +
      '  完整测量必须留下可复算的模型产出（`--dump-pred`）。没有它，「产物里的数字算得对不对」永远无法验证。'
  )
  process.exit(1)
}

// dump 里没有 CRUD 行 ⟹ 只跑了片段/PRD 探针，与 CRUD 产物不可比（合法跳过）。
// P12：失败夜不再覆盖主产物（见 eval/artifact.mjs 的 FAILED_ACCURACY_FILE）。此时
// 主产物是**上一次**完整测量，而 dump 属于本次失败的跑批 —— 拿两者比对必然「全不一致」，
// 报出来只会教人忽略这条守卫。身份（commit/corpusHash）由产物与 dump meta 同源写入，
// 成功夜恒等；不等 ⟹ 两者不是同一次运行，没有可比的东西。
let dumpInfo
try {
  dumpInfo = readDump(dumpPath)
} catch (err) {
  console.error(`✗ dump 读不出来：${err.message}`)
  process.exit(1)
}
const { meta, rows } = dumpInfo
const short = (v) => String(v ?? '(missing)').slice(0, 8)
const identityMismatch =
  meta &&
  ((artifact.commit && meta.commit && artifact.commit !== meta.commit) ||
    (artifact.corpusHash && meta.corpusHash && artifact.corpusHash !== meta.corpusHash))
if (identityMismatch) {
  console.log(
    `⏭  跳过复算比对：产物与 dump 不是同一次运行（产物 commit ${short(artifact.commit)} / ` +
      `dump commit ${short(meta.commit)}；产物语料 ${short(artifact.corpusHash)} / dump 语料 ${short(meta.corpusHash)}）。` +
      (existsSync(FAILED_ACCURACY_FILE)
        ? `本次失败记录在 ${FAILED_ACCURACY_FILE}；主产物保留的是上一次完整测量。`
        : '这不是通过，也不是失败 —— 是「没有可比的东西」。')
  )
  process.exit(0)
}
if (!rows.some((r) => r.kind === 'crud')) {
  console.log('⏭  跳过复算比对：dump 里没有 CRUD 行（片段/PRD-only 探针，不写产物）。')
  process.exit(0)
}

const r = spawnSync(process.execPath, [join(ROOT, 'scripts/eval/rescore.mjs'), dumpPath, '--expect', expectPath], {
  cwd: ROOT,
  encoding: 'utf8',
})
process.stdout.write(r.stdout ?? '')
process.stderr.write(r.stderr ?? '')
if (r.status !== 0) {
  console.error('\n✗ 复算与产物不一致 —— 要么 dump 不完整，要么聚合口径已漂移。两者都必须先修。')
  process.exit(r.status ?? 1)
}
console.log('✅ check:rescore-parity：本次跑批的产物与从 dump 复算的数字逐字段一致。')
