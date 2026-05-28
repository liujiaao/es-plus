import { describe, it, expect } from 'vitest'
import {
  filterVisibleFormItems,
  calculateAutoSpan,
  applyAutoSpan,
  splitButtonsByDirection,
  splitToolbarButtonsByCode,
  filterButtonsByPermission,
  normalizeButtonsHideState,
  resolveButtonDisabled,
  applyConfigTableOut,
} from '../src/field-resolver'
import type { BtnConfig, FormItemOption } from '../src/types'

const fi = (overrides: Partial<FormItemOption>): FormItemOption =>
  ({ prop: 'p', label: 'L', ...overrides } as FormItemOption)

const btn = (overrides: Partial<BtnConfig>): BtnConfig =>
  ({ name: 'btn', ...overrides } as BtnConfig)

describe('field-resolver > filterVisibleFormItems', () => {
  it('isHidden 返回 true → 过滤掉', () => {
    const list = [
      fi({ prop: 'a' }),
      fi({ prop: 'b', isHidden: () => true }),
      fi({ prop: 'c', isHidden: () => false }),
    ]
    const r = filterVisibleFormItems(list, {}, {})
    expect(r.map((x) => x.prop)).toEqual(['a', 'c'])
  })

  it('保留 dataOptions 默认值', () => {
    const list = [fi({ prop: 'a' })]
    const r = filterVisibleFormItems(list, {}, {})
    expect(r[0].dataOptions).toEqual([])
  })
})

describe('field-resolver > calculateAutoSpan / applyAutoSpan', () => {
  it('全部未配 span，1/2/3 个分别返回 24/12/8', () => {
    expect(calculateAutoSpan([fi({})])).toBe(24)
    expect(calculateAutoSpan([fi({}), fi({})])).toBe(12)
    expect(calculateAutoSpan([fi({}), fi({}), fi({})])).toBe(8)
    expect(calculateAutoSpan([fi({}), fi({}), fi({}), fi({})])).toBe(6)
  })

  it('部分配 span：剩余空间均分', () => {
    // 已配 span 总=12，剩余=12，未配=2 个 → 6
    const list = [fi({ span: 6 }), fi({ span: 6 }), fi({}), fi({})]
    expect(calculateAutoSpan(list)).toBe(6)
  })

  it('applyAutoSpan 给未配 span 的字段填上 autoSpan', () => {
    const list = [fi({ prop: 'a' }), fi({ prop: 'b', span: 12 })]
    const r = applyAutoSpan(list)
    expect(r[1].span).toBe(12)
    expect(r[0].span).toBeGreaterThan(0)
  })
})

describe('field-resolver > 按钮分组', () => {
  it('splitButtonsByDirection: 默认右侧', () => {
    const r = splitButtonsByDirection([
      btn({ name: 'a' }),
      btn({ name: 'b', direction: 'left' }),
      btn({ name: 'c', direction: 'right' }),
    ])
    expect(r.colLeftBtn.map((x) => x.name)).toEqual(['b'])
    expect(r.colRightBtn.map((x) => x.name)).toEqual(['a', 'c'])
  })

  it('splitToolbarButtonsByCode: 默认左侧', () => {
    const r = splitToolbarButtonsByCode([
      btn({ name: 'a' }),
      btn({ name: 'b', code: 1 }),
      btn({ name: 'c', code: 2 }),
    ])
    expect(r.leftBtns.map((x) => x.name)).toEqual(['a', 'b'])
    expect(r.rightBtns.map((x) => x.name)).toEqual(['c'])
  })
})

describe('field-resolver > 权限与隐藏', () => {
  it('filterButtonsByPermission 不传 permission 全放行', () => {
    const list = [btn({ permissionValue: 'x' })]
    expect(filterButtonsByPermission(list)).toHaveLength(1)
  })

  it('filterButtonsByPermission permission 返回 false 时过滤', () => {
    const list = [
      btn({ name: 'a', permissionValue: 'x' }),
      btn({ name: 'b' }), // 无 permissionValue
    ]
    const r = filterButtonsByPermission(list, () => false)
    expect(r.map((x) => x.name)).toEqual(['b'])
  })

  it('normalizeButtonsHideState: 无权限则 isHide=true', () => {
    const r = normalizeButtonsHideState(
      [btn({ name: 'a', permissionValue: 'x' })],
      () => false
    )
    expect(r[0].isHide).toBe(true)
  })

  it('normalizeButtonsHideState: 函数式 isHide', () => {
    const r = normalizeButtonsHideState([btn({ name: 'a', isHide: (() => true) as never })])
    expect(r[0].isHide).toBe(true)
  })
})

describe('field-resolver > resolveButtonDisabled', () => {
  it('布尔值', () => {
    expect(resolveButtonDisabled(btn({ disabled: true }))).toBe(true)
    expect(resolveButtonDisabled(btn({ disabled: false }))).toBe(false)
  })

  it('函数式', () => {
    const fn = (model?: { v: boolean }) => !!model?.v
    expect(resolveButtonDisabled(btn({ disabled: fn as never }), { v: true })).toBe(true)
    expect(resolveButtonDisabled(btn({ disabled: fn as never }), { v: false })).toBe(false)
  })
})

describe('field-resolver > applyConfigTableOut', () => {
  it('普通响应映射', () => {
    const r = applyConfigTableOut(
      { rows: [{ id: 1 }], records: 5 },
      { tableData: 'rows', total: 'records' }
    )
    expect(r.tableData).toEqual([{ id: 1 }])
    expect(r.total).toBe(5)
  })

  it('数组响应直接作 tableData', () => {
    const r = applyConfigTableOut([1, 2, 3], { tableData: 'data', total: 'total' })
    expect(r.tableData).toEqual([1, 2, 3])
    expect(r.total).toBe(3)
  })

  it('total 字符串 → 转数字', () => {
    const r = applyConfigTableOut(
      { data: [], total: '42' },
      { tableData: 'data', total: 'total' }
    )
    expect(r.total).toBe(42)
  })

  it('找不到字段 → tableData=[], total=0', () => {
    const r = applyConfigTableOut({}, { tableData: 'data', total: 'total' })
    expect(r.tableData).toEqual([])
    expect(r.total).toBe(0)
  })
})
