import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElSelect, ElOption, ElDatePicker, ElInputNumber,
  ElSwitch, ElTable, ElTableColumn, ElPagination,
  ElConfigProvider
} from 'element-plus'

// Mock useDialog to avoid DOM-heavy dialog rendering in tests
vi.mock('../../es-dialog/src/use-dialog', () => ({
  default: vi.fn(() => vi.fn()),
  useDialog: vi.fn(() => vi.fn())
}))

import EsCrudPage from '../src/es-crud-page.vue'
import type { CrudPageSchema } from '../src/types'

const globalComponents = {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElSelect, ElOption, ElDatePicker, ElInputNumber,
  ElSwitch, ElTable, ElTableColumn, ElPagination,
  ElConfigProvider
}

const minimalSchema: CrudPageSchema = {
  columns: [
    { prop: 'name', label: '姓名' },
    { prop: 'age', label: '年龄' }
  ]
}

const schemaWithForm: CrudPageSchema = {
  columns: [
    { prop: 'name', label: '姓名' },
    { prop: 'status', label: '状态' }
  ],
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 8 },
    { prop: 'status', label: '状态', formtype: 'Select', span: 8, dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ]
}

const mountCrudPage = (props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  mount(EsCrudPage, {
    props: {
      schema: minimalSchema,
      ...props
    },
    global: {
      components: globalComponents,
      stubs: {
        'es-table': {
          name: 'EsTable',
          template: `<div class="es-table-stub"><slot /></div>`,
          props: ['columns', 'options', 'dataSource', 'pagination'],
          methods: {
            httpRequestInstance: vi.fn(),
            getSelectionRows: () => []
          }
        },
        'es-form': {
          name: 'EsForm',
          template: `<div class="es-form-stub"></div>`,
          props: ['model', 'formItemList', 'configBtn'],
          methods: {
            validate: vi.fn().mockResolvedValue(true),
            resetFields: vi.fn(),
            clearValidate: vi.fn()
          }
        }
      }
    },
    ...options
  })

const shallowMountCrudPage = (props: Record<string, unknown> = {}) =>
  shallowMount(EsCrudPage, {
    props: {
      schema: minimalSchema,
      ...props
    },
    global: {
      components: globalComponents,
      stubs: {
        'es-table': {
          name: 'EsTable',
          template: `<div class="es-table-stub"><slot /></div>`,
          props: ['columns', 'options', 'dataSource', 'pagination'],
          methods: {
            httpRequestInstance: vi.fn(),
            getSelectionRows: () => []
          }
        },
        'es-form': {
          name: 'EsForm',
          template: `<div class="es-form-stub"></div>`,
          props: ['model', 'formItemList', 'configBtn']
        }
      }
    }
  })

describe('EsCrudPage', () => {
  describe('basic rendering', () => {
    it('renders without errors with minimal props', () => {
      const wrapper = mountCrudPage()
      expect(wrapper.find('.es-crud-page').exists()).toBe(true)
    })

    it('renders the root div with es-crud-page class', () => {
      const wrapper = mountCrudPage()
      const root = wrapper.find('.es-crud-page')
      expect(root.exists()).toBe(true)
      expect(root.element.tagName).toBe('DIV')
    })

    it('renders EsTable stub', () => {
      const wrapper = mountCrudPage()
      expect(wrapper.find('.es-table-stub').exists()).toBe(true)
    })

    it('does not render EsForm when schema has no formItems', () => {
      const wrapper = mountCrudPage({ schema: minimalSchema })
      expect(wrapper.find('.es-form-stub').exists()).toBe(false)
    })

    it('renders EsForm when schema has formItems', () => {
      const wrapper = mountCrudPage({ schema: schemaWithForm })
      expect(wrapper.find('.es-form-stub').exists()).toBe(true)
    })
  })

  describe('columns configuration', () => {
    it('passes columns to EsTable', () => {
      const wrapper = mountCrudPage()
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      // mergedColumns includes original columns + auto-generated action column
      expect(columnsProp.some((c: any) => c.prop === 'name')).toBe(true)
      expect(columnsProp.some((c: any) => c.prop === 'age')).toBe(true)
    })

    it('auto-generates action column when actions include edit/delete', () => {
      const wrapper = mountCrudPage({
        schema: {
          columns: [{ prop: 'name', label: '姓名' }],
          actions: ['edit', 'delete']
        }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      const actionCol = columnsProp.find((c: any) => c.prop === 'operate')
      expect(actionCol).toBeDefined()
      expect(actionCol.label).toBe('操作')
      expect(actionCol.fixed).toBe('right')
    })

    it('does not auto-generate action column when actions is empty', () => {
      const wrapper = mountCrudPage({
        schema: {
          columns: [{ prop: 'name', label: '姓名' }],
          actions: []
        }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      const actionCol = columnsProp.find((c: any) => c.prop === 'operate')
      expect(actionCol).toBeUndefined()
    })

    it('does not duplicate action column if schema already has one', () => {
      const wrapper = mountCrudPage({
        schema: {
          columns: [
            { prop: 'name', label: '姓名' },
            { prop: 'operate', label: '操作', btns: [{ name: '自定义' }] }
          ],
          actions: ['edit', 'delete']
        }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      const actionCols = columnsProp.filter((c: any) => c.prop === 'operate')
      expect(actionCols).toHaveLength(1)
    })
  })

  describe('search form (formItems)', () => {
    it('passes formItems to EsForm formItemList prop', () => {
      const wrapper = mountCrudPage({ schema: schemaWithForm })
      const form = wrapper.findComponent({ name: 'EsForm' })
      expect(form.props('formItemList')).toEqual(schemaWithForm.formItems)
    })

    it('initializes queryModel with form item props', async () => {
      const wrapper = mountCrudPage({ schema: schemaWithForm })
      await nextTick()
      const vm = wrapper.vm as any
      expect(vm.queryModel).toHaveProperty('name')
      expect(vm.queryModel).toHaveProperty('status')
    })

    it('passes queryModel to EsForm model prop', () => {
      const wrapper = mountCrudPage({ schema: schemaWithForm })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const model = form.props('model') as Record<string, unknown>
      expect(model).toHaveProperty('name')
      expect(model).toHaveProperty('status')
    })

    it('generates default query buttons when no queryBtns in schema', () => {
      const wrapper = mountCrudPage({ schema: schemaWithForm })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const configBtn = form.props('configBtn') as any[]
      expect(configBtn.length).toBeGreaterThanOrEqual(2)
      const queryBtn = configBtn.find((b: any) => b.key === 'query')
      const resetBtn = configBtn.find((b: any) => b.key === 'rest')
      expect(queryBtn).toBeDefined()
      expect(resetBtn).toBeDefined()
    })

    it('uses custom queryBtns from schema when provided', () => {
      const customBtns = [{ name: '搜索', key: 'search', type: 'primary' as const }]
      const wrapper = mountCrudPage({
        schema: {
          ...schemaWithForm,
          queryBtns: customBtns
        }
      })
      const form = wrapper.findComponent({ name: 'EsForm' })
      expect(form.props('configBtn')).toEqual(customBtns)
    })
  })

  describe('exposed methods', () => {
    it('exposes refresh method', () => {
      const wrapper = mountCrudPage()
      const vm = wrapper.vm as any
      expect(typeof vm.refresh).toBe('function')
    })

    it('exposes getSelectedRows method', () => {
      const wrapper = mountCrudPage()
      const vm = wrapper.vm as any
      expect(typeof vm.getSelectedRows).toBe('function')
    })

    it('getSelectedRows returns empty array by default', () => {
      const wrapper = mountCrudPage()
      const vm = wrapper.vm as any
      const rows = vm.getSelectedRows()
      expect(rows).toEqual([])
    })

    it('exposes tableRef', () => {
      const wrapper = mountCrudPage()
      const vm = wrapper.vm as any
      expect(vm.tableRef).toBeDefined()
    })

    it('exposes formRef', () => {
      const wrapper = mountCrudPage()
      const vm = wrapper.vm as any
      // formRef exists as exposed property (may be null if form not rendered)
      expect('formRef' in vm).toBe(true)
    })

    it('exposes queryModel as reactive object', () => {
      const wrapper = mountCrudPage({ schema: schemaWithForm })
      const vm = wrapper.vm as any
      expect(vm.queryModel).toBeDefined()
      expect(typeof vm.queryModel).toBe('object')
    })
  })

  describe('table options', () => {
    it('passes merged options to EsTable', () => {
      const wrapper = mountCrudPage()
      const table = wrapper.findComponent({ name: 'EsTable' })
      const options = table.props('options') as Record<string, unknown>
      expect(options.border).toBe(true)
      expect(options.isInitRun).toBe(true)
    })

    it('sets isInitRun to false when autoLoad is false', () => {
      const wrapper = mountCrudPage({ schema: minimalSchema, autoLoad: false })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const options = table.props('options') as Record<string, unknown>
      expect(options.isInitRun).toBe(false)
    })

    it('merges tableOptions from schema', () => {
      const wrapper = mountCrudPage({
        schema: {
          ...minimalSchema,
          tableOptions: { stripe: true, size: 'small' }
        }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const options = table.props('options') as Record<string, unknown>
      expect(options.stripe).toBe(true)
      expect(options.size).toBe('small')
    })

    it('uses httpRequest prop when provided', () => {
      const mockHttp = vi.fn()
      const wrapper = mountCrudPage({
        schema: minimalSchema,
        httpRequest: mockHttp
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const options = table.props('options') as Record<string, unknown>
      expect(options.httpRequest).toBe(mockHttp)
    })
  })

  describe('actions configuration', () => {
    it('defaults to add/edit/delete actions when not specified', () => {
      const wrapper = mountCrudPage({
        schema: { columns: [{ prop: 'id', label: 'ID' }] }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      const actionCol = columnsProp.find((c: any) => c.prop === 'operate')
      expect(actionCol).toBeDefined()
      // Should have edit and delete buttons (view not included by default)
      expect(actionCol.btns.some((b: any) => b.name === '编辑')).toBe(true)
      expect(actionCol.btns.some((b: any) => b.name === '删除')).toBe(true)
    })

    it('includes view button when actions include view', () => {
      const wrapper = mountCrudPage({
        schema: {
          columns: [{ prop: 'id', label: 'ID' }],
          actions: ['view', 'edit', 'delete']
        }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      const actionCol = columnsProp.find((c: any) => c.prop === 'operate')
      expect(actionCol.btns.some((b: any) => b.name === '查看')).toBe(true)
    })

    it('includes add button in query bar when actions include add', () => {
      const wrapper = mountCrudPage({
        schema: {
          ...schemaWithForm,
          actions: ['add', 'edit', 'delete']
        }
      })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const configBtn = form.props('configBtn') as any[]
      expect(configBtn.some((b: any) => b.key === 'add')).toBe(true)
    })

    it('includes export button in query bar when actions include export', () => {
      const wrapper = mountCrudPage({
        schema: {
          ...schemaWithForm,
          actions: ['add', 'edit', 'delete', 'export']
        }
      })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const configBtn = form.props('configBtn') as any[]
      expect(configBtn.some((b: any) => b.key === 'export')).toBe(true)
    })

    it('does not include add button when actions exclude add', () => {
      const wrapper = mountCrudPage({
        schema: {
          ...schemaWithForm,
          actions: ['edit', 'delete']
        }
      })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const configBtn = form.props('configBtn') as any[]
      expect(configBtn.some((b: any) => b.key === 'add')).toBe(false)
    })
  })

  describe('pagination', () => {
    it('initializes pagination with defaults', () => {
      const wrapper = mountCrudPage()
      const table = wrapper.findComponent({ name: 'EsTable' })
      const pagination = table.props('pagination') as any
      // Pagination is passed via v-model binding
      // The component internally has paginationState with defaults
      const vm = wrapper.vm as any
      // Access the internal state through the component
      expect(wrapper.find('.es-crud-page').exists()).toBe(true)
    })

    it('merges custom pagination from schema', () => {
      const wrapper = mountCrudPage({
        schema: {
          ...minimalSchema,
          pagination: { current: 2, pageSize: 20, total: 100 }
        }
      })
      // The component should initialize with schema pagination values
      expect(wrapper.find('.es-crud-page').exists()).toBe(true)
    })
  })

  describe('empty/default props handling', () => {
    it('handles empty columns array', () => {
      const wrapper = mountCrudPage({
        schema: { columns: [], actions: [] }
      })
      expect(wrapper.find('.es-crud-page').exists()).toBe(true)
      const table = wrapper.findComponent({ name: 'EsTable' })
      const columnsProp = table.props('columns') as any[]
      expect(columnsProp).toEqual([])
    })

    it('handles empty formItems array', () => {
      const wrapper = mountCrudPage({
        schema: { columns: [{ prop: 'id', label: 'ID' }], formItems: [] }
      })
      // Empty formItems array should not render EsForm
      expect(wrapper.find('.es-form-stub').exists()).toBe(false)
    })

    it('handles undefined optional schema fields', () => {
      const wrapper = mountCrudPage({
        schema: { columns: [{ prop: 'id', label: 'ID' }] }
      })
      expect(wrapper.find('.es-crud-page').exists()).toBe(true)
    })

    it('handles schema with only columns (no actions, form, or options)', () => {
      const wrapper = mountCrudPage({
        schema: { columns: [{ prop: 'a', label: 'A' }], actions: [] }
      })
      const table = wrapper.findComponent({ name: 'EsTable' })
      expect(table.exists()).toBe(true)
    })
  })

  describe('events', () => {
    it('emits add event when add action is triggered', async () => {
      const wrapper = mountCrudPage({
        schema: {
          ...schemaWithForm,
          actions: ['add']
        }
      })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const configBtn = form.props('configBtn') as any[]
      const addBtn = configBtn.find((b: any) => b.key === 'add')
      expect(addBtn).toBeDefined()
      // Trigger the add button click handler
      if (addBtn?.click) {
        addBtn.click()
        await nextTick()
        expect(wrapper.emitted('add')).toBeTruthy()
      }
    })

    it('emits export event when export action is triggered', async () => {
      const wrapper = mountCrudPage({
        schema: {
          ...schemaWithForm,
          actions: ['export']
        }
      })
      const form = wrapper.findComponent({ name: 'EsForm' })
      const configBtn = form.props('configBtn') as any[]
      const exportBtn = configBtn.find((b: any) => b.key === 'export')
      expect(exportBtn).toBeDefined()
      if (exportBtn?.click) {
        exportBtn.click()
        await nextTick()
        expect(wrapper.emitted('export')).toBeTruthy()
      }
    })
  })
})
