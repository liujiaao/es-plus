import { describe, it, expect, vi } from 'vitest'
import {
  createSelectionState,
  applySelectionChange,
  restoreSelectionForPage,
  clearAllSelection,
} from '../src/table-selection'

const row = (id: number, name = `n${id}`) => ({ id, name })

describe('table-selection', () => {
  it('createSelectionState 返回空状态', () => {
    const s = createSelectionState()
    expect(s.multipleSelection).toEqual([])
    expect(s.selectionsByPage).toEqual({})
    expect(s.isInitChange).toBe(false)
  })

  it('单页（无 rowkey） 直接覆盖', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1), row(2)], 1)
    expect(s.multipleSelection).toHaveLength(2)
    applySelectionChange(s, [row(3)], 1)
    expect(s.multipleSelection).toEqual([row(3)])
  })

  it('多页累加（带 rowkey）', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1), row(2)], 1, 'id')
    applySelectionChange(s, [row(3)], 2, 'id')
    expect(s.multipleSelection.map((r) => (r as { id: number }).id)).toEqual([1, 2, 3])
  })

  it('翻页后清空当前页 → 该页选择被移除但其它页保留', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1)], 1, 'id')
    applySelectionChange(s, [row(2)], 2, 'id')
    expect(s.multipleSelection).toHaveLength(2)
    applySelectionChange(s, [], 2, 'id')
    expect(s.multipleSelection.map((r) => (r as { id: number }).id)).toEqual([1])
  })

  it('isInitChange=true 时跳过', () => {
    const s = createSelectionState()
    s.isInitChange = true
    applySelectionChange(s, [row(1)], 1, 'id')
    expect(s.multipleSelection).toEqual([])
  })

  it('restoreSelectionForPage 调用 toggleRowSelection', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1), row(2)], 1, 'id')
    const tableRef = { toggleRowSelection: vi.fn() }
    restoreSelectionForPage(s, [row(1), row(3)], tableRef, 'id')
    expect(tableRef.toggleRowSelection).toHaveBeenCalledTimes(1)
    expect(tableRef.toggleRowSelection).toHaveBeenCalledWith(row(1), true)
  })

  it('clearAllSelection 重置全部', () => {
    const s = createSelectionState()
    applySelectionChange(s, [row(1)], 1, 'id')
    const tableRef = { clearSelection: vi.fn() }
    clearAllSelection(s, tableRef)
    expect(s.multipleSelection).toEqual([])
    expect(s.selectionsByPage).toEqual({})
    expect(tableRef.clearSelection).toHaveBeenCalled()
  })
})
