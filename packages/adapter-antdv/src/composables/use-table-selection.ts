/**
 * ADV 表格选择适配 — 完全对齐 @es-plus/vue3 逻辑
 *
 * 关键差异：
 * - vue3 使用 el-table 的命令式 API (toggleRowSelection/clearSelection)
 * - ADV 使用 rowSelection 声明式配置
 *
 * 本模块封装 ADV 的声明式选择，对外暴露与 vue3 版本完全兼容的接口。
 */
import { ref, nextTick, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export function useTableSelection(rowkey?: string) {
  const multipleSelection = ref<Record<string, unknown>[]>([])
  const selectionsByPage = ref<Record<number, Record<string, unknown>[]>>({})
  const isInitChange = ref(false)

  // ─── ADV 声明式选择状态（对外给 a-table 的 :rowSelection 使用） ──
  const selectedRowKeys = ref<(string | number)[]>([])
  const currentPage = ref(1)
  const setCurrentPage = (page: number) => { currentPage.value = page }

  /**
   * ADV 声明式 rowSelection 配置
   */
  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    preserveSelectedRowKeys: true,
    onChange: (keys: (string | number)[], rows: Record<string, unknown>[]) => {
      handleSelectionChange(rows, currentPage.value)
    },
  }))

  /**
   * 选择变化处理 — 与 vue3 版本完全一致的逻辑
   */
  const handleSelectionChange = (val: Record<string, unknown>[], page: number) => {
    if (rowkey) {
      if (isInitChange.value) return
      selectionsByPage.value[page] = val
      const allSelections: Record<string, unknown>[] = []
      const uniqueMap: Record<string, boolean> = {}

      Object.values(selectionsByPage.value).forEach((pageSelections) => {
        pageSelections.forEach((item) => {
          const key = item[rowkey] as string
          if (key && !uniqueMap[key]) {
            allSelections.push(item)
            uniqueMap[key] = true
          }
        })
      })

      multipleSelection.value = allSelections
      // 同步到 ADV 的 selectedRowKeys
      selectedRowKeys.value = allSelections.map((r) => r[rowkey] as string | number)
    } else {
      multipleSelection.value = val
      selectedRowKeys.value = val.map((r) => r.id || r.key || Object.values(r)[0]) as (string | number)[]
    }
  }

  /**
   * 页面切换后恢复选中状态 — ADV 通过 selectedRowKeys 自动保持选中
   * 这里仅更新 multipleSelection 以保持同步
   */
  const handleSelectData = (dataList: Record<string, unknown>[], _tableRef: unknown) => {
    if (dataList?.length && rowkey && multipleSelection.value.length) {
      const pageSelecteds: Record<string, unknown>[] = []
      dataList.forEach((row) => {
        multipleSelection.value.forEach((selectedRow) => {
          if (row[rowkey] === selectedRow[rowkey]) {
            pageSelecteds.push(row)
          }
        })
      })
      // 更新当前页的 selectedRowKeys
      selectedRowKeys.value = pageSelecteds.map((r) => r[rowkey] as string | number)
    }
  }

  /**
   * 清除全部选择（含跨页缓存）
   */
  const clearAllSelection = (_tableRef?: unknown) => {
    multipleSelection.value = []
    selectionsByPage.value = {}
    selectedRowKeys.value = []
  }

  /**
   * 仅清除当前页选择
   */
  const clearSelection = () => {
    selectedRowKeys.value = []
  }

  /**
   * 切换行选中状态
   */
  const toggleRowSelection = (row: Record<string, unknown>, selected?: boolean) => {
    if (!rowkey) return
    const key = row[rowkey] as string | number
    if (selected === false || selectedRowKeys.value.includes(key)) {
      selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== key)
    } else {
      selectedRowKeys.value = [...selectedRowKeys.value, key]
    }
  }

  /**
   * 初始化选择状态 — 数据变化时调用
   * vue3 版本在 initSelection 中调用 handleSelectData 恢复选中
   */
  const initSelection = (dataList: Record<string, unknown>[]) => {
    isInitChange.value = true
    if (rowkey) {
      nextTick(() => {
        handleSelectData(dataList, null)
        isInitChange.value = false
      })
    } else {
      nextTick(() => {
        selectedRowKeys.value = []
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
