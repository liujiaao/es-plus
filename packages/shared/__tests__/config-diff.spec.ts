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

// ─────────────────────────────────────────────────────────────────────────────
// 顶层结构块：字段之外的改动也必须可见
// ─────────────────────────────────────────────────────────────────────────────

describe('diffConfig — 顶层结构块（dialogs / formLayout / tableOptions / 按钮面）', () => {
  it('只加了一个编辑弹窗 → 不再回「无差异」', () => {
    // 修前：diff 只比字段/操作，`dialogs` 的增删一律 isEmpty=true，
    // 宿主据此会以为本轮「加编辑弹窗」的纠正没生效。
    const prev = base()
    const next = base() as any
    next.dialogs = { edit: { title: '编辑订单', width: 600 } }
    const d = diffConfig(prev, next)
    expect(d.isEmpty).toBe(false)
    expect(d.blocksChanged.map((b) => b.key)).toEqual(['dialogs'])
    expect((d.blocksChanged[0].from as unknown) ?? undefined).toBeUndefined()
    expect((d.blocksChanged[0].to as any).edit.title).toBe('编辑订单')
    expect(summarizeDiff(d).join('\n')).toContain('~ dialogs:')
  })

  it('formLayout 改宽度 → 被捕获（此前完全不可见）', () => {
    const prev = { ...base(), formLayout: { labelWidth: '100px' } } as any
    const next = { ...base(), formLayout: { labelWidth: '140px', minFoldRows: 2 } } as any
    const d = diffConfig(prev, next)
    expect(d.isEmpty).toBe(false)
    expect(d.blocksChanged).toEqual([
      { key: 'formLayout', from: { labelWidth: '100px' }, to: { labelWidth: '140px', minFoldRows: 2 } },
    ])
  })

  it('tableOptions 改斑马纹 / 按钮面增删 → 各自一条', () => {
    const prev = { ...base(), tableOptions: { stripe: false }, tableBtns: [{ name: '导出' }] } as any
    const next = {
      ...base(),
      tableOptions: { stripe: true },
      tableBtns: [{ name: '导出' }, { name: '打印' }],
      operationColumn: { btns: [{ name: '查看' }] },
    } as any
    const d = diffConfig(prev, next)
    expect(d.blocksChanged.map((b) => b.key).sort()).toEqual(['operationColumn', 'tableBtns', 'tableOptions'])
  })

  it('块内键序不同不算差异（深比较按排序后的键）', () => {
    const prev = { ...base(), tableOptions: { border: true, stripe: true } } as any
    const next = { ...base(), tableOptions: { stripe: true, border: true } } as any
    expect(diffConfig(prev, next).isEmpty).toBe(true)
  })

  it('生成选项：缺省与显式 schema 默认值等价（target/mode/typescript/i18n 不误报）', () => {
    const prev = base()
    const next = { ...base(), target: 'vue3', mode: 'schema', typescript: true, i18n: false } as any
    expect(diffConfig(prev, next).isEmpty).toBe(true)
    // 真正换 target 必须报
    const changed = { ...base(), target: 'vue2' } as any
    expect(diffConfig(prev, changed).blocksChanged).toEqual([{ key: 'target', from: 'vue3', to: 'vue2' }])
  })

  it('块级渲染会截断长 JSON（dialogs 很大时不淹没回显）', () => {
    const next = base() as any
    next.dialogs = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`dlg${i}`, { title: `弹窗 ${i}`, width: 600 + i }]),
    )
    const text = summarizeDiff(diffConfig(base(), next)).join('\n')
    expect(text).toContain('~ dialogs: ∅ → {')
    expect(text).toContain('…')
    expect(text.length).toBeLessThan(400)
  })
})
