/**
 * 逐页 canonical / robots（路线图 3.2 / 3.3）—— 三站共享的运行时口径。
 *
 * 单一权威源：`docs/theme/site-seo.js` → `scripts/sync-theme.mjs` 分发到三站的
 * `src/utils/site-seo.js`，禁止手改各站副本。
 *
 * ## 为什么需要它
 *
 * 审计 P0-2 的实测：三站的 canonical 与 og:url 都写在 `index.html` 里，且都指向
 * **站点根**。于是子站的每一页都在说「我就是我」—— 而 `/quickstart`、`/cases`、
 * `/ai-gallery` 这些页在三个站上是同一份内容的三个副本，索引里出现三份重复，
 * 真正的 canonical（主站）反而被稀释。规划里那句「三端同构，不是三站同抄」
 * 落到机器上就是这一条：**同一内容只有一个 canonical**，子站与主站重复的页面
 * canonical 指回主站，渲染器专属页面才独立索引。主站自己每页都指向页内地址，
 * 不再是「十七个页面共用一个根地址」。
 *
 * ## 「哪些页是重复页」不在这里算
 *
 * 判据要拿主站路由表比对，子站拿不到（三站是三个独立工程，只共享这一个小模块）。
 * 所以各站 router 在路由上声明 `meta.duplicate: true`，再由
 * `scripts/gen-site-seo.mjs --check` 与主站路由表**双向**核对：声明了但主站没有
 * 这条路径、或者主站有这条路径却没声明，都会变红。本文件只负责**用**这个声明。
 * 主站的路由永远不带这个标记，于是它每一页都指向自己。
 *
 * ## 为什么不顺手加 noindex
 *
 * Google 的口径很明确：noindex 与 canonical 不要同时给 —— 两个信号互相抵消，只留
 * 一个生效时另一个就等于白写。所以重复页只给 canonical（指向主站），
 * `noindex,follow` 只留给 404：它不该进索引，但它的出链（「你可能想去的是这几个
 * 地方」）应该继续被跟随。
 */
import { SITES, SITE_KEY, siteOf, crossSiteUrl } from './sites'

/** 主站 key：canonical 的终点。三站清单里部署在站点根的那个文档站就是它 */
const MAIN_SITE_KEY = 'vue3'

/** 404 路由的 name。三站的写法是 `NotFound` / `not-found`，只认这一个共同点 */
const NOT_FOUND_NAME = /not-?found/i

/**
 * 文章类路径前缀。构建期会为这些路径生成静态 HTML（`scripts/gen-prerender.mjs`），
 * 于是它们的规范地址是路径式而不是 hash 式。改这里必须同步改
 * `es-plus-docs/src/utils/json-ld.ts` 的同名常量与 `scripts/gen-sitemap.mjs` 的条目形式
 * —— 三处不一致时，sitemap、canonical、结构化数据会各说各的地址。
 */
const ARTICLE_PREFIXES = ['/guide/', '/components/', '/advanced/']

/** 本站基准地址（含结尾斜杠）；站点未登记时退回三站清单第一项，避免读 undefined */
const SELF = siteOf(SITE_KEY) || SITES[0]

/**
 * 站内路径 → 本站的绝对地址。
 *
 * 文章类路径（`/guide/`、`/components/`、`/advanced/`）在构建期会生成一份静态 HTML
 * （`scripts/gen-prerender.mjs`），地址是 `…/es-plus/guide/x/` —— 那才是这一页的规范
 * 地址。其余路由只有 hash 形式可打开（`…/es-plus/#/quickstart`），静止页不存在。
 */
function selfUrl(path) {
  if (!path || path === '/') return SELF.url
  const normalized = path.charAt(0) === '/' ? path : '/' + path
  if (ARTICLE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return `${SELF.url}${normalized.slice(1)}/`
  return `${SELF.url}#${normalized}`
}

/** 同样的口径用在「重复页指回主站」那一路 */
function mainSiteUrl(path) {
  const main = siteOf(MAIN_SITE_KEY) || SITES[0]
  const normalized = path.charAt(0) === '/' ? path : '/' + path
  if (ARTICLE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return `${main.url}${normalized.slice(1)}/`
  return crossSiteUrl(MAIN_SITE_KEY, normalized)
}

/** 取 head 里已有的标签（没有就建一个），并把属性写全 */
function upsert(selector, tagName, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(tagName)
    document.head.appendChild(el)
  }
  Object.keys(attrs).forEach((name) => el.setAttribute(name, attrs[name]))
  return el
}

/**
 * 按当前路由写 canonical / og:url / robots。在 `router.afterEach` 里调用。
 *
 * 三种情形：
 *   1. `meta.duplicate` —— 这一页是主站某一页的副本：canonical 与 og:url 都指回主站
 *      的**同一路径**（`crossSiteUrl('vue3', path)`；文章类路径用路径式，因为主站
 *      那边真有静态 HTML）。爬虫会忽略地址里的 hash 段，所以对非文章页这句等价于
 *      「这一页属于主站」。
 *   2. 404 —— `robots: noindex,follow`，canonical 指向自己（写成别人的地址会让
 *      404 页和被指向的页在索引里混成一件事）。
 *   3. 其余 —— canonical 指向自己（文章页是路径式，其余是 hash 式）。
 *
 * 刻意不管 title / description：子站的 title 由 router 的 `meta.title` 负责
 * （afterEach 里已经写了 `document.title`），主站的逐页 meta 走 unhead
 * （`es-plus-docs/src/utils/page-meta.ts`）。三个地方各管一段，不互相覆盖。
 */
export function applyPageSeo(to) {
  const matched = (to && to.matched) || []
  const last = matched.length ? matched[matched.length - 1] : null
  const meta = (to && to.meta) || (last && last.meta) || {}
  const path = (to && to.path) || '/'
  const isNotFound = NOT_FOUND_NAME.test(String((last && last.name) || ''))
  const canonical = meta.duplicate && !isNotFound ? mainSiteUrl(path) : selfUrl(path)

  upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: canonical })
  upsert('meta[property="og:url"]', 'meta', { property: 'og:url', content: canonical })
  upsert('meta[name="robots"]', 'meta', {
    name: 'robots',
    content: isNotFound ? 'noindex,follow' : 'index,follow',
  })
}
