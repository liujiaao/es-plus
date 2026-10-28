#!/usr/bin/env node
/**
 * 主站 sitemap 生成。
 *
 * 背景：此前由 vite-plugin-sitemap 按手写的 19 条路径列表产出，而站点是 **hash 路由** ——
 * `https://…/es-plus/guide/getting-started` 在 GitHub Pages 上根本没有对应文件，抽三条
 * 去请求全是 404（其余同构，也一样）。一份「多数条目打不开」的 sitemap 比没有更糟：
 * 搜索引擎会先拿到 404，再降低整个站的抓取配额。
 *
 * 现在的口径：
 *   1. **文章类页面输出路径式地址**（`…/es-plus/guide/x/`）：构建期给每篇生成了
 *      静态 HTML（scripts/gen-prerender.mjs），那份 HTML 就是这一页的规范地址，
 *      与 canonical / JSON-LD 同口径；
 *   2. 其余页面（营销页、工具页、案例详情）仍输出 hash 形式（`…/es-plus/#/quickstart`），
 *      因为它们只有前端渲染这一种打开方式；
 *   3. 条目从**真实注册表**推导，不再手抄：路由表给出静态页，doc-registry /
 *      component-doc / advanced-doc / AI 案例 registry 给出参数页的每个 slug；
 *   4. 不写 lastmod —— 每次构建都把当天日期写进去等于让 sitemap 每天变一次，
 *      对「哪页真的更新过」是噪音。
 *
 * 用法：
 *   node scripts/gen-sitemap.mjs           # 生成 es-plus-docs/public/sitemap.xml
 *   node scripts/gen-sitemap.mjs --check   # 校验产物是否最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 源文件解析失败或产物过期。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
const TARGET = join(ROOT, SITE, 'public', 'sitemap.xml')

// 规范域名不在这里写死：vite.config.ts 的 SITE_HOSTNAME 是站点自报地址的单一来源
// （三站切换器 check-site-nav.mjs 读的是同一个常量）。换域名时只改那一处。
const VITE_CONFIG = `${SITE}/vite.config.ts`

const toLF = (text) => text.replace(/\r\n?/g, '\n')
const read = (p) => toLF(readText(join(ROOT, p)))
const fail = (msg) => {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

/**
 * 从 `export const X: ... = {` 开始的字面量对象里取顶层 key（2 空格缩进）。
 * 导出给 check-nav-coverage.mjs 复用：导航的 slug 校验与 sitemap 的条目生成
 * 必须读同一份解析规则，否则一边认得了的 slug、另一边认不得。
 */
export function objectKeys(src, exportName) {
  const start = src.indexOf(`export const ${exportName}`)
  if (start === -1) return []
  const rest = src.slice(start)
  const end = rest.indexOf('\n}\n')
  const body = end === -1 ? rest : rest.slice(0, end)
  const keys = new Set()
  // 键可能带单引号（TS 数据文件）或双引号（生成的 JSON 风格 registry）
  const re = /^ {2}["']?([A-Za-z0-9-]+)["']?: \{/gm
  let m
  while ((m = re.exec(body))) keys.add(m[1])
  return [...keys]
}

/** 路由表里的静态路径（跳过根、通配、参数路由） */
function staticRoutes(src) {
  const paths = new Set()
  const re = /path: '([^']*)'/g
  let m
  while ((m = re.exec(src))) {
    const p = m[1]
    // 根路径单独输出成不带 hash 的规范地址（`…/es-plus/`），不重复产出 `#/`
    if (!p || p === '/' || p.includes(':') || p.includes('*')) continue
    paths.add(p.startsWith('/') ? p : `/${p}`)
  }
  return [...paths]
}

/**
 * 站点基准地址（origin + 部署路径）—— 从 `SITE_HOSTNAME` 解析而来。
 * 导出给 gen-llms.mjs 复用：`llms.txt` 里的绝对地址必须与 sitemap 同一套基准，
 * 否则两边各解析一遍站点域名，换域名时会漏改一处。
 */
export function readSiteBase() {
  const m = read(VITE_CONFIG).match(/SITE_HOSTNAME\s*=\s*'([^']+)'/)
  if (!m) fail(`未能在 ${VITE_CONFIG} 定位 SITE_HOSTNAME`)
  const url = new URL(m[1])
  return { origin: url.origin, base: url.pathname.replace(/\/$/, '') }
}

export function build() {
  const { origin, base } = readSiteBase()
  const router = read(`${SITE}/src/router/index.ts`)
  const guides = objectKeys(read(`${SITE}/src/docs/doc-meta.ts`), 'DOC_META')
  const components = objectKeys(read(`${SITE}/src/views/component-doc.data.ts`), 'docsData')
  const advanced = objectKeys(read(`${SITE}/src/views/advanced-doc.data.ts`), 'docsData')
  const cases = objectKeys(read(`${SITE}/src/cases/generated/registry.js`), 'AI_CASES')

  // 解析出 0 条就意味着正则与源码结构脱节 —— 悄悄产出空 sitemap 是最坏的结果
  if (!guides.length) fail('doc-registry.ts 里没解析到任何指南 slug')
  if (!components.length) fail('component-doc.data.ts 里没解析到任何组件 slug')
  if (!advanced.length) fail('advanced-doc.data.ts 里没解析到任何高级页 slug')
  if (!cases.length) fail('AI 案例 registry 里没解析到任何案例 id')

  const urls = []
  const add = (hashPath) => urls.push(`${origin}${base}/${hashPath ? `#${hashPath}` : ''}`)
  // 文章类页面在构建期有一份真 HTML（scripts/gen-prerender.mjs），规范地址是路径式。
  // 与 site-seo.js / json-ld.ts 的 ARTICLE_PREFIXES 同口径，三处不一致时
  // sitemap、canonical、结构化数据会各说各的地址。
  const addPage = (pagePath) => urls.push(`${origin}${base}${pagePath}/`)

  add('')
  for (const p of staticRoutes(router).sort()) add(p)
  for (const slug of guides.sort()) addPage(`/guide/${slug}`)
  for (const slug of components.sort()) addPage(`/components/${slug}`)
  for (const slug of advanced.sort()) addPage(`/advanced/${slug}`)
  for (const id of cases.sort()) add(`/ai-gallery/${id}`)

  const unique = [...new Set(urls)]
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- 由 scripts/gen-sitemap.mjs 生成，请勿手改：条目来自路由表与各注册表 -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...unique.map((u) => `  <url><loc>${u}</loc></url>`),
    '</urlset>',
    '',
  ]
  return lines.join('\n')
}

function main() {
  const content = build()
  const CHECK = process.argv.includes('--check')
  if (CHECK) {
    if (!existsSync(TARGET)) fail('es-plus-docs/public/sitemap.xml 缺失（运行 npm run sitemap:gen）')
    if (!sameText(readText(TARGET), content)) {
      fail('sitemap.xml 与路由表/注册表不一致 —— 运行 npm run sitemap:gen（不要手改）')
    }
    const count = (content.match(/<loc>/g) || []).length
    console.log(`✅ sitemap 与注册表一致（${count} 条：文章页路径式，其余 hash 式）`)
    return
  }
  writeFileSync(TARGET, content)
  const count = (content.match(/<loc>/g) || []).length
  console.log(`✅ 已生成 ${SITE}/public/sitemap.xml（${count} 条）`)
}

// main-guard：被守卫脚本 import 时不得覆写产物
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
