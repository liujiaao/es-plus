import { describe, it, expect } from 'vitest'
import { generateFromConfig, findDialogsWithoutOpener, findDialogButtonsWithoutDialog } from '../src/structured-generator'
import { StructuredCrudConfigSchema } from '../src/structured-config.schema'

const baseConfig = {
  name: 'UserManage',
  apiUrl: '/api/users',
  fields: [
    { prop: 'name', label: '姓名', formtype: 'Input' as const, required: true },
    { prop: 'phone', label: '手机号', formtype: 'Input' as const },
    {
      prop: 'status', label: '状态', formtype: 'Select' as const,
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }],
      render: "(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.status === 1 ? '启用' : '禁用')"
    },
    {
      prop: 'createTime', label: '创建时间', formtype: 'DatePicker' as const,
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' },
      inForm: false, querySpan: 8
    },
  ],
  actions: ['add' as const, 'edit' as const, 'delete' as const],
}

describe('StructuredCrudConfigSchema', () => {
  it('validates a correct config', () => {
    const result = StructuredCrudConfigSchema.safeParse(baseConfig)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = StructuredCrudConfigSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid formtype', () => {
    const result = StructuredCrudConfigSchema.safeParse({
      ...baseConfig,
      fields: [{ prop: 'x', label: 'X', formtype: 'InvalidType' }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid action', () => {
    const result = StructuredCrudConfigSchema.safeParse({
      ...baseConfig,
      actions: ['fly']
    })
    expect(result.success).toBe(false)
  })

  it('accepts import action', () => {
    const result = StructuredCrudConfigSchema.safeParse({
      ...baseConfig,
      actions: ['add', 'import']
    })
    expect(result.success).toBe(true)
  })
})

describe('generateFromConfig — schema mode', () => {
  it('generates schema JSON + wrapper code', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema', typescript: true })
    expect(result.code).toContain('CrudPageSchema')
    expect(result.code).toContain('/api/users')
    expect(result.wrapperCode).toBeDefined()
    expect(result.wrapperCode).toContain('es-crud-page')
    expect(result.wrapperCode).toContain('lang="ts"')
  })

  it('includes real apiUrl in schema', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.code).toContain('"/api/users"')
    expect(result.code).not.toContain('/api/xxx')
  })

  it('produces zero TODO comments when there are no extension points', () => {
    // The "zero TODO" invariant holds for the common case: a config with no
    // render/hasCustomRender extension points must generate complete code.
    const noExtensionFields = baseConfig.fields.filter(f => !('render' in f))
    const result = generateFromConfig({ ...baseConfig, fields: noExtensionFields, mode: 'schema' })
    expect(result.code).not.toContain('TODO')
    expect(result.wrapperCode).not.toContain('TODO')
  })

  it('emits a marked TODO(es-plus) extension point (not a silent drop) for render fields', () => {
    // WS-5 contract: schema mode can't inline render, so instead of silently
    // dropping the requirement it emits a marked stub echoing the original
    // render source — the gap is visible, and the code still compiles.
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.wrapperCode).toContain('TODO(es-plus)')
    // the original render intent is echoed so the developer can restore it
    expect(result.wrapperCode).toContain('requested render:')
    expect(result.wrapperCode).toContain('#column-status')
  })

  it('warns about render expressions in schema mode', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('status')
  })

  it('status-tag bound expression stays raw（AN-14：实体化会让 Volar 报语法错）', () => {
    // `:type="… 'success' : 'danger'"` 位于双引号属性值里：`'` 与 `&` 越不过定界，
    // 实体化只为「解码后仍是同一表达式」——但 Volar 把属性值原样交给 TS，
    // `&#39;` → TS1003、`&amp;&amp;` → TS1005，生成页在 IDE / vue-tsc 里满屏红叉。
    const { wrapperCode } = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(wrapperCode).toContain(`:type="row.status === 1 ? 'success' : 'danger'"`)
    expect(wrapperCode).not.toContain('&#39;')
    expect(wrapperCode).not.toContain('&amp;')
  })

  it('hostile prop 不再写出静态插槽名（注入面整条不发射）', () => {
    // 反例守卫：`"` 一旦裸奔就会提前结束属性值 —— 但更彻底的做法是**不发射**这个
    // 属性，因为 HTML 属性名里不可能出现 `"`（实体也不参与解码）。旧行为是
    // `#column-b&quot;…`：挡住了注入，却仍让模板编译器报非法属性名。
    const evil = {
      ...baseConfig,
      mode: 'schema' as const,
      fields: [
        {
          prop: 'b"@mouseover="alert(1)', label: 'X', formtype: 'Input' as const,
          render: '(_, { row }) => row.x',
        },
        {
          prop: 'status', label: '状态', formtype: 'Select' as const,
          dataOptions: [{ label: '启用', value: 1 }],
          render: '(_, { row }) => row.status',
        },
      ],
    }
    const result = generateFromConfig(evil as any)
    const wrapperCode = result.wrapperCode!
    // 注入面：不存在 `#column-` 开头的坏属性（裸引号或实体化都算）。
    // 只扫 **属性位置**（`<template #column-…`）—— TODO 注释里回显原 prop 不参与解析。
    expect(wrapperCode).not.toMatch(/<template\s+#column-b/)
    expect(wrapperCode).not.toContain('#column-b&quot;')
    // 需求不静默丢：留 TODO 注释 + 告警点名
    expect(wrapperCode).toContain('TODO(es-plus)')
    expect(result.warnings.join('\n')).toContain('无法写成静态插槽名')
    expect(result.warnings.join('\n')).toContain('b"@mouseover=')
    // 同页的正常字段不受牵连
    expect(wrapperCode).toContain('#column-status="{ row }"')
  })

  it('wires render fields to a scoped slot the wrapper actually renders', () => {
    // Schema mode can't inline render, so the column must declare
    // scopedSlots.customRender AND the wrapper must emit the matching
    // #column-<prop> template — otherwise the slot is dead code (es-table
    // only renders a column slot when scopedSlots.customRender is set).
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    const statusCol = schema.columns.find((c: any) => c.prop === 'status')
    expect(statusCol.scopedSlots).toEqual({ customRender: 'column-status' })
    // Columns without render must NOT declare a slot (avoids empty-cell bug)
    const nameCol = schema.columns.find((c: any) => c.prop === 'name')
    expect(nameCol.scopedSlots).toBeUndefined()
    expect(result.wrapperCode).toContain('#column-status')
  })

  // ── 显式 columns × 字段级 render：插槽必须有消费者 ──────────────────────────
  // 显式 columns 是 override 非 merge。此前 wrapper 仍按 `fields` 为每个 render 字段
  // 发射 `#column-x`，而显式列从不声明 `scopedSlots.customRender` —— 插槽无人消费，
  // render 静默不生效（单元格显示原值）。
  const explicitCols = {
    columns: [
      { prop: 'name', label: '姓名' },
      { prop: 'status', label: '状态' },
    ],
  }

  it('explicit columns（schema）：命中列的数据列挂上 scopedSlots.customRender', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema', ...explicitCols } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    const statusCol = schema.columns.find((c: any) => c.prop === 'status')
    expect(statusCol.scopedSlots).toEqual({ customRender: 'column-status' })
    expect(result.wrapperCode).toContain('#column-status="{ row }"')
    expect(result.warnings.join('\n')).not.toContain('no matching column')
  })

  it('explicit columns（schema）：被排除的 render 字段不发死插槽，并点名告警', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      columns: [{ prop: 'name', label: '姓名' }],
    } as any)
    expect(result.wrapperCode).not.toContain('#column-status')
    const warns = result.warnings.join('\n')
    expect(warns).toContain('no matching column')
    expect(warns).toContain('status')
  })

  it('explicit columns（sfc）：命中列的 render/formatter 仍按字段级扩展点内联', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      fields: baseConfig.fields.map((f) =>
        f.prop === 'phone' ? { ...f, formatter: '(_, __, cell) => `+86 ${cell}`' } : f
      ),
      columns: [...explicitCols.columns, { prop: 'phone', label: '手机号' }],
    } as any)
    const code = result.code
    // render 与 formatter 都落在显式列对象里（与派生列同一发射点/同一语法闸）
    expect(code).toContain("render: (_, { row }) => h(ElTag")
    expect(code).toContain('formatter: (_, __, cell) => `+86 ${cell}`')
    expect(result.warnings.join('\n')).not.toContain('no matching column')
  })

  it('explicit columns（sfc）：groups 子列同样认领字段级 render', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      columns: [{ label: '分组', groups: [{ prop: 'status', label: '状态' }] }],
    } as any)
    expect(result.code).toContain("render: (_, { row }) => h(ElTag")
  })

  // ── AI-31①：表单面的 render 不静默丢弃 ─────────────────────────────────────
  // buildFormItem 没有 render 分支，而两种模式的表单项都是 JSON —— 于是「表格面够不着」
  // 的 render（inTable:false 的查询/表单字段、弹窗 formItems）此前**静默**退化。契约：
  // 发含源码的降级告警 + 产物里落 TODO(es-plus) 占位；同时**不**对表格面字段乱开火。
  const formOnlyRenderField = {
    prop: 'level', label: '等级', formtype: 'Input' as const,
    inTable: false, inQuery: true, inForm: true,
    render: '(_, { row }) => h(ElTag, () => row.levelLabel)',
  }

  it('AI-31① schema: warns + marks a form-face-only render field', () => {
    const result = generateFromConfig({ ...baseConfig, fields: [...baseConfig.fields, formOnlyRenderField], mode: 'schema' })
    expect(result.warnings.some(w => w.includes('form-item render') && w.includes('level'))).toBe(true)
    expect(result.wrapperCode).toContain('TODO(es-plus): form-item render')
    expect(result.wrapperCode).toContain('"level": (_, { row }) => h(ElTag, () => row.levelLabel)')
  })

  it('AI-31① schema: covers dialog formItems carrying render', () => {
    const result = generateFromConfig({
      ...baseConfig, mode: 'schema',
      toolbarBtns: [{ name: '新增', dialogKey: 'add' }],
      dialogs: { add: { title: '新增', formItems: [formOnlyRenderField] } },
    })
    expect(result.warnings.some(w => w.includes('form-item render') && w.includes('level'))).toBe(true)
    expect(result.wrapperCode).toContain('TODO(es-plus): form-item render')
  })

  it('AI-31① sfc: warns + marks with a JS comment', () => {
    const result = generateFromConfig({ ...baseConfig, fields: [...baseConfig.fields, formOnlyRenderField], mode: 'sfc' })
    expect(result.warnings.some(w => w.includes('form-item render') && w.includes('level'))).toBe(true)
    expect(result.code).toContain('// TODO(es-plus): form-item render')
  })

  it('AI-31①: stays silent for table-cell renders (the 15-golden shape)', () => {
    // baseConfig.status 有 render 且 inTable 未声明（≠ false）→ 表格面消费得到，不属此列。
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.warnings.some(w => w.includes('form-item render'))).toBe(false)
    expect(result.wrapperCode).not.toContain('form-item render')
  })

  it('filters fields by inQuery/inTable/inForm', () => {
    const config = {
      ...baseConfig,
      fields: [
        { prop: 'a', label: 'A', formtype: 'Input' as const, inQuery: true, inTable: false, inForm: true },
        { prop: 'b', label: 'B', formtype: 'Input' as const, inQuery: false, inTable: true, inForm: false },
      ],
      mode: 'schema' as const,
    }
    const result = generateFromConfig(config)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.formItems.length).toBe(1)
    expect(schema.formItems[0].prop).toBe('a')
    expect(schema.columns.length).toBe(1)
    expect(schema.columns[0].prop).toBe('b')
  })

  it('includes dataOptions in output', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.code).toContain('"启用"')
    expect(result.code).toContain('"禁用"')
  })

  it('generates validation rules for required fields', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    const nameField = schema.dialogFormItems.find((f: any) => f.prop === 'name')
    expect(nameField.formItemOptions.rules[0].required).toBe(true)
  })

  it('includes delete handler in wrapper', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.wrapperCode).toContain('handleDelete')
    expect(result.wrapperCode).toContain('ElMessageBox.confirm')
  })

  it('includes btn-click handler in wrapper', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.wrapperCode).toContain('handleBtnClick')
    expect(result.wrapperCode).toContain('add-confirm')
    expect(result.wrapperCode).toContain('edit-confirm')
  })
})

