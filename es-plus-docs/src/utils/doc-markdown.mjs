/**
 * 文档 Markdown 渲染 —— 单一实现。
 *
 * 为什么单独成模块：
 *   1. **可测**。此前渲染器长在 Doc.vue 的 `<script setup>` 里，守卫脚本只能
 *      用正则扫源码文本 —— 扫不出「fence 回调返回整块 HTML、markdown-it 又把它
 *      塞进 `<pre><code>`」这类只在渲染后才暴露的缺陷。抽成纯函数后，
 *      `scripts/check-code-fence.mjs` 可以直接渲染语料做断言。
 *   2. **只允许一份**。站点里任何一个页面另起一份 markdown-it 实例，都会重新
 *      长出一套代码块结构；守卫盯住这里就够。
 *
 * 代码块的正确做法（P0-1 的根因）：
 *   markdown-it 的 `highlight` 回调**只应返回高亮的 HTML 片段**，外层的
 *   `<pre><code>` 由默认 fence 规则负责。旧实现让回调返回了整块
 *   `<div class="code-block-wrapper">…</div>`，于是产物变成
 *   `<pre><code><div …>…</div></code></pre>`；随后 onMounted 里对 `pre code`
 *   跑 `hljs.highlightElement`，把注入的 wrapper 当纯文本转义 —— 线上每个代码块
 *   的正文都从 “bash 复制” 开始，并留下几百像素空白。
 *
 *   这里改为接管 `fence` / `code_block` 规则本身：回调直接产出 wrapper，
 *   高亮只产出 `<code>` 内部的内容，且**不再有渲染后的二次高亮**。
 */

import MarkdownIt from 'markdown-it'
// 高亮器只注册文档用到的语言（含 ```vue → xml）—— 见 utils/highlight.mjs 的说明：
// 直接 import 全集入口会让这一块从 ~55KB gz 涨到 311KB gz，而文档只用得上 11 种语言。
import hljs from './highlight.mjs'
import { parseFenceInfo, renderCodeBlockHtml } from './code-block.js'
import { rewriteInternalDocLinks } from './doc-links.js'

/** VitePress 风格容器（markdown-it 原生不支持） */
const CONTAINER_LABELS = {
  tip: '提示',
  warning: '警告',
  info: '信息',
  danger: '危险',
}
const CONTAINER_TYPES = new Set(Object.keys(CONTAINER_LABELS))
const CONTAINER_OPEN = /^:::[ \t]*(tip|warning|info|danger)[ \t]*(.*)$/
const CONTAINER_CLOSE = /^:::[ \t]*$/
const FENCE_OPEN = /^[ \t]{0,3}(`{3,}|~{3,})/

/** 高亮一段代码，只返回 `<code>` 内部应有的 HTML */
export function highlightCode(raw, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value
    } catch {
      /* 高亮失败就退回转义，不能把原文渲染成 HTML */
    }
  }
  return ''
}

/**
 * 生成一个代码块（wrapper + header + pre/code）。
 *
 * 结构与行为都在 `utils/code-block.js`（三站共用，`scripts/sync-theme.mjs` 分发）：
 * 语言标签、文件名、复制、折叠、行号、高亮行只有一份实现。这里只负责接上
 * highlight.js —— 三站里只有主站装了它。
 *
 * 复制按钮不带 data-* 副本：点击时从 DOM 的 `<code>` 读 textContent 即可，
 * 既避免大段代码在属性里再存一份，也不会有转义/还原不一致的问题。
 */
export function renderCodeBlock(md, raw, info) {
  const { lang, title, highlightLines } = parseFenceInfo(info)
  return renderCodeBlockHtml({
    raw,
    highlighted: highlightCode(raw, lang),
    lang,
    title,
    highlightLines,
  })
}

/**
 * 展开 `::: tip` 容器。
 *
 * 用逐行扫描而不是正则：正则会连**代码块内部**的 `:::` 一起展开（文档里
 * 讲容器语法的示例首当其冲）。扫描时跟踪 fence 状态，围栏内一律原样保留。
 */
export function expandContainers(md, markdown) {
  const lines = String(markdown || '').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(FENCE_OPEN)
    if (fence) {
      // 原样收进整个围栏块（含开闭行），不在其中识别容器
      const marker = fence[1]
      const closeRe = new RegExp(`^${marker[0]}{${marker.length},}\\s*$`)
      out.push(line)
      i += 1
      while (i < lines.length) {
        out.push(lines[i])
        const closes = closeRe.test(lines[i].trim())
        i += 1
        if (closes) break
      }
      continue
    }

    const open = line.match(CONTAINER_OPEN)
    if (!open || !CONTAINER_TYPES.has(open[1])) {
      out.push(line)
      i += 1
      continue
    }

    const type = open[1]
    const heading = open[2].trim() || CONTAINER_LABELS[type]
    const body = []
    i += 1
    let closed = false
    while (i < lines.length) {
      if (CONTAINER_CLOSE.test(lines[i])) {
        closed = true
        i += 1
        break
      }
      body.push(lines[i])
      i += 1
    }
    // 没有闭合标记就退回原样，避免把余下全文吞进容器
    if (!closed) {
      out.push(line, ...body)
      continue
    }
    const inner = md.render(body.join('\n').trim())
    out.push(
      `<div class="custom-block ${type}">`,
      `<p class="custom-block-title">${md.utils.escapeHtml(heading)}</p>`,
      inner,
      '</div>'
    )
  }
  return out.join('\n')
}

/** 给 h2/h3 加稳定 id；同名小节按出现次序加 -2、-3 后缀 */
export function addHeadingIds(html) {
  const seen = new Map()
  return html.replace(/<h([23])>(.*?)<\/h[23]>/g, (_match, level, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim()
    const base = text.toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '') || 'section'
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    const id = n === 1 ? base : `${base}-${n}`
    return `<h${level} id="${id}">${content}</h${level}>`
  })
}

/** 创建渲染器（每次调用独立实例，避免守卫脚本与站点共享可变状态） */
export function createDocMarkdown() {
  const md = new MarkdownIt({
    html: true,
    linkify: false,
    typographer: true,
  })
  md.renderer.rules.fence = (tokens, idx) => renderCodeBlock(md, tokens[idx].content, tokens[idx].info)
  // 缩进代码块（无 info 串）走同一个 wrapper，否则站点里会混出两种代码块外观
  md.renderer.rules.code_block = (tokens, idx) => renderCodeBlock(md, tokens[idx].content, '')
  return md
}

/**
 * 文档正文 → 可挂载的 HTML。Doc.vue 与守卫脚本共用这一条流水线。
 * @param {string} markdown
 * @returns {string}
 */
export function renderDocMarkdown(markdown) {
  const md = createDocMarkdown()
  // <demo name="x" /> 先替换成占位 div，挂载时机由视图层决定
  const preprocessed = String(markdown || '')
    .replace(/<demo\s+name="([^"]+)"\s*\/>/g, '\n<div class="demo-block-placeholder" data-demo-name="$1"></div>\n')
    .replace(/<demo\s+name="([^"]+)"\s*>\s*<\/demo>/g, '\n<div class="demo-block-placeholder" data-demo-name="$1"></div>\n')

  const withContainers = expandContainers(md, preprocessed)
  const html = md.render(withContainers)
  const withIds = addHeadingIds(html)
  // hash 路由：把 .md 里的站内绝对链接 /guide/xxx 改写为 #/guide/xxx
  return rewriteInternalDocLinks(withIds)
}
