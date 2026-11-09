/**
 * Vue 2 适配器 — EsForm 嵌套对象字段（P1-3 第二期）接线测试。
 *
 * 与 es-form-groups.spec.ts 同因：不加载真实 element-ui，用同 prop 契约的桩组件，
 * 断言「容器标题行只画标题、子字段绑定到绝对嵌套路径」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import Vue from 'vue'
import EsForm from '../src/components/es-form/es-form.vue'

const passthrough = (name: string, props: Record<string, unknown>) => ({
  name,
  props,
  render(this: any, h: any) {
    return h('div', { class: name }, this.$slots?.default)
  },
})

beforeAll(() => {
  Vue.component('ElForm', {
    props: { model: Object, rules: Object, size: String, labelWidth: String },
    render(this: any, h: any) {
      return h('form', { class: 'ElForm' }, this.$slots?.default)
    },
  })
  Vue.component('ElRow', passthrough('ElRow', { gutter: Number, type: String, justify: String, align: String }))
  Vue.component('ElCol', passthrough('ElCol', { span: Number }))
  Vue.component('ElFormItem', {
    props: { prop: { type: String, default: undefined }, label: { type: String, default: undefined } },
    render(this: any, h: any) {
      return h('div', { class: 'ElFormItem', attrs: { 'data-prop': this.prop } }, this.$slots?.default)
    },
  })
  Vue.component('ElInput', {
    props: { value: { default: undefined }, disabled: Boolean, placeholder: { type: String, default: undefined } },
    render(this: any, h: any) {
      return h('input', { class: 'ElInput', attrs: { 'data-value': this.value } })
    },
  })
  Vue.component('ElButton', {
    props: { type: String, size: String, disabled: Boolean, icon: String },
    render(this: any, h: any) {
      return h('div', { class: 'ElButton' }, this.$slots?.default)
    },
  })
})

const mountForm = (props: Record<string, unknown> = {}) =>
  new Vue({
    render: (h: any) => h(EsForm, { props: { model: {}, formItemList: [], ...props } }),
  }).$mount()

const addressField = {
  prop: 'address',
  label: '地址',
  children: [
    { prop: 'city', label: '城市', formtype: 'Input' },
    { prop: 'street', label: '街道', formtype: 'Input' },
  ],
}

const formItemProps = (vm: Vue) =>
  Array.from(vm.$el.querySelectorAll('.ElFormItem')).map((n) => n.getAttribute('data-prop'))

describe('EsForm(vue2) - 嵌套对象字段（P1-3 第二期）', () => {
  it('容器只渲染标题行，不渲染输入控件；子字段 prop 为绝对路径', () => {
    const vm = mountForm({ formItemList: [addressField] })
    const titles = vm.$el.querySelectorAll('.es-form__nested-title')
    expect(titles.length).toBe(1)
    expect(titles[0].textContent?.trim()).toBe('地址')
    expect(formItemProps(vm)).toEqual(['address.city', 'address.street'])
  })

  it('子字段绑定 model 上的嵌套值', () => {
    const vm = mountForm({
      model: { address: { city: '杭州', street: '文三路' } },
      formItemList: [addressField],
    })
    const values = Array.from(vm.$el.querySelectorAll('.ElInput')).map((n) => n.getAttribute('data-value'))
    expect(values).toEqual(['杭州', '文三路'])
  })

  it('子字段全部隐藏时标题行一并消失', () => {
    const vm = mountForm({
      formItemList: [
        {
          prop: 'address',
          label: '地址',
          children: [
            { prop: 'city', label: '城市', formtype: 'Input', isHidden: { field: 'city', op: 'empty' } },
          ],
        },
      ],
    })
    expect(vm.$el.querySelectorAll('.es-form__nested-title').length).toBe(0)
    expect(formItemProps(vm)).toEqual([])
  })
})
