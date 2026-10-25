/**
 * 跨页选择集合管理（框架无关纯逻辑）
 *
 * 处理"分页表格 + 多选"场景下的跨页选中持久化：
 * - 用户在第 1 页选了 A、B
 * - 翻到第 2 页，选了 C
 * - 期望最终 multipleSelection = [A, B, C]，并在回到第 1 页时仍能看到 A、B 高亮
 *
 * 实现要点：
 * 1. 按 rowkey 去重 —— 同一行可能在多页中被切换状态
 * 2. selectionsByPage 按页缓存当前页的选择，最终 reduce 为去重的全集
 * 3. 当不传 rowkey 时退化为单页模式（没有跨页持久化）
 *
 * 提取自 packages/vue3/src/composables/use-table-selection.ts (1.3.5)，
 * 剥离 ref，把状态变更改为纯函数 + 由调用方持有可变状态。
 *
 * Vue 2 / Vue 3 渲染层各自创建 ref/reactive 包装这些状态。
 */

import type { ModelData } from './types'

/**
 * 跨页选择状态容器（框架无关）
 *
 * 调用方应在 ref/reactive 中包装一个 SelectionState 实例。
 * 直接修改 state 字段不会触发响应式，调用方需通过 setter 或重新赋值。
 */
export interface SelectionState {
  /** 跨页累计选中的全集（去重后） */
  multipleSelection: ModelData[]
  /** 按页缓存当前页的选择（key 为页码） */
  selectionsByPage: Record<number, ModelData[]>
  /** 标记当前正在初始化选择（用于阻断 toggleRowSelection 触发的循环回调） */
  isInitChange: boolean
}

/**
 * 创建空的选择状态
 */
export function createSelectionState(): SelectionState {
  return {
    multipleSelection: [],
    selectionsByPage: {},
    isInitChange: false,
  }
}

/**
 * 表格 ref 必须支持的最小子集（el-table / el-table-v2 共有方法）
 */
export interface TableRefLike {
  toggleRowSelection?: (row: ModelData, selected: boolean) => void
  clearSelection?: () => void
}

/**
 * 把行键归一化为可比对的字符串。
 *
 * 去重侧（`applySelectionChange`）与回显侧（`restoreSelectionForPage`）必须用**同一套**
 * 归一化，否则两处对「是不是同一行」的判断不一致：此前去重用 `String(key)`、
 * 回显用 `===`，于是第 1 页选中的 `{ id: 1 }` 在数据源把它序列化成 `'1'` 的第 2 页里
 * 回显不出来（数字与字符串不严格相等），表现为"翻页回来勾选丢了"。
 *
 * 键不存在（undefined/null）时返回 null 表示"该行无法参与跨页去重"。
 */
function normalizeRowKey(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : String(value)
}

/**
 * 处理 selection-change 事件 —— 把当前页选择合入全局集合并去重
 *
 * 注意：本函数直接 mutate state.selectionsByPage 与 state.multipleSelection。
 * 渲染层若需要触发响应式更新，应在调用前后通过浅拷贝或 ref.value = ... 重新赋值。
 *
 * @param state 选择状态
 * @param val 当前页 selection-change 抛出的最新选中行
 * @param currentPage 当前页码
 * @param rowkey 行唯一键（如 'id'），不传则退化为单页模式
 * @param cachePageSelection 是否启用跨页保留勾选（默认 true，向后兼容；
 *                           传 false 时即使有 rowkey 也不做跨页累积，等价单页选择）
 */
export function applySelectionChange(
  state: SelectionState,
  val: ModelData[],
  currentPage: number,
  rowkey?: string,
  cachePageSelection: boolean = true
): void {
  if (rowkey && cachePageSelection) {
    if (state.isInitChange) return
    state.selectionsByPage[currentPage] = val

    const allSelections: ModelData[] = []
    // 用 Map 而不是裸对象：裸对象的原型链上有 toString / constructor / valueOf /
    // hasOwnProperty 等既有键，`!uniqueMap['toString']` 恒为 false —— 行键恰好是
    // 这些字符串的行**永远选不中**；而 `uniqueMap['__proto__'] = true` 写的是原型，
    // 不产生自有属性，同一行会被重复收进全集。core 的 setNestedValue 早已防住
    // 同类原型污染，这里当时漏了。
    const seenKeys = new Map<string, true>()

    Object.values(state.selectionsByPage).forEach((pageSelections) => {
      pageSelections.forEach((item) => {
        const keyStr = normalizeRowKey((item as Record<string, unknown>)[rowkey])
        if (keyStr !== null && !seenKeys.has(keyStr)) {
          allSelections.push(item)
          seenKeys.set(keyStr, true)
        }
      })
    })

    state.multipleSelection = allSelections
  } else {
    state.multipleSelection = val
  }
}

