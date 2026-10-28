#!/usr/bin/env node
/**
 * 三站 SEO 产物的生成与接线核对（路线图 Wave 3 · 3.2 / 3.3）。
 *
 * 生成：两个子站各自的 `public/sitemap.xml` / `public/robots.txt`。
 * 核对：**三站**的重复页声明，以及每个站 router 的 afterEach 真的写出了
 * canonical / og:url / robots。三件事各自防一种「看起来对」的错：
 *
 *   1. **sitemap 只列本站真正拥有内容、且真能打开的地址。**
 *      条目从**真实路由表**求值而来（`site-module-loader` 把 router 模块在 Node 里
 *      编译并 import，`vue-router` 换成桩），不是从源码里正则抠路径 —— 嵌套 children
 *      的相对路径要靠父级拼接，抠出来的少一层前缀照样是个「形状正常」的 URL。
 *      列表口径：跳过 404 兜底、跳过重定向、跳过 `meta.duplicate`（那些页的
 *      canonical 在主站，本站不该抢着收录）、跳过没有来源可枚举的参数路由。
 *      主站的 sitemap 另有生成器（gen-sitemap.mjs，条目含全部文档 slug），不归这里管。
 *
 *   2. **声明的重复页与主站路由表双向一致。**
 *      「哪些页是主站某页的副本」写在子站 router 的 `meta.duplicate` 上，运行时由
 *      `utils/site-seo.js` 使用。这个脚本拿主站路由表**重算**一遍判据
 *      （路径相同且不是通配、不是站点根），两边必须一致：声明了但主站没有这条路径、
 *      或者主站有这条路径却没声明，都算漂移。只查一个方向等于自己给自己判卷。
 *
 *   3. **运行时真的按声明产出 canonical —— 而且是从 router 那条链上产出的。**
 *      声明对了、copy 也同步了，但 router 忘了在 afterEach 里调 `applyPageSeo` ——
 *      这种接线缺失靠读代码是看不出来的。所以这里**取出 router 注册的 afterEach**，
 *      给它一个假 `to` 与假 document，跑几种情形（本站页 / 首页 / 404 / 参数页 /
 *      子站的重复页），逐字核对 canonical 与 robots。直接测 `applyPageSeo` 本身是
 *      不够的：测得到函数，测不到「有没有人调它」。
 *
 * 关于 robots.txt 的诚实说明：两站部署在 `https://liujiaao.github.io/` 的**子路径**下，
 * 而爬虫只读域名根部的 `/robots.txt`。所以这份文件对抓取指令实际不起作用，它的用途是
 * 把「本站 sitemap 在哪」写成机器可读的声明，并在换到自有域名 / history 路由后直接生效。
 * 产物里也写着同一句话 —— 不要在这里悄悄把它描述成「能控制抓取」。
 *
 * 用法：
 *   node scripts/gen-site-seo.mjs           # 生成两个子站的 sitemap.xml / robots.txt
 *   node scripts/gen-site-seo.mjs --check   # 校验（CI，含声明核对、运行时行为、JSON-LD）
 *
 * 退出码：0 = 成功/一致；1 = 声明漂移、产物过期或运行时行为不符。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSiteModule, VUE_ROUTER_SHIM } from './lib/site-module-loader.mjs'
import { normalizeEol } from './lib/docs-mirror.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DOCS_SITE = 'es-plus-docs'
const DOCS_ROUTER = `${DOCS_SITE}/src/router/index.ts`
/** 主站 key：`meta.duplicate` 的 canonical 终点 */
const MAIN_SITE_KEY = 'vue3'

