#!/usr/bin/env node
/**
 * 代码块渲染守卫 —— 渲染级断言，不是源码文本比对。
 *
 * 背景（P0-1）：
 *   主站的 markdown 渲染器让 markdown-it 的 `highlight` 回调返回了**整块**
 *   `<div class="code-block-wrapper">…</div>`。markdown-it 会把回调返回值塞进
 *   默认的 `<pre><code>`，产物因此是 `<pre><code><div …>…</div></code></pre>`；
 *   随后 Doc.vue 在 onMounted 里对 `pre code` 再跑一次 `hljs.highlightElement`，
 *   把注入的 wrapper 当成纯文本转义。线上表现：每个代码块正文都以
 *   「bash 复制 npm install …」开头，并留下 300–1000px 空白。
 *
 *   为什么此前的守卫没发现：`check:threeway` / `check:docs-layout` 之类只比对
 *   **源文件文本**；而这个缺陷只在「渲染后」才存在。所以本脚本直接调用站点
 *   同一份渲染器（es-plus-docs/src/utils/doc-markdown.mjs）产出 HTML 再断言。
 *
 * 断言：
 *   A. 构造语料：每个 fence 恰好一个 wrapper；`<code>` 内不出现 wrapper/header；
 *      代码文本与原文逐字一致（高亮只加标签，不改字符）。
 *   B. 容器（::: tip）与代码块互不误伤：围栏内的 `:::` 不被当成容器展开。
 *   C. 代码块内的 `href="/guide/x"` 不被站内链接改写（复制/阅读都应看到原文）。
 *   D. 真实语料：es-plus-docs/src/docs/*.md 全部渲染后，wrapper 数 == 复制按钮数，
 *      且不存在裸 `<pre><code>`（旧 bug 的指纹）。
 *   E. 源码约束：Doc.vue 不得再调用 highlightElement；站点不得另建 markdown-it。
 *
 * 用法：node scripts/check-code-fence.mjs
 * 退出码：0 = 通过；1 = 有断言失败。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { renderDocMarkdown } from '../es-plus-docs/src/utils/doc-markdown.mjs'

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

const WRAPPER_OPEN = '<div class="code-block-wrapper"'
const CODE_RE = /<pre class="hljs"><code[^>]*>([\s\S]*?)<\/code><\/pre>/g
const COPY_BTN = 'class="code-copy-btn"'

/** 把 HTML 片段还原成可见文本（去标签 + 解实体，顺序与浏览器一致） */
const htmlToText = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const count = (haystack, needle) => haystack.split(needle).length - 1
const extractCode = (html) => [...html.matchAll(CODE_RE)].map((m) => m[1])

/** 每个 fixture：markdown、期望 wrapper 数、必须包含的片段、期望的代码原文列表 */
const FIXTURES = [
  {
    name: '普通 ts fence',
    md: '```ts\nconst a: number = 1\n```',
    wrappers: 1,
    contains: ['language-ts', 'code-block-lang'],
    code: ['const a: number = 1\n'],
  },
  {
    name: '未知语言（退回转义，不丢字符）',
    md: '```no-such-lang\nhello <world> & "quotes"\n```',
    wrappers: 1,
    contains: ['no-such-lang'],
    code: ['hello <world> & "quotes"\n'],
  },
  {
    name: '文件名标题 title="..."',
    md: '```ts title="src/utils/a.ts"\nconst a = 1\n```',
    wrappers: 1,
    contains: ['code-block-title', 'src/utils/a.ts'],
    code: ['const a = 1\n'],
  },
  {
    name: '文件名标题 [..]（VitePress 习惯）',
    md: '```bash[package.json]\nnpm run build\n```',
    wrappers: 1,
    contains: ['code-block-title', 'package.json'],
    code: ['npm run build\n'],
  },
  {
    name: '容器里放 fence',
    md: '::: tip 注意\n正文\n\n```bash\nnpm i\n```\n:::',
    wrappers: 1,
    contains: ['custom-block tip', 'custom-block-title', 'npm i'],
    code: ['npm i\n'],
  },
  {
    name: 'fence 里的 ::: 不被当容器',
    md: '```md\n::: tip\nnot a container\n:::\n```',
    wrappers: 1,
    notContains: ['custom-block'],
    code: ['::: tip\nnot a container\n:::\n'],
  },
  {
    name: 'fence 里的站内链接不被改写',
    md: '```html\n<a href="/guide/usage">用法</a>\n```',
    wrappers: 1,
    notContains: ['href="#/guide/usage"', 'href=&#34;/guide'],
    code: ['<a href="/guide/usage">用法</a>\n'],
  },
  {
    name: 'vue fence（SFC 走 xml 高亮）',
    md: '```vue\n<template><div>{{ a }}</div></template>\n```',
    wrappers: 1,
    contains: ['language-vue'],
    code: ['<template><div>{{ a }}</div></template>\n'],
  },
  {
    name: '缩进代码块',
    md: '    缩进代码 = true',
    wrappers: 1,
    contains: ['code-copy-btn'],
    code: ['缩进代码 = true\n'],
  },
  {
    name: '连续两个 fence 各自成块',
    md: '```js\nlet a = 1\n```\n\n```js\nlet b = 2\n```',
    wrappers: 2,
    code: ['let a = 1\n', 'let b = 2\n'],
  },
]

