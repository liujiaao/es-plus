#!/usr/bin/env node
/**
 * 行级重放策略的自测（meta-eval，无需 API key）。
 *
 * 为什么值得单独守：重放是**唯一一处**会让「同一条语料被模型答两次」的逻辑。
 * 它一旦放宽（把 `model-failure` 也重放，或重放多遍），分数就会在**没人改语料、没人改尺子**的
 * 情况下自己往上爬 —— 而且爬得越多的批次看起来越像「模型变强了」。所以规则要逐条钉住，
 * 不靠「实现看起来对」。
 *
 * 用法：node scripts/eval/replay.test.mjs
 * 退出码：0 = 策略成立；1 = 至少一条失效。
 */
import { planReplay, shouldAbortReplay, summarizeReplay, REPLAY_ABORT_AFTER, REPLAY_MAX_DEFAULT } from './replay.mjs'
import { isNotMeasured, OUTCOME } from './repair-loop.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const eq = (a, b, msg) => check(a === b, `${msg}（期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}）`)

// ── 1. 只有「没测到」的行进候选；模型答错的行是成绩，不进 ─────────────────────
{
  const attempts = [
    { key: 'a|zh', error: null, errorKind: null }, // 测到了
    { key: 'b|zh', error: 'Connection error.', errorKind: null }, // 传输异常（kind 缺省 ⟹ 没测到）
    { key: 'c|zh', error: 'no tool call', errorKind: OUTCOME.NO_ANSWER },
    { key: 'd|zh', error: 'bad json', errorKind: OUTCOME.TRUNCATED },
    { key: 'e|zh', error: 'schema mismatch', errorKind: OUTCOME.MODEL_FAILURE }, // 模型答错 ⟹ 成绩
  ]
  const p = planReplay(attempts, { isNotMeasured })
  eq(p.targets.join(','), 'b|zh,c|zh,d|zh', '只重放没测到的行，且保持语料顺序')
  eq(p.skippedModelFailure, 1, 'model-failure 必须被显式跳过（而不是悄悄忽略）')
  eq(p.skippedOverCap, 0, '未超上限时 skippedOverCap 为 0')

  // 反例：把 model-failure 也放进来 ⟹ 门槛失守。这条断言防的是「有人改了 isNotMeasured 的方向」。
  const loose = planReplay(attempts, { isNotMeasured: () => true })
  eq(loose.targets.length, 4, '若判据被改成「一切错误都算没测到」，重放集合会立刻变大 —— 此处钉住差异')
  check(loose.targets.includes('e|zh'), '（同上，model-failure 行会混进重放 ⟹ 给模型第二次抽样机会）')
}

// ── 2. 条数上限：抖动规模远超上限时，别把整轮重跑一遍 ─────────────────────────
{
  const many = Array.from({ length: 40 }, (_, i) => ({ key: `f${i}|zh`, error: 'boom', errorKind: null }))
  const p = planReplay(many, { isNotMeasured, max: 8 })
  eq(p.targets.length, 8, '上限生效')
  eq(p.skippedOverCap, 32, '超出上限的行要计数（产物里能看出「这次抖动有多大」）')
  const d = planReplay(many, { isNotMeasured })
  eq(d.targets.length, REPLAY_MAX_DEFAULT, '默认上限即 REPLAY_MAX_DEFAULT')
}

// ── 3. 中继仍不通就停 ────────────────────────────────────────────────────────
{
  eq(shouldAbortReplay(0), false, '没有连续失败时不停止')
  eq(shouldAbortReplay(REPLAY_ABORT_AFTER - 1), false, `连续 ${REPLAY_ABORT_AFTER - 1} 次仍可继续`)
  eq(shouldAbortReplay(REPLAY_ABORT_AFTER), true, `连续 ${REPLAY_ABORT_AFTER} 次即停`)
  eq(shouldAbortReplay(1, 1), true, '阈值可注入（=1 时不重放）')
}

// ── 4. 产物里的计数必须可对账 ────────────────────────────────────────────────
{
  const s = summarizeReplay({ attempted: 5, recovered: 3, aborted: false, skippedModelFailure: 2, skippedOverCap: 1 })
  eq(s.stillUnmeasured, 2, 'attempted = recovered + stillUnmeasured')
  eq(s.attempted, s.recovered + s.stillUnmeasured, '对账恒等式')
  // 非法输入不许造出「恢复数 > 尝试数」这种自我矛盾
  const bad = summarizeReplay({ attempted: 2, recovered: 9 })
  eq(bad.recovered, 2, 'recovered 不得超过 attempted')
  eq(bad.stillUnmeasured, 0, '夹逼后仍满足对账恒等式')
  const none = summarizeReplay(null)
  eq(none.attempted + none.recovered + none.stillUnmeasured, 0, '空输入退化成全 0，而不是 NaN')
}

// ── 5. 判据必须注入（不许在本模块里长出第二份白名单）──────────────────────────
{
  let threw = false
  try {
    planReplay([], {})
  } catch {
    threw = true
  }
  check(threw, 'planReplay 缺 isNotMeasured 时必须抛错（防止默认成「一切错误都重放」）')
}

if (failures > 0) {
  console.error(`\n行级重放策略自测失败：${failures} 条`)
  process.exit(1)
}
console.log('✅ 行级重放策略自测通过（只放没测到 / 只一遍 / 死中继即停 / 上限 / 计数对账 / 判据单源）')
