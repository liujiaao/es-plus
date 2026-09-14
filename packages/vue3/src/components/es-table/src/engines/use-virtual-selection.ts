import { ref, computed, watch, type Ref } from 'vue'

export function useVirtualSelection(
  dataSource: Ref<Record<string, unknown>[]>,
  rowkey: string | Ref<string>
) {
  const selectedKeys = ref<Set<string>>(new Set())

  // rowkey 支持 ref/computed：每次存取时读取，运行期切换 rowkey 不再快照旧值。
  const getRowkey = () => (typeof rowkey === 'string' ? rowkey : rowkey.value)

  // O(1) — 直接比较 Set size 与数据长度
  const allSelected = computed(() => {
    if (dataSource.value.length === 0) return false
    return selectedKeys.value.size === dataSource.value.length
  })

  const indeterminate = computed(() => {
    const size = selectedKeys.value.size
    return size > 0 && size < dataSource.value.length
  })

  function onSelectRow(key: string, val: boolean) {
    const next = new Set(selectedKeys.value)
    if (val) {
      next.add(key)
    } else {
      next.delete(key)
    }
    selectedKeys.value = next
  }

  function onSelectAll(val: boolean) {
    if (val) {
      const next = new Set(selectedKeys.value)
      for (const row of dataSource.value) {
        next.add(String(row[getRowkey()] ?? ''))
      }
      selectedKeys.value = next
    } else {
      selectedKeys.value = new Set()
    }
  }

  function getSelectedRows(): Record<string, unknown>[] {
    const keys = selectedKeys.value
    if (keys.size === 0) return []
    const result: Record<string, unknown>[] = []
    for (const row of dataSource.value) {
      if (keys.has(String(row[getRowkey()] ?? ''))) {
        result.push(row)
      }
      if (result.length === keys.size) break
    }
    return result
  }

  function clearSelection() {
    selectedKeys.value = new Set()
  }

  function toggleRowSelection(row: Record<string, unknown>, selected?: boolean) {
    const key = String(row[getRowkey()] ?? '')
    if (selected === undefined) {
      onSelectRow(key, !selectedKeys.value.has(key))
    } else {
      onSelectRow(key, selected)
    }
  }

  function restoreSelections(keys: Set<string>) {
    selectedKeys.value = new Set(keys)
  }

  return {
    selectedKeys,
    allSelected,
    indeterminate,
    onSelectRow,
    onSelectAll,
    getSelectedRows,
    clearSelection,
    toggleRowSelection,
    restoreSelections,
  }
}
