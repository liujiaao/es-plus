#!/usr/bin/env node
/**
 * 「调模型 → 取 JSON → 校验」自修复环（纯函数、无 SDK、可无 key 单测）。
 *
 * 从 eval-llm.mjs 抽出，理由同 ./prompt.mjs 与 ./scorers.mjs：eval-llm.mjs 在模块顶层
 * 就 `main()`，一 import 就跑真钱跑批，所以要单测的逻辑必须住在这里。
 *
 * ## 为什么这条环值得单测（2026-10-16 试京东云网关时暴露）
 *
 * 它的失败**形状**比失败**本身**更容易骗人。三种病因在这条环里收缩成同一句话
 * 「could not obtain a schema-valid config after repairs」，而处置完全相反：
 *
 *   · `空轮`       —— 这一轮**一个 text 块都没有**。不是模型答错，是中继/模型问题：
 *                     `thinking: {type:'adaptive'}` 下模型把整轮花在思考上，而有些网关
 *                     会**剥掉 thinking 正文**（实测京东云 `thinking` 块 `len=0 sig=12760`），
 *                     于是 `textOf` 拿到空串。
 *   · `非 JSON`    —— 模型**答了**，但没按格式输出（prompt/温度问题）。
 *   · `schema 不过` —— 模型**答了**，但真的答错了（能力缺口，语料/提示词问题）。
 *
 * 空轮还曾经**白白吃掉一次修复机会**：实测 `01-user-manage [zh]` 第 1 轮空轮、随后两轮
 * schema 不过 → 三次机会只剩两次，用例被判负；而单跑同一条用例一次就过 —— 瞬态被当成了
 * 能力缺口。故本模块把「空轮」单列：**原地重发同一请求**（什么都没产出 ⟹ 对话状态没变
 * ⟹ 重发是纯重试），不消耗 schema 修复机会，但有独立上限以防系统性空轮把这里挂死。
 *
 * ## 归因（OUTCOME）：为什么必须把「没测到」和「答错了」分开（2026-10-16 全量跑后补）
 *
 * 那一跑（run 38840019126）中继**完全健康**（`servedModel=claude-sonnet-4-6`，364/372 行
 * 走到打分器），却因 zh 腿 3 行打不开而整次拒绝发布。可这 3 行里有 2 行是**模型真的答错了**
 * （`36-dealer-response-map` 三轮都不是 JSON、`48-course-group-2level` 后两轮 schema 不过）
 * —— 那本来就是一次**合法测量**，正确答案就是给这两行记 0 分；把它们当成「测量没发生」是
 * 分类错误。剩下 1 行（`93-stock-qty-edit-vue3`，6/6 空轮）才是真的**没测到**。
 *
 * 两类混作一谈的后果不止是措辞：语料里恒有 1–2 例是模型当下真答不出来的，于是**中继健康也
 * 永远拒绝发布**——正是 evaluateHealth 头注里为观测腿写下的「永久红 = 红盲」失效模式
 * （见 ./ratchet.mjs），只是没被用在这条区分上。
 *
 * 故本模块把一行「打不开」归成三类，抛出的 `err.kind` 就是它：
 *
 *   · `no-answer`      —— 一次 text 块都没拿到 ⟹ **没测到**（不得记 0，那是冤枉）
 *   · `truncated`      —— 撞到 `max_tokens` 预算 ⟹ **没测到**（是我们的预算不够，不是模型；
 *                        默认 8000，thinking 型模型可经 `ESPLUS_EVAL_MAX_TOKENS` 调高）
 *   · `model-failure`  —— 至少拿到过一次真产出（有 text、未被截断），但仍拿不到合法 config
 *                        ⟹ **测到了，模型就是答错了** ⟹ 记 0 分才是诚实答案
 *
 * 判据只看 `stop_reason` 与「有没有 text」，**不看 trail 的措辞**——措辞是给人读的。
 */

/** schema/JSON 修复机会数（= 总尝试次数）。 */
export const MAX_REPAIR_ATTEMPTS = 3

/**
 * 空轮的原地重发上限。独立于修复机会，**总计调用数 ≤ MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES
 * + MAX_DEGRADED_ATTEMPTS**。上限存在是为了让「中继系统性返回空轮」变成一个有界的失败，
 * 而不是挂到 CI 超时。
 */
export const MAX_EMPTY_RETRIES = 3

