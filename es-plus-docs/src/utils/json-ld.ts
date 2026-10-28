/**
 * 结构化数据（JSON-LD）—— 路线图 3.2「每页 SEO/OG/JSON-LD」。
 *
 * 三站此前没有任何 JSON-LD：标题、描述、OG 卡都写了，但搜索引擎只能看到「一堆普通
 * 网页」—— 判断不出这是文档站、哪一篇是技术文章、首页是个什么软件。结构化数据就是
 * 把这些话说成机器可读的一句。
 *
 * 三条约束：
 *
 *   1. **类型按页面种类给，不一律套 WebPage。** 指南 / 组件 / 高级用法是 TechArticle
 *      （有正文、有章节），首页是 SoftwareApplication（有应用类别与免费定价），
 *      其余营销页是 WebPage。全都写 WebPage 等于没说。
 *   2. **url 必须是这一页的 canonical。** 与 `utils/site-seo.js` 用同一个基准地址
 *      （`sites.ts` 的 SITES），否则结构化数据里的地址和 `<link rel=canonical>` 打架，
 *      搜索引擎会两个都不可信。
 *   3. **只写能从页面本身得到的事实。** 不写评分、不写作者、不写发布日期 —— 这些
 *      页面没有的东西，编出来就是假的（Google 对不上会整条忽略，甚至判为作弊）。
 *
 * 注入方式不用 unhead：脚本标签需要「换页时原地替换」，而 unhead 的 script 支持
 * 随版本变（v2 叫 textContent、v3 叫 innerHTML），写错了的表现是**标签静默不出现**。
 * 这里直接操作 DOM（`setJsonLd`），并能被 `scripts/gen-site-seo.mjs --check` 用假
 * document 真跑一遍。
 */
import { watchEffect } from 'vue'
import { SITES, SITE_KEY, siteOf } from './sites'

/** 本站基准地址（含结尾斜杠）—— 与 site-seo.js 同一份来源 */
const BASE = (siteOf(SITE_KEY) || SITES[0]).url

/** schema.org 的通用外壳；具体字段由各 builder 补 */
export interface JsonLd {
  '@context': 'https://schema.org'
  '@type': string
  [key: string]: unknown
}

/** 文章类路径（与 site-seo.js 的 ARTICLE_PREFIXES 同口径）：它们有静态 HTML */
const ARTICLE_PREFIXES = ['/guide/', '/components/', '/advanced/']

/**
 * 页内路径 → 绝对地址。
 *
 * 文章类路径用**路径式**（`…/es-plus/guide/x/`）：构建期会给每篇生成一份静态 HTML
 * （scripts/gen-prerender.mjs），那份 HTML 才是这一页的规范地址，structured data
 * 里的 url 必须和它一致 —— 写成 hash 形式会让两个地址指向同一内容。
 * 其余路由只有 hash 形式可打开，保持 `#/…`。
 */
const urlOf = (path: string) => {
  if (ARTICLE_PREFIXES.some((prefix) => path.startsWith(prefix))) return `${BASE}${path.slice(1)}/`
  return path === '/' ? BASE : `${BASE}#${path}`
}

/** 站名：三站清单里主站那一项的名字不在这里另起一份，直接拼产品名 */
const SITE_NAME = 'ES-Plus'

/** 文档类页面（指南 / 组件 / 高级用法）：有正文、有章节的文章 */
export function techArticle(input: {
  title: string
  description: string
  path: string
  section?: string
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.title,
    description: input.description,
    url: urlOf(input.path),
    inLanguage: 'zh-CN',
    ...(input.section ? { articleSection: input.section } : {}),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: BASE },
  }
}

/** 普通内容页：营销页、案例页、工具页 */
export function webPage(input: { title: string; description: string; path: string }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.title,
    description: input.description,
    url: urlOf(input.path),
    inLanguage: 'zh-CN',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: BASE },
  }
}

/**
 * 首页：这是一个什么软件。
 *
 * 定价写 0 是事实（三端文档与组件库都开源、MIT），不是营销话术 —— SoftwareApplication
 * 少了 offers 会被结构化数据测试判为不完整。
 */
export function softwareApplication(input: { title: string; description: string; path: string }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    alternateName: input.title,
    description: input.description,
    url: urlOf(input.path),
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    inLanguage: 'zh-CN',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
  }
}

/**
 * 写入 / 替换 head 里的 JSON-LD 脚本；传 null 则移除。
 *
 * 选择器带固定值，是为了让「换页时替换而不是追加」这件事可被验证 ——
 * 追加的话，从 /guide/a 走到 /guide/b 会留下两条互相矛盾的 TechArticle。
 */
export function setJsonLd(data: JsonLd | null): void {
  const selector = 'script[data-es-jsonld="page"]'
  const existing = document.head.querySelector(selector)
  if (!data) {
    if (existing) existing.parentNode?.removeChild(existing)
    return
  }
  const el = existing ?? document.createElement('script')
  el.setAttribute('type', 'application/ld+json')
  el.setAttribute('data-es-jsonld', 'page')
  el.textContent = JSON.stringify(data)
  if (!existing) document.head.appendChild(el)
}

/** 组件里用：源变了就重写（路由参数变化时标题/描述会跟着变） */
export function useJsonLd(source: () => JsonLd | null): void {
  watchEffect(() => setJsonLd(source()))
}
