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

  it('includes render expressions inline', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc' })
    expect(result.code).toContain("render: (_, { row }) => h(ElTag")
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

  it('warns that vue2 ignores virtual scrolling', () => {
    const result = generateFromConfig({
      ...baseConfig,
      target: 'vue2',
      mode: 'schema',
      tableOptions: { virtual: true },
    } as any)
    expect(result.warnings.some(w => w.includes('virtual'))).toBe(true)
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

