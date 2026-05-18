import { describe, it, expect } from 'vitest'
import { useFormLayout } from './use-form-layout'

describe('useFormLayout', () => {
  it('should calculate row algorithm correctly', () => {
    const props = {
      layoutFormProps: {},
      formItemList: [
        { prop: 'a', span: 12 },
        { prop: 'b', span: 12 },
        { prop: 'c', span: 8 },
        { prop: 'd', span: 8 },
        { prop: 'e', span: 8 }
      ]
    }

    const { getRowColsAlgorithm } = useFormLayout(props)
    expect(getRowColsAlgorithm.value.rowNum).toBe(2)
    expect(getRowColsAlgorithm.value.columnRow.length).toBe(2)
  })

  it('should handle single item filling row', () => {
    const props = {
      layoutFormProps: {},
      formItemList: [
        { prop: 'a', span: 24 }
      ]
    }

    const { getRowColsAlgorithm } = useFormLayout(props)
    expect(getRowColsAlgorithm.value.rowNum).toBe(1)
  })

  it('should respect minFoldRows', () => {
    const props = {
      layoutFormProps: {
        fromLayProps: { minFoldRows: 1 }
      },
      formItemList: [
        { prop: 'a', span: 12 },
        { prop: 'b', span: 12 },
        { prop: 'c', span: 12 },
        { prop: 'd', span: 12 }
      ]
    }

    const { isFold } = useFormLayout(props)
    expect(isFold.value).toBe(true)
  })

  it('should return isFold false when items fit in minFoldRows', () => {
    const props = {
      layoutFormProps: {
        fromLayProps: { minFoldRows: 5 }
      },
      formItemList: [
        { prop: 'a', span: 12 },
        { prop: 'b', span: 12 }
      ]
    }

    const { isFold } = useFormLayout(props)
    expect(isFold.value).toBe(false)
  })

  it('should calculate btn col span based on remaining space', () => {
    const props = {
      layoutFormProps: {
        fromLayProps: { btnColSpan: 0 }
      },
      formItemList: [
        { prop: 'a', span: 18 }
      ]
    }

    const { getBtnColSpan } = useFormLayout(props)
    expect(getBtnColSpan.value).toBe(6)
  })

  it('should return 0 btn col span when full row leaves no space', () => {
    const props = {
      layoutFormProps: {},
      formItemList: [
        { prop: 'a', span: 24 }
      ]
    }

    const { getBtnColSpan } = useFormLayout(props)
    // When last row is fully occupied (span=24), hasSpan=0 and btnColSpan=0<=0 is true
    // so the function returns hasSpan=0 (button can fit in zero space = needs new row)
    expect(getBtnColSpan.value).toBe(0)
  })
})
