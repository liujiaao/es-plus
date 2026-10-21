/**
 * ColumnItem(vue2) — render 列的取值回归
 *
 * 契约：`render(h, { value, row, index })` 的 `value` 取列的数据字段 `cols.prop || cols.key`。
 * 修前 vue2 的**两条**分支（普通 render 列 + 分组子列）都只绑定 `key`，
 * 「只写 prop」的配置 value 恒为 null（vue3 当时只漏了分组子列）。
 *
 * 本包测试不加载 element-ui（其 CJS 会解析到根部的 vue@3），这里把 `el-table-column`
 * 注册成一个会立即调用 default 作用域插槽的全局桩，直接观察 RenderDomTb 收到的 ctx。
 */
import { describe, it, expect } from 'vitest'
import Vue from 'vue'
import ColumnItem from '../src/components/es-table/column-item.vue'

Vue.component('el-table-column', {
  name: 'ElTableColumnStub',
  props: {
    prop: String,
    label: String,
    type: String,
    width: [String, Number],
    align: String,
    showOverflowTooltip: Boolean,
  },
  render(this: any, h: any) {
    const slot = this.$scopedSlots.default
    return h(
      'div',
      { class: 'el-table-column-stub' },
      slot ? [slot({ row: { price: 42 }, $index: 0, column: {} })] : []
    )
  },
})

const collect = () => {
  const seen: unknown[] = []
  const render = (_h: any, { value }: any) => {
    seen.push(value)
    return 'x'
  }
  return { seen, render }
}

function mountItem(cols: Record<string, unknown>) {
  return new Vue({
    render: (h) => h(ColumnItem as any, { props: { cols } }),
  }).$mount()
}

describe('ColumnItem(vue2) — render 列的 value 取值', () => {
  it('只写 prop 的列：value = row[prop]（修前恒为 null）', () => {
    const { seen, render } = collect()
    mountItem({ prop: 'price', label: '价格', render })
    expect(seen).toEqual([42])
  })

  it('兼容只写 key 的存量列：value = row[key]', () => {
    const { seen, render } = collect()
    mountItem({ key: 'price', label: '价格', render })
    expect(seen).toEqual([42])
  })

  it('分组子列只写 prop：value = row[prop]（修前同样恒为 null）', () => {
    const { seen, render } = collect()
    mountItem({ label: '价格组', groups: [{ prop: 'price', label: '价格', render }] })
    expect(seen).toEqual([42])
  })
})
