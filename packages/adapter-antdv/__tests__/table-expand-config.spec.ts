/**
 * 声明式行展开内容（AI-09 子项②）— antdv 运行时见证。
 *
 * 重点见证 expandEnabled 的放宽：此前 expandEnabled 硬性要求宿主提供 `#expand` 插槽，
 * 于是「只在列上写 expandConfig」的配置渲染不出展开器（有数据、无入口）。放宽后应仅凭
 * 「列上有 expandConfig」就渲染展开器，并在展开后展示 label: value 只读明细。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
// 先走包入口完成模块图初始化（对齐 crud-runtime.spec.ts 的做法）。
import '../src/index'
import EsTable from '../src/components/es-table/src/component.vue'
import type { TableColumn } from '../src/types'

const columns: TableColumn[] = [
  { prop: 'name', label: '名称' },
  {
    type: 'expand',
    expandConfig: {
      title: '明细',
      fields: [
        { prop: 'contact', label: '联系人' },
        { prop: 'address' }, // 无 label → 回退到 prop
      ],
    },
  },
]

const dataSource = [{ id: 1, name: '供应商A', contact: '张三', address: '北京' }]

describe('es-table（antdv）— 声明式行展开 expandConfig', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('仅凭列上的 expandConfig 即渲染展开器，展开后展示 label: value 明细', async () => {
    const wrapper = mount(EsTable, {
      props: { columns, dataSource, options: { expand: false, multiSelect: false } as any },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    // 展开器图标（ant-design-vue 行展开按钮）——此前无宿主 slot 时不渲染
    const icon = wrapper.find('.ant-table-row-expand-icon')
    expect(icon.exists(), '仅凭 expandConfig 应渲染出展开器（无需宿主 #expand 插槽）').toBe(true)

    // 展开前：明细不在文档里
    expect(wrapper.find('.es-expand-content').exists()).toBe(false)

    await icon.trigger('click')
    await flushPromises()
    await nextTick()

    // 展开后：标题 + 字段明细（label: value）真的渲染出来
    expect(wrapper.find('.es-expand-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('明细')
    expect(wrapper.text()).toContain('联系人')
    expect(wrapper.text()).toContain('张三')
    // 未提供 label 的字段回退到 prop
    expect(wrapper.text()).toContain('address')
    expect(wrapper.text()).toContain('北京')
  })
})
