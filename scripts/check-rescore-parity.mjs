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
 *   · dump 里没有 CRUD 行（片段-only 探针）。
 *
 * 这三种都**显式打印跳过原因**并退出 0。反过来，`measurement: complete*` 却拿不出 dump，
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
import { ACCURACY_FILE } from './eval/artifact.mjs'
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

if (!existsSync(dumpPath)) {
  console.error(
    `✗ 产物自称 ${measurement}，但 dump 不存在：${dumpPath}\n` +
      '  完整测量必须留下可复算的模型产出（`--dump-pred`）。没有它，「产物里的数字算得对不对」永远无法验证。'
  )
  process.exit(1)
}

// dump 里没有 CRUD 行 ⟹ 只跑了片段/PRD 探针，与 CRUD 产物不可比（合法跳过）。
try {
  const { rows } = readDump(dumpPath)
  if (!rows.some((r) => r.kind === 'crud')) {
    console.log('⏭  跳过复算比对：dump 里没有 CRUD 行（片段/PRD-only 探针，不写产物）。')
    process.exit(0)
  }
} catch (err) {
  console.error(`✗ dump 读不出来：${err.message}`)
  process.exit(1)
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
