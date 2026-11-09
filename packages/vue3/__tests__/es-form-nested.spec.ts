/**
 * P1-3 第二期：嵌套对象字段（一层）—— vue3 渲染层见证。
 *
 * 断言的是「接线」：容器只画标题行、子字段绑定到绝对嵌套路径、空容器不渲染。
 * prop 解析 / 摊平规则本身由 core `form-nested.spec.ts` 覆盖。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton } from 'element-plus'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const globalComponents = { ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton }

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: { model: {}, formItemList: [], ...props },
    global: { components: globalComponents }
  })

const addressField = {
  prop: 'address',
  label: '地址',
  children: [
    { prop: 'city', label: '城市', formtype: 'Input' },
    { prop: 'street', label: '街道', formtype: 'Input' }
  ]
}

describe('EsForm - 嵌套对象字段（P1-3 第二期）', () => {
  it('容器只渲染标题行，不渲染输入控件；子字段 prop 为绝对路径', () => {
    const wrapper = mountForm({ formItemList: [addressField] })

    const titles = wrapper.findAll('.es-form__nested-title')
    expect(titles).toHaveLength(1)
    expect(titles[0].text()).toBe('地址')

    const items = wrapper.findAllComponents(ElFormItem)
    expect(items).toHaveLength(2)
    expect(items.map((it) => it.props('prop'))).toEqual(['address.city', 'address.street'])
  })

  it('子字段绑定 model 上的嵌套值', () => {
    const wrapper = mountForm({
      model: { address: { city: '杭州', street: '文三路' } },
      formItemList: [addressField]
    })
    const inputs = wrapper.findAll('input').map((n) => (n.element as HTMLInputElement).value)
    expect(inputs).toEqual(['杭州', '文三路'])
  })

  it('子字段绝对路径不重复拼接', () => {
    const wrapper = mountForm({
      formItemList: [
        {
          prop: 'address',
          label: '地址',
          children: [{ prop: 'address.city', label: '城市', formtype: 'Input' }]
        }
      ]
    })
    expect(wrapper.findAllComponents(ElFormItem).map((it) => it.props('prop'))).toEqual(['address.city'])
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
    // 条件成立（city 为空）→ 字段隐藏 → 容器没有可渲染的子字段
    expect(wrapper.findAll('.es-form__nested-title')).toHaveLength(0)
    expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(0)
  })

  it('嵌套容器与普通字段共存：普通字段仍走顶层 auto-span', () => {
    const wrapper = mountForm({
      formItemList: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        addressField
      ]
    })
    expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(3)
    expect(wrapper.findAll('.es-form__nested-title')).toHaveLength(1)
  })
})
