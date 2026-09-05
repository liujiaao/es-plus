import { ref, nextTick } from 'vue'
import {
  createSelectionState,
  applySelectionChange,
  restoreSelectionForPage,
  clearAllSelection as coreClearAll,
  type TableRefLike,
} from '@es-plus/core'

export function useTableSelection(rowkey?: string, cachePageSelection: boolean = true) {
  const state = createSelectionState()
  const multipleSelection = ref<Record<string, unknown>[]>([])
  const selectionsByPage = ref<Record<number, Record<string, unknown>[]>>({})
  const isInitChange = ref(false)

  const sync = () => {
    multipleSelection.value = [...state.multipleSelection]
    selectionsByPage.value = { ...state.selectionsByPage }
    isInitChange.value = state.isInitChange
  }

  const handleSelectionChange = (val: Record<string, unknown>[], currentPage: number) => {
    if (state.isInitChange && rowkey && cachePageSelection) return
    applySelectionChange(state, val, currentPage, rowkey, cachePageSelection)
    sync()
  }

  const handleSelectData = (
    dataList: Record<string, unknown>[],
    tableRef: { toggleRowSelection?: (row: Record<string, unknown>, selected: boolean) => void }
  ) => {
    if (dataList?.length && rowkey && cachePageSelection && state.multipleSelection.length) {
      restoreSelectionForPage(state, dataList, tableRef as TableRefLike, rowkey)
    }
  }

  const clearAllSelection = (tableRef: TableRefLike | null | undefined) => {
    if (!tableRef) {
      state.multipleSelection = []
      state.selectionsByPage = {}
    } else {
      coreClearAll(state, tableRef)
    }
    sync()
  }

  const initSelection = (
    dataList: Record<string, unknown>[],
    tableRef: TableRefLike | null
  ) => {
    state.isInitChange = true
    sync()
    if (!tableRef) {
      state.isInitChange = false
      sync()
      return
    }
    if (rowkey && cachePageSelection) {
      nextTick(() => {
        restoreSelectionForPage(state, dataList, tableRef, rowkey)
        state.isInitChange = false
        sync()
      })
    } else {
      nextTick(() => {
        tableRef.clearSelection?.()
        state.isInitChange = false
        sync()
      })
    }
  }

  return {
    multipleSelection,
    selectionsByPage,
    isInitChange,
    handleSelectionChange,
    handleSelectData,
    clearAllSelection,
    initSelection,
  }
}
