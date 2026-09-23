import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useVirtualSelection } from '../src/components/es-table/src/engines/use-virtual-selection'

function makeDataSource(ids: number[]) {
  return ref(ids.map((id) => ({ id: String(id), name: `row_${id}` })))
}

// ─── 1. 初始状态 ──────────────────────────────────────────────────────────

describe('useVirtualSelection — 初始状态', () => {
  it('selectedKeys 初始为空 Set', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys } = useVirtualSelection(ds, 'id')
    expect(selectedKeys.value.size).toBe(0)
  })

  it('allSelected：数据为空时返回 false', () => {
    const ds = ref<Record<string, unknown>[]>([])
    const { allSelected } = useVirtualSelection(ds, 'id')
    expect(allSelected.value).toBe(false)
  })

  it('indeterminate：初始为 false', () => {
    const ds = makeDataSource([1, 2, 3])
    const { indeterminate } = useVirtualSelection(ds, 'id')
    expect(indeterminate.value).toBe(false)
  })
})

// ─── 2. onSelectRow ────────────────────────────────────────────────────────

describe('useVirtualSelection — onSelectRow', () => {
  it('选中一行 → selectedKeys 包含该 key', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys, onSelectRow } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    expect(selectedKeys.value.has('1')).toBe(true)
  })

  it('取消选中一行 → selectedKeys 不含该 key', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys, onSelectRow } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    onSelectRow('1', false)
    expect(selectedKeys.value.has('1')).toBe(false)
  })

  it('选中多行 → selectedKeys 包含多个 key', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys, onSelectRow } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    onSelectRow('2', true)
    expect(selectedKeys.value.size).toBe(2)
  })

  it('onSelectRow 不变更 Set 引用（immutable update）', () => {
    const ds = makeDataSource([1, 2])
    const { selectedKeys, onSelectRow } = useVirtualSelection(ds, 'id')
    const before = selectedKeys.value
    onSelectRow('1', true)
    expect(selectedKeys.value).not.toBe(before)
  })
})

// ─── 3. onSelectAll ────────────────────────────────────────────────────────

describe('useVirtualSelection — onSelectAll', () => {
  it('全选 → 所有行的 id 在 selectedKeys 中', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys, onSelectAll } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    expect(selectedKeys.value.has('1')).toBe(true)
    expect(selectedKeys.value.has('2')).toBe(true)
    expect(selectedKeys.value.has('3')).toBe(true)
  })

  it('全选后取消全选 → selectedKeys 为空', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys, onSelectAll } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    onSelectAll(false)
    expect(selectedKeys.value.size).toBe(0)
  })

  it('全选不清空已有选择（追加）', () => {
    const ds = makeDataSource([1, 2, 3])
    const { selectedKeys, onSelectRow, onSelectAll } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    onSelectAll(true)
    expect(selectedKeys.value.size).toBe(3)
  })
})

// ─── 4. allSelected / indeterminate 计算属性 ──────────────────────────────

describe('useVirtualSelection — allSelected & indeterminate', () => {
  it('全部选中 → allSelected:true, indeterminate:false', () => {
    const ds = makeDataSource([1, 2])
    const { onSelectAll, allSelected, indeterminate } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    expect(allSelected.value).toBe(true)
    expect(indeterminate.value).toBe(false)
  })

  it('部分选中 → allSelected:false, indeterminate:true', () => {
    const ds = makeDataSource([1, 2, 3])
    const { onSelectRow, allSelected, indeterminate } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    expect(allSelected.value).toBe(false)
    expect(indeterminate.value).toBe(true)
  })

  it('全不选 → allSelected:false, indeterminate:false', () => {
    const ds = makeDataSource([1, 2, 3])
    const { allSelected, indeterminate } = useVirtualSelection(ds, 'id')
    expect(allSelected.value).toBe(false)
    expect(indeterminate.value).toBe(false)
  })
})

// ─── 5. getSelectedRows ───────────────────────────────────────────────────

