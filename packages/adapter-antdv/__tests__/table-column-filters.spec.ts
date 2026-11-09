/**
 * antdv 列筛选（W3-2）—— a-table 列适配 + change 归一 + vxe 适配器。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import EsTable from '../src/components/es-table/src/component.vue'
import { adaptColumn } from '../src/components/es-table/src/column-adapter'
import { useVxeColumnAdapter } from '../src/components/es-table/src/engines/use-vxe-column-adapter'
import type { TableColumn, TableOptions } from '../src/types'

vi.mock('ant-design-vue', () => ({
  Table: { name: 'ATable', template: '<div class="mock-table" />', props: ['columns', 'dataSource', 'rowKey', 'pagination', 'loading', 'bordered', 'size', 'showHeader', 'rowSelection', 'rowClassName', 'customRow', 'scroll', 'sortDirections', 'locale'] },
  Pagination: { name: 'APagination', template: '<div class="mock-pagination" />', props: ['current', 'pageSize', 'total', 'showSizeChanger', 'showQuickJumper', 'pageSizeOptions', 'size', 'showTotal'] },
  Spin: { name: 'ASpin', template: '<div class="mock-spin"><slot /></div>', props: ['spinning', 'tip'] },
  ConfigProvider: { name: 'AConfigProvider', template: '<div class="mock-config"><slot /></div>', props: ['locale'] },
  Button: { name: 'AButton', template: '<button class="mock-btn"><slot /></button>', props: ['type', 'size', 'loading', 'disabled'] },
  Tooltip: { name: 'ATooltip', template: '<div class="mock-tooltip"><slot /></div>', props: ['title', 'placement'] },
}))

const filterColumns: TableColumn[] = [
  {
    prop: 'status',
    label: '状态',
    filters: [
      { text: '启用', value: 1 },
      { text: '停用', value: 0 },
    ],
  },
]

describe('adaptColumn — 列筛选映射', () => {
  it('filters → a-table 的 { text, value }，filterMultiple 默认 true', () => {
    const adv = adaptColumn(filterColumns[0]) as any
    expect(adv.filters).toEqual([
      { text: '启用', value: 1 },
      { text: '停用', value: 0 },
    ])
    expect(adv.filterMultiple).toBe(true)
    expect(typeof adv.onFilter).toBe('function')
  })

  it('onFilter 走 core 的宽松相等（"1" 命中 1）', () => {
    const adv = adaptColumn(filterColumns[0]) as any
    expect(adv.onFilter(1, { status: '1' })).toBe(true)
    expect(adv.onFilter(1, { status: 0 })).toBe(false)
  })

  it('filterMode: includes → 文本包含', () => {
    const adv = adaptColumn({ ...filterColumns[0], filterMode: 'includes' } as TableColumn) as any
    expect(adv.onFilter('1', { status: 11 })).toBe(true)
  })

  it('用户自定义 filterMethod 直接当 onFilter 用', () => {
    const custom = vi.fn(() => true)
    const adv = adaptColumn({ ...filterColumns[0], filterMethod: custom } as TableColumn) as any
    adv.onFilter(1, { status: 0 })
    expect(custom).toHaveBeenCalled()
  })

  it('无 filters 时不产生 filters/onFilter/filterMode 透传', () => {
    const adv = adaptColumn({ prop: 'status', label: '状态' } as TableColumn) as any
    expect(adv.filters).toBeUndefined()
    expect(adv.onFilter).toBeUndefined()
    expect(adv.filterMode).toBeUndefined()
  })
})

describe('EsTable(antdv) — filter-change 归一', () => {
  it('a-table 的 change 载荷（列 key）映射回 prop，逐列转出 { prop, values }', async () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [{ status: 1 }],
        columns: filterColumns,
        options: {} as any,
        pagination: { total: 1 },
      },
    })
    const table = wrapper.findComponent({ name: 'ATable' })
    expect(table.exists()).toBe(true)
    table.vm.$emit('change', { current: 1 }, { status: [1] }, {})
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('filter-change')).toEqual([[{ prop: 'status', values: [1] }]])
  })

  it('清空筛选 → values 为空数组', async () => {
    const wrapper = mount(EsTable, {
      props: {
        dataSource: [{ status: 1 }],
        columns: filterColumns,
        options: {} as any,
        pagination: { total: 1 },
      },
    })
    wrapper.findComponent({ name: 'ATable' }).vm.$emit('change', {}, { status: null }, {})
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('filter-change')).toEqual([[{ prop: 'status', values: [] }]])
  })
})

describe('antdv vxe 适配器 — 列筛选', () => {
  const baseOptions = (): TableOptions =>
    ({ multiSelect: false, snIndex: false, expand: false }) as TableOptions

  const adapt = (col: TableColumn) => {
    const cols = ref([col] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    return adaptedColumns.value.find((c: any) => c.field === col.prop) as any
  }

  it('filters → label/value，合成 filterMethod（宽松相等）', () => {
    const c = adapt({ prop: 'status', label: '状态', filters: [{ text: '启用', value: 1 }] } as TableColumn)
    expect(c.filters).toEqual([{ label: '启用', value: 1 }])
    expect(c.filterMultiple).toBe(true)
    expect(c.filterMethod({ value: 1, row: { status: '1' } })).toBe(true)
    expect(c.filterMethod({ value: 1, row: { status: 0 } })).toBe(false)
  })

  it('无 filters 时不产生 filterMethod', () => {
    const c = adapt({ prop: 'status', label: '状态' } as TableColumn)
    expect(c.filters).toBeUndefined()
    expect(c.filterMethod).toBeUndefined()
  })
})

/**
 * P2-3：`autoFilters` —— dataOptions 自动派生筛选面板（合成单源在 core，
 * 组件在把列交给 column-adapter 之前完成合成）。
 */
describe('EsTable(antdv) — autoFilters 从 dataOptions 派生', () => {
  const autoColumns: TableColumn[] = [
    {
      prop: 'status',
      label: '状态',
      autoFilters: true,
      dataOptions: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  ]

  const mountAuto = (columns: TableColumn[] = autoColumns) =>
    mount(EsTable, {
      props: { dataSource: [{ status: 1 }], columns, options: {} as any, pagination: { total: 1 } },
    })

  it('a-table 列拿到 { text, value } + onFilter（宽松相等）', () => {
    const wrapper = mountAuto()
    const cols = wrapper.findComponent({ name: 'ATable' }).props('columns') as any[]
    const status = cols.find((c) => c.dataIndex === 'status')!
    expect(status.filters).toEqual([
      { text: '启用', value: 1 },
      { text: '停用', value: 0 },
    ])
    expect(status.onFilter(1, { status: '1' })).toBe(true)
    expect(status.onFilter(0, { status: 1 })).toBe(false)
  })

  it('显式 filters 优先于 dataOptions', () => {
    const wrapper = mountAuto([{ ...autoColumns[0], filters: [{ text: '手写', value: 9 }] }])
    const cols = wrapper.findComponent({ name: 'ATable' }).props('columns') as any[]
    expect(cols.find((c) => c.dataIndex === 'status')!.filters).toEqual([{ text: '手写', value: 9 }])
  })
})
