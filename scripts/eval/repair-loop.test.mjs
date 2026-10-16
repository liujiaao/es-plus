#!/usr/bin/env node
/**
 * 自修复环自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 为什么值得单测：这条环的失败**形状**比失败本身更容易骗人（见 ./repair-loop.mjs 头注）。
 * 这里用**脚本化的 `call`**（预置每轮返回什么）把语义钉死 —— 这不能用跑真钱跑批来验，
 * 因为真实模型不会按你要的顺序犯错。
 *
 * 钉住的四条：
 *   1) **空轮不消耗修复机会**：`[空, 坏, 好]` 必须成功（2026-10-16 实测的回归形状：
 *      `01-user-manage [zh]` 第 1 轮空轮 + 后两轮 schema 不过 → 被误判成能力缺口）。
 *   2) **空轮有界**：全程空轮必须在 MAX_EMPTY_RETRIES 次重发后**失败**，不得挂死。
 *   3) **诊断可分辨**：抛出的消息里必须分别点名「空轮 / 非 JSON / schema 不过」——
 *      三者的处置完全相反（换中继 vs 改 prompt vs 改语料），混成一句话等于没有诊断。
 *   4) **对话回灌不变量**：任何一轮都不得往 messages 里塞空 content（严格中继会 400）。
 */
import {
  driveToValidConfig,
  extractJson,
  MAX_REPAIR_ATTEMPTS,
  MAX_EMPTY_RETRIES,
  EMPTY_TURN_MARK,
} from './repair-loop.mjs'
import { pushAssistant, pushUserCorrection } from './prompt.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

const GOOD = { name: 'X' }

/**
 * 造一个脚本化的 `call`：按序吐出预置文本；用尽后重复最后一个（便于表达「一直空」）。
 *
 * `fuse` 是**必须的**：若环失去上限（例如有人把空轮重发改成无界的），测试不会「红」，
 * 而是**挂死** —— 挂死在 CI 里表现为撞 job 超时，既慢又看不出病因。有了保险丝，
 * 越界立刻变成一条可读的断言失败。
 */
function scripted(seq, fuse = 40) {
  let i = 0
  const calls = []
  const fn = async (messages) => {
    if (i >= fuse) throw new Error(`TEST FUSE BLOWN: call() 被调用超过 ${fuse} 次 —— 环失去了上限（无界重发）`)
    const raw = seq[Math.min(i, seq.length - 1)]
    calls.push({ raw, snapshot: messages.map((m) => m.content) })
    i++
    return raw
  }
  fn.count = () => i
  fn.calls = calls
  return fn
}

/** 校验器：候选含 `ok` 为真则过；否则报出 `issues`（默认 1 条）。 */
const validate = (candidate) =>
  candidate && candidate.ok
    ? { success: true, data: candidate }
    : { success: false, issues: [{ path: ['fields', '0', 'formtype'], message: 'bad' }] }

const run = async (seq, opts) => {
  const call = scripted(seq)
  const messages = [{ role: 'user', content: 'nl' }]
  const out = await driveToValidConfig({ call, messages, validate, pushAssistant, pushUserCorrection, ...opts }).then(
    (data) => ({ ok: true, data, call, messages }),
    (err) => {
      // 保险丝炸了**不是**「环按预期失败了」——它表示环失去了上限。必须当场让测试红，
      // 否则 `check(!r.ok, …)` 会把「挂死/越界」误判成「正确地失败」。
      if (/TEST FUSE BLOWN/.test(err.message)) throw err
      return { ok: false, err, call, messages }
    }
  )
  return out
}

const JSON_OK = '{"ok":true}'
const JSON_BAD = '{"nope":1}'
const NOT_JSON = 'sorry, I cannot do that'

