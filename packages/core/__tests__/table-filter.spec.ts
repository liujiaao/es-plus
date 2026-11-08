import { describe, it, expect } from 'vitest'
import {
  normalizeFilterMode,
  matchesColumnFilter,
  columnFilterKey,
  hasColumnFilters,
  buildColumnFilterMethod,
} from '../src/table-filter'

/**
 * 列筛选语义（W3-2）—— core 纯函数。
 *
 * 三端默认引擎的「无自定义比较函数」兜底各不相同（el-table / a-table / vxe 都是严格
 * `===`），而后端常返回 `1`、配置写 `"1"`。这里是**唯一**的比较求值点，三端适配器只做
 * 签名适配（el 的 `filter-method(value, row, column)`、a-table 的 `onFilter(value, record)`、
 * vxe 的 `filterMethod({ value, row })`），语义由构造保证一致。
 */
describe('normalizeFilterMode — 未知值一律回落 equals', () => {
  it('只认 includes，其余（含拼错 / undefined）都是 equals', () => {
    expect(normalizeFilterMode('includes')).toBe('includes')
    expect(normalizeFilterMode('equals')).toBe('equals')
    expect(normalizeFilterMode('contain')).toBe('equals')
    expect(normalizeFilterMode(undefined)).toBe('equals')
    expect(normalizeFilterMode(null)).toBe('equals')
  })
})

describe('matchesColumnFilter — equals（缺省）', () => {
  it('严格相等的值命中', () => {
    expect(matchesColumnFilter('done', 'done')).toBe(true)
    expect(matchesColumnFilter(2, 2)).toBe(true)
    expect(matchesColumnFilter(true, true)).toBe(true)
  })

  it('number ↔ string ↔ boolean 宽松比较（后端 1 / 配置 "1" 的常见形态）', () => {
    expect(matchesColumnFilter(1, '1')).toBe(true)
    expect(matchesColumnFilter('1', 1)).toBe(true)
    expect(matchesColumnFilter(true, 'true')).toBe(true)
    expect(matchesColumnFilter(0, '0')).toBe(true)
  })

  it('不同值不命中', () => {
    expect(matchesColumnFilter('done', 'pending')).toBe(false)
    expect(matchesColumnFilter(1, 2)).toBe(false)
    expect(matchesColumnFilter(0, false)).toBe(false)
    expect(matchesColumnFilter('true', 1)).toBe(false)
  })

  it('空值只与空值匹配（「未填写」是合法筛选项）', () => {
    expect(matchesColumnFilter(null, '')).toBe(true)
    expect(matchesColumnFilter('', null)).toBe(true)
    expect(matchesColumnFilter(undefined, undefined)).toBe(true)
    expect(matchesColumnFilter(null, 'x')).toBe(false)
    expect(matchesColumnFilter('x', '')).toBe(false)
  })

  it('复合值（数组/对象）不做结构匹配', () => {
    expect(matchesColumnFilter([1, 2], [1, 2])).toBe(false)
    expect(matchesColumnFilter({ a: 1 }, { a: 1 })).toBe(false)
  })
})

describe('matchesColumnFilter — includes（文本包含）', () => {
  it('单元格文本包含筛选值即命中', () => {
    expect(matchesColumnFilter('北京市朝阳区', '朝阳', 'includes')).toBe(true)
    expect(matchesColumnFilter('北京市朝阳区', '海淀', 'includes')).toBe(false)
    expect(matchesColumnFilter(12345, '234', 'includes')).toBe(true)
  })

  it('空筛选值恒命中（视作「不限」）', () => {
    expect(matchesColumnFilter('x', '', 'includes')).toBe(true)
    expect(matchesColumnFilter(null, '', 'includes')).toBe(true)
  })
})

describe('columnFilterKey / hasColumnFilters', () => {
  it('prop 优先，其次 key；都没有则不可绑定', () => {
    expect(columnFilterKey({ prop: 'userName' })).toBe('userName')
    expect(columnFilterKey({ key: 'status' })).toBe('status')
    expect(columnFilterKey({ prop: 'a', key: 'b' })).toBe('a')
    expect(columnFilterKey({})).toBeUndefined()
  })

  it('无 filters / 空数组 / 无字段 → 不算声明了筛选', () => {
    expect(hasColumnFilters({ prop: 'status', filters: [{ text: '启用', value: 1 }] })).toBe(true)
    expect(hasColumnFilters({ prop: 'status' })).toBe(false)
    expect(hasColumnFilters({ prop: 'status', filters: [] })).toBe(false)
    expect(hasColumnFilters({ filters: [{ text: 'x', value: 1 }] })).toBe(false)
  })
})

describe('buildColumnFilterMethod — 合成引擎谓词', () => {
  const col = { prop: 'status', filters: [{ text: '启用', value: 1 }] }

  it('按列字段取值，走宽松相等', () => {
    const fn = buildColumnFilterMethod(col)!
    expect(fn(1, { status: '1' })).toBe(true)
    expect(fn(1, { status: 1 })).toBe(true)
    expect(fn(1, { status: 2 })).toBe(false)
  })

  it('支持点号路径（a-table 的 dataIndex 数组路径同源）', () => {
    const fn = buildColumnFilterMethod({
      prop: 'user.status',
      filters: [{ text: '启用', value: 'on' }],
    })!
    expect(fn('on', { user: { status: 'on' } })).toBe(true)
    expect(fn('on', { user: { status: 'off' } })).toBe(false)
  })

  it('filterMode: includes 走文本包含', () => {
    const fn = buildColumnFilterMethod({
      prop: 'city',
      filters: [{ text: '朝阳', value: '朝阳' }],
      filterMode: 'includes',
    })!
    expect(fn('朝阳', { city: '北京市朝阳区' })).toBe(true)
    expect(fn('朝阳', { city: '北京市海淀区' })).toBe(false)
  })

  it('用户显式给了 filterMethod 时不覆盖 → undefined', () => {
    expect(
      buildColumnFilterMethod({ ...col, filterMethod: () => true }),
    ).toBeUndefined()
  })

  it('没声明 filters（或没有可绑定字段）→ undefined', () => {
    expect(buildColumnFilterMethod({ prop: 'status' })).toBeUndefined()
    expect(buildColumnFilterMethod({ filters: [{ text: 'x', value: 1 }] })).toBeUndefined()
  })
})
