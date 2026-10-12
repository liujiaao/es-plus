import { describe, it, expect } from 'vitest'
import { diffConfig, summarizeDiff } from '../src/config-diff.js'
import type { StructuredCrudConfig } from '../src/structured-config.schema.js'

// diffConfig 是 refine_config 工具的确定性内核(host 产出 next,工具 = 校验 + diff + 回显)。
// 这里钉住每类变更都被捕获:字段增/删/改、formtype、membership、name/apiUrl、actions。

const base = (): StructuredCrudConfig =>
  ({
    name: 'OrderManage',
    apiUrl: '/api/orders',
    fields: [
      { prop: 'orderNo', label: '订单号', formtype: 'Input', inQuery: true, inTable: true, inForm: true },
      { prop: 'amount', label: '金额', formtype: 'Input', inQuery: false, inTable: true, inForm: true },
    ],
    actions: ['add', 'edit', 'delete'],
  }) as unknown as StructuredCrudConfig

describe('diffConfig — 两份配置的结构化差异', () => {
  it('完全相同 → isEmpty', () => {
    const d = diffConfig(base(), base())
    expect(d.isEmpty).toBe(true)
    expect(summarizeDiff(d)).toEqual(['（无差异——这一轮纠正没有改变配置）'])
  })

  it('formtype 变更(金额改数值) → fieldsChanged 捕获 formtype + align', () => {
    const next = base()
    next.fields[1] = { ...next.fields[1], formtype: 'InputNumber', align: 'right' } as any
    const d = diffConfig(base(), next)
    expect(d.isEmpty).toBe(false)
    expect(d.fieldsChanged).toHaveLength(1)
    const fc = d.fieldsChanged[0]
    expect(fc.prop).toBe('amount')
    const byAttr = Object.fromEntries(fc.changes.map((c) => [c.attr, c]))
    expect(byAttr.formtype).toEqual({ attr: 'formtype', from: 'Input', to: 'InputNumber' })
    expect(byAttr.align).toEqual({ attr: 'align', from: undefined, to: 'right' })
    expect(summarizeDiff(d).join('\n')).toContain('~ 字段 amount')
  })

  it('membership 变更(inForm 关掉) 被捕获;缺省成员布尔按默认 true 归一,不误报', () => {
    const prev = base()
    const next = base()
    next.fields[0] = { ...next.fields[0], inForm: false } as any
    const d = diffConfig(prev, next)
    expect(d.fieldsChanged).toHaveLength(1)
    expect(d.fieldsChanged[0].changes).toEqual([{ attr: 'inForm', from: true, to: false }])
  })

  it('缺省 vs 显式 true 的成员布尔不算变更', () => {
    const prev = base()
    const next = base()
    // next 省略 inForm(默认即 true);prev 显式 inForm:true → 归一后相等,不应报变更。
    delete (next.fields[0] as any).inForm
    const d = diffConfig(prev, next)
    expect(d.isEmpty).toBe(true)
  })

  it('字段增 / 删', () => {
    const prev = base()
    const next = base()
    next.fields.push({ prop: 'remark', label: '备注', formtype: 'Input' } as any)
    next.fields.splice(0, 1) // 删 orderNo
    const d = diffConfig(prev, next)
    expect(d.fieldsAdded).toEqual(['remark'])
    expect(d.fieldsRemoved).toEqual(['orderNo'])
    const text = summarizeDiff(d).join('\n')
    expect(text).toContain('+ 字段 remark')
    expect(text).toContain('- 字段 orderNo')
  })

  it('actions 增 / 删', () => {
    const prev = base()
    const next = base()
    next.actions = ['add', 'edit', 'export'] // -delete +export
    const d = diffConfig(prev, next)
    expect(d.actionsAdded).toEqual(['export'])
    expect(d.actionsRemoved).toEqual(['delete'])
  })

  it('name / apiUrl 变更', () => {
    const prev = base()
    const next = base()
    next.name = 'OrderList'
    next.apiUrl = '/api/v2/orders'
    const d = diffConfig(prev, next)
    expect(d.name).toEqual({ from: 'OrderManage', to: 'OrderList' })
    expect(d.apiUrl).toEqual({ from: '/api/orders', to: '/api/v2/orders' })
  })

  it('prev 为空(首份配置) → 全部字段算新增,不抛', () => {
    const d = diffConfig(null, base())
    expect(d.fieldsAdded).toEqual(['orderNo', 'amount'])
    expect(d.fieldsRemoved).toEqual([])
    expect(d.actionsAdded).toEqual(['add', 'edit', 'delete'])
  })
})
