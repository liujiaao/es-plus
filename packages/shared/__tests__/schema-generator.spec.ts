import { describe, it, expect } from 'vitest'
import { generateCrudSchema } from '../src/schema-generator.js'
import { VALID_FORM_TYPES, VALID_CRUD_ACTIONS } from '../src/contract.js'

/**
 * 离线 schema 生成器的语料（W6）。
 *
 * 这 8 条原本是 `shared` 公开导出的 `PRESET_EXAMPLES`，被 CLI 预设选择器、MCP 示例
 * 资源、站点首页 demo 与本测试共用。那三处都已各自就近持有自己的列表，公共导出随之
 * 删除；本测试只需要「形状覆盖不同」的输入，故就地内联 —— 字面量与快照绑定，
 * 改动等于重建全部 16 条快照，不要顺手改文案。
 */
const LEGACY_PRESETS = [
  { label: '用户管理', prompt: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除' },
  { label: '订单列表', prompt: '订单列表，查询订单号、客户名称、日期范围、状态，表格显示订单号、客户、金额、状态、创建时间，支持查看详情和删除' },
  { label: '商品管理', prompt: '商品管理，查询商品名称、分类、状态，表格显示名称、分类、价格、库存、状态，支持新增编辑删除' },
  { label: '日志查询', prompt: '操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看不编辑' },
  { label: '角色权限', prompt: '角色管理页面，查询角色名称、状态，表格显示角色名称、描述、状态、创建时间，支持新增编辑删除' },
  { label: '员工花名册', prompt: '员工管理，查询姓名、部门、职位，表格显示姓名、性别、年龄、部门、职位、手机号、状态，支持新增编辑' },
  { label: '文章管理', prompt: '文章管理，查询标题、分类、状态，表格显示标题、分类、创建人、创建时间、状态，支持新增编辑删除' },
  { label: '系统配置', prompt: '系统配置管理，查询名称、类型，表格显示名称、编号、类型、描述、状态，支持新增编辑删除导出' },
] as const

describe('generateCrudSchema — snapshot tests', () => {
  for (const example of LEGACY_PRESETS) {
    it(`generates stable schema for: ${example.label}`, () => {
      const result = generateCrudSchema(example.prompt)
      expect(result.schema).toMatchSnapshot()
    })

    it(`generates stable wrapper SFC for: ${example.label}`, () => {
      const result = generateCrudSchema(example.prompt)
      expect(result.wrapperCode).toMatchSnapshot()
    })
  }
})

describe('generateCrudSchema — schema structure', () => {
  for (const example of LEGACY_PRESETS) {
    it(`${example.label}: has required columns array`, () => {
      const result = generateCrudSchema(example.prompt)
      expect(result.schema).toHaveProperty('columns')
      expect(Array.isArray(result.schema.columns)).toBe(true)
    })

    it(`${example.label}: actions are from valid set`, () => {
      const result = generateCrudSchema(example.prompt)
      const actions = result.schema.actions as string[]
      for (const action of actions) {
        expect(VALID_CRUD_ACTIONS as readonly string[]).toContain(action)
      }
    })

    it(`${example.label}: formItems use valid formtype`, () => {
      const result = generateCrudSchema(example.prompt)
      const formItems = (result.schema.formItems || []) as any[]
      for (const item of formItems) {
        if (item.formtype) {
          expect(VALID_FORM_TYPES as readonly string[]).toContain(item.formtype)
        }
      }
    })

    it(`${example.label}: schema is JSON-serializable (no functions)`, () => {
      const result = generateCrudSchema(example.prompt)
      const json = JSON.stringify(result.schema)
      const parsed = JSON.parse(json)
      expect(parsed).toEqual(result.schema)
    })
  }
})

describe('generateCrudSchema — capability fidelity', () => {
  // 适配器此前把 `tableOptions` 硬编码成 6 个键，规则引擎已经识别并写好的
  // virtual / cachePageSelection / multiSelect 在产物里**不存在**；featureHints
  // 也被丢弃 —— 站点的预设于是「描述了一个引擎支持、产物却看不到」的能力。
  it('虚拟滚动 / 跨页批量选择透传到 tableOptions，识别结果透出 featureHints', () => {
    const result = generateCrudSchema(
      '商品列表，10 万行数据，启用虚拟滚动。查询条件：商品名（模糊）、分类、价格区间。列：商品名、分类、价格、库存、上架状态。支持批量上下架。'
    )
    expect(result.schema.tableOptions).toMatchObject({
      virtual: true,
      cachePageSelection: true,
      multiSelect: true,
    })
    expect(result.featureHints?.join(' ')).toMatch(/虚拟滚动/)
    expect(result.featureHints?.join(' ')).toMatch(/跨页批量选择/)
  })

  it('多 tab 弹窗的识别结果不再被丢弃', () => {
    const result = generateCrudSchema(
      '订单列表，查询订单号、客户姓名、订单状态、下单日期范围。列表显示订单号、客户、金额、状态、下单时间。每行有"详情"按钮，点击打开弹窗，弹窗内三个 tab：订单信息、收货地址、商品列表。'
    )
    expect(result.featureHints?.join(' ')).toMatch(/多 Tab/i)
  })

  it('schema 无法承载的 render 必须发警告，而不是静默剥离', () => {
    const result = generateCrudSchema('用户管理页面，查询条件有姓名，表格显示姓名、状态，支持新增编辑删除')
    expect(result.warnings?.join(' ')).toMatch(/render/)
    expect((result.schema.columns as any[]).some((c) => 'render' in c)).toBe(false)
  })
})

describe('generateCrudSchema — wrapper SFC', () => {
  it('has valid SFC structure', () => {
    const result = generateCrudSchema(LEGACY_PRESETS[0].prompt)
    expect(result.wrapperCode).toContain('<template>')
    expect(result.wrapperCode).toContain('<es-crud-page')
    expect(result.wrapperCode).toContain('</template>')
    expect(result.wrapperCode).toContain('<script setup>')
    expect(result.wrapperCode).toContain('</script>')
  })

  it('includes fetchData function', () => {
    const result = generateCrudSchema(LEGACY_PRESETS[0].prompt)
    expect(result.wrapperCode).toContain('async function fetchData')
  })

  it('includes handleDelete when delete action present', () => {
    const result = generateCrudSchema('用户管理，支持新增编辑删除')
    expect(result.wrapperCode).toContain('handleDelete')
    expect(result.wrapperCode).toContain('ElMessageBox')
  })

  it('includes handleBtnClick for add/edit confirm', () => {
    const result = generateCrudSchema('用户管理，支持新增编辑')
    expect(result.wrapperCode).toContain('add-confirm')
    expect(result.wrapperCode).toContain('edit-confirm')
  })
})

describe('generateCrudSchema — antdv wrapper 可编译性（回归）', () => {
  // 回归：该分支此前漏调 rewriteElementUsage —— import 被映射为 Modal/message，
  // 代码体却仍是 ElMessageBox/ElMessage，生成产物引用未定义符号、不可编译。
  const result = generateCrudSchema('用户管理，支持新增编辑删除', 'antdv')

  it('使用 antdv 的 Modal 对象式确认', () => {
    expect(result.wrapperCode).toContain('Modal.confirm({')
    expect(result.wrapperCode).toContain("from 'ant-design-vue'")
  })

  it('不残留 ElMessageBox / ElMessage 引用，改用 message', () => {
    expect(result.wrapperCode).not.toMatch(/\bElMessageBox\b/)
    expect(result.wrapperCode).not.toMatch(/\bElMessage\b/)
    expect(result.wrapperCode).toContain('message.success')
    expect(result.wrapperCode).toContain('message.error')
  })

  it('import 的符号与代码体一致（Modal / message 均在 import 中）', () => {
    const importLine = result.wrapperCode.split('\n').find((l) => l.includes('ant-design-vue')) || ''
    expect(importLine).toContain('Modal')
    expect(importLine).toContain('message')
  })

  it('summary 标注 Ant Design Vue（此前误标 Element Plus）', () => {
    expect(result.summary).toContain('Ant Design Vue')
    expect(result.summary).not.toContain('Element Plus')
  })

  it('vue3 仍输出 ElMessageBox（未被误改）', () => {
    const vue3 = generateCrudSchema('用户管理，支持新增编辑删除')
    expect(vue3.wrapperCode).toContain('ElMessageBox')
    expect(vue3.wrapperCode).not.toContain('Modal.confirm')
  })
})
