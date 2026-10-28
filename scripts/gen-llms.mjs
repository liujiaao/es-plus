#!/usr/bin/env node
/**
 * `llms.txt` + 每页 `.md` 镜像（路线图 Wave 3 · 3.4）。
 *
 * 为什么一个中后台组件库的文档站要做这件事：我们的用户不是「翻文档的人」，而是
 * 「让 AI 读文档再写代码的人」。SPA 文档站对这种用法是**最坏形状** —— HTML 里只有
 * 一个 `<div id="app">`，正文在 bundle 里，模型抓到的是一张空壳。所以每页都出一份
 * 纯 markdown 镜像，并在根目录放 `llms.txt` 索引（llmstxt.org 的口径：H1 + 引用块
 * 摘要 + 分节链接列表）。AI 工具只读一个文件就能知道「这个库有哪些文档、每篇讲什么」。
 *
 * 三条设计约束，都是被这套仓库踩过的坑：
 *
 *   1. **镜像不是第二真源**。指南页镜像 = 源 markdown 原文 + front matter，正文一个
 *      字节都不改；组件页镜像 = 把 `component-doc.data.ts` 里那张表**渲染**出来
 *      （数据对象是编译后真 import 的，不是正则抠的 —— 见 lib/site-module-loader.mjs）。
 *      人手改镜像会在 `check:llms` 里立刻变红：门禁重新生成一遍再逐字节比对。
 *
 *   2. **索引里的每个字都有出处**。摘要取自该篇正文的第一段（指南）或数据对象的
 *      `description`（组件/高级用法），站点标题与定位取自 `docs/brand/slogan.json`。
 *      没有一处是人手另写的第二份描述 —— 正文改了摘要跟着改，不会出现「索引说 A、进去是 B」。
 *
 *   3. **产物确定**。不写时间戳、不排序随机、不读 git（`lastmod` 那种「每天变一次」
 *      的字段对读者是噪音，也会让门禁每天红一次）。
 *
 * 用法：
 *   node scripts/gen-llms.mjs           # 生成 es-plus-docs/public/{llms.txt, md/**}
 *   node scripts/gen-llms.mjs --check   # 只校验产物是否最新
 *
 * 退出码：0 = 成功/一致；1 = 源解析失败或产物过期。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSiteModule } from './lib/site-module-loader.mjs'
import { docSummary, normalizeEol, renderApiPage, renderGuide } from './lib/docs-mirror.mjs'
import { parsePageMeta, parseRoutes } from './lib/page-meta-parse.mjs'
import { readSiteBase } from './gen-sitemap.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
const PUBLIC = join(ROOT, SITE, 'public')
const INDEX = join(PUBLIC, 'llms.txt')

// 页面上「不需要浏览器也能读」的静态资源：JSON Schema 与 AI 工具清单。
// 逐个读文件里的 title/description，不在本脚本里另写一句说明。
const DATA_ASSETS = [
  'schemas/es-form.schema.json',
  'schemas/es-table-columns.schema.json',
  'schemas/es-table-data.schema.json',
  'ai/ai-tools.schema.json',
  'ai/feature-coverage.schema.json',
]

const toLF = (text) => normalizeEol(text)
const read = (path) => toLF(readFileSync(path, 'utf-8'))

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

/**
 * 全部产物：相对 `public/` 的路径 → 内容。
 *
 * 返回 Map 而不是直接写盘，是为了让门禁能「重新算一遍再比对」——
 * 否则校验的是「生成器的输出」而不是「仓库里的文件」，人手改过的镜像照样绿。
 */
