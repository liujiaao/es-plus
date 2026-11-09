/**
 * vue2 列筛选（W3-2）—— 默认引擎（element-ui）+ vxe 适配器。
 *
 * 不加载真实 element-ui（原因见 es-table.spec.ts 顶部注释：hoist 的 CJS require('vue')
 * 会解析到根部 vue@3）。这里直接核对组件实例上的两件事：
 *   1. `filteredColumns` 给声明了 filters 的列合成了 `filterMethod`（语义来自 core）；
 *   2. `filter-change` 被归一成三端同形 `{ prop, values }`，且 `$listeners` 透传链里
 *      已剔除同名监听（否则 Vue 2 的 v-on 对象与具名监听会让宿主收两份）。
 */
import { describe, it, expect } from 'vitest'
import Vue from 'vue'
import EsTable from '../src/components/es-table/component.vue'
import { ref } from '../src/vue-compat'
import { useVxeColumnAdapter } from '../src/components/es-table/engines/use-vxe-column-adapter'
import type { TableColumn, TableOptions } from '@es-plus/core'

function mountTable(columns: TableColumn[], on: Record<string, (...args: any[]) => void> = {}): any {
  return new Vue({
    render: (h) =>
      h(EsTable as any, {
        props: {
          dataSource: [{ status: 1 }],
          columns,
          options: {},
          pagination: { current: 1, pageSize: 10, total: 1 },
        },
        on,
      }),
  }).$mount()
}

const tableOf = (vm: any): any => vm.$children[0]

/** setup() 返回的 computed 在实例上被解包；兼容直接拿到 ref 的情况。 */
const valueOf = (v: any) => (v && typeof v === 'object' && 'value' in v ? v.value : v)

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

describe('EsTable(vue2) 默认引擎 — 列筛选', () => {
  it('filteredColumns 为声明 filters 的列合成 filterMethod（宽松相等）', async () => {
    const vm = mountTable(filterColumns)
    await vm.$nextTick()
    const cols = valueOf(tableOf(vm).filteredColumns) as TableColumn[]
    const col = cols.find((c) => c.prop === 'status')!
    expect(typeof col.filterMethod).toBe('function')
    const fn = col.filterMethod as (v: unknown, row: Record<string, unknown>) => boolean
    expect(fn(1, { status: '1' })).toBe(true)
    expect(fn(1, { status: 0 })).toBe(false)
  })

  it('filter-change 归一成 { prop, values }', async () => {
    const seen: any[] = []
    const vm = mountTable(filterColumns, { 'filter-change': (p: any) => seen.push(p) })
    await vm.$nextTick()
    tableOf(vm).handleColumnFilterChange({ status: [1] })
    expect(seen).toEqual([{ prop: 'status', values: [1] }])
  })

  it('清空筛选 → values 为空数组', async () => {
    const seen: any[] = []
    const vm = mountTable(filterColumns, { 'filter-change': (p: any) => seen.push(p) })
    await vm.$nextTick()
    tableOf(vm).handleColumnFilterChange({ status: null })
    expect(seen).toEqual([{ prop: 'status', values: [] }])
  })

  it('$listeners 透传链剔除 filter-change（避免 vue2 双份派发）', async () => {
    const seen: any[] = []
    const vm = mountTable(filterColumns, { 'filter-change': (p: any) => seen.push(p) })
    await vm.$nextTick()
    const listeners = tableOf(vm).elTableListeners()
    expect(listeners['filter-change']).toBeUndefined()
    // 其它监听必须照旧透传
    const vm2 = mountTable(filterColumns, { 'sort-change': () => {} })
    await vm2.$nextTick()
    expect(typeof tableOf(vm2).elTableListeners()['sort-change']).toBe('function')
  })

  it('宿主监听器确实挂到了 el-table 上（v-on 传的必须是对象）', async () => {
    // 回归：`v-on="elTableListeners"`（漏括号）会让 Vue 2 的 bindObjectListeners
    // 收到函数 —— 开发期告警、生产期把**整份监听器静默丢弃**。
    const ElTableStub = {
      name: 'ElTableStub',
      props: { data: { type: Array, default: () => [] } },
      template: '<div class="stub-table"><slot /></div>',
    }
    const seen: any[] = []
    // 全局注册：EsTable 的模板按全局组件解析 `el-table`（局部注册在根实例上不会生效）
    Vue.component('el-table', ElTableStub)
    const vm = new Vue({
      render: (h) =>
        h(EsTable as any, {
          props: {
            dataSource: [{ status: 1 }],
            columns: filterColumns,
            options: {},
            pagination: { current: 1, pageSize: 10, total: 1 },
          },
          on: { 'header-click': (p: any) => seen.push(p) },
        }),
    }).$mount()
    await vm.$nextTick()
    const stub = (vm.$children[0] as any).$children.find(
      (c: any) => c.$options.name === 'ElTableStub',
    )
    expect(stub).toBeTruthy()
    stub.$emit('header-click', { column: 'status' })
    expect(seen).toEqual([{ column: 'status' }])
    Vue.component('el-table', undefined as any)
  })
})

