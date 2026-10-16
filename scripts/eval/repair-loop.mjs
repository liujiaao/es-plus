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
 *                     于是 `textOf` 拿到空串。换中继/换模型能解决，改语料解决不了。
 *   · `非 JSON`    —— 模型没按格式输出（prompt/温度问题）。
 *   · `schema 不过` —— **模型真的答错了**（能力缺口，语料/提示词问题）。
 *
 * 空轮还曾经**白白吃掉一次修复机会**：实测 `01-user-manage [zh]` 第 1 轮空轮、随后两轮
 * schema 不过 → 三次机会只剩两次，用例被判负；而单跑同一条用例一次就过 —— 瞬态被当成了
 * 能力缺口。故本模块把「空轮」单列：**原地重发同一请求**（什么都没产出 ⟹ 对话状态没变
 * ⟹ 重发是纯重试），不消耗 schema 修复机会，但有独立上限以防系统性空轮把这里挂死。
 */

/** schema/JSON 修复机会数（= 总尝试次数）。 */
export const MAX_REPAIR_ATTEMPTS = 3

/**
 * 空轮的原地重发上限。独立于修复机会，**总计调用数 ≤ MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES**。
 * 上限存在是为了让「中继系统性返回空轮」变成一个有界的失败，而不是挂到 CI 超时。
 */
export const MAX_EMPTY_RETRIES = 3

/** 空轮在诊断链里的标记（测试与产物断言共用同一串，改措辞会同时打红两处，这是刻意的）。 */
export const EMPTY_TURN_MARK = '空轮（无 text 块'

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
 * @param {object} o
 * @param {(messages: object[]) => Promise<string>} o.call 取模型这一轮的文本（可注入以单测）
 * @param {object[]} o.messages 就地追加（多轮精修要靠同一数组延续上下文）
 * @param {(candidate: object) => {success: boolean, data?: object, issues?: {path:string[], message:string}[]}} o.validate
 * @param {(messages: object[], text: string) => object} o.pushAssistant 见 ./prompt.mjs
 * @param {(messages: object[], text: string) => object} o.pushUserCorrection 见 ./prompt.mjs
 * @returns {Promise<object>} 通过校验的 config
 */
export async function driveToValidConfig({
  call,
  messages,
  validate,
  pushAssistant,
  pushUserCorrection,
  maxRepairs = MAX_REPAIR_ATTEMPTS,
  maxEmptyRetries = MAX_EMPTY_RETRIES,
}) {
  const trail = []
  let lastRaw = ''
  let emptyRetries = 0
  for (let attempt = 0; attempt < maxRepairs; attempt++) {
    const raw = await call(messages)
    lastRaw = raw
    if (!raw.trim()) {
      // 空轮：什么都没产出 ⟹ 不往对话里加任何东西，原地重发同一请求。
      if (emptyRetries < maxEmptyRetries) {
        emptyRetries++
        trail.push(`#${attempt + 1} ${EMPTY_TURN_MARK}，原地重发 ${emptyRetries}/${maxEmptyRetries}）`)
        attempt-- // 不消耗修复机会（仅重发次数受 maxEmptyRetries 约束）
        continue
      }
      // 重发用尽后**不再**原地打转：把这一轮算作一次失败的尝试继续走（否则若中继系统性空轮，
      // 这里就变成了「无界重发」）。这样总调用数恰好被 MAX_REPAIR_ATTEMPTS + MAX_EMPTY_RETRIES 夹住。
      trail.push(`#${attempt + 1} ${EMPTY_TURN_MARK}，重发已用尽）`)
      continue
    }
    let candidate
    try {
      candidate = extractJson(raw)
    } catch (err) {
      trail.push(`#${attempt + 1} 非 JSON（${err.message}）`)
      pushAssistant(messages, raw)
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
  throw new Error(
    `could not obtain a schema-valid config after ${trail.length} attempt(s) [${trail.join(' · ')}]. ` +
      `Last output (${lastRaw.length} chars):\n${lastRaw.slice(0, 400)}`
  )
}