describe('generateFromConfig — sfc mode', () => {
  it('generates a complete SFC', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc', typescript: true })
    expect(result.code).toContain('<template>')
    // baseConfig has add/edit → dialog uses JSX render, so script must be lang="tsx"
    // (@vitejs/plugin-vue-jsx required — plain lang="ts" cannot transform JSX)
    expect(result.code).toContain('<script setup lang="tsx">')
    expect(result.code).toContain('</script>')
    expect(result.wrapperCode).toBeUndefined()
  })

  it('uses plain lang for dialog-less SFC (no JSX render)', () => {
    // Only export action → no add/edit/view dialog → no JSX → plain lang
    const tsResult = generateFromConfig({ ...baseConfig, actions: ['export'], mode: 'sfc', typescript: true })
    expect(tsResult.code).toContain('<script setup lang="ts">')
    expect(tsResult.code).not.toContain('lang="tsx"')
    const jsResult = generateFromConfig({ ...baseConfig, actions: ['export'], mode: 'sfc', typescript: false })
    expect(jsResult.code).toContain('<script setup>')
    expect(jsResult.code).not.toContain('lang=')
  })

  it('includes TypeScript interface when typescript=true', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc', typescript: true })
    expect(result.code).toContain('interface QueryForm')
  })

  it('infers number|null type and null default for InputNumber', () => {
    const config = {
      ...baseConfig,
      fields: [...baseConfig.fields, { prop: 'amount', label: '金额', formtype: 'InputNumber' as const }],
    }
    const result = generateFromConfig({ ...config, mode: 'sfc', typescript: true })
    expect(result.code).toContain('amount: number | null')
    expect(result.code).toContain('amount: null')
  })

  it('escapes single quotes in data strings (label/prop) to keep SFC valid', () => {
    const config = {
      ...baseConfig,
      fields: [{ prop: "user's_name", label: "User's name", formtype: 'Input' as const }],
    }
    const result = generateFromConfig({ ...config, mode: 'sfc' })
    // 生成的列应包含转义后的 label，而不是破坏单引号的原始串
    expect(result.code).toContain("label: 'User\\'s name'")
    expect(result.code).toContain("prop: 'user\\'s_name'")
    expect(result.code).not.toContain("label: 'User's name'")
  })

  it('escapes backticks/`${` in apiUrl inside template literals', () => {
    const config = { ...baseConfig, apiUrl: 'https://api.com/x`y${z}' }
    const result = generateFromConfig({ ...config, mode: 'sfc' })
    // 生成代码里的反引号模板字面量 URL 必须转义，不能出现未转义的反引号注入
    expect(result.code).not.toContain('`https://api.com/x`y${z}')
    expect(result.code).toContain('\\`')
  })

  it('omits TypeScript when typescript=false', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc', typescript: false })
    // baseConfig has a dialog → JSX render → lang="jsx" (still no TypeScript syntax)
    expect(result.code).toContain('<script setup lang="jsx">')
    expect(result.code).not.toContain('lang="ts"')
    expect(result.code).not.toContain('interface QueryForm')
  })

  it('imports EsForm + httpRequest for dialog SFC (method B free function)', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc', typescript: true })
    // EsForm referenced by the JSX dialog render must be imported; httpRequest is the
    // exposed global request free-function that add/edit/delete call.
    expect(result.code).toMatch(/import\s*\{[^}]*\bEsForm\b[^}]*\}\s*from\s*'@es-plus\/vue3'/)
    expect(result.code).toMatch(/import\s*\{[^}]*\bhttpRequest\b[^}]*\}\s*from\s*'@es-plus\/vue3'/)
    expect(result.code).toContain('<EsForm')
  })

  it('uses real API URL in options and handlers', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).toContain("url: '/api/users'")
    expect(result.code).toContain('/api/users/${')
    expect(result.code).not.toContain('/api/xxx')
  })

  it('includes permission on buttons when configured', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      permissions: { add: 'user:add', edit: 'user:edit', delete: 'user:delete' }
    })
    expect(result.code).toContain("permissionValue: 'user:add'")
    expect(result.code).toContain("permissionValue: 'user:edit'")
    expect(result.code).toContain("permissionValue: 'user:delete'")
  })

  // 字段级 permissionValue ≠ 按钮级 permissions：它把「某些列/字段仅特定权限可见」落到 es-table
  // 的 filteredColumns / es-form 的 formItemListFilter（此前 schema+prompt+scorer 都认它，组件与
  // 生成器却都没有 → 静默丢弃）。这里锁住两条发射路径。
  it('emits field-level permissionValue on columns in SFC mode', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        { prop: 'salary', label: '基本工资', formtype: 'InputNumber' as const, inQuery: false, permissionValue: 'salary:view' },
      ],
    })
    expect(result.code).toContain("permissionValue: 'salary:view'")
  })

  it('emits field-level permissionValue into schema-mode JSON', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        { prop: 'salary', label: '基本工资', formtype: 'InputNumber' as const, inQuery: false, permissionValue: 'salary:view' },
      ],
    })
    // 列（buildTableColumn）+ 弹窗表单项（buildFormItem）都写进 pageSchema JSON
    expect(result.code).toContain('"permissionValue": "salary:view"')
    expect(result.wrapperCode).toBeDefined()
  })

  it('includes render expressions inline', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).toContain("render: (_, { row }) => h(ElTag")
  })

  // AI-06：声明式 isHidden 是**纯 JSON 数据**，两种模式都经 buildFormItem 发射
  // （schema 经 inlineJson 进 pageSchema；sfc 的 formItems 同样 inlineJson）。
  it('emits declarative isHidden into schema-mode JSON (query + dialog form items)', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        {
          prop: 'reason',
          label: '原因',
          formtype: 'Input' as const,
          inQuery: false,
          isHidden: { field: 'type', op: 'ne' as const, value: 'part' },
        },
      ],
    })
    // 单条件对象原样内联（未解析 defaults，逐字节等于输入）
    expect(result.code).toContain('"isHidden": {')
    expect(result.code).toContain('"field": "type"')
    expect(result.code).toContain('"op": "ne"')
    expect(result.code).toContain('"value": "part"')
  })

  it('emits declarative isHidden in SFC mode (conditions ride along with inlineJson formItems)', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        {
          prop: 'list',
          label: '名单',
          formtype: 'Input' as const,
          inQuery: false,
          isHidden: [{ field: 'a', op: 'eq' as const, value: 1 }, { field: 'b', op: 'falsy' as const }],
        },
      ],
    })
    expect(result.code).toContain('"isHidden": [')
    expect(result.code).toContain('"op": "eq"')
    expect(result.code).toContain('"op": "falsy"')
  })

  // AI-16：表达式形态的 isHidden 同样是纯 JSON 数据，两种模式都必须原样内联 ——
  // 否则它在生成期被静默丢掉，三端渲染时字段永远可见。
  it('emits expression isHidden into schema-mode JSON (or / 序关系 原样内联)', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        {
          prop: 'reason',
          label: '原因',
          formtype: 'Input' as const,
          inQuery: false,
          isHidden: { or: [{ '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] }] },
        } as never,
      ],
    })
    expect(result.code).toContain('"isHidden": {')
    expect(result.code).toContain('"or"')
    expect(result.code).toContain('"var": "status"')
    expect(result.code).toContain('"var": "amount"')
  })

  it('emits expression isHidden in SFC mode (inlineJson formItems)', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        {
          prop: 'reason',
          label: '原因',
          formtype: 'Input' as const,
          inQuery: false,
          isHidden: [{ field: 'a', op: 'eq' as const, value: 1 }, { '>': [{ var: 'b' }, 5] }],
        } as never,
      ],
    })
    expect(result.code).toContain('"var": "b"')
  })

  it('does NOT emit isHidden when absent (backward compatible: prior outputs byte-identical)', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.code).not.toContain('isHidden')
  })

  it('isHidden is form-scoped — a column-only field never leaks it into the emitted columns', () => {
    // 该字段 inQuery:false + inForm:false → 既不进查询表单也不进弹窗表单，
    // 只会被 buildTableColumn 处理；而 isHidden 只挂在 buildFormItem 上，
    // 故整个产物里不该出现它的条件（列级动态显隐是 hidCol 的静态语义）。
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      fields: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
        {
          prop: 'shadow',
          label: '影子列',
          formtype: 'Input' as const,
          inQuery: false,
          inForm: false,
          isHidden: { field: 'type', op: 'eq' as const, value: 'x' },
        },
      ],
    })
    expect(result.code).not.toContain('isHidden')
  })

  it('generates useDialog form with validation', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).toContain('useDialog')
    expect(result.code).toContain('openForm')
    expect(result.code).toContain("getRefs('form')?.validate()")
  })

  it('generates delete handler with real API', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).toContain('handleDelete')
    expect(result.code).toContain("method: 'DELETE'")
  })

  it('handles export action', () => {
    const result = generateFromConfig({
      ...baseConfig,
      actions: ['add', 'export'],
      mode: 'sfc'
    })
    expect(result.code).toContain('handleExport')
    expect(result.code).toContain("'导出'")
  })

  it('uses querySpan for date fields', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).toContain('"span": 8')
  })
})

describe('generateFromConfig — edge cases', () => {
  it('handles view-only actions', () => {
    const result = generateFromConfig({
      ...baseConfig,
      actions: ['view'],
      mode: 'sfc'
    })
    expect(result.code).toContain('查看')
    expect(result.code).not.toContain('handleDelete')
  })

  it('handles custom validation rules', () => {
    const config = {
      name: 'Test',
      apiUrl: '/api/test',
      fields: [{
        prop: 'email', label: '邮箱', formtype: 'Input' as const,
        required: true,
        rules: [{ type: 'email' as const, message: '邮箱格式不正确' }]
      }],
      actions: ['add' as const],
      mode: 'schema' as const,
    }
    const result = generateFromConfig(config)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    const emailField = schema.dialogFormItems[0]
    expect(emailField.formItemOptions.rules.length).toBe(2)
    expect(emailField.formItemOptions.rules[0].required).toBe(true)
    expect(emailField.formItemOptions.rules[1].type).toBe('email')
  })

  it('handles fields with apiParams for remote options', () => {
    const config = {
      name: 'Test',
      apiUrl: '/api/test',
      fields: [{
        prop: 'dept', label: '部门', formtype: 'Select' as const,
        apiParams: { url: '/api/depts/options', method: 'GET' as const }
      }],
      actions: ['add' as const],
      mode: 'schema' as const,
    }
    const result = generateFromConfig(config)
    expect(result.code).toContain('/api/depts/options')
  })

  it('summary includes field counts and API info', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.summary).toContain('/api/users')
    expect(result.summary).toContain('query fields')
    expect(result.summary).toContain('table columns')
  })
})

describe('Multi-Dialog Mode', () => {
  const multiDialogConfig = {
    ...baseConfig,
    mode: 'schema' as const,
    toolbarBtns: [
      { name: '新增', type: 'primary', icon: 'Plus', dialogKey: 'add' },
      { name: '导入', icon: 'Upload', dialogKey: 'import' },
    ],
    operationColumn: {
      width: 200,
      btns: [
        { name: '编辑', type: 'primary', dialogKey: 'edit' },
        { name: '删除', type: 'danger', confirm: '确定删除？' },
      ]
    },
    dialogs: {
      add: { title: '新增用户', width: '600px', formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const, required: true },
      ]},
      edit: { title: '编辑用户', width: '600px', formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const },
      ]},
      import: { title: '批量导入', width: '500px', hasCustomRender: true },
    }
  }

  it('schema validates with new multi-dialog fields', () => {
    const result = StructuredCrudConfigSchema.safeParse(multiDialogConfig)
    expect(result.success).toBe(true)
  })

  it('generates schema with toolbarBtns', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.code).toContain('toolbarBtns')
    expect(result.code).toContain('dialogKey')
    expect(result.code).toContain('"add"')
  })

  it('generates schema with operationColumn', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.code).toContain('operationColumn')
    expect(result.code).toContain('"编辑"')
    expect(result.code).toContain('"删除"')
  })

  it('generates schema with dialogs record', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.code).toContain('"dialogs"')
    expect(result.code).toContain('"新增用户"')
    expect(result.code).toContain('"编辑用户"')
    expect(result.code).toContain('"批量导入"')
  })

  it('emits warning for hasCustomRender dialogs', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.warnings.some(w => w.includes('import'))).toBe(true)
    expect(result.warnings.some(w => w.includes('hasCustomRender'))).toBe(true)
  })

  it('wrapper uses @dialog-confirm event in multi-dialog mode', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.wrapperCode).toContain('dialog-confirm')
    expect(result.wrapperCode).toContain('handleDialogConfirm')
  })

  it('summary indicates multi-dialog mode', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.summary).toContain('Multi-dialog mode')
    expect(result.summary).toContain('3 dialog(s)')
  })

  it('operationColumn: false is valid', () => {
    const config = { ...baseConfig, mode: 'schema' as const, operationColumn: false as const }
    const parseResult = StructuredCrudConfigSchema.safeParse(config)
    expect(parseResult.success).toBe(true)
  })

  it('legacy mode still works without new fields', () => {
    const legacyConfig = { ...baseConfig, mode: 'schema' as const }
    const result = generateFromConfig(legacyConfig)
    expect(result.code).toContain('dialogFormItems')
    expect(result.code).toContain('"actions"')
    expect(result.code).not.toContain('toolbarBtns')
    expect(result.code).not.toContain('"dialogs"')
  })

  it('dialog formItems get validation rules', () => {
    const result = generateFromConfig(multiDialogConfig)
    expect(result.code).toContain('required')
    expect(result.code).toContain('请输入姓名')
  })
})

