/**
 * ADV 列配置适配器
 *
 * 将 ES-Plus TableColumn 转换为 Ant Design Vue 的 columns 配置。
 * 对齐 @es-plus/vue3 use-column-adapter 的列处理（labelKey/sortable/groups/emptyPlaceholder）。
 */
import type { TableColumn } from '../../../types'

/**
 * 将单个 ES-Plus 列配置转换为 ADV Table 列配置
 * @param col ES-Plus 列配置
 * @param t   i18n 翻译函数（用于 labelKey）
 */
export function adaptColumn(col: TableColumn, t?: (key: string) => string): Record<string, unknown> {
  const advCol: Record<string, unknown> = {}

  // 分组列表头：仅 title + children，不设 dataIndex
  if (col.groups && col.groups.length > 0) {
    const groupTitle = (col.labelKey && t ? t(col.labelKey) : undefined) || col.label
    if (groupTitle) advCol.title = groupTitle
    advCol.children = col.groups.map((child) => adaptColumn(child, t))
    advCol._esCol = col
    return advCol
  }

  advCol.dataIndex = col.prop || col.key
  advCol.key = col.key || col.prop || `col_${Math.random().toString(36).slice(2, 8)}`

  // labelKey 国际化优先，其次 label（对齐 vue3）
  const title = (col.labelKey && t ? t(col.labelKey) : undefined) || col.label
  if (title) advCol.title = title
  if (col.width) advCol.width = col.width
  if (col.minWidth) advCol.minWidth = col.minWidth
  if (col.align) advCol.align = col.align

  // 固定列
  if (col.fixed === true) {
    advCol.fixed = 'left'
  } else if (col.fixed) {
    advCol.fixed = col.fixed
  }

  // 省略号
  if (col.ellipsis) advCol.ellipsis = true

  // 排序：sortable:'custom'（服务端）与 sortable:true 均映射为 sorter:true，
  // 由 a-table @change 的 sorter 触发服务端排序（对齐 vue3 sortable:'custom'）。
  // 不再用 compare:()=>0 的本地 no-op 排序。
  if (col.sortable) {
    advCol.sorter = true
  }

  // 单元格/表头类名
  if (col.cellClassName) advCol.className = col.cellClassName
  if (col.headerCellClassName) advCol.headerClassName = col.headerCellClassName

  // 保留原始列引用，供 bodyCell 插槽中的自定义渲染使用
  advCol._esCol = col

  return advCol
}

/**
 * 序号列（type:'index' / options.snIndex）→ ADV 列
 *
 * el-table 的 type:'index' 在 ADV 中无原生等价，用 customRender 渲染行序号。
 * @param col ES-Plus 列配置（可选，提供时取其 label/width/align）
 */
export function createSnAdvColumn(col?: TableColumn): Record<string, unknown> {
  return {
    dataIndex: '_sn',
    key: '_sn',
    title: (col?.label as string) || '#',
    width: typeof col?.width === 'number' ? col.width : 60,
    align: col?.align || 'center',
    customRender: ({ index }: { index: number }) => index + 1,
  }
}

/**
 * 批量列转换（含序号列前置处理、groups 展平）
 *
 * 选择列（type:'selection'）由组件通过 ADV rowSelection 渲染，此处跳过，
 * 不再生成空 dataIndex 列（对齐 vue3 type:'selection' 约定）。
 */
export function adaptColumns(
  columns: TableColumn[],
  options: {
    snIndex?: boolean
    t?: (key: string) => string
  } = {},
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []
  const hasIndexCol = columns.some((c) => c.type === 'index')

  // 序号列（options.snIndex 注入；已存在 type:'index' 列时跳过，避免重复）
  if (options.snIndex && !hasIndexCol) {
    result.push(createSnAdvColumn())
  }

  for (const col of columns) {
    // 选择列：ADV 通过 rowSelection 渲染，跳过
    if (col.type === 'selection') continue
    // 展开列：ADV 通过 expandedRowRender 整行渲染，不作为数据列（对齐 vxe/vue3）
    if (col.type === 'expand') continue
    // 序号列：type:'index' 等价 options.snIndex
    if (col.type === 'index') {
      result.push(createSnAdvColumn(col))
      continue
    }
    // 普通列（含 groups → children 递归）
    result.push(adaptColumn(col, options.t))
  }

  return result
}
