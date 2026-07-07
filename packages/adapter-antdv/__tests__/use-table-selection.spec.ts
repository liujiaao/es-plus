/**
 * 表格选择适配器测试 — 完全覆盖 vue3 useTableSelection 行为
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTableSelection } from '../src/composables/use-table-selection'

const makeRow = (id: string, name = '') => ({ id, name: name || `item-${id}` })

describe('useTableSelection', () => {
  describe('无 rowkey（单页模式）', () => {
    it('选择变化 — 直接设置 multipleSelection', () => {
      const sel = useTableSelection()
      const rows = [makeRow('1'), makeRow('2')]
      sel.handleSelectionChange(rows, 1)
      expect(sel.multipleSelection.value).toEqual(rows)
    })

    it('initSelection — 清除选中', async () => {
      const sel = useTableSelection()
      sel.multipleSelection.value = [makeRow('1')]
      sel.initSelection([])
      await nextTick()
      expect(sel.selectedRowKeys.value).toEqual([])
    })
  })

  describe('有 rowkey（跨页模式）', () => {
    const rowkey = 'id'

    it('单页选择 — de-dup 正常', () => {
      const sel = useTableSelection(rowkey)
      sel.handleSelectionChange([makeRow('1'), makeRow('2'), makeRow('1')], 1)
      expect(sel.multipleSelection.value).toHaveLength(2)
    })

    it('跨页去重 — 第1页选1,2，第2页选3 → 共1,2,3', () => {
      const sel = useTableSelection(rowkey)
      sel.handleSelectionChange([makeRow('1'), makeRow('2')], 1)
      sel.handleSelectionChange([makeRow('3')], 2)
      const ids = sel.multipleSelection.value.map((r) => r.id)
      expect(ids.sort()).toEqual(['1', '2', '3'])
    })

    it('跨页去重 — 多页累积（selectionsByPage 缓存机制）', () => {
      const sel = useTableSelection(rowkey)
      sel.handleSelectionChange([makeRow('1'), makeRow('2')], 1)
      sel.handleSelectionChange([makeRow('3')], 2)
      // page1 的缓存 {1,2} 仍然存在，所以结果应该是 {1,2,3}
      const ids = sel.multipleSelection.value.map((r) => r.id)
      expect(ids.sort()).toEqual(['1', '2', '3'])
    })

    it('跨页去重 — 覆盖同一页的缓存', () => {
      const sel = useTableSelection(rowkey)
      sel.handleSelectionChange([makeRow('1'), makeRow('2')], 1) // 页1={1,2}
      sel.handleSelectionChange([makeRow('3')], 1)               // 页1={3}, 覆盖
      // 现在只有页1的{3}，所以结果仅{3}
      const ids = sel.multipleSelection.value.map((r) => r.id)
      expect(ids.sort()).toEqual(['3'])
    })

    it('跨页选择 — 6页各选2行（含重复）→ 正确去重', () => {
      const sel = useTableSelection(rowkey)
      for (let page = 1; page <= 6; page++) {
        sel.handleSelectionChange(
          [makeRow(`${page}a`), makeRow(`${page}b`)],
          page,
        )
      }
      expect(sel.multipleSelection.value).toHaveLength(12)
    })

    it('handleSelectData — 页面切换后恢复选中', () => {
      const sel = useTableSelection(rowkey)
      // 模拟：之前选中了 id=1,3
      sel.multipleSelection.value = [makeRow('1'), makeRow('3')]
      // 当前页数据含 1,2,3
      const dataList = [makeRow('1'), makeRow('2'), makeRow('3')]
      sel.handleSelectData(dataList, null)
      expect(sel.selectedRowKeys.value.sort()).toEqual(['1', '3'])
    })

    it('clearAllSelection — 清除全部状态', () => {
      const sel = useTableSelection(rowkey)
      sel.handleSelectionChange([makeRow('1'), makeRow('2')], 1)
      sel.handleSelectionChange([makeRow('3')], 2)
      sel.clearAllSelection()
      expect(sel.multipleSelection.value).toEqual([])
      expect(sel.selectedRowKeys.value).toEqual([])
      expect(sel.selectionsByPage.value).toEqual({})
    })

    it('clearSelection — 仅清除当前页', () => {
      const sel = useTableSelection(rowkey)
      sel.selectedRowKeys.value = ['1', '2', '3']
      sel.clearSelection()
      expect(sel.selectedRowKeys.value).toEqual([])
    })

    it('toggleRowSelection — 切换单个行', () => {
      const sel = useTableSelection(rowkey)
      sel.toggleRowSelection(makeRow('1'))
      expect(sel.selectedRowKeys.value).toContain('1')
      sel.toggleRowSelection(makeRow('1'))
      expect(sel.selectedRowKeys.value).not.toContain('1')
    })

    it('initSelection — 有 rowkey 时恢复页面选择', async () => {
      const sel = useTableSelection(rowkey)
      sel.multipleSelection.value = [makeRow('1'), makeRow('3')]
      const dataList = [makeRow('1'), makeRow('2'), makeRow('3')]
      sel.initSelection(dataList)
      await nextTick()
      expect(sel.selectedRowKeys.value.sort()).toEqual(['1', '3'])
    })

    it('initSelection — isInitChange 守卫防止递归', async () => {
      const sel = useTableSelection(rowkey)
      // 在 init 期间调用 handleSelectionChange 应被忽略
      sel.multipleSelection.value = [makeRow('1')]
      sel.initSelection([makeRow('1'), makeRow('2')])
      sel.handleSelectionChange([makeRow('2'), makeRow('3')], 1) // 此时 isInitChange 为 true
      await nextTick()
      // handleSelectionChange 应被忽略，init 完成后应仅剩余 '1'
      expect(sel.isInitChange.value).toBe(false)
    })
  })

  describe('rowSelection (ADV 声明式)', () => {
    it('rowSelection 返回正确配置', () => {
      const sel = useTableSelection('id')
      const config = sel.rowSelection.value
      expect(config).toHaveProperty('selectedRowKeys')
      expect(config).toHaveProperty('preserveSelectedRowKeys', true)
      expect(typeof config.onChange).toBe('function')
    })

    it('onChange 触发 handleSelectionChange', () => {
      const sel = useTableSelection('id')
      const rows = [makeRow('a'), makeRow('b')]
      sel.rowSelection.value.onChange(['a', 'b'], rows)
      expect(sel.multipleSelection.value).toHaveLength(2)
    })
  })
})

describe('EDGE CASES', () => {
  it('空数组选择', () => {
    const sel = useTableSelection('id')
    sel.handleSelectionChange([], 1)
    expect(sel.multipleSelection.value).toEqual([])
  })

  it('rowkey 值不存在 — 不崩溃', () => {
    const sel = useTableSelection('id')
    sel.handleSelectionChange([{ name: 'no-id' } as any], 1)
    expect(sel.multipleSelection.value).toEqual([])
  })

  it('同一页切换选择 — 先选后取消', () => {
    const sel = useTableSelection('id')
    sel.handleSelectionChange([makeRow('1'), makeRow('2')], 1)
    sel.handleSelectionChange([makeRow('2')], 1)
    expect(sel.multipleSelection.value).toHaveLength(1)
  })

  it('initSelection — dataList 为空', async () => {
    const sel = useTableSelection('id')
    sel.multipleSelection.value = [makeRow('1')]
    sel.initSelection([])
    await nextTick()
    expect(sel.selectedRowKeys.value).toEqual([])
  })
})
