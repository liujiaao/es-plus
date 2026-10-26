/**
 * 服务端排序契约（`tableOptions.sortParam`）—— 三端窄子集，纯 JSON。
 *
 * 背景：`columns[].sortable` 只决定「表头能不能点」，**排序在哪算**三端并不一致：
 *   - el-table / element-ui：默认在**当前页本地排**（翻页后顺序就乱了）；
 *   - a-table：`sorter: true` 是**服务端语义**（只切指示器 + 抛 change，不动数据）；
 *   - vxe：默认本地排，`sortConfig.remote` 才是服务端；
 *   - 虚拟引擎（table-v2）：本来就不排数据，只抛 `column-sort`。
 * 于是「点表头 → 后端按该列排序」这件事此前只能靠宿主自己接 `change-table-sort`。
 *
 * 本模块把这件事收敛成**一个声明**：`tableOptions.sortParam` 存在即表示
 * 「排序由后端算」。三端据此：
 *   1. 关掉本地排序（el 用 `sortable: 'custom'`、vxe 用 `sortConfig.remote`、
 *      a-table 的 `sorter: true` 本来就是服务端语义、虚拟引擎本来不排）；
 *   2. 每次请求都带上排序参数（字段名可配，默认 `sortField` / `sortOrder`）；
 *   3. 表头点击（`change-table-sort`）时**保留当前页**重新请求。
 *
 * 约定（三端一致）：
 *   - 值域只有 `'asc' | 'desc'`，未排序时**不发这两个参数**（后端看到"没有排序"）。
 *   - `defaultSort` 是首屏排序：开了 `sortParam` 时它同时作为**首次请求的排序参数**。
 *   - 清空排序（点第三下）→ 参数消失，重新请求一次。
 */

/** 排序参数的两个字段名。 */
export interface SortParamNames {
  field: string
  order: string
}

/** schema / options 里的声明形态：`true` 用默认名，对象可改字段名。 */
export type SortParamOption = boolean | { field?: string; order?: string }

/** 归一后的排序方向（三端只认这两种）。 */
export type TableSortOrder = 'asc' | 'desc'

/** 当前排序状态。`order: null` 表示排序被清掉。 */
export interface TableSortState {
  prop: string
  order: TableSortOrder | null
}

/** 默认参数名 —— 与主流中后台后端口径一致，避免每个项目都要配一次。 */
export const DEFAULT_SORT_PARAM_NAMES: SortParamNames = { field: 'sortField', order: 'sortOrder' }

/**
 * 解析声明。未声明（或缺省为 false）→ `null` = 保持本地排序（现状）。
 * 声明了就给出一对非空字段名（空串视为未配，回落默认）。
 */
export function resolveSortParam(options?: { sortParam?: SortParamOption } | null): SortParamNames | null {
  const raw = options?.sortParam
  if (!raw) return null
  if (raw === true) return { ...DEFAULT_SORT_PARAM_NAMES }
  const field = typeof raw.field === 'string' && raw.field.trim() ? raw.field : DEFAULT_SORT_PARAM_NAMES.field
  const order = typeof raw.order === 'string' && raw.order.trim() ? raw.order : DEFAULT_SORT_PARAM_NAMES.order
  return { field, order }
}

/**
 * 把三端各自的方向写法归一成 `'asc' | 'desc' | null`。
 *
 * 三个引擎的原文：
 *   - el-table / element-ui：`'ascending' | 'descending' | null`
 *   - iView / 虚拟引擎内部：`'asc' | 'desc'`
 *   - vxe：`'asc' | 'desc'`
 * 全部认，其余（含 undefined）一律 `null` = 未排序。
 */
export function normalizeSortOrder(order: unknown): TableSortOrder | null {
  if (order === 'asc' || order === 'ascending' || order === 'ascend') return 'asc'
  if (order === 'desc' || order === 'descending' || order === 'descend') return 'desc'
  return null
}

/**
 * `change-table-sort` 的 payload → 排序状态。
 *
 * 清空排序时 el-table / a-table 的 payload 形态不同（前者 order=null 但 prop 仍在，
 * 后者第三击 `column` 变 undefined 只留 field），所以列名三种写法都认。
 * 三者都拿不到列名 → `null`（不是一个可用的排序状态）。
 */
export function toTableSortState(
  payload?: { prop?: unknown; field?: unknown; key?: unknown; column?: unknown; order?: unknown } | null,
): TableSortState | null {
  if (!payload) return null
  const column = payload.column as { prop?: unknown; key?: unknown } | null | undefined
  const prop = payload.prop || payload.field || payload.key || column?.prop || column?.key
  if (typeof prop !== 'string' || !prop) return null
  return { prop, order: normalizeSortOrder(payload.order) }
}

/** 两个排序状态是否等价（用于「表头挂载时回抛的默认排序」去重，避免重复请求）。 */
export function sameSortState(a: TableSortState | null, b: TableSortState | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.prop === b.prop && a.order === b.order
}

/** `defaultSort` → 初始排序状态（未配 `prop` 时 null）。 */
export function seedSortState(defaultSort?: { prop?: string; order?: unknown } | null): TableSortState | null {
  const prop = defaultSort?.prop
  if (typeof prop !== 'string' || !prop) return null
  const order = normalizeSortOrder(defaultSort?.order)
  return order ? { prop, order } : null
}

/**
 * 生成要合并进请求参数的一对键值。
 *
 * 未声明 `sortParam`、或当前无排序 → `{}`（**不发空值**：后端据此判断"没要求排序"；
 * 发 `sortOrder: ''` 会让严格后端把空串当非法枚举）。
 */
export function buildSortParams(
  options?: { sortParam?: SortParamOption } | null,
  state?: TableSortState | null,
): Record<string, string> {
  const names = resolveSortParam(options)
  if (!names || !state || !state.prop || !state.order) return {}
  return { [names.field]: state.prop, [names.order]: state.order }
}
