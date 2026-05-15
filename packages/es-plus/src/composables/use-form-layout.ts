import { computed, ref, watch } from 'vue'
import type { FormItemOption, LayoutFormProps } from '../types'

export function useFormLayout(props: { layoutFormProps?: LayoutFormProps; formItemList: FormItemOption[] }) {
  const folded = ref(false)

  const isBtnHidden = computed(() => props.layoutFormProps?.fromLayProps?.isBtnHidden ?? false)

  const rowLayout = computed(() => props.layoutFormProps?.rowLayProps || { gutter: 20 })

  const formLayout = computed(() => props.layoutFormProps?.fromLayProps || {})

  const getSetOptionsStatus = computed(() => props.layoutFormProps?.setOptions)

  const getRowColsAlgorithm = computed(() => {
    let pre = 0
    const groupArrayList: FormItemOption[][] = []
    const columnRows: { statIndex: number; endIndex: number }[] = []
    const formItems = props.formItemList

    for (let i = 0; i < formItems.length; i++) {
      const item = formItems[i]
      pre += item.span || 6
      if (pre > 24) {
        const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
        columnRows.push({ statIndex, endIndex: i })
        pre = item.span || 6
        if (i === formItems.length - 1) {
          columnRows.push({ statIndex: i, endIndex: i + 1 })
        }
      } else {
        if (i === formItems.length - 1) {
          const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
          columnRows.push({ statIndex, endIndex: i + 1 })
        } else if (pre === 24) {
          const statIndex = columnRows.length ? columnRows[columnRows.length - 1].endIndex : 0
          columnRows.push({ statIndex, endIndex: i + 1 })
          pre = 0
        }
      }
    }

    columnRows.forEach((it) => {
      groupArrayList.push(formItems.slice(it.statIndex, it.endIndex))
    })

    const columRowIndexs = groupArrayList.map((it) => {
      return it.map(() => 0)
    })

    let rowColIndex = -1
    columRowIndexs.forEach((row) => {
      row.forEach((_, idx) => {
        row[idx] = (rowColIndex += 1)
      })
    })

    return {
      columnRow: columRowIndexs,
      rowNum: columRowIndexs.length,
      columnNodeIndex: columRowIndexs.map((it) => it[it.length - 1])
    }
  })

  const isFold = computed(() => {
    const minFoldRow = props.layoutFormProps?.fromLayProps?.minFoldRows || 0
    return minFoldRow > 0 && minFoldRow < getRowColsAlgorithm.value.rowNum
  })

  const getBtnColSpan = computed(() => {
    const { rowNum, columnRow } = getRowColsAlgorithm.value
    const lastColumn = columnRow[rowNum - 1] || []
    const btnColSpan = props.layoutFormProps?.fromLayProps?.btnColSpan || 0
    const totalSpan = lastColumn.reduce((sum, idx) => sum + (props.formItemList[idx]?.span || 6), 0)
    const hasSpan = 24 - totalSpan

    return !folded.value && btnColSpan <= hasSpan ? hasSpan : 24
  })

  const formItem = computed(() => {
    const minFoldRow = props.layoutFormProps?.fromLayProps?.minFoldRows || 0
    const { columnNodeIndex } = getRowColsAlgorithm.value

    if (folded.value) {
      const lastFoldIndex = columnNodeIndex[minFoldRow - 1] ?? columnNodeIndex[columnNodeIndex.length - 1] ?? 9999
      return props.formItemList.map((it, index) => ({
        ...it,
        isFold: index > lastFoldIndex
      }))
    }
    return props.formItemList.map((it) => ({ ...it, isFold: false }))
  })

  watch(
    isFold,
    (val) => {
      folded.value = val
    },
    { immediate: true }
  )

  const changeFolded = () => {
    folded.value = !folded.value
  }

  return {
    folded,
    isBtnHidden,
    rowLayout,
    formLayout,
    getSetOptionsStatus,
    getRowColsAlgorithm,
    isFold,
    getBtnColSpan,
    formItem,
    changeFolded
  }
}
