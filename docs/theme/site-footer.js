/**
 * 三站页脚数据（路线图 1.8）—— 无框架依赖的纯函数
 *
 * 单一权威源：`docs/theme/site-footer.js` → `scripts/sync-theme.mjs` 分发到三站
 * `src/utils/site-footer.js`，禁止手改各站点副本。
 *
 * ## 为什么由数据 + 纯函数构成，而不是共享组件
 *
 * 三站分别跑在 Vue 3（主站）、Vue 3 + antdv、Vue 2 + Element UI 上，**没有**可以
 * 三方共用的组件格式。能共享的是「有哪些栏、每栏有哪些链接、站内链接在本站叫什么
 * 路径」；渲染那一层只有二十行模板，各写一遍比引入跨版本组件桥接便宜得多。
 *
 * 站内路径是三站唯一真正不同的部分（`/guide/getting-started` vs `/guide` vs
 * `/guide/quickstart`），因此显式列成 `SITE_ROUTES`：写错的代价是页脚里一个 404，
 * 而这正是本批要消灭的东西，不能靠「大概能猜到」。
 */

/** 品牌与仓库常量（与 doc-chrome.js 的 REPO_URL/REPO_BRANCH 同一份事实，引用不复制） */
export const FOOTER_REPO = 'https://github.com/liujiaao/es-plus'
export const FOOTER_ISSUES = `${FOOTER_REPO}/issues/new`
export const FOOTER_LICENSE = `${FOOTER_REPO}/blob/master/LICENSE`
export const FOOTER_NPM = 'https://www.npmjs.com/package/@es-plus/vue3'

/**
 * 站内链接键 → 各站实际路径。
 * 键是语义（quickstart / components / cases），值必须与各站 router 真实存在。
 */
export const SITE_ROUTES = {
  'es-plus-docs': {
    quickstart: '/quickstart',
    components: '/components/es-form',
    cases: '/cases',
    guide: '/guide/getting-started',
    ai: '/ai-gallery',
  },
  'es-pc': {
    quickstart: '/quickstart',
    components: '/es-form',
    cases: '/cases',
    guide: '/guide',
    ai: '/ai-tools',
  },
  'es-eui': {
    quickstart: '/quickstart',
    components: '/component/esform',
    cases: '/cases',
    guide: '/guide/quickstart',
    ai: '/ai-tools',
  },
}

/** 三站身份（与 utils/sites 的 SITES 一一对应；这里只放页脚需要的三样） */
export const FOOTER_SITES = [
  { key: 'es-plus-docs', zh: 'Vue 3 · Element Plus', en: 'Vue 3 · Element Plus', href: 'https://liujiaao.github.io/es-plus/' },
  { key: 'es-pc', zh: 'Vue 3 · Ant Design Vue', en: 'Vue 3 · Ant Design Vue', href: 'https://liujiaao.github.io/es-plus/es-pc/' },
  { key: 'es-eui', zh: 'Vue 2 · Element UI', en: 'Vue 2 · Element UI', href: 'https://liujiaao.github.io/es-plus/es-eui/' },
]

/**
 * 生成页脚四列。
 *
 * @param {object} options
 * @param {'es-plus-docs'|'es-pc'|'es-eui'} options.siteKey 当前站点
 * @param {string} [options.locale] `zh`（默认）或 `en`
 * @param {string} [options.rendererZh] 底部版权行的中文渲染端名
 * @param {string} [options.rendererEn] 底部版权行的英文渲染端名
 * @returns {{ title: string, links: { text: string, href: string, external: boolean, current: boolean }[] }[]}
 */
export function buildFooterColumns({ siteKey, locale = 'zh', rendererZh = '', rendererEn = '' } = {}) {
  const en = String(locale).toLowerCase().startsWith('en')
  const routes = SITE_ROUTES[siteKey] || SITE_ROUTES['es-plus-docs']
  const route = (key) => routes[key] || '/'

  const item = (textZh, textEn, href, { external = false, current = false } = {}) => ({
    text: en ? textEn : textZh,
    href,
    external,
    current,
  })

  return [
    {
      title: en ? 'Product' : '产品',
      links: [
        item('快速开始', 'Quick start', route('quickstart')),
        item('组件 API', 'Components', route('components')),
        item('核心案例', 'Core cases', route('cases')),
        item('更新日志', 'Changelog', 'https://liujiaao.github.io/es-plus/#/guide/changelog', { external: true }),
      ],
    },
    {
      title: en ? 'Renderers' : '渲染端',
      links: FOOTER_SITES.map((site) =>
        item(site.zh, site.en, site.href, { external: true, current: site.key === siteKey })
      ),
    },
    {
      title: en ? 'Resources' : '资源',
      links: [
        item('GitHub 仓库', 'GitHub', FOOTER_REPO, { external: true }),
        item('npm 包', 'npm package', FOOTER_NPM, { external: true }),
        item('AI 工具链', 'AI toolchain', route('ai')),
        item('报告问题', 'Report an issue', FOOTER_ISSUES, { external: true }),
      ],
    },
  ]
}

/**
 * 底部版权行：品牌 · 定位 ／ © 年份 · 本站渲染端 · 许可证。
 * 返回纯文本片段数组，由各站模板用分隔符拼起来（避免模板里再写一遍年份逻辑）。
 */
export function buildFooterMeta({ locale = 'zh', rendererZh = '', rendererEn = '', year = new Date().getFullYear(), positioningZh = '', positioningEn = '' } = {}) {
  const en = String(locale).toLowerCase().startsWith('en')
  const renderer = en ? rendererEn : rendererZh
  const positioning = en ? positioningEn : positioningZh
  const parts = [positioning ? `ES-Plus · ${positioning}` : 'ES-Plus', `© ${year}`, renderer ? `${renderer}${en ? '' : ' 渲染端'}` : '', en ? 'MIT License' : 'MIT 许可证']
  return parts.filter(Boolean)
}
