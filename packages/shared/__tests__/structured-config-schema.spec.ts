// Snapshot the SHAPE of StructuredCrudConfigSchema by running representative
// fixtures through it. We don't convert to JSON Schema (avoids adding the
// zod-to-json-schema dep), but the surface we lock is functionally equivalent:
// any change to required fields, defaults, enums, or accepted shapes will
// flip these snapshots and force a PR-time review.
//
// Why snapshot the SCHEMA, not just the generators:
//   - The docs site AiCrud page validates AI output against this exact schema
//   - mcp-server's validate_config tool exposes it as a tool surface
//   - cli's --from-config flag parses user JSON against it
//   - Changing a field name or making an optional field required breaks ALL
//     three consumers at once — and silently if no test guards it.

import { describe, it, expect } from 'vitest'
import { StructuredCrudConfigSchema } from '../src/structured-config.schema.js'

describe('StructuredCrudConfigSchema — name 路径穿越约束', () => {
  const base = {
    apiUrl: '/api/users',
    fields: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
    actions: ['add'] as const,
  }

  it('拒绝含路径分隔符 / "." / ".." / 盘符的 name', () => {
    for (const name of ['../../evil', 'a/b', 'a\\b', '..', '.', 'C:evil']) {
      expect(StructuredCrudConfigSchema.safeParse({ ...base, name }).success, name).toBe(false)
    }
  })

  it('放行 PascalCase 与中文页面名', () => {
    for (const name of ['UserManage', 'user-management', '用户管理']) {
      expect(StructuredCrudConfigSchema.safeParse({ ...base, name }).success, name).toBe(true)
    }
  })
})

// Minimal valid config — exercises required keys only.
// Required: name + apiUrl + fields[] + actions[] (per StructuredCrudConfigSchema).
const minimal = {
  name: 'UserManage',
  apiUrl: '/api/users',
  fields: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
  ],
  actions: ['add', 'edit', 'delete'] as const,
}

// Full-featured config — exercises every optional surface (rules, dataOptions,
// apiParams, formatter, render, permissions, virtual scrolling). Anything
// removed from the schema will surface here.
const full = {
  name: 'OrderList',
  apiUrl: '/api/orders',
  fields: [
    {
      prop: 'orderNo',
      label: '订单号',
      formtype: 'Input',
      inQuery: true,
      inTable: true,
      inForm: false,
      querySpan: 6,
      formSpan: 24,
      required: true,
      rules: [{ pattern: '^ORD-\\d+$', message: '格式不正确', trigger: 'blur' }],
      attrs: { placeholder: '请输入订单号' },
      width: 160,
      align: 'left' as const,
      fixed: 'left' as const,
      ellipsis: true,
    },
    {
      prop: 'status',
      label: '状态',
      formtype: 'Select',
      dataOptions: [
        { label: '待处理', value: 0 },
        { label: '已完成', value: 1, disabled: false },
      ],
      formatter: "(row) => row.status === 1 ? '已完成' : '待处理'",
    },
    {
      prop: 'deptId',
      label: '部门',
      formtype: 'Select',
      apiParams: { url: '/api/depts', method: 'GET' as const, labelField: 'name', valueField: 'id' },
    },
    {
      prop: 'createTime',
      label: '创建时间',
      formtype: 'DatePicker',
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' },
    },
  ],
  actions: ['add', 'edit', 'delete', 'view', 'export'] as const,
  toolbarBtns: [
    { name: '导出全部', key: 'export-all', type: 'primary' as const, triggerEvent: true },
  ],
  pagination: { pageSize: 20, pageSizes: [10, 20, 50] },
  tableOptions: { border: true, stripe: true, virtual: false },
  mode: 'schema' as const,
  target: 'vue3' as const,
}

describe('StructuredCrudConfigSchema — accepts valid configs', () => {
  it('accepts the minimal config and fills defaults', () => {
    const out = StructuredCrudConfigSchema.safeParse(minimal)
    expect(out.success).toBe(true)
    expect(out.success && out.data).toMatchSnapshot()
  })

  it('accepts the full-featured config end-to-end', () => {
    const out = StructuredCrudConfigSchema.safeParse(full)
    expect(out.success).toBe(true)
    expect(out.success && out.data).toMatchSnapshot()
  })
})

