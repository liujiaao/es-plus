import { ref, computed, watch, type Ref } from 'vue'

/**
 * 虚拟引擎（el-table-v2）的选择状态。
 *
 * 跨页语义与 el-table / vxe 对齐：
 *   · `cachePageSelection !== false` 时跨页累积勾选；为 false 时翻页即丢弃上一页的勾选
 *     （此前无条件是累积的，`cachePageSelection:false` 在虚拟引擎下被无视）；
 *   · `getSelectedRows()` 返回**跨页全集** —— 只存 key 是不够的：翻到第 2 页后，
 *     第 1 页的行已经不在 `dataSource` 里，只按 key 扫当前页会少报（与 vxe 的
 *     `getCheckboxRecords` 同一个坑），所以这里同时记 key → 行对象；
 *   · 表头「取消全选」只清当前页（el-table / vxe 的 reserve 语义都是按页操作）。
 */
export function useVirtualSelection(
  dataSource: Ref<Record<string, unknown>[]>,
  rowkey: string | Ref<string>,
  cachePageSelection: boolean | Ref<boolean> = true
) {
  const selectedKeys = ref<Set<string>>(new Set())
  // key → 行对象。不放进 ref：只有 getSelectedRows 读它，不需要触发渲染。
  const rowsByKey = new Map<string, Record<string, unknown>>()

  // rowkey 支持 ref/computed：每次存取时读取，运行期切换 rowkey 不再快照旧值。
  const getRowkey = () => (typeof rowkey === 'string' ? rowkey : rowkey.value)
  const cacheOn = () =>
    typeof cachePageSelection === 'boolean' ? cachePageSelection : cachePageSelection.value
  const keyOf = (row: Record<string, unknown>) => String(row[getRowkey()] ?? '')

  const selectedOnPage = computed(() => {
    // 「本页」已选中的行数。
    //
    // `selectedKeys` 是**跨页累积**的（cachePageSelection），与「当前页行数」不是同一个基数：
    // 直接比 `selectedKeys.size === dataSource.length` 会让表头勾选态与实际选择相反 ——
    // 上一页全选过（size 恰好等于本页行数）就显示「全选」，而本页一行都没选；
    // 本页全选中但上一页的键还留着（size 更大）反而显示「未全选」。
    // 因此两个计算属性都必须按本页逐行判定。
    const keys = selectedKeys.value
    if (keys.size === 0) return 0
    let count = 0
    for (const row of dataSource.value) {
      if (keys.has(keyOf(row))) count++
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
      const row = dataSource.value.find((r) => keyOf(r) === key)
      if (row) rowsByKey.set(key, row)
    } else {
      next.delete(key)
      rowsByKey.delete(key)
    }
    selectedKeys.value = next
  }

  function onSelectAll(val: boolean) {
    const next = new Set(selectedKeys.value)
    for (const row of dataSource.value) {
      const key = keyOf(row)
      if (val) {
        next.add(key)
        rowsByKey.set(key, row)
      } else {
        next.delete(key)
        rowsByKey.delete(key)
      }
    }
    selectedKeys.value = next
  }

  function getSelectedRows(): Record<string, unknown>[] {
    const keys = selectedKeys.value
    if (keys.size === 0) return []
    const result: Record<string, unknown>[] = []
    for (const key of keys) {
      const row = rowsByKey.get(key) ?? dataSource.value.find((r) => keyOf(r) === key)
      if (row) result.push(row)
    }
    return result
  }

  /**
   * 当前页已选行 —— `selection-change` 的载荷口径（与 el-table / a-table / vxe 一致：
   * 事件只带当前页，跨页全集走 `getSelectedRows()`）。
   */
  function getPageSelectedRows(): Record<string, unknown>[] {
    const keys = selectedKeys.value
    if (keys.size === 0) return []
    return dataSource.value.filter((row) => keys.has(keyOf(row)))
  }

  function clearSelection() {
    selectedKeys.value = new Set()
    rowsByKey.clear()
  }

  function toggleRowSelection(row: Record<string, unknown>, selected?: boolean) {
    const key = keyOf(row)
    if (selected === undefined) {
      onSelectRow(key, !selectedKeys.value.has(key))
    } else {
      onSelectRow(key, selected)
    }
  }

  function restoreSelections(keys: Set<string>) {
    selectedKeys.value = new Set(keys)
    rowsByKey.clear()
  }

  // 数据换页：①刷新仍选中的行的对象引用（数据可能是新数组）；②关闭跨页缓存时丢弃
  // 不在本页的键 —— 这样 `cachePageSelection:false` 与 el-table 路径同义。
  watch(dataSource, (list) => {
    const pageKeys = new Set(list.map(keyOf))
    const next = new Set<string>()
    for (const key of selectedKeys.value) {
      if (pageKeys.has(key)) {
        next.add(key)
        const row = list.find((r) => keyOf(r) === key)
        if (row) rowsByKey.set(key, row)
      } else if (cacheOn()) {
        next.add(key)
      } else {
        rowsByKey.delete(key)
      }
    }
    selectedKeys.value = next
  })

  return {
    selectedKeys,
    allSelected,
    indeterminate,
    onSelectRow,
    onSelectAll,
    getSelectedRows,
    getPageSelectedRows,
    clearSelection,
    toggleRowSelection,
    restoreSelections,
  }
}