describe('multi-target generation (vue3 / vue2 / antdv)', () => {
  const cfgFor = (target: 'vue3' | 'vue2' | 'antdv', mode: 'schema' | 'sfc') =>
    ({ ...baseConfig, target, mode, typescript: true } as any)

  it('emits the correct es-plus package name per target', () => {
    expect(generateFromConfig(cfgFor('vue3', 'schema')).wrapperCode).toContain("from '@es-plus/vue3'")
    expect(generateFromConfig(cfgFor('vue2', 'schema')).wrapperCode).toContain("from '@es-plus/vue2'")
    expect(generateFromConfig(cfgFor('antdv', 'schema')).wrapperCode).toContain("from '@es-plus/adapter-antdv'")
  })

  it('imports httpRequest from the target package in every schema wrapper', () => {
    for (const t of ['vue3', 'vue2', 'antdv'] as const) {
      const pkg = t === 'vue2' ? '@es-plus/vue2' : t === 'antdv' ? '@es-plus/adapter-antdv' : '@es-plus/vue3'
      const { wrapperCode } = generateFromConfig(cfgFor(t, 'schema'))
      expect(wrapperCode).toMatch(new RegExp(`import\\s*\\{\\s*httpRequest\\s*\\}\\s*from\\s*'${pkg.replace('/', '\\/')}'`))
    }
  })

  it('vue2 wrapper uses defineComponent + Element UI naming', () => {
    const { wrapperCode } = generateFromConfig(cfgFor('vue2', 'schema'))
    expect(wrapperCode).toContain('defineComponent({')
    expect(wrapperCode).toContain("from 'element-ui'")
    expect(wrapperCode).toContain('MessageBox.confirm')
    expect(wrapperCode).not.toContain('ElMessageBox')
    // vue2 SFC template must use .sync, not v-model:xxx —— 但 data-source 是例外（F7）：
    // vue2 es-table 从不 emit update:dataSource，`.sync` 是假承诺，只能发单向。
    const sfc = generateFromConfig(cfgFor('vue2', 'sfc')).code
    expect(sfc).toContain(':data-source="tableData"')
    expect(sfc).not.toContain(':data-source.sync')
    expect(sfc).not.toContain('v-model:data-source')
    // pagination 仍会 emit update:pagination，`.sync` 成立。
    expect(sfc).toContain(':pagination.sync=')
  })

  it('vue2 schema wrapper exposes pageSchema from setup()（AN-14）', () => {
    // Vue 2 的 template 只能解析 setup() 返回值；pageSchema 是 import 进来的绑定，
    // 不 return 就取不到 —— `:schema="pageSchema"` 静默变 undefined（空页面，无报错）。
    // 两个 builder（legacy / multi-dialog）各有一份 return，必须都覆盖。
    const legacy = generateFromConfig(cfgFor('vue2', 'schema')).wrapperCode
    expect(legacy).toMatch(/return \{[^}]*\bpageSchema\b[^}]*\}/)

    // 必须用**非空** dialogs —— 空 record 现在按「未声明」处理（见 render-plan.ts），
    // 会落回 legacy builder，这条断言就会在「看起来通过」的情况下失去覆盖对象。
    const multi = generateFromConfig({
      ...baseConfig,
      target: 'vue2',
      mode: 'schema',
      typescript: true,
      dialogs: { add: { title: '新增', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }] } },
    } as any).wrapperCode
    expect(multi).toMatch(/return \{[^}]*\bpageSchema\b[^}]*\}/)

    // 反例守卫：模板确实在用 pageSchema，否则上面的断言就只是钉了一个无用绑定。
    expect(legacy).toContain(':schema="pageSchema"')
    expect(multi).toContain(':schema="pageSchema"')
  })

  it('antdv wrapper uses Modal.confirm + a-tag color semantics', () => {
    const { wrapperCode } = generateFromConfig(cfgFor('antdv', 'schema'))
    expect(wrapperCode).toContain('Modal.confirm({')
    expect(wrapperCode).toContain("from 'ant-design-vue'")
    // status render slot must produce <a-tag :color>, not <el-tag :type>
    expect(wrapperCode).toContain('<a-tag :color=')
    expect(wrapperCode).not.toContain('<el-tag')
    expect(wrapperCode).not.toContain('ElMessageBox')
  })

  it('vue3 wrapper keeps <script setup> + Element Plus naming', () => {
    const { wrapperCode } = generateFromConfig(cfgFor('vue3', 'schema'))
    expect(wrapperCode).toContain('<script setup')
    expect(wrapperCode).toContain('ElMessageBox.confirm')
    expect(wrapperCode).toContain("from 'element-plus'")
  })

  it('never emits a slot directive in the component attribute list (only via <template>)', () => {
    // Regression: buildSchemaWrapper used to push `#column-x="{ row }"` as an
    // attribute of <es-crud-page>, which is invalid alongside named template slots.
    for (const t of ['vue3', 'vue2', 'antdv'] as const) {
      const { wrapperCode } = generateFromConfig(cfgFor(t, 'schema'))
      const openTag = wrapperCode!.slice(wrapperCode!.indexOf('<es-crud-page'), wrapperCode!.indexOf('>\n', wrapperCode!.indexOf('<es-crud-page')))
      expect(openTag).not.toContain('#column-')
      // the slot must still exist as a proper template
      expect(wrapperCode).toContain('<template #column-status="{ row }">')
    }
  })

  it('warns when antdv SFC inlines an Element-semantics render', () => {
    const { warnings } = generateFromConfig(cfgFor('antdv', 'sfc'))
    expect(warnings.some(w => w.includes('Ant Design Vue') && w.includes('color'))).toBe(true)
  })

  it('schema JSON is framework-invariant across targets', () => {
    // The single source of truth: schema.code (pageSchema JSON) must be byte-identical
    // regardless of target — only the wrapper/SFC differs.
    const extract = (t: 'vue3' | 'vue2' | 'antdv') => {
      const code = generateFromConfig(cfgFor(t, 'schema')).code
      return code.replace(/^import[^\n]*\n/gm, '').replace(/^.*?pageSchema[^=]*= /s, '')
    }
    expect(extract('vue2')).toBe(extract('vue3'))
    expect(extract('antdv')).toBe(extract('vue3'))
  })
})

describe('tableOptions passthrough', () => {
  it('passes tabHeight into schema tableOptions', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      tableOptions: { tabHeight: 500 },
    } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.tabHeight).toBe(500)
  })

  it('omits tabHeight when not configured', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.tabHeight).toBeUndefined()
  })

  // ── configTableOut（AI-08）─────────────────────────────────────────────────
  // 后端响应字段映射。与 engine 同构：Zod 的 tableOptions 是普通 z.object（无
  // passthrough），不在那里声明就会被剥掉 → NL→config 走一遍静默丢映射。
  // 组件读的是 options.configTableOut，schema 模式发进 schema.tableOptions。
  it('passes configTableOut into schema tableOptions（NL→config 路径）', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      tableOptions: { configTableOut: { tableData: 'list', total: 'totalCount' } },
    } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.configTableOut).toEqual({ tableData: 'list', total: 'totalCount' })
  })

  it('omits configTableOut when not configured（不给既有配置添新键）', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.configTableOut).toBeUndefined()
  })

  // SFC 模式的 options 是手搓块（非 JSON.stringify）——漏发即静默丢弃（WS-5）。
  // 逐键用 q() 转义（响应键名是用户数据，不是 JS 源）。
  it('emits configTableOut into the sfc options object', () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'sfc',
      tableOptions: { configTableOut: { tableData: 'data', current: 'pageIndex' } },
    } as any)
    expect(result.code).toContain("configTableOut: { tableData: 'data', current: 'pageIndex' }")
  })

  it('does not emit configTableOut in sfc mode when not configured', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).not.toContain('configTableOut')
  })

  it('warns that vue2 ignores virtual scrolling', () => {
    const result = generateFromConfig({
      ...baseConfig,
      target: 'vue2',
      mode: 'schema',
      tableOptions: { virtual: true },
    } as any)
    expect(result.warnings.some(w => w.includes('virtual'))).toBe(true)
  })

  // ── engine ───────────────────────────────────────────────────────────────
  // `engine` 此前在**两级**都被丢掉：Zod 的 tableOptions 是普通 z.object（无
  // passthrough）会剥掉它，生成器的发射白名单里也没有它。于是
  // `engine: 'vxe'` 经 NL→config 走一遍就静默变成默认引擎。
  // 下面同时钉住这两级，缺任一级都会红。
  it("passes engine through: 'virtual'", () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      tableOptions: { engine: 'virtual' },
    } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.engine).toBe('virtual')
  })

  it("passes engine through: 'vxe'（NL→config 路径静默丢过它）", () => {
    const result = generateFromConfig({
      ...baseConfig,
      mode: 'schema',
      tableOptions: { engine: 'vxe' },
    } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.engine).toBe('vxe')
  })

  it('omits engine when not configured（不给既有配置添新键）', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.engine).toBeUndefined()
  })

  it("vue2 + engine:'virtual' 也要警告（等价于 virtual:true，此前不警告）", () => {
    const result = generateFromConfig({
      ...baseConfig,
      target: 'vue2',
      mode: 'schema',
      tableOptions: { engine: 'virtual' },
    } as any)
    expect(result.warnings.some(w => w.includes('virtual'))).toBe(true)
  })

  // 反例：**曾经的错误告警**。旧实现断言「vue2 + engine:'vxe' 要警告（vxe 适配器
  // 只存在于 vue3/antdv）」—— 但 vue2 有完整的 vxe 适配器
  // （packages/vue2/src/components/es-table/engines/vxe-engine.vue，带单测
  // vxe-engine.spec.ts），generator 也把 engine 原样透传（同文件
  // `...(tOpts.engine ? { engine: tOpts.engine } : {})`），运行时确实走 vxe 引擎。
  // 三端对 vxe-table 的依赖声明完全一致（optional peerDependency，vue2 用 ^3.8.0），
  // vue3/antdv 不警告，vue2 就不该警告。旧测试把假信息钉成了契约，这里钉住真事实：
  // **不警告** + engine 必须留在产物里。
  it("vue2 + engine:'vxe' 不警告，且 engine 原样透传（vue2 也有 vxe 适配器）", () => {
    const result = generateFromConfig({
      ...baseConfig,
      target: 'vue2',
      mode: 'schema',
      tableOptions: { engine: 'vxe' },
    } as any)
    expect(result.warnings.some(w => w.includes('vxe'))).toBe(false)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.engine).toBe('vxe')
  })
})

