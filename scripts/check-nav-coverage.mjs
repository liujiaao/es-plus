#!/usr/bin/env node
/**
 * 主站「页面 ↔ 导航」双向覆盖检查。
 *
 * 背景：这不是理论问题，而是已经发生过的两件事 ——
 *   1. `/ai-gallery`、`/ai-gallery/composition`、`/ai-gallery/workflows`、
 *      `/fragment-dashboard`、`/native-vs-ai` 五页做过、能打开、也被 sitemap 收录，
 *      但侧栏与顶栏**一条入口都没有**。只有手里已经存着 URL 的人才进得来，
 *      读者与搜索引擎都当它不存在 —— 做了等于没做。
 *   2. 反过来也成立：导航里写一个 `/advanced/xxx`，而 advanced-doc 里没有这个 slug，
 *      点进去是「页面不存在」。这类死链在构建期不报错，只有人点到才发现。
 *
 * 两件事的共同点：**路由表、注册表、导航清单是四份独立的数据**，靠人肉同步。
 * 所以这里做双向闭包：
 *   1. 路由表里的每个静态页（不含参数、通配）都必须能在顶栏或侧栏找到入口；
 *   2. 导航里的每个链接都必须落到真实路由；落进参数路由（`/guide/:name` 等）的，
 *      slug 必须真实存在于对应注册表 —— 否则就是死链；
 *   3. 导航引用的每个 i18n key 在 zh-CN / en-US **两份**字典里都要在 ——
 *      漏一份，另一种语言下就是裸 key 或空白；
 *   4. 侧栏内同一路径不得出现两次（复制粘贴加错组时很容易发生）。
 *
 * 不改路由、不改注册表，只做对账。新增页面后如果忘了加入口，这里会红。
 *
 * 用法：node scripts/check-nav-coverage.mjs
 * 退出码：0 = 双向覆盖完整；1 = 有孤儿页 / 死链 / 缺翻译。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText } from './lib/text-sync.mjs'
import { objectKeys } from './gen-sitemap.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'

const ROUTER = `${SITE}/src/router/index.ts`
const HEADER = `${SITE}/src/components/layout/AppHeader.vue`
const SIDEBAR = `${SITE}/src/components/layout/AppSidebar.vue`
const LOCALES = [`${SITE}/src/locales/zh-CN.json`, `${SITE}/src/locales/en-US.json`]

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

/** 路由表 → [{ path, name }]，按 `\n  {\n` 切块，避免跨对象误匹配 */
function parseRoutes(src) {
  const routes = []
  for (const block of src.split(/\n {2}\{\n/).slice(1)) {
    const path = block.match(/^\s*path: '([^']+)'/m)?.[1]
    const name = block.match(/^\s*name: '([^']+)'/m)?.[1]
    if (path && name) routes.push({ path, name })
  }
  return routes
}

/**
 * 参数路由 → 单段匹配的正则；通配路由不参与「nav 必须落到真实页」的判定。
 * 只认「末段是一个参数」的形式（`/guide/:name`）—— 静态段在前的写法才能推出
 * 该 slug 属于哪张注册表；多参数路由（将来若有）请在此扩展，否则会静默跳过。
 */
function paramPattern(path) {
  if (path.includes('*')) return null
  const segs = path.split('/').filter(Boolean)
  if (!segs.length || !segs[segs.length - 1].startsWith(':')) return null
  if (segs.slice(0, -1).some((s) => s.startsWith(':'))) return null
  const prefix = `/${segs.slice(0, -1).join('/')}`
  return { prefix, re: new RegExp(`^${prefix}/([^/]+)$`) }
}

