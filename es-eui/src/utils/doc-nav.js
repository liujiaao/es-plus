/**
 * es-eui 的文档页清单：侧栏分组、面包屑、上下篇、编辑此页、最后更新都由它派生。
 *
 * 为什么用一张表：guide/index.vue 与 component/index.vue 此前各自手写了一份
 * router-link 列表，同一页的名字/顺序在两处各写一遍。改一条路由要同步四个地方
 * （路由、侧栏、面包屑、上下篇），而漏掉的那一处**不会报错**——只会让面包屑
 * 指到别的分组、或者上一篇跳到一个已改名的小节。表只有一份，就不存在漏。
 *
 * 字段约定：
 * - key    与 scripts/doc-meta.mjs 的 DOC_SOURCES['es-eui'] 键一致（就是 URL 路径），
 *          DocMeta 用它查「最后更新」；check:doc-nav 会断言两边键集相同。
 * - route  路由 name（路由名改了这里也要改，否则 chrome 整体不渲染 —— 是显式的
 *          失败，不是静默的错归组）。
 * - title  与路由 meta.title 逐字一致：一页只有一个名字，侧栏/面包屑/上下篇都用它。
 *          （此前侧栏写「快速上手」「自定义主题」，路由写「快速开始」「主题定制」，
 *          同一个页面两个名字。）
 * - group  侧栏分组标题，也是面包屑中间那一级。
 * - source 正文所在的**源文件**路径（编辑此页指向它，不是渲染后的地址）。
 *
 * 顺序即阅读顺序，也即「上一篇 / 下一篇」的顺序：指南 → 组件，跨分组连续。
 */
export const DOC_NAV = [
  // ── 开发指南 ──
  { key: '/guide', route: 'GuideIntroduction', title: '介绍', group: '开发指南', source: 'es-eui/src/views/guide/introduction.vue' },
  { key: '/guide/quickstart', route: 'GuideQuickstart', title: '快速开始', group: '开发指南', source: 'es-eui/src/views/guide/quickstart.vue' },
  { key: '/guide/installation', route: 'GuideInstallation', title: '安装', group: '开发指南', source: 'es-eui/src/views/guide/installation.vue' },
  { key: '/guide/configuration', route: 'GuideConfiguration', title: '全局配置', group: '开发指南', source: 'es-eui/src/views/guide/configuration.vue' },

  // ── 进阶 ──
  { key: '/guide/theme', route: 'GuideTheme', title: '主题定制', group: '进阶', source: 'es-eui/src/views/guide/theme.vue' },
  { key: '/guide/i18n', route: 'GuideI18n', title: '国际化', group: '进阶', source: 'es-eui/src/views/guide/i18n.vue' },
  { key: '/guide/developer-guide', route: 'DeveloperGuide', title: '开发者指南', group: '进阶', source: 'es-eui/src/views/docs/EsEuiDeveloperGuide.vue' },

  // ── 起步（组件站的安装/快速开始）──
  // 分组从「开发指南」改成「起步」：这两页讲的是组件怎么装、怎么跑第一屏，
  // 归在「开发指南」下会让面包屑出现「开发指南 / 组件安装」这种自相矛盾的层级。
  { key: '/component/installation', route: 'ComponentInstallation', title: '组件安装', group: '起步', source: 'es-eui/src/views/component/installation.vue' },
  { key: '/component/quickstart', route: 'ComponentQuickstart', title: '组件快速开始', group: '起步', source: 'es-eui/src/views/guide/quickstart.vue' },

  // ── 组件 ──
  { key: '/component/estable', route: 'EsTableDocs', title: 'EsTable 表格', group: '组件', source: 'es-eui/src/views/docs/EsTableDocs.vue' },
  { key: '/component/vxetable', route: 'VxeTableDocs', title: 'vxe-table 高性能表格', group: '组件', source: 'es-eui/src/views/docs/VxeTableDocs.vue' },
  { key: '/component/esform', route: 'EsFormDocs', title: 'EsForm 表单', group: '组件', source: 'es-eui/src/views/docs/EsFormDocs.vue' },
  { key: '/component/esdialog', route: 'EsDialogDocs', title: 'EsDialog 弹窗', group: '组件', source: 'es-eui/src/views/docs/EsDialogDocs.vue' },
  { key: '/component/escrudpage', route: 'EsCrudPageDocs', title: 'EsCrudPage 增删改查页', group: '组件', source: 'es-eui/src/views/docs/EsCrudPageDocs.vue' },
  { key: '/component/eserrorboundary', route: 'EsErrorBoundaryDocs', title: 'EsErrorBoundary 错误边界', group: '组件', source: 'es-eui/src/views/docs/EsErrorBoundaryDocs.vue' },
  { key: '/component/svgicon', route: 'SvgIconDocs', title: 'SvgIcon 图标', group: '组件', source: 'es-eui/src/views/docs/SvgIconDocs.vue' },
  { key: '/component/combination', route: 'CombinationDocs', title: '高级联动组合', group: '组件', source: 'es-eui/src/views/docs/CombinationDocs.vue' },
]

/** 路由名 → 文档页条目（不是文档页返回 undefined，chrome 据此整体不渲染） */
export function docEntryForRouteName(name) {
  return DOC_NAV.find((item) => item.route === name)
}

/** 上下篇：顺序与侧栏阅读顺序一致（指南 → 进阶 → 起步 → 组件，跨分组连续） */
export function docNeighbors(entry) {
  const index = DOC_NAV.indexOf(entry)
  if (index < 0) return { prev: null, next: null }
  return {
    prev: index > 0 ? DOC_NAV[index - 1] : null,
    next: index < DOC_NAV.length - 1 ? DOC_NAV[index + 1] : null,
  }
}

/**
 * 侧栏分组：[{ title, items: [...] }]，组序由调用方给（guide 壳只展示指南相关，
 * component 壳展示组件相关），组内顺序就是 DOC_NAV 的顺序。
 */
export function docSections(groups) {
  return (groups || [])
    .map((title) => ({ title, items: DOC_NAV.filter((item) => item.group === title) }))
    .filter((section) => section.items.length > 0)
}
