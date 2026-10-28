#!/usr/bin/env node
/**
 * 全站搜索索引 ↔ 路由 / 注册表的双向覆盖检查（审计 0.9 的验收口径）。
 *
 * 背景：搜索是最容易「看起来做好了」的一块 —— 输入框一直在，输什么都有反应，
 * 所以没人会发现**某些页面根本不在索引里**。实际发生过两次：
 *   1. 索引只收 `/guide/*`，组件页、高级页、案例目录、AI 证据页全都搜不到；
 *   2. 修完还是漏一类：AI 画廊的**逐条案例**（`/ai-gallery/<id>`）搜不到 ——
 *      搜「员工花名册」只命中 CLI 指南里的一张预设表。原因是画廊清单由
 *      `cases/generated/registry.js` 在页面里现读，索引层从没见过它。
 *
 * 这两次的共同结构：**路由表、注册表、搜索清单是三份独立的数据，靠人肉同步**。
 * 「新增页面」与「新增指南」都不会让任何东西变红。所以这里做双向闭包：
 *
 *   A. 路由 → 索引：每个静态内容页都必须在 `FIXED_PAGES` 里（首页除外，见 EXEMPT）；
 *   B. 索引 → 路由：`FIXED_PAGES` 的每条路径都是真实路由（搜索命中不许 404），
 *      且它的 key 在 `PAGE_META` 里有条目 —— `buildFixedEntries` 里那句
 *      `if (!meta) return []` 会把缺条目静默丢成「搜不到」；
 *   C. `PAGE_META` 的每一页（除 404）都要可搜，防止「有标题没搜索」；
 *   D. 参数路由 → 注册表：`/guide` `/components` `/advanced` `/ai-gallery` 各自的数据
 *      非空，且引擎里真的有对应的 build 调用（少一处，整类页面从索引里消失）；
 *   E. 锚点算法一致：索引给的 `#anchor` 必须与渲染器生成的 id 逐字一致
 *      （指南 = `doc-markdown` 的标题 id；组件/高级 = 模板里的 `demo-` 前缀）；
 *   F. AI 案例：通用宿主逐条进索引，定制宿主的页面在 `FIXED_PAGES` 里；
 *      索引模块里不许手抄案例 id（手抄一份就会漂移）；
 *   G. 每个分类在**中英两份字典**里都有标签（`search.cat.<x>`），否则结果条上的
 *      分类徽章是空白。
 *
 * 不改路由、不改注册表，只做对账。任何一处解析为空都判红 —— 把「解析失败」静默
 * 降级成「全部合法」是这类守卫最典型的死法。
 *
 * 用法：node scripts/check-search-index.mjs
 * 退出码：0 = 双向覆盖完整；1 = 有页面搜不到 / 索引指向不存在的页 / 解析失败。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'

const FILES = {
  router: `${SITE}/src/router/index.ts`,
  index: `${SITE}/src/utils/search-index.ts`,
  engine: `${SITE}/src/utils/search-engine.ts`,
  markdown: `${SITE}/src/utils/doc-markdown.mjs`,
  componentDoc: `${SITE}/src/views/component-doc.data.ts`,
  advancedDoc: `${SITE}/src/views/advanced-doc.data.ts`,
  componentView: `${SITE}/src/views/ComponentDoc.vue`,
  advancedView: `${SITE}/src/views/AdvancedDoc.vue`,
  docMeta: `${SITE}/src/docs/doc-meta.ts`,
  pageMeta: `${SITE}/src/utils/page-meta.ts`,
  locales: [`${SITE}/src/locales/zh-CN.json`, `${SITE}/src/locales/en-US.json`],
}

/**
 * 不进搜索的页面，逐条写理由。空集豁免会让这条守卫退化成「只检查我列的两条」，
 * 所以这里只允许「搜索它没有增量」的页面进来。
 */
const EXEMPT_ROUTES = {
  '/': '首页是入口页：每页顶栏都有它的入口，搜索结果指向首页没有增量',
}
const EXEMPT_PAGE_META = {
  'not-found': '兜底页，搜索它没有意义',
}

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const toLF = (s) => s.replace(/\r\n?/g, '\n')
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return ''
  }
  return toLF(readFileSync(abs, 'utf8'))
}

