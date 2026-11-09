/**
 * Ant Design Vue 适配器 — EsForm 嵌套对象字段（P1-3 第二期）接线测试。
 *
 * 断言的是渲染层接线：容器只画标题行、子字段 `name` 是 ADV 需要的路径数组、
 * 空容器不渲染。摊平规则本身由 core `form-nested.spec.ts` 覆盖。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { FormItem as AFormItem, Input as AInput } from 'ant-design-vue'

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

const addressField = {
  prop: 'address',
  label: '地址',
  children: [
    { prop: 'city', label: '城市', formtype: 'Input' },
    { prop: 'street', label: '街道', formtype: 'Input' }
  ]
}

describe('EsForm(ADV) - 嵌套对象字段（P1-3 第二期）', () => {
  it('容器只渲染标题行；子字段 name 为路径数组', () => {
    const wrapper = mountForm({ formItemList: [addressField] })

    const titles = wrapper.findAll('.es-form__nested-title')
    expect(titles).toHaveLength(1)
    expect(titles[0].text()).toBe('地址')

    const items = wrapper.findAllComponents(AFormItem)
    expect(items).toHaveLength(2)
    expect(items.map((it) => it.props('name'))).toEqual([
      ['address', 'city'],
      ['address', 'street']
    ])
  })

  it('子字段绑定 model 上的嵌套值', () => {
    const wrapper = mountForm({
      model: { address: { city: '杭州', street: '文三路' } },
      formItemList: [addressField]
    })
    const values = wrapper.findAllComponents(AInput).map((n) => n.props('value'))
    expect(values).toEqual(['杭州', '文三路'])
  })

  it('model 缺少容器对象时自动补空对象，ADV 的 strict 路径解析不告警', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const model: Record<string, unknown> = {}
    mountForm({ model, formItemList: [addressField] })

    expect(model.address).toEqual({})
    expect(error.mock.calls.filter((c) => String(c[0]).includes('valid name path'))).toHaveLength(0)
    error.mockRestore()
  })

  it('子字段全部隐藏时标题行一并消失', () => {
    const wrapper = mountForm({
      formItemList: [
        {
          prop: 'address',
          label: '地址',
          children: [
            { prop: 'city', label: '城市', formtype: 'Input', isHidden: { field: 'city', op: 'empty' } }
          ]
        }
      ]
    })
    expect(wrapper.findAll('.es-form__nested-title')).toHaveLength(0)
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(0)
  })
})
