import { ref, nextTick } from 'vue'

export function useTableSelection(rowkey?: string) {
  const multipleSelection = ref<Record<string, unknown>[]>([])
  const selectionsByPage = ref<Record<number, Record<string, unknown>[]>>({})
  const isInitChange = ref(false)

  const handleSelectionChange = (val: Record<string, unknown>[], currentPage: number) => {
    if (rowkey) {
      if (isInitChange.value) return
      selectionsByPage.value[currentPage] = val
      let allSelections: Record<string, unknown>[] = []
      const uniqueMap: Record<string, boolean> = {}

      Object.values(selectionsByPage.value).forEach((pageSelections) => {
        pageSelections.forEach((item) => {
          const key = item[rowkey] as string
          if (key && !uniqueMap[key]) {
            allSelections.push(item)
            uniqueMap[key] = true
          }
        })
      })

      multipleSelection.value = allSelections
    } else {
      multipleSelection.value = val
    }
  }

  const handleSelectData = (dataList: Record<string, unknown>[], tableRef: { toggleRowSelection?: (row: Record<string, unknown>, selected: boolean) => void }) => {
    if (dataList?.length && rowkey && multipleSelection.value.length) {
      const pageSelecteds: Record<string, unknown>[] = []
      dataList.forEach((row) => {
        multipleSelection.value.forEach((selectedRow) => {
          if (row[rowkey] === selectedRow[rowkey]) {
            pageSelecteds.push(row)
          }
        })
      })

      pageSelecteds.forEach((row) => {
        tableRef.toggleRowSelection?.(row, true)
      })
    }
  }

  const clearAllSelection = (tableRef: { clearSelection?: () => void }) => {
    multipleSelection.value = []
    selectionsByPage.value = {}
    tableRef.clearSelection?.()
  }

  const initSelection = (dataList: Record<string, unknown>[], tableRef: { toggleRowSelection?: (row: Record<string, unknown>, selected: boolean) => void; clearSelection?: () => void } | null) => {
    isInitChange.value = true
    if (!tableRef) {
      isInitChange.value = false
      return
    }
    if (rowkey) {
      nextTick(() => {
        handleSelectData(dataList, tableRef)
        isInitChange.value = false
      })
    } else {
      nextTick(() => {
        tableRef.clearSelection?.()
        isInitChange.value = false
      })
    }
  }

  return {
    multipleSelection,
    selectionsByPage,
    isInitChange,
    handleSelectionChange,
    handleSelectData,
    clearAllSelection,
    initSelection
  }
}