/**
 * 降级收尾的调用上限（关掉 thinking 再要一次）。
 *
 * 空轮重发**本质上是同一件事再问一遍**：若这例是「模型对这个 prompt 恒走纯思考轮」，
 * 重发 N 次也还是空轮——实测 `93-stock-qty-edit-vue3 [zh]` 就是 6/6 空轮，重发毫无用处。
 * 唯一能断掉这条通路的手段是**改条件**：关掉 thinking，模型就必须直接吐文本。
 * 这不是「换个模型重考」，而是把「中继剥掉 thinking 正文」这个坏掉的通路绕开。
 */
export const MAX_DEGRADED_ATTEMPTS = 1

/** 空轮在诊断链里的标记（测试与产物断言共用同一串，改措辞会同时打红两处，这是刻意的）。 */
export const EMPTY_TURN_MARK = '空轮（无 text 块'

/**
 * 一行最终「打不开」的三种归因。**只有 `model-failure` 才是成绩**，另两种是「没测到」。
 * 见文件头注。
 */
export const OUTCOME = {
  NO_ANSWER: 'no-answer',
  TRUNCATED: 'truncated',
  MODEL_FAILURE: 'model-failure',
}

/**
 * 该归因是否属于「没测到」（⟹ 不得当作 0 分计入成绩，且健康门必须拒绝发布）。
 *
 * **白名单方向是刻意的**：只有**被确证**是真产出（`model-failure`）才算测得的分；其余一律
 * 算没测到 —— 包括 `undefined`（SDK 直接抛的传输异常）。方向反过来的代价不对称：
 * 把「没测到」误记成 0 会**压低**成绩并可能把它发布出去（正是 2026-10-15 那份 47.0% 的形状）；
 * 把「答错了」误判成没测到只是不发布，诚实但保守。
 * @param {string|undefined} kind
 */
export function isNotMeasured(kind) {
  return kind !== OUTCOME.MODEL_FAILURE
}

/** 从模型输出里抠出 JSON 对象（容忍 ```json 围栏与前后废话）。纯函数。 */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object found in model output')
  return JSON.parse(body.slice(start, end + 1))
}

/**
 * 传输层故障（与模型产出无关）—— 值得**原地重试**的那一类错误。
 *
 * 与 `truncated` / `empty` 的区别：后者是「调用成功了，但没拿到可用产出」，由自修复环按
 * 归因处理；这里说的是**调用根本没落地**（SDK `APIConnectionError` / 429 / 5xx）。
 * 一次 4 小时的全量跑批里，中继偶发抖动是常态；让一行连接错误直接变成「未测到」，
 * 再经由门禁腿零容忍把整次跑批作废，代价与病因完全不成比例（2026-10-22 实测：
 * 京东云中继在 zh 120–265 连续 184 行 `Connection error.`，随后自行恢复）。
 *
 * ## 为什么既看 `constructor.name` 又看措辞（2026-10-22 第三次实测踩中）
 *
 * `@anthropic-ai/sdk` 0.137.0 的 `APIConnectionError` / `APIConnectionTimeoutError`
 * **不设 `err.name`**（实测 `name === "Error"`，`status === undefined`），只剩
 * `constructor.name` 与 message 两处可辨。第一版判据只认 `err.name`，于是
 * `Request timed out.` **既没被重试、也没计入连败** —— 中继整段卡死时，十分钟的连接错误
 * 还能靠 `Connection error.` 的措辞兜住，五分钟的挂起却全部漏网，跑批里 8 行 zh 直接
 * 变成「未测到」（整次跑批因此必然作废）。故这份判据必须对**真实抛出的对象**成立 ——
 * 单测也据此构造（见 repair-loop.test.mjs：用 `Object.create` 复刻 SDK 的形态，
 * 连 `name` 都保持 "Error"），不允许用「自己造一个带 name 的错误」来证明判据有效。
 *
 * 判据只认**传输层**信号：SDK 连接/超时类（构造器名）、HTTP 429/5xx、以及无 status 时的
 * 网络错误关键字。绝不把 4xx（鉴权/参数错）当可重试 —— 那会把「key 配错」拖成重试风暴。
 */
export function isTransientTransportError(err) {
  if (!err) return false
  const name = String(err.name ?? '')
  const ctor = String(err.constructor?.name ?? '')
  const isConnClass =
    name === 'APIConnectionError' ||
    name === 'APIConnectionTimeoutError' ||
    ctor === 'APIConnectionError' ||
    ctor === 'APIConnectionTimeoutError'
  if (isConnClass) return true
  const status = err.status ?? err.statusCode
  if (typeof status === 'number' && (status === 429 || (status >= 500 && status <= 599))) return true
  if (typeof status === 'number') return false
  return /connection error|request timed out|timed out|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test(
    String(err.message ?? '')
  )
}

