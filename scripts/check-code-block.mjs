#!/usr/bin/env node
/**
 * 代码块契约守卫（路线图 1.6「代码块统一」）。
 *
 * ## 为什么要守卫
 *
 * 三站此前各有一套代码块：主站是 markdown fence（语言标签 + 复制），es-pc 是
 * 「查看代码」开关 + 裸 `<pre>`，es-eui 有复制但长在卡片头部、没有语言标签与行号。
 * 统一之后，结构/行为只有 `docs/theme/code-block.js` 一份（sync-theme 分发到三站），
 * 外观只有 docs-content.css 一段 —— 本脚本盯的就是这三件事不能被悄悄拆回去：
 *
 *   A. **单源**：docs/theme/code-block.js 与三站副本逐字节一致（行尾归一后比对）。
 *   B. **渲染不变量**：直接调用站点使用的那份实现，断言 wrapper / 语言标签 / 复制 /
 *      折叠 / 行号 / 高亮行 / 转义 / 行切分后的文本一致性。这些只在「渲染后」才成立，
 *      扫源码文本看不出来（与 check-code-fence 同一方法论）。
 *   C. **接线**：三个代码块入口（主站 markdown + 两站示例卡片 + 主站示例卡片）
 *      必须 import 这份实现并调用 enhanceCodeBlocks；站点里不许再出现第二份
 *      `code-copy-btn` 结构或二次 hljs.highlightElement。
 *   D. **样式契约**：docs-content.css 必须包含行号 / 高亮行 / 折叠三组选择器，
 *      且折叠高度与 CODE_MAX_HEIGHT 一致（两边各写一个数字迟早会飘）。
 *
 * 用法：node scripts/check-code-block.mjs
 * 退出码：0 = 通过；1 = 有断言失败。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readText, sameText } from './lib/text-sync.mjs'
import {
  CODE_COLLAPSE_LINES,
  CODE_MAX_HEIGHT,
  enhanceCodeBlocks,
  inferLang,
  parseFenceInfo,
  parseHighlightLines,
  renderCodeBlockHtml,
  splitHighlightedLines,
} from '../es-plus-docs/src/utils/code-block.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
let passed = 0
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const ok = (msg) => {
  passed += 1
  console.log(`✅ ${msg}`)
}

const count = (haystack, needle) => haystack.split(needle).length - 1
const SITE_COPIES = ['es-plus-docs', 'es-pc', 'es-eui'].map((s) => `${s}/src/utils/code-block.js`)

/** 把 `renderCodeBlockHtml` 产出的 HTML 还原成可见文本（与浏览器 textContent 同序）。 */
const codeText = (html) => {
  const m = html.match(/<pre class="hljs"><code[^>]*>([\s\S]*?)<\/code><\/pre>/)
  if (!m) return null
  return m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

// ── A. 单源 ────────────────────────────────────────────────────────────────
function checkSingleSource() {
  const source = join(ROOT, 'docs', 'theme', 'code-block.js')
  if (!existsSync(source)) {
    fail('单源缺失：docs/theme/code-block.js')
    return
  }
  const src = readText(source)
  for (const rel of SITE_COPIES) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      fail(`站点副本缺失：${rel}（运行 npm run theme:sync）`)
      continue
    }
    if (!sameText(readFileSync(abs, 'utf8'), src)) {
      fail(`${rel} 与单源不一致 —— 运行 npm run theme:sync，不要手改副本`)
    }
  }
  if (!failed) ok(`单源 + ${SITE_COPIES.length} 份站点副本逐字节一致`)
}