export async function buildAll() {
  const slogan = JSON.parse(read(join(ROOT, 'docs/brand/slogan.json')))

  const guides = await loadSiteModule(`${SITE}/src/docs/doc-registry.ts`, { site: SITE })
  const components = await loadSiteModule(`${SITE}/src/views/component-doc.data.ts`, { site: SITE })
  const advanced = await loadSiteModule(`${SITE}/src/views/advanced-doc.data.ts`, { site: SITE })

  const guideEntries = guides.GUIDE_SLUGS ?? Object.keys(guides.docsData)
  if (guideEntries.length === 0) fail('doc-registry.ts 里没有解析到任何指南 slug')
  if (Object.keys(components.docsData).length === 0) fail('component-doc.data.ts 里没有解析到任何组件')
  if (Object.keys(advanced.docsData).length === 0) fail('advanced-doc.data.ts 里没有解析到任何高级用法页')

  // 站点基准（origin + 部署路径）与 sitemap / 三站切换器同源
  const { origin, base } = readSiteBase()
  const siteRoot = `${origin}${base}`
  /** 页面地址：hash 路由的可打开形式，与 gen-sitemap.mjs 的口径一致 */
  const pageUrl = (route) => `${siteRoot}/#${route}`
  /**
   * 文章页的规范地址：构建期有静态 HTML（scripts/gen-prerender.mjs），
   * 所以是路径式且带结尾斜杠 —— 与 canonical、JSON-LD、sitemap 同一口径。
   */
  const articleUrl = (route) => `${siteRoot}${route}/`
  /** 镜像地址 */
  const mirrorUrl = (rel) => `${siteRoot}/${rel}`

  const files = new Map()

  // ── 指南：源 markdown 原文 + front matter ────────────────────────────────
  const guideItems = []
  for (const slug of guideEntries) {
    const entry = guides.docsData[slug]
    if (!entry) fail(`GUIDE_SLUGS 里的 '${slug}' 在 docsData 里没有条目`)
    const source = `${SITE}/src/docs/${slug}.md`
    // front matter 里的 source 是给读者回查的地址，指向不存在的文件等于骗人
    if (!existsSync(join(ROOT, source))) {
      fail(`指南 '${slug}' 的源文件不在 ${source}（镜像的 front matter 会指向不存在的文件）`)
    }
    const route = `/guide/${slug}`
    const rel = `md/guide/${slug}.md`
    files.set(
      rel,
      renderGuide({
        title: entry.title,
        route,
        canonical: articleUrl(route),
        source,
        body: entry.content,
      }),
    )
    guideItems.push({ title: entry.title, url: mirrorUrl(rel), desc: docSummary(entry.content) })

    // 英文正文是同一个 slug 的第二语言版本（doc-registry 的 contentEn），不是独立路由
    if (entry.titleEn && entry.contentEn) {
      const enRel = `md/guide/${slug}.en.md`
      const enSource = `${SITE}/src/docs/${slug}.en.md`
      files.set(
        enRel,
        renderGuide({
          title: entry.titleEn,
          route,
          canonical: articleUrl(route),
          source: enSource,
          body: entry.contentEn,
        }),
      )
      guideItems.push({
        title: `${entry.titleEn} (English)`,
        url: mirrorUrl(enRel),
        desc: docSummary(entry.contentEn),
      })
    }
  }

  // ── 组件 / 高级用法：由站点渲染用的同一份数据对象渲染 ─────────────────────
  const componentItems = []
  for (const [slug, data] of Object.entries(components.docsData)) {
    const route = `/components/${slug}`
    const rel = `md/components/${slug}.md`
    files.set(rel, renderApiPage({ kind: 'component', route, canonical: articleUrl(route), data }))
    componentItems.push({ title: data.title, url: mirrorUrl(rel), desc: data.description })
  }

  const advancedItems = []
  for (const [slug, data] of Object.entries(advanced.docsData)) {
    const route = `/advanced/${slug}`
    const rel = `md/advanced/${slug}.md`
    files.set(rel, renderApiPage({ kind: 'advanced', route, canonical: articleUrl(route), data }))
    advancedItems.push({ title: data.title, url: mirrorUrl(rel), desc: data.description })
  }

  // ── 站点页面：路由表 ∩ PAGE_META（需要浏览器渲染的那些）───────────────────
  const router = read(join(ROOT, SITE, 'src/router/index.ts'))
  const pageMeta = parsePageMeta(read(join(ROOT, SITE, 'src/utils/page-meta.ts')))
  const pageItems = []
  for (const route of parseRoutes(router)) {
    // 通配路由（`/:pathMatch(.*)*`）不是页面，是一个 404 处理器 —— 把它的路径当地址
    // 写进索引，读者点开就是 404（第一版真的生成过 `#/:pathMatch(.*)*` 这一条）。
    if (route.path.includes(':') || route.path.includes('*')) continue
    const meta = pageMeta.get(route.name)
    if (!meta) continue // home 与动态页不在这里：它们要么已有 md 镜像，要么不该被索引
    pageItems.push({
      title: meta.title,
      url: pageUrl(route.path),
      desc: meta.description,
    })
  }

  // ── 机器可读资源：直接读文件里的 title/description ────────────────────────
  const assetItems = []
  for (const rel of DATA_ASSETS) {
    const abs = join(PUBLIC, rel)
    if (!existsSync(abs)) fail(`机器可读资源缺失：public/${rel}（先跑对应的 sync 脚本）`)
    const doc = JSON.parse(readFileSync(abs, 'utf-8'))
    const title = doc.title ?? basename(rel)
    const desc = doc.description ?? ''
    assetItems.push({ title, url: mirrorUrl(rel), desc: desc.split('. ')[0] })
  }

  // ── llms.txt ─────────────────────────────────────────────────────────────
  const section = (heading, items) => [
    `## ${heading}`,
    '',
    ...items.map((item) => `- [${item.title}](${item.url}): ${item.desc || '—'}`),
    '',
  ]
  const index = [
    `# ${slogan.name}`,
    '',
    `> ${slogan.positioning}：${slogan.slogan.subtitle}。`,
    '',
    '本站每篇文档都有 Markdown 镜像（下面各节直接指向镜像原文），首页与交互页仍是浏览器页面。',
    '镜像与站点由同一份源生成：指南是原文，组件页是从文档数据渲染出的 API 表 —— 不会出现「索引里一段、页面里另一段」。',
    '',
    ...section('指南', guideItems),
    ...section('组件', componentItems),
    ...section('高级用法', advancedItems),
    ...section('站点页面（需要浏览器）', pageItems),
    ...section('机器可读资源', assetItems),
  ]
  files.set('llms.txt', index.join('\n'))

  return { files, siteRoot }
}

