/**
 * 代码块契约（三站共用，无框架依赖）
 *
 * 单一权威源：`docs/theme/code-block.js` → `scripts/sync-theme.mjs` 分发到
 * es-plus-docs / es-pc / es-eui 的 `src/utils/code-block.js`，禁止手改各站点副本。
 *
 * ## 为什么共享
 *
 * 路线图 1.6「代码块统一」要的是一套 chrome：**语言标签 / 文件名 / 复制 / 折叠 /
 * 行号 / 高亮行**。此前三站各写一遍 —— 主站只有 lang + 复制；es-pc 是「查看代码」
 * 开关 + 裸 `<pre>`；es-eui 有复制但没有语言标签与折叠。同一个代码块在三站长三个样，
 * 而它们演示的是同一批组件。
 *
 * ## 分工
 *
 *   · `renderCodeBlockHtml()` 产出**结构**（header + pre/code + 每行一个 span），
 *     主站的 markdown 渲染器与两站的 `v-html` 都用它；
 *   · `enhanceCodeBlocks()` 接管**行为**（复制 / 折叠），事件委托绑在容器上，
 *     渲染结果整个换掉也不用重绑；
 *   · 外观在 `docs/theme/docs-content.css` 的「代码块」段（同样三站共用）。
 *
 * ## 为什么不在这里做语法高亮
 *
 * 只有主站装了 highlight.js。高亮 HTML 由调用方传进来（`highlighted`），本模块只
 * 负责按行切分并保证标签闭合；另外两站拿到的是转义后的纯文本 —— chrome 完全一致，
 * 差别只在 token 着色。这与路线图 1.6 的口径一致：统一的是代码块的外壳，
 * 不是给两站各装一份 120 KB 的高亮库。
 */

/** 超过这么多行才给「展开 / 折叠」按钮（与 CSS 的 480px 上限同量级）。 */
export const CODE_COLLAPSE_LINES = 20

/** 折叠态的最大高度（px）—— 与 docs-content.css 的 `max-height` 必须一致。 */
export const CODE_MAX_HEIGHT = 480

/**
 * HTML 转义（文本与属性共用一套最小集合）。
 *
 * `"` 必须转：标题会进 `title="…"`，不转就会提前闭合属性。
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 解析行高亮范围：`{1,3-5}` → Set{1,3,4,5}。
 *
 * 只认 VitePress 那种写法（大括号里全是数字、逗号与连字符）。解析不出来就返回空集，
 * 不抛错 —— 一个写错的 info 串不该让整篇文档渲染失败。
 */
export function parseHighlightLines(spec) {
  const out = new Set()
  for (const part of String(spec ?? '').split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) continue
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) out.add(i)
  }
  return out
}

/**
 * 解析 fence 的 info 串：
 *   ```ts                      → { lang: 'ts',  title: '' }
 *   ```ts title="src/a.ts"     → { lang: 'ts',  title: 'src/a.ts' }
 *   ```ts[src/a.ts]            → { lang: 'ts',  title: 'src/a.ts' }   (VitePress 习惯)
 *   ```ts{1,3-5}               → { lang: 'ts',  title: '', highlightLines: Set{1,3,4,5} }
 *
 * 顺序自由：标题属性、方括号标题、行高亮大括号可以同时出现。
 */
export function parseFenceInfo(info) {
  const raw = String(info ?? '').trim()
  if (!raw) return { lang: '', title: '', highlightLines: new Set() }
  const hl = raw.match(/\{([\d,\s-]+)\}/)
  // 先把行高亮段摘掉：`ts{1,3}` 里的 `{1,3}` 不能被当成语言名的一部分
  const rest = raw.replace(/\{[\d,\s-]+\}/g, ' ').trim()
  const titleAttr = rest.match(/\btitle="([^"]*)"/)
  const bracket = rest.match(/\[([^\]]+)\]/)
  const title = (titleAttr && titleAttr[1]) || (bracket && bracket[1]) || ''
  const lang = (rest.split(/\s+/)[0] || '').replace(/\[.*$/, '').toLowerCase()
  return { lang, title, highlightLines: parseHighlightLines(hl && hl[1]) }
}

/**
 * 没写语言时猜一个（```` ``` ```` 与 es-pc / es-eui 传进来的整段源码都会走到这里）。
 *
 * 只做「一眼可辨」的几类，猜错就把语言标签显示成 text —— 比显示一个错的语言名诚实。
 */
