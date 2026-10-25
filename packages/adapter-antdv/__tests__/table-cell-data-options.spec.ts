/**
 * EsTable 声明式 `dataOptions` —— antdv 渲染器
 *
 * 与 vue3 / vue2 同源：解析在 core，本端只把结果包成 `a-tag` —— 且用 **状态色**
 * （processing/success/warning/error/default），而不是预设色（预设色是深底白字实心标签，
 * 与 Element 两端的浅底标签视觉重量差太多）。
 *
 * a-table 的单元格由 `bodyCell` 插槽消费 `_esCol.render`，因此断言点是
 * **ATable 真正收到的 columns**
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import EsTable from '../src/components/es-table/src/component.vue'

vi.mock('ant-design-vue', () => ({
  Table: {
    name: 'ATable',
    props: ['columns', 'dataSource', 'rowKey', 'pagination', 'loading', 'bordered', 'size', 'showHeader', 'rowSelection', 'rowClassName', 'customRow', 'scroll', 'sortDirections', 'locale', 'expandedRowRender'],
    template: '<div class="mock-table" />',
  },
  Pagination: { name: 'APagination', template: '<div />', props: ['current', 'pageSize', 'total', 'showSizeChanger', 'showQuickJumper', 'pageSizeOptions', 'size', 'showTotal'] },
  Spin: { name: 'ASpin', template: '<div><slot /></div>', props: ['spinning', 'tip'] },
  ConfigProvider: { name: 'AConfigProvider', template: '<div><slot /></div>', props: ['locale'] },
  Button: { name: 'AButton', template: '<button><slot /></button>', props: ['type', 'size', 'loading', 'disabled', 'danger'] },
  Tooltip: { name: 'ATooltip', template: '<div><slot /></div>', props: ['title', 'placement'] },
  Tag: { name: 'ATag', template: '<span class="a-tag"><slot /></span>', props: ['color'] },
}))

const statusOptions = [
  { label: '待处理', value: 0, tagType: 'info' as const },
  { label: '进行中', value: 1, tagType: 'warning' as const },
  { label: '已完成', value: 2, tagType: 'success' as const },
]

const mountTable = (columns: Record<string, unknown>[]) =>
  mount(EsTable, {
    props: { dataSource: [], columns, options: {}, pagination: { current: 1, pageSize: 10, total: 0 } },
  })

const adaptedColumns = (wrapper: ReturnType<typeof mountTable>): any[] =>
  wrapper.findComponent({ name: 'ATable' }).props('columns') as any[]

const statusColumn = (wrapper: ReturnType<typeof mountTable>): any =>
  adaptedColumns(wrapper).find((c) => c.dataIndex === 'status')

describe('EsTable(antdv) — dataOptions 单元格', () => {
  it('命中码值 → render 产出 a-tag（状态色 + 标签文本）', () => {
    const wrapper = mountTable([
      { prop: 'status', label: '状态', dataOptions: statusOptions, inTable: true },
    ])
    const render = statusColumn(wrapper)._esCol.render
    expect(typeof render).toBe('function')

    const vnode = render(h, { row: { status: 2 } }) as any
    expect(vnode.type.name).toBe('ATag')
    expect(vnode.props.color).toBe('success')
    expect(vnode.children.default()).toBe('已完成')
  })

  it('语义色 → antd 状态色映射（danger→error、info→default）', () => {
    const wrapper = mountTable([
      {
        prop: 'status',
        label: '状态',
        inTable: true,
        dataOptions: [
          { label: '失败', value: 3, tagType: 'danger' },
          { label: '草稿', value: 4, tagType: 'info' },
        ],
      },
    ])
    const render = statusColumn(wrapper)._esCol.render
    expect(render(h, { row: { status: 3 } }).props.color).toBe('error')
    expect(render(h, { row: { status: 4 } }).props.color).toBe('default')
  })

  it('未命中 → 原始值纯文本', () => {
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    expect(statusColumn(wrapper)._esCol.render(h, { row: { status: 9 } })).toBe('9')
  })

  it('显式 formatter 优先：不注入 dataOptions 的 render', () => {
    const formatter = (row: any) => `#${row.status}`
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions, formatter }])
    const col = statusColumn(wrapper)
    expect(col._esCol.render).toBeUndefined()
    expect(col.customRender({ text: 9, record: { status: 9 } })).toBe('#9')
  })
})
