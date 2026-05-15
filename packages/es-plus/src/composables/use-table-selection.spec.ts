import { describe, it, expect } from 'vitest'
import { useTableSelection } from './use-table-selection'

describe('useTableSelection', () => {
  it('should handle basic selection without rowkey', () => {
    const { handleSelectionChange, multipleSelection } = useTableSelection()
    const rows = [{ id: 1 }, { id: 2 }]

    handleSelectionChange(rows, 1)
    expect(multipleSelection.value).toEqual(rows)
  })

  it('should cache selections per page with rowkey', () => {
    const { handleSelectionChange, multipleSelection } = useTableSelection('id')

    handleSelectionChange([{ id: 1 }, { id: 2 }], 1)
    handleSelectionChange([{ id: 3 }], 2)

    expect(multipleSelection.value).toHaveLength(3)
    expect(multipleSelection.value.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('should deduplicate across pages with rowkey', () => {
    const { handleSelectionChange, multipleSelection } = useTableSelection('id')

    handleSelectionChange([{ id: 1 }], 1)
    handleSelectionChange([{ id: 1 }, { id: 2 }], 2)

    expect(multipleSelection.value).toHaveLength(2)
  })

  it('should skip during init change', () => {
    const { handleSelectionChange, initSelection, multipleSelection } = useTableSelection('id')

    const tableRef = {
      toggleRowSelection: () => {},
      clearSelection: () => {}
    }

    initSelection([{ id: 1 }, { id: 2 }], tableRef)
    handleSelectionChange([{ id: 3 }], 1)

    expect(multipleSelection.value).toEqual([])
  })

  it('should clear all selection', () => {
    const { handleSelectionChange, clearAllSelection, multipleSelection } = useTableSelection('id')

    handleSelectionChange([{ id: 1 }], 1)
    const tableRef = { clearSelection: () => {} }
    clearAllSelection(tableRef)

    expect(multipleSelection.value).toEqual([])
  })
})
