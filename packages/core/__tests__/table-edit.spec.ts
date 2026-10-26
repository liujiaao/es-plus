import { describe, it, expect } from 'vitest'
import { resolveEditProp, snapshotEditRow, diffEditRow } from '../src/table-edit'

/**
 * `cell-edit` 载荷的求值点（core 纯函数）。
 *
 * 三份 vxe 引擎（vue3 / vue2 / antdv）只负责「进入编辑时拍快照、退出时比一遍」，
 * 比什么、怎么算「变了」全在这里 —— 于是三端的载荷形状由构造保证，不靠三份复制对齐。
 */
describe('resolveEditProp — 三种列写法归一成字段名', () => {
  it('vxe v4：column.property', () => {
    expect(resolveEditProp({ property: 'amount', field: 'ignored' })).toBe('amount')
  })

  it('vxe v3 / 适配器输出：column.field', () => {
    expect(resolveEditProp({ field: 'qty' })).toBe('qty')
  })

  it('el-table / a-table：column.prop', () => {
    expect(resolveEditProp({ prop: 'status' })).toBe('status')
  })

  it('优先级 property > field > prop（同一列同时存在时取 vxe 归一后的那个）', () => {
    expect(resolveEditProp({ property: 'p', field: 'f', prop: 'r' })).toBe('p')
  })

  it('无字段名 / 非对象 / 空串 → undefined（不产生假载荷）', () => {
    expect(resolveEditProp(undefined)).toBeUndefined()
    expect(resolveEditProp(null)).toBeUndefined()
    expect(resolveEditProp({})).toBeUndefined()
    expect(resolveEditProp({ property: '' })).toBeUndefined()
    expect(resolveEditProp({ property: 42 })).toBeUndefined()
    expect(resolveEditProp('amount')).toBeUndefined()
  })
})

describe('snapshotEditRow — 进入编辑拍一行', () => {
  it('浅拷贝：值相同、引用不同（改动不会污染快照）', () => {
    const row = { id: 1, amount: 1000.5 }
    const snap = snapshotEditRow(row)
    expect(snap).toEqual(row)
    expect(snap).not.toBe(row)
    row.amount = 4321
    expect(snap.amount).toBe(1000.5)
  })

  it('非对象输入 → 空对象（不抛）', () => {
    expect(snapshotEditRow(undefined as any)).toEqual({})
    expect(snapshotEditRow(null as any)).toEqual({})
  })
})

describe('diffEditRow — 只报真的变了的字段', () => {
  it('单元格模式：只比本次编辑的那一格（同行其它字段的变化不算）', () => {
    const snap = { id: 1, amount: 1000.5, qty: 3 }
    const row = { id: 1, amount: '4321', qty: 3 }
    expect(diffEditRow(snap, row, 'amount')).toEqual([
      { prop: 'amount', value: '4321', oldValue: 1000.5 },
    ])
  })

  it('单元格模式：没改 → 空数组（点一下再失焦不发事件）', () => {
    const snap = { amount: 1000.5 }
    expect(diffEditRow(snap, { amount: 1000.5 }, 'amount')).toEqual([])
  })

  it('行模式：省略 prop → 逐键比整行，多格改动各一条', () => {
    const snap = { id: 1, amount: 1000.5, qty: 3, note: 'a' }
    const row = { id: 1, amount: 999, qty: 5, note: 'a' }
    expect(diffEditRow(snap, row)).toEqual([
      { prop: 'amount', value: 999, oldValue: 1000.5 },
      { prop: 'qty', value: 5, oldValue: 3 },
    ])
  })

  it('行模式：编辑期新增的键也算改动（快照里没有 = undefined）', () => {
    const snap = { id: 1 }
    const row = { id: 1, extra: 'x' }
    expect(diffEditRow(snap, row)).toEqual([{ prop: 'extra', value: 'x', oldValue: undefined }])
  })

  it('值是标量：Object.is 口径（NaN 自等、0 与 -0 区分、Date 换引用算改）', () => {
    expect(diffEditRow({ v: NaN }, { v: NaN }, 'v')).toEqual([])
    expect(diffEditRow({ v: 0 }, { v: -0 }, 'v')).toEqual([{ prop: 'v', value: -0, oldValue: 0 }])
    const a = new Date(0)
    expect(diffEditRow({ v: a }, { v: new Date(0) }, 'v')).toHaveLength(1)
  })

  it('缺参 → 空数组（不抛）', () => {
    expect(diffEditRow(undefined as any, { a: 1 })).toEqual([])
    expect(diffEditRow({ a: 1 }, undefined as any)).toEqual([])
  })
})
