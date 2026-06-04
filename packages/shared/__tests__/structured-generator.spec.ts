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

  it('produces zero TODO comments', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.code).not.toContain('TODO')
    expect(result.wrapperCode).not.toContain('TODO')
  })

  it('warns about render expressions in schema mode', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'schema' })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('status')
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
    expect(result.code).toContain('<script setup lang="ts">')
    expect(result.code).toContain('</script>')
    expect(result.wrapperCode).toBeUndefined()
  })

  it('includes TypeScript interface when typescript=true', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc', typescript: true })
    expect(result.code).toContain('interface QueryForm')
  })

  it('omits TypeScript when typescript=false', () => {
    const result = generateFromConfig({ ...baseConfig, mode: 'sfc', typescript: false })
    expect(result.code).toContain('<script setup>')
    expect(result.code).not.toContain('lang="ts"')
    expect(result.code).not.toContain('interface QueryForm')
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