/**
 * 翻页后回显历史选择 —— 在新一页数据中找出已经选中的行，调用 toggleRowSelection 高亮
 *
 * @param state 选择状态
 * @param dataList 当前页数据
 * @param tableRef Element 表格 ref
 * @param rowkey 行唯一键
 */
export function restoreSelectionForPage(
  state: SelectionState,
  dataList: ModelData[],
  tableRef: TableRefLike,
  rowkey?: string
): void {
  if (!dataList?.length || !rowkey || !state.multipleSelection.length) return

  // 先把已选键摊成 Set（O(选中数)），再对当前页做一次线性扫描 ——
  // 此前是「当前页每行 × 全量选中」的嵌套比较：翻到第 N 页时复杂度是
  // O(pageSize × 累计选中数)，几千行 × 上千选中即为百万级比较，且每次都发生在
  // 翻页的高频路径上。归一化与去重侧共用 normalizeRowKey（见其注释）。
  const selectedKeys = new Set<string>()
  state.multipleSelection.forEach((selectedRow) => {
    const k = normalizeRowKey((selectedRow as Record<string, unknown>)[rowkey])
    if (k !== null) selectedKeys.add(k)
  })

  const pageSelecteds: ModelData[] = []
  dataList.forEach((row) => {
    const k = normalizeRowKey((row as Record<string, unknown>)[rowkey])
    if (k !== null && selectedKeys.has(k)) {
      pageSelecteds.push(row)
    }
  })

  pageSelecteds.forEach((row) => {
    tableRef.toggleRowSelection?.(row, true)
  })
}

/**
 * 「这张表要不要跨页保留勾选」—— 三个 vxe 引擎与虚拟引擎共用的判据。
 *
 * 写成单源而不是每个引擎各写一遍，是因为此前三份 vxe 引擎都只看 `options.multiSelect`：
 *   · `columns: [{ type:'selection' }]` 是**另一种写法**（el-table / a-table / 虚拟引擎
 *     都认，且 el-table 端同样跨页保留），可切到 vxe 引擎后 reserve 不生效，翻页即丢勾选；
 *   · `cachePageSelection: false`（文档写明「关闭跨页缓存」）在 vxe 端被无视，勾选照样跨页。
 * 两者都表现为「同一份配置换个引擎行为就变」。
 *
 * @param options 只读 multiSelect / cachePageSelection
 * @param columns 原始列（显式声明的 `type:'selection'` 与 multiSelect 等价）
 */
export function wantsCrossPageSelection(
  options: { multiSelect?: boolean; cachePageSelection?: boolean } | null | undefined,
  columns: readonly { type?: string }[] | null | undefined
): boolean {
  if (!options) return false
  if (options.cachePageSelection === false) return false
  return options.multiSelect === true || (columns ?? []).some((col) => col?.type === 'selection')
}

/**
 * 汇总 vxe 引擎的「当前数据里已选 + 跨页保留」。
 *
 * vxe 的 `getCheckboxRecords()` 只覆盖**当前表格数据**：开了 `checkboxConfig.reserve`
 * 后，前几页选中的行会进入 reserve 集合、离开当前数据，于是只调它就会少报
 * （实测第 1 页勾 2 行、第 2 页勾 1 行，`getSelectionRows()` 只回 1 行）。
 * 跨页行必须从 `getCheckboxReserveRecords()` 取 —— 两者天然互斥（reserve 明确排除
 * 当前数据），这里仍按 rowkey 去重：去重是廉价的保险，不是修复某个已知重复。
 *
 * 不传 rowkey 时不去重（vxe 的 keyField 缺省为 'id'，调用方通常应显式传）。
 */
export function mergeSelectedRows<T extends Record<string, unknown>>(
  current: T[] | undefined,
  reserved: T[] | undefined,
  rowkey?: string
): T[] {
  const all = [...(current || []), ...(reserved || [])]
  if (!rowkey) return all
  const seen = new Map<string, true>()
  return all.filter((row) => {
    const key = normalizeRowKey(row[rowkey])
    if (key === null) return true
    if (seen.has(key)) return false
    seen.set(key, true)
    return true
  })
}

/**
 * 清空所有页的选择（含跨页缓存）
 */
export function clearAllSelection(state: SelectionState, tableRef: TableRefLike): void {
  state.multipleSelection = []
  state.selectionsByPage = {}
  // isInitChange 是 SelectionState 的一部分，清空必须把它一起复位：
  // 它会让 applySelectionChange 直接 early-return（:77），残留 true 就等于
  // 「清空之后用户再也选不中任何行」。三个渲染器各自在 nextTick 里复位它，
  // 但那是它们的时序，不是本函数的契约 —— 显式清空不应取决于调用方有没有走那条路径。
  state.isInitChange = false
  tableRef.clearSelection?.()
}
