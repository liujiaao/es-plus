/**
 * 表单布局测试 — 24栅格算法 + 折叠逻辑
 */
import { describe, it, expect } from 'vitest'
import { useFormLayout } from '../src/composables/use-form-layout'
import type { FormItemOption } from '../src/types'

const makeField = (prop: string, span?: number): FormItemOption => ({
  prop, label: prop, span, formtype: 'Input',
})

describe('useFormLayout — 24 栅格算法', () => {
  it('1个字段 span=8 → 1行', () => {
    const items = [makeField('name', 8)]
    const layout = useFormLayout({ formItemList: items })
    expect(layout.getRowColsAlgorithm.value.rowNum).toBe(1)
  })

  it('4个字段各 span=6 → 1行 (4×6=24)', () => {
    const items = [
      makeField('a', 6), makeField('b', 6),
      makeField('c', 6), makeField('d', 6),
    ]
    const layout = useFormLayout({ formItemList: items })
    expect(layout.getRowColsAlgorithm.value.rowNum).toBe(1)
  })

  it('3个字段各 span=8 → 1行 (3×8=24)', () => {
    const items = [makeField('a', 8), makeField('b', 8), makeField('c', 8)]
    const layout = useFormLayout({ formItemList: items })
    expect(layout.getRowColsAlgorithm.value.rowNum).toBe(1)
  })

  it('4个字段各 span=8 → 2行 (4×8=32>24)', () => {
    const items = [
      makeField('a', 8), makeField('b', 8),
      makeField('c', 8), makeField('d', 8),
    ]
    const layout = useFormLayout({ formItemList: items })
    expect(layout.getRowColsAlgorithm.value.rowNum).toBe(2)
  })

  it('5个字段各 span=8 → 2行 (3+2)', () => {
    const items = [
      makeField('a', 8), makeField('b', 8), makeField('c', 8),
      makeField('d', 8), makeField('e', 8),
    ]
    const layout = useFormLayout({ formItemList: items })
    const result = layout.getRowColsAlgorithm.value
    expect(result.rowNum).toBe(2)
    // 第一行 3 列，第二行 2 列
    expect(result.columnRow[0]).toHaveLength(3)
    expect(result.columnRow[1]).toHaveLength(2)
  })

  it('单个字段 span=24 → 1行1列', () => {
    const items = [makeField('full', 24)]
    const layout = useFormLayout({ formItemList: items })
    const result = layout.getRowColsAlgorithm.value
    expect(result.rowNum).toBe(1)
    expect(result.columnRow[0]).toHaveLength(1)
  })

  it('2个字段 span=12 → 1行2列', () => {
    const items = [makeField('a', 12), makeField('b', 12)]
    const layout = useFormLayout({ formItemList: items })
    expect(layout.getRowColsAlgorithm.value.rowNum).toBe(1)
  })

  it('空列表 → 无行', () => {
    const layout = useFormLayout({ formItemList: [] })
    expect(layout.getRowColsAlgorithm.value.rowNum).toBe(0)
  })

  it('columnNodeIndex 返回每行末尾字段索引', () => {
    const items = [
      makeField('a', 8), makeField('b', 8), makeField('c', 8),
      makeField('d', 8), makeField('e', 8),
    ]
    const layout = useFormLayout({ formItemList: items })
    const { columnNodeIndex } = layout.getRowColsAlgorithm.value
    // 第一行: c(index 2), 第二行: e(index 4)
    expect(columnNodeIndex).toEqual([2, 4])
  })
})

describe('useFormLayout — 折叠逻辑', () => {
  it('minFoldRows=0 → 不折叠', () => {
    const items = [
      makeField('a', 8), makeField('b', 8), makeField('c', 8),
      makeField('d', 8), makeField('e', 8), makeField('f', 8),
    ]
    const layout = useFormLayout({
      formItemList: items,
      layoutFormProps: { formLayProps: {} },
    })
    expect(layout.isFold.value).toBe(false)
  })

  it('minFoldRows=1 且 2行 → isFold=true', () => {
    const items = [
      makeField('a', 8), makeField('b', 8), makeField('c', 8),
      makeField('d', 8), makeField('e', 8), makeField('f', 8),
    ]
    const layout = useFormLayout({
      formItemList: items,
      layoutFormProps: { formLayProps: { minFoldRows: 1 } },
    })
    expect(layout.isFold.value).toBe(true)
  })

  it('folded=true → 超出折叠行的字段标记 isFold', () => {
    const items = [
      makeField('a', 24),
      makeField('b', 24),
      makeField('c', 24),
    ]
    const layout = useFormLayout({
      formItemList: items,
      layoutFormProps: { formLayProps: { minFoldRows: 1 } },
    })
    layout.folded.value = true
    const foldedItems = layout.formItem.value
    expect(foldedItems[0].isFold).toBe(false)
    expect(foldedItems[1].isFold).toBe(true)
    expect(foldedItems[2].isFold).toBe(true)
  })

  it('changeFolded — 切换折叠状态', () => {
    const items = [makeField('a', 8), makeField('b', 8), makeField('c', 8), makeField('d', 8)]
    const layout = useFormLayout({ formItemList: items })
    expect(layout.folded.value).toBe(false)
    layout.changeFolded()
    expect(layout.folded.value).toBe(true)
    layout.changeFolded()
    expect(layout.folded.value).toBe(false)
  })
})

describe('useFormLayout — 按钮配置', () => {
  it('isBtnHidden — 默认 false', () => {
    const layout = useFormLayout({ formItemList: [makeField('a')] })
    expect(layout.isBtnHidden.value).toBe(false)
  })

  it('isBtnHidden=true', () => {
    const layout = useFormLayout({
      formItemList: [makeField('a')],
      layoutFormProps: { formLayProps: { isBtnHidden: true } },
    })
    expect(layout.isBtnHidden.value).toBe(true)
  })

  it('getBtnColSpan — 未折叠且有剩余空间时返回剩余 span', () => {
    const items = [makeField('a', 8), makeField('b', 8)]
    const layout = useFormLayout({ formItemList: items })
    const span = layout.getBtnColSpan.value
    // 2×8=16, 剩余 24-16=8, btnColSpan 默认 0 <= 8 → 返回 8
    expect(span).toBe(8)
  })

  it('getBtnColSpan — 折叠后返回 24', () => {
    const items = [makeField('a', 8), makeField('b', 8)]
    const layout = useFormLayout({ formItemList: items })
    layout.folded.value = true
    expect(layout.getBtnColSpan.value).toBe(24)
  })

  it('getSetOptionsStatus', () => {
    const layout = useFormLayout({
      formItemList: [],
      layoutFormProps: { setOptions: true },
    })
    expect(layout.getSetOptionsStatus.value).toBe(true)
  })
})