function checkFixtures() {
  for (const fixture of FIXTURES) {
    const html = renderDocMarkdown(fixture.md)
    const wrappers = count(html, WRAPPER_OPEN)
    if (wrappers !== fixture.wrappers) {
      fail(`[${fixture.name}] wrapper 数应为 ${fixture.wrappers}，实际 ${wrappers}\n${html}`)
      continue
    }
    // 旧 bug 的指纹：wrapper 被塞进 <pre><code>，或代码里出现 wrapper 结构
    if (/<pre><code/.test(html)) {
      fail(`[${fixture.name}] 出现裸 <pre><code>（markdown-it 默认 fence 包裹）`)
      continue
    }
    if (count(html, COPY_BTN) !== fixture.wrappers) {
      fail(`[${fixture.name}] 复制按钮数 ${count(html, COPY_BTN)} ≠ wrapper 数 ${fixture.wrappers}`)
      continue
    }
    const missing = (fixture.contains || []).filter((s) => !html.includes(s))
    if (missing.length) {
      fail(`[${fixture.name}] 缺少片段：${missing.join(', ')}\n${html}`)
      continue
    }
    const forbidden = (fixture.notContains || []).filter((s) => html.includes(s))
    if (forbidden.length) {
      fail(`[${fixture.name}] 出现不该有的片段：${forbidden.join(', ')}\n${html}`)
      continue
    }
    if (fixture.code) {
      const texts = extractCode(html).map(htmlToText)
      const mismatch = fixture.code.find((want, i) => texts[i] !== want)
      if (mismatch !== undefined) {
        fail(
          `[${fixture.name}] 代码文本与原文不一致\n  期望：${JSON.stringify(fixture.code)}\n  实际：${JSON.stringify(texts)}`
        )
        continue
      }
    }
    ok(`fixture：${fixture.name}`)
  }
}

function checkCorpus() {
  const docsDir = join(ROOT, 'es-plus-docs', 'src', 'docs')
  if (!existsSync(docsDir)) {
    fail('找不到 es-plus-docs/src/docs')
    return
  }
  const files = readdirSync(docsDir).filter((f) => f.endsWith('.md'))
  if (!files.length) {
    fail('es-plus-docs/src/docs 下没有 .md 语料')
    return
  }
  let totalWrappers = 0
  for (const file of files) {
    const markdown = readFileSync(join(docsDir, file), 'utf-8')
    let html
    try {
      html = renderDocMarkdown(markdown)
    } catch (err) {
      fail(`${file} 渲染抛错：${err.message}`)
      continue
    }
    if (/<pre><code/.test(html)) {
      fail(`${file} 渲染后出现裸 <pre><code>（旧 bug 指纹）`)
      continue
    }
    const wrappers = count(html, WRAPPER_OPEN)
    const buttons = count(html, COPY_BTN)
    if (wrappers !== buttons) {
      fail(`${file} wrapper ${wrappers} 个，复制按钮 ${buttons} 个 — 结构不完整`)
      continue
    }
    // code 元素内部不允许出现 wrapper/header 结构（二次高亮的典型后果）
    const polluted = extractCode(html).filter((inner) => inner.includes('code-block'))
    if (polluted.length) {
      fail(`${file} 有 ${polluted.length} 个 <code> 内含代码块结构 — 疑似渲染后二次高亮`)
      continue
    }
    totalWrappers += wrappers
  }
  ok(`真实语料：${files.length} 篇文档，${totalWrappers} 个代码块结构完整`)
}

function checkSources() {
  const docVue = readFileSync(join(ROOT, 'es-plus-docs', 'src', 'views', 'Doc.vue'), 'utf-8')
  // 只看调用点（带括号），注释里提到函数名不算
  if (/hljs\.highlightElement\s*\(/.test(docVue)) {
    fail('Doc.vue 仍在调用 hljs.highlightElement —— 会把已渲染的代码块结构当文本转义')
  } else if (!/renderDocMarkdown/.test(docVue)) {
    fail('Doc.vue 没有使用 utils/doc-markdown.mjs 的 renderDocMarkdown（渲染器必须单一来源）')
  } else {
    ok('Doc.vue 使用单一渲染器且无渲染后二次高亮')
  }

  const viewsDir = join(ROOT, 'es-plus-docs', 'src')
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (/\.(vue|ts|js)$/.test(entry.name)) {
        const src = readFileSync(abs, 'utf-8')
        if (/new MarkdownIt/.test(src) && !abs.endsWith('doc-markdown.mjs')) {
          fail(`${abs.replace(ROOT, '')} 另建了 MarkdownIt 实例 —— 代码块结构会出现第二套实现`)
        }
      }
    }
  }
  walk(viewsDir)
}

console.log('检查代码块渲染…\n')
checkFixtures()
checkCorpus()
checkSources()

if (failed) {
  console.error('\n代码块渲染守卫失败')
  process.exit(1)
}
console.log(`\n✅ 代码块渲染守卫通过（${passed} 组断言）`)
