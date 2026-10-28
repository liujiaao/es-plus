#!/usr/bin/env node
/**
 * 内容页静态 HTML（路线图 3.1「每个内容页独立 HTML；深链 200；title 静态可见」）。
 *
 * 为什么这一步比「换成 history 路由」更值得先做：站点是 hash 路由，`/guide/x` 这种
 * 路径式地址在 GitHub Pages 上没有文件 —— 抓取器、AI 工具、聊天软件的预览卡片拿到的
 * 都是一个 404 页（或者被 404.html 改写跳走的地址）。而「换成 history 路由」要动的是
 * 整个应用的地基（三站互链、canonical、sitemap、404 兜底全要跟着改），收益却不比
 * 这一步大：**真正缺的是每个内容页有一份能被抓到的 HTML**，不是一个不同的 URL 方案。
 *
 * 所以：构建产物里给每篇指南 / 组件 / 高级用法各生成一份 `<path>/index.html`。
 * 它们是**静态阅读页**：正文由站点同一个渲染器 `utils/doc-markdown.mjs` 产出（不是
 * 第二份 markdown 实现），样式直接用构建出来的那几张 CSS，颜色主题沿用 index.html
 * 里那段防闪白的内联脚本。页面不加载应用 bundle —— 应用是 hash 路由，在这条路径上
 * 会渲染成首页，等于把静态正文当场覆盖掉。想用交互版（示例、搜索、目录高亮）就点
 * 页面顶部的「在应用中打开」，去 `/#/guide/x`。
 *
 * 与 canonical 的关系：这些页是内容页的**规范地址**（`…/es-plus/guide/x/`），
 * 所以 `utils/site-seo.js` 与 `utils/json-ld.ts` 对文章类路径也改用路径式地址。
 * 三处必须同口径：sitemap 列它、页面上 canonical 指它、结构化数据的 url 也是它。
 *
 * 用法：
 *   node scripts/gen-prerender.mjs            # 构建之后运行（写入 es-plus-docs/dist）
 *   node scripts/gen-prerender.mjs --check    # 只校验产物是否最新
 *
 * 退出码：0 = 成功/一致；1 = 源解析失败、产物缺失或已过期。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSiteModule } from './lib/site-module-loader.mjs'
import { docSummary, normalizeEol, renderApiPage } from './lib/docs-mirror.mjs'
import { readSiteBase } from './gen-sitemap.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
/** 构建产物目录（es-eui 的场景下没有它，这个脚本只对主站生效） */
const DIST = process.env.PRERENDER_DIST || join(ROOT, SITE, 'dist')

const fail = (msg) => {
  console.error(`❌ ${msg}`)
  process.exit(1)
}
const read = (path) => normalizeEol(readFileSync(path, 'utf-8'))

/**
 * 内容页的三种来源。`kind` 只用于生成时的分派与报错信息，不进产物。
 * 顺序即 `<head>` 之外的展示顺序（与侧栏一致：指南 → 组件 → 高级用法）。
 */
const ARTICLES = [
  { kind: 'guide', prefix: '/guide/', registry: `${SITE}/src/docs/doc-registry.ts`, exportName: 'docsData' },
  { kind: 'component', prefix: '/components/', registry: `${SITE}/src/views/component-doc.data.ts`, exportName: 'docsData' },
  { kind: 'advanced', prefix: '/advanced/', registry: `${SITE}/src/views/advanced-doc.data.ts`, exportName: 'docsData' },
]

