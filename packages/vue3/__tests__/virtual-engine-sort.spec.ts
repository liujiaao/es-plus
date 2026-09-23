/**
 * 虚拟表格引擎 × 真实 ElTableV2 的排序行为
 *
 * 起因：`useVirtualSort` 的方向此前完全取自 EL TableV2 `column-sort` 事件的
 * `order` 参数，而 EL 算这个参数时用的是 `props.sortBy.order`
 * （`element-plus/es/components/table-v2/src/composables/use-columns.mjs:58-70`）——
 * es-plus 透传的 `sortBy` 初值是 undefined（→ prop 默认 `{}`），于是
 * `oppositeOrderMap[undefined]` 恒为 undefined。后果是**所有**排序交互都 emit
 * `order: null`：排序事件不携带方向，表头箭头也永远不翻。
 *
 * 本文件是这条链路唯一的真实集成验证：挂载真的 `virtual-engine`（内部是真的
 * `ElTableV2`），点真的表头单元格，断言真的 `sort-change` 载荷与真的箭头形状。
 * 不这么做的话，"引擎自持状态机"这件事在单测里只能靠喂假的 order 来自证 ——
 * 而那正是缺陷藏身之处（旧的 use-virtual-sort.spec.ts 正是如此，它喂的
 * `order: 'asc'/'desc'` 在真实 EL 下从不会出现，所以才一直全绿）。
 *
 * 关于 aria-sort：EL 的表头把可访问性属性写成 `ariaSort` 这个 JavaScipt 键，
 * 经 Vue 的 setAttribute 落到 DOM 上会被 HTML 规范小写成 `ariasort`（属性名不带
 * 连字符，辅助技术读不到）——这是上游 EL 的问题，不是 es-plus 的。因此这里不断言
 * `aria-sort`，改断言**用户可见的箭头形状**，它由同一个 `sortBy.order` 驱动。
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { SortUp, SortDown } from '@element-plus/icons-vue'
import VirtualEngine from '../src/components/es-table/src/engines/virtual-engine.vue'
import type { TableColumn } from '../src/types'

const columns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 120, sortable: true },
  { prop: 'age', label: '年龄', width: 120, sortable: true },
]

const dataSource = [
  { id: 1, name: 'a', age: 10 },
  { id: 2, name: 'b', age: 20 },
]

const mountEngine = () =>
  mount(VirtualEngine, {
    props: { columns, dataSource, tableHeight: 400, options: { rowkey: 'id' } },
    attachTo: document.body,
  })

/** EL TableV2 的表头单元格：可排序列带 data-key，点击即触发 column-sort */
const header = (key: string) => `[data-key="${key}"]`

/** 图标的 path d：期望值从 EL 自己的图标组件取，不硬编码路径 */
const iconPath = (icon: unknown) => mount(icon as never).find('path').attributes('d')
const HEADER_PATH = (wrapper: ReturnType<typeof mountEngine>, key: string) =>
  wrapper.find(`${header(key)} svg path`).attributes('d')

const ORDER_UP = iconPath(SortUp)
const ORDER_DOWN = iconPath(SortDown)

const sortOrders = (wrapper: ReturnType<typeof mountEngine>) =>
  (wrapper.emitted('sort-change') ?? []).map((e) => (e[0] as { order: string | null }).order)

const lastProp = (wrapper: ReturnType<typeof mountEngine>) => {
  const events = wrapper.emitted('sort-change') ?? []
  return (events[events.length - 1]?.[0] as { prop: string } | undefined)?.prop
}

async function click(wrapper: ReturnType<typeof mountEngine>, key: string) {
  await wrapper.find(header(key)).trigger('click')
  await flushPromises()
}

describe('virtual-engine × ElTableV2 —— 排序链路', () => {
  it('前置条件：EL 真的渲染出了带 data-key 的可排序表头单元格', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    expect(wrapper.find(header('name')).exists()).toBe(true)
    expect(wrapper.find(`${header('name')} .el-table-v2__sort-icon`).exists()).toBe(true)
  })

  it('同列连点三次 → sort-change 依次是 ascending / descending / null', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    await click(wrapper, 'name')
    await click(wrapper, 'name')
    await click(wrapper, 'name')
    // 回归：此前恒为 [null, null, null]
    expect(sortOrders(wrapper)).toEqual(['ascending', 'descending', null])
  })

  it('表头箭头随状态翻转（升序=SortUp，降序=SortDown）', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    await click(wrapper, 'name')
    // 回归：此前 sortBy.order 恒为 undefined → EL 恒渲染 SortDown，箭头永远不翻
    expect(HEADER_PATH(wrapper, 'name')).toBe(ORDER_UP)
    await click(wrapper, 'name')
    expect(HEADER_PATH(wrapper, 'name')).toBe(ORDER_DOWN)
  })

  it('取消排序后 payload 的 prop 归空', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    await click(wrapper, 'name')
    await click(wrapper, 'name')
    await click(wrapper, 'name')
    expect(lastProp(wrapper)).toBe('')
  })

  it('换列点击 → 新列从升序起（且载荷指向新列）', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    await click(wrapper, 'name')
    await click(wrapper, 'age')
    expect(lastProp(wrapper)).toBe('age')
    expect(sortOrders(wrapper)).toEqual(['ascending', 'ascending'])
    expect(HEADER_PATH(wrapper, 'age')).toBe(ORDER_UP)
  })

  it('每次点击恰好 emit 一次 sort-change', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    await click(wrapper, 'name')
    await click(wrapper, 'name')
    expect(wrapper.emitted('sort-change')).toHaveLength(2)
  })
})
