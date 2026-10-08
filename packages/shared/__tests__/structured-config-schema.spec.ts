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
import { compileTemplate } from '@vue/compiler-sfc'
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

  // 旧写法别名必须被接受：运行时三端都先过 normalizeFormType（core 单源）再查组件表，
  // form-item.schema.json 的 describe 也写明 camelCase "deprecated but still accepted"。
  // 只列 VALID_FORM_TYPES 会让校验与运行时打架 —— 加了入口校验（generateFromConfig）
  // 之后，表现为「过去能生成的旧配置现在抛错」，且报错只说"枚举不含它"，看不出别名本该合法。
  // 注意反面同样钉住（见上一个用例）：放行别名不等于放行任意字符串。
  it.each(['datePicker', 'timePicker'])('accepts deprecated camelCase alias: %s', (formtype) => {
    const out = StructuredCrudConfigSchema.safeParse({
      ...minimal,
      fields: [{ prop: 'x', label: 'x', formtype }],
    })
    expect(out.success).toBe(true)
    // 只做校验、不改写输入：别名原样保留，归一化仍由运行时的 normalizeFormType 负责。
    expect(out.success && out.data.fields[0].formtype).toBe(formtype)
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

  // 两类按钮的**兜底方向相反**，这是最容易抄错的一处：
  //   - 表格按钮：不配定位 → 左侧（core getButtonPosition「两者都未配时默认 'left'」）
  //   - 表单工具栏按钮：不配定位 → 右侧（core splitButtonsByDirection「默认（不配 direction）视为右侧」）
  // 把 TableBtnSchema 整段复制给 ToolbarBtnSchema 是最自然的写法，而症状是**所有未配
  // position 的表单按钮静默翻到左侧** —— 解析成功、零告警、门禁也只要「有 transform」就放行。
  // 这组用例与 check-schema-contract.mjs 的兜底方向断言一起把两个默认值钉死。
  describe('两类按钮的兜底方向必须相反（表格=左 / 表单=右）', () => {
    const parseToolbarBtn = (btn: Record<string, unknown>) => {
      const r = StructuredCrudConfigSchema.safeParse({
        name: 'Page',
        apiUrl: '/api/x',
        fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
        actions: ['add'],
        toolbarBtns: [btn],
      })
      expect(r.success).toBe(true)
      return (r as { data: { toolbarBtns: Array<Record<string, unknown>> } }).data.toolbarBtns[0]
    }

    it('表单按钮不配定位 → code:2（右侧，与 EsForm 的既有默认一致）', () => {
      expect(parseToolbarBtn({ name: '重置' }).code).toBe(2)
      expect(parseBtn({ name: '新增' }).code).toBe(1) // 表格按钮仍默认左侧
    })

    it("表单按钮 position:'left' → code:1", () => {
      expect(parseToolbarBtn({ name: '重置', position: 'left' }).code).toBe(1)
    })

    it("表单按钮 position:'right' → code:2", () => {
      expect(parseToolbarBtn({ name: '重置', position: 'right' }).code).toBe(2)
    })

    it("表单按钮只给 code 时保持原值（旧别名仍可用，code:1 不会被改写成右侧）", () => {
      expect(parseToolbarBtn({ name: '重置', code: 1 }).code).toBe(1)
      expect(parseToolbarBtn({ name: '重置', code: 2 }).code).toBe(2)
    })

    it('表单按钮两者冲突时以 position 为准', () => {
      expect(parseToolbarBtn({ name: '重置', position: 'left', code: 2 }).code).toBe(1)
    })

    // ── direction（旧字段，表单按钮专有）───────────────────────────────
    // core 的 resolveButtonSide 早把表单链定为 `direction → position → code → right`
    // （field-resolver.ts 有逐行依据），但本 schema 此前只声明 position/code ——
    // Zod 默认 strip 未知键，写 `direction:'left'` 会被静默丢掉、按钮落到右侧。
    // 同时 TableBtnSchema **故意不含** direction（表格链是 position → code → left，
    // 不含 direction），所以下面的对照断言不是可有可无的。
    it("表单按钮 direction:'left'/'right' → code:1/2", () => {
      expect(parseToolbarBtn({ name: '重置', direction: 'left' }).code).toBe(1)
      expect(parseToolbarBtn({ name: '重置', direction: 'right' }).code).toBe(2)
    })

    it('表单按钮 direction 优先于 position（与 core 的解析顺序一致）', () => {
      expect(parseToolbarBtn({ name: '重置', direction: 'left', position: 'right' }).code).toBe(1)
      expect(parseToolbarBtn({ name: '重置', direction: 'right', position: 'left' }).code).toBe(2)
    })

    it('表格按钮写 direction 不生效（TableBtnSchema 刻意不含该字段）', () => {
      const r = StructuredCrudConfigSchema.safeParse({
        name: 'Page',
        apiUrl: '/api/x',
        fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
        actions: ['add'],
        tableBtns: [{ name: '新增', direction: 'right' }],
      })
      expect(r.success).toBe(true)
      const btn = (r as { data: { tableBtns: Array<Record<string, unknown>> } }).data.tableBtns[0]
      // 表格链不含 direction：仍落到表格默认的左侧（code:1）。
      // 若哪天有人把 direction 也加进 TableBtnSchema，这条会红 —— 那正是它存在的意义。
      expect(btn.code).toBe(1)
    })
  })
})

