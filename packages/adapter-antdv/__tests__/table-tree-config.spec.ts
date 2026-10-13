/**
 * 声明式树表（AI-09 子项③ treeConfig）— antdv 运行时见证。
 *
 * 重点见证两件事：
 *  1) `defaultExpandAllRows` 此前是硬编码 false（有树数据也不展开）；放宽后应随
 *     `options.treeConfig.expandAll` 初始展开。
 *  2) 新增的 `childrenColumnName` 绑定：`options.treeConfig.childrenField` 非默认
 *     `children` 时，a-table 也应按自定义子键名解析嵌套行。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
// 先走包入口完成模块图初始化（对齐 table-expand-config.spec.ts 的做法）。
import '../src/index'
import EsTable from '../src/components/es-table/src/component.vue'
import type { TableColumn } from '../src/types'

const columns: TableColumn[] = [
  { prop: 'name', label: '名称' },
  { prop: 'code', label: '编码' },
]

const dataSource = [
  {
    id: 1,
    name: '数码',
    code: 'A',
    subItems: [{ id: 2, name: '手机', code: 'A1' }],
  },
]

describe('es-table（antdv）— 声明式树表 treeConfig', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('自定义子键名（childrenColumnName）生效：subItems 下的子行也渲染', async () => {
    const wrapper = mount(EsTable, {
      props: {
        columns,
        dataSource,
        options: { multiSelect: false, treeConfig: { childrenField: 'subItems' } } as any,
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('数码')
    // 默认不展开：子行在展开前不在文档里
    expect(wrapper.text()).not.toContain('手机')

    const icon = wrapper.find('.ant-table-row-expand-icon')
    expect(icon.exists(), '有嵌套子行的父行应渲染展开器').toBe(true)
    await icon.trigger('click')
    await flushPromises()
    await nextTick()

    // 展开后子行出现 —— 证明 childrenColumnName=subItems 真的驱动了嵌套解析
    expect(wrapper.text()).toContain('手机')
  })

  it('expandAll 初始展开（defaultExpandAllRows 不再恒 false）', async () => {
    const wrapper = mount(EsTable, {
      props: {
        columns,
        dataSource,
        options: { multiSelect: false, treeConfig: { childrenField: 'subItems', expandAll: true } } as any,
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    // 无需点击即展开到子层级
    expect(wrapper.text()).toContain('数码')
    expect(wrapper.text()).toContain('手机')
  })
})