const TARGETS = [
  {
    site: DOCS_SITE,
    key: MAIN_SITE_KEY,
    router: DOCS_ROUTER,
    // 主站是 canonical 的终点：没有「重复页」这回事，sitemap 也另有生成器
    // （gen-sitemap.mjs，条目含全部文档 slug），这里只核对运行时接线
    subsite: false,
    expectations: [
      { label: '本站页面 /playground', path: '/playground', canonical: '#/playground', robots: 'index,follow' },
      { label: '文章页 /guide/getting-started', path: '/guide/getting-started', canonical: 'guide/getting-started/', robots: 'index,follow' },
      { label: '首页', path: '/', canonical: '', robots: 'index,follow' },
      { label: '404', path: '/no-such-page', name: 'not-found', canonical: '#/no-such-page', robots: 'noindex,follow' },
    ],
  },
  {
    site: 'es-pc',
    key: 'antdv',
    router: 'es-pc/src/router/index.js',
    subsite: true,
    expectations: [
      { label: '本站专属页 /es-form', path: '/es-form', canonical: '#/es-form', robots: 'index,follow' },
      { label: '重复页 /quickstart', path: '/quickstart', canonical: '#/quickstart', robots: 'index,follow', duplicate: true },
      { label: '首页', path: '/', canonical: '', robots: 'index,follow' },
      { label: '404', path: '/no-such-page', name: 'NotFound', canonical: '#/no-such-page', robots: 'noindex,follow' },
    ],
  },
  {
    site: 'es-eui',
    key: 'vue2',
    router: 'es-eui/src/router/index.js',
    subsite: true,
    expectations: [
      { label: '本站专属页 /component/esform', path: '/component/esform', canonical: '#/component/esform', robots: 'index,follow' },
      { label: '重复页 /quickstart', path: '/quickstart', canonical: '#/quickstart', robots: 'index,follow', duplicate: true },
      { label: '首页', path: '/', canonical: '', robots: 'index,follow' },
      { label: '404', path: '/no-such-page', name: 'NotFound', canonical: '#/no-such-page', robots: 'noindex,follow' },
    ],
  },
]

const problems = []
const runtimeProblems = []
const fail = (msg) => problems.push(msg)
/** 运行时接线的问题单独收口：它们不是「重新生成一遍」能修的 */
const runtimeFail = (msg) => runtimeProblems.push(msg)

// ── 路由表读取与摊平 ───────────────────────────────────────────────────────

function loadRouterModule(site, entry) {
  return loadSiteModule(entry, {
    site,
    // 路由模块会 import 一堆 .vue：读了也只是为了 `options.routes`，组件换成空壳
    stubComponents: true,
    stubs: { 'vue-router': VUE_ROUTER_SHIM },
  })
}

function joinPath(prefix, path) {
  const own = path === undefined || path === null ? '' : String(path)
  if (own === '') return prefix || '/'
  if (own.charAt(0) === '/') return own
  return `${prefix === '/' ? '' : prefix}/${own}`
}

/**
 * 路由表 → 叶子页清单（带完整路径）。
 *
 * 只收叶子：有 `children` 的记录是容器（内容由子路由渲染，`path: ''` 的那个子路由
 * 就是父路径本身）。这条规则顺手去掉了「父级 /guide + 空路径子级 /guide」这类同一
 * 地址出现两次的情况，也不需要另写去重。
 */
function flatten(routes, prefix = '') {
  const leaves = []
  for (const record of routes) {
    const path = joinPath(prefix, record.path)
    const children = record.children || []
    if (children.length) {
      leaves.push(...flatten(children, path))
      continue
    }
    leaves.push({
      path,
      name: record.name || null,
      duplicate: Boolean(record.meta && record.meta.duplicate),
      redirect: Boolean(record.redirect),
    })
  }
  return leaves
}

/** 404 兜底：`*`（Vue 2）/ `:pathMatch(.*)*`（Vue 3）。不是页面，不进任何清单 */
const isWildcard = (path) => path.indexOf('*') !== -1
/** 参数路由：`/ai-gallery/:id`。路径里带 `:` 就没有固定地址 */
const isParam = (path) => path.indexOf(':') !== -1

// ── 产物渲染 ───────────────────────────────────────────────────────────────

function renderSitemap(paths, siteUrl) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- 由 scripts/gen-site-seo.mjs 生成，请勿手改：条目来自本站真实路由表 -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${siteUrl}${path === '/' ? '' : `#${path}`}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')
}