/** 对象字面量里的「两空格缩进的 key: {」—— 与 gen-sitemap 的 objectKeys 同规则 */
function objectKeys(src, exportName) {
  const start = src.indexOf(`export const ${exportName}`)
  if (start === -1) return []
  const rest = src.slice(start)
  const end = rest.indexOf('\n}\n')
  const body = end === -1 ? rest : rest.slice(0, end)
  const re = /^ {2}["']?([A-Za-z0-9-]+)["']?: \{/gm
  const keys = new Set()
  let m
  while ((m = re.exec(body))) keys.add(m[1])
  return [...keys]
}

/** 路由表 → [{ path, name }]；按「两空格缩进的 `{`」切块，避免跨对象误匹配 */
function parseRoutes(src) {
  const routes = []
  for (const block of src.split(/\n {2}\{\n/).slice(1)) {
    const path = block.match(/^\s*path: '([^']+)'/m)?.[1]
    const name = block.match(/^\s*name: '([^']+)'/m)?.[1]
    if (path && name) routes.push({ path, name })
  }
  return routes
}

/** `FIXED_PAGES` 的每一行 → { key, path, category }；同时返回该块原文（供 F 段排掉本块） */
function parseFixedPages(src) {
  const start = src.indexOf('const FIXED_PAGES')
  if (start === -1) return { rows: [], body: '' }
  const end = src.indexOf('\n]', start)
  const body = end === -1 ? src.slice(start) : src.slice(start, end)
  const re = /\{\s*key: '([^']+)',\s*path: '([^']+)',\s*category: '([^']+)'\s*\}/g
  const rows = []
  let m
  while ((m = re.exec(body))) rows.push({ key: m[1], path: m[2], category: m[3] })
  return { rows, body }
}

/** `export type SearchCategory = 'guide' | …` */
function parseCategories(src) {
  const m = src.match(/export type SearchCategory\s*=([^\n]+)/)
  if (!m) return []
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
}

/**
 * PAGE_META 每一条的原文（key → 该条的对象字面量文本）。
 * 用来回答「搜这个案例名能不能命中它的页面」—— 固定页的搜索摘要就是 title + description。
 */
function parsePageMetaTexts(src) {
  const start = src.indexOf('export const PAGE_META')
  const body = start === -1 ? '' : src.slice(start)
  const map = new Map()
  const re = /^ {2}["']?([A-Za-z0-9-]+)["']?: \{([\s\S]*?)^ {2}\},?/gm
  let m
  while ((m = re.exec(body))) map.set(m[1], m[2])
  return map
}

/** 标题 slug 的替换链（`toLowerCase()` 之后的每个 `.replace(...)`），用于两边逐字比对 */
function slugChain(src, anchor) {
  const at = src.indexOf(anchor)
  if (at === -1) return null
  const m = src.slice(at).match(/toLowerCase\(\)((?:\.replace\([^)]*\))+)/)
  return m ? m[1].replace(/\s+/g, '') : null
}

/** 嵌套 key 是否存在于字典（点号分段） */
function hasKey(dict, dotted) {
  let cur = dict
  for (const seg of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return false
    cur = cur[seg]
  }
  return typeof cur === 'string' && cur.trim().length > 0
}

