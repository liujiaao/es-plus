/**
 * 三站统一 404 页数据（路线图 1.8）—— 无框架依赖的纯函数
 *
 * 单一权威源：`docs/theme/site-not-found.js` → `scripts/sync-theme.mjs` 分发到三站
 * `src/utils/site-not-found.js`，禁止手改各站点副本。
 *
 * ## 为什么 404 要独立成一份数据
 *
 * 审计 §7 记的是「三站三种 404」：主站一张裸的 404 + 一句 i18n 文案；es-pc 借
 * `a-result` 的库存插图；es-eui 自己画了 72px 的蓝色数字。同一个产品、同一个错误，
 * 三种收尾 —— 而这三个站本来就最容易互相链错（三端路径各不相同，`/guide` 在
 * 主站不存在、`/guide/quickstart` 在 es-pc 不存在），404 恰恰是最该给出「你可能想
 * 去的是这几个地方」和「你可能站选错了」的地方。
 *
 * 所以这里给的不是一张好看的错误图，是**下一步**：
 *   1. 回显走错的地址（用户才知道自己点的是哪条链接）；
 *   2. 本站四个固定入口（首页 / 快速开始 / 组件 / 核心案例，路径来自 SITE_ROUTES）；
 *   3. 另两个渲染端站点的入口 —— 站选错了是本站 404 最常见的原因。
 *
 * 文案也放在这里（而不是各站的 i18n）：三站读同一句，改一次三站同步。
 */
import { SITE_ROUTES, FOOTER_SITES } from './site-footer.js'

/** 404 页文案。主站双语，另两站固定取 zh。 */
export const NOT_FOUND_COPY = {
  zh: {
    title: '页面不存在',
    desc: '这个地址在本站没有对应页面。',
    pathLabel: '当前地址',
    linksTitle: '常用入口',
    sitesTitle: '也可能是站点选错了',
    sitesNote: '同一个 ES-Plus 有三个渲染端站点，同一份文档在三站的路径并不相同。',
    search: '搜索文档',
    searchHint: '按 Ctrl K 随时唤起',
    home: '回到首页',
  },
  en: {
    title: 'Page not found',
    desc: 'This address has no page on this site.',
    pathLabel: 'Requested path',
    linksTitle: 'Common entry points',
    sitesTitle: 'Or maybe you are on the wrong site',
    sitesNote: 'ES-Plus has three renderer sites, and the same doc sits on different paths in each.',
    search: 'Search docs',
    searchHint: 'Press Ctrl K anytime',
    home: 'Back home',
  },
}

/**
 * 取文案。`locale` 只认 en 前缀，其余（含 undefined）按中文 —— 三站里两站根本没有
 * i18n，默认必须是中文而不是英文。
 */
export function notFoundCopy(locale = 'zh') {
  return String(locale).toLowerCase().startsWith('en') ? NOT_FOUND_COPY.en : NOT_FOUND_COPY.zh
}

/**
 * 本站四个固定入口。
 *
 * 都不带 external：它们在**当前**站点里真实存在（SITE_ROUTES 按站点给出映射），
 * 走各自的 router-link，不该整页刷新。
 *
 * @param {{ siteKey?: string, locale?: string }} options
 * @returns {{ text: string, href: string, external: false }[]}
 */
export function buildNotFoundLinks({ siteKey, locale = 'zh' } = {}) {
  const en = String(locale).toLowerCase().startsWith('en')
  const routes = SITE_ROUTES[siteKey] || SITE_ROUTES['es-plus-docs']
  const route = (key) => routes[key] || '/'
  const item = (textZh, textEn, href) => ({ text: en ? textEn : textZh, href, external: false })

  return [
    item('首页', 'Home', '/'),
    item('快速开始', 'Quick start', route('quickstart')),
    item('组件 API', 'Components', route('components')),
    item('核心案例', 'Core cases', route('cases')),
  ]
}

/**
 * 另两个渲染端站点（排除当前站）。
 *
 * @param {{ siteKey?: string, locale?: string }} options
 * @returns {{ text: string, href: string, external: true }[]}
 */
export function buildNotFoundSites({ siteKey, locale = 'zh' } = {}) {
  const en = String(locale).toLowerCase().startsWith('en')
  return FOOTER_SITES.filter((site) => site.key !== siteKey).map((site) => ({
    text: en ? site.en : site.zh,
    href: site.href,
    external: true,
  }))
}

/**
 * 把走错的地址渲染成一行可读文本。
 *
 * 主站与两站都是 hash 路由，`route.fullPath` 只含 `#` 之后的部分（如
 * `/guide/getting-startted`），拼上 `#` 才对得上地址栏；整段 URL 反而噪音太大。
 */
export function formatNotFoundPath(fullPath = '') {
  const path = String(fullPath || '').trim()
  if (!path || path === '/') return '#/'
  return path.startsWith('/') ? `#${path}` : `#/${path}`
}
