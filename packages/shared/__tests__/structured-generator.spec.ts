import { describe, it, expect } from 'vitest'
import { generateFromConfig } from '../src/structured-generator'
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
    // vue2 SFC template must use .sync, not v-model:xxx
    const sfc = generateFromConfig(cfgFor('vue2', 'sfc')).code
    expect(sfc).toContain(':data-source.sync=')
    expect(sfc).not.toContain('v-model:data-source')
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
    expect(result.warnings).toContain('列级行内编辑器 editRender 含无法序列化的值，已省略以保证编译通过。')
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

