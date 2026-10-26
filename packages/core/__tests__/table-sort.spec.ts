import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SORT_PARAM_NAMES,
  resolveSortParam,
  normalizeSortOrder,
  toTableSortState,
  sameSortState,
  seedSortState,
  buildSortParams,
} from '../src/table-sort'

/**
 * 服务端排序契约（`tableOptions.sortParam`）—— core 纯函数。
 *
 * 这三个函数是三端**唯一的求值点**（el-table / element-ui / a-table / vxe 都调它），
 * 所以「三端点表头 → 同一对请求参数」由构造保证，不靠三份复制实现对齐。
 * 这里把约定钉死：未声明 = 不发参数；已声明 = 只发 `{ prop, 'asc'|'desc' }`。
 */
describe('resolveSortParam — 声明解析', () => {
  it('未声明 / false / null → null（保持本地排序，历史行为）', () => {
    expect(resolveSortParam(undefined)).toBeNull()
    expect(resolveSortParam(null)).toBeNull()
    expect(resolveSortParam({})).toBeNull()
    expect(resolveSortParam({ sortParam: false })).toBeNull()
  })

  it('true → 默认字段名', () => {
    expect(resolveSortParam({ sortParam: true })).toEqual(DEFAULT_SORT_PARAM_NAMES)
    expect(DEFAULT_SORT_PARAM_NAMES).toEqual({ field: 'sortField', order: 'sortOrder' })
  })

  it('只写一半时另一半回落默认（空串也算没写）', () => {
    expect(resolveSortParam({ sortParam: { field: 'orderBy' } })).toEqual({ field: 'orderBy', order: 'sortOrder' })
    expect(resolveSortParam({ sortParam: { order: 'order' } })).toEqual({ field: 'sortField', order: 'order' })
    expect(resolveSortParam({ sortParam: { field: '  ', order: '' } })).toEqual(DEFAULT_SORT_PARAM_NAMES)
  })
})

describe('normalizeSortOrder — 三端方向写法归一', () => {
  it('el-table / element-ui 的 ascending/descending', () => {
    expect(normalizeSortOrder('ascending')).toBe('asc')
    expect(normalizeSortOrder('descending')).toBe('desc')
  })

  it('vxe / 虚拟引擎的 asc/desc', () => {
    expect(normalizeSortOrder('asc')).toBe('asc')
    expect(normalizeSortOrder('desc')).toBe('desc')
  })

  it('a-table 的 ascend/descend 也认', () => {
    expect(normalizeSortOrder('ascend')).toBe('asc')
    expect(normalizeSortOrder('descend')).toBe('desc')
  })

  it('清空排序与未知值一律 null', () => {
    expect(normalizeSortOrder(null)).toBeNull()
    expect(normalizeSortOrder(undefined)).toBeNull()
    expect(normalizeSortOrder('')).toBeNull()
    expect(normalizeSortOrder('ascendingx')).toBeNull()
  })
})

describe('toTableSortState — change-table-sort payload 归一', () => {
  it('el-table 形态：prop + order', () => {
    expect(toTableSortState({ prop: 'amount', order: 'descending' })).toEqual({ prop: 'amount', order: 'desc' })
  })

  it('清空排序：prop 仍在、order 为 null', () => {
    expect(toTableSortState({ prop: 'amount', order: null })).toEqual({ prop: 'amount', order: null })
  })

  it('a-table 第三击：column 变 undefined，只留 field', () => {
    expect(toTableSortState({ column: undefined, field: 'amount', order: null })).toEqual({ prop: 'amount', order: null })
  })

  it('只有 column.prop 时也认（部分引擎不回 prop）', () => {
    expect(toTableSortState({ column: { prop: 'qty' }, order: 'asc' })).toEqual({ prop: 'qty', order: 'asc' })
  })

  it('拿不到列名 → null（不可用的排序状态）', () => {
    expect(toTableSortState({ order: 'asc' })).toBeNull()
    expect(toTableSortState({ prop: '', order: 'asc' })).toBeNull()
    expect(toTableSortState(null)).toBeNull()
  })
})

describe('seedSortState / sameSortState — 首屏排序与去重', () => {
  it('defaultSort → 初始状态', () => {
    expect(seedSortState({ prop: 'amount', order: 'descending' })).toEqual({ prop: 'amount', order: 'desc' })
  })

  it('defaultSort 缺 prop 或方向非法 → null', () => {
    expect(seedSortState(undefined)).toBeNull()
    expect(seedSortState({ order: 'ascending' })).toBeNull()
    expect(seedSortState({ prop: 'amount', order: 'sideways' as never })).toBeNull()
  })

  it('等价判定：表头挂载回抛的默认排序不应触发二次请求', () => {
    expect(sameSortState({ prop: 'a', order: 'asc' }, { prop: 'a', order: 'asc' })).toBe(true)
    expect(sameSortState(null, null)).toBe(true)
    expect(sameSortState({ prop: 'a', order: 'asc' }, { prop: 'a', order: 'desc' })).toBe(false)
    expect(sameSortState({ prop: 'a', order: 'asc' }, null)).toBe(false)
  })
})

describe('buildSortParams — 请求参数拼装', () => {
  it('未声明 → 空对象（不发任何排序参数）', () => {
    expect(buildSortParams({}, { prop: 'amount', order: 'desc' })).toEqual({})
  })

  it('已声明且有排序 → 一对键值', () => {
    expect(buildSortParams({ sortParam: true }, { prop: 'amount', order: 'desc' })).toEqual({
      sortField: 'amount',
      sortOrder: 'desc',
    })
  })

  it('自定义字段名生效', () => {
    expect(
      buildSortParams({ sortParam: { field: 'orderBy', order: 'direction' } }, { prop: 'amount', order: 'asc' }),
    ).toEqual({ orderBy: 'amount', direction: 'asc' })
  })

  it('无排序 / 已清空 → 空对象（不发空串，严格后端会把空串当非法枚举）', () => {
    expect(buildSortParams({ sortParam: true }, null)).toEqual({})
    expect(buildSortParams({ sortParam: true }, { prop: 'amount', order: null })).toEqual({})
    expect(buildSortParams({ sortParam: true }, { prop: '', order: 'asc' })).toEqual({})
  })
})
