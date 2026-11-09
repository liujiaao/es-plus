/**
 * Ant Design Vue 适配器 — EsForm 分组容器（P1-3 第一期）接线测试。
 *
 * 断言的是「渲染层把哪些容器 / 字段交给了底座组件」；分桶规则本身由 core 单测覆盖。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { FormItem as AFormItem, Tabs as ATabs, Collapse as ACollapse } from 'ant-design-vue'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, { props: { model: {}, formItemList: [], ...props } })

const fields = [
  { prop: 'name', label: '姓名', formtype: 'Input', group: 'basic' },
  { prop: 'phone', label: '电话', formtype: 'Input', group: 'contact' },
  { prop: 'email', label: '邮箱', formtype: 'Input', group: 'contact' }
]

describe('EsForm(ADV) - 分组容器：未配置时行为不变', () => {
  it('没有 layout 时不出现容器，字段走同一个 a-row', () => {
    const wrapper = mountForm({ formItemList: fields.map(({ group, ...rest }) => rest) })
    expect(wrapper.findAllComponents(ATabs)).toHaveLength(0)
    expect(wrapper.findAllComponents(ACollapse)).toHaveLength(0)
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(3)
  })
})

describe('EsForm(ADV) - 分组容器：tabs', () => {
  it('按声明顺序渲染页签，未分组字段落进「其他」', () => {
    const wrapper = mountForm({
      formItemList: [...fields, { prop: 'remark', label: '备注', formtype: 'Input' }],
      layoutFormProps: {
        layout: {
          type: 'tabs',
          groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }]
        }
      }
    })
    const tabs = wrapper.findAll('.ant-tabs-tab').map((n) => n.text())
    expect(tabs).toEqual(['基本信息', '联系方式', '其他'])
  })

  it('ungrouped: hidden 不渲染未分组字段', () => {
    const wrapper = mountForm({
      formItemList: [
        { prop: 'a', label: 'A', formtype: 'Input', group: 'x' },
        { prop: 'b', label: 'B', formtype: 'Input' }
      ],
      layoutFormProps: { layout: { type: 'tabs', ungrouped: 'hidden' } }
    })
    expect(wrapper.findAll('.ant-tabs-tab')).toHaveLength(1)
  })
})

describe('EsForm(ADV) - 分组容器：collapse / steps', () => {
  it('collapse 渲染面板标题，缺省全部展开', () => {
    const wrapper = mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: {
          type: 'collapse',
          groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }]
        }
      }
    })
    const headers = wrapper.findAll('.ant-collapse-header').map((n) => n.text())
    expect(headers).toEqual(['基本信息', '联系方式'])
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(3)
  })

  it('steps 只渲染当前组，下一步能切到下一组', async () => {
    const wrapper = mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: {
          type: 'steps',
          groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }]
        }
      }
    })
    expect(wrapper.findAll('.ant-steps-item')).toHaveLength(2)
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)
    const nav = wrapper.findAll('.es-form-groups__nav button')
    expect(nav).toHaveLength(2)
    expect(nav[0].attributes('disabled')).toBeDefined()

    await nav[1].trigger('click')
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(2)
  })
})