/** 把产物里 public/ 下所有 `md/**` 与 llms.txt 找出来（孤儿清扫用） */
export function existingMirrors() {
  const found = []
  if (existsSync(INDEX)) found.push('llms.txt')
  const mdRoot = join(PUBLIC, 'md')
  if (!existsSync(mdRoot)) return found
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const rel = `${prefix}/${name.name}`
      if (name.isDirectory()) walk(join(dir, name.name), rel)
      else found.push(rel)
    }
  }
  walk(mdRoot, 'md')
  return found
}

/**
 * 仓库里的产物与「现在重新生成一遍」的差异 —— 返回问题列表（空数组即最新）。
 *
 * 导出给 check-llms.mjs：门禁要校验的必须是**磁盘上的文件**，而不是生成器的输出。
 * 只跑生成器再宣布「绿」的话，人手改过的镜像照样通过。
 */
export function compareWithDisk(files) {
  const problems = []
  for (const [rel, content] of files) {
    const abs = join(PUBLIC, rel)
    if (!existsSync(abs)) {
      problems.push(`public/${rel} 缺失（运行 npm run llms:gen）`)
      continue
    }
    if (toLF(readFileSync(abs, 'utf-8')) !== content) {
      problems.push(`public/${rel} 与源不一致（人手改过，或改了文档没重跑生成）—— 运行 npm run llms:gen`)
    }
  }
  for (const rel of existingMirrors()) {
    if (!files.has(rel)) {
      problems.push(`public/${rel} 不在生成结果里（页面已删除？）—— 运行 npm run llms:gen 清理`)
    }
  }
  return problems
}

async function main() {
  const CHECK = process.argv.includes('--check')
  const { files } = await buildAll()

  if (CHECK) {
    const problems = compareWithDisk(files)
    for (const problem of problems) console.error(`❌ ${problem}`)
    if (problems.length > 0) process.exit(1)
    console.log(`✅ llms 产物最新：llms.txt + ${files.size - 1} 个 .md 镜像`)
    return
  }

  // 先删掉旧镜像目录：条目被删掉时不能留下孤儿文件（孤儿 = 搜索引擎/AI 仍能读到已下线的页）
  for (const rel of existingMirrors()) {
    if (!files.has(rel)) rmSync(join(PUBLIC, rel), { force: true })
  }
  for (const [rel, content] of files) {
    const abs = join(PUBLIC, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  console.log(`✅ 已生成 public/llms.txt + ${files.size - 1} 个 .md 镜像`)
}

// main-guard：被 check-llms.mjs import 时不得覆写产物
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
