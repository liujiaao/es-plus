import { describe, it, expect } from 'vitest'
import { composeCrudConfig, type ComposeCrudInput } from '../src/compose-crud-config.js'
import { generateFromConfig, type StructuredCrudConfig } from '../src/structured-generator.js'

const base = { name: 'DemoManage', apiUrl: '/api/demo' }

describe('composeCrudConfig — 成员推导', () => {
  it('字段按出现的面确定 inQuery/inTable/inForm', () => {
    const input: ComposeCrudInput = {
      ...base,
      query: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      table: [
        { prop: 'name', label: '名称', formtype: 'Input' },
        { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker' },
      ],
      form: [{ prop: 'name', label: '名称', formtype: 'Input' }],
    }
    const { config } = composeCrudConfig(input)
    const name = config.fields.find((f) => f.prop === 'name')!
    const createdAt = config.fields.find((f) => f.prop === 'createdAt')!
    expect(name).toMatchObject({ inQuery: true, inTable: true, inForm: true })
    // 仅出现在 table 面 → 只有 inTable 为真
    expect(createdAt).toMatchObject({ inQuery: false, inTable: true, inForm: false })
  })

  it('字段顺序 = 首次出现顺序(query → table → form)', () => {
    const { config } = composeCrudConfig({
      ...base,
      query: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      table: [
        { prop: 'a', label: 'A', formtype: 'Input' },
        { prop: 'b', label: 'B', formtype: 'Input' },
      ],
      form: [{ prop: 'c', label: 'C', formtype: 'Input' }],
    })
    expect(config.fields.map((f) => f.prop)).toEqual(['a', 'b', 'c'])
  })
})

describe('composeCrudConfig — 固定优先级', () => {
  it('语义 form 面胜过 query 面', () => {
    const { config } = composeCrudConfig({
      ...base,
      query: [{ prop: 'status', label: '状态', formtype: 'Select', required: false, attrs: { placeholder: 'q' } }],
      form: [{ prop: 'status', label: '状态', formtype: 'Select', required: true, attrs: { placeholder: 'f' } }],
    })
    const status = config.fields.find((f) => f.prop === 'status')! as Record<string, unknown>
    expect(status.required).toBe(true)
    expect(status.attrs).toEqual({ placeholder: 'f' })
  })

  it('展示 table 面胜过 form 面', () => {
    const { config } = composeCrudConfig({
      ...base,
      form: [{ prop: 'amount', label: '金额', formtype: 'Input', width: 80, align: 'left' }],
      table: [{ prop: 'amount', label: '金额', formtype: 'Input', width: 120, align: 'right' }],
    })
    const amount = config.fields.find((f) => f.prop === 'amount')! as Record<string, unknown>
    expect(amount.width).toBe(120)
    expect(amount.align).toBe('right')
  })

  it('querySpan 来自 query 面、formSpan 来自 form 面', () => {
    const { config } = composeCrudConfig({
      ...base,
      query: [{ prop: 'name', label: '名称', formtype: 'Input', querySpan: 8 }],
      form: [{ prop: 'name', label: '名称', formtype: 'Input', formSpan: 12 }],
    })
    const name = config.fields.find((f) => f.prop === 'name')! as Record<string, unknown>
    expect(name.querySpan).toBe(8)
    expect(name.formSpan).toBe(12)
  })
})

describe('composeCrudConfig — 标识冲突告警(不静默改写)', () => {
  it('label / formtype 冲突时取首次并发告警', () => {
    const { config, warnings } = composeCrudConfig({
      ...base,
      query: [{ prop: 'status', label: '状态', formtype: 'Select' }],
      table: [{ prop: 'status', label: '狀態', formtype: 'Input' }],
    })
    const status = config.fields.find((f) => f.prop === 'status')! as Record<string, unknown>
    expect(status.label).toBe('状态')
    expect(status.formtype).toBe('Select')
    expect(warnings.some((w) => w.includes('label'))).toBe(true)
    expect(warnings.some((w) => w.includes('formtype'))).toBe(true)
  })

  it('无冲突时不产生告警', () => {
    const { warnings } = composeCrudConfig({
      ...base,
      query: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      table: [{ prop: 'name', label: '名称', formtype: 'Input' }],
    })
    expect(warnings).toEqual([])
  })
})

describe('composeCrudConfig — 动作推导', () => {
  it('显式 actions 原样采用', () => {
    const { config } = composeCrudConfig({ ...base, table: [{ prop: 'name', label: '名称', formtype: 'Input' }], actions: ['view'] })
    expect(config.actions).toEqual(['view'])
  })

  it('有 dialogs → 按 key 命中 add/edit/view', () => {
    const { config } = composeCrudConfig({
      ...base,
      table: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      dialogs: { add: { title: '新增' }, edit: { title: '编辑' } },
    })
    expect(config.actions).toEqual(['add', 'edit'])
  })

  it('无 dialogs 但有表单面 → add + edit', () => {
    const { config } = composeCrudConfig({
      ...base,
      table: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      form: [{ prop: 'name', label: '名称', formtype: 'Input' }],
    })
    expect(config.actions).toEqual(['add', 'edit'])
  })

  it('纯表格(无表单/弹窗) → view', () => {
    const { config } = composeCrudConfig({ ...base, table: [{ prop: 'name', label: '名称', formtype: 'Input' }] })
    expect(config.actions).toEqual(['view'])
  })
})

describe('composeCrudConfig — 端到端经 generateFromConfig(含表格子集的编译保证来源)', () => {
  it('query + table 可被 generateFromConfig 落地', () => {
    const { config } = composeCrudConfig({
      ...base,
      query: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      table: [
        { prop: 'name', label: '名称', formtype: 'Input' },
        { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker' },
      ],
      actions: ['view'],
    })
    const result = generateFromConfig(config as StructuredCrudConfig)
    expect(result.code).toContain('pageSchema')
    expect(result.wrapperCode).toBeTruthy()
  })

  it('table + dialog(多弹窗)可被 generateFromConfig 落地', () => {
    const { config } = composeCrudConfig({
      ...base,
      table: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      form: [{ prop: 'name', label: '名称', formtype: 'Input', required: true }],
      dialogs: {
        add: { title: '新增', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }] as any },
        edit: { title: '编辑', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }] as any },
      },
    })
    const result = generateFromConfig(config as StructuredCrudConfig)
    expect(result.code).toContain('dialogs')
    expect(config.actions).toEqual(['add', 'edit'])
  })
})