function renderRobots(siteUrl) {
  return [
    '# 由 scripts/gen-site-seo.mjs 生成，请勿手改。',
    '# 本站部署在站点域名的子路径下，爬虫只读域名根部的 /robots.txt —— 这份文件对',
    '# 抓取指令实际不起作用；它声明的是本站 sitemap 的位置（换到自有域名后即生效）。',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${siteUrl}sitemap.xml`,
    '',
  ].join('\n')
}

// ── 运行时行为核对（假 document） ──────────────────────────────────────────

function makeDom() {
  const nodes = []
  const matches = (node, selector) => {
    const m = selector.match(/^([a-z]+)\[([\w-]+)="([^"]*)"\]$/)
    return Boolean(m) && node.tagName === m[1] && node.attrs[m[2]] === m[3]
  }
  // 挂上的节点要记得自己的父级：JSON-LD 的「移除」走 parentNode.removeChild，
  // 少了这条，setJsonLd(null) 在假 DOM 里会静默什么都不做（然后「移除」这项永远绿）
  const head = {
    querySelector: (selector) => nodes.find((node) => matches(node, selector)) || null,
    appendChild: (node) => {
      node.parentNode = head
      nodes.push(node)
      return node
    },
    removeChild: (node) => {
      const index = nodes.indexOf(node)
      if (index !== -1) nodes.splice(index, 1)
      return node
    },
  }
  return {
    nodes,
    head,
    createElement: (tagName) => ({
      tagName,
      attrs: {},
      textContent: '',
      parentNode: null,
      setAttribute(name, value) {
        this.attrs[name] = value
      },
    }),
  }
}

const attrOf = (dom, tagName, name, value, attr) => {
  const node = dom.nodes.find((n) => n.tagName === tagName && n.attrs[name] === value)
  return node ? node.attrs[attr] : undefined
}

async function checkRuntime(target, router, siteUrl, mainSiteUrl) {
  // 走的是 router 自己注册的那个回调：能测出「忘了调 applyPageSeo」这类接线缺失
  const afterEach = router && router._afterEach
  if (typeof afterEach !== 'function') {
    runtimeFail(`${target.router} 没有注册 afterEach —— canonical/robots 不会随路由更新`)
    return
  }

  for (const item of target.expectations) {
    // 期望值是站点基准 + 页内地址的**字面拼接**，不复用 site-seo.js 的拼法 ——
    // 两边共用同一个函数就成了自己给自己判卷。`canonical` 是站点基准之后的那一段：
    // hash 形式写成 `#/x`，文章页的路径式写成 `guide/x/`（末尾带斜杠）
    const expected = `${item.duplicate ? mainSiteUrl : siteUrl}${item.canonical}`
    const meta = item.duplicate ? { duplicate: true } : {}
    const to = { path: item.path, meta, matched: [{ name: item.name, meta }] }

    const dom = makeDom()
    globalThis.document = dom
    afterEach(to)
    const canonical = attrOf(dom, 'link', 'rel', 'canonical', 'href')
    const ogUrl = attrOf(dom, 'meta', 'property', 'og:url', 'content')
    const robots = attrOf(dom, 'meta', 'name', 'robots', 'content')

    if (canonical !== expected) runtimeFail(`${target.site} ${item.label}：canonical 是 ${canonical}，应为 ${expected}`)
    if (ogUrl !== expected) runtimeFail(`${target.site} ${item.label}：og:url 是 ${ogUrl}，应与 canonical 一致`)
    if (robots !== item.robots) runtimeFail(`${target.site} ${item.label}：robots 是 ${robots}，应为 ${item.robots}`)
  }
  delete globalThis.document
}

// ── 结构化数据（JSON-LD）行为核对 ─────────────────────────────────────────

const DOCS_JSON_LD = `${DOCS_SITE}/src/utils/json-ld.ts`

/**
 * 结构化数据与 canonical 必须指向同一个地址：两处打架时搜索引擎两个都不信。
 *
 * 因此这里不校验 `json-ld.ts` 的源码写法，而是把它真加载进来，用假 document 跑一遍
 * 「写入 → 换页替换 → 首页类型 → 移除」。失败模式都很安静：@type 写错、url 用了另一套
 * 基准、换页变成追加（一条页面上留两条互相矛盾的文章）—— 页面看起来完全正常。
 */
