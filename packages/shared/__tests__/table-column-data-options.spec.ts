/**
 * TableColumn.dataOptions —— 生成器侧的接线（批 6）
 *
 * 运行时的码值映射在 `@es-plus/core` 的 table-cell.ts（三端渲染器共用）；这里只钉
 * 「配置怎么走到列上」的三条：
 *   ① 派生列自动继承 `fields[].dataOptions`（表单是下拉、表格就显示中文）；
 *   ② 显式 `columns`（结构覆盖）仍继承字段级 dataOptions，但列上显式写的优先；
 *   ③ SFC 模式把 dataOptions 作为纯 JSON 发射（两组 mode 同口径），分组子列同样继承。
 */
import { describe, it, expect } from 'vitest'
import { generateFromConfig } from '../src/structured-generator'
import { StructuredCrudConfigSchema } from '../src/structured-config.schema'

const baseConfig = {
  name: 'OrderManage',
  apiUrl: '/api/orders',
  fields: [
    { prop: 'orderNo', label: '单号', formtype: 'Input' as const },
    {
      prop: 'status',
      label: '状态',
      formtype: 'Select' as const,
      inQuery: false,
      dataOptions: [
        { label: '待处理', value: 0, tagType: 'info' as const },
        { label: '已完成', value: 2, tagType: 'success' as const },
      ],
    },
  ],
  actions: ['add' as const, 'edit' as const, 'delete' as const],
}

/** 只取产物里 `"columns"` 那一段：字段级选项还会出现在 formItems / dialogFormItems 里。 */
const columnsSection = (code: string): string => {
  const start = code.indexOf('"columns": [')
  const end = code.indexOf('"tableOptions":')
  return start >= 0 && end > start ? code.slice(start, end) : code
}

describe('dataOptions — 派生列', () => {
  it('schema 模式：字段级 dataOptions 带到列上（含 tagType）', () => {
    const { code } = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(code).toContain('dataOptions')
    expect(code).toContain('待处理')
    expect(code).toContain('tagType')
  })

  it('sfc 模式：同一份选项以纯 JSON 发射（不变成函数/扩展点）', () => {
    const { code } = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(code).toContain('dataOptions: [')
    expect(code).toContain('"label":"待处理"')
    expect(code).toContain('"tagType":"info"')
  })

  it('没有 dataOptions 的字段不凭空长出这个键', () => {
    const { code } = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      fields: [{ prop: 'orderNo', label: '单号', formtype: 'Input' as const }],
    })
    expect(code).not.toContain('dataOptions')
  })
})

describe('dataOptions — 显式 columns', () => {
  it('schema 模式：显式列（结构覆盖）仍继承字段级 dataOptions', () => {
    const { code } = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      columns: [{ prop: 'orderNo', label: '单号' }, { prop: 'status', label: '状态' }],
    } as any)
    expect(columnsSection(code)).toContain('待处理')
  })

  it('schema 模式：列上显式写的 dataOptions 优先于字段级', () => {
    const { code } = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      columns: [
        { prop: 'orderNo', label: '单号' },
        { prop: 'status', label: '状态', dataOptions: [{ label: '列级覆盖', value: 9 }] },
      ],
    } as any)
    expect(columnsSection(code)).toContain('列级覆盖')
    // 字段级选项仍在 formItems / dialogFormItems 里（表单是要用的），只是不覆盖到列上
    expect(columnsSection(code)).not.toContain('待处理')
  })

  it('sfc 模式：显式列与分组子列同样继承', () => {
    const flat = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      columns: [{ prop: 'orderNo', label: '单号' }, { prop: 'status', label: '状态' }],
    } as any)
    expect(flat.code).toContain('dataOptions: [')
    expect(flat.code).toContain('"label":"待处理"')

    const grouped = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      columns: [{ label: '分组', groups: [{ prop: 'status', label: '状态' }] }],
    } as any)
    expect(grouped.code).toContain('"label":"待处理"')
  })
})

describe('dataOptions — schema 校验', () => {
  it('接受 tagType 闭集', () => {
    expect(StructuredCrudConfigSchema.safeParse(baseConfig).success).toBe(true)
  })

  it('拒绝未知 tagType（拼错不该静默丢掉染色）', () => {
    const bad = {
      ...baseConfig,
      fields: [
        baseConfig.fields[0],
        {
          ...baseConfig.fields[1],
          dataOptions: [{ label: '待处理', value: 0, tagType: 'primaryy' }],
        },
      ],
    }
    expect(StructuredCrudConfigSchema.safeParse(bad).success).toBe(false)
  })

  it('显式 columns 里的 dataOptions 不被剥键（它已登记进列契约）', () => {
    const parsed = StructuredCrudConfigSchema.parse({
      ...baseConfig,
      columns: [{ prop: 'status', label: '状态', dataOptions: [{ label: '待处理', value: 0, tagType: 'info' }] }],
    })
    expect((parsed.columns as any[])[0].dataOptions).toEqual([
      { label: '待处理', value: 0, tagType: 'info' },
    ])
  })
})
