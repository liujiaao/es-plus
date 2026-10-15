/**
 * AI-23 声明式合并单元格 —— antdv 端运行时见证。
 *
 * antdv 是**唯一机制不同构**的一端：a-table **没有** span-method 通道，跨端通路是
 * **列级 customCell**（`(record, rowIndex) => ({ rowSpan, colSpan })`，rowSpan:0 = 该格被
 * 合并掉）。所以「组件侧确实把 mergeConfig 翻成了 customCell」必须单独见证 ——
 * vue3/vue2 那条 span-method 见证覆盖不到这条机制。
 *
 * 断言两件事：
 *  1) options.mergeConfig.rowsBy 命中列后，**真实 DOM** 出现 rowspan=段长 且段内其余格消失；
 *  2) 未设 mergeConfig 时零注入（零回归）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
// 先走包入口完成模块图初始化（对齐 table-tree-config.spec.ts 的做法）。
import '../src/index'
import EsTable from '../src/components/es-table/src/component.vue'
import type { TableColumn } from '../src/types'

const columns: TableColumn[] = [
  { prop: 'dept', label: '部门' },
  { prop: 'team', label: '小组' },
  { prop: 'name', label: '姓名' },
]

/** 相邻相等的部门：研发 ×3 → 段长 3；销售 ×1。 */
const dataSource = [
  { id: 1, dept: '研发', team: 'A', name: '张三' },
  { id: 2, dept: '研发', team: 'A', name: '李四' },
  { id: 3, dept: '研发', team: 'B', name: '王五' },
  { id: 4, dept: '销售', team: 'C', name: '赵六' },
]

const tdsOf = (wrapper: { element: Element }) =>
  Array.from(wrapper.element.querySelectorAll('.ant-table-tbody td')) as HTMLTableCellElement[]

describe('es-table（antdv）— 声明式合并单元格 mergeConfig → 列级 customCell', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('rowsBy 命中的列真的合并：段首格 rowspan=段长，段内其余格消失', async () => {
    const wrapper = mount(EsTable, {
      props: {
        columns,
        dataSource,
        options: { multiSelect: false, mergeConfig: { rowsBy: ['dept'] } } as any,
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    const tds = tdsOf(wrapper)
    expect(tds.length, '表格应渲染出数据行').toBeGreaterThan(0)

    const merged = tds.filter((td) => td.getAttribute('rowspan') === '3')
    expect(merged, '应恰有一个 rowspan=3 的格（研发段）').toHaveLength(1)
    expect(merged[0].textContent).toContain('研发')

    // 「研发」在表格体里只出现 1 次 —— 段内其余两格真的被合并掉了。
    const bodyText = wrapper.element.querySelector('.ant-table-tbody')!.textContent || ''
    expect(bodyText.split('研发').length - 1, '「研发」应只渲染 1 次（其余被合并）').toBe(1)
    expect(bodyText).toContain('王五')
    expect(bodyText).toContain('赵六')
  })

  it('未命中 rowsBy 的列不受影响（小组列逐行渲染，无合并）', async () => {
    const wrapper = mount(EsTable, {
      props: {
        columns,
        dataSource,
        options: { multiSelect: false, mergeConfig: { rowsBy: ['dept'] } } as any,
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    // team 不在 rowsBy，故没有任何 td 因 team 而带 rowspan（dept 的 3 之外不存在别的 rowspan>1）。
    const rs = tdsOf(wrapper)
      .map((td) => Number(td.getAttribute('rowspan') || '1'))
      .filter((n) => n > 1)
    expect(rs, '除 dept 段外不应有第二个合并格').toEqual([3])
  })

  it('未设 mergeConfig 时零注入（零回归）：任何格都不带 rowspan>1', async () => {
    const wrapper = mount(EsTable, {
      props: {
        columns,
        dataSource,
        options: { multiSelect: false } as any,
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    const rs = tdsOf(wrapper)
      .map((td) => Number(td.getAttribute('rowspan') || '1'))
      .filter((n) => n > 1)
    expect(rs, '没有 mergeConfig 时不应有任何合并格').toEqual([])
  })
})
