import { describe, it, expect, vi } from 'vitest'
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

  describe('handleSelectData', () => {
    it('should toggle selection for matching rows', () => {
      const { handleSelectionChange, handleSelectData, multipleSelection } = useTableSelection('id')
      const toggleRowSelection = vi.fn()
      const tableRef = { toggleRowSelection }

      handleSelectionChange([{ id: 1, name: 'a' }, { id: 2, name: 'b' }], 1)
      const newPageData = [{ id: 1, name: 'a' }, { id: 3, name: 'c' }]

      handleSelectData(newPageData, tableRef)

      expect(toggleRowSelection).toHaveBeenCalledWith({ id: 1, name: 'a' }, true)
      expect(toggleRowSelection).toHaveBeenCalledTimes(1)
    })

    it('should do nothing when multipleSelection is empty', () => {
      const { handleSelectData } = useTableSelection('id')
      const toggleRowSelection = vi.fn()

      handleSelectData([{ id: 1 }], { toggleRowSelection })

      expect(toggleRowSelection).not.toHaveBeenCalled()
    })

    it('should do nothing when rowkey is not set', () => {
      const { handleSelectionChange, handleSelectData } = useTableSelection()
      const toggleRowSelection = vi.fn()

      handleSelectionChange([{ id: 1 }], 1)
      handleSelectData([{ id: 1 }], { toggleRowSelection })

      expect(toggleRowSelection).not.toHaveBeenCalled()
    })

    it('should do nothing for empty dataList', () => {
      const { handleSelectionChange, handleSelectData } = useTableSelection('id')
      const toggleRowSelection = vi.fn()

      handleSelectionChange([{ id: 1 }], 1)
      handleSelectData([], { toggleRowSelection })

      expect(toggleRowSelection).not.toHaveBeenCalled()
    })

    it('should handle multiple matches', () => {
      const { handleSelectionChange, handleSelectData } = useTableSelection('id')
      const toggleRowSelection = vi.fn()

      handleSelectionChange([{ id: 1 }, { id: 2 }, { id: 3 }], 1)
      handleSelectData([{ id: 1 }, { id: 2 }, { id: 4 }], { toggleRowSelection })

      expect(toggleRowSelection).toHaveBeenCalledTimes(2)
    })
  })
})
