/**
 * 表格单元格展示解析 —— 声明式 `TableColumn.dataOptions` 的**单一权威实现**。
 *
 * 为什么必须放在 core：同一个「码值 → 展示文本 / 标签色」要在 **三端 × 各引擎**
 * （vue3 / vue2 / antdv 的默认引擎，vue3 虚拟引擎，三端 vxe 适配器）里保持一致。
 * 各写一份，最先漂移的一定是空值兜底与「没命中选项」的回退值 —— 默认 formatter 就
 * 曾在三端各写了一遍 `value == null || value === '' ? '-' : value`。
 *
 * 渲染端只消费这里的结果：拿到 `tagType` 就用自家 Tag 组件包一层，否则直接输出文本。
 */

import type { ModelData, TableColumn, TableColumnDataOption } from './types'
import { getNestedValue } from './shared'
import { looseEqual } from './expr'

/**
 * 在列的 `dataOptions` 里查找命中该值的选项。
 *
 * 比较用 `looseEqual`（number ↔ string 宽松相等）：后端返回 `1` 而配置写 `"1"`
 * 是最常见的形态，严格相等会让整列静默回退成原始码值。
 *
 * 空值（`null` / `undefined` / `''`）**不参与匹配** —— 否则一个 `value: ''` 的
 * 「未选择」选项会把空单元格也渲染成标签。
 */
export function findTableDataOption(
  options: TableColumnDataOption[] | undefined,
  value: unknown,
): TableColumnDataOption | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined
  if (value === null || value === undefined || value === '') return undefined
  return options.find((option) => !!option && looseEqual(option.value, value))
}

/** 单元格最终要展示的内容：文本 + 可选标签语义色。 */
export interface TableCellDisplay {
  text: string
  tagType?: TableColumnDataOption['tagType']
}

/**
 * 把一行的单元格值解析成展示内容。
 *
 * 规则（三端同规）：
 *   1. 取 `row[prop]`，缺省回退 `row[key]`（支持 `a.b` / `list[0].name` 嵌套路径）；
 *   2. 空值 → `emptyPlaceholder`（默认 `'-'`）；
 *   3. 命中 `dataOptions` → 选项的 `label`（带 `tagType` 时由渲染端包成标签）；
 *   4. 未命中 → 原始值字符串化（**不回退成占位符**：没登记的新状态码仍要能看见）。
 */
export function resolveTableCellDisplay(
  column: Pick<TableColumn, 'prop' | 'key' | 'emptyPlaceholder' | 'dataOptions'>,
  row: ModelData | undefined,
): TableCellDisplay {
  const value =
    row == null
      ? undefined
      : getNestedValue(row, (column.prop as string) || '') ??
        getNestedValue(row, (column.key as string) || '')
  if (value == null || value === '') {
    return { text: (column.emptyPlaceholder as string) || '-' }
  }
  const hit = findTableDataOption(column.dataOptions, value)
  if (hit) return { text: hit.label, tagType: hit.tagType }
  return { text: String(value) }
}