// ── B. 渲染不变量 ──────────────────────────────────────────────────────────
function checkRender() {
  // 1) 基本结构：语言标签 + 复制按钮 + 每行一个 span + 文本零损失
  const raw = 'const a = 1\nconst b = 2\nconst c = 3'
  const html = renderCodeBlockHtml({ raw, lang: 'ts', title: 'src/a.ts' })
  const checks = [
    [count(html, '<div class="code-block-wrapper'), 1, 'wrapper 数为 1'],
    [html.includes('<span class="code-block-lang">ts</span>'), true, '语言标签为 ts'],
    [html.includes('class="code-block-title"'), true, '渲染文件名'],
    [html.includes('class="code-copy-btn"'), true, '有复制按钮'],
    [count(html, 'class="code-line'), 3, '行 span 数 = 代码行数'],
    [codeText(html), `${raw}\n`, '代码文本零损失（含行尾换行）'],
    [html.includes('is-collapsible'), false, '短代码块不给折叠按钮'],
  ]
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) fail(`渲染不变量：${label}（期望 ${expected}，实际 ${actual}）`)
  }

  // 2) 行高亮
  const hl = renderCodeBlockHtml({ raw, lang: 'ts', highlightLines: [2] })
  const highlighted = count(hl, 'code-line is-highlighted')
  if (highlighted !== 1) fail(`行高亮：应恰好 1 行高亮，实际 ${highlighted}`)
  if (!hl.includes('<span class="code-line is-highlighted" data-line="2">')) {
    fail('行高亮：高亮的不是第 2 行')
  }

  // 3) 长代码块折叠（阈值两侧各验一次，防止 off-by-one）
  const mk = (n) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')
  const short = renderCodeBlockHtml({ raw: mk(CODE_COLLAPSE_LINES), lang: 'text' })
  const long = renderCodeBlockHtml({ raw: mk(CODE_COLLAPSE_LINES + 1), lang: 'text' })
  if (short.includes('is-collapsible')) fail(`折叠阈值：${CODE_COLLAPSE_LINES} 行不该折叠`)
  if (!long.includes('is-collapsible') || !long.includes('code-collapse-btn')) {
    fail(`折叠阈值：${CODE_COLLAPSE_LINES + 1} 行应折叠并给按钮`)
  }
  if (!long.includes(`data-lines="${CODE_COLLAPSE_LINES + 1}"`)) fail('折叠阈值：data-lines 记录的行数不对')
  const optOut = renderCodeBlockHtml({ raw: mk(CODE_COLLAPSE_LINES + 1), lang: 'text', collapsible: false })
  if (optOut.includes('code-collapse-btn')) fail('collapsible:false 时不应出现折叠按钮（示例卡片由外层开关负责）')

  // 4) 转义：标题/语言进属性，不能把标记语言带进去
  const evil = renderCodeBlockHtml({ raw: 'x', lang: 'ts', title: '<b>"a"</b>' })
  if (evil.includes('<b>')) fail('转义：文件名的尖括号进了 HTML')
  if (!evil.includes('&lt;b&gt;&quot;a&quot;&lt;/b&gt;')) fail('转义：文件名没有按属性/文本规则转义')

  // 5) 跨行高亮切分：多行字符串共用一个 span 时，每行必须自成闭合
  const split = splitHighlightedLines('<span class="hljs-string">a\nb\nc</span>')
  if (split.length !== 3) fail(`行切分：应为 3 行，实际 ${split.length}`)
  for (const [i, line] of split.entries()) {
    if (count(line, '<span') !== count(line, '</span>')) fail(`行切分：第 ${i + 1} 行标签不闭合 — ${line}`)
  }
  const back = split.join('\n').replace(/<[^>]+>/g, '')
  if (back !== 'a\nb\nc') fail(`行切分：文本被改动 — ${JSON.stringify(back)}`)

  // 6) fence info：语言 / 标题 / 行高亮可以并存
  const info = parseFenceInfo('ts{1,3-5} title="a.ts"')
  if (info.lang !== 'ts') fail(`fence info：语言应为 ts，实际 ${info.lang}`)
  if (info.title !== 'a.ts') fail(`fence info：标题应为 a.ts，实际 ${info.title}`)
  if ([...info.highlightLines].join(',') !== '1,3,4,5') {
    fail(`fence info：高亮行应为 1,3,4,5，实际 ${[...info.highlightLines].join(',')}`)
  }
  const sorted = (set) => [...set].sort((a, b) => a - b).join(',')
  if (sorted(parseHighlightLines('2-4')) !== '2,3,4') fail('行范围解析错误（2-4）')
  if (sorted(parseHighlightLines('3,1')) !== '1,3') fail('行范围解析错误（逗号列表）')

  // 7) 语言推断
  const inferred = [
    ['<template><div /></template>', 'vue'],
    ['{"a":1}', 'json'],
    ['npm install @es-plus/vue3', 'bash'],
    ['随便一段中文', 'text'],
  ]
  for (const [input, want] of inferred) {
    const got = inferLang(input)
    if (got !== want) fail(`语言推断：${JSON.stringify(input)} 应为 ${want}，实际 ${got}`)
  }

  // 8) enhanceCodeBlocks 对非 DOM 入参不抛错（SSR / 测试环境会传 null）
  if (enhanceCodeBlocks(null) !== 0) fail('enhanceCodeBlocks(null) 应返回 0 而不是抛错')

  if (!failed) ok('渲染不变量 8 组（结构 / 高亮行 / 折叠阈值 / 转义 / 行切分 / info / 推断 / 空入参）')
}