describe('sfc mode — regression guards', () => {
  // 2.3a: every field inForm:false + a dialog action → formData must not carry a
  // leading comma (`reactive({ , ...row })` is a JS syntax error).
  it('emits valid reactive() when no field is form-visible (2.3a)', () => {
    const result = generateFromConfig({
      name: 'AuditView',
      apiUrl: '/api/audit',
      mode: 'sfc',
      fields: [
        { prop: 'operator', label: '操作人', formtype: 'Input', inForm: false },
        { prop: 'ip', label: 'IP', formtype: 'Input', inForm: false, inQuery: false },
      ],
      actions: ['view'],
    } as any)
    expect(result.code).not.toContain('reactive({ , ')
    expect(result.code).toContain('reactive({ ...row })')
  })

  // 2.3b: i18n + sfc column labels must use labelKey (matching schema mode),
  // never inline `label: '${t('field.x')}'` — nested single quotes break parsing
  // and `t` is never imported in the SFC.
  it('uses labelKey (not inline t()) for i18n column labels (2.3b)', () => {
    const result = generateFromConfig({
      name: 'DictI18n',
      apiUrl: '/api/dicts',
      mode: 'sfc',
      i18n: true,
      fields: [{ prop: 'dictName', label: '字典名', formtype: 'Input' }],
      actions: ['add'],
    } as any)
    expect(result.code).toContain("labelKey: 'field.dictName'")
    expect(result.code).not.toMatch(/'\$\{t\(/)
  })

  // 2.3d: pagination.pageSizes must be threaded into the pagination ref (es-table
  // reads pageSizes off the pagination object), not silently dropped.
  it('propagates pagination.pageSizes into the pagination ref (2.3d)', () => {
    const result = generateFromConfig({
      name: 'Paged',
      apiUrl: '/api/paged',
      mode: 'sfc',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['add'],
      pagination: { pageSizes: [5, 25, 75] },
    } as any)
    expect(result.code).toMatch(/pageSizes:\s*\[5,\s*25,\s*75\]/)
  })

  // 2.2=A: sfc mode does not consume dialogs/tableBtns/operationColumn — WS-5
  // requires surfacing that as a warning rather than silently dropping.
  it('AN-07: tableBtns aliases (label/action) are normalized before emission', () => {
    // 别名只在 Zod `.parse()` 的返回值上归一，而生成器不消费解析结果 ——
    // 不在入口再走一遍，产物里就会是 `label`/`action`，三端渲染器读 `name` 得到 undefined。
    const result = generateFromConfig({
      name: 'Material',
      apiUrl: '/api/materials',
      fields: [{ prop: 'code', label: '编码', formtype: 'Input' }],
      actions: ['add'],
      tableBtns: [{ label: '导出', action: 'export', position: 'left' }],
    } as any)
    expect(result.code).toContain('"name": "导出"')
    expect(result.code).toContain('"actionType": "export"')
    expect(result.code).toContain('"code": 1')
    // 别名键不得残留（否则下游同时看到 name 与 label 两个真相）。
    expect(result.code).not.toContain('"label": "导出"')
    expect(result.code).not.toContain('"action": "export"')
  })

  it('warns (does not silently drop) when sfc ignores dialogs/tableBtns/operationColumn (2.2)', () => {
    const result = generateFromConfig({
      name: 'Campaign',
      apiUrl: '/api/campaigns',
      mode: 'sfc',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['add', 'edit'],
      tableBtns: [{ name: '导出', code: 2 }],
      operationColumn: { width: 180, btns: [{ name: '编辑' }] },
      dialogs: { add: { title: '新建', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }] } },
    } as any)
    const w = result.warnings.find(w => w.includes('does not yet consume'))
    expect(w).toBeTruthy()
    expect(w).toContain('tableBtns')
    expect(w).toContain('operationColumn')
    expect(w).toContain('dialogs')
  })
})

describe('explicit table columns（AI-09 子项① groups）', () => {
  const cfgWithColumns = {
    name: 'UserManage',
    apiUrl: '/api/users',
    fields: [
      { prop: 'name', label: '姓名', formtype: 'Input' as const },
      // 仅进派生列（inQuery/inForm 均 false）—— 证明 columns 覆盖后它消失
      { prop: 'derivedOnly', label: '派生列', formtype: 'Input' as const, inQuery: false, inForm: false },
    ],
    actions: ['add' as const, 'edit' as const, 'delete' as const],
    columns: [
      { type: 'selection' },
      { prop: 'name', label: '姓名' },
      {
        label: '联系方式',
        groups: [
          { prop: 'phone', label: '手机号' },
          { prop: 'email', label: '邮箱' },
        ],
      },
    ],
  } as any

  it('schema 模式：columns 覆盖派生列（override 非 merge）+ 递归 groups 原样进 JSON', () => {
    const result = generateFromConfig(cfgWithColumns)
    expect(result.code).toContain('"type": "selection"')
    expect(result.code).toContain('"groups": [')
    expect(result.code).toContain('"label": "联系方式"')
    // 派生列不再出现（derivedOnly 是 inQuery/inForm 均 false 的纯表格字段）
    expect(result.code).not.toContain('"derivedOnly"')
  })

  it('schema 模式：无 columns 时派生列行为不变（回归）', () => {
    const { columns, ...noCols } = cfgWithColumns
    const result = generateFromConfig(noCols as any)
    expect(result.code).toContain('"prop": "derivedOnly"')
    expect(result.code).not.toContain('"type": "selection"')
  })

  it('sfc 模式：columns 覆盖 + 递归 groups 发射 + 操作列仍追加', () => {
    const result = generateFromConfig({ ...cfgWithColumns, mode: 'sfc' } as any)
    expect(result.code).toContain("type: 'selection'")
    expect(result.code).toContain('groups: [')
    expect(result.code).toContain("label: '联系方式'")
    expect(result.code).not.toContain('derivedOnly')
    // 操作列仍按 actions 追加（与派生路径一致，不让编辑/删除凭空消失）
    expect(result.code).toContain("prop: 'operate'")
    expect(result.code).toContain("label: '操作'")
  })

  it('sfc 模式：列字符串经 q() 转义（引号不破结构）', () => {
    const result = generateFromConfig({
      ...cfgWithColumns,
      mode: 'sfc',
      columns: [{ prop: 'name', label: "名'称" }],
    } as any)
    expect(result.code).toContain("label: '名\\'称'")
    expect(result.code).not.toContain("label: '名'称'")
  })

  it('StructuredCrudConfigSchema 接受递归 groups + 无 prop/label 的非字段列', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      columns: [{ type: 'selection' }, { label: '组', groups: [{ prop: 'a', label: 'A' }] }],
    })
    expect(r.success).toBe(true)
  })

  it('StructuredCrudConfigSchema 拒绝非法列 type', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      columns: [{ type: 'nope' }],
    })
    expect(r.success).toBe(false)
  })

  it('StructuredCrudConfigSchema 拒绝带路径分隔符的列 prop', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      columns: [{ prop: 'a/b', label: 'B' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('declarative row-expand content（AI-09 子项② expandConfig）', () => {
  const cfg = {
    name: 'OrderManage',
    apiUrl: '/api/orders',
    fields: [
      { prop: 'orderNo', label: '订单号', formtype: 'Input' as const },
      { prop: 'receiver', label: '收货人', formtype: 'Input' as const, inTable: false, inQuery: false },
    ],
    actions: ['add' as const, 'delete' as const],
    expandConfig: {
      title: '收货信息',
      fields: [
        { prop: 'receiver', label: '收货人' },
        { prop: 'phone', label: '联系电话' },
      ],
    },
  } as any

  it('schema 模式：无 columns 时前置一个展开列并挂上 expandConfig', () => {
    const result = generateFromConfig(cfg)
    expect(result.code).toContain('"type": "expand"')
    expect(result.code).toContain('"expandConfig": {')
    expect(result.code).toContain('"title": "收货信息"')
    // 展开列**前置**于派生列（orderNo 等字段列仍在其后）—— 只在表格 columns 数组内比较
    // （`"prop": "orderNo"` 在查询表单里也出现，全局 indexOf 会命中表单段而失真）
    const colsIdx = result.code.indexOf('"columns"')
    const expandIdx = result.code.indexOf('"type": "expand"', colsIdx)
    const firstFieldIdx = result.code.indexOf('"prop": "orderNo"', colsIdx)
    expect(expandIdx).toBeGreaterThanOrEqual(0)
    expect(expandIdx).toBeLessThan(firstFieldIdx)
    expect(result.warnings).toEqual([])
  })

  it('schema 模式：columns 已声明 {type:expand} 时内容挂到它上面（不重复前置、位置保持）', () => {
    const result = generateFromConfig({
      ...cfg,
      columns: [{ prop: 'orderNo', label: '订单号' }, { type: 'expand' }],
    } as any)
    // 只应存在**一个** expand 列（挂到已有的那个上，而非再前置一个）
    expect(result.code.match(/"type": "expand"/g)).toHaveLength(1)
    // 位置保持在 orderNo 之后（既不前置于首，也不追加到末）—— 只在表格 columns 数组内比较
    const colsIdx = result.code.indexOf('"columns"')
    const orderNoIdx = result.code.indexOf('"prop": "orderNo"', colsIdx)
    const expandIdx = result.code.indexOf('"type": "expand"', colsIdx)
    expect(expandIdx).toBeGreaterThan(orderNoIdx)
    expect(result.code).toContain('"expandConfig": {')
  })

  it('sfc 模式：发射 type:expand 列 + expandConfig 对象字面量 + 操作列仍追加', () => {
    const result = generateFromConfig({ ...cfg, mode: 'sfc' } as any)
    expect(result.code).toContain("type: 'expand'")
    expect(result.code).toContain('expandConfig: {"title":"收货信息"')
    expect(result.code).toContain("prop: 'operate'")
  })

  it('无 expandConfig 时不产生展开列（回归，不给既有配置添键）', () => {
    const { expandConfig, ...noEc } = cfg
    const result = generateFromConfig(noEc as any)
    expect(result.code).not.toContain('"type": "expand"')
    expect(result.warnings).toEqual([])
  })

  it('vxe 引擎下告警（展开内容不被 vxe 渲染）但数据保留', () => {
    const result = generateFromConfig({ ...cfg, tableOptions: { engine: 'vxe' } } as any)
    expect(result.warnings.some((w: string) => w.includes('vxe'))).toBe(true)
    expect(result.code).toContain('"expandConfig": {')
  })

  it('StructuredCrudConfigSchema 接受 expandConfig（title 可选 + labelKey）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      expandConfig: { fields: [{ prop: 'a', labelKey: 'field.a' }] },
    })
    expect(r.success).toBe(true)
  })

  it('StructuredCrudConfigSchema 拒绝空 fields 的 expandConfig（空展开无意义）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      expandConfig: { fields: [] },
    })
    expect(r.success).toBe(false)
  })

  // ── 列级 expandConfig（列内形态）────────────────────────────────────────────
  // 生成器的列契约白名单**从 ColumnSchema 推导**（structured-generator.ts 的
  // columnContractKeys），而 SFC 模式的 pushSfcColumn 本来就会发列上的 expandConfig。
  // 列级键此前没进 ColumnSchema ⇒ schema 模式被 sanitizeExplicitColumns 整键剥掉：
  // 同一个配置换 mode，展开器在 SFC 下有内容、在 schema 下恒空，且零告警。
  const colLevelCfg = {
    ...cfg,
    expandConfig: undefined,
    columns: [
      { prop: 'orderNo', label: '订单号' },
      {
        type: 'expand',
        expandConfig: { title: '收货信息', fields: [{ prop: 'phone', label: '联系电话' }] },
      },
    ],
  }

  it('schema 模式：列上的 expandConfig 不被剥（无顶层 expandConfig 时也能展开）', () => {
    const result = generateFromConfig(colLevelCfg as any)
    expect(result.code).toContain('"type": "expand"')
    expect(result.code).toContain('"expandConfig": {')
    expect(result.code).toContain('"title": "收货信息"')
    expect(result.warnings).toEqual([])
  })

  it('sfc 模式：列上的 expandConfig 同样发射（两模式等价）', () => {
    const result = generateFromConfig({ ...colLevelCfg, mode: 'sfc' } as any)
    expect(result.code).toContain('expandConfig: {"title":"收货信息"')
  })

  it('StructuredCrudConfigSchema 保留 columns[].expandConfig（Zod 默认 strip 会静默丢）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      columns: [{ type: 'expand', expandConfig: { fields: [{ prop: 'a', label: 'A' }] } }],
    })
    expect(r.success).toBe(true)
    expect((r as any).data.columns[0].expandConfig).toEqual({ fields: [{ prop: 'a', label: 'A' }] })
  })

  it('列级 expandConfig 空 fields 同样被拒（与顶层同形状）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      columns: [{ type: 'expand', expandConfig: { fields: [] } }],
    })
    expect(r.success).toBe(false)
  })
})