function main() {
  const src = Object.fromEntries(
    Object.entries(FILES).filter(([, p]) => typeof p === 'string').map(([k, p]) => [k, read(p)]),
  )
  const locales = FILES.locales.map((p) => {
    const raw = read(p)
    try {
      return { path: p, dict: raw ? JSON.parse(raw) : null }
    } catch (e) {
      fail(`${p} 不是合法 JSON：${e.message}`)
      return { path: p, dict: null }
    }
  })

  // ── 数据源 ────────────────────────────────────────────
  const routes = parseRoutes(src.router)
  const fixedPages = parseFixedPages(src.index)
  const fixed = fixedPages.rows
  // 「手抄案例 id」要查的是 FIXED_PAGES 之外的部分：那张表里的 key 本来就和案例同名的页面对应
  const indexWithoutFixed = src.index.split(fixedPages.body).join('')
  const categories = parseCategories(src.index)
  const pageMetaKeys = objectKeys(src.pageMeta, 'PAGE_META')
  const pageMetaTexts = parsePageMetaTexts(src.pageMeta)
  const registries = {
    '/guide': objectKeys(src.docMeta, 'DOC_META'),
    '/components': objectKeys(src.componentDoc, 'docsData'),
    '/advanced': objectKeys(src.advancedDoc, 'docsData'),
  }

  // 防「空集恒绿」：任何一处解析失败都必须显式报出来，不能被当成「全部覆盖」
  const floors = [
    ['路由表', routes.length, 10],
    ['FIXED_PAGES（可搜固定页）', fixed.length, 8],
    ['PAGE_META（逐页 meta）', pageMetaKeys.length, 10],
    ['SearchCategory（分类）', categories.length, 5],
    ['DOC_META（指南）', registries['/guide'].length, 10],
    ['component-doc.data（组件页）', registries['/components'].length, 5],
    ['advanced-doc.data（高级页）', registries['/advanced'].length, 3],
  ]
  for (const [label, got, floor] of floors) {
    if (got < floor) {
      fail(`${label} 只解析出 ${got} 条（< ${floor}）—— 解析规则与源码结构脱节，闭包检查会静默失效`)
    }
  }
  if (failed) return 1

  const norm = (p) => p.replace(/[?#].*$/, '').replace(/\/$/, '') || '/'
  const staticRoutes = routes.filter((r) => !r.path.includes(':') && !r.path.includes('*'))
  const paramRoutes = routes.filter((r) => r.path.includes(':') && !r.path.includes('*'))
  const fixedByPath = new Map(fixed.map((f) => [norm(f.path), f]))
  const fixedKeys = new Set(fixed.map((f) => f.key))

  // ── A. 路由 → 索引：每个静态内容页都要可搜 ──
  const missingFixed = staticRoutes
    .filter((r) => !fixedByPath.has(norm(r.path)) && !(norm(r.path) in EXEMPT_ROUTES))
    .map((r) => `${r.path}（${r.name}）`)
  if (missingFixed.length) {
    fail(
      `以下静态页不在搜索索引里（做了搜不到）：\n     ${missingFixed.join('\n     ')}\n` +
        '   请在 utils/search-index.ts 的 FIXED_PAGES 里补一条（同时确认 page-meta 有这一页的 title/description）；' +
        '确实不该进搜索的，写进本脚本的 EXEMPT_ROUTES 并给理由。',
    )
  }

  // ── B. 索引 → 路由：搜到的必须是真页面 ──
  const staticPaths = new Set(staticRoutes.map((r) => norm(r.path)))
  for (const f of fixed) {
    if (!staticPaths.has(norm(f.path))) {
      fail(`FIXED_PAGES 里的 ${f.path} 没有对应路由 —— 搜索结果点进去是 404`)
    }
    if (!pageMetaKeys.includes(f.key)) {
      fail(`FIXED_PAGES 的 key「${f.key}」在 PAGE_META 里没有条目 —— buildFixedEntries 会把它静默丢掉`)
    }
  }

  // ── C. PAGE_META → 索引：有标题的页必须可搜 ──
  const unsearchable = pageMetaKeys.filter((k) => !fixedKeys.has(k) && !(k in EXEMPT_PAGE_META))
  if (unsearchable.length) {
    fail(`PAGE_META 里有、搜索里没有的页面：${unsearchable.join(', ')} —— 加进 FIXED_PAGES 或写进 EXEMPT_PAGE_META`)
  }

  // ── D. 参数路由 → 注册表 + 引擎里真的接了这一类 ──
  const paramExpect = [
    ['/guide', 'guide'],
    ['/components', 'components'],
    ['/advanced', 'advanced'],
  ]
  for (const [prefix, kind] of paramExpect) {
    if (!paramRoutes.some((r) => r.path.startsWith(prefix + '/'))) {
      fail(`路由表里没有 ${prefix}/:name —— 但注册表有 ${registries[prefix].length} 条 ${kind} 页`)
    }
    if (kind === 'guide') {
      if (!/buildGuideEntries\(/.test(src.engine)) fail('引擎没有调用 buildGuideEntries —— 整类指南从索引里消失')
      continue
    }
    const re = new RegExp(`buildExampleEntries\\(\\s*\\w+\\s*,\\s*'/${kind}'\\s*,\\s*'${kind.replace(/s$/, '')}'\\s*\\)`)
    if (!re.test(src.engine)) fail(`引擎没有以 '${kind}' 分类调用 buildExampleEntries —— 这一类页面搜不到`)
  }

  // ── E. 锚点算法一致：索引给的 #anchor 要能打开 ──
  const indexSlug = slugChain(src.index, 'const slugify')
  const markdownSlug = slugChain(src.markdown, 'addHeadingIds')
  if (!indexSlug || !markdownSlug) {
    fail('解析不到标题 slug 的替换链（search-index 的 slugify / doc-markdown 的 addHeadingIds）—— 锚点一致性无法判定')
  } else if (indexSlug !== markdownSlug) {
    fail(
      `标题锚点算法已分叉：\n     搜索索引 ${indexSlug}\n     正文渲染 ${markdownSlug}\n` +
        '   两边必须逐字相同，否则搜到的小节链接点开落不到那一节。',
    )
  }
  for (const [label, p] of [
    ['ComponentDoc.vue', 'componentView'],
    ['AdvancedDoc.vue', 'advancedView'],
  ]) {
    if (!src[p].includes(`:id="'demo-' + example.key"`)) {
      fail(`${label} 里示例锚点不再是 \`'demo-' + example.key\` —— 索引里的 #demo-<key> 会打不开`)
    }
  }
  if (!src.index.includes('#demo-')) {
    fail('search-index 不再生成 #demo- 锚点 —— 示例级结果全都只能落到页首')
  }

  // ── F. AI 案例：通用宿主逐条可搜，定制宿主落在 FIXED_PAGES ──
  const manifestPath = join(ROOT, 'docs', 'cases', 'ai-cases.json')
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    fail(`读不到 docs/cases/ai-cases.json：${e.message}`)
  }
  const cases = Array.isArray(manifest?.cases) ? manifest.cases : []
  if (cases.length < 5) fail(`manifest 里的 AI 案例只解析出 ${cases.length} 条 —— 案例覆盖检查会失效`)
  if (cases.length) {
    const generic = cases.filter((c) => c.host?.kind === 'generic')
    const custom = cases.filter((c) => c.host?.kind !== 'generic')
    if (!generic.length) fail('manifest 里没有通用宿主案例 —— 逐条进索引的判据无从成立')
    if (!/buildAiCaseEntries\(\s*AI_CASES\s*\)/.test(src.engine)) {
      fail('引擎没有把画廊 registry 交给 buildAiCaseEntries —— AI 案例逐条搜不到')
    }
    if (!/import\('@\/cases\/generated\/registry\.js'\)/.test(src.engine)) {
      fail(
        "画廊 registry 必须是动态 import('@/cases/generated/registry.js') —— " +
          '它带着每个案例的 schema/mock/config，静态引入会重新拖进首屏闭包',
      )
    }
    if (!src.index.includes('host?.kind !== \'generic\'')) {
      fail("search-index 不再按 host.kind !== 'generic' 过滤 —— 定制宿主会多出指向 /ai-gallery/<id> 的死链")
    }
    for (const c of custom) {
      const row = fixedByPath.get(norm(c.host.route))
      if (!row) {
        fail(`定制宿主案例 ${c.id} 的页面 ${c.host.route} 不在 FIXED_PAGES 里 —— 这一页搜不到`)
        continue
      }
      // 定制宿主的案例名只可能出现在它那一页的 title/description 里（逐条索引不收它们）。
      // 案例名不在摘要里 ⟹ 搜案例名是零结果，而页面本身「看起来存在」。
      const metaText = pageMetaTexts.get(row.key) ?? ''
      if (!metaText.includes(c.title)) {
        fail(
          `定制宿主案例「${c.title}」的名字不在页面 ${c.host.route} 的 title/description 里 —— ` +
            '搜这个案例名是零结果（这两处正是该页的搜索摘要）',
        )
      }
    }
    // 手抄的案例 id 一定会漂移：索引模块只许接参数，不许认具体案例
    const handCopied = cases.filter((c) => new RegExp(`['"]${c.id}['"]`).test(indexWithoutFixed))
    if (handCopied.length) {
      fail(`search-index 里写死了案例 id（${handCopied.map((c) => c.id).join(', ')}）—— 案例清单只该由 registry 提供`)
    }
  }

  // ── G. 分类徽章：两种语言都要有标签 ──
  for (const { path, dict } of locales) {
    if (!dict) continue
    const missing = categories.filter((c) => !hasKey(dict, `search.cat.${c}`))
    if (missing.length) fail(`${path} 缺少分类标签：${missing.map((c) => `search.cat.${c}`).join(', ')}`)
  }

  // 分类只用 union 里有的（拼错一个字母 → 结果条上没有分类）
  const used = [...new Set(fixed.map((f) => f.category))]
  const unknownCat = used.filter((c) => !categories.includes(c))
  if (unknownCat.length) fail(`FIXED_PAGES 用了未定义的分类：${unknownCat.join(', ')}`)

  if (failed) {
    console.error('\n搜索索引与路由/注册表/字典不一致。')
    return 1
  }

  console.log(
    `✅ 搜索索引双向覆盖：${staticRoutes.length} 个静态页（${fixed.length} 条可搜，` +
      `${Object.keys(EXEMPT_ROUTES).length} 条豁免）→ 全部有落点；` +
      `${registries['/guide'].length} 篇指南 / ${registries['/components'].length} 个组件页 / ` +
      `${registries['/advanced'].length} 个高级页 / ` +
      `${cases.filter((c) => c.host?.kind === 'generic').length} 个通用宿主 AI 案例逐条可搜；` +
      `${categories.length} 个分类中英都有标签；标题与示例锚点算法一致`,
  )
  return 0
}

process.exit(main())
