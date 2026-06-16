/**
 * ADV 列配置适配器
 *
 * 将 ES-Plus TableColumn 转换为 Ant Design Vue 的 columns 配置。
 * 从 column-item.vue 提取为纯 TypeScript 模块（.vue SFC 不能在 <script setup> 中 export）。
 */
import type { TableColumn } from '../../../types'

/**
 * 将单个 ES-Plus 列配置转换为 ADV Table 列配置
 *
 * 关键映射：
 *   prop       → dataIndex
 *   label      → title
 *   ellipsis   → ellipsis (ADV 原生支持)
 *   sortable   → sorter (boolean)
 *   align      → align
 *   width      → width
 *   fixed      → fixed
 */
export function adaptColumn(col: TableColumn): Record<string, unknown> {
  const advCol: Record<string, unknown> = {}

  // 字段映射
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

  // 省略号 (ADV 原生 ellipsis 支持)
  if (col.ellipsis) advCol.ellipsis = true

  // 排序
  if (col.sortable) {
    advCol.sorter = col.sortable === 'custom'
      ? { compare: () => 0, multiple: 1 }
      : true
  }

  // 保留原始列引用，供 bodyCell 插槽中的自定义渲染使用
  advCol._esCol = col

  return advCol
}

/**
 * 批量列转换（含序号列前置处理）
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

  // 普通列
  for (const col of columns) {
    result.push(adaptColumn(col))
  }

  return result
}