describe('declarative tree table（AI-09 子项③ treeConfig）', () => {
  const cfg = {
    name: 'DeptTreeManage',
    apiUrl: '/api/departments',
    fields: [
      { prop: 'deptName', label: '部门名称', formtype: 'Input' as const },
      { prop: 'leader', label: '负责人', formtype: 'Input' as const },
    ],
    actions: ['add' as const, 'delete' as const],
    treeConfig: { childrenField: 'subItems', expandAll: true },
  } as any

  it('schema 模式：发射运行时家 tableOptions.treeConfig（childrenField + expandAll）', () => {
    const result = generateFromConfig(cfg)
    expect(result.code).toContain('"treeConfig": {')
    expect(result.code).toContain('"childrenField": "subItems"')
    expect(result.code).toContain('"expandAll": true')
    // 运行时家落在 tableOptions 里（而非顶层 schema 的兄弟键）
    const toIdx = result.code.indexOf('"tableOptions"')
    const tcIdx = result.code.indexOf('"treeConfig"')
    expect(tcIdx).toBeGreaterThan(toIdx)
    expect(result.warnings).toEqual([])
  })

  it('schema 模式：顶层 treeConfig 缺省子键时发空对象（vxe 靠其存在进入树模式）', () => {
    const result = generateFromConfig({ ...cfg, treeConfig: {} } as any)
    expect(result.code).toContain('"treeConfig": {}')
  })

  it('sfc 模式：发射 options.treeConfig 块（逐键转义）', () => {
    const result = generateFromConfig({ ...cfg, mode: 'sfc' } as any)
    expect(result.code).toContain("treeConfig: { childrenField: 'subItems', expandAll: true },")
  })

  it('无 treeConfig 时不发射（回归，不给既有配置添键）', () => {
    const { treeConfig, ...noTc } = cfg
    const result = generateFromConfig(noTc as any)
    expect(result.code).not.toContain('"treeConfig"')
    expect(result.code).not.toContain('treeConfig:')
    expect(result.warnings).toEqual([])
  })

  it('StructuredCrudConfigSchema 接受窄子集 treeConfig（两键皆可选）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      treeConfig: { expandAll: true },
    })
    expect(r.success).toBe(true)
    const r2 = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      treeConfig: { childrenField: 'children' },
    })
    expect(r2.success).toBe(true)
  })

  it('StructuredCrudConfigSchema 拒绝非法形（childrenField 非字符串）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['add'],
      treeConfig: { childrenField: 123 },
    })
    expect(r.success).toBe(false)
  })
})

describe('declarative row merge（AI-23 mergeConfig）', () => {
  const cfg = {
    name: 'DeptStaffManage',
    apiUrl: '/api/staff',
    fields: [
      { prop: 'dept', label: '部门', formtype: 'Input' as const },
      { prop: 'team', label: '小组', formtype: 'Input' as const },
      { prop: 'name', label: '姓名', formtype: 'Input' as const },
    ],
    actions: ['add' as const, 'edit' as const],
    mergeConfig: { rowsBy: ['dept', 'team'] },
  } as any

  it('schema 模式：发射运行时家 tableOptions.mergeConfig（rowsBy 原序保留）', () => {
    const result = generateFromConfig(cfg)
    expect(result.code).toContain('"mergeConfig": {')
    expect(result.code).toContain('"rowsBy": [')
    // 运行时家落在 tableOptions 里（而非顶层 schema 的兄弟键）
    const toIdx = result.code.indexOf('"tableOptions"')
    const mcIdx = result.code.indexOf('"mergeConfig"')
    expect(mcIdx).toBeGreaterThan(toIdx)
    // 顺序是渲染契约（分组主轴）——不能被重排/去重
    const payload = result.code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)!
    expect(JSON.parse(payload[1]).tableOptions.mergeConfig).toEqual({ rowsBy: ['dept', 'team'] })
    expect(result.warnings).toEqual([])
  })

  it('sfc 模式：发射 options.mergeConfig 块（inlineJson 序列化）', () => {
    const result = generateFromConfig({ ...cfg, mode: 'sfc' } as any)
    expect(result.code).toContain('mergeConfig: {"rowsBy":["dept","team"]},')
  })

  it('无 mergeConfig 时不发射（回归，不给既有配置添键）', () => {
    const { mergeConfig, ...noMc } = cfg
    const result = generateFromConfig(noMc as any)
    expect(result.code).not.toContain('"mergeConfig"')
    expect(result.code).not.toContain('mergeConfig:')
    expect(result.warnings).toEqual([])
  })

  it('StructuredCrudConfigSchema 接受窄子集 mergeConfig（rowsBy 单列/多列）', () => {
    const base = { name: 'T', apiUrl: '/x', fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
    expect(StructuredCrudConfigSchema.safeParse({ ...base, mergeConfig: { rowsBy: ['a'] } }).success).toBe(true)
    expect(StructuredCrudConfigSchema.safeParse({ ...base, mergeConfig: { rowsBy: ['a', 'b'] } }).success).toBe(true)
  })

  it('StructuredCrudConfigSchema 拒绝非法形（rowsBy 为空 / 非数组 / 含非字符串）', () => {
    const base = { name: 'T', apiUrl: '/x', fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
    expect(StructuredCrudConfigSchema.safeParse({ ...base, mergeConfig: { rowsBy: [] } }).success).toBe(false)
    expect(StructuredCrudConfigSchema.safeParse({ ...base, mergeConfig: { rowsBy: 'a' } }).success).toBe(false)
    expect(StructuredCrudConfigSchema.safeParse({ ...base, mergeConfig: { rowsBy: [1] } }).success).toBe(false)
    expect(StructuredCrudConfigSchema.safeParse({ ...base, mergeConfig: {} }).success).toBe(false)
  })
})

describe('vxe inline editing（AI-09 子项④ editConfig + editRender）', () => {
  const cfg = {
    name: 'SkuPriceEditManage',
    apiUrl: '/api/sku',
    fields: [
      { prop: 'skuName', label: '商品名称', formtype: 'Input' as const },
      { prop: 'price', label: '价格', formtype: 'InputNumber' as const, inQuery: false },
    ],
    tableOptions: { engine: 'vxe', editConfig: { trigger: 'click', mode: 'cell' } },
    columns: [
      { prop: 'skuName', label: '商品名称', editRender: { name: '$input' } },
      { prop: 'price', label: '价格', editRender: { name: '$input', props: { type: 'number' } } },
    ],
    actions: ['edit' as const],
  } as any

  it('schema 模式：发射 tableOptions.editConfig + 列 editRender（engine:vxe 无告警）', () => {
    const result = generateFromConfig(cfg)
    expect(result.code).toContain('"editConfig": {')
    expect(result.code).toContain('"trigger": "click"')
    expect(result.code).toContain('"mode": "cell"')
    expect(result.code).toContain('"editRender": {')
    // editConfig 落在 tableOptions 块内（运行时唯一家）
    const toIdx = result.code.indexOf('"tableOptions"')
    const ecIdx = result.code.indexOf('"editConfig"')
    expect(ecIdx).toBeGreaterThan(toIdx)
    expect(result.warnings).toEqual([])
  })

  it('schema 模式：配置了 editConfig 但 engine 非 vxe → 告警（会被静默忽略）', () => {
    const result = generateFromConfig({
      ...cfg,
      tableOptions: { editConfig: { mode: 'cell' } }, // 无 engine
    } as any)
    expect(result.warnings.join('\n')).toContain("editConfig requires engine: 'vxe'")
    expect(result.warnings.join('\n')).toContain("'default'")
  })

  it('sfc 模式：发射 options.editConfig + 列 editRender 对象字面量', () => {
    const result = generateFromConfig({ ...cfg, mode: 'sfc' } as any)
    expect(result.code).toContain('editConfig: {"trigger":"click","mode":"cell"},')
    expect(result.code).toContain('editRender: {"name":"$input"},')
    expect(result.code).toContain('editRender: {"name":"$input","props":{"type":"number"}},')
    // 该 config 有 edit 动作 → vue3 SFC 本就有 JSX 弹窗告警（与本子项无关）；只需确认
    // 行内编辑自身不产生告警（engine:'vxe' 已给）。
    expect(result.warnings.join('\n')).not.toContain('editConfig')
  })

  it('sfc 模式：engine 非 vxe → 告警（对三端都适用，不在 isVue2 分支内）', () => {
    const result = generateFromConfig({
      ...cfg,
      mode: 'sfc',
      tableOptions: { engine: 'virtual', editConfig: { mode: 'row' } },
    } as any)
    expect(result.warnings.join('\n')).toContain("editConfig requires engine: 'vxe'")
  })

  it('无 editConfig / editRender 时不发射且无告警（回归，不给既有配置添键）', () => {
    const { tableOptions, columns, ...plain } = cfg
    const result = generateFromConfig(plain as any)
    expect(result.code).not.toContain('"editConfig"')
    expect(result.code).not.toContain('"editRender"')
    expect(result.warnings).toEqual([])
  })

  it('sfc 模式：列 editRender 含不可序列化值 → 降级告警并省略（发射的永远能编译）', () => {
    const result = generateFromConfig({
      ...cfg,
      mode: 'sfc',
      columns: [{ prop: 'skuName', label: '商品名称', editRender: { name: '$input', props: { n: 1n } } }],
    } as any)
    expect(result.code).not.toContain('editRender:')
    // AN-11②：告警必须点名**具体路径**（旧文案只说「含无法序列化的值」，且依赖
    // `JSON.stringify` 抛错 —— 而它对手上的函数/BigInt 之外的值根本不抛，是死代码）
    expect(result.warnings).toContain('列级行内编辑器 editRender 含无法 JSON 化的值（editRender.props.n）—— 整键已省略以保证编译通过。')
  })

  it('StructuredCrudConfigSchema 接受窄子集 editConfig + 列 editRender', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['edit'],
      tableOptions: { engine: 'vxe', editConfig: { trigger: 'dblclick', mode: 'row', showStatus: true, autoClear: true } },
      columns: [{ prop: 'a', label: 'A', editRender: { name: '$select', options: [{ label: '高', value: 'high' }], defaultValue: 'high' } }],
    })
    expect(r.success).toBe(true)
  })

  it('StructuredCrudConfigSchema 拒绝非法形（editConfig.trigger 非枚举）', () => {
    const r = StructuredCrudConfigSchema.safeParse({
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
      actions: ['edit'],
      tableOptions: { engine: 'vxe', editConfig: { trigger: 'hover' } },
    })
    expect(r.success).toBe(false)
  })
})


