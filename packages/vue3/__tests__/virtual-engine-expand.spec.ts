/**
 * 虚拟引擎 × 真实 ElTableV2 的展开行行为
 *
 * 起因：引擎自持 `expandedKeys` 与展开图标，却**从不影响下发给 el-table-v2 的 data**。
 * 于是「展开」只翻转了图标：行序列恒定不变，展开区永远是空的 —— 树形 `children`
 * 在虚拟引擎下永远出不来，且没有任何报错或提示。
 *
 * 本文件挂载真的 virtual-engine（内部是真的 ElTableV2），点真的展开图标，
 * 断言真的行序列变化 —— 不这么做的话，"摊平"这件事在单测里只能靠读引擎内部状态
 * 来自证，而那正是缺陷藏身之处。
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElTableV2 } from 'element-plus'
import VirtualEngine from '../src/components/es-table/src/engines/virtual-engine.vue'
import type { TableColumn } from '../src/types'

const columns: TableColumn[] = [
  { prop: 'name', label: '姓名', width: 200 },
]

const treeData = [
  {
    id: 1,
    name: '总公司',
    children: [
      { id: 11, name: '技术部', children: [{ id: 111, name: '前端组' }] },
      { id: 12, name: '销售部' },
    ],
  },
  { id: 2, name: '分公司A' },
]

const mountEngine = (options: Record<string, unknown> = { expand: true }) =>
  mount(VirtualEngine, {
    props: { columns, dataSource: treeData, tableHeight: 400, options },
    attachTo: document.body,
  })

/**
 * 当前真正渲染出来的数据行文本（不含表头）。
 * EL 会额外渲染若干占位行把视口填满（`rowData` 为空 → 文本为空串），这里排除掉。
 * 占位行不带 `is-fixed` 类（`ns.is('fixed')` 只对固定列表生效），只能按内容过滤。
 */
const rowTexts = (wrapper: ReturnType<typeof mountEngine>) =>
  wrapper
    .findAll('.el-table-v2__row')
    .map((r) => r.text())
    .filter((text) => text !== '')

/** 第 n 个展开图标 */
const expandIcons = (wrapper: ReturnType<typeof mountEngine>) =>
  wrapper.findAll('.es-virtual-expand-icon')
async function clickExpandIcon(wrapper: ReturnType<typeof mountEngine>, index: number) {
  await expandIcons(wrapper)[index].trigger('click')
  await flushPromises()
}

describe('virtual-engine × ElTableV2 —— 展开行链路', () => {
  it('前置条件：树形数据默认只渲染顶层行', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    expect(rowTexts(wrapper)).toEqual(['总公司', '分公司A'])
  })

  it('展开顶层行 → 其 children 立即出现在行序列里', async () => {
    const wrapper = mountEngine()
    await flushPromises()

    await clickExpandIcon(wrapper, 0)

    expect(rowTexts(wrapper)).toEqual(['总公司', '技术部', '销售部', '分公司A'])
  })

  it('逐层展开 → 后代按文档顺序就地插入，而不是追加到末尾', async () => {
    const wrapper = mountEngine()
    await flushPromises()

    await clickExpandIcon(wrapper, 0) // 展开总公司
    await clickExpandIcon(wrapper, 1) // 展开技术部（此时排在第 2 行）

    expect(rowTexts(wrapper)).toEqual(['总公司', '技术部', '前端组', '销售部', '分公司A'])
  })

  it('再次点击 → 收起，行序列复原', async () => {
    const wrapper = mountEngine()
    await flushPromises()

    await clickExpandIcon(wrapper, 0)
    await clickExpandIcon(wrapper, 0)

    expect(rowTexts(wrapper)).toEqual(['总公司', '分公司A'])
  })

  it('逐层展开 → 子行按层级缩进（深度×16px）', async () => {
    const wrapper = mountEngine()
    await flushPromises()

    await clickExpandIcon(wrapper, 0)
    await clickExpandIcon(wrapper, 1)

    const indents = expandIcons(wrapper).map(
      (icon) => (icon.attributes('style') || '').match(/margin-inline-start:\s*(\d+)px/)?.[1]
    )
    expect(indents).toEqual(['0', '16', '32', '16', '0'])
  })

  it('没有展开任何行时不重建行数组：同一实例跨渲染复用', async () => {
    const wrapper = mountEngine()
    await flushPromises()
    const before = wrapper.findComponent(ElTableV2).props('data')

    // 换个无关 prop 触发重渲染：摊平结果没变就不该产生新数组 ——
    // EL 的 use-data 监听 data 身份，身份一变就 resetAfterIndex(0)（整表重排 + 滚动位置丢失）。
    await wrapper.setProps({ tableHeight: 500 })
    await flushPromises()

    expect(wrapper.findComponent(ElTableV2).props('data')).toBe(before)
  })
})