/**
 * 是不是**超时**（而不是一次立刻断开的连接错误）。
 *
 * 两者在处置上必须分开：连接错误可能只是中继抖了一下，值得先把几次重试走完；
 * 超时的含义是「等了整整一个请求超时、一个字节都没回」——那是**整段卡死**的强信号，
 * 再原样撞 4 次（每次 5 分钟）只是在用跑批时长换同一个结论。故超时直接进入冷却等待。
 */
export function isTimeoutError(err) {
  if (!err) return false
  if (String(err.name ?? '') === 'APIConnectionTimeoutError') return true
  if (String(err.constructor?.name ?? '') === 'APIConnectionTimeoutError') return true
  return /timed out|timeout|ETIMEDOUT/i.test(String(err.message ?? ''))
}

/**
 * 中继「整段不可用」时的**冷却等待**：把「偶发抖动」与「中继挂了一阵」分开处置。
 *
 * ## 为什么不能只做「连续失败就一击即走」（2026-10-22 第三次全量实测，第一次修复被推翻）
 *
 * 只做断路器的问题在**故障窗口的利用方式**：断路器一旦打开，剩下几百行会在故障窗口里
 * 被**全部**打成「未测到」——而窗口本身往往只有几分钟（那次的实况：跑批 11:19 开始、
 * 11:26 结束，前 9 行正常，case 10 起连接错误，3 行耗尽重试后断路器打开，其余 398 行
 * 在 1–2 分钟内集体失败；跑完之后几分钟中继自己就恢复了）。也就是说，一次**短暂的**
 * 中继抖动，被我们自己的「快速失败」放大成了一整次无效跑批：本该等 10 分钟，结果把
 * 3 小时的钱和一次夜间窗口一起丢掉。
 *
 * 故冷却期**不是**快速失败，而是**原地等它回来**：单次尝试 → 失败则按 30s/60s/120s/
 * 240s/300s（封顶）退避重试，直到成功或本轮等待预算用尽。一行等在中继上，总比几百行
 * 一起作废便宜得多 —— 每行的语义也没变：等回来之后它照常被测量。
 *
 * 等待必须**有界**，否则「key 已失效 / 中继长期不可用」会把跑批挂成 CI 超时：
 *   · `perOutageBudgetMs`  单次故障最多等多久（默认 45 分钟）
 *   · `totalOutageBudgetMs` 整次跑批累计最多等多久（默认 90 分钟）
 * 预算用尽后**抛出原错误**（上层照旧归因为「未测到」），跑批诚实结束而不是永远挂着。
 *
 * 判据：只有 `isTransientTransportError` 为真的失败才等待；4xx（key 配错 / 参数错）立刻抛，
 * 绝不让一次鉴权错误把跑批挂 45 分钟。
 *
 * **超时（`isTimeoutError`）直接进冷却**：一次请求超时的含义是「等了整整一个超时窗口、
 * 一个字节都没回」，这比一次立刻断开的连接错误严苛得多，再原样撞 4 次只是在用跑批时长
 * 换同一个结论。2026-10-22 16:45 那次实测：中继挂起 5 分钟，8 行 zh 以 `Request timed out.`
 * 变成「未测到」，而判据当时只认 `err.name`（SDK 不设它）⟹ 既没重试也没进冷却。
 *
 * @param {object} [opts]
 * @param {number} [opts.perCallAttempts] 正常模式下单次调用的重试次数
 * @param {number} [opts.baseDelayMs]     正常模式的退避基数（3s → 6s → 12s → 24s）
 * @param {number} [opts.tripAfter]       连续多少个调用耗尽才算「中继整段不可用」
 * @param {number} [opts.cooldownBaseMs]  冷却期首次等待时长
 * @param {number} [opts.cooldownMaxMs]   冷却期单次等待上限
 * @param {number} [opts.perOutageBudgetMs]
 * @param {number} [opts.totalOutageBudgetMs]
 * @param {(ms:number)=>Promise<void>} [opts.sleep] 可注入，故单测零等待
 * @param {(err:Error, n:number)=>void} [opts.onRetry]     正常模式的每次重试
 * @param {(info:{cooldownMs:number, waitedMs:number})=>void} [opts.onWait] 冷却期的每次等待
 */