describe('AN-11 — 静默丢弃收口（转义 / 非 JSON 值 / 权限与行内编辑告警）', () => {
  const base = {
    name: 'An11Manage',
    apiUrl: '/api/an11',
    fields: [{ prop: 'name', label: '名称', formtype: 'Input' as const }],
    actions: ['add' as const],
  }

  it('① SFC 显式列 btns 里的 </script> 被转义（不能提前闭合宿主脚本块）', () => {
    const evil = 'A</script><script>alert(1)</script>'
    const result = generateFromConfig({
      ...base,
      mode: 'sfc',
      columns: [{ prop: 'name', label: '名称', btns: [{ name: evil, type: 'primary' }] }],
    } as any)

    // inlineJson 把 `</script` 改写为 `<\/script`（JSON 与 JS 语义均不变）
    expect(result.code).toContain('A<\\/script><script>alert(1)<\\/script>')
    // 未转义的原始串绝不能出现在产物里 —— HTML 解析器会在它出现处闭合 <script>
    expect(result.code).not.toContain(evil)
  })

  it('② SFC 显式列 btns 含函数 → 告警点名字段路径并整键省略', () => {
    const result = generateFromConfig({
      ...base,
      mode: 'sfc',
      columns: [{ prop: 'name', label: '名称', btns: [{ name: '按钮', click: () => 1 }] }],
    } as any)

    // 旧实现依赖 `JSON.stringify` 抛错，而它对手上的函数根本不抛 —— 是死代码。
    // 现由 findNonJsonValues 显式点名具体路径。
    expect(result.warnings.join('\n')).toContain('btns[0].click')
    expect(result.code).not.toMatch(/\bbtns:\s*\[/)
  })

  // AN-11③：表单面 render 降级成 **`//` 行注释**（AI-31① 的 TODO 标记）。行注释里的
  // `</script>` 同样会被 HTML 解析器当成宿主 script 块的结束标签 —— HTML 解析先于 JS，
  // 注释语法救不了它。所以 sanitizeForComment 必须打断 `</`（此前只处理空白与 `--`）。
  it('③ 表单面降级注释里的 </script> 被转义（`//` 注释挡不住 HTML 解析）', () => {
    const evil = 'A</script><script>alert(1)</script>'
    const result = generateFromConfig({
      ...base,
      mode: 'sfc',
      // inTable:false + render → 走表单面降级通道，render 只以注释形态落地
      fields: [{ prop: 'name', label: '名称', formtype: 'Input', inTable: false, render: evil }],
    } as any)

    expect(result.code).toContain('"name": A<\\/script><script>alert(1)<\\/script>')
    // 原始串绝不能出现：出现处即宿主 <script> 提前闭合
    expect(result.code).not.toContain(evil)
  })

  it('③ schema 模式：/permissions 无落点 → 告警点名键名（不再静默丢）', () => {
    const result = generateFromConfig({ ...base, permissions: { add: 'sys:an11:add' } } as any)

    expect(result.warnings.join('\n')).toContain('mode=schema ignores /permissions')
    expect(result.warnings.join('\n')).toContain('add')
  })

  it('③b sfc 模式消费 /permissions → 不发 schema 专属告警，且落到按钮 permissionValue', () => {
    const result = generateFromConfig({
      ...base,
      mode: 'sfc',
      permissions: { add: 'sys:an11:add' },
    } as any)

    expect(result.warnings.join('\n')).not.toContain('mode=schema ignores /permissions')
    expect(result.code).toContain("permissionValue: 'sys:an11:add'")
  })

  it('④ vxe editConfig 但无列声明 editRender → 告警（否则双击静默无反应）', () => {
    const result = generateFromConfig({
      ...base,
      actions: ['edit'],
      tableOptions: { engine: 'vxe', editConfig: { mode: 'cell' } },
    } as any)

    expect(result.warnings.join('\n')).toContain('no column declares `editRender`')
  })

  it('④b editConfig 配在非 vxe 引擎 → 告警引擎不匹配', () => {
    const result = generateFromConfig({
      ...base,
      actions: ['edit'],
      tableOptions: { editConfig: { mode: 'cell' } },
    } as any)

    expect(result.warnings.join('\n')).toContain("requires engine: 'vxe'")
  })
})


describe('AI-22 — tableOptions 尾部键 / 字段级 labelKey（strip-hazard 闭合）', () => {
  const TO = { size: 'small', showHeader: false, emptyText: '无数据', snIndex: true, leftText: '左', cachePageSelection: false, defaultSort: { prop: 'a', order: 'descending' }, refetchKeepPage: true, localPagination: true }
  const TO_KEYS = ['size', 'showHeader', 'emptyText', 'snIndex', 'leftText', 'cachePageSelection', 'defaultSort', 'refetchKeepPage', 'localPagination'] as const
  const cfg = (extra: Record<string, unknown> = {}) => ({
    name: 'T',
    apiUrl: '/x',
    fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
    actions: ['view'],
    tableOptions: TO,
    ...extra,
  })

  it('Zod 解析保留全部 9 个尾部键（不被静默剥，含 false 值）', () => {
    const r: any = StructuredCrudConfigSchema.safeParse(cfg())
    expect(r.success).toBe(true)
    for (const k of TO_KEYS) expect(r.data.tableOptions[k], `键 ${k} 不得被剥`).toBeDefined()
  })

  it('schema 模式把每个尾部键发射进 pageSchema.tableOptions（false 也必须落盘）', () => {
    const { code } = generateFromConfig(StructuredCrudConfigSchema.parse(cfg()) as any)
    const m = code.match(/export\s+const\s+pageSchema[^=]*=\s*(\{[\s\S]*\})\s*$/)!
    const to: any = JSON.parse(m[1]).tableOptions
    expect(to.size).toBe('small')
    expect(to.showHeader).toBe(false)
    expect(to.emptyText).toBe('无数据')
    expect(to.snIndex).toBe(true)
    expect(to.leftText).toBe('左')
    expect(to.cachePageSelection).toBe(false)
    expect(to.defaultSort).toEqual({ prop: 'a', order: 'descending' })
    expect(to.refetchKeepPage).toBe(true)
    expect(to.localPagination).toBe(true)
  })

  it('sfc 模式同样发射尾部键（手搓 options 块）', () => {
    const { code } = generateFromConfig(StructuredCrudConfigSchema.parse(cfg({ mode: 'sfc' })) as any)
    for (const k of TO_KEYS) expect(new RegExp('\\b' + k + '\\s*:').test(code), k).toBe(true)
  })

  it('字段级 labelKey 优先于 i18n 派生的 field.<prop>', () => {
    const r = generateFromConfig(StructuredCrudConfigSchema.parse(cfg({ i18n: true })) as any)
    const r2 = generateFromConfig(StructuredCrudConfigSchema.parse({
      name: 'T', apiUrl: '/x', i18n: true,
      fields: [{ prop: 'a', label: 'A', labelKey: 'user.a.label', formtype: 'Input' }],
      actions: ['view'],
    }) as any)
    expect(r.code + (r.wrapperCode || '')).toContain('field.a')
    expect(r2.code + (r2.wrapperCode || '')).toContain('user.a.label')
  })
})

describe('AI-35 — 声明的弹窗必须有人能打开（dialogs 不参与按钮派生）', () => {
  const F = [{ prop: 'a', label: 'A', formtype: 'Input' as const }]
  const dlg = { add: { title: '新增' }, edit: { title: '编辑' } }
  const flat = (extra: Record<string, unknown>) => ({ name: 'T', apiUrl: '/x', fields: F, ...extra })

  it('dialogs 存在不再抑制工具栏派生 —— 6 例语料的恢复形状', () => {
    // 修前：`normalizedToolbarBtns` 见到 dialogs 就返回 [] → add 无入口。
    // 修后：只有显式 operationColumn 才抑制派生，于是 add 由 actions 派生出来；
    // 行内 edit 照旧由 actions 派生（这一半从来就没坏过）。
    expect(findDialogsWithoutOpener(flat({ actions: ['add', 'edit', 'delete'], dialogs: dlg }) as any)).toEqual([])
  })

  it('actions 里没有 add ⇒ 派生不出入口 ⇒ 报出来（residual 形态 1）', () => {
    expect(findDialogsWithoutOpener(flat({ actions: ['edit', 'delete'], dialogs: dlg }) as any)).toEqual(['add'])
  })

  it('显式 operationColumn 整体接管按钮面 ⇒ 工具栏不再派生 ⇒ add 无入口（residual 形态 2）', () => {
    const cfg = flat({
      actions: ['add', 'edit', 'delete'],
      dialogs: dlg,
      operationColumn: { btns: [{ name: '编辑', key: 'edit', dialogKey: 'edit' }] },
    })
    expect(findDialogsWithoutOpener(cfg as any)).toEqual(['add'])
  })

  it('显式 toolbarBtns / tableBtns 里的 dialogKey 算入口', () => {
    // 工具栏显式给了 add 入口，行内 edit 仍由 actions 派生 ⇒ 两扇门都开着
    expect(
      findDialogsWithoutOpener(
        flat({
          actions: ['add', 'edit', 'delete'],
          dialogs: dlg,
          toolbarBtns: [{ name: '新建', dialogKey: 'add' }],
        }) as any
      )
    ).toEqual([])
    // 两个面都显式给全 ⇒ 也空集
    expect(
      findDialogsWithoutOpener(
        flat({
          actions: ['add', 'edit', 'delete'],
          dialogs: dlg,
          tableBtns: [{ name: '新增', dialogKey: 'add' }],
          operationColumn: { btns: [{ name: '编辑', dialogKey: 'edit' }] },
        }) as any
      )
    ).toEqual([])
  })

  it('显式空 toolbarBtns: [] 是「按钮面归我」的逃生舱 —— 行内 edit 仍在，add 没人开', () => {
    expect(
      findDialogsWithoutOpener(flat({ actions: ['add', 'edit', 'delete'], dialogs: dlg, toolbarBtns: [] }) as any)
    ).toEqual(['add'])
  })

  it('operationColumn: false 两面都不派生 ⇒ 两个弹窗都无入口', () => {
    expect(
      findDialogsWithoutOpener(flat({ actions: ['add', 'edit', 'delete'], dialogs: dlg, operationColumn: false }) as any)
    ).toEqual(['add', 'edit'])
  })

  it('columns 里已有操作列 ⇒ 不再派生行内按钮（只剩工具栏的 add）', () => {
    expect(
      findDialogsWithoutOpener(
        flat({ actions: ['add', 'edit', 'delete'], dialogs: dlg, columns: [{ prop: 'action' }] }) as any
      )
    ).toEqual(['edit'])
  })

  it('没有 dialogs / 没有 legacy dialogFormItems ⇒ 空集（不是缺陷）', () => {
    expect(findDialogsWithoutOpener(flat({ actions: ['add'] }) as any)).toEqual([])
    expect(findDialogsWithoutOpener(flat({ actions: ['add'], dialogFormItems: [] }) as any)).toEqual([])
  })

  it('legacy dialogFormItems 路径同样纳入（宿主手写配置）', () => {
    expect(
      findDialogsWithoutOpener(
        flat({
          actions: ['add', 'edit'],
          dialogFormItems: F,
          toolbarBtns: [],
          columns: [{ prop: 'action' }],
        }) as any
      )
    ).toEqual(['add', 'edit'])
  })

  it('生成器在 schema 模式发「不静默」警告，且点出是哪个弹窗', () => {
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(flat({ actions: ['edit', 'delete'], dialogs: dlg })) as any
    )
    const hit = warnings.find((w) => /has no opener/.test(w))
    expect(hit, warnings.join('\n')).toBeTruthy()
    expect(hit).toContain('dialogs.add')
  })

  it('没有无入口弹窗的配置不产生该警告（别把正常配置也报一遍）', () => {
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(flat({ actions: ['add', 'edit', 'delete'], dialogs: dlg })) as any
    )
    expect(warnings.some((w) => /has no opener/.test(w))).toBe(false)
  })

  it('sfc 模式不报（该模式整体不消费 dialogs，已有专门降级告警，别重复噪音）', () => {
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(flat({ mode: 'sfc', actions: ['edit', 'delete'], dialogs: dlg })) as any
    )
    expect(warnings.some((w) => /has no opener/.test(w))).toBe(false)
  })
})

