/**
 * EsTable 声明式 `dataOptions` —— vue2 渲染器
 *
 * 与 vue3 同源：解析走 `@es-plus/core` 的 `resolveTableCellDisplay`，vue2 只把结果
 * 包成 Element UI 的 `el-tag`（其 tag 没有 primary 语义色，故 primary → 不传 type）。
 * 这里不加载真实 element-ui（见 es-table.spec.ts 的说明），直接观察 `filteredColumns`
 * 与 render 产出的 vnode 数据。
 */
import { describe, it, expect } from 'vitest'
import Vue from 'vue'
import EsTable from '../src/components/es-table/component.vue'

const statusOptions = [
  { label: '待处理', value: 0, tagType: 'info' as const },
  { label: '进行中', value: 1, tagType: 'warning' as const },
  { label: '已完成', value: 2, tagType: 'success' as const },
]

function mountTable(columns: unknown[]): any {
  return new Vue({
    render: (h) =>
      h(EsTable as any, {
        props: {
          dataSource: [],
          columns,
          options: {},
          pagination: { current: 1, pageSize: 10, total: 0 },
        },
      }),
  }).$mount()
}

const tableOf = (vm: any): any => vm.$children[0]
const columnOf = (vm: any, index = 0): any => {
  const table = tableOf(vm)
  return table.filteredColumns[index]
}

describe('EsTable(vue2) — dataOptions 单元格', () => {
  it('命中码值 → render 产出 el-tag（文本 + 语义 type）', () => {
    const vm = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    const render = columnOf(vm).render
    expect(typeof render).toBe('function')

    const vnode = render(vm.$createElement, { row: { status: 2 } })
    expect(vnode.tag).toBe('el-tag')
    expect(vnode.data.props.type).toBe('success')
    expect(vnode.children[0].text).toBe('已完成')
  })

  it('primary 映射为不传 type（Element UI 无 primary 语义色）', () => {
    const vm = mountTable([
      { prop: 'level', label: '级别', dataOptions: [{ label: '高', value: 1, tagType: 'primary' }] },
    ])
    const vnode = columnOf(vm).render(vm.$createElement, { row: { level: 1 } })
    expect(vnode.data.props.type).toBe('')
  })

  it('未命中 → 原始值纯文本', () => {
    const vm = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions }])
    expect(columnOf(vm).render(vm.$createElement, { row: { status: 9 } })).toBe('9')
  })

  it('显式 formatter 优先，且不再注入 dataOptions 的 render', () => {
    const formatter = (row: any) => `#${row.status}`
    const vm = mountTable([{ prop: 'status', label: '状态', dataOptions: statusOptions, formatter }])
    const col = columnOf(vm)
    expect(col.render).toBeUndefined()
    expect(col.formatter).toBe(formatter)
  })

  it('不污染父组件传入的原始列对象（Vue 2 深度观察数据）', () => {
    const original = { prop: 'status', label: '状态', dataOptions: statusOptions }
    mountTable([original])
    expect(original).not.toHaveProperty('render')
    expect(original).not.toHaveProperty('formatter')
  })

  it('分组子列各自消费自己的 dataOptions', () => {
    const vm = mountTable([
      { label: '状态组', groups: [{ prop: 'status', label: '状态', dataOptions: statusOptions }] },
    ])
    const child = columnOf(vm).groups[0]
    const vnode = child.render(vm.$createElement, { row: { status: 0 } })
    expect(vnode.tag).toBe('el-tag')
    expect(vnode.data.props.type).toBe('info')
  })
})
