#!/usr/bin/env node
/**
 * 自修复环自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 为什么值得单测：这条环的失败**形状**比失败本身更容易骗人（见 ./repair-loop.mjs 头注）。
 * 这里用**脚本化的 `call`**（预置每轮返回什么）把语义钉死 —— 这不能用跑真钱跑批来验，
 * 因为真实模型不会按你要的顺序犯错。
 *
 * 钉住的八条：
 *   1) **空轮不消耗修复机会**：`[空, 坏, 好]` 必须成功（2026-10-16 实测的回归形状：
 *      `01-user-manage [zh]` 第 1 轮空轮 + 后两轮 schema 不过 → 被误判成能力缺口）。
 *   2) **空轮有界**：全程空轮必须在重发 + 降级都用尽后**失败**，不得挂死。
 *   3) **诊断可分辨**：抛出的消息里必须分别点名「空轮 / 非 JSON / schema 不过」——
 *      三者的处置完全相反（换中继 vs 改 prompt vs 改语料），混成一句话等于没有诊断。
 *   4) **对话回灌不变量**：任何一轮都不得往 messages 里塞空 content（严格中继会 400）。
 *   5) **归因可分辨**（2026-10-16 全量跑后补）：`空轮/截断` ⟹ 「没测到」，`答错` ⟹ 一次
 *      **合法测量**。混作一谈会让「模型真答不出 1 例」把整次运行作废 ⟹ 中继健康也永远红。
 *   6) **降级重试真的会 fire**：重发用尽后必须关掉 thinking 再来一次，且**只在**这一情形下 fire。
 *   7) **截断后预算翻倍且封顶**：`stop_reason=max_tokens` 是我们给的预算不够 ⟹ 下一次调用必须
 *      带着翻倍后的 `maxTokens` 重试；到 `maxTokenCap` 后不得再承诺加预算。否则复杂 case
 *      会三连撞同一个上限，整次跑批因一行「没测到」作废（2026-10-22 opus-4-6 实测）。
 *   8) **传输层重试只重试传输层**：连接错误 / 429 / 5xx 原地重试并退避；401/400 **一次都不得**
 *      重试（否则「key 配错」会被拖成重试风暴）。连续多个调用耗尽 ⟹ 中继**整段不可用** ⟹
 *      冷却期**等它回来**（有界），而不是把剩下的几百行在故障窗口里全部烧掉。
 *      2026-10-22 两次实测：一次连续 184 行 `Connection error.`，一次前 9 行正常、case 10 起
 *      集体失败而中继几分钟后自己恢复 —— 都是「没等」把短暂抖动放大成整次跑批作废。
 */
import {
  driveToValidConfig,
  extractJson,
  isNotMeasured,
  isTransientTransportError,
  isTimeoutError,
  createResilientTransport,
  MAX_REPAIR_ATTEMPTS,
  MAX_EMPTY_RETRIES,
  MAX_DEGRADED_ATTEMPTS,
  EMPTY_TURN_MARK,
  OUTCOME,
} from './repair-loop.mjs'
import { pushAssistant, pushUserCorrection } from './prompt.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

/**
 * 造一个脚本化的 `call`：按序吐出预置产出；用尽后重复最后一个（便于表达「一直空」）。
 * 序列项可以是字符串（= 正常完成的一轮）或 `{text, stopReason}`（用来表达截断）。
 *
 * `fuse` 是**必须的**：若环失去上限（例如有人把空轮重发改成无界的），测试不会「红」，
 * 而是**挂死** —— 挂死在 CI 里表现为撞 job 超时，既慢又看不出病因。有了保险丝，
 * 越界立刻变成一条可读的断言失败。
 */