// ── 1) 空轮不消耗修复机会（真实回归形状） ──────────────────────────────
{
  // 第 1 轮空、第 2 轮坏、第 3 轮好 → 修复机会正好用掉 2 次（坏 + 好），仍须成功。
  const r = await run(['', JSON_BAD, JSON_OK])
  check(r.ok, `空轮不得消耗修复机会：[空, 坏, 好] 应成功，实际 ${r.ok ? '' : r.err.message}`)
  check(r.call.count() === 3, `应恰好调用 3 次（空轮原地重发，不算一次尝试），实际 ${r.call.count()}`)
  check(r.ok && r.data.ok === true, '返回的应是校验通过的那份 config')

  // 更强：连续两个空轮也不得吃掉机会。
  const r2 = await run(['', '', JSON_OK])
  check(r2.ok, '连续两个空轮后仍须成功')
  check(r2.call.count() === 3, `连续空轮后仍是 3 次调用，实际 ${r2.call.count()}`)
  // 反例自检（证明「坏**确实**消耗修复机会」，否则上面那条可能只是因为机会太多才过的）：
  // 1 空轮 + 3 个 schema 坏 → 空轮不占机会，于是 3 次机会全被坏消耗尽 → 必须失败，
  // 且最后那个 JSON_OK **根本没被调用**（调用数 = 1 重发 + 3 尝试 = 4）。
  const r3 = await run(['', JSON_BAD, JSON_BAD, JSON_BAD, JSON_OK])
  check(!r3.ok, '1 空轮 + 3 坏：修复机会被坏用尽 → 必须失败（证明坏消耗机会）')
  check(
    r3.call.count() === 1 + MAX_REPAIR_ATTEMPTS,
    `1 空轮 + 3 坏 → 调用数应为 1 重发 + ${MAX_REPAIR_ATTEMPTS} 尝试 = ${1 + MAX_REPAIR_ATTEMPTS}，实际 ${r3.call.count()}`
  )
  check(
    (r3.err.message.match(/schema 不过/g) ?? []).length === MAX_REPAIR_ATTEMPTS,
    `诊断链里应恰好有 ${MAX_REPAIR_ATTEMPTS} 条 schema 不过，实际 = ${r3.err.message}`
  )
}

// ── 2) 空轮有界：不得挂死 ────────────────────────────────────────────
{
  const r = await run(['', '', '', '', ''])
  check(!r.ok, '全程空轮必须失败（不得静默成功）')
  check(
    r.call.count() === MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES,
    `全程空轮的总调用数必须 = ${MAX_REPAIR_ATTEMPTS}+${MAX_EMPTY_RETRIES} = ${MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES}，实际 ${r.call.count()}`
  )
  check(r.err.message.includes(EMPTY_TURN_MARK), '全程空轮的错误必须点名「空轮」（否则读者会以为是模型答错）')
}

// ── 3) 诊断可分辨：三种病因必须各自点名 ────────────────────────────────
{
  const allBad = await run([JSON_BAD, JSON_BAD, JSON_BAD])
  check(!allBad.ok && allBad.err.message.includes('schema 不过'), '三次 schema 不过 → 必须点名 schema')
  check(!allBad.err.message.includes(EMPTY_TURN_MARK), 'schema 不过不得被误报成空轮')

  const allNotJson = await run([NOT_JSON, NOT_JSON, NOT_JSON])
  check(!allNotJson.ok && allNotJson.err.message.includes('非 JSON'), '三次非 JSON → 必须点名「非 JSON」')
  check(!allNotJson.err.message.includes(EMPTY_TURN_MARK), '非 JSON 不得被误报成空轮')

  // 混合：三种都要出现在同一条诊断链里（这就是 2026-10-16 实测的真实形状）。
  const mixed = await run(['', JSON_BAD, NOT_JSON, JSON_BAD])
  check(!mixed.ok, '混合失败序列必须失败')
  for (const mark of [EMPTY_TURN_MARK, 'schema 不过', '非 JSON']) {
    check(mixed.err.message.includes(mark), `混合失败的诊断链里必须出现 ${mark}；实际 = ${mixed.err.message}`)
  }
  check(mixed.err.message.includes('chars'), '诊断必须报告最后一次输出的长度（0 长度本身就是证据）')
}

// ── 4) 对话回灌不变量：任何一轮都不得留空 content（严格中继 400） ────────
{
  const r = await run(['', NOT_JSON, JSON_BAD, JSON_OK])
  check(
    r.messages.every((m) => typeof m.content === 'string' && m.content.trim().length > 0),
    `整段对话里不得有任何空 content 块（严格中继会 400）`
  )
  check(
    r.call.calls.every((c) => c.snapshot.every((x) => typeof x === 'string' && x.trim().length > 0)),
    '每次请求发出时，已有对话里也不得有空 content 块'
  )
  // 空轮**不进对话**（什么都没产出 ⟹ 状态不变 ⟹ 纯重发）：第一次调用后 messages 仍只有初始那条。
  check(
    r.call.calls[0].snapshot.length === 1 && r.call.calls[1].snapshot.length === 1,
    '空轮不得往对话里追加任何消息（否则「纯重试」就变成了「带着占位符再问一次」）'
  )
}

// ── 5) extractJson 边界（纯函数） ────────────────────────────────────
{
  check(extractJson('{"a":1}').a === 1, 'extractJson：裸对象')
  check(extractJson('```json\n{"a":1}\n```').a === 1, 'extractJson：围栏')
  check(extractJson('blah {"a":1} blah').a === 1, 'extractJson：前后废话')
  let threw = false
  try {
    extractJson('no braces here')
  } catch {
    threw = true
  }
  check(threw, 'extractJson：无 JSON 必须抛（供环区分「非 JSON」）')
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — 自修复环：空轮不消耗机会且有界，三种病因各自点名，回灌不留空块。✔')
