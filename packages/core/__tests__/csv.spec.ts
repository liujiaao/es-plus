import { describe, it, expect } from 'vitest'
import {
  buildCsv,
  downloadCsv,
  ensureCsvExtension,
  exportTableCsv,
  isCsvExportableColumn,
} from '../src/csv.js'

const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'status', label: '状态', dataOptions: [
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 },
  ] },
]

describe('buildCsv', () => {
  it('输出表头 + 行，默认带 BOM 与 CRLF', () => {
    const csv = buildCsv([{ name: '张三', status: 1 }], columns)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿姓名,状态\r\n张三,启用')
  })

  it('bom:false 时不带 BOM；includeHeader:false 时不输出表头', () => {
    const csv = buildCsv([{ name: '张三' }], [{ prop: 'name', label: '姓名' }], {
      bom: false,
      includeHeader: false,
    })
    expect(csv).toBe('张三')
  })

  it('转义逗号、引号与换行', () => {
    const csv = buildCsv(
      [{ name: 'a,b', remark: 'say "hi"', note: 'l1\nl2' }],
      [
        { prop: 'name', label: 'name' },
        { prop: 'remark', label: 'remark' },
        { prop: 'note', label: 'note' },
      ],
      { bom: false, includeHeader: false },
    )
    expect(csv).toBe('"a,b","say ""hi""","l1\nl2"')
  })

  it('跳过选择列 / 展开列 / 操作列 / 隐藏列 / btns 列', () => {
    const csv = buildCsv(
      [{ name: '张三' }],
      [
        { type: 'selection' },
        { type: 'expand' },
        { prop: 'operate', label: '操作' },
        { prop: 'name', label: '姓名' },
        { prop: 'hid', label: '隐藏', hidCol: true },
        { prop: 'btns', label: '按钮', btns: [{ name: '编辑' }] },
      ],
      { bom: false },
    )
    expect(csv).toBe('姓名\r\n张三')
  })

  it('formatter 优先于 dataOptions 与原始值', () => {
    const csv = buildCsv(
      [{ amount: 12.5 }],
      [
        {
          prop: 'amount',
          label: '金额',
          dataOptions: [{ label: '不该出现', value: 12.5 }],
          formatter: (_row, value) => `¥${Number(value).toFixed(2)}`,
        },
      ],
      { bom: false, includeHeader: false },
    )
    expect(csv).toBe('¥12.50')
  })

  it('空值默认空串，可自定义占位', () => {
    expect(buildCsv([{ name: '' }], [{ prop: 'name' }], { bom: false, includeHeader: false })).toBe('')
    expect(
      buildCsv([{}], [{ prop: 'name' }], {
        bom: false,
        includeHeader: false,
        emptyPlaceholder: '-',
      }),
    ).toBe('-')
  })

  it('支持 a.b 嵌套路径', () => {
    const csv = buildCsv([{ user: { name: '李四' } }], [{ prop: 'user.name', label: '姓名' }], {
      bom: false,
      includeHeader: false,
    })
    expect(csv).toBe('李四')
  })
})

describe('isCsvExportableColumn', () => {
  it('无 prop / key / label 的列不导出', () => {
    expect(isCsvExportableColumn({ type: 'selection' })).toBe(false)
    expect(isCsvExportableColumn({ prop: 'name' })).toBe(true)
    expect(isCsvExportableColumn({ label: '仅表头' })).toBe(true)
  })
})

describe('ensureCsvExtension', () => {
  it('缺扩展名补 .csv，已有扩展名保留', () => {
    expect(ensureCsvExtension('报表')).toBe('报表.csv')
    expect(ensureCsvExtension('report.CSV')).toBe('report.CSV')
    expect(ensureCsvExtension('report.xlsx')).toBe('report.xlsx')
    expect(ensureCsvExtension('')).toBe('export.csv')
  })
})

describe('exportTableCsv', () => {
  it('非 csv 格式明确抛错（默认引擎只有 CSV）', () => {
    expect(() => exportTableCsv({ rows: [], columns: [], type: 'xlsx' })).toThrow(
      /only supported by the vxe engine/,
    )
  })

  it('无 DOM 环境返回 false，不抛错', () => {
    expect(exportTableCsv({ rows: [{ name: '张三' }], columns })).toBe(false)
  })
})

describe('downloadCsv', () => {
  it('无 DOM 环境返回 false', () => {
    expect(downloadCsv('export', 'a,b')).toBe(false)
  })
})