describe('vue2 vxe 适配器 — 列筛选', () => {
  const makeOptions = (): TableOptions =>
    ({ multiSelect: false, snIndex: false, expand: false }) as TableOptions

  const adapt = (col: TableColumn) => {
    const cols = ref([col] as TableColumn[])
    const { adaptedColumns } = useVxeColumnAdapter(cols as any, makeOptions())
    return adaptedColumns.value.find((c: any) => c.field === col.prop) as any
  }

  it('filters → label/value，filterMultiple 默认 true，合成 filterMethod', () => {
    const c = adapt({ prop: 'status', label: '状态', filters: [{ text: '启用', value: 1 }] } as TableColumn)
    expect(c.filters).toEqual([{ label: '启用', value: 1 }])
    expect(c.filterMultiple).toBe(true)
    expect(typeof c.filterMethod).toBe('function')
    expect(c.filterMethod({ value: 1, row: { status: '1' } })).toBe(true)
    expect(c.filterMethod({ value: 1, row: { status: 0 } })).toBe(false)
  })

  it('filterMultiple:false 透传', () => {
    const c = adapt({
      prop: 'status',
      filters: [{ text: '启用', value: 1 }],
      filterMultiple: false,
    } as TableColumn)
    expect(c.filterMultiple).toBe(false)
  })

  it('无 filters 时不产生 filterMethod', () => {
    const c = adapt({ prop: 'status', label: '状态' } as TableColumn)
    expect(c.filters).toBeUndefined()
    expect(c.filterMethod).toBeUndefined()
  })
})

/**
 * P2-3：`autoFilters` —— dataOptions 自动派生筛选面板（合成单源在 core）。
 */
describe('EsTable(vue2) — autoFilters 从 dataOptions 派生', () => {
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

  it('filteredColumns 拿到派生 filters，并合成 filterMethod（宽松相等）', async () => {
    const vm = mountTable(autoColumns)
    await vm.$nextTick()
    const cols = valueOf(tableOf(vm).filteredColumns) as TableColumn[]
    const col = cols.find((c) => c.prop === 'status')!
    expect(col.filters).toEqual([
      { text: '启用', value: 1 },
      { text: '停用', value: 0 },
    ])
    const fn = col.filterMethod as (v: unknown, row: Record<string, unknown>) => boolean
    expect(fn(1, { status: '1' })).toBe(true)
    expect(fn(0, { status: 1 })).toBe(false)
  })

  it('显式 filters 优先于 dataOptions', async () => {
    const vm = mountTable([{ ...autoColumns[0], filters: [{ text: '手写', value: 9 }] }])
    await vm.$nextTick()
    const cols = valueOf(tableOf(vm).filteredColumns) as TableColumn[]
    expect(cols.find((c) => c.prop === 'status')!.filters).toEqual([{ text: '手写', value: 9 }])
  })
})
