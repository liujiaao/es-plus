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
  it('第一次点击列 → 设置排序状态', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    expect(sortState.value).toEqual({ key: 'name', order: 'asc' })
  })

  it('相同 key + 相同 order → 取消排序（toggle off）', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: 'asc' })
    expect(sortState.value).toBeUndefined()
  })

  it('相同 key + 不同 order → 更新 order（不取消）', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: 'desc' })
    expect(sortState.value).toEqual({ key: 'name', order: 'desc' })
  })

  it('不同 key → 切换到新 key', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'age', order: 'asc' })
    expect(sortState.value).toEqual({ key: 'age', order: 'asc' })
  })

  it('数字 key → 转换为字符串', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 123 as any, order: 'desc' })
    expect(sortState.value?.key).toBe('123')
  })

  it('desc 排序后再点同列 desc → 取消', () => {
    const { sortState, onColumnSort } = useVirtualSort()
    onColumnSort({ key: 'date', order: 'desc' })
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

  it('desc → order:"descending"', () => {
    const { onColumnSort, toSortChangePayload } = useVirtualSort()
    onColumnSort({ key: 'age', order: 'desc' })
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
    onColumnSort({ key: 'name', order: 'asc' })
    onColumnSort({ key: 'name', order: 'asc' })
    const payload = toSortChangePayload(columns)
    expect(payload.order).toBeNull()
    expect(payload.prop).toBe('')
  })
})
