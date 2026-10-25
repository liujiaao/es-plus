import { describe, it, expect } from 'vitest'
import { findTableDataOption, resolveTableCellDisplay } from '../src/table-cell'
import type { TableColumn, TableColumnDataOption } from '../src/types'

const opts: TableColumnDataOption[] = [
  { label: '待处理', value: 0, tagType: 'info' },
  { label: '进行中', value: 1, tagType: 'warning' },
  { label: '已完成', value: 2, tagType: 'success' },
]

const col = (overrides: Partial<TableColumn> = {}): TableColumn =>
  ({ prop: 'status', label: '状态', dataOptions: opts, ...overrides }) as TableColumn

describe('table-cell > findTableDataOption', () => {
  it('按 value 命中并带回标签色', () => {
    expect(findTableDataOption(opts, 1)).toMatchObject({ label: '进行中', tagType: 'warning' })
  })

  it('number ↔ string 宽松相等（后端返回 "1"、配置写 1 不算未命中）', () => {
    expect(findTableDataOption(opts, '1')?.label).toBe('进行中')
    expect(findTableDataOption([{ label: '是', value: 'true' }], true)).toBeUndefined()
  })

  it('空值不参与匹配（否则 value:"" 的「未选择」选项会吃掉空单元格）', () => {
    const withEmpty = [{ label: '未选择', value: '' }, ...opts]
    expect(findTableDataOption(withEmpty, '')).toBeUndefined()
    expect(findTableDataOption(withEmpty, null)).toBeUndefined()
    expect(findTableDataOption(withEmpty, undefined)).toBeUndefined()
  })

  it('未配置 / 空数组 → undefined', () => {
    expect(findTableDataOption(undefined, 1)).toBeUndefined()
    expect(findTableDataOption([], 1)).toBeUndefined()
  })
})

describe('table-cell > resolveTableCellDisplay', () => {
  it('命中 → 选项 label + tagType', () => {
    expect(resolveTableCellDisplay(col(), { status: 2 })).toEqual({ text: '已完成', tagType: 'success' })
  })

  it('未命中 → 原始值字符串化（新状态码仍要看得见，不塌成占位符）', () => {
    expect(resolveTableCellDisplay(col(), { status: 9 })).toEqual({ text: '9', tagType: undefined })
  })

  it('带标签色但选项没写 tagType → 纯文本', () => {
    const plain = [{ label: '启用', value: 1 }]
    expect(resolveTableCellDisplay(col({ dataOptions: plain }), { status: 1 })).toEqual({
      text: '启用',
      tagType: undefined,
    })
  })

  it('空值 → emptyPlaceholder（默认 "-"，可覆盖）', () => {
    expect(resolveTableCellDisplay(col(), { status: null }).text).toBe('-')
    expect(resolveTableCellDisplay(col(), { status: '' }).text).toBe('-')
    expect(resolveTableCellDisplay(col({ emptyPlaceholder: '未填' }), {}).text).toBe('未填')
  })

  it('0 / false 不被当成空值', () => {
    const zeros = [{ label: '关闭', value: 0 }]
    expect(resolveTableCellDisplay(col({ dataOptions: zeros }), { status: 0 }).text).toBe('关闭')
    const bools = [{ label: '否', value: false }]
    expect(resolveTableCellDisplay(col({ dataOptions: bools }), { status: false }).text).toBe('否')
  })

  it('嵌套 prop（a.b）与 key 兜底', () => {
    expect(resolveTableCellDisplay(col({ prop: 'meta.status' }), { meta: { status: 1 } }).text).toBe('进行中')
    expect(resolveTableCellDisplay(col({ prop: undefined, key: 'status' }), { status: 2 }).text).toBe('已完成')
  })

  it('row 缺失时显示占位符，不抛错', () => {
    expect(resolveTableCellDisplay(col(), undefined).text).toBe('-')
  })
})
