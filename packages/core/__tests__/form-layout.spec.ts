import { describe, it, expect } from 'vitest'
import {
  getRowColsAlgorithm,
  shouldShowFoldButton,
  getBtnColSpan,
  applyFoldFlags,
} from '../src/form-layout'
import type { FormItemOption } from '../src/types'

const item = (prop: string, span?: number): FormItemOption =>
  ({ prop, label: prop, span } as FormItemOption)

describe('form-layout > getRowColsAlgorithm', () => {
  it('全部 span=6 → 一行 4 列', () => {
    const list = [item('a', 6), item('b', 6), item('c', 6), item('d', 6)]
    const r = getRowColsAlgorithm(list)
    expect(r.rowNum).toBe(1)
    expect(r.columnRow).toEqual([[0, 1, 2, 3]])
    expect(r.columnNodeIndex).toEqual([3])
  })

  it('span 累计超过 24 → 自动换行', () => {
    const list = [item('a', 12), item('b', 12), item('c', 12)]
    const r = getRowColsAlgorithm(list)
    expect(r.rowNum).toBe(2)
    expect(r.columnRow).toEqual([[0, 1], [2]])
  })

  it('混合 span', () => {
    const list = [item('a', 8), item('b', 8), item('c', 8), item('d', 12)]
    const r = getRowColsAlgorithm(list)
    expect(r.rowNum).toBe(2)
    expect(r.columnRow).toEqual([[0, 1, 2], [3]])
    expect(r.columnNodeIndex).toEqual([2, 3])
  })

  it('单字段 span=24', () => {
    const list = [item('a', 24)]
    const r = getRowColsAlgorithm(list)
    expect(r.rowNum).toBe(1)
    expect(r.columnRow).toEqual([[0]])
  })

  it('未配 span 默认走 24（独占一行）', () => {
    const list = [item('a'), item('b')]
    const r = getRowColsAlgorithm(list)
    expect(r.rowNum).toBe(2)
  })

  it('空列表 → rowNum=0', () => {
    const r = getRowColsAlgorithm([])
    expect(r.rowNum).toBe(0)
    expect(r.columnRow).toEqual([])
  })
})

describe('form-layout > shouldShowFoldButton', () => {
  it('minFoldRows=0 不显示', () => {
    expect(shouldShowFoldButton({ rowNum: 5, columnRow: [], columnNodeIndex: [] }, 0)).toBe(false)
  })

  it('minFoldRows < rowNum 显示', () => {
    expect(shouldShowFoldButton({ rowNum: 3, columnRow: [], columnNodeIndex: [] }, 2)).toBe(true)
  })

  it('minFoldRows >= rowNum 不显示', () => {
    expect(shouldShowFoldButton({ rowNum: 2, columnRow: [], columnNodeIndex: [] }, 3)).toBe(false)
  })
})

describe('form-layout > getBtnColSpan', () => {
  it('折叠时按钮独占一行', () => {
    const list = [item('a', 6), item('b', 6)]
    const layout = getRowColsAlgorithm(list)
    expect(getBtnColSpan(layout, list, true, 6)).toBe(24)
  })

  it('展开时末行有空间且按钮 span 够小 → 占空隙', () => {
    const list = [item('a', 6), item('b', 6)]
    const layout = getRowColsAlgorithm(list)
    // 末行总 span = 12，剩余 12，btnColSpan=6 ≤ 12 → 返回 12
    expect(getBtnColSpan(layout, list, false, 6)).toBe(12)
  })

  it('展开时末行剩余不足 → 独占一行', () => {
    const list = [item('a', 8), item('b', 8), item('c', 6)]
    const layout = getRowColsAlgorithm(list)
    // 末行 span = 22，剩余 2，btnColSpan=6 > 2 → 返回 24
    expect(getBtnColSpan(layout, list, false, 6)).toBe(24)
  })
})

describe('form-layout > applyFoldFlags', () => {
  it('折叠态：超过 minFoldRows 的字段标 isFold=true', () => {
    const list = [item('a', 6), item('b', 6), item('c', 6), item('d', 6), item('e', 12)]
    const layout = getRowColsAlgorithm(list)
    // rowNum=2，minFoldRows=1 → 第一行末位 columnNodeIndex[0]=3，索引 > 3 的标 fold
    const r = applyFoldFlags(list, layout, true, 1)
    expect(r[0].isFold).toBe(false)
    expect(r[3].isFold).toBe(false)
    expect(r[4].isFold).toBe(true)
  })

  it('展开态：所有字段 isFold=false', () => {
    const list = [item('a', 6), item('b', 6)]
    const layout = getRowColsAlgorithm(list)
    const r = applyFoldFlags(list, layout, false, 1)
    expect(r.every((it) => it.isFold === false)).toBe(true)
  })
})
