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
 * 判据只认**传输层**信号：SDK 的 `APIConnectionError`/`APIConnectionTimeoutError` 名字、
 * HTTP 429/5xx、以及无 status 时的网络错误关键字。绝不把 4xx（鉴权/参数错）当可重试 ——
 * 那会把「key 配错」拖成 4 小时的重试风暴。
 */
export function isTransientTransportError(err) {
  if (!err) return false
  const name = String(err.name ?? '')
  if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError') return true
  const status = err.status ?? err.statusCode
  if (typeof status === 'number' && (status === 429 || (status >= 500 && status <= 599))) return true
  if (typeof status === 'number') return false
  return /connection error|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test(
    String(err.message ?? '')
  )
}

/**
 * 对一个异步调用做**有界**传输重试（指数退避）。`sleep` 可注入，故单测零等待。
 *
 * 不重试非传输错误；重试用尽后**抛出最后一个错误**（上层照旧归因为「未测到」）。
 * @param {() => Promise<any>} fn
 * @param {{attempts?: number, baseDelayMs?: number, sleep?: (ms:number)=>Promise<void>, onRetry?: (err:Error, n:number)=>void}} [opts]
 */
export async function withTransportRetry(fn, opts = {}) {
  const { attempts = 5, baseDelayMs = 3000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onRetry } = opts
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isTransientTransportError(err) || i === attempts - 1) throw err
      onRetry?.(err, i + 1)
      await sleep(baseDelayMs * 2 ** i)
    }
  }
  throw lastErr
}

/**
 * 传输重试的**断路器**：把「中继整段不可用」与「偶发抖动」分开处置。
 *
 * 光有重试会把系统性故障变得更贵而不是更好：中继整段倒下时，每一行都要把整条退避阶梯
 * 走完（2026-10-22 的实况是连续 184 行失败），于是 4 小时的跑批变成 6 小时，最后还是
 * 一份作废的产物。反过来，偶发抖动恰恰是重试唯一能救的场景。
 *
 * 判据用**连续**耗尽次数：连续 `tripAfter` 个逻辑调用连重试都用尽 ⟹ 大概率是整段不可用，
 * 后续调用改成一击即走（`attempts = 1`，不睡不退避）；任何一次成功立刻复位。
 * 用「连续」而不是「累计」，是因为抖动是散点、故障是连片 —— 累计计数会被散点误触发，
 * 而误触发只会让一次本可救回的调用少几次重试，方向安全（不会把答错记成没测到）。
 *
 * @param {{tripAfter?: number, attempts?: number}} [opts]
 */
export function createTransportRetryGate({ tripAfter = 3, attempts = 5 } = {}) {
  let streak = 0
  return {
    /** 本次调用该给几次尝试。 */
    attemptsFor: () => (streak >= tripAfter ? 1 : attempts),
    /** 调用（含重试）最终成功 ⟹ 中继是通的，复位。 */
    recordSuccess: () => {
      streak = 0
    },
    /** 调用彻底失败 ⟹ 只有**传输层**失败才计入连败（4xx 是配置错，不是中继抖）。 */
    recordFailure: (err) => {
      streak = isTransientTransportError(err) ? streak + 1 : 0
    },
    /** 当前连续耗尽次数（诊断/日志用）。 */
    get streak() {
      return streak
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