export function createResilientTransport({
  perCallAttempts = 5,
  baseDelayMs = 3000,
  tripAfter = 3,
  cooldownBaseMs = 30000,
  cooldownMaxMs = 300000,
  perOutageBudgetMs = 45 * 60 * 1000,
  totalOutageBudgetMs = 90 * 60 * 1000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  onRetry,
  onWait,
} = {}) {
  let streak = 0
  let totalWaitedMs = 0
  return {
    /**
     * 跑一次调用。两种模式在**同一循环**里切换（而不是两条独立路径）：超时需要在
     * 「正常模式的第 1 次失败」当场升级为冷却，拆成两个函数反而要跳出再跳回。
     */
    async run(fn) {
      let cooling = streak >= tripAfter
      let attemptsLeft = perCallAttempts
      let backoffMs = baseDelayMs
      let waitedMs = 0
      let cooldownMs = cooldownBaseMs
      for (;;) {
        try {
          const value = await fn()
          streak = 0 // 成功 ⟹ 中继是通的，复位（后续行重新享有正常重试）
          return value
        } catch (err) {
          if (!isTransientTransportError(err)) {
            streak = 0 // 4xx 是配置错，不是「中继不可用」，不能让冷却状态续命
            throw err
          }
          // 超时 = 整段卡死的强信号：当场升级为冷却，不再原样撞满剩余次数。
          if (!cooling && isTimeoutError(err)) {
            cooling = true
            streak = tripAfter
          }
          if (!cooling) {
            attemptsLeft -= 1
            if (attemptsLeft > 0) {
              onRetry?.(err, perCallAttempts - attemptsLeft)
              await sleep(backoffMs)
              backoffMs *= 2
              continue
            }
            // 正常模式耗尽：这一行没测到，但**只记一档连败**（抖动是散点，不是连片）。
            streak = Math.min(streak + 1, tripAfter)
            throw err
          }
          // ── 冷却期：中继整段不可用 —— 等它回来 ────────────────────────
          const next = Math.min(cooldownMs, cooldownMaxMs)
          if (waitedMs + next > perOutageBudgetMs || totalWaitedMs + next > totalOutageBudgetMs) {
            // 预算用尽 ⟹ 停止等待，把原错误交回上层（照旧归因「未测到」，诚实失败）
            streak = tripAfter
            throw err
          }
          onWait?.({ cooldownMs: next, waitedMs })
          await sleep(next)
          waitedMs += next
          totalWaitedMs += next
          cooldownMs = next * 2
        }
      }
    },
    /** 当前连续耗尽次数（诊断/日志用）。 */
    get streak() {
      return streak
    },
    /** 整次跑批累计等待时长（进产物，读数字的人有权知道这次等过多久）。 */
    get totalWaitedMs() {
      return totalWaitedMs
    },
  }
}

/**
 * @param {object} o
 * @param {(messages: object[], opts?: {degraded?: boolean, maxTokens?: number}) => Promise<{text: string, stopReason?: string|null}>} o.call
 *        取模型这一轮的产出（可注入以单测）。`opts.degraded` 为真时**必须关掉 thinking**，
 *        理由见 MAX_DEGRADED_ATTEMPTS；`opts.maxTokens` 为本轮输出预算（截断升级用）。
 * @param {object[]} o.messages 就地追加（多轮精修要靠同一数组延续上下文）
 * @param {(candidate: object) => {success: boolean, data?: object, issues?: {path:string[], message:string}[]}} o.validate
 * @param {(messages: object[], text: string) => object} o.pushAssistant 见 ./prompt.mjs
 * @param {(messages: object[], text: string) => object} o.pushUserCorrection 见 ./prompt.mjs
 * @param {number|null} [o.maxTokens] 基础输出预算；null = 不显式传（交给 call 的默认值）
 * @param {number} [o.maxTokenCap] 截断后逐次翻倍的上限。见下方 truncation 分支。
 * @returns {Promise<object>} 通过校验的 config
 * @throws {Error & {kind: string, calls: number, attemptKinds: string[]}} 拿不到合法 config 时
 */
