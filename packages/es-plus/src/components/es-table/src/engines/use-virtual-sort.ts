import { ref } from 'vue'
import type { TableColumn } from '../../../../types'

export interface SortState {
  key: string
  order: 'asc' | 'desc'
}

export function useVirtualSort() {
  const sortState = ref<SortState | undefined>(undefined)

  function onColumnSort({ key, order }: { key: string | number; order: 'asc' | 'desc' }) {
    const k = String(key)
    if (sortState.value?.key === k && sortState.value?.order === order) {
      sortState.value = undefined
    } else {
      sortState.value = { key: k, order }
    }
  }

  function toSortChangePayload(columns: TableColumn[]) {
    const key = sortState.value?.key || ''
    const order = sortState.value?.order || ''
    const col = columns.find(c => (c.prop || c.key) === key)
    return {
      column: col || null,
      prop: key,
      order: order === 'asc'
        ? 'ascending'
        : order === 'desc'
          ? 'descending'
          : null,
    }
  }

  return { sortState, onColumnSort, toSortChangePayload }
}