// AI-35 的对偶：AI-35 管「弹窗没人能打开」，这里管「按钮指向的弹窗不存在」。
// 三端 `openDialog(key)` 在 `normalizedDialogs[key]` 缺席时**直接 return** —— 不报错、
// 不 emit `dialog-open`（行内按钮连 edit/view/btn-click 也不会 emit），于是按钮成了
// 死按钮。触发面有两类：显式 `dialogs` 只覆盖了部分动作（含 `dialogs.add: null`
// 被 repairConfig 删除后的形状），以及声明了按钮面但不声明 `dialogs`（此时生成器
// 走新模式、不再发射 legacy `dialogFormItems`，运行时一张弹窗都没有）。
describe('AI-35 对偶 — 按钮指向的弹窗不存在（openDialog 直接返回）', () => {
  const F = [{ prop: 'a', label: 'A', formtype: 'Input' as const }]
  const flat = (extra: Record<string, unknown>) => ({ name: 'T', apiUrl: '/x', fields: F, ...extra })

  it('显式 dialogs 只覆盖 edit ⇒ 派生的「新增」是死按钮', () => {
    expect(
      findDialogButtonsWithoutDialog(
        flat({ actions: ['add', 'edit'], dialogs: { edit: { title: '编辑' } } }) as any
      )
    ).toEqual(['toolbar "新增" (dialogKey: "add")'])
  })

  it('显式 dialogs 只覆盖 add ⇒ 派生的行内「编辑」是死按钮', () => {
    expect(
      findDialogButtonsWithoutDialog(
        flat({ actions: ['add', 'edit'], dialogs: { add: { title: '新增' } } }) as any
      )
    ).toEqual(['row "编辑" (dialogKey: "edit")'])
  })

  it('dialogs.add: null 经修复删除后只剩空 dialogs ⇒ 「新增」仍是死按钮', () => {
    // 这正是审计里点名的形状：null 被当作「未声明」删掉，但 actions 仍派生按钮。
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(
        flat({ actions: ['add'], dialogs: {} })
      ) as any
    )
    expect(warnings.some((w) => w.includes('点了不会有任何反应'))).toBe(true)
    expect(warnings.some((w) => w.includes('dialogKey: "add"'))).toBe(true)
  })

  it('既无 dialogs 又无表单字段（全 inForm:false）⇒ legacy 弹窗为空 ⇒ 死按钮', () => {
    const cfg = {
      name: 'T',
      apiUrl: '/x',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input', inForm: false, inQuery: false }],
      actions: ['add'],
    }
    expect(findDialogButtonsWithoutDialog(cfg as any)).toEqual(['toolbar "新增" (dialogKey: "add")'])
  })

  it('未声明 dialogs 且字段进表单 ⇒ legacy 会发射 dialogFormItems ⇒ 不报', () => {
    expect(findDialogButtonsWithoutDialog(flat({ actions: ['add', 'edit', 'delete'] }) as any)).toEqual([])
  })

  it('显式 toolbarBtns / tableBtns / operationColumn 的 dialogKey 同样核对', () => {
    expect(
      findDialogButtonsWithoutDialog(
        flat({
          actions: ['add'],
          dialogs: { add: { title: '新增' } },
          toolbarBtns: [{ name: '新建', dialogKey: 'add' }],
        }) as any
      )
    ).toEqual([])
    expect(
      findDialogButtonsWithoutDialog(
        flat({
          actions: ['add'],
          dialogs: { add: { title: '新增' } },
          tableBtns: [{ name: '复制', dialogKey: 'copy' }],
        }) as any
      )
    ).toEqual(['tableBtns[0] "复制" (dialogKey: "copy")'])
    expect(
      findDialogButtonsWithoutDialog(
        flat({
          actions: ['edit'],
          dialogs: { edit: { title: '编辑' } },
          operationColumn: { btns: [{ name: '修改', dialogKey: 'modify' }] },
        }) as any
      )
    ).toEqual(['operationColumn.btns[0] "修改" (dialogKey: "modify")'])
  })

  it('operationColumn:false / columns 自带操作列 ⇒ 不派生行内按钮 ⇒ 不误报', () => {
    expect(
      findDialogButtonsWithoutDialog(
        flat({ actions: ['edit'], dialogs: { add: {} }, operationColumn: false }) as any
      )
    ).toEqual([])
    expect(
      findDialogButtonsWithoutDialog(
        flat({ actions: ['edit'], dialogs: { add: {} }, columns: [{ prop: 'action' }] }) as any
      )
    ).toEqual([])
  })

  it('没有 dialogKey 的按钮（宿主自己补 click）不参与核对', () => {
    expect(
      findDialogButtonsWithoutDialog(
        flat({ actions: ['export'], dialogs: {}, tableBtns: [{ name: '导出' }] }) as any
      )
    ).toEqual([])
  })

  it('生成器在 schema 模式发警告、sfc 模式不重复噪音', () => {
    const cfg = flat({ actions: ['add'], dialogs: { edit: {} } })
    const schemaWarnings = generateFromConfig(StructuredCrudConfigSchema.parse(cfg) as any).warnings
    expect(schemaWarnings.some((w) => w.includes('点了不会有任何反应'))).toBe(true)
    const sfcWarnings = generateFromConfig(
      StructuredCrudConfigSchema.parse({ ...cfg, mode: 'sfc' }) as any
    ).warnings
    expect(sfcWarnings.some((w) => w.includes('点了不会有任何反应'))).toBe(false)
  })
})

