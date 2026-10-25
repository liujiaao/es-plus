/**
 * EsTable 声明式 `dataOptions` —— vue3 渲染器
 *
 * `dataOptions` 在 `filteredColumns` 里被落成单元格 `render`，因此这里断言的是
 * **ColumnItem 真正拿到的 `cols`**（而不是从组件外部假设）。再调用那个 render 观察
 * 它产出的 vnode：命中 → ElTag（带语义色）/ 未命中 → 原始值 / 已有 formatter 不注入。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider, ElTag } from 'element-plus'
import EsTable from '../src/components/es-table/src/component.vue'
import ColumnItem from '../src/components/es-table/src/column-item.vue'
import type { TableColumn } from '../src/types'

vi.stubGlobal(
  'ResizeObserver',
  vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }))
)

const globalComponents = { ElTable, ElTableColumn, ElPagination, ElButton, ElConfigProvider }

const statusOptions = [
  { label: '待处理', value: 0, tagType: 'info' as const },
  { label: '进行中', value: 1, tagType: 'warning' as const },
  { label: '已完成', value: 2, tagType: 'success' as const },
]

const mountTable = (columns: TableColumn[], dataSource: Record<string, unknown>[] = []) =>
  mount(EsTable, {
    props: { columns, dataSource },
    global: { components: globalComponents },
  })

/** 拿到 EsTable 交给 ColumnItem 的那份列配置（filteredColumns 的一手观测点）。 */
const columnConfig = (wrapper: ReturnType<typeof mountTable>, index = 0): TableColumn =>
  wrapper.findAllComponents(ColumnItem)[index].props('cols') as TableColumn

describe('EsTable(vue3) — dataOptions 单元格', () => {
  it('命中码值 → render 产出 ElTag（标签文本 + 语义色）', () => {
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    const render = columnConfig(wrapper).render!
    expect(typeof render).toBe('function')

    const vnode = render(h, { row: { status: 2 } }) as any
    expect(vnode.type).toBe(ElTag)
    expect(vnode.props.type).toBe('success')
    expect(vnode.children.default()).toBe('已完成')
  })

  it('后端给字符串 "1" 也能命中数字 1', () => {
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    const vnode = columnConfig(wrapper).render!(h, { row: { status: '1' } }) as any
    expect(vnode.props.type).toBe('warning')
    expect(vnode.children.default()).toBe('进行中')
  })

  it('未命中 → 原始值纯文本（新状态码仍可见，不塌成占位符）', () => {
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    const out = columnConfig(wrapper).render!(h, { row: { status: 9 } })
    expect(out).toBe('9')
  })

  it('显式 formatter 优先：不注入 dataOptions 的 render，formatter 保留', () => {
    const formatter = (row: Record<string, unknown>) => `#${row.status}`
    const wrapper = mountTable([
      { prop: 'status', label: '状态', dataOptions: statusOptions, formatter },
    ])
    const col = columnConfig(wrapper)
    expect(col.render).toBeUndefined()
    expect(col.formatter).toBe(formatter)
  })

  it('显式 render 优先：保留用户 render，不被覆写', () => {
    const render = () => 'custom'
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions, render }])
    expect(columnConfig(wrapper).render).toBe(render)
  })

  it('dataOptions 不透传到 el-table-column（避免 [object Object] DOM 属性）', () => {
    const wrapper = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    const props = wrapper.findAllComponents(ElTableColumn)[0].props() as Record<string, unknown>
    expect('dataOptions' in props).toBe(false)
  })

  it('分组子列各自消费自己的 dataOptions', () => {
    const wrapper = mountTable([
      { label: '状态组', groups: [{ prop: 'status', label: '状态', dataOptions: statusOptions }] },
    ])
    const groups = columnConfig(wrapper).groups!
    expect(typeof groups[0].render).toBe('function')
    const vnode = groups[0].render!(h, { row: { status: 0 } }) as any
    expect(vnode.type).toBe(ElTag)
    expect(vnode.props.type).toBe('info')
  })
})
