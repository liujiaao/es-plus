/**
 * FAQ 页 → `FAQPage` 结构化数据（路线图 3.2 的最后一小块：FAQ FAQPage）。
 *
 * 为什么单独一个模块：同一份解析要跑在**两个地方** —— 浏览器里（Doc.vue 给当前页写
 * JSON-LD）与构建期（scripts/gen-prerender.mjs 给静态页写同一段 JSON-LD）。各写一份
 * 的表现是两处答案不一致，而没有任何人会发现：页面上看到的和搜索引擎拿到的是两套话。
 *
 * ## 约定（写 FAQ 时请遵守，`npm run check:site-seo` 会断言）
 *
 * - `###` 是**一个问题**，`##` 是分组标题（不是问题）；
 * - 问题的答案 = 到下一个 `##` / `###` 之前的所有正文；
 * - 答案里不要放代码块或表格：结构化数据只要纯文本，格式化内容在这里会被压成一行。
 *
 * ## 为什么只挑出 `###`
 *
 * 把 `##` 也当问题会让「安装与依赖」这种分组标题变成一条 Question —— 它在 schema.org
 * 眼里是一个没法回答的问题，Google 会把它连同整条 FAQPage 一起判为不合格。宁少不滥。
 */

/** 哪些 slug 是 FAQ 集合页。只放真正「一问一答」的页面，别为了多点结构化数据硬凑 */
export const FAQ_SLUGS = ['faq']

/** 该 slug 是不是 FAQ 集合页 */
export function isFaqSlug(slug) {
  return FAQ_SLUGS.includes(String(slug || ''))
}

/**
 * 去掉行内 markdown，得到结构化数据能用的纯文本。
 *
 * 顺序要紧：链接先于粗体（链接文字里可能带 `**`），图片先于链接（`![a](b)` 是图片）。
 */
function plainText(markdown) {
  return String(markdown)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s（(])\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|[\s（(])_([^_\n]+)_/g, '$1$2')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 从 FAQ 页的 markdown 原文里取出 `[{ question, answer }]`。
 * 没有答案的问题会被丢掉 —— 一条 acceptedAnswer 为空会让整页被结构化数据测试判不合格。
 *
 * @param {string} markdown
 * @returns {{ question: string, answer: string }[]}
 */
export function parseFaq(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
  const entries = []
  let current = null
  let buffer = []

  const flush = () => {
    if (!current) return
    const answer = plainText(buffer.join('\n'))
    if (answer) entries.push({ question: current, answer })
    current = null
    buffer = []
  }

  for (const line of lines) {
    const h3 = line.match(/^###[ \t]+(.+?)[ \t]*#*[ \t]*$/)
    if (h3) {
      flush()
      current = plainText(h3[1])
      continue
    }
    // 更高的标题（分组 / 文档标题）终止当前问题，但不自己成为问题
    if (/^#{1,2}[ \t]+/.test(line)) {
      flush()
      continue
    }
    if (current) buffer.push(line)
  }
  flush()

  return entries.filter((entry) => entry.question && entry.answer)
}
