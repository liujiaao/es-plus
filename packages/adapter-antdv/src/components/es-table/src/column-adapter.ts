/**
 * ADV 列配置适配器
 *
 * 将 ES-Plus TableColumn 转换为 Ant Design Vue 的 columns 配置。
 */
import type { TableColumn } from '../../../types'

/**
 * 将单个 ES-Plus 列配置转换为 ADV Table 列配置
 */
export function adaptColumn(col: TableColumn): Record<string, unknown> {
  const advCol: Record<string, unknown> = {}

  advCol.dataIndex = col.prop || col.key
  advCol.key = col.key || col.prop || `col_${Math.random().toString(36).slice(2, 8)}`

  if (col.label) advCol.title = col.label
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

  // 排序
  if (col.sortable) {
    advCol.sorter = col.sortable === 'custom'
      ? { compare: () => 0, multiple: 1 }
      : true
  }

  // 单元格/表头类名（保留原始配置，由 ADV 透传或后续 bodyCell 处理）
  if (col.cellClassName) advCol.className = col.cellClassName
  if (col.headerCellClassName) advCol.headerClassName = col.headerCellClassName

  // 保留原始列引用，供 bodyCell 插槽中的自定义渲染使用
  advCol._esCol = col

  return advCol
}

/**
 * 批量列转换（含序号列前置处理、groups 展平）
 */
export function adaptColumns(
  columns: TableColumn[],
  options: {
    snIndex?: boolean
  } = {}
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []

  // 序号列
  if (options.snIndex) {
    result.push({
      dataIndex: '_sn',
      key: '_sn',
      title: '#',
      width: 60,
      align: 'center',
      customRender: ({ index }: { index: number }) => index + 1,
    })
  }

  // 普通列（含 groups 展平）
  for (const col of columns) {
    if (col.groups && col.groups.length > 0) {
      for (const child of col.groups) {
        result.push(adaptColumn(child))
      }
    } else {
      result.push(adaptColumn(col))
    }
  }

  return result
}
