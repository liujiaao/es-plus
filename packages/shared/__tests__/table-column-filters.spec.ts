/**
 * TableColumn.filters —— 生成器侧的接线（W3-2）
 *
 * 运行时语义在 `@es-plus/core` 的 table-filter.ts（三端唯一求值点）；这里只钉「配置怎么
 * 走到列上」的三条：
 *   ① 两处 Zod 都声明三个键，显式 `columns` 不会被静默剥掉；
 *   ② SFC 模式把 filters 作为纯 JSON 发射（`filterMethod` 函数不进 AI 契约）；
 *   ③ 没写就不长键（产物可读，也避免把空筛选 UI 带给宿主）。
 */
import { describe, it, expect } from 'vitest'
import { generateFromConfig } from '../src/structured-generator'
import { StructuredCrudConfigSchema } from '../src/structured-config.schema'

const baseConfig = {
  name: 'OrderManage',
  apiUrl: '/api/orders',
  fields: [{ prop: 'orderNo', label: '单号', formtype: 'Input' as const }],
  actions: ['add' as const, 'edit' as const],
}

const filterColumn = {
  prop: 'orderNo',
  label: '单号',
  filters: [
    { text: '启用', value: 1 },
    { text: '停用', value: 0 },
  ],
  filterMultiple: false,
  filterMode: 'includes',
}

describe('filters — schema 校验与列契约', () => {
  it('显式 columns 里的 filters / filterMultiple / filterMode 不被剥键', () => {
    const parsed = StructuredCrudConfigSchema.parse({
      ...baseConfig,
      columns: [filterColumn],
    })
    expect((parsed.columns as any[])[0]).toMatchObject(filterColumn)
  })

  it('filters 的 value 拒绝对象（只收 JSON 标量）', () => {
    const bad = {
      ...baseConfig,
      columns: [{ prop: 'orderNo', label: '单号', filters: [{ text: 'x', value: { a: 1 } }] }],
    }
    expect(StructuredCrudConfigSchema.safeParse(bad).success).toBe(false)
  })

  it('filterMode 只收 equals | includes', () => {
    const ok = { ...baseConfig, columns: [{ ...filterColumn, filterMode: 'equals' }] }
    expect(StructuredCrudConfigSchema.safeParse(ok).success).toBe(true)
    const bad = { ...baseConfig, columns: [{ ...filterColumn, filterMode: 'contain' }] }
    expect(StructuredCrudConfigSchema.safeParse(bad).success).toBe(false)
  })
})

describe('filters — 生成产物', () => {
  it('schema 模式：列数据里保留 filters（纯 JSON）', () => {
    const { code } = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      columns: [filterColumn],
    } as any)
    expect(code).toContain('"filters"')
    expect(code).toContain('"启用"')
    expect(code).toContain('"includes"')
  })

  it('sfc 模式：filters 以列字面量发射，未声明的键不长出来', () => {
    const { code } = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      columns: [filterColumn],
    } as any)
    expect(code).toContain('filters: [')
    expect(code).toContain('"text":"启用"')
    expect(code).toContain('filterMultiple: false,')
    expect(code).toContain('filterMode: \'includes\',')

    const bare = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      columns: [{ prop: 'orderNo', label: '单号' }],
    } as any)
    expect(bare.code).not.toContain('filters')
    expect(bare.code).not.toContain('filterMode')
  })

  it('分组子列同样发射 filters', () => {
    const { code } = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      columns: [{ label: '分组', groups: [filterColumn] }],
    } as any)
    expect(code).toContain('filters: [')
    expect(code).toContain('"text":"启用"')
  })
})
