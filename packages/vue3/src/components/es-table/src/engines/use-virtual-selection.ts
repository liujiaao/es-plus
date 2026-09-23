import { ref, computed, type Ref } from 'vue'

export function useVirtualSelection(
  dataSource: Ref<Record<string, unknown>[]>,
  rowkey: string | Ref<string>
) {
  const selectedKeys = ref<Set<string>>(new Set())

  // rowkey 支持 ref/computed：每次存取时读取，运行期切换 rowkey 不再快照旧值。
  const getRowkey = () => (typeof rowkey === 'string' ? rowkey : rowkey.value)

  /**
   * 「本页」已选中的行数。
   *
   * `selectedKeys` 是**跨页累积**的（cachePageSelection），与「当前页行数」不是同一个基数：
   * 直接比 `selectedKeys.size === dataSource.length` 会让表头勾选态与实际选择相反 ——
   * 上一页全选过（size 恰好等于本页行数）就显示「全选」，而本页一行都没选；
   * 本页全选中但上一页的键还留着（size 更大）反而显示「未全选」。
   * 因此两个计算属性都必须按本页逐行判定。
   */
  const selectedOnPage = computed(() => {
    const keys = selectedKeys.value
    if (keys.size === 0) return 0
    const rk = getRowkey()
    let count = 0
    for (const row of dataSource.value) {
      if (keys.has(String(row[rk] ?? ''))) count++
    }
    return count
  })

  const allSelected = computed(() => {
    const len = dataSource.value.length
    if (len === 0) return false
    return selectedOnPage.value === len
  })

  const indeterminate = computed(() => {
    const n = selectedOnPage.value
    return n > 0 && n < dataSource.value.length
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
