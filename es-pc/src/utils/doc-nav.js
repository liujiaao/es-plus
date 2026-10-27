/**
 * es-pc 的文档页清单：面包屑分组、上下篇顺序、编辑此页、最后更新都由它派生。
 *
 * 为什么用一张表而不是到处读 route.meta：同一件事要回答四个问题 ——
 * 「这一页属于哪个分组」「上一篇/下一篇是谁」「正文在仓库哪个文件」
 * 「最后更新取哪个键的日期」。分散到四个地方写，改一条路由就要四处同步。
 *
 * key 必须与 scripts/doc-meta.mjs 的 DOC_SOURCES['es-pc'] 键一致（大小写敏感），
 * title 与 router 的 meta.title 保持一致（check:subpage-title 保证标题唯一）。
 *
 * 只有**真正的文档页**登记在这里：首页、案例、画廊、404 不是文档，不该有
 * 目录、上下篇和「最后更新」。
 */
export const DOC_NAV = [
  { key: 'guide', route: 'Guide', title: '快速上手', group: '指南', source: 'es-pc/src/views/Guide.vue' },

  { key: 'es-form', route: 'EsForm', title: 'EsForm 动态表单', group: '组件', source: 'es-pc/src/views/EsForm.vue' },
  { key: 'es-table', route: 'EsTable', title: 'EsTable 动态表格', group: '组件', source: 'es-pc/src/views/EsTable.vue' },
  { key: 'es-dialog', route: 'EsDialog', title: 'EsDialog 动态弹窗', group: '组件', source: 'es-pc/src/views/EsDialog.vue' },
  { key: 'es-crud-page', route: 'EsCrudPage', title: 'EsCrudPage CRUD页面', group: '组件', source: 'es-pc/src/views/EsCrudPage.vue' },
  { key: 'es-error-boundary', route: 'EsErrorBoundary', title: 'EsErrorBoundary 错误边界', group: '组件', source: 'es-pc/src/views/EsErrorBoundary.vue' },
  { key: 'svg-icon', route: 'SvgIcon', title: 'SvgIcon 图标', group: '组件', source: 'es-pc/src/views/SvgIcon.vue' },

  { key: 'advanced', route: 'Advanced', title: '高级联动', group: '高级', source: 'es-pc/src/views/Advanced.vue' },
  { key: 'es-vxe-table', route: 'EsVxeTable', title: 'vxe 高性能引擎', group: '高级', source: 'es-pc/src/views/EsVxeTable.vue' },

  { key: 'ai-tools', route: 'AiTools', title: 'AI 工具链', group: 'AI 工具链', source: 'es-pc/src/views/AiTools.vue' },
]

/** 路由名 → 文档页条目（非文档页返回 undefined，chrome 据此整体不渲染） */
export function docEntryForRouteName(name) {
  return DOC_NAV.find((item) => item.route === name)
}

/** 上下篇：顺序与侧边栏分组阅读顺序一致（跨分组连续，指南 → 组件 → 高级 → AI） */
export function docNeighbors(entry) {
  const index = DOC_NAV.indexOf(entry)
  if (index < 0) return { prev: null, next: null }
  return {
    prev: index > 0 ? DOC_NAV[index - 1] : null,
    next: index < DOC_NAV.length - 1 ? DOC_NAV[index + 1] : null,
  }
}