export async function driveToValidConfig({
  call,
  messages,
  validate,
  pushAssistant,
  pushUserCorrection,
  maxRepairs = MAX_REPAIR_ATTEMPTS,
  maxEmptyRetries = MAX_EMPTY_RETRIES,
  maxDegraded = MAX_DEGRADED_ATTEMPTS,
  maxTokens = null,
  maxTokenCap = 32000,
}) {
  const trail = []
  /** 每次**物理调用**产出了什么：'real'（有文本且未被截断）/ 'empty'（无文本）/ 'truncated'。 */
  const kinds = []
  let lastRaw = ''
  let emptyRetries = 0
  let degradedUsed = 0
  let pendingDegraded = false
  /**
   * 本行的输出预算。截断是**预算**问题，不是模型的答卷：翻倍后重试是唯一对症的动作
   * （原实现每次都用同一预算重试，于是复杂 case 连撞 3 次、整次跑批因一行「没测到」作废）。
   * 只有真撞过截断的行才会付出更高的预算/延迟，正常行仍按基础预算跑。
   */
  let tokenBudget = maxTokens

  for (let attempt = 0; attempt < maxRepairs; attempt++) {
    const opts = {}
    if (pendingDegraded) opts.degraded = true
    if (tokenBudget != null) opts.maxTokens = tokenBudget
    pendingDegraded = false
    const out = await call(messages, Object.keys(opts).length ? opts : undefined)
    const text = typeof out?.text === 'string' ? out.text : ''
    const stopReason = out?.stopReason ?? null
    lastRaw = text

    if (stopReason === 'max_tokens') {
      // 被自己的 token 预算截断：这一段通常是半个 JSON，`extractJson` 必然失败。
      // 记成模型答错会把「预算太小」误诊成「能力不足」，且用同一预算再修 3 次也修不回来。
      kinds.push('truncated')
      const raised = tokenBudget == null ? null : Math.min(tokenBudget * 2, maxTokenCap)
      const bump = raised != null && raised > tokenBudget ? `，下次预算提到 ${raised}` : ''
      if (raised != null && raised > tokenBudget) tokenBudget = raised
      trail.push(
        `#${attempt + 1} 截断（stop_reason=max_tokens，${text.length} 字符）—— 是 token 预算不够，不是模型答错${bump}`
      )
      continue
    }

    if (!text.trim()) {
      // 空轮：什么都没产出 ⟹ 不往对话里加任何东西，原地重发同一请求。
      kinds.push('empty')
      if (emptyRetries < maxEmptyRetries) {
        emptyRetries++
        trail.push(`#${attempt + 1} ${EMPTY_TURN_MARK}，原地重发 ${emptyRetries}/${maxEmptyRetries}）`)
        attempt-- // 不消耗修复机会（仅重发次数受 maxEmptyRetries 约束）
        continue
      }
      // 重发**用尽仍空** ⟹ 重发已经证明无效（同一条件再问一遍），改条件：关掉 thinking 再来一次。
      if (degradedUsed < maxDegraded) {
        degradedUsed++
        pendingDegraded = true
        trail.push(`#${attempt + 1} ${EMPTY_TURN_MARK}，重发已用尽 → 降级（关 thinking）再试）`)
        attempt-- // 降级同样不消耗修复机会：它换的是条件，不是模型的答卷
        continue
      }
      // 两条退路都用尽后**不再原地打转**：把这一轮算作一次失败的尝试继续走（否则若中继系统性
      // 空轮，这里就变成了「无界重发」）。这样总调用数恰好被
      // MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES + MAX_DEGRADED_ATTEMPTS 夹住。
      trail.push(`#${attempt + 1} ${EMPTY_TURN_MARK}，重发与降级均已用尽）`)
      continue
    }

    // 到这里就是一次**真产出**：模型给了文本、也没被截断。此后失败就是它的责任。
    kinds.push('real')

    let candidate
    try {
      candidate = extractJson(text)
    } catch (err) {
      trail.push(`#${attempt + 1} 非 JSON（${err.message}）`)
      pushAssistant(messages, text)
      pushUserCorrection(messages, `That was not valid JSON (${err.message}). Respond with ONLY the JSON object.`)
      continue
    }
    // 把模型这轮产出记入对话（无论成败）——成功时保留它，后续纠正才有上下文。
    pushAssistant(messages, JSON.stringify(candidate))
    const res = validate(candidate)
    if (res.success) return res.data
    const issues = (res.issues ?? [])
      .slice(0, 8)
      .map((i) => `- [${(i.path ?? []).join('.') || '(root)'}] ${i.message}`)
      .join('\n')
    trail.push(`#${attempt + 1} schema 不过（${(res.issues ?? []).length} 处）`)
    pushUserCorrection(
      messages,
      `The config failed schema validation:\n${issues}\nFix these and respond with ONLY the corrected JSON object.`
    )
  }

  // 归因（见文件头注）：只要拿到过一次真产出，这就是一次**合法测量**——模型答错了。
  // 反之全是空轮/截断 ⟹ 这一行**没测到**，绝不能按 0 分计入成绩。
  const kind = kinds.includes('real')
    ? OUTCOME.MODEL_FAILURE
    : kinds.includes('truncated')
      ? OUTCOME.TRUNCATED
      : OUTCOME.NO_ANSWER
  const err = new Error(
    `could not obtain a schema-valid config after ${kinds.length} call(s) [${trail.join(' · ')}]. ` +
      `Last output (${lastRaw.length} chars):\n${lastRaw.slice(0, 400)}`
  )
  err.kind = kind
  err.calls = kinds.length
  err.attemptKinds = kinds
  throw err
}