async function checkJsonLd(mainSiteUrl) {
  const dom = makeDom()
  globalThis.document = dom
  let jsonLd
  try {
    jsonLd = await loadSiteModule(DOCS_JSON_LD, { site: DOCS_SITE })
  } catch (error) {
    runtimeFail(`加载 ${DOCS_JSON_LD} 失败：${error.message}`)
    return
  }

  /** head 里所有结构化数据脚本（按固定 data 属性认，不按顺序认） */
  const scripts = () => dom.nodes.filter((node) => node.tagName === 'script' && node.attrs['data-es-jsonld'] === 'page')
  const readOne = () => {
    const list = scripts()
    if (list.length !== 1) return { count: list.length, data: null }
    try {
      return { count: 1, data: JSON.parse(list[0].textContent) }
    } catch {
      return { count: 1, data: null }
    }
  }

  // ① 指南页：TechArticle，url 与 canonical 同一基准（主站 base + 页内 hash）
  jsonLd.useJsonLd(() =>
    jsonLd.techArticle({
      title: '快速上手',
      description: '从安装依赖到第一个可跑页面的最短路径。',
      path: '/guide/getting-started',
      section: 'guide',
    }),
  )
  let { count, data } = readOne()
  if (count !== 1 || !data) {
    runtimeFail(`useJsonLd 没有在 head 里写出一条可解析的 JSON-LD（found ${count}）`)
  } else {
    if (data['@context'] !== 'https://schema.org') runtimeFail(`JSON-LD 的 @context 是 ${data['@context']}，应为 https://schema.org`)
    if (data['@type'] !== 'TechArticle') runtimeFail(`指南页的 @type 是 ${data['@type']}，应为 TechArticle`)
    if (data.headline !== '快速上手') runtimeFail('指南页 JSON-LD 的 headline 与页面标题不一致')
    // 文章页的规范地址是构建期静态 HTML 的路径（不是 hash），与 sitemap 同口径
    const expected = `${mainSiteUrl}guide/getting-started/`
    if (data.url !== expected) runtimeFail(`指南页 JSON-LD 的 url 是 ${data.url}，应与 canonical 一致（${expected}）`)
  }

  // ② 换页必须**原地替换**：追加的话，从 /guide/a 走到 /guide/b 会留下两条互相矛盾的文章
  jsonLd.useJsonLd(() =>
    jsonLd.techArticle({ title: '安装', description: '两种安装方式与各自的适用场景。', path: '/guide/installation', section: 'guide' }),
  )
  ;({ count, data } = readOne())
  if (count !== 1) runtimeFail(`换页后 head 里有 ${count} 条 JSON-LD 脚本 —— 应原地替换，只剩 1 条`)
  else if (data && data.headline !== '安装') runtimeFail('换页后 JSON-LD 没有更新到新页面')

  // ③ 首页：SoftwareApplication（带完整 offers），url 就是站点根
  jsonLd.setJsonLd(
    jsonLd.softwareApplication({ title: '中后台 CRUD 的配置层', description: '一份 JSON 配置，三端通用。', path: '/' }),
  )
  ;({ count, data } = readOne())
  if (count !== 1 || !data) runtimeFail('首页 JSON-LD 没写出来')
  else {
    if (data['@type'] !== 'SoftwareApplication') runtimeFail(`首页的 @type 是 ${data['@type']}，应为 SoftwareApplication`)
    if (data.url !== mainSiteUrl) runtimeFail(`首页 JSON-LD 的 url 是 ${data.url}，应为站点根 ${mainSiteUrl}`)
    if (!data.offers || data.offers['@type'] !== 'Offer' || data.offers.price !== '0') {
      runtimeFail('首页 JSON-LD 的 offers 不完整（SoftwareApplication 缺 offers 会被判为不完整）')
    }
  }

  // ④ 传 null 要移除（离开文章页时不该留着上一页的类型）
  jsonLd.setJsonLd(null)
  if (scripts().length) runtimeFail('setJsonLd(null) 没有移除 JSON-LD 脚本')

  delete globalThis.document
}

// ── 主流程 ─────────────────────────────────────────────────────────────────

