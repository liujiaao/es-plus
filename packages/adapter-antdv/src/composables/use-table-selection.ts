/**
 * ADV 表格选择适配 — 完全对齐 @es-plus/vue3 逻辑
 *
 * 关键差异：
 * - vue3 使用 el-table 的命令式 API (toggleRowSelection/clearSelection)
 * - ADV 使用 rowSelection 声明式配置
 *
 * 跨页选择累积逻辑复用 @es-plus/core applySelectionChange，消除维护偏离副本。
 * ADV 专有状态（selectedRowKeys / rowSelection / toggleRowSelection / setCurrentPage）保持不变。
 */
import { ref, nextTick, computed } from 'vue'
import {
  createSelectionState,
  applySelectionChange,
} from '@es-plus/core'

export function useTableSelection(rowkey?: string, cachePageSelection: boolean = true) {
  const state = createSelectionState()
  const multipleSelection = ref<Record<string, unknown>[]>([])
  const selectionsByPage = ref<Record<number, Record<string, unknown>[]>>({})
  const isInitChange = ref(false)

  // ─── ADV 声明式选择状态（对外给 a-table 的 :rowSelection 使用） ──
  const selectedRowKeys = ref<(string | number)[]>([])
  const currentPage = ref(1)
  const setCurrentPage = (page: number) => { currentPage.value = page }

  const sync = () => {
    multipleSelection.value = [...state.multipleSelection]
    selectionsByPage.value = { ...state.selectionsByPage }
    isInitChange.value = state.isInitChange
    if (rowkey) {
      selectedRowKeys.value = state.multipleSelection.map((r) => r[rowkey] as string | number)
    }
  }

  /**
   * ADV 声明式 rowSelection 配置
   */
  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    preserveSelectedRowKeys: cachePageSelection,
    onChange: (keys: (string | number)[], rows: Record<string, unknown>[]) => {
      handleSelectionChange(rows, currentPage.value)
    },
  }))

  /**
   * 选择变化处理 — 跨页累积逻辑复用 core applySelectionChange
   */
  const handleSelectionChange = (val: Record<string, unknown>[], page: number) => {
    applySelectionChange(state, val, page, rowkey, cachePageSelection)
    sync()
    if (!rowkey) {
      // 无 rowkey 时 selectedRowKeys 退化为当前页 id/key
      selectedRowKeys.value = val.map((r) => r.id || r.key || Object.values(r)[0]) as (string | number)[]
    }
  }

  /**
   * 页面切换后恢复选中状态 — selectedRowKeys 已是全量 key，
   * ADV preserveSelectedRowKeys 自动保持跨页选中。
   * 此处仅合并当前页命中行到 selectedRowKeys（对齐 vue3 toggleRowSelection 追加语义）。
   */
  const handleSelectData = (dataList: Record<string, unknown>[], _tableRef: unknown) => {
    const currentSelection = multipleSelection.value
    if (dataList?.length && rowkey && cachePageSelection && currentSelection.length) {
      const pageKeys = new Set(
        dataList
          .filter((row) => currentSelection.some((s) => s[rowkey] === row[rowkey]))
          .map((row) => row[rowkey] as string | number),
      )
      const merged = new Set(selectedRowKeys.value)
      pageKeys.forEach((k) => merged.add(k))
      selectedRowKeys.value = Array.from(merged)
    }
  }

  /**
   * 清除全部选择（含跨页缓存）
   */
  const clearAllSelection = (_tableRef?: unknown) => {
    state.multipleSelection = []
    state.selectionsByPage = {}
    state.isInitChange = false
    selectedRowKeys.value = []
    sync()
  }

  /**
   * 清除选择（对齐 vue3 clearSelection 清空语义：视觉 + 数据全清）
   */
  const clearSelection = () => {
    state.multipleSelection = []
    state.selectionsByPage = {}
    selectedRowKeys.value = []
    multipleSelection.value = []
    selectionsByPage.value = {}
  }

  /**
   * 切换行选中状态（同步 multipleSelection，保证 getSelectionRows 一致）
   */
  const toggleRowSelection = (row: Record<string, unknown>, selected?: boolean) => {
    if (!rowkey) return
    const key = row[rowkey] as string | number
    const exists = selectedRowKeys.value.includes(key)
    const shouldSelect = selected === undefined ? !exists : selected
    if (shouldSelect && !exists) {
      selectedRowKeys.value = [...selectedRowKeys.value, key]
      if (!state.multipleSelection.some((r) => r[rowkey] === key)) {
        state.multipleSelection = [...state.multipleSelection, row]
        multipleSelection.value = [...state.multipleSelection]
      }
    } else if (!shouldSelect && exists) {
      selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== key)
      state.multipleSelection = state.multipleSelection.filter((r) => r[rowkey] !== key)
      multipleSelection.value = [...state.multipleSelection]
    }
  }

  /**
   * 初始化选择状态 — 数据变化时调用
   */
  const initSelection = (dataList: Record<string, unknown>[]) => {
    // Only flip the guard flag — do NOT sync (which would wipe multipleSelection.value)
    state.isInitChange = true
    isInitChange.value = true
    if (rowkey && cachePageSelection) {
      nextTick(() => {
        handleSelectData(dataList, null)
        state.isInitChange = false
        isInitChange.value = false
      })
    } else {
      nextTick(() => {
        selectedRowKeys.value = []
        state.isInitChange = false
        isInitChange.value = false
      })
    }
  }

  return {
    multipleSelection,
    selectionsByPage,
    isInitChange,
    // ADV 声明式配置
    rowSelection,
    selectedRowKeys,
    currentPage,
    setCurrentPage,
    // 命令式 API（与 vue3 版本完全兼容）
    handleSelectionChange,
    handleSelectData,
    clearAllSelection,
    clearSelection,
    toggleRowSelection,
    initSelection,
  }
}