/** 从构建出来的 index.html 里取「样式 + 主题脚本」：静态页必须和站内长得一样 */
function readTemplate() {
  const html = read(join(DIST, 'index.html'))
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0])
  if (!styles.length) fail(`${SITE}/dist/index.html 里没有 <link rel="stylesheet"> —— 先 vite build`)
  // 防闪白的内联脚本（localStorage / prefers-color-scheme → .dark）。没有它，深色
  // 用户打开静态页会看到一帧白底；这正是 index.html 当初加它的原因。
  const theme = html.match(/<script>\s*\(function \(\) \{[\s\S]*?<\/script>/)
  return { styles: styles.join('\n    '), theme: theme ? theme[0] : '' }
}

/** 每篇文章的正文与元信息（标题 / 描述都来自站点渲染用的同一份数据对象） */
async function readArticles() {
  const pages = []
  for (const article of ARTICLES) {
    const module = await loadSiteModule(article.registry, { site: SITE })
    const registry = module[article.exportName]
    if (!registry || typeof registry !== 'object') fail(`${article.registry} 没有导出 ${article.exportName}`)
    const entries = Object.entries(registry)
    if (!entries.length) fail(`${article.registry} 里没有任何条目（解析规则可能已失效）`)
    for (const [slug, data] of entries) {
      if (!data || !data.title) fail(`${article.kind} '${slug}' 没有标题`)
      pages.push({
        kind: article.kind,
        path: `${article.prefix}${slug}`,
        title: data.title,
        // 指南没有 description 字段：摘要取正文第一段，与 llms.txt 同一口径
        description: data.description || docSummary(data.content || '') || data.title,
        // 指南的正文是 markdown 原文；组件 / 高级用法是结构化数据，走 llms 镜像
        // 同一个 renderApiPage 把它渲染成 markdown（又是同一份实现，不是第二套）
        content: data.content || '',
        data,
      })
    }
  }
  return pages
}

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/**
 * 一页静态 HTML。
 *
 * 结构照抄 Doc.vue 的正文壳（`.doc-page` → `.doc-main` → `article.doc-content` →
 * `.markdown-content.es-doc-content`），这样 docs-content.css 里那套排版规则直接生效，
 * 不需要为静态页另写一份样式表 —— 另写一份就等于第二套排版，两边迟早不一样。
 */
function renderPage({ page, articleHtml, canonical, jsonLd, template, siteRoot }) {
  const appUrl = `${siteRoot}/#${page.path}`
  const title = `${page.title} · ES-Plus`
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(page.title)} · ES-Plus" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="robots" content="index,follow" />
    <!-- 由 scripts/gen-prerender.mjs 生成，请勿手改：正文来自 doc-markdown 同一实现 -->
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    ${template.theme}
    <style>
      /* 只补静态页需要的三条：站点外壳、提示条、页脚。正文排版全部来自构建产物 CSS。 */
      .prerender-shell { max-width: 1200px; margin: 0 auto; padding: 24px clamp(16px, 4vw, 48px); }
      .prerender-bar {
        display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
        padding: 12px 16px; margin-bottom: 24px; border: 1px solid var(--border-color-lighter, #e4e8ee);
        border-radius: 10px; background: var(--bg-color, #fff); font-size: 14px;
      }
      .prerender-bar a { color: var(--primary-color, #3b82f6); font-weight: 600; text-decoration: none; }
      .prerender-foot { margin: 40px 0 24px; font-size: 13px; color: var(--text-color-secondary, #8a919f); }
    </style>
    ${template.styles}
  </head>
  <body>
    <div class="prerender-shell">
      <nav class="prerender-bar" aria-label="站点导航">
        <span>${escapeHtml(page.title)}</span>
        <span><a href="${appUrl}">在应用中打开（示例、搜索、目录）→</a></span>
      </nav>
      <div class="doc-page es-doc-chrome">
        <div class="doc-main">
          <article class="doc-content">
            <div class="markdown-content es-doc-content">${articleHtml}</div>
          </article>
        </div>
      </div>
      <p class="prerender-foot">
        这是 <a href="${siteRoot}/">ES-Plus 文档</a>的无脚本可读版本；
        交互版见 <a href="${appUrl}">${appUrl}</a>。
      </p>
    </div>
  </body>
</html>
`
}

export async function build() {
  if (!existsSync(join(DIST, 'index.html'))) {
    fail(`${relative(ROOT, DIST)}/index.html 不存在 —— 先 vite build，再跑预渲染`)
  }
  const template = readTemplate()
  const { origin, base } = readSiteBase()
  const siteRoot = `${origin}${base}`

  // 渲染器与站点同一个实现：正文里少一行、多一层 wrapper，都会在产物里原样露出来
  const markdown = await loadSiteModule(`${SITE}/src/utils/doc-markdown.mjs`, { site: SITE })
  const renderDocMarkdown = markdown.renderDocMarkdown
  if (typeof renderDocMarkdown !== 'function') fail('doc-markdown.mjs 没有导出 renderDocMarkdown')

  // 结构化数据同样复用站点的 builder（json-ld.ts），不在这里另写一份
  const jsonLdModule = await loadSiteModule(`${SITE}/src/utils/json-ld.ts`, { site: SITE })

  const pages = await readArticles()
  const files = new Map()

  for (const page of pages) {
    const canonical = `${siteRoot}${page.path}/`
    // 组件 / 高级用法页没有 markdown 原文：先把结构化数据渲染成 markdown
    // （llms 镜像的同一个 renderApiPage），再去掉它给镜像用的 front matter ——
    // 那一段是 YAML 元信息，喂给 markdown-it 会变成一个 <hr> 和一行键值对
    const markdownSource = page.kind === 'guide'
      ? page.content
      : renderApiPage({ kind: page.kind, route: page.path, canonical, data: page.data })
        .replace(/^---\n[\s\S]*?\n---\n/, '')
    const articleHtml = renderDocMarkdown(markdownSource)
    if (!articleHtml || articleHtml.length < 200) {
      fail(`${page.path} 渲染出的正文只有 ${articleHtml ? articleHtml.length : 0} 字符 —— 静态页会是一张空壳`)
    }
    const jsonLd = jsonLdModule.techArticle({
      title: page.title,
      description: page.description,
      path: page.path,
      section: page.kind === 'component' ? 'components' : page.kind,
    })
    files.set(`${page.path.replace(/^\//, '')}/index.html`, renderPage({
      page,
      articleHtml,
      canonical,
      jsonLd,
      template,
      siteRoot,
    }))
  }

  return files
}

/** 产物里现有的静态页（用于 --check 发现「删了文档但产物还在」） */
function existingPages() {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'index.html') found.push(relative(DIST, full).replace(/\\/g, '/'))
    }
  }
  for (const article of ARTICLES) {
    const dir = join(DIST, article.prefix.replace(/^\//, ''))
    if (existsSync(dir)) walk(dir)
  }
  return found
}

async function main() {
  const CHECK = process.argv.includes('--check')
  const files = await build()

  if (CHECK) {
    const problems = []
    for (const [rel, content] of files) {
      const abs = join(DIST, rel)
      if (!existsSync(abs)) {
        problems.push(`${rel} 缺失 —— 运行 npm run prerender:gen（构建后）`)
        continue
      }
      if (read(abs) !== content) problems.push(`${rel} 与数据源不一致 —— 运行 npm run prerender:gen（不要手改）`)
    }
    const stale = existingPages().filter((rel) => !files.has(rel))
    for (const rel of stale) problems.push(`${rel} 对应的文档已经不存在了 —— 重新构建（vite build 会清空 dist）`)

    // sitemap 里每一条路径式地址都必须真有对应文件：sitemap 的 slug 来自正则解析、
    // 静态页来自模块真 import，两个来源一旦脱节，索引里就会出现一条 404 地址 ——
    // 而这正是上一版 sitemap 的毛病，不能因为换了生成器就没人看着。
    const sitemapPath = join(ROOT, SITE, 'public', 'sitemap.xml')
    if (existsSync(sitemapPath)) {
      const siteRoot = `${readSiteBase().origin}${readSiteBase().base}`
      for (const match of read(sitemapPath).matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const loc = match[1]
        if (!loc.startsWith(siteRoot)) continue
        // siteRoot 不带结尾斜杠：先剥掉 <loc> 里的那个前导 /
        const rest = loc.slice(siteRoot.length).replace(/^\//, '')
        if (!rest || rest.startsWith('#')) continue // 首页与 hash 式地址不归静态页管
        const rel = `${rest}index.html`
        if (!files.has(rel)) problems.push(`sitemap 里的 ${loc} 没有对应的静态页（${rel}）—— 那条地址在 Pages 上是 404`)
      }
    }

    if (problems.length) {
      for (const problem of problems) console.error(`❌ ${problem}`)
      process.exit(1)
    }
    console.log(`✅ 内容页静态 HTML 与数据源一致：${files.size} 页（title / canonical / JSON-LD / 正文同源）`)
    return
  }

  for (const [rel, content] of files) {
    const abs = join(DIST, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  console.log(`✅ 已生成 ${files.size} 个内容页静态 HTML（${relative(ROOT, DIST)}/{guide,components,advanced}/<slug>/index.html）`)
}

// main-guard：被守卫脚本 import 时不得写产物
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
