import { describe, it, expect } from 'vitest'
import { useVirtualSort } from '../src/components/es-table/src/engines/use-virtual-sort'
import type { TableColumn } from '../src/types'

// ─── 1. 初始状态 ──────────────────────────────────────────────────────────

describe('useVirtualSort — 初始状态', () => {
  it('sortState 初始为 undefined', () => {
    const { sortState } = useVirtualSort()
    expect(sortState.value).toBeUndefined()
  })
})

// ─── 2. onColumnSort ──────────────────────────────────────────────────────

describe('useVirtualSort — onColumnSort', () => {
  it('第一次点击列 → 升序', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    expect(sortState.value).toEqual({ key: 'name', order: 'asc' })
  })

  it('同列第二次点击 → 降序（升 → 降）', () => {
    // 契约变更：旧实现把方向完全交给入参 order，而 EL TableV2 实际传的 order
    // 恒为 undefined（见 use-virtual-sort.ts 的注释），所以真实使用中"第二次点击"
    // 走的是「与上次 order 相同 → 取消」分支，永远到不了降序。
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: 'asc' })
    expect(sortState.value).toEqual({ key: 'name', order: 'desc' })
  })

  it('同列第三次点击 → 取消排序（降 → 取消）', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name' })
    onColumnSort({ key: 'name' })
    onColumnSort({ key: 'name' })
    expect(sortState.value).toBeUndefined()
  })

  it('方向由引擎自己推进：入参 order 即使是 undefined 也能得到 asc/desc', () => {
    // 这正是 EL 的真实行为（order 恒为 undefined）—— 状态机不能信它。
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: undefined })
    expect(sortState.value).toEqual({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: undefined })
    expect(sortState.value).toEqual({ key: 'name', order: 'desc' })
  })

  it('入参 order 与当前状态冲突时，以引擎状态机为准', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    // EL 若传了与引擎状态不符的方向，不应把状态机带偏
    onColumnSort({ key: 'name', order: 'asc' })
    expect(sortState.value).toEqual({ key: 'name', order: 'desc' })
  })

  it('不同 key → 切换到新 key 并从升序起', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'age', order: 'desc' })
    expect(sortState.value).toEqual({ key: 'age', order: 'asc' })
  })

  it('数字 key → 转换为字符串', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 123 as any, order: 'desc' })
    expect(sortState.value?.key).toBe('123')
  })

  it('连点三次 → asc / desc / 取消', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'date', order: 'desc' })
    expect(sortState.value).toEqual({ key: 'date', order: 'asc' })
    onColumnSort({ key: 'date', order: 'desc' })
    expect(sortState.value).toEqual({ key: 'date', order: 'desc' })
    onColumnSort({ key: 'date', order: 'desc' })
    expect(sortState.value).toBeUndefined()
  })
})

// ─── 3. toSortChangePayload ───────────────────────────────────────────────

describe('useVirtualSort — toSortChangePayload', () => {
  const columns: TableColumn[] = [
    { prop: 'name', label: '姓名' },
    { prop: 'age', label: '年龄' },
    { key: 'date', label: '日期' },
  ]

  it('无排序状态 → prop:"", order:null, column:null', () => {
    const { toSortChangePayload } = useVirtualSort()
    const payload = toSortChangePayload(columns)
    expect(payload.prop).toBe('')
    expect(payload.order).toBeNull()
    expect(payload.column).toBeNull()
  })

  it('asc → order:"ascending"', () => {
    const { onColumnSort, toSortChangePayload } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    const payload = toSortChangePayload(columns)
    expect(payload.order).toBe('ascending')
    expect(payload.prop).toBe('name')
    expect(payload.column).toMatchObject({ prop: 'name', label: '姓名' })
  })

  it('同列点两次（asc → desc）→ order:"descending"', () => {
    const { onColumnSort, toSortChangePayload } = useVirtualSort()
    onColumnSort({ key: 'age', order: 'asc' })
    onColumnSort({ key: 'age', order: 'asc' })
    const payload = toSortChangePayload(columns)
    expect(payload.order).toBe('descending')
    expect(payload.prop).toBe('age')
  })

  it('通过 col.key 匹配（column.key 非 prop 的情况）', () => {
    const { onColumnSort, toSortChangePayload } = useVirtualSort()
    onColumnSort({ key: 'date', order: 'asc' })
    const payload = toSortChangePayload(columns)
    expect(payload.column).toMatchObject({ key: 'date', label: '日期' })
  })

  it('排序列不在 columns 中 → column:null', () => {
    const { onColumnSort, toSortChangePayload } = useVirtualSort()
    onColumnSort({ key: 'nonexistent', order: 'asc' })
    const payload = toSortChangePayload(columns)
    expect(payload.column).toBeNull()
  })

  it('取消排序后 → payload 恢复为空', () => {
    const { onColumnSort, toSortChangePayload } = useVirtualSort()
    onColumnSort({ key: 'name' })
    onColumnSort({ key: 'name' })
    onColumnSort({ key: 'name' })
    const payload = toSortChangePayload(columns)
    expect(payload.order).toBeNull()
    expect(payload.prop).toBe('')
  })
})