const norm = (p) => p.replace(/[?#].*$/, '').replace(/\/$/, '') || '/'

/** 从组件里取导航目标：顶栏读 router-link 的 to，侧栏读 items 的 path */
function parseHeaderLinks(src) {
  return [...src.matchAll(/<router-link\s+to="([^"]+)"/g)].map((m) => m[1])
}
function parseSidebarLinks(src) {
  return [...src.matchAll(/\bpath: '([^']+)'/g)].map((m) => m[1])
}

/** 组件里引用的 i18n key：顶栏 t('…')，侧栏 titleKey / labelKey */
function parseI18nKeys(src) {
  const keys = new Set()
  for (const m of src.matchAll(/\bt\('([^']+)'\)/g)) keys.add(m[1])
  for (const m of src.matchAll(/\b(?:titleKey|labelKey): '([^']+)'/g)) keys.add(m[1])
  return [...keys]
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
  const routerSrc = read(ROUTER)
  const headerSrc = read(HEADER)
  const sidebarSrc = read(SIDEBAR)

  const routes = parseRoutes(routerSrc)
  if (routes.length < 10) {
    fail(`只从 ${ROUTER} 解析出 ${routes.length} 条路由 —— 解析规则与源码结构脱节（改了写法请同步本脚本）`)
    return 1
  }

  // 注册表：参数路由的 slug 从这些数据文件来，不手抄
  const registries = {
    '/guide': objectKeys(read(`${SITE}/src/docs/doc-meta.ts`), 'DOC_META'),
    '/components': objectKeys(read(`${SITE}/src/views/component-doc.data.ts`), 'docsData'),
    '/advanced': objectKeys(read(`${SITE}/src/views/advanced-doc.data.ts`), 'docsData'),
    '/ai-gallery': objectKeys(read(`${SITE}/src/cases/generated/registry.js`), 'AI_CASES'),
  }
  for (const [prefix, slugs] of Object.entries(registries)) {
    if (!slugs.length) fail(`${prefix} 对应的注册表里一个 slug 都没解析到 —— 死链检查会静默失效`)
  }
  const slugSet = (prefix) => new Set(registries[prefix] || [])

  const headerLinks = parseHeaderLinks(headerSrc).map(norm)
  const sidebarLinks = parseSidebarLinks(sidebarSrc).map(norm)
  const allLinks = new Set([...headerLinks, ...sidebarLinks])

  const staticRoutes = routes.filter((r) => !r.path.includes(':') && !r.path.includes('*'))
  const paramRoutes = routes.map((r) => paramPattern(r.path)).filter(Boolean)
  const byPath = new Map(routes.map((r) => [norm(r.path), r]))

  // ── 1. 每个静态页都要有入口 ──
  const orphans = staticRoutes.filter((r) => !allLinks.has(norm(r.path))).map((r) => `${r.path}（${r.name}）`)
  if (orphans.length) {
    fail(
      `以下静态页在顶栏与侧栏都没有入口（做了没人找得到）：\n     ${orphans.join('\n     ')}\n` +
        '   请在 AppHeader.vue 或 AppSidebar.vue 里补一条，不要只靠 sitemap。',
    )
  }

  // ── 2. 每个导航目标都要落到真实路由（参数路由还要落到真实 slug）──
  for (const link of allLinks) {
    if (byPath.has(link)) continue
    const hit = paramRoutes.find((p) => p.re.test(link))
    if (!hit) {
      fail(`导航链接没有对应路由：${link}（点了就是 404）`)
      continue
    }
    const slug = link.match(hit.re)[1]
    const set = slugSet(hit.prefix)
    if (set.size && !set.has(slug)) {
      fail(`导航链接 ${link} 的 slug「${slug}」不在注册表里（点了是「页面不存在」）`)
    }
  }

  // ── 3. 导航引用的 i18n key 两份字典都要有 ──
  const dicts = LOCALES.map((p) => {
    const raw = read(p)
    if (!raw) return { path: p, dict: null }
    try {
      return { path: p, dict: JSON.parse(raw) }
    } catch (e) {
      fail(`${p} 不是合法 JSON：${e.message}`)
      return { path: p, dict: null }
    }
  })
  const keys = [...new Set([...parseI18nKeys(headerSrc), ...parseI18nKeys(sidebarSrc)])]
  if (!keys.length) fail('导航组件里没解析到任何 i18n key —— 解析规则与源码结构脱节')
  for (const { path, dict } of dicts) {
    if (!dict) continue
    const missing = keys.filter((k) => !hasKey(dict, k))
    if (missing.length) fail(`${path} 缺少导航用到的 key：${missing.join(', ')}`)
  }

  // ── 4. 侧栏内同一路径不得重复 ──
  const seen = new Map()
  for (const link of sidebarLinks) seen.set(link, (seen.get(link) || 0) + 1)
  const dupes = [...seen].filter(([, n]) => n > 1).map(([p, n]) => `${p} ×${n}`)
  if (dupes.length) fail(`侧栏里同一路径出现了多次：${dupes.join(', ')}`)

  if (failed) {
    console.error('\n主站导航与路由/注册表/字典不一致。')
    return 1
  }

  console.log(
    `✅ 导航双向覆盖：${staticRoutes.length} 个静态页全部有入口，` +
      `${allLinks.size} 个导航目标全部有落点，${keys.length} 个 i18n key 中英齐全`,
  )
  return 0
}

process.exit(main())
