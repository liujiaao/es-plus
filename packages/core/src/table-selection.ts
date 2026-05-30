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
 * 处理 selection-change 事件 —— 把当前页选择合入全局集合并去重
 *
 * 注意：本函数直接 mutate state.selectionsByPage 与 state.multipleSelection。
 * 渲染层若需要触发响应式更新，应在调用前后通过浅拷贝或 ref.value = ... 重新赋值。
 *
 * @param state 选择状态
 * @param val 当前页 selection-change 抛出的最新选中行
 * @param currentPage 当前页码
 * @param rowkey 行唯一键（如 'id'），不传则退化为单页模式
 */
export function applySelectionChange(
  state: SelectionState,
  val: ModelData[],
  currentPage: number,
  rowkey?: string
): void {
  if (rowkey) {
    if (state.isInitChange) return
    state.selectionsByPage[currentPage] = val

    const allSelections: ModelData[] = []
    const uniqueMap: Record<string, boolean> = {}

    Object.values(state.selectionsByPage).forEach((pageSelections) => {
      pageSelections.forEach((item) => {
        const key = item[rowkey] as string | number
        const keyStr = String(key)
        if (key !== undefined && key !== null && !uniqueMap[keyStr]) {
          allSelections.push(item)
          uniqueMap[keyStr] = true
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

  const pageSelecteds: ModelData[] = []
  dataList.forEach((row) => {
    state.multipleSelection.forEach((selectedRow) => {
      if (row[rowkey] === selectedRow[rowkey]) {
        pageSelecteds.push(row)
      }
    })
  })

  pageSelecteds.forEach((row) => {
    tableRef.toggleRowSelection?.(row, true)
  })
}

/**
 * 清空所有页的选择（含跨页缓存）
 */
export function clearAllSelection(state: SelectionState, tableRef: TableRefLike): void {
  state.multipleSelection = []
  state.selectionsByPage = {}
  tableRef.clearSelection?.()
}
