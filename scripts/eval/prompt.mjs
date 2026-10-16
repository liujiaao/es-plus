#!/usr/bin/env node
/**
 * eval 的 prompt 组装（纯函数、无 SDK、可无 key 单测）。
 *
 * 从 eval-llm.mjs 抽出，理由同 ./scorers.mjs：eval-llm.mjs 在模块顶层就 `main()`，
 * 一 import 就跑真钱跑批，所以任何要单测的组装逻辑必须住在这里。
 *
 * ## 为什么有「给定输入」（F9）
 *
 * 生产流程里 `target` / `mode` **不是模型要猜的东西**，是宿主输入：
 *   - schema 给二者配了默认值（`mode:'schema'` / `target:'vue3'`，structured-config.schema.ts:522-523）；
 *   - 前门 `crudShape` 把它们作**显式入参**（generate-crud.ts:64/68）；
 *   - `INSTRUCTIONS` 明说「Detect the target FIRST」→ 即 `detect_project_target` 的产物。
 *
 * 但旧版 eval 只喂 NL，却要求产出含 target/mode 的完整 config —— 等于让模型猜宿主输入。
 * 实测（F8 补登记后的 heldout = 164 例）两法独立收敛到 ≈1/3：口径 A（gold 非默认维 ∩ NL 无信号）
 * 60 例、口径 B（`pinnedDims` 断言该维 ∩ NL 无信号，语料自证）58 例。其中 58 例**两条腿全断**
 * （turn-0 scoped 恒假，且全库仅 5/164 带 refinements）→ `definition95` 被算术锁死在 **64.6%** 上限。
 *
 * ⚠️ 注意锁的是 **`definition95`（scoped 腿）与 `exactIntentFull`（观测）**，**不是**门禁指标
 * `exactIntentCore` —— 后者只含 prop/attr/actions/tableBtns 四维（scorers.mjs:469），不含 target/mode。
 *
 * 规格掩码（`fixedFields`）早有先例：把契约已定的东西**给定**，只考核真正该推断的部分。
 * 本条把 target/mode 并入同一机制，与生产对齐。**注意这不会放水**：scorers 里 `target`/`mode`
 * 两个维度仍然比对 `gold` vs `pred`（scorers.mjs:279-280），所以「给了却不照抄」照旧翻红——
 * 该维度从「读心」变成「回抄保真度」，考核的仍是模型行为。
 */

/**
 * 把模型的这一轮回灌进对话（**就地** push 到 `messages`）。
 *
 * ## 为什么需要这个函数（2026-10-16 试京东云网关时撞到）
 *
 * `thinking: {type:'adaptive'}` 下，模型**可能产出只有 thinking 块、没有 text 块**的一轮，
 * 此时 `textOf` 返回空串。若把空串原样推回，下一次请求就带上一个 **空的 text block** ——
 * 宽松实现（PPIO / api.anthropic.com）默默放行，严格的实现直接
 * `400 messages: text content blocks must be non-empty`
 * （实测死在 `02-product-remote-select.json [en]`）。
 *
 * 这是**我们自己的假设漏洞**（「模型一定有 text」从未被检验过），不是中继的毛病 ——
 * 所以修在我们这边：用显式标记代替空串，既不撒谎（不假装模型说了话）也不留空块。
 *
 * 住在 prompt.mjs 而非 eval-llm.mjs，理由同本文件头注：eval-llm.mjs 一 import 就跑真钱跑批，
 * 组装/回灌逻辑必须能在这里被无 key 单测钉住（见 prompt.test.mjs 第 7 节）。
 *
 * @param {{role:string, content:unknown}[]} messages 就地 push
 * @param {string} text 模型这轮的文本（可能为空串）
 * @returns {object} push 进去的那条消息（便于断言）
 */
export function pushAssistant(messages, text) {
  const msg = {
    role: 'assistant',
    content:
      typeof text === 'string' && text.trim()
        ? text
        : '(no text block produced — the previous turn contained only reasoning)',
  }
  messages.push(msg)
  return msg
}

/**
 * 推入一条「用户纠正」轮（B3 精修 / 自修复共用）。
 * 同样不许留空串 —— handler 侧的 `Error.message` 或 correction 理论上可能为空。
 */
export function pushUserCorrection(messages, text) {
  const msg = {
    role: 'user',
    content: typeof text === 'string' && text.trim() ? text : '(empty correction)',
  }
  messages.push(msg)
  return msg
}

/** 渲染「宿主给定」行；无 given 或无有效字段时返回空串（保持旧 prompt 逐字节不变）。 */
export function buildGivenLine(given) {
  if (!given || typeof given !== 'object') return ''
  const parts = []
  for (const key of ['target', 'mode']) {
    if (typeof given[key] === 'string' && given[key]) parts.push(`${key}=${given[key]}`)
  }
  if (!parts.length) return ''
  return (
    `Host context (given — the host already decided these; emit them EXACTLY as stated, ` +
    `do NOT infer or override them from the description): ${parts.join(', ')}`
  )
}

/**
 * 构造初始对话。B2：标了 fixedFields 时把它们喂给模型（从「猜字段」变「给定字段」）。
 * F9：given = 宿主给定的顶层输入（target/mode），同样明示。
 */
export function buildInitialMessages(nl, fixedFields, given) {
  const blocks = [nl]
  const givenLine = buildGivenLine(given)
  if (givenLine) blocks.push(givenLine)
  if (Array.isArray(fixedFields) && fixedFields.length) {
    blocks.push(
      `Fields (given — use EXACTLY these props; infer each field's formtype / membership / actions / layout): ${fixedFields.join(', ')}`
    )
  }
  return [{ role: 'user', content: blocks.join('\n\n') }]
}