// ── prop 安全约束（B2）────────────────────────────────────────────────
// `prop` 会成为生成文件的成员名 / 对象键 / 模板插槽名，并直接喂给 core 的
// parsePathSegments。同文件的 `name` 早就有可照抄的 refinement 先例，`prop` 此前
// 一个检查都没有 —— 于是一个 `prop: 'x"@mouseover="alert(1)'` 能被原样带进 SFC 模板。
//
// **嵌套路径是文档化的功能，不能挡**：form-item.schema.json 的 prop 描述明写
// "Supports nested paths like 'a.b' or 'a[0].b'"，core 的 parsePathSegments 也按
// `/\.|\[|\]/` 分段。所以 refinement 只拦「路径遍历 + 原型污染」，不拦路径语法本身。
// （曾有一版设想是在校验层把 `list[0].name` 这类 prop 一并拒掉，理由是 SFC 模式会
// 生成无效插槽名 —— 实测不成立：Vue 编译器把 `#column-a.b` / `#column-list[0].name`
// 原样保留为 `"column-a.b"` / `"column-list[0].name"`，与 `scopedSlots.customRender`
// 声明的名字逐字一致，没有分叉。见下方「插槽名」用例。）
describe('StructuredCrudConfigSchema — prop 路径安全约束', () => {
  const withProp = (prop: string) =>
    StructuredCrudConfigSchema.safeParse({
      name: 'Page',
      apiUrl: '/api/x',
      fields: [{ prop, label: 'A', formtype: 'Input' }],
      actions: ['add'],
    })

  it('拒绝路径分隔符与裸 "." / ".."', () => {
    for (const prop of ['a/b', 'a\\b', '..', '.', 'a/../b', '../a']) {
      expect(withProp(prop).success, prop).toBe(false)
    }
  })

  it('拒绝原型链上的危险键（含嵌在路径中间的）', () => {
    for (const prop of [
      '__proto__',
      'constructor',
      'prototype',
      'a.__proto__',
      'x[constructor].y',
      'a.prototype.b',
    ]) {
      expect(withProp(prop).success, prop).toBe(false)
    }
  })

  it('放行普通 camelCase / 中文 / 数字后缀', () => {
    for (const prop of ['userName', 'id', 'field2', '用户名']) {
      expect(withProp(prop).success, prop).toBe(true)
    }
  })

  it("放行嵌套路径（form-item.schema.json 文档化的 'a.b' / 'a[0].b'）", () => {
    for (const prop of ['a.b', 'list[0].name', 'a[0].b.c', 'user.address.city']) {
      expect(withProp(prop).success, prop).toBe(true)
    }
  })

  it('空段的分段口径与 core parsePathSegments 一致（`a..b` 等价于 `a.b`）', () => {
    // 两处都按 `/\.|\[|\]/` 分段并滤掉空串。若哪天只在一侧收紧，同一份配置在
    // 「校验通过的 prop」与「运行时读写的字段」之间就会错位。
    expect(withProp('a..b').success).toBe(true)
  })

  it('注入载荷不在校验层拦（由生成器的 qAttr/qMember 转义，见 check-generator-escaping）', () => {
    // 这里刻意断言「放行」：校验层拦不住也不该拦任意字符串（列名可以是任意用户文案），
    // 真正的防线是发射时的上下文转义 —— structured-generator 用 qAttr 写插槽名、
    // qMember 写成员访问。把它写成断言，是为了防止有人误以为校验收紧后发射层就可以放松。
    expect(withProp('x"@mouseover="alert(1)').success).toBe(true)
  })

  it('生成的插槽名与 scopedSlots.customRender 声明的名字逐字一致（嵌套路径无分叉）', () => {
    // 锁住上面那条「实测不成立」的结论：Vue 编译器不会把 `.b` / `[0]` 当成 v-slot 的
    // modifier 吃掉，slot 名就是完整的 `column-${prop}`。
    for (const prop of ['a.b', 'list[0].name']) {
      const r = compileTemplate({
        source: `<es-crud-page><template #column-${prop}="{ row }"><i/></template></es-crud-page>`,
        filename: 'probe.vue',
        id: 'probe',
      })
      expect(r.errors, prop).toHaveLength(0)
      expect(r.code, prop).toContain(`"column-${prop}"`)
    }
  })
})

// ── tableOptions.engine（C3b）─────────────────────────────────────────
// tableOptions 是普通 z.object（没有 passthrough），少声明一个键就等于把该配置
// 静默剥掉。`engine` 此前正是如此：写 `engine:'vxe'` 经 NL→config 走一遍会变成
// 默认引擎，而生成器那侧的白名单里同样没有它 —— 两级都丢。
describe('StructuredCrudConfigSchema — tableOptions.engine 不得被静默剥离', () => {
  const withTableOptions = (tableOptions: Record<string, unknown>) =>
    StructuredCrudConfigSchema.safeParse({
      name: 'Page',
      apiUrl: '/api/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      tableOptions,
    })

  it('engine 三值都保留下来', () => {
    for (const engine of ['default', 'virtual', 'vxe']) {
      const r = withTableOptions({ engine })
      expect(r.success, engine).toBe(true)
      expect(
        (r as { data: { tableOptions: Record<string, unknown> } }).data.tableOptions.engine,
        engine
      ).toBe(engine)
    }
  })

  it('非法 engine → 解析失败（而不是静默丢弃）', () => {
    expect(withTableOptions({ engine: 'nope' }).success).toBe(false)
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
