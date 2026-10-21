/**
 * ColumnItem — render 列的取值回归
 *
 * 契约：`render(h, { value, row, index })` 的 `value` 取**列的数据字段**，
 * 即 `cols.prop || cols.key`（prop 是 el-table-column 的真正数据字段；key 只是历史别名）。
 *
 * 修前：模板只绑定 `cols.key` / 分组子列的 `item.key`，于是「只写 prop、不写 key」
 * ——最常见、也是生成器产出的写法——`value` 恒为 `null`。vue3 只修了非分组分支，
 * 分组子列两端都漏；vue2 两条分支都只认 key。
 *
 * 这里 mock 掉 `element-plus` 的 ElTableColumn：ColumnItem 的模板分支要求列组件
 * 调用其 scoped slot 才会渲染 RenderDomTb，而真实 el-table 在 happy-dom 下不产出
 * 单元格。用一个会**立即调用 default 作用域插槽**的桩即可直接观察 render 收到的 ctx。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('element-plus', async () => {
  const { defineComponent, h } = await import('vue')
  const ElTableColumn = defineComponent({
    name: 'ElTableColumn',
    props: {
      prop: String,
      label: String,
      type: String,
      width: [String, Number],
      align: String,
      showOverflowTooltip: Boolean,
    },
    setup(_props, { slots }) {
      return () =>
        h(
          'div',
          { class: 'el-table-column-stub' },
          slots.default ? slots.default({ row: { price: 42 }, $index: 0, column: {} }) : []
        )
    },
  })
  return { ElTableColumn }
})

import ColumnItem from '../src/components/es-table/src/column-item.vue'

const collect = () => {
  const seen: unknown[] = []
  const render = (_h: any, { value }: any) => {
    seen.push(value)
    return 'x'
  }
  return { seen, render }
}

describe('ColumnItem(vue3) — render 列的 value 取值', () => {
  it('只写 prop 的列：value = row[prop]（修前恒为 null）', () => {
    const { seen, render } = collect()
    mount(ColumnItem, { props: { cols: { prop: 'price', label: '价格', render } as any } })
    expect(seen).toEqual([42])
  })

  it('兼容只写 key 的存量列：value = row[key]', () => {
    const { seen, render } = collect()
    mount(ColumnItem, {
      props: { cols: { key: 'price', label: '价格', render } as any },
    })
    expect(seen).toEqual([42])
  })

  it('分组子列只写 prop：value = row[prop]（修前同样恒为 null）', () => {
    const { seen, render } = collect()
    mount(ColumnItem, {
      props: {
        cols: {
          label: '价格组',
          groups: [{ prop: 'price', label: '价格', render }],
        } as any,
      },
    })
    expect(seen).toEqual([42])
  })
})