async function main() {
  const CHECK = process.argv.includes('--check')

  const sitesModule = await loadSiteModule(`${DOCS_SITE}/src/utils/sites.ts`, { site: DOCS_SITE })
  const siteByKey = new Map(sitesModule.SITES.map((item) => [item.key, item]))
  const mainSite = siteByKey.get(MAIN_SITE_KEY)
  if (!mainSite) fail(`三站清单里没有 key='${MAIN_SITE_KEY}' 的主站条目`)

  const docsLeaves = flatten((await loadRouterModule(DOCS_SITE, DOCS_ROUTER)).default.options.routes)
  // 主站「有这一页」的判据：路径完全相同。404 兜底不算（三站各有一个自己的 404）
  const docsPages = new Set(docsLeaves.filter((leaf) => !isWildcard(leaf.path)).map((leaf) => leaf.path))

  const files = []
  const runtimeJobs = []

  for (const target of TARGETS) {
    const site = siteByKey.get(target.key)
    if (!site) {
      fail(`${target.site} 在三站清单里没有 key='${target.key}' 的条目`)
      continue
    }

    const router = (await loadRouterModule(target.site, target.router)).default
    const leaves = flatten(router.options.routes)

    // 主站没有「我是不是某站副本」这个问题，sitemap 也另有生成器：只有子站做这两项
    if (target.subsite) {
      // ① 声明 vs 主站路由表，双向核对
      for (const leaf of leaves) {
        if (isWildcard(leaf.path)) continue
        // 站点根永远是自己的：它是这个站的入口，不是「主站某页的副本」
        const should = leaf.path !== '/' && docsPages.has(leaf.path)
        if (should && !leaf.duplicate) {
          fail(`${target.site} 的 ${leaf.path} 主站也有同一路径 —— 应声明 meta.duplicate: true（canonical 指回主站）`)
        }
        if (!should && leaf.duplicate) {
          fail(`${target.site} 的 ${leaf.path} 声明了 meta.duplicate，但主站路由表里没有这条路径`)
        }
      }

      // ② sitemap 条目：只列本站拥有 canonical 的可打开地址
      const paths = []
      for (const leaf of leaves) {
        if (isWildcard(leaf.path) || leaf.redirect) continue
        if (leaf.duplicate) continue
        if (isParam(leaf.path)) {
          fail(`${target.site} 的 ${leaf.path} 是参数路由但没有可枚举的来源 —— 先在脚本里补一份来源，不要让它从 sitemap 里静默消失`)
          continue
        }
        paths.push(leaf.path)
      }
      // 纯 ASCII 比较：localeCompare 会随 ICU/locale 变，产物必须逐字节可复算
      paths.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a < b ? -1 : a > b ? 1 : 0))

      if (!paths.length) fail(`${target.site} 的 sitemap 一条都没有 —— 路由表解析大概率已经失效`)

      files.push({ path: join(ROOT, target.site, 'public', 'sitemap.xml'), content: renderSitemap(paths, site.url) })
      files.push({ path: join(ROOT, target.site, 'public', 'robots.txt'), content: renderRobots(site.url) })
    }

    if (CHECK && mainSite) runtimeJobs.push([target, router, site.url, mainSite.url])
  }

  // 结构性问题（声明 / 参数路由）先单独收口：这时候再报「产物过期」是误导 ——
  // 重新生成一遍确实能让它变绿，但那是把错的判据写进产物，不是修好了。
  if (problems.length) {
    for (const problem of problems) console.error(`❌ ${problem}`)
    console.error('\n提示：重复页的判据在子站 router 的 meta.duplicate 上（与主站路由表双向一致）')
    process.exit(1)
  }

  // ③ 产物是否最新（只在校验模式）
  if (CHECK) {
    for (const file of files) {
      const rel = file.path.slice(ROOT.length + 1).replace(/\\/g, '/')
      if (!existsSync(file.path)) {
        fail(`${rel} 缺失（运行 npm run site-seo:gen）`)
        continue
      }
      if (normalizeEol(readFileSync(file.path, 'utf-8')) !== file.content) {
        fail(`${rel} 与路由表不一致 —— 运行 npm run site-seo:gen（不要手改）`)
      }
    }
    // ④ 运行时行为（声明对了、copy 也同步了、但 router 忘了调 applyPageSeo）
    for (const job of runtimeJobs) await checkRuntime(...job)
    // ⑤ 结构化数据：类型 / 地址基准 / 换页替换
    if (mainSite) await checkJsonLd(mainSite.url)
  }

  if (problems.length) {
    for (const problem of problems) console.error(`❌ ${problem}`)
    console.error('\n提示：sitemap/robots 由 npm run site-seo:gen 生成，不要手改')
    process.exit(1)
  }

  if (runtimeProblems.length) {
    for (const problem of runtimeProblems) console.error(`❌ ${problem}`)
    console.error('\n提示：canonical/robots/JSON-LD 的运行时接线是「router.afterEach → applyPageSeo(to)」'
      + '（utils/site-seo.js）与 useJsonLd（utils/json-ld.ts）')
    process.exit(1)
  }

  if (CHECK) {
    const counts = files
      .filter((file) => file.path.endsWith('sitemap.xml'))
      .map((file) => (file.content.match(/<loc>/g) || []).length)
    console.log(
      `✅ 子站 sitemap/robots 与路由表一致（${counts.join(' + ')} 条可打开地址）；重复页声明与主站双向一致；canonical/robots 运行时行为已核对；JSON-LD 类型与地址基准已核对`,
    )
    return
  }

  for (const file of files) writeFileSync(file.path, file.content)
  console.log(`✅ 已生成 ${files.map((file) => file.path.slice(ROOT.length + 1).replace(/\\/g, '/')).join(' / ')}`)
}

// main-guard：被守卫脚本 import 时不得覆写产物
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