function scripted(seq, fuse = 40) {
  let i = 0
  const calls = []
  const fn = async (messages, opts) => {
    if (i >= fuse) throw new Error(`TEST FUSE BLOWN: call() 被调用超过 ${fuse} 次 —— 环失去了上限（无界重发）`)
    const item = seq[Math.min(i, seq.length - 1)]
    const out = typeof item === 'string' ? { text: item, stopReason: 'end_turn' } : item
    calls.push({ out, opts, snapshot: messages.map((m) => m.content) })
    i++
    return out
  }
  fn.count = () => i
  fn.calls = calls
  fn.degradedCalls = () => calls.filter((c) => c.opts?.degraded).length
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
/** 被 token 预算截断的一轮：有文本、但 stop_reason 说明是**我们**把它切了。 */
const TRUNCATED = { text: '{"name":"Order", "fields":[{"prop":"a"', stopReason: 'max_tokens' }

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
  check(r3.call.degradedCalls() === 0, '有真产出时**不得**动用降级重试（它不是「多给几次机会」的兜底）')
}

// ── 2) 空轮有界：不得挂死 ────────────────────────────────────────────
{
  const r = await run(['', '', '', '', ''])
  check(!r.ok, '全程空轮必须失败（不得静默成功）')
  const bound = MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES + MAX_DEGRADED_ATTEMPTS
  check(
    r.call.count() === bound,
    `全程空轮的总调用数必须 = ${MAX_REPAIR_ATTEMPTS}+${MAX_EMPTY_RETRIES}+${MAX_DEGRADED_ATTEMPTS} = ${bound}，实际 ${r.call.count()}`
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

// ── 5) 归因：谁该记 0 分（测得准不准），谁该判「没测到」（不该发分） ─────
{
  // 模型**答了**但答错 → 一次合法测量，正确答案就是记 0 分。
  const wrong = await run([JSON_BAD, JSON_BAD, JSON_BAD])
  check(wrong.err.kind === OUTCOME.MODEL_FAILURE, `三次 schema 不过的归因必须是 model-failure，实际 ${wrong.err.kind}`)
  check(!isNotMeasured(wrong.err.kind), 'model-failure **不得**被当成「没测到」（否则模型真答不出会让整次运行永远作废）')

  const prose = await run([NOT_JSON, NOT_JSON, NOT_JSON])
  check(prose.err.kind === OUTCOME.MODEL_FAILURE, `三轮纯 prose 也是模型答错（它答了，只是不合格式），实际 ${prose.err.kind}`)

  // 一个字都没吐 → 没测到。
  const silent = await run([''])
  check(silent.err.kind === OUTCOME.NO_ANSWER, `全空轮的归因必须是 no-answer，实际 ${silent.err.kind}`)
  check(isNotMeasured(silent.err.kind), 'no-answer 必须算「没测到」')

  // 被 token 预算截断 → 没测到（是我们的预算不够，不是模型答不出）。
  const cut = await run([TRUNCATED])
  check(cut.err.kind === OUTCOME.TRUNCATED, `撞 max_tokens 的归因必须是 truncated，实际 ${cut.err.kind}`)
  check(isNotMeasured(cut.err.kind), 'truncated 必须算「没测到」（否则「预算太小」会被记成模型能力不足）')
  check(cut.err.message.includes('max_tokens'), '截断的诊断必须点名 max_tokens，否则读者只会看到「非 JSON」')

  // 混合（先空轮后真答错）→ 模型拿到了完整的三次真机会还是失败 ⟹ 那是它的成绩。
  const mixed = await run(['', JSON_BAD, JSON_BAD, JSON_BAD])
  check(mixed.err.kind === OUTCOME.MODEL_FAILURE, `空轮 + 三次答错的归因应是 model-failure，实际 ${mixed.err.kind}`)

  // 白名单方向：**没被确证**的归因（例如 SDK 直接抛的传输异常，`err.kind` 为 undefined）
  // 必须算「没测到」——把传输故障按 0 分计入成绩，正是 2026-10-15 那份 47.0% 的形状。
  check(isNotMeasured(undefined), '未知归因（如传输异常）必须算「没测到」，不得按 0 分计入成绩')
  check(isNotMeasured('some-brand-new-kind'), '没见过的归因也必须算「没测到」（白名单，而非黑名单）')

  // 报出来的调用数必须是**真实调用数**（诊断链长度 == 调用数，两处不得漂移）。
  check(cut.err.calls === cut.call.count(), `err.calls (${cut.err.calls}) 必须等于真实调用数 (${cut.call.count()})`)
  check(cut.err.message.includes(`${cut.call.count()} call(s)`), '错误消息里的 call(s) 数必须与真实调用数一致')
}

// ── 6) 降级重试：只在「重发已用尽且仍空」时 fire，并真的能救回来 ─────────
{
  // 4 次空轮：前 3 次都会被「原地重发」吃掉，第 4 次触发降级；降级那一次模型给了好 config。
  const r = await run(['', '', '', '', JSON_OK])
  check(r.ok, '降级重试必须能把「重发无效的空轮」救回来（这是 93-stock-qty-edit 的形状）')
  check(
    r.call.degradedCalls() === 1,
    `降级调用应恰好发生 1 次（上限 ${MAX_DEGRADED_ATTEMPTS}），实际 ${r.call.degradedCalls()}`
  )
  check(r.call.calls[4]?.opts?.degraded === true, '第 5 次调用（重发用尽后的那一次）必须带 degraded 标记')
  check(r.call.calls[0]?.opts?.degraded !== true, '降级不得提前发生（重发机会还没用完就换条件 = 悄悄改了被测系统）')
  check(r.call.count() === 5, `真实调用数应为 5，实际 ${r.call.count()}`)

  // 降级也救不回来时，必须**有界**失败且点名降级（不得悄悄回到无界重发）。
  const stillEmpty = await run([''])
  check(!stillEmpty.ok, '降级后仍空必须失败')
  check(stillEmpty.err.message.includes('降级'), '两条退路都用尽时，诊断必须点名「降级」，否则读者不知道试过什么')
  check(
    stillEmpty.call.degradedCalls() === MAX_DEGRADED_ATTEMPTS,
    `降级调用数不得超过上限 ${MAX_DEGRADED_ATTEMPTS}，实际 ${stillEmpty.call.degradedCalls()}`
  )
}

// ── 7) 截断升级：预算是「我们的」故障，翻倍重试才有机会救回来 ─────────────
{
  // 第 1 次撞预算，第 2 次（预算翻倍后）答出合法 config ⟹ 这一行是**测到了**，
  // 而不是因为 8000 不够被记成「没测到」。2026-10-22 opus-4-6 全量实测的回归形状。
  const rescued = await run([TRUNCATED, JSON_OK], { maxTokens: 8000, maxTokenCap: 32000 })
  check(rescued.ok, '截断后预算翻倍重试必须能救回这一行（否则整次跑批因我们的预算作废）')
  check(
    rescued.call.calls[0]?.opts?.maxTokens === 8000,
    `首次调用应使用基础预算 8000，实际 ${rescued.call.calls[0]?.opts?.maxTokens}`
  )
  check(
    rescued.call.calls[1]?.opts?.maxTokens === 16000,
    `截断后下一次调用预算应翻倍到 16000，实际 ${rescued.call.calls[1]?.opts?.maxTokens}`
  )

  // 连续截断：逐次翻倍但**不得超过**上限（无界抬高预算 = 用钱掩盖配置错误）。
  const capped = await run([TRUNCATED], { maxTokens: 8000, maxTokenCap: 32000 })
  const budgets = capped.call.calls.map((c) => c.opts?.maxTokens)
  check(
    budgets.join(',') === '8000,16000,32000',
    `预算必须是 8000 → 16000 → 32000（封顶），实际 ${budgets.join(',')}`
  )
  check(capped.err.kind === OUTCOME.TRUNCATED, '封顶后仍截断，归因仍是「没测到」（不得记成模型答错）')
  check(
    (capped.err.message.match(/下次预算提到/g) ?? []).length === 2,
    '只有「真的抬高过」的两次才可承诺加预算；到顶那一次不得再承诺（诊断必须与实际动作一致）'
  )

  // 不传预算时不得凭空塞 `opts.maxTokens`（调用方的默认值仍然是唯一来源）。
  const legacy = await run([JSON_OK])
  check(legacy.call.calls[0]?.opts === undefined, '未指定基础预算时，调用不得携带 opts（交给 call 的默认值）')
}

// ── 8) 传输层重试：只重试「调用没落地」的那一类，且有界 ─────────────────
{
  /**
   * 复刻 `@anthropic-ai/sdk@0.137.0` **真实抛出**的错误形状：
   * `err.name === 'Error'`、`err.status === undefined`，只有 `constructor.name` 与
   * message 可辨（实测见 repair-loop.mjs 头注）。
   *
   * 为什么非要用这个夹具：第一版判据只认 `err.name`，而夹具是「自己造一个带 name 的错误」，
   * 于是测试绿、线上 `Request timed out.` 全部漏判 —— 测试证明的是夹具的假设，不是 SDK 的行为。
   * 夹具在这里**自证**它复刻的是 SDK 而不是一个理想化的错误。
   */
  const sdkError = (kind, message) => {
    const Ctor = {
      APIConnectionError: class extends Error {},
      APIConnectionTimeoutError: class extends Error {},
    }[kind]
    const e = new Ctor(message)
    check(
      e.name === 'Error' && e.status === undefined && e.constructor.name === kind,
      `错误夹具必须复刻 SDK 形态（name=Error / status=undefined / ctor=${kind}），实际 ${e.name}/${e.status}/${e.constructor.name}`
    )
    return e
  }
  const connErr = sdkError('APIConnectionError', 'Connection error.')
  const timeoutErr = sdkError('APIConnectionTimeoutError', 'Request timed out.')

  check(isTransientTransportError(connErr), 'APIConnectionError 必须可重试（2026-10-22 中继抖动的真实形状）')
  check(isTransientTransportError(timeoutErr), 'APIConnectionTimeoutError 必须可重试（漏判它会让 8 行 zh 变「未测到」）')
  check(isTransientTransportError(new Error('Request timed out.')), '仅凭措辞也要认出超时（SDK 不设 name）')
  check(isTimeoutError(timeoutErr), 'isTimeoutError 必须认出 APIConnectionTimeoutError')
  check(isTimeoutError(new Error('Request timed out.')), 'isTimeoutError 必须认出仅凭措辞的超时')
  check(!isTimeoutError(connErr), '连接错误不是超时（处置不同：先走完重试）')
  check(isTransientTransportError({ status: 429, message: 'rate limited' }), '429 必须可重试')
  check(isTransientTransportError({ status: 503, message: 'unavailable' }), '5xx 必须可重试')
  check(isTransientTransportError({ status: 500, message: 'boom' }), '500 必须可重试')
  // 4xx 是**配置错**（key 失效、参数不合法）：重试只会把一次快速失败拖成重试风暴。
  check(!isTransientTransportError({ status: 401, message: 'unauthorized' }), '401 绝不可重试（key 配错）')
  check(!isTransientTransportError({ status: 400, message: 'bad request' }), '400 绝不可重试（参数错）')
  check(!isTransientTransportError({ status: 403, message: 'forbidden' }), '403 绝不可重试（额度/权限）')
  check(!isTransientTransportError(null), 'null 不是传输错误')
  // 无 status 时只能看措辞 —— 这是 SDK 把连接层错误包成通用 Error 时的兜底。
  check(isTransientTransportError(new Error('ECONNRESET')), '无 status 时 ECONNRESET 必须可重试')
  check(!isTransientTransportError(new Error('schema validation failed')), '普通业务错误不得被当成传输错误')

  /**
   * 造一个可观测的运输层：注入 sleep（零等待），记录退避与冷却两类等待。
   * `cooldowns` 只收冷却期（onWait）的时长，`sleeps` 收全部注入的等待 —— 两者分开记，
   * 否则「退避走了几次」与「冷却等了多久」会被混成一串数字。
   */
  const mk = (overrides = {}) => {
    const sleeps = []
    const retries = []
    const cooldowns = []
    const t = createResilientTransport({
      sleep: async (ms) => void sleeps.push(ms),
      onRetry: (err, n) => retries.push(n),
      onWait: ({ cooldownMs }) => cooldowns.push(cooldownMs),
      ...overrides,
    })
    return { t, sleeps, retries, cooldowns }
  }
  /** 造一个「前 n 次按序抛错、之后成功」的调用（单测零等待）。 */
  const flaky = (errors, value = 'ok') => {
    let i = 0
    const fn = async () => {
      if (i < errors.length) throw errors[i++]
      return value
    }
    return { fn, calls: () => i }
  }
  const failing = (err) => async () => {
    throw err
  }
  /** 连续 tripAfter 个调用耗尽 ⟹ 进入冷却期（这段路径本身由下面的用例断言）。 */
  const trip = async (t, err = connErr) => {
    for (let i = 0; i < 3; i++) {
      try {
        await t.run(failing(err))
      } catch {
        /* 预期的失败 */
      }
    }
  }

  // 抖动一次后成功 ⟹ 返回结果，退避一次 3000ms、不进冷却。
  {
    const { t, sleeps, retries, cooldowns } = mk()
    const f = flaky([connErr])
    const out = await t.run(f.fn)
    check(out === 'ok', '一次抖动后必须重试成功并返回结果')
    check(sleeps.join(',') === '3000', `第一次退避应为 3000ms，实际 ${sleeps.join(',')}`)
    check(retries.join(',') === '1', `onRetry 应收到 1，实际 ${retries.join(',')}`)
    check(cooldowns.length === 0, '单次抖动不得进冷却（否则每行都要多等 30s）')
  }
  // 退避必须是指数：3s → 6s → 12s → 24s（上限 5 次 = 4 次退避）。
  {
    const { t, sleeps } = mk()
    const f = flaky([connErr, connErr, connErr, connErr, connErr])
    let threw = null
    try {
      await t.run(f.fn)
    } catch (e) {
      threw = e
    }
    check(threw === connErr, '重试用尽后必须抛出**最后一个**错误（上层要照旧归因/记录）')
    check(f.calls() === 5, `默认最多 5 次尝试，实际 ${f.calls()}`)
    check(sleeps.join(',') === '3000,6000,12000,24000', `退避必须指数增长，实际 ${sleeps.join(',')}`)
  }
  // 401 一次都不重试：这是「key 配错」不能被拖成 4 小时重试风暴的唯一保证。
  {
    const { t, sleeps } = mk()
    const f = flaky([{ status: 401, message: 'unauthorized' }])
    let threw = null
    try {
      await t.run(f.fn)
    } catch (e) {
      threw = e
    }
    check(threw?.status === 401, '401 必须原样抛出')
    check(f.calls() === 1 && sleeps.length === 0, `401 不得重试（调用 ${f.calls()} 次、等待 ${sleeps.length} 次）`)
  }
  // onRetry 的次数必须等于实际重试次数（产物里的 transportRetries 就靠它计数）。
  {
    const { t, retries } = mk()
    const f = flaky([connErr, connErr])
    await t.run(f.fn)
    check(retries.join(',') === '1,2', `onRetry 应收到 1,2，实际 ${retries.join(',')}`)
  }
  // **超时当场升级为冷却**：不再原样撞满剩余 4 次（每次一个完整超时窗口）。
  {
    const { t, sleeps, cooldowns, retries } = mk()
    let n = 0
    const out = await t.run(async () => {
      n++
      if (n === 1) throw timeoutErr // 第一次就挂了整整一个超时窗口
      return 'ok'
    })
    check(out === 'ok', '超时后冷却等待应能把这一行救回来')
    check(retries.length === 0, `超时不得走「再撞 4 次」的正常重试（实际重试 ${retries.length} 次）`)
    check(cooldowns.join(',') === '30000', `超时应直接进冷却并等 30000ms，实际 ${cooldowns.join(',')}`)
    check(sleeps.join(',') === '30000', `超时只应产生一次冷却等待，实际 ${sleeps.join(',')}`)
  }

  // 正常模式：连续 3 个调用耗尽后进入冷却期。
  {
    const { t } = mk()
    check(t.streak === 0, '初始连败计数应为 0')
    await trip(t)
    check(t.streak === 3, `连续 3 个调用耗尽后连败计数应为 3，实际 ${t.streak}`)
  }

  // 冷却期**等它回来**：不是快速失败，而是按 30s 退避重试，成功即恢复。
  {
    const { t, cooldowns } = mk()
    await trip(t)
    let n = 0
    const out = await t.run(async () => {
      n++
      if (n === 1) throw connErr // 冷却期第一次尝试仍在故障窗口里
      return 'ok'
    })
    check(out === 'ok', '冷却期必须等中继回来并返回结果（这正是 2026-10-22 那次被浪费掉的机会）')
    check(cooldowns.join(',') === '30000', `冷却期应等待 30000ms 后重试，实际 ${cooldowns.join(',')}`)
    check(t.streak === 0, '恢复后必须复位连败计数（后续行重新享有正常重试）')
  }

  // 冷却必须**有界**：中继长期不回来时，等满单次预算就抛原错误（不挂死 CI）。
  {
    const { t, cooldowns } = mk({ perOutageBudgetMs: 90000 })
    await trip(t)
    let threw = null
    try {
      await t.run(failing(connErr))
    } catch (e) {
      threw = e
    }
    check(threw === connErr, '等待预算用尽后必须抛出原错误（上层照旧归因为「未测到」）')
    check(
      cooldowns.join(',') === '30000,60000',
      `单次预算 90000ms 只容得下 30000+60000，实际 ${cooldowns.join(',')}`
    )
    check(t.totalWaitedMs === 90000, `累计等待应恰为 90000ms，实际 ${t.totalWaitedMs}`)
  }

  // 冷却期遇到 4xx（key 配错）必须立刻抛，绝不把跑批挂 45 分钟。
  {
    const { t, cooldowns } = mk()
    await trip(t)
    let threw = null
    try {
      await t.run(failing({ status: 401, message: 'unauthorized' }))
    } catch (e) {
      threw = e
    }
    check(threw?.status === 401, '冷却期遇到 401 必须原样抛出')
    check(cooldowns.length === 0, '冷却期遇到 4xx 不得等待（那是配置错，不是中继不可用）')
    check(t.streak === 0, '4xx 必须清空连败计数（否则一次 key 配错会让断路状态续命）')
  }

  // 全程等待预算：多次故障累计不得超过 totalOutageBudgetMs。
  {
    const { t, cooldowns } = mk({ perOutageBudgetMs: 60000, totalOutageBudgetMs: 90000 })
    // 一次故障只能用掉「单次预算」允许的那一段（30s + 60s 会超 60s，故只等 30s）。
    await trip(t)
    try {
      await t.run(failing(connErr))
    } catch {
      /* 单次预算用尽 */
    }
    check(cooldowns.join(',') === '30000', `第一次故障应等 30000ms，实际 ${cooldowns.join(',')}`)
    // 恢复一次（成功即复位），再来一次故障：仍按单次预算等 30s，累计到 60s。
    await t.run(async () => 'ok')
    await trip(t)
    try {
      await t.run(failing(connErr))
    } catch {
      /* 单次预算用尽 */
    }
    check(cooldowns.join(',') === '30000,30000', `第二次故障应再等 30000ms，实际 ${cooldowns.join(',')}`)
    // 第三次故障：累计 90000ms 正好用尽全程预算。
    await t.run(async () => 'ok')
    await trip(t)
    try {
      await t.run(failing(connErr))
    } catch {
      /* 单次预算用尽 */
    }
    check(
      cooldowns.join(',') === '30000,30000,30000',
      `第三次故障应仍能等到全程预算用尽，实际 ${cooldowns.join(',')}`
    )
    check(t.totalWaitedMs === 90000, `累计等待应恰为全程预算 90000ms，实际 ${t.totalWaitedMs}`)
    // 第四次故障：全程预算已用尽 ⟹ 一次都不得再等（跑批必须诚实结束，不得挂死）。
    await t.run(async () => 'ok')
    await trip(t)
    try {
      await t.run(failing(connErr))
    } catch {
      /* 全程预算用尽 */
    }
    check(
      cooldowns.join(',') === '30000,30000,30000',
      `全程预算用尽后不得再等待，实际 ${cooldowns.join(',')}`
    )
  }
}

// ── 9) extractJson 边界（纯函数） ────────────────────────────────────
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
console.log(
  '\nmeta-eval OK — 自修复环：空轮不消耗机会且两条退路都有界，三种病因各自点名，' +
    '归因区分「没测到 / 答错了」，降级重试只在重发用尽时 fire，截断后预算翻倍且封顶，' +
    '传输重试只重试传输层且有界，中继整段不可用时冷却等待而非烧光剩余行，回灌不留空块。✔'
)
