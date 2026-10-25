/**
 * AN-06 —— `EsCrudPage` 的 action 面接线（antdv 端）。
 *
 * 与 vue3 端同一组判据（core `resolveCrudActions`），这里验证的是**接线**：
 * 组件真的读到了那个解析结果，而不是仍旧走自己的硬编码兜底。
 *
 * 修前三端各写一份 `props.schema.actions || ['add','edit','delete']` —— 三份副本
 * 意味着三端可以各自漂移；共享解析函数 + 本测试把「三端一致」变成结构性质。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => vi.fn()),
  default: vi.fn(() => vi.fn()),
}))

import EsCrudPage from '../src/components/es-crud-page/src/es-crud-page.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'

const stubs = {
  'es-table': {
    name: 'EsTable',
    template: `<div class="es-table-stub"><slot /></div>`,
    props: ['columns', 'options', 'dataSource', 'pagination'],
    methods: {
      httpRequestInstance: vi.fn(),
      getSelectionRows: () => [],
    },
  },
  'es-form': {
    name: 'EsForm',
    template: `<div class="es-form-stub"></div>`,
    props: ['model', 'formItemList', 'configBtn', 'layoutFormProps'],
  },
  'es-error-boundary': { name: 'EsErrorBoundary', template: `<div><slot /></div>` },
}

function mountPage(schema: CrudPageSchema) {
  return mount(EsCrudPage, {
    props: { schema, autoLoad: false },
    global: { stubs },
  })
}

const rowBtns = (wrapper: any) => {
  const table = wrapper.findComponent({ name: 'EsTable' })
  const cols = table.props('columns') as any[]
  const actionCol = cols.find((c: any) => c.prop === 'operate')
  return actionCol ? (actionCol.btns as any[]).map((b: any) => b.name) : []
}

const toolbarKeys = (wrapper: any) => {
  const form = wrapper.findComponent({ name: 'EsForm' })
  return form.exists() ? (form.props('configBtn') as any[]).map((b: any) => b.key) : []
}

const columns: CrudPageSchema['columns'] = [{ prop: 'name', label: '姓名' }]
const dialogFormItems = [{ prop: 'name', label: '姓名', formtype: 'Input' as const }]

describe('EsCrudPage (antdv) — AN-06 action 面', () => {
  it('显式 actions [add, view] → 只有查看行按钮，没有编辑/删除', () => {
    const w = mountPage({
      columns,
      formItems: dialogFormItems,
      actions: ['add', 'view'],
      dialogs: {
        add: { title: '新增', formItems: dialogFormItems },
        view: { title: '查看', formItems: dialogFormItems },
      },
    } as CrudPageSchema)
    expect(rowBtns(w)).toEqual(['查看'])
    expect(toolbarKeys(w)).toContain('add')
  })

  it('旧 schema（dialogFormItems、无 actions）→ 兼容 add/edit/delete', () => {
    const w = mountPage({ columns, formItems: dialogFormItems, dialogFormItems } as CrudPageSchema)
    expect(rowBtns(w)).toEqual(['编辑', '删除'])
    expect(toolbarKeys(w)).toContain('add')
  })

  it('新模式只有 dialogs、无 actions → 从 key 推导 add/edit，不补 delete', () => {
    const w = mountPage({
      columns,
      formItems: dialogFormItems,
      dialogs: {
        add: { title: '新增', formItems: dialogFormItems },
        edit: { title: '编辑', formItems: dialogFormItems },
      },
    } as CrudPageSchema)
    expect(rowBtns(w)).toEqual(['编辑'])
    expect(toolbarKeys(w)).toContain('add')
  })

  it('既无 actions 也无弹窗 → 只读（不猜 CRUD）', () => {
    const w = mountPage({ columns } as CrudPageSchema)
    expect(rowBtns(w)).toEqual([])
  })

  // 回归：显式 operationColumn.btns 里除 name/type/permissionValue 之外的契约键
  // （尤其是文档化的 `hidden`）此前被「三键重建」静默丢掉 —— 行内动态隐藏永远不生效。
  it('透传 operationColumn.btns 的 hidden / icon（es-table 逐行消费 hidden）', () => {
    const hidden = (row: Record<string, unknown>) => row.status !== 'pending'
    const w = mountPage({
      columns,
      operationColumn: {
        btns: [
          { name: '编辑', type: 'primary', dialogKey: 'edit' },
          { name: '审批', type: 'warning', key: 'approve', icon: 'Check', hidden },
        ],
      },
    } as CrudPageSchema)
    const table = w.findComponent({ name: 'EsTable' })
    const actionCol = (table.props('columns') as any[]).find((c: any) => c.prop === 'operate')
    const btn = actionCol.btns.find((b: any) => b.name === '审批')
    expect(btn.hidden).toBe(hidden)
    expect(btn.icon).toBe('Check')
    expect(typeof btn.clickEvent).toBe('function')
  })

  it('行按钮未声明 key 时 btn-click 以按钮名兜底（AI 生成的按钮只有 name）', () => {
    const w = mountPage({
      columns,
      operationColumn: {
        btns: [
          { name: '通过' },
          { name: '驳回', permissionValue: 'approval:audit' },
        ],
      },
    } as CrudPageSchema)
    const table = w.findComponent({ name: 'EsTable' })
    const actionCol = (table.props('columns') as any[]).find((c: any) => c.prop === 'operate')
    const row = { id: 1, name: '张三' }
    actionCol.btns.find((b: any) => b.name === '驳回').clickEvent(row)
    expect(w.emitted('btn-click')?.[0]).toEqual(['驳回', row])
  })
})

/**
 * AN-11⑥ —— `query` / `row-click` 此前只写进 `defineEmits`、三个端从未 emit。
 *
 * Vue 3 会把已声明的事件从 `$attrs` 摘掉，所以这两条边**必须显式接线**，
 * 否则宿主的 `@query` / `@row-click` 是彻底静默的（既不报错也不回调）。
 */
describe('EsCrudPage (antdv) — AN-11⑥ query / row-click 接线', () => {
  it('点击查询键 → 发起新搜索并 emit query（带当前查询模型）', () => {
    const w = mount(EsCrudPage, {
      props: { schema: { columns, formItems: dialogFormItems } as CrudPageSchema, autoLoad: false },
      global: { stubs },
    })
    const form = w.findComponent({ name: 'EsForm' })
    const btns = form.props('configBtn') as any[]
    const queryBtn = btns.find((b: any) => b.key === 'query')
    expect(queryBtn).toBeDefined()
    // 不能用 triggerEvent：那条分支由 EsForm 独占、不回调 click
    expect(queryBtn.triggerEvent).toBeFalsy()
    queryBtn.click()
    expect(w.emitted('query')).toEqual([[{ name: '' }]])
  })

  it('内层 es-table 的 row-click → 转发为本组件的 row-click', () => {
    const w = mount(EsCrudPage, {
      props: { schema: { columns } as CrudPageSchema, autoLoad: false },
      global: { stubs },
    })
    const row = { id: 1, name: '张三' }
    w.findComponent({ name: 'EsTable' }).vm.$emit('row-click', row)
    expect(w.emitted('row-click')).toEqual([[row]])
  })
})
