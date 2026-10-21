/**
 * Vue 2 适配器 — EsCrudPage 的 `query` / `row-click` 接线（AN-11⑥）。
 *
 * 这两个事件此前只写进 `emits: [...]`、**从未 emit**。Vue 2 与 Vue 3 的坑不同：
 *   - Vue 3：已声明的事件会被从 `$attrs` 摘掉 → 宿主监听既收不到、也不会经
 *     `v-bind="$attrs"` 落到内层组件；
 *   - Vue 2：`$listeners` 本就不在 `$attrs` 里，`v-bind="$attrs"` 带不走任何监听。
 *
 * 两端都要求组件**显式**接上内层 es-table / 在按钮 click 里派发，故本文件只断言
 * 接线（stub 掉 es-table / es-form / es-error-boundary，与 antdv 端同一组判据）。
 *
 * 挂载方式沿用本包既有做法（`new Vue({ render })`，见 es-table.spec.ts）：不加载
 * 真实 element-ui —— 它被 hoist 到仓库根、内部 CJS require('vue') 会解析到根部的
 * vue@3（版本错配在模块初始化时就崩）。这里按模块 mock 掉 MessageBox。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Vue from 'vue'

// 桩组件的方法在实例上会被 Vue `bind` 成新函数（不再是 spy），故把 spy 放在模块作用域，
// 断言仍打在原始 spy 上（bound 包装调用时照样记录）。
const mocks = vi.hoisted(() => ({ httpRequestInstance: vi.fn() }))

vi.mock('element-ui', () => ({
  MessageBox: { confirm: vi.fn(() => Promise.resolve()) },
}))
vi.mock('../src/components/es-dialog/use-dialog', () => ({
  default: vi.fn(() => vi.fn()),
}))
vi.mock('../src/components/es-table/component.vue', () => ({
  default: {
    name: 'EsTable',
    props: ['columns', 'options', 'dataSource', 'pagination'],
    render(this: any, h: any) {
      return h('div', { class: 'es-table-stub' }, this.$slots?.default)
    },
    methods: {
      httpRequestInstance: mocks.httpRequestInstance,
      getSelectionRows: () => [],
    },
  },
}))
vi.mock('../src/components/es-form/es-form.vue', () => ({
  default: {
    name: 'EsForm',
    props: ['model', 'formItemList', 'configBtn', 'layoutFormProps'],
    render(this: any, h: any) {
      return h('div', { class: 'es-form-stub' })
    },
  },
}))
vi.mock('../src/components/es-error-boundary/es-error-boundary.vue', () => ({
  default: {
    name: 'EsErrorBoundary',
    render(this: any, h: any) {
      return h('div', this.$slots?.default)
    },
  },
}))

import EsCrudPage from '../src/components/es-crud-page/es-crud-page.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/types'

function mountPage(schema: CrudPageSchema) {
  const onQuery = vi.fn()
  const onRowClick = vi.fn()
  const vm = new Vue({
    render: (h) =>
      h(EsCrudPage as any, {
        props: { schema, autoLoad: false },
        on: { query: onQuery, 'row-click': onRowClick },
      }),
  }).$mount() as any
  const page = vm.$children[0]
  return { vm, page, onQuery, onRowClick }
}

const columns: CrudPageSchema['columns'] = [{ prop: 'name', label: '姓名' }]

describe('EsCrudPage(vue2) — AN-11⑥ query / row-click 接线', () => {
  beforeEach(() => {
    mocks.httpRequestInstance.mockClear()
  })

  it('点击查询键 → 发起新搜索并 emit query（带当前查询模型）', async () => {
    const { page, onQuery } = mountPage({
      columns,
      formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
    })
    await page.$nextTick()
    const form = page.$refs.formRef
    expect(form).toBeTruthy()
    const btns = form.configBtn as any[]
    const queryBtn = btns.find((b: any) => b.key === 'query')
    expect(queryBtn).toBeDefined()
    // 不能用 triggerEvent：那条分支由 EsForm 独占、不回调 click
    expect(queryBtn.triggerEvent).toBeFalsy()
    queryBtn.click()
    expect(onQuery).toHaveBeenCalledTimes(1)
    expect(onQuery).toHaveBeenCalledWith({ name: '' })
    // 查询键自己发起了一次「新搜索」，且回到第 1 页
    expect(mocks.httpRequestInstance).toHaveBeenCalledWith({ name: '' }, { keepPage: false })
  })

  it('内层 es-table 的 row-click → 转发为本组件的 row-click', async () => {
    const { page, onRowClick } = mountPage({ columns })
    await page.$nextTick()
    const row = { id: 1, name: '张三' }
    page.$refs.tableRef.$emit('row-click', row)
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).toHaveBeenCalledWith(row)
  })

  // 回归：显式 operationColumn.btns 里除 name/type/permissionValue 之外的契约键
  // （尤其是文档化的 `hidden`）此前被「三键重建」静默丢掉 —— 行内动态隐藏永远不生效。
  it('透传 operationColumn.btns 的 hidden / icon（es-table 逐行消费 hidden）', async () => {
    const hidden = (row: Record<string, unknown>) => row.status !== 'pending'
    const { page } = mountPage({
      columns,
      operationColumn: {
        btns: [
          { name: '编辑', type: 'primary', dialogKey: 'edit' },
          { name: '审批', type: 'warning', key: 'approve', icon: 'Check', hidden },
        ],
      },
    })
    await page.$nextTick()
    const cols = page.$refs.tableRef.columns as any[]
    const btn = cols.find((c: any) => c.prop === 'operate').btns.find((b: any) => b.name === '审批')
    expect(btn.hidden).toBe(hidden)
    expect(btn.icon).toBe('Check')
    expect(typeof btn.clickEvent).toBe('function')
  })
})