export function inferLang(code) {
  const src = String(code ?? '').trim()
  if (!src) return 'text'
  if (/^<template[\s>]/.test(src)) return 'vue'
  if (/^<script\b/.test(src) && /<\/template>/.test(src)) return 'vue'
  if (/^[{[]/.test(src)) {
    try {
      JSON.parse(src)
      return 'json'
    } catch {
      /* 不是 JSON，继续往下猜 */
    }
  }
  if (/^(npm|pnpm|yarn|npx|node|git|cd|mkdir|curl)\b/m.test(src)) return 'bash'
  if (/^(import|export)\s/m.test(src)) return 'js'
  if (/^<(html|div|span|a|p|section|ul|table)\b/m.test(src)) return 'html'
  if (/^[.#@]?[\w-]+[\s,.:>][^{}]*\{/m.test(src)) return 'css'
  return 'text'
}

/**
 * 把一段高亮后的 HTML 按行切开，给每行补 `code-line` 包装。
 *
 * 难点在**跨行标签**：highlight.js 会把一段多行字符串包在同一个 `<span class="hljs-string">`
 * 里。直接按 `\n` split 会让第二行起丢失外层 span 的样式、并在末尾留下未闭合标签。
 * 这里维护一个打开标签栈：遇到换行先补齐 `</span>`，新行再把它们原样重开。
 *
 * 返回数组（不含结尾空行，行尾换行由调用方补）。
 */
export function splitHighlightedLines(html) {
  const lines = []
  const open = []
  let current = ''
  const closeOpen = () => {
    for (let i = open.length - 1; i >= 0; i -= 1) current += '</span>'
  }
  const reopen = () => {
    for (const tag of open) current += tag
  }
  const source = String(html ?? '').replace(/\r\n?/g, '\n')
  const tokenRe = /<span\b[^>]*>|<\/span>|[^<]+/g
  let match
  while ((match = tokenRe.exec(source)) !== null) {
    const token = match[0]
    if (token === '</span>') {
      open.pop()
      current += token
    } else if (token.startsWith('<span')) {
      open.push(token)
      current += token
    } else {
      const parts = token.split('\n')
      for (let i = 0; i < parts.length; i += 1) {
        if (i > 0) {
          closeOpen()
          lines.push(current)
          current = ''
          reopen()
        }
        current += parts[i]
      }
    }
  }
  closeOpen()
  lines.push(current)
  // fence 正文以换行结尾：最后一定多出一个空行，去掉它（行尾换行在后面补）
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** 高亮行参数可以是 Set / 数组 / `{1,3-5}` 字符串 / 空 —— 统一成 Set。 */
function normalizeHighlightLines(value) {
  if (!value) return new Set()
  if (value instanceof Set) return value
  if (Array.isArray(value)) return new Set(value.map(Number).filter((n) => Number.isFinite(n) && n > 0))
  return parseHighlightLines(String(value))
}

/**
 * 代码块 HTML（结构单一来源）。
 *
 * @param {object} options
 * @param {string} [options.raw]        原始代码（无高亮时由本函数转义；也用于行数）
 * @param {string} [options.highlighted] 已经高亮的 HTML（只允许是 `<code>` 内部内容）
 * @param {string} [options.lang]        语言标签（小写展示）；空则 text
 * @param {string} [options.title]       文件名 / 标题
 * @param {Set|number[]|string} [options.highlightLines] 高亮行
 * @param {boolean|'auto'} [options.collapsible] 'auto' = 超过 CODE_COLLAPSE_LINES 行才折叠
 * @returns {string}
 */
export function renderCodeBlockHtml(options = {}) {
  const {
    raw = '',
    highlighted = '',
    lang = '',
    title = '',
    highlightLines = null,
    collapsible = 'auto',
  } = options

  const langLabel = (lang || 'text').toLowerCase()
  const hlSet = normalizeHighlightLines(highlightLines)
  const codeHtml = highlighted || escapeHtml(raw)
  const lines = splitHighlightedLines(codeHtml)
  const total = lines.length

  const body = lines
    .map((line, i) => {
      const n = i + 1
      const cls = hlSet.has(n) ? 'code-line is-highlighted' : 'code-line'
      return `<span class="${cls}" data-line="${n}">${line}</span>`
    })
    .join('\n')

  const shouldCollapse = collapsible === 'auto' ? total > CODE_COLLAPSE_LINES : Boolean(collapsible)
  const wrapperClass = `code-block-wrapper${shouldCollapse ? ' is-collapsible' : ''}`
  const titleHtml = title
    ? `\n      <span class="code-block-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>`
    : ''
  const collapseBtn = shouldCollapse
    ? `
        <button class="code-collapse-btn" type="button" aria-expanded="false" aria-label="展开代码">
          <span class="collapse-text">展开</span>
          <span class="collapse-caret" aria-hidden="true"></span>
        </button>`
    : ''

  return `<div class="${wrapperClass}" data-lang="${escapeHtml(langLabel)}" data-lines="${total}">
    <div class="code-block-header">
      <span class="code-block-lang">${escapeHtml(langLabel)}</span>${titleHtml}
      <div class="code-block-actions">${collapseBtn}
        <button class="code-copy-btn" type="button" aria-label="复制代码">
          <span class="copy-icon" aria-hidden="true"></span>
          <span class="copy-text">复制</span>
        </button>
      </div>
    </div>
    <pre class="hljs"><code class="language-${escapeHtml(langLabel)}">${body}
</code></pre>
  </div>`
}

// ── 行为：复制 / 折叠（事件委托，渲染结果换掉也不用重绑） ─────────────────────

const BOUND_ROOTS = new WeakSet()

/** 剪贴板写入：优先 Clipboard API，非安全上下文（http 内网）降级到 execCommand。 */
async function writeClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* 降级 */
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** 复制按钮：文本直接从 DOM 的 `<code>` 取（高亮只加标签、不改字符）。 */
async function handleCopy(btn) {
  const wrapper = btn.closest('.code-block-wrapper')
  const code = wrapper ? wrapper.querySelector('code') : null
  const ok = await writeClipboard(code ? code.textContent : '')
  const text = btn.querySelector('.copy-text')
  if (!text) return
  const original = text.dataset.label || text.textContent || '复制'
  text.dataset.label = original
  text.textContent = ok ? '已复制' : '复制失败'
  btn.classList.toggle('copied', ok)
  const owner = btn
  window.setTimeout(() => {
    // 期间可能又点了一次：只回滚仍是「已复制 / 复制失败」的那个状态
    if (text.textContent === '已复制' || text.textContent === '复制失败') text.textContent = original
    owner.classList.remove('copied')
  }, 1500)
}

/** 折叠按钮：切 `is-expanded`（CSS 用它解除 480px 上限）。 */
function handleCollapse(btn) {
  const wrapper = btn.closest('.code-block-wrapper')
  if (!wrapper) return
  const expanded = wrapper.classList.toggle('is-expanded')
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  btn.setAttribute('aria-label', expanded ? '折叠代码' : '展开代码')
  const text = btn.querySelector('.collapse-text')
  if (text) text.textContent = expanded ? '折叠' : '展开'
}

function bindDelegation(root) {
  if (BOUND_ROOTS.has(root)) return
  BOUND_ROOTS.add(root)
  root.addEventListener('click', (event) => {
    const target = event.target
    if (!target || typeof target.closest !== 'function') return
    const copyBtn = target.closest('.code-copy-btn')
    if (copyBtn) {
      event.preventDefault()
      void handleCopy(copyBtn)
      return
    }
    const collapseBtn = target.closest('.code-collapse-btn')
    if (collapseBtn) {
      event.preventDefault()
      handleCollapse(collapseBtn)
    }
  })
}

/**
 * 补行 span —— 只有「调用方没走 renderCodeBlockHtml」时才会发生（例如手写 `<pre v-html>`）。
 * 已渲染的行 span 一律不动：那是高亮器产出的结构，重排会把 token 边界打散。
 */
function ensureLineSpans(code) {
  if (code.querySelector('.code-line')) return
  const text = String(code.textContent ?? '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  code.innerHTML =
    lines.map((line, i) => `<span class="code-line" data-line="${i + 1}">${escapeHtml(line)}</span>`).join('\n') + '\n'
}

/**
 * 给页面里的代码块接上行为（幂等：已接过的 wrapper 带 `data-code-ready`）。
 *
 * @param {ParentNode} root 一般是正文容器（`.markdown-content` / 组件根节点）
 * @returns {number} 本次接上的代码块数量
 */
export function enhanceCodeBlocks(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0
  bindDelegation(root)
  const wrappers = root.querySelectorAll('.code-block-wrapper:not([data-code-ready])')
  let count = 0
  for (const wrapper of wrappers) {
    const code = wrapper.querySelector('pre code')
    if (!code) continue
    ensureLineSpans(code)
    const total = code.querySelectorAll('.code-line').length
    wrapper.setAttribute('data-lines', String(total))
    // 没有 header（裸 wrapper）就不补 chrome —— 那说明它不是这两个渲染器产出的结构，
    // 硬塞一个语言标签只会猜错语言。
    if (!wrapper.querySelector('.code-block-header') && total > 0) {
      wrapper.setAttribute('data-code-bare', '')
    }
    wrapper.setAttribute('data-code-ready', '')
    count += 1
  }
  return count
}