describe('useVirtualSelection — getSelectedRows', () => {
  it('无选中 → 返回空数组', () => {
    const ds = makeDataSource([1, 2, 3])
    const { getSelectedRows } = useVirtualSelection(ds, 'id')
    expect(getSelectedRows()).toEqual([])
  })

  it('选中指定行 → 返回对应的 row 对象', () => {
    const ds = makeDataSource([1, 2, 3])
    const { onSelectRow, getSelectedRows } = useVirtualSelection(ds, 'id')
    onSelectRow('2', true)
    const rows = getSelectedRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('2')
  })

  it('全选 → 返回所有行', () => {
    const ds = makeDataSource([10, 20, 30])
    const { onSelectAll, getSelectedRows } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    const rows = getSelectedRows()
    expect(rows).toHaveLength(3)
  })

  it('早停优化：找到 key.size 条即停止（结果正确）', () => {
    const ds = ref(Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1) })))
    const { onSelectRow, getSelectedRows } = useVirtualSelection(ds, 'id')
    onSelectRow('5', true)
    onSelectRow('10', true)
    const rows = getSelectedRows()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.id).sort()).toEqual(['10', '5'])
  })
})

// ─── 6. clearSelection ────────────────────────────────────────────────────

describe('useVirtualSelection — clearSelection', () => {
  it('清空后 selectedKeys 为空 Set', () => {
    const ds = makeDataSource([1, 2, 3])
    const { onSelectAll, clearSelection, selectedKeys } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    clearSelection()
    expect(selectedKeys.value.size).toBe(0)
  })

  it('清空后 allSelected:false', () => {
    const ds = makeDataSource([1, 2])
    const { onSelectAll, clearSelection, allSelected } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    clearSelection()
    expect(allSelected.value).toBe(false)
  })
})

// ─── 7. toggleRowSelection ────────────────────────────────────────────────

describe('useVirtualSelection — toggleRowSelection', () => {
  it('selected=true → 选中', () => {
    const ds = makeDataSource([1, 2])
    const { toggleRowSelection, selectedKeys } = useVirtualSelection(ds, 'id')
    toggleRowSelection({ id: '1' }, true)
    expect(selectedKeys.value.has('1')).toBe(true)
  })

  it('selected=false → 取消选中', () => {
    const ds = makeDataSource([1, 2])
    const { onSelectRow, toggleRowSelection, selectedKeys } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    toggleRowSelection({ id: '1' }, false)
    expect(selectedKeys.value.has('1')).toBe(false)
  })

  it('selected=undefined → 切换（已选变未选）', () => {
    const ds = makeDataSource([1, 2])
    const { onSelectRow, toggleRowSelection, selectedKeys } = useVirtualSelection(ds, 'id')
    onSelectRow('1', true)
    toggleRowSelection({ id: '1' })
    expect(selectedKeys.value.has('1')).toBe(false)
  })

  it('selected=undefined → 切换（未选变已选）', () => {
    const ds = makeDataSource([1, 2])
    const { toggleRowSelection, selectedKeys } = useVirtualSelection(ds, 'id')
    toggleRowSelection({ id: '2' })
    expect(selectedKeys.value.has('2')).toBe(true)
  })
})

// ─── 8. restoreSelections ─────────────────────────────────────────────────

describe('useVirtualSelection — restoreSelections', () => {
  it('传入 Set → selectedKeys 等于该 Set（新引用）', () => {
    const ds = makeDataSource([1, 2, 3])
    const { restoreSelections, selectedKeys } = useVirtualSelection(ds, 'id')
    const keys = new Set(['1', '3'])
    restoreSelections(keys)
    expect(selectedKeys.value.has('1')).toBe(true)
    expect(selectedKeys.value.has('3')).toBe(true)
    expect(selectedKeys.value.has('2')).toBe(false)
    expect(selectedKeys.value).not.toBe(keys)
  })

  it('传入空 Set → 清空选择', () => {
    const ds = makeDataSource([1, 2])
    const { onSelectAll, restoreSelections, selectedKeys } = useVirtualSelection(ds, 'id')
    onSelectAll(true)
    restoreSelections(new Set())
    expect(selectedKeys.value.size).toBe(0)
  })
})

