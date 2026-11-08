import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import {
  ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider,
} from 'element-plus'
import EsTable from '../src/components/es-table/src/component.vue'
import { useVxeColumnAdapter } from '../src/components/es-table/src/engines/use-vxe-column-adapter'
import type { TableOptions, TableColumn } from '../src/types'

// Mock ResizeObserver for happy-dom
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', mockResizeObserver)

const globalComponents = { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider }

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

const mountTable = (propsOverrides: Record<string, unknown> = {}) =>
  mount(EsTable, {
    props: { dataSource: [{ status: 1 }, { status: 0 }], columns: filterColumns, ...propsOverrides },
    global: { components: globalComponents },
  })

/**
 * W3-2 列筛选 —— vue3 默认引擎（el-table）。
 *
 * 三条不变量：
 *   1. 声明了 filters 的列，`columnKey` 必须固定成 `prop || key` —— 否则 el-table 的
 *      `filter-change` 载荷键是内部数字列 id，宿主无法映射回字段；
 *   2. 合成谓词走 core 的宽松相等（后端 1 / 配置 "1" 也能筛中），自定义 filterMethod 不被覆盖；
 *   3. `filter-change` 事件三端同形 `{ prop, values }`（逐列派发）。
 * `filterMode` 是本库语义键，不能落到 el-table-column 上（无意义 DOM 属性）。
 */
describe('EsTable 默认引擎 — 列筛选（W3-2）', () => {
  it('合成 filterMethod，且 columnKey 固定为 prop', () => {
    const wrapper = mountTable()
    const col = wrapper
      .findAllComponents(ElTableColumn)
      .find((c) => c.props('prop') === 'status')
    expect(col).toBeTruthy()
    expect(col!.props('columnKey')).toBe('status')
    expect(typeof col!.props('filterMethod')).toBe('function')
    expect(col!.props('filters')).toEqual([
      { text: '启用', value: 1 },
      { text: '停用', value: 0 },
    ])
  })

  it('合成谓词走 core 的宽松相等（"1" 命中 1）', () => {
    const wrapper = mountTable()
    const col = wrapper
      .findAllComponents(ElTableColumn)
      .find((c) => c.props('prop') === 'status')!
    const filterMethod = col.props('filterMethod') as (v: unknown, row: Record<string, unknown>) => boolean
    expect(filterMethod(1, { status: '1' })).toBe(true)
    expect(filterMethod(1, { status: 1 })).toBe(true)
    expect(filterMethod(1, { status: 0 })).toBe(false)
  })

  it('filterMode 不透传给 el-table-column', () => {
    const wrapper = mountTable({
      columns: [{ ...filterColumns[0], filterMode: 'includes' }],
    })
    const col = wrapper
      .findAllComponents(ElTableColumn)
      .find((c) => c.props('prop') === 'status')!
    expect(col.attributes('filtermode')).toBeUndefined()
    // 语义键仍然生效（includes → 文本包含）
    const filterMethod = col.props('filterMethod') as (v: unknown, row: Record<string, unknown>) => boolean
    expect(filterMethod('1', { status: 11 })).toBe(true)
  })

  it('filter-change 归一成 { prop, values }（宿主拿到的是字段名而不是数字列 id）', async () => {
    const wrapper = mountTable()
    wrapper.findComponent(ElTable).vm.$emit('filter-change', { status: [1] })
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('filter-change')).toEqual([[{ prop: 'status', values: [1] }]])
  })

  it('清空筛选时 values 是空数组', async () => {
    const wrapper = mountTable()
    wrapper.findComponent(ElTable).vm.$emit('filter-change', { status: null })
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('filter-change')).toEqual([[{ prop: 'status', values: [] }]])
  })
})

describe('虚拟引擎 — 列筛选不支持必须点名（W3-2）', () => {
  it('DEV 下对声明 filters 的列告警，并指向可用引擎', async () => {
    const { default: VirtualEngine } = await import(
      '../src/components/es-table/src/engines/virtual-engine.vue'
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      mount(VirtualEngine, {
        props: {
          columns: [
            { prop: 'name', label: '姓名', width: 120 },
            { prop: 'status', label: '状态', filters: [{ text: '启用', value: 1 }] },
          ] as TableColumn[],
          dataSource: [{ name: '张三', status: 1 }],
          tableHeight: 200,
          options: {},
        },
        attachTo: document.body,
      })
      const calls = warn.mock.calls.map((c) => String(c[0]))
      const hit = calls.find((m) => m.includes('虚拟引擎不支持列筛选'))
      expect(hit).toBeTruthy()
      expect(hit).toContain('status')
      expect(hit).toContain("engine:'vxe'")
    } finally {
      warn.mockRestore()
    }
  })
})

describe('vxe 适配器 — 列筛选（W3-2）', () => {
  const baseOptions = (overrides: Partial<TableOptions> = {}): TableOptions =>
    ({ multiSelect: false, snIndex: false, expand: false, ...overrides }) as TableOptions

  const adapt = (col: TableColumn) => {
    const cols = ref([col] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols, baseOptions())
    return adaptedColumns.value[0]
  }

  it('filters → label/value，filterMultiple 默认 true', () => {
    const col = adapt({
      prop: 'status',
      label: '状态',
      filters: [{ text: '启用', value: 1 }],
    } as TableColumn)
    expect(col.filters).toEqual([{ label: '启用', value: 1 }])
    expect(col.filterMultiple).toBe(true)
    expect(typeof col.filterMethod).toBe('function')
  })

  it('filterMultiple:false 原样透传', () => {
    const col = adapt({
      prop: 'status',
      filters: [{ text: '启用', value: 1 }],
      filterMultiple: false,
    } as TableColumn)
    expect(col.filterMultiple).toBe(false)
  })

  it('filterMethod 收到 vxe 的 { value, row } 并走宽松相等', () => {
    const col = adapt({ prop: 'status', filters: [{ text: '启用', value: 1 }] } as TableColumn)
    const fn = col.filterMethod as (p: { value: unknown; row: Record<string, unknown> }) => boolean
    expect(fn({ value: 1, row: { status: '1' } })).toBe(true)
    expect(fn({ value: 1, row: { status: 0 } })).toBe(false)
  })

  it('用户自定义 filterMethod 不被覆盖（仍是原函数）', () => {
    const custom = vi.fn(() => true)
    const col = adapt({
      prop: 'status',
      filters: [{ text: '启用', value: 1 }],
      filterMethod: custom,
    } as TableColumn)
    const fn = col.filterMethod as (p: { value: unknown; row: Record<string, unknown> }) => boolean
    fn({ value: 1, row: { status: 0 } })
    expect(custom).toHaveBeenCalled()
  })

  it('没声明 filters 时不产生 filterMethod', () => {
    const col = adapt({ prop: 'status', label: '状态' } as TableColumn)
    expect(col.filters).toBeUndefined()
    expect(col.filterMethod).toBeUndefined()
  })
})
