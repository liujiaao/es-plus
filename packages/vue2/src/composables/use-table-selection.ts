/**
 * EsTable 跨页选择状态 composable —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异：
 *   - ref/nextTick 来自 './vue-compat'
 *   - 选择集合算法 100% 复用 @es-plus/core/table-selection
 *
 * 实现说明：
 *   - core 层的 SelectionState 是普通对象，直接 mutate 不会触发响应式
 *   - 因此本 wrapper 在每次状态变更后调用 sync()，把字段同步到 ref，触发视图更新
 *   - rowkey 由 wrapper 在闭包中持有，转发给 core 函数
 */

import { ref, nextTick } from '../vue-compat'
import {
  createSelectionState,
  applySelectionChange,
  restoreSelectionForPage,
  clearAllSelection as coreClearAll,
  type TableRefLike,
} from '@es-plus/core'

export function useTableSelection(rowkey?: string) {
  const state = createSelectionState()
  const multipleSelection = ref<Record<string, unknown>[]>([])
  const selectionsByPage = ref<Record<number, Record<string, unknown>[]>>({})
  const isInitChange = ref(false)

  // 把 core state 的字段同步到 ref —— Vue 2 通过浅拷贝触发响应式
  const sync = () => {
    multipleSelection.value = [...state.multipleSelection]
    selectionsByPage.value = { ...state.selectionsByPage }
    isInitChange.value = state.isInitChange
  }

  const handleSelectionChange = (val: Record<string, unknown>[], currentPage: number) => {
    if (state.isInitChange && rowkey) return
    applySelectionChange(state, val, currentPage, rowkey)
    sync()
  }

  const clearAllSelection = (tableRef: TableRefLike | null) => {
    if (!tableRef) {
      // 没有 tableRef 时手工重置 state（core 要求 tableRef 非空）
      state.multipleSelection = []
      state.selectionsByPage = {}
    } else {
      coreClearAll(state, tableRef)
    }
    sync()
  }

  const initSelection = (dataList: Record<string, unknown>[], tableRef: TableRefLike | null) => {
    state.isInitChange = true
    sync()
    if (!tableRef) {
      state.isInitChange = false
      sync()
      return
    }
    if (rowkey) {
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
    clearAllSelection,
    initSelection,
  }
}
