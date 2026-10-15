import { describe, it, expect } from 'vitest'
import {
  buildColumnSpans,
  buildRowSpanMethod,
  resolveMergeConfig,
} from '../src/merge-span'

/**
 * AI-23 声明式合并单元格 —— core 纯函数。
 *
 * 这三个函数是**三端唯一的求值点**（el-table spanMethod / a-table 列级 customCell /
 * vxe mergeMethod 都调它），所以「三端等价」由构造保证。这里把约定钉死：
 * 段内首行 = 段长，其余 = 0（= 被合并掉）；不在 rowsBy 的列恒 [1,1]。
 */
describe('buildColumnSpans — 相邻相等分组', () => {
  it('相邻相等段：首行得段长，其余得 0', () => {
    expect(buildColumnSpans(['a', 'a', 'b'])).toEqual([2, 0, 1])
  })

  it('非相邻的相同值**不**合并（只并相邻）', () => {
    expect(buildColumnSpans(['a', 'b', 'a'])).toEqual([1, 1, 1])
  })

  it('全相等 → 单段覆盖所有行', () => {
    expect(buildColumnSpans([1, 1, 1, 1])).toEqual([4, 0, 0, 0])
  })

  it('全不相等 → 全 1', () => {
    expect(buildColumnSpans([1, 2, 3])).toEqual([1, 1, 1])
  })

  it('空数组 → 空数组', () => {
    expect(buildColumnSpans([])).toEqual([])
  })

  it('undefined/null 视为相等（相邻空值同段）', () => {
    expect(buildColumnSpans([undefined, undefined, 'x'])).toEqual([2, 0, 1])
    expect(buildColumnSpans([null, null])).toEqual([2, 0])
  })
})

describe('buildRowSpanMethod — 三端通用 span-method', () => {
  const rows = [
    { dept: '研发', team: 'A', name: '张三' },
    { dept: '研发', team: 'A', name: '李四' },
    { dept: '研发', team: 'B', name: '王五' },
    { dept: '销售', team: 'C', name: '赵六' },
  ]

  it('命中的列：首行返回 [段长,1]，其余返回 [0,0]（整格消失）', () => {
    const fn = buildRowSpanMethod(['dept'], rows)
    expect(fn({ column: { property: 'dept' }, rowIndex: 0 })).toEqual([3, 1])
    expect(fn({ column: { property: 'dept' }, rowIndex: 1 })).toEqual([0, 0])
    expect(fn({ column: { property: 'dept' }, rowIndex: 2 })).toEqual([0, 0])
    expect(fn({ column: { property: 'dept' }, rowIndex: 3 })).toEqual([1, 1])
  })

  it('多列各自独立分组', () => {
    const fn = buildRowSpanMethod(['dept', 'team'], rows)
    expect(fn({ column: { property: 'team' }, rowIndex: 0 })).toEqual([2, 1])
    expect(fn({ column: { property: 'team' }, rowIndex: 1 })).toEqual([0, 0])
    expect(fn({ column: { property: 'team' }, rowIndex: 2 })).toEqual([1, 1])
  })

  it('不在 rowsBy 的列恒 [1,1]', () => {
    const fn = buildRowSpanMethod(['dept'], rows)
    expect(fn({ column: { property: 'name' }, rowIndex: 0 })).toEqual([1, 1])
  })

  it('列 prop 的多端别名都可识别（property / field / prop / key / dataIndex）', () => {
    const fn = buildRowSpanMethod(['dept'], rows)
    for (const col of [{ property: 'dept' }, { field: 'dept' }, { prop: 'dept' }, { key: 'dept' }, { dataIndex: 'dept' }]) {
      expect(fn({ column: col, rowIndex: 0 })).toEqual([3, 1])
    }
  })

  it('越界 rowIndex / 无 column → [1,1]（不抛）', () => {
    const fn = buildRowSpanMethod(['dept'], rows)
    expect(fn({ column: { property: 'dept' }, rowIndex: 99 })).toEqual([1, 1])
    expect(fn({ column: null, rowIndex: 0 })).toEqual([1, 1])
  })

  it('rowsBy 空 → 一切都 [1,1]（无合并）', () => {
    const fn = buildRowSpanMethod([], rows)
    expect(fn({ column: { property: 'dept' }, rowIndex: 0 })).toEqual([1, 1])
  })
})

describe('resolveMergeConfig — 宽容归一化', () => {
  it('合法形状 → 归一化对象', () => {
    expect(resolveMergeConfig({ mergeConfig: { rowsBy: ['dept'] } })).toEqual({ rowsBy: ['dept'] })
  })

  it('过滤非字符串 / 空串项', () => {
    expect(resolveMergeConfig({ mergeConfig: { rowsBy: ['dept', '', 1, null] } })).toEqual({ rowsBy: ['dept'] })
  })

  it('缺失 / 非法形状 → undefined（不生效，不抛）', () => {
    expect(resolveMergeConfig(undefined)).toBeUndefined()
    expect(resolveMergeConfig({})).toBeUndefined()
    expect(resolveMergeConfig({ mergeConfig: null })).toBeUndefined()
    expect(resolveMergeConfig({ mergeConfig: { rowsBy: 'dept' } })).toBeUndefined()
    expect(resolveMergeConfig({ mergeConfig: { rowsBy: [] } })).toBeUndefined()
    expect(resolveMergeConfig({ mergeConfig: { rowsBy: [1, 2] } })).toBeUndefined()
  })
})