// ─── 9. rowkey 边界：值为 null / undefined ─────────────────────────────────

describe('useVirtualSelection — rowkey 边界', () => {
  it('行的 rowkey 值为 null → 使用空字符串作为 key', () => {
    const ds = ref([{ id: null as any, name: 'row1' }])
    const { onSelectRow, getSelectedRows } = useVirtualSelection(ds, 'id')
    onSelectRow('', true)
    expect(getSelectedRows()).toHaveLength(1)
  })

  // 回归：rowkey 以原始字符串传入时是快照，运行期切换 rowkey 不生效
  it('rowkey 传入 ref：运行期切换后按新键选择/取行', () => {
    const ds = ref([{ id: '1', uid: 'u1', name: 'row1' }])
    const rowkey = ref('id')
    const { onSelectAll, getSelectedRows, selectedKeys } = useVirtualSelection(ds, rowkey)

    rowkey.value = 'uid'
    onSelectAll(true)
    expect(selectedKeys.value.has('u1')).toBe(true)
    expect(selectedKeys.value.has('1')).toBe(false)
    expect(getSelectedRows()).toHaveLength(1)
    expect(getSelectedRows()[0].name).toBe('row1')
  })
})

// ─── 10. 跨页：表头勾选态必须只看「本页」 ─────────────────────────────────
//
// `selectedKeys` 是跨页累积的（cachePageSelection），而 `allSelected` / `indeterminate`
// 此前拿 `selectedKeys.size` 与「本页行数」直接比 —— 两个基数根本不同源：
//   · 上一页全选（size=3）、当前页一行未选（3 行）→ size === length → 表头显示「全选」
//   · 当前页全选中、上一页的键还在（size=6，本页 3 行）→ 6 !== 3 → 表头显示「未全选」
// 于是翻页后表头勾选态与实际选择相反。

describe('useVirtualSelection — 跨页时的表头勾选态', () => {
  /** 模拟翻页：同一份 hook 实例，dataSource 换成下一页 */
  const setup = () => {
    const ds = makeDataSource([1, 2, 3])
    const api = useVirtualSelection(ds, 'id')
    return { ds, ...api }
  }

  it('上一页全选、当前页一行未选 → allSelected 必须是 false', () => {
    const { ds, onSelectAll, allSelected } = setup()
    onSelectAll(true) // 第 1 页 1..3 全选
    ds.value = makeDataSource([4, 5, 6]).value // 翻到第 2 页
    expect(allSelected.value).toBe(false)
  })

  it('当前页全选中（且上一页的键仍在） → allSelected 必须是 true', () => {
    const { ds, onSelectAll, allSelected } = setup()
    onSelectAll(true) // 第 1 页
    ds.value = makeDataSource([4, 5, 6]).value
    onSelectAll(true) // 第 2 页
    expect(allSelected.value).toBe(true)
  })

  it('上一页全选、当前页一行未选 → indeterminate 必须是 false', () => {
    const { ds, onSelectAll, indeterminate } = setup()
    onSelectAll(true)
    ds.value = makeDataSource([4, 5, 6]).value
    expect(indeterminate.value).toBe(false)
  })

  it('当前页只选了一行 → indeterminate 必须是 true', () => {
    const { ds, onSelectAll, onSelectRow, indeterminate } = setup()
    onSelectAll(true) // 第 1 页 1..3 全选
    ds.value = makeDataSource([4, 5, 6]).value
    onSelectRow('4', true) // 第 2 页只选一行
    expect(indeterminate.value).toBe(true)
  })

  it('当前页一行未选、但上一页有选中 → indeterminate 必须是 false', () => {
    const { ds, onSelectAll, indeterminate } = setup()
    onSelectAll(true)
    ds.value = makeDataSource([4, 5, 6]).value
    // 取消掉上一页的选择后仍留一个跨页键，确保 size 落在 (0, length) 区间内
    onSelectAll(false)
    ds.value = makeDataSource([1, 2, 3]).value
    onSelectAll(true)
    ds.value = makeDataSource([7, 8, 9]).value // 当前页一行未选
    expect(indeterminate.value).toBe(false)
  })
})
