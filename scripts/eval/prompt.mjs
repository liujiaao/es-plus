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
 * 实测 180 例 heldout 里 61 例（33.9%）的 target/mode 在 NL 中**根本不存在**，
 * 于是精确命中率被算术锁死在 66.1% 上限，「≥95%」不可达。
 *
 * 规格掩码（`fixedFields`）早有先例：把契约已定的东西**给定**，只考核真正该推断的部分。
 * 本条把 target/mode 并入同一机制，与生产对齐。**注意这不会放水**：scorers 里 `target`/`mode`
 * 两个维度仍然比对 `gold` vs `pred`（scorers.mjs:279-280），所以「给了却不照抄」照旧翻红——
 * 该维度从「读心」变成「回抄保真度」，考核的仍是模型行为。
 */

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
