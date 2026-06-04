import { describe, it, expect } from 'vitest'
import { useFormLayout } from './use-form-layout'
import type { LayoutFormProps, FormItemOption } from '../types'

// Helper to type the props object to avoid excess-property-check issues
// after LayoutFormProps gained the new formLayProps field
const makeProps = (p: { layoutFormProps?: LayoutFormProps; formItemList: FormItemOption[] }) => p

describe('useFormLayout', () => {
  it('should calculate row algorithm correctly', () => {
    const props = makeProps({
      layoutFormProps: {},
      formItemList: [
        { prop: 'a', label: 'a', span: 12 },
        { prop: 'b', label: 'b', span: 12 },
        { prop: 'c', label: 'c', span: 8 },
        { prop: 'd', label: 'd', span: 8 },
        { prop: 'e', label: 'e', span: 8 }
      ]
    })

    const { getRowColsAlgorithm } = useFormLayout(props)
    expect(getRowColsAlgorithm.value.rowNum).toBe(2)
    expect(getRowColsAlgorithm.value.columnRow.length).toBe(2)
  })

  it('should handle single item filling row', () => {
    const props = makeProps({
      layoutFormProps: {},
      formItemList: [
        { prop: 'a', label: 'a', span: 24 }
      ]
    })

    const { getRowColsAlgorithm } = useFormLayout(props)
    expect(getRowColsAlgorithm.value.rowNum).toBe(1)
  })

  it('should respect minFoldRows', () => {
    const props = makeProps({
      layoutFormProps: {
        fromLayProps: { minFoldRows: 1 }
      },
      formItemList: [
        { prop: 'a', label: 'a', span: 12 },
        { prop: 'b', label: 'b', span: 12 },
        { prop: 'c', label: 'c', span: 12 },
        { prop: 'd', label: 'd', span: 12 }
      ]
    })

    const { isFold } = useFormLayout(props)
    expect(isFold.value).toBe(true)
  })

  it('should also respect formLayProps (correct spelling)', () => {
    const props = makeProps({
      layoutFormProps: {
        formLayProps: { minFoldRows: 1 }
      },
      formItemList: [
        { prop: 'a', label: 'a', span: 12 },
        { prop: 'b', label: 'b', span: 12 },
        { prop: 'c', label: 'c', span: 12 },
        { prop: 'd', label: 'd', span: 12 }
      ]
    })

    const { isFold } = useFormLayout(props)
    expect(isFold.value).toBe(true)
  })

  it('should return isFold false when items fit in minFoldRows', () => {
    const props = makeProps({
      layoutFormProps: {
        fromLayProps: { minFoldRows: 5 }
      },
      formItemList: [
        { prop: 'a', label: 'a', span: 12 },
        { prop: 'b', label: 'b', span: 12 }
      ]
    })

    const { isFold } = useFormLayout(props)
    expect(isFold.value).toBe(false)
  })

  it('should calculate btn col span based on remaining space', () => {
    const props = makeProps({
      layoutFormProps: {
        fromLayProps: { btnColSpan: 0 }
      },
      formItemList: [
        { prop: 'a', label: 'a', span: 18 }
      ]
    })

    const { getBtnColSpan } = useFormLayout(props)
    expect(getBtnColSpan.value).toBe(6)
  })

  it('should return 0 btn col span when full row leaves no space', () => {
    const props = makeProps({
      layoutFormProps: {},
      formItemList: [
        { prop: 'a', label: 'a', span: 24 }
      ]
    })

    const { getBtnColSpan } = useFormLayout(props)
    // When last row is fully occupied (span=24), hasSpan=0 and btnColSpan=0<=0 is true
    // so the function returns hasSpan=0 (button can fit in zero space = needs new row)
    expect(getBtnColSpan.value).toBe(0)
  })

  describe('changeFolded', () => {
    it('should toggle folded state', () => {
      const props = makeProps({
        layoutFormProps: {
          fromLayProps: { minFoldRows: 1 }
        },
        formItemList: [
          { prop: 'a', label: 'a', span: 12 },
          { prop: 'b', label: 'b', span: 12 },
          { prop: 'c', label: 'c', span: 12 },
          { prop: 'd', label: 'd', span: 12 }
        ]
      })

      const { folded, changeFolded } = useFormLayout(props)
      expect(folded.value).toBe(true)

      changeFolded()
      expect(folded.value).toBe(false)

      changeFolded()
      expect(folded.value).toBe(true)
    })
  })

  describe('formItem with fold state', () => {
    it('should mark items beyond fold threshold with isFold=true when folded', () => {
      const props = makeProps({
        layoutFormProps: {
          fromLayProps: { minFoldRows: 1 }
        },
        formItemList: [
          { prop: 'a', label: 'a', span: 12 },
          { prop: 'b', label: 'b', span: 12 },
          { prop: 'c', label: 'c', span: 12 },
          { prop: 'd', label: 'd', span: 12 }
        ]
      })

      const { formItem, folded } = useFormLayout(props)
      expect(folded.value).toBe(true)

      const foldedItems = formItem.value.filter((it: any) => it.isFold)
      const visibleItems = formItem.value.filter((it: any) => !it.isFold)
      expect(visibleItems.length).toBeGreaterThan(0)
      expect(foldedItems.length).toBeGreaterThan(0)
    })

    it('should mark all items with isFold=false when not folded', () => {
      const props = makeProps({
        layoutFormProps: {
          fromLayProps: { minFoldRows: 1 }
        },
        formItemList: [
          { prop: 'a', label: 'a', span: 12 },
          { prop: 'b', label: 'b', span: 12 },
          { prop: 'c', label: 'c', span: 12 },
          { prop: 'd', label: 'd', span: 12 }
        ]
      })

      const { formItem, changeFolded } = useFormLayout(props)
      changeFolded()

      const foldedItems = formItem.value.filter((it: any) => it.isFold)
      expect(foldedItems.length).toBe(0)
    })

    it('should not fold when items fit within minFoldRows', () => {
      const props = makeProps({
        layoutFormProps: {
          fromLayProps: { minFoldRows: 3 }
        },
        formItemList: [
          { prop: 'a', label: 'a', span: 12 },
          { prop: 'b', label: 'b', span: 12 }
        ]
      })

      const { formItem } = useFormLayout(props)
      const foldedItems = formItem.value.filter((it: any) => it.isFold)
      expect(foldedItems.length).toBe(0)
    })
  })

  describe('getBtnColSpan with folded state', () => {
    it('should return 24 when folded', () => {
      const props = makeProps({
        layoutFormProps: {
          fromLayProps: { minFoldRows: 1 }
        },
        formItemList: [
          { prop: 'a', label: 'a', span: 12 },
          { prop: 'b', label: 'b', span: 12 },
          { prop: 'c', label: 'c', span: 12 },
          { prop: 'd', label: 'd', span: 12 }
        ]
      })

      const { getBtnColSpan, folded } = useFormLayout(props)
      expect(folded.value).toBe(true)
      expect(getBtnColSpan.value).toBe(24)
    })
  })
})