// ── C. 接线 ────────────────────────────────────────────────────────────────
/** 每个代码块入口：必须用共享实现渲染 + 接上行为。 */
const ENTRYPOINTS = [
  { file: 'es-plus-docs/src/utils/doc-markdown.mjs', needs: ['renderCodeBlockHtml'], label: '主站 markdown fence' },
  { file: 'es-plus-docs/src/views/Doc.vue', needs: ['enhanceCodeBlocks'], label: '主站指南正文' },
  { file: 'es-plus-docs/src/components/doc/CodePlayground.vue', needs: ['renderCodeBlockHtml', 'enhanceCodeBlocks'], label: '主站示例卡片' },
  { file: 'es-pc/src/components/CodeDemo.vue', needs: ['renderCodeBlockHtml', 'enhanceCodeBlocks'], label: 'es-pc 示例卡片' },
  { file: 'es-eui/src/components/CodePlayground.vue', needs: ['renderCodeBlockHtml', 'enhanceCodeBlocks'], label: 'es-eui 示例卡片' },
]

function checkWiring() {
  for (const { file, needs, label } of ENTRYPOINTS) {
    const abs = join(ROOT, file)
    if (!existsSync(abs)) {
      fail(`${label}：缺少 ${file}`)
      continue
    }
    const text = readText(abs)
    if (!/from '@\/utils\/code-block(?:\.js)?'|from '\.\/code-block\.js'/.test(text)) {
      fail(`${label}：${file} 没有从共享实现 import（代码块结构会出现第二套）`)
      continue
    }
    for (const symbol of needs) {
      if (!new RegExp(`\\b${symbol}\\s*\\(`).test(text)) fail(`${label}：${file} 没有调用 ${symbol}()`)
    }
  }

  // 站点里不许再有第二份「复制按钮」结构：结构只允许由 code-block.js 产出
  const vueFiles = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // 目录不存在就跳过（各站结构不完全一样），不中断整个守卫
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (/\.(vue|ts|js|mjs)$/.test(entry.name) && !abs.endsWith('code-block.js')) vueFiles.push(abs)
    }
  }
  for (const site of ['es-plus-docs', 'es-pc', 'es-eui']) walk(join(ROOT, site, 'src'))
  for (const abs of vueFiles) {
    const text = readFileSync(abs, 'utf8')
    if (text.includes('code-copy-btn')) {
      fail(`${abs.replace(ROOT + '\\', '').replace(/\\/g, '/')} 里手写了 code-copy-btn —— 结构只允许来自 utils/code-block.js`)
    }
    // P0-1 的回归指纹：渲染后再跑一遍高亮，会把已注入的结构当文本转义
    if (/hljs\.highlightElement\s*\(/.test(text)) {
      fail(`${abs.replace(ROOT + '\\', '').replace(/\\/g, '/')} 调用了 hljs.highlightElement —— 渲染后二次高亮会打碎代码块结构`)
    }
  }

  if (!failed) ok(`接线：${ENTRYPOINTS.length} 个入口全部走共享实现，站点内无第二份结构`)
}

// ── D. 样式契约 ────────────────────────────────────────────────────────────
function checkStyles() {
  const css = readText(join(ROOT, 'docs', 'theme', 'docs-content.css'))
  // 选择器不挂 .es-doc-content：代码块是自包含组件（示例卡片在自定义容器里）
  const required = [
    ['.code-line {', '行号（.code-line）'],
    ['.code-line.is-highlighted', '高亮行'],
    ['.code-collapse-btn', '折叠按钮'],
    ['.code-block-wrapper.is-expanded pre', '展开后解除高度上限'],
  ]
  for (const [needle, label] of required) {
    if (!css.includes(needle)) fail(`样式契约：docs-content.css 缺少${label}`)
  }
  if (!new RegExp(`max-height:\\s*${CODE_MAX_HEIGHT}px`).test(css)) {
    fail(`样式契约：折叠高度应等于 CODE_MAX_HEIGHT（${CODE_MAX_HEIGHT}px）`)
  }
  if (!failed) ok('样式契约：行号 / 高亮行 / 折叠 / 高度一致')
}

console.log('检查代码块契约（路线图 1.6）…\n')
checkSingleSource()
checkRender()
checkWiring()
checkStyles()

if (failed) {
  console.error('\n代码块契约守卫失败')
  process.exit(1)
}
console.log(`\n✅ 代码块契约守卫通过（${passed} 组断言）`)
