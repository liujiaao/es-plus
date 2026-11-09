/**
 * 列筛选的**单一权威语义**（W3-2）。
 *
 * ## 为什么需要它
 *
 * `filters` / `filterMultiple` 在 el-table、a-table、vxe 上的**控件与本地过滤兜底**各不相同：
 *
 *   - el-table / element-ui：无 `filter-method` 时按 `row[property] === value` 严格比较；
 *   - a-table：无 `onFilter` 时按 `record[key] === value` 严格比较（且 dataIndex 可能是数组路径）；
 *   - vxe：无 `filterMethod` 时按 `valueList.indexOf(get(row, field))` 严格比较。
 *
 * 三条默认实现都是严格相等，但**后端返回 `1`、配置写 `"1"`** 是最常见的形态 —— 同一份列
 * 配置在三端都能渲染，筛选却「点了没反应」。这里把比较规则收成一份（与 `dataOptions`
 * 用同一把 `looseEqual`），各引擎只做签名适配，语义不再各写一遍。
 *
 * ## `filterMode`
 *
 * - `'equals'`（缺省）：宽松相等（number ↔ string 互通），与 dataOptions 的码值匹配同规；
 * - `'includes'`：字符串包含（单元格值 `String(cellValue).includes(String(filterValue))`）。
 *
 * 复合单元格值（数组/对象）不做结构匹配 —— 那是 `filterMethod` 函数扩展点的事（Tier C，
 * 不进 AI 契约）。
 */

import type { ColumnFilterMode, TableColumn } from './types.js'
import { getNestedValue } from './shared.js'
import { looseEqual } from './expr.js'

/** 规范化 `filterMode`：未知值一律按缺省 `'equals'`（容忍存量配置里的拼写误差）。 */
export function normalizeFilterMode(mode: unknown): ColumnFilterMode {
  return mode === 'includes' ? 'includes' : 'equals'
}

/**
 * 单元格值是否命中某个筛选值。
 *
 * 空单元格只与空筛选值匹配（`''`）—— 否则一个 `value: ''` 的「未填写」选项会把
 * 所有空行都筛出来，与 `findTableDataOption` 的「空值不参与匹配」刻意不同：筛选面板里
 * 「未填写」是合法且常用的选项，这里必须能选中。
 */
export function matchesColumnFilter(
  cellValue: unknown,
  filterValue: unknown,
  mode: unknown = 'equals',
): boolean {
  if (normalizeFilterMode(mode) === 'includes') {
    return String(cellValue ?? '').includes(String(filterValue ?? ''))
  }
  return filterValueEquals(cellValue, filterValue)
}

/** 宽松相等：number ↔ string ↔ boolean 之间按字符串比较（空值只与空值相等）。 */
function filterValueEquals(cellValue: unknown, filterValue: unknown): boolean {
  if (cellValue === filterValue) return true
  const cellEmpty = cellValue === null || cellValue === undefined || cellValue === ''
  const filterEmpty = filterValue === null || filterValue === undefined || filterValue === ''
  if (cellEmpty || filterEmpty) return cellEmpty && filterEmpty
  const primitive = (v: unknown) =>
    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  if (primitive(cellValue) && primitive(filterValue)) {
    return looseEqual(cellValue, filterValue) || String(cellValue) === String(filterValue)
  }
  return false
}

/** 取列绑定的字段路径（`prop` 优先，与三端单元格取值同规）。 */
export function columnFilterKey(col: Pick<TableColumn, 'prop' | 'key'>): string | undefined {
  const key = (col.prop as string) || (col.key as string) || ''
  return key || undefined
}

/** 该列是否声明了可用的筛选（有 filters 且有可绑定字段）。 */
export function hasColumnFilters(col: Pick<TableColumn, 'prop' | 'key' | 'filters'>): boolean {
  return Array.isArray(col.filters) && col.filters.length > 0 && !!columnFilterKey(col)
}

/**
 * P2-3：`autoFilters` → 从 `dataOptions` 合成 `filters`（单源，三端只调用不重写）。
 *
 * 规则：
 *   - 显式 `filters` 永远优先（用户写的那份是权威）；
 *   - `autoFilters !== true` 或 `dataOptions` 为空时原样返回；
 *   - 分组列递归处理子列（筛选按钮挂在各自子列上）；
 *   - 非数据列（`type: index/selection/expand`）不合成 —— 它们没有可筛选字段。
 *
 * 虚拟引擎没有筛选 UI，调用方应跳过本函数（否则会触发「filters 不会渲染」的告警）。
 *
 * 入参用结构最小面（而非 core `TableColumn`）：三端各有更宽的列类型，泛型返回
 * 让调用方保持本端类型，列在 `withDataOptions` / `withColumnFilters` 链上不必来回强转。
 */
interface AutoFilterColumn {
  type?: unknown
  groups?: readonly AutoFilterColumn[]
  filters?: readonly unknown[]
  dataOptions?: readonly { label?: unknown; value?: unknown }[]
  autoFilters?: boolean
}

export function withAutoFilters<T extends AutoFilterColumn>(col: T): T {
  if (Array.isArray(col.groups) && col.groups.length) {
    return {
      ...col,
      groups: col.groups.map((g) => withAutoFilters(g)),
    } as unknown as T
  }
  if (col.type) return col
  if (Array.isArray(col.filters) && col.filters.length > 0) return col
  if (col.autoFilters !== true) return col
  const options = Array.isArray(col.dataOptions) ? col.dataOptions : []
  if (!options.length) return col
  return {
    ...col,
    filters: options.map((o) => ({ text: o.label as string, value: o.value })),
  } as unknown as T
}


/**
 * 合成「本地筛选」谓词：`(filterValue, row) => boolean`。
 *
 * 三端引擎的适配：
 *   - el-table `filter-method(value, row, column)`；
 *   - a-table `onFilter(value, record)`；
 *   - vxe `filterMethod({ value, row, cellValue, column })`。
 *
 * 列上显式给了 `filterMethod`（函数扩展点，Tier C）时返回 `undefined` —— 调用方原样
 * 透传用户函数，不覆盖。
 */
export function buildColumnFilterMethod(
  col: Pick<TableColumn, 'prop' | 'key' | 'filters' | 'filterMode' | 'filterMethod'>,
): ((filterValue: unknown, row: Record<string, unknown>) => boolean) | undefined {
  if (typeof col.filterMethod === 'function') return undefined
  if (!hasColumnFilters(col)) return undefined
  const path = columnFilterKey(col) as string
  const mode = normalizeFilterMode(col.filterMode)
  return (filterValue, row) => matchesColumnFilter(getNestedValue(row, path), filterValue, mode)
}