// 三端 `mergedColumns` 在合并列表之前直接 `cols.push(操作列)`：显式 `columns` 里
// 已经自带一条带 `btns` 的操作列时，页面上会出现**两条**操作列（运行时无从知道
// 用户想要哪一条，也不会报错）。生成器据此告警（mark, never drop）。
describe('显式 operationColumn 与 columns 自带操作列重复', () => {
  const base = (extra: Record<string, unknown>) => ({
    name: 'T',
    apiUrl: '/x',
    fields: [{ prop: 'a', label: 'A', formtype: 'Input' as const }],
    actions: ['edit'],
    dialogs: { edit: { title: '编辑' } },
    ...extra,
  })

  it('两者都声明 ⇒ 告警', () => {
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(
        base({
          columns: [{ prop: 'operate', btns: [{ name: '编辑', dialogKey: 'edit' }] }],
          operationColumn: { btns: [{ name: '编辑', dialogKey: 'edit' }] },
        })
      ) as any
    )
    expect(warnings.some((w) => w.includes('两个操作列'))).toBe(true)
  })

  it('operationColumn:false + 自带 btns 列是受支持写法 ⇒ 不报', () => {
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(
        base({
          columns: [{ prop: 'operate', btns: [{ name: '编辑', dialogKey: 'edit' }] }],
          operationColumn: false,
        })
      ) as any
    )
    expect(warnings.some((w) => w.includes('两个操作列'))).toBe(false)
  })

  it('只声明 operationColumn（columns 无操作列）⇒ 不报', () => {
    const { warnings } = generateFromConfig(
      StructuredCrudConfigSchema.parse(
        base({ operationColumn: { btns: [{ name: '编辑', dialogKey: 'edit' }] } })
      ) as any
    )
    expect(warnings.some((w) => w.includes('两个操作列'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AN-08：未知键 / 别名归一 / 表域语义键（tableOptions.treeConfig、expandConfig、pageSizes）
// ─────────────────────────────────────────────────────────────────────────────

describe('AN-08 未知键：生成侧告警（不静默、不阻断）', () => {
  const cfg = () => ({
    name: 'UnknownKeyDemo',
    apiUrl: '/api/demo',
    fields: [{ prop: 'name', label: '名称', formtype: 'Input' as const }],
    actions: ['add' as const],
  })

  it('tableOptions.rowKey（大小写错）→ 警告点名 + did you mean rowkey', () => {
    const result = generateFromConfig({ ...cfg(), tableOptions: { rowKey: 'id' } } as any)
    const hit = result.warnings.find((w) => w.includes('未知键 "rowKey"'))
    expect(hit, result.warnings.join('\n')).toBeTruthy()
    expect(hit).toContain('did you mean "rowkey"')
    // 生成照常进行（过渡期语义：告警，不抛错）
    expect(result.code).toContain('export const pageSchema')
  })

  it('顶层拼写错也会被点出来（不会只说「成功」）', () => {
    const result = generateFromConfig({ ...cfg(), nme: 'X' } as any)
    expect(result.warnings.join('\n')).toContain('未知键 "nme"')
  })

  it('x-* 扩展键不告警（有意的元数据）', () => {
    const result = generateFromConfig({ ...cfg(), 'x-owner': 'team-a' } as any)
    expect(result.warnings.some((w) => w.includes('未知键'))).toBe(false)
  })

  it('合规配置零告警（回归：别让干净输入也背一句噪音）', () => {
    const result = generateFromConfig(cfg() as any)
    expect(result.warnings.some((w) => w.includes('未知键'))).toBe(false)
  })
})

describe('AN-08 入口归一：顶层 rowkey 并入 tableOptions', () => {
  it('生成前搬迁，并给出「自动归一」告警', () => {
    const result = generateFromConfig({
      name: 'RowkeyDemo',
      apiUrl: '/api/demo',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['add'],
      rowkey: 'uid',
    } as any)
    expect(result.warnings.join('\n')).toContain('/rowkey → /tableOptions/rowkey')
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.rowkey).toBe('uid')
  })
})

describe('AN-08 表域语义键：tableOptions.treeConfig / expandConfig', () => {
  const cfg = () => ({
    name: 'VxeTreeDemo',
    apiUrl: '/api/tree',
    fields: [{ prop: 'name', label: '名称', formtype: 'Input' as const }],
    actions: ['view' as const],
    tableOptions: {
      engine: 'vxe',
      treeConfig: { transform: true, rowField: 'id', parentField: 'pid', expandAll: true },
      expandConfig: { accordion: true },
    },
  })

  it('schema 模式：原样发射 vxe 语义子集', () => {
    const result = generateFromConfig(cfg() as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.treeConfig).toEqual({
      transform: true,
      rowField: 'id',
      parentField: 'pid',
      expandAll: true,
    })
    expect(schema.tableOptions.expandConfig).toEqual({ accordion: true })
    expect(result.warnings.some((w) => w.includes('未知键'))).toBe(false)
  })

  it('sfc 模式：以对象字面量发射', () => {
    const result = generateFromConfig({ ...cfg(), mode: 'sfc' } as any)
    expect(result.code).toContain('treeConfig: {"transform":true,"rowField":"id","parentField":"pid","expandAll":true},')
    expect(result.code).toContain('expandConfig: {"accordion":true},')
  })

  it('顶层 treeConfig 与 tableOptions.treeConfig 合并：顶层同名字键覆盖（跨渲染器同一承诺）', () => {
    const result = generateFromConfig({
      ...cfg(),
      treeConfig: { childrenField: 'subItems', expandAll: false },
    } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    // 富键保留，窄键覆盖同名键
    expect(schema.tableOptions.treeConfig).toMatchObject({
      transform: true,
      rowField: 'id',
      childrenField: 'subItems',
      expandAll: false,
    })
  })

  it('只给顶层 treeConfig 时，不把 tableOptions 里的其他键丢掉', () => {
    const result = generateFromConfig({
      name: 'TreeOnly',
      apiUrl: '/api/tree',
      fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      actions: ['view'],
      tableOptions: { border: false },
      treeConfig: { childrenField: 'kids' },
    } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.tableOptions.border).toBe(false)
    expect(schema.tableOptions.treeConfig).toEqual({ childrenField: 'kids' })
  })
})

describe('AN-08 pagination.pageSizes（schema 模式也发射）', () => {
  const cfg = {
    name: 'PageSizesDemo',
    apiUrl: '/api/demo',
    fields: [{ prop: 'name', label: '名称', formtype: 'Input' as const }],
    actions: ['view' as const],
  }

  it('声明了就进 pageSchema.pagination.pageSizes', () => {
    const result = generateFromConfig({ ...cfg, pagination: { pageSize: 20, pageSizes: [10, 20, 50] } } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.pagination).toEqual({ pageSize: 20, pageSizes: [10, 20, 50] })
  })

  it('没声明时不产生这个键（不改变既有产物）', () => {
    const result = generateFromConfig({ ...cfg, pagination: { pageSize: 20 } } as any)
    const schema = JSON.parse(result.code.replace(/^.*?= /, '').replace(/\n$/, ''))
    expect(schema.pagination).toEqual({ pageSize: 20 })
  })
})

describe('AN-08 显式 columns：契约键之外不泄漏进产物', () => {
  // 背景：schema 模式曾把 `config.columns` **原样**展开，SFC 模式只发结构化键 —— 同一份
  // 配置两种模式产物不同。最危险的不是拼写错误而是列级 `formatter` **字符串**：
  // `use-column-adapter` 直接 `col.formatter(...)` 调用，字符串会在渲染时抛 not a function。
  const cfg = (columns: Array<Record<string, unknown>>) => ({
    name: 'ExplicitColsDemo',
    apiUrl: '/api/demo',
    fields: [
      { prop: 'name', label: '名称', formtype: 'Input' as const },
      { prop: 'salary', label: '月薪', formtype: 'InputNumber' as const },
    ],
    actions: ['add' as const],
    columns,
  })
  const parseSchema = (code: string) => JSON.parse(code.replace(/^.*?= /, '').replace(/\n$/, ''))

  it('列级 formatter（JSON 里的字符串）被剥掉，并在警告里点名', () => {
    const result = generateFromConfig(
      cfg([
        { prop: 'name', label: '名称' },
        { prop: 'salary', label: '月薪', formatter: '(row) => row.salary' },
      ]) as any,
    )
    const schema = parseSchema(result.code)
    expect(schema.columns[1]).toEqual({ prop: 'salary', label: '月薪' })
    expect(result.code).not.toContain('formatter')
    const hit = result.warnings.find((w) => w.includes('未知键 "formatter"'))
    expect(hit, result.warnings.join('\n')).toBeTruthy()
  })

  it('列内拼写错（widht）同样剥掉并给建议', () => {
    const result = generateFromConfig(
      cfg([{ prop: 'name', label: '名称', widht: 120 }]) as any,
    )
    const schema = parseSchema(result.code)
    expect(schema.columns[0]).toEqual({ prop: 'name', label: '名称' })
    const joined = result.warnings.join('\n')
    expect(joined).toContain('未知键 "widht"')
    expect(joined).toContain('did you mean "width"')
  })

  it('groups 递归内的未知键也被剥（分组表头的子列同规则）', () => {
    const result = generateFromConfig(
      cfg([
        {
          label: '投放信息',
          groups: [{ prop: 'name', label: '名称', widht: 80 }],
        },
      ]) as any,
    )
    const schema = parseSchema(result.code)
    expect(schema.columns[0]).toEqual({ label: '投放信息', groups: [{ prop: 'name', label: '名称' }] })
    expect(result.warnings.join('\n')).toContain('未知键 "widht"')
  })

  it('列上的 x-* 扩展键保留（有意的元数据，不是拼写错误）', () => {
    const result = generateFromConfig(
      cfg([{ prop: 'name', label: '名称', 'x-owner': 'team-a' }]) as any,
    )
    const schema = parseSchema(result.code)
    expect(schema.columns[0]).toEqual({ prop: 'name', label: '名称', 'x-owner': 'team-a' })
    expect(result.warnings.some((w) => w.includes('未知键'))).toBe(false)
  })

  it('两种模式对同一份显式列产出一致的键集合（不再「schema 泄漏、sfc 丢弃」）', () => {
    const dirty = cfg([{ prop: 'name', label: '名称', formatter: 'x', widht: 1 }])
    const schemaOut = parseSchema(generateFromConfig(dirty as any).code)
    const sfcOut = generateFromConfig({ ...dirty, mode: 'sfc' } as any).code
    expect(Object.keys(schemaOut.columns[0]).sort()).toEqual(['label', 'prop'])
    expect(sfcOut).not.toContain('formatter')
    expect(sfcOut).not.toContain('widht')
  })
})

describe('AN-10 列选项：省略号契约键 + 默认排序列可排序', () => {
  const parseJson = (code: string) =>
    JSON.parse(code.replace(/^.*?= /, '').replace(/\n$/, ''))
  const cfg = (fields: any[], tableOptions?: any) => ({
    name: 'ColOptionDemo',
    apiUrl: '/api/demo',
    fields,
    actions: ['view' as const],
    ...(tableOptions ? { tableOptions } : {}),
  })

  it('schema 模式：ellipsis 发契约键 `ellipsis`，不再发 el-table 专有的 showOverflowTooltip', () => {
    const out = parseJson(
      generateFromConfig(cfg([{ prop: 'name', label: '名称', formtype: 'Input', ellipsis: true }]) as any).code,
    )
    expect(out.columns[0].ellipsis).toBe(true)
    // 关键回归：非 el 引擎（vxe ×3 / 虚拟 / a-table）会**静默丢弃**这个键
    expect(out.columns[0]).not.toHaveProperty('showOverflowTooltip')
    expect(JSON.stringify(out.columns[0])).not.toContain('showOverflowTooltip')
  })

  it('sfc 模式：同一份字段 → 同一个键（不残留 showOverflowTooltip）', () => {
    const code = generateFromConfig({
      ...cfg([{ prop: 'name', label: '名称', formtype: 'Input', ellipsis: true }]),
      mode: 'sfc',
    } as any).code
    expect(code).toContain('ellipsis: true')
    expect(code).not.toContain('showOverflowTooltip')
  })

  it('ellipsis 未设置时不发该键（不制造默认值）', () => {
    const out = parseJson(
      generateFromConfig(cfg([{ prop: 'name', label: '名称', formtype: 'Input' }]) as any).code,
    )
    expect(out.columns[0]).not.toHaveProperty('ellipsis')
  })

  it('defaultSort 点名的派生列补 sortable: true（el-table / a-table 依赖它才展示默认排序状态）', () => {
    const out = parseJson(
      generateFromConfig(
        cfg(
          [
            { prop: 'name', label: '名称', formtype: 'Input' },
            { prop: 'publishTime', label: '发布时间', formtype: 'DatePicker' },
          ],
          { defaultSort: { prop: 'publishTime', order: 'descending' } },
        ) as any,
      ).code,
    )
    const target = out.columns.find((c: any) => c.prop === 'publishTime')
    expect(target.sortable).toBe(true)
    // 只给目标列补：别的列凭空可排序会让表头多出排序箭头
    expect(out.columns.find((c: any) => c.prop === 'name')).not.toHaveProperty('sortable')
    // 顺带确认值本身仍原样发射
    expect(out.tableOptions.defaultSort).toEqual({ prop: 'publishTime', order: 'descending' })
  })

  it('sfc 模式：defaultSort 同样补 sortable: true', () => {
    const code = generateFromConfig({
      ...cfg(
        [
          { prop: 'name', label: '名称', formtype: 'Input' },
          { prop: 'publishTime', label: '发布时间', formtype: 'DatePicker' },
        ],
        { defaultSort: { prop: 'publishTime', order: 'descending' } },
      ),
      mode: 'sfc',
    } as any).code
    // 目标列块内必须出现 sortable（简单断言：sortable 出现次数 1，且与 defaultSort 同行存在）
    expect((code.match(/sortable: true/g) || []).length).toBe(1)
    expect(code).toContain('defaultSort: {"prop":"publishTime","order":"descending"}')
  })

  it('没有 defaultSort 时不给任何派生列补 sortable（不制造可排序表头）', () => {
    const out = parseJson(
      generateFromConfig(cfg([{ prop: 'name', label: '名称', formtype: 'Input' }]) as any).code,
    )
    expect(out.columns[0]).not.toHaveProperty('sortable')
  })

  it('显式 columns 路径不补 sortable：用户自己写（不覆盖其意图）', () => {
    const out = parseJson(
      generateFromConfig({
        name: 'ExplicitDemo',
        apiUrl: '/api/demo',
        fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
        columns: [{ prop: 'name', label: '名称' }],
        tableOptions: { defaultSort: { prop: 'name', order: 'descending' } },
        actions: ['view'],
      } as any).code,
    )
    expect(out.columns[0]).not.toHaveProperty('sortable')
  })
})

describe('B7 — 空 dialogs 不得把页面切成「新弹窗模式」', () => {
  const F = [{ prop: 'a', label: 'A', formtype: 'Input' as const }]
  const flat = (extra: Record<string, unknown>) => ({
    name: 'T',
    apiUrl: '/x',
    fields: F,
    actions: ['add', 'edit', 'delete'],
    ...extra,
  })

  // 修前：`dialogs.add: null` 被 repairConfig 删成 `dialogs: {}`，而 `{}` 仍算「已声明」
  // → 生成器走新弹窗模式，产物里 `"dialogs": {}`、没有 dialogFormItems；工具栏照旧由
  // actions 派生「新增」，点下去 openDialog('add') 拿不到配置直接 return —— 死按钮。
  for (const [label, dialogs] of [
    ['repair 后的空 record', {}],
    ['null 弹窗（修复环删键）', { add: null }],
  ] as const) {
    it(`${label} → 回退 legacy 派生，产物不出现空 dialogs`, () => {
      const r = generateFromConfig(flat({ dialogs }) as any)
      // 产物里没有 dialogs 键；legacy 的逐字段表与入口按钮都还在
      expect(r.code).not.toContain('"dialogs"')
      expect(r.code).toContain('"dialogFormItems"')
      expect(r.code).toContain('"actions"')
      // 摘要按同一条规则报数：legacy 的一个通用弹窗 = 1，不是 0
      expect(r.summary).toContain('1 dialog(s) configured')
      expect(r.summary).toContain('Legacy actions mode')
    })
  }

  it('null 弹窗在警告里点名（修复不静默）', () => {
    const r = generateFromConfig(flat({ dialogs: { add: null } }) as any)
    expect(r.warnings.join('\n')).toContain('/dialogs/add')
  })

  it('非空 dialogs 仍走新弹窗模式（不误伤真实声明）', () => {
    const r = generateFromConfig(flat({ dialogs: { add: { title: '新增' } } }) as any)
    expect(r.code).toContain('"dialogs"')
    expect(r.code).not.toContain('"dialogFormItems"')
    expect(r.summary).toContain('Multi-dialog mode')
    expect(r.summary).toContain('1 dialog(s) configured')
  })
})

describe('B9 — rewriteElementUsage 不改写用户 render/formatter 源码', () => {
  // 用户源码里刻意同时放：目标库符号名（ElTag）、字符串字面量里的同名文本（'ElMessage:'）
  const renderSrc = "(_, { row }) => h(ElTag, { type: 'success' }, () => 'ElMessage:' + row.status)"
  const formatterSrc = "(row) => row.no + ' ElMessage'"
  const cfg = (mode: 'schema' | 'sfc', target: 'vue2' | 'antdv') => ({
    name: 'T',
    apiUrl: '/x',
    mode,
    target,
    fields: [
      { prop: 'status', label: '状态', formtype: 'Input' as const, render: renderSrc, formatter: formatterSrc },
    ],
    actions: ['add', 'edit', 'delete'] as const,
  })

  for (const target of ['vue2', 'antdv'] as const) {
    it(`${target} SFC：render/formatter 逐字保留，生成器自身的 ElMessage 仍按目标库改名`, () => {
      const r = generateFromConfig(cfg('sfc', target) as any)
      // 用户源码原样（含 h(ElTag) 与字符串 'ElMessage:'）—— 生成器不替用户改名
      expect(r.code).toContain(`render: ${renderSrc}`)
      expect(r.code).toContain(`formatter: ${formatterSrc}`)
      expect(r.code).not.toContain('h(Tag, { type:')
      // 保护不误伤生成器自己的发射：删除确认里的 ElMessage 仍要映射
      expect(r.code).toContain(target === 'vue2' ? 'Message.success' : 'message.success')
      expect(r.code).not.toContain('ElMessage.success(\'删除成功\')')
    })

    it(`${target} schema：TODO 注释里回显的 render 源码也逐字保留`, () => {
      const r = generateFromConfig(cfg('schema', target) as any)
      expect(r.wrapperCode).toContain(`requested render: ${renderSrc}`)
      expect(r.wrapperCode).not.toContain('requested render: (_, { row }) => h(Tag')
      // 生成器自己的 ElMessage 仍被映射（wrapper 的删除路径）
      expect(r.wrapperCode).toContain(target === 'vue2' ? 'Message.success' : 'message.success')
    })
  }
})

/**
 * 服务端排序契约（`tableOptions.sortParam`）。
 *
 * 三端运行时行为有单测（core table-sort 19 例）与 e2e 背书；这里钉的是**生成链**：
 * AI 入口写下的声明不许被 Zod 静默剥、也不许在两种产物里凭空消失 ——
 * 「后端排序」是声明式承诺，丢了声明就等于表头点了没反应。
 */
describe('tableOptions.sortParam — 服务端排序契约（schema / sfc 双模式不透丢）', () => {
  const cfg = (tableOptions: Record<string, unknown>) => ({
    name: 'OrderSortDemo',
    apiUrl: '/api/orders',
    fields: [
      { prop: 'orderNo', label: '订单号', formtype: 'Input' as const, sortable: true },
      { prop: 'amount', label: '金额', formtype: 'InputNumber' as const, sortable: true },
    ],
    actions: ['view' as const],
    tableOptions,
  })
  const parseJson = (code: string) =>
    JSON.parse(code.slice(code.search(/=\s*\{/) + 1).trim())

  it('Zod 认 boolean 与改键对象两种形态（false 也是有效取值，不被剥）', () => {
    for (const v of [true, false, { field: 'orderBy' }, { field: 'orderBy', order: 'direction' }]) {
      const r: any = StructuredCrudConfigSchema.safeParse(cfg({ sortParam: v }))
      expect(r.success, JSON.stringify(v)).toBe(true)
      expect(r.data.tableOptions.sortParam, JSON.stringify(v)).toEqual(v)
    }
  })

  it('schema 模式：原样发射 sortParam（boolean / 改键对象）', () => {
    const out = parseJson(generateFromConfig(StructuredCrudConfigSchema.parse(cfg({ sortParam: true })) as any).code)
    expect(out.tableOptions.sortParam).toBe(true)
    const out2 = parseJson(
      generateFromConfig(
        StructuredCrudConfigSchema.parse(cfg({ sortParam: { field: 'orderBy', order: 'direction' } })) as any,
      ).code,
    )
    expect(out2.tableOptions.sortParam).toEqual({ field: 'orderBy', order: 'direction' })
  })

  it('sfc 模式：同样发射（手搓 options 块里逐字出现 JSON 字面量）', () => {
    const { code } = generateFromConfig(
      StructuredCrudConfigSchema.parse({
        ...cfg({ sortParam: { field: 'orderBy', order: 'direction' } }),
        mode: 'sfc',
      }) as any,
    )
    expect(code).toContain('sortParam: {"field":"orderBy","order":"direction"}')
  })

  it('未声明时不制造默认值（产物里没有 sortParam 键）', () => {
    const out = parseJson(generateFromConfig(StructuredCrudConfigSchema.parse(cfg({})) as any).code)
    expect(out.tableOptions).not.toHaveProperty('sortParam')
    const sfc = generateFromConfig(
      StructuredCrudConfigSchema.parse({ ...cfg({}), mode: 'sfc' }) as any,
    ).code
    expect(sfc).not.toContain('sortParam')
  })
})