describe('StructuredCrudConfigSchema — rejects invalid input', () => {
  it('rejects missing required top-level keys', () => {
    const out = StructuredCrudConfigSchema.safeParse({})
    expect(out.success).toBe(false)
    expect(out.success === false && out.error.issues.map((i) => ({ path: i.path, code: i.code })))
      .toMatchSnapshot()
  })

  it('rejects unknown formtype', () => {
    const out = StructuredCrudConfigSchema.safeParse({
      ...minimal,
      fields: [{ prop: 'x', label: 'x', formtype: 'NotAFormType' }],
    })
    expect(out.success).toBe(false)
  })

  it('rejects empty prop / label', () => {
    const out = StructuredCrudConfigSchema.safeParse({
      ...minimal,
      fields: [{ prop: '', label: '', formtype: 'Input' }],
    })
    expect(out.success).toBe(false)
  })

  it('rejects out-of-range span', () => {
    const out = StructuredCrudConfigSchema.safeParse({
      ...minimal,
      fields: [{ prop: 'x', label: 'X', formtype: 'Input', querySpan: 99 }],
    })
    expect(out.success).toBe(false)
  })

  it('rejects unknown action', () => {
    const out = StructuredCrudConfigSchema.safeParse({
      ...minimal,
      actions: ['drop-database'],
    })
    expect(out.success).toBe(false)
  })

  it('rejects non-array fields', () => {
    const out = StructuredCrudConfigSchema.safeParse({ ...minimal, fields: {} })
    expect(out.success).toBe(false)
  })
})

// 回归：tableBtns 的定位字段。
//
// 此前 Schema 只声明 `code`，而渲染器契约（三端 BtnConfig）把 `position` 标为推荐、
// `code` 标为 deprecated，MCP 的 esplus://crud-page-schema 示例也通篇用 `position`。
// Zod 默认 strip 未知键 ⇒ 宿主 LLM 写 `position: 'right'` 时会被**静默改写成 code:1（左侧）**：
// 解析成功、零告警，按钮落到错误的一侧。这组用例把该行为钉死。
describe('StructuredCrudConfigSchema — tableBtns 定位字段（position ↔ code 归一化）', () => {
  const parseBtn = (btn: Record<string, unknown>) => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'Page',
      apiUrl: '/api/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      tableBtns: [btn],
    })
    expect(r.success).toBe(true)
    return (r as { data: { tableBtns: Array<Record<string, unknown>> } }).data.tableBtns[0]
  }

  it("position:'right' 被保留，并归一化为 code:2（而非静默退化成 code:1）", () => {
    const btn = parseBtn({ name: '新增', position: 'right' })
    expect(btn.position).toBe('right')
    expect(btn.code).toBe(2)
  })

  it("position:'left' 归一化为 code:1", () => {
    const btn = parseBtn({ name: '导出', position: 'left' })
    expect(btn.code).toBe(1)
  })

  it('只给 code 时保持原值（旧别名仍可用）', () => {
    expect(parseBtn({ name: '导出', code: 2 }).code).toBe(2)
    expect(parseBtn({ name: '导出', code: 1 }).code).toBe(1)
  })

  it('两者都给且冲突时以 position 为准（并保持 code 与之一致）', () => {
    const btn = parseBtn({ name: '导出', position: 'right', code: 1 })
    expect(btn.code).toBe(2)
  })

  it('都不给时默认为左侧 code:1（下游按 code 读取，不能缺失）', () => {
    expect(parseBtn({ name: '新增' }).code).toBe(1)
  })

  it('toolbarBtns 同样接受 position（不再被 strip）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'Page',
      apiUrl: '/api/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      toolbarBtns: [{ name: '重置', position: 'right' }],
    })
    expect(r.success).toBe(true)
    expect((r as { data: { toolbarBtns: Array<Record<string, unknown>> } }).data.toolbarBtns[0].position).toBe('right')
  })
})

describe('StructuredCrudConfigSchema — surface listing', () => {
  it('top-level keys are stable', () => {
    // ZodObject exposes .shape — snapshotting the key list catches accidental
    // renames or removals across versions.
    const keys = Object.keys((StructuredCrudConfigSchema as unknown as { shape: Record<string, unknown> }).shape).sort()
    expect(keys).toMatchSnapshot()
  })
})
