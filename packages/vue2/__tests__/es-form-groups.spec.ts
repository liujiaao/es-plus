/**
 * Vue 2 适配器 — EsForm 分组容器（P1-3 第一期）接线测试。
 *
 * 与 es-form.spec.ts 同因：不加载真实 element-ui（CJS require 会拿到根部 vue@3），
 * 用同 prop 契约的桩组件，断言「我们把哪些容器 / 字段传给了底座组件」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import Vue from 'vue'
import EsForm from '../src/components/es-form/es-form.vue'

const passthrough = (name: string, props: Record<string, unknown>, extraClass?: string) => ({
  name,
  props,
  render(this: any, h: any) {
    return h('div', { class: extraClass ? `${name} ${extraClass}` : name }, this.$slots?.default)
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
  Vue.component('ElFormItem', passthrough('ElFormItem', { prop: String, label: String, required: Boolean, rules: [Array, Object] }))
  Vue.component('ElInput', passthrough('ElInput', { value: { default: undefined }, disabled: Boolean, placeholder: String }))
  Vue.component('ElButton', {
    props: { type: String, size: String, disabled: Boolean, icon: String },
    render(this: any, h: any) {
      // 真实 element-ui 的按钮是原生 click → $emit('click')，桩保持同一语义
      return h(
        'div',
        { class: 'ElButton', on: { click: (e: unknown) => this.$emit('click', e) } },
        this.$slots?.default
      )
    },
  })
  Vue.component('ElTabs', passthrough('ElTabs', { value: { default: '' } }))
  Vue.component('ElTabPane', {
    props: { label: { type: String, default: undefined }, name: { type: String, default: undefined } },
    render(this: any, h: any) {
      return h('div', { class: 'ElTabPane', attrs: { 'data-label': this.label, 'data-name': this.name } }, this.$slots?.default)
    },
  })
  Vue.component('ElCollapse', passthrough('ElCollapse', { value: { type: [Array, String], default: () => [] } }))
  Vue.component('ElCollapseItem', {
    props: { title: { type: String, default: undefined }, name: { type: String, default: undefined } },
    render(this: any, h: any) {
      return h('div', { class: 'ElCollapseItem', attrs: { 'data-title': this.title } }, this.$slots?.default)
    },
  })
  Vue.component('ElSteps', passthrough('ElSteps', { active: Number, alignCenter: Boolean }))
  Vue.component('ElStep', {
    props: { title: { type: String, default: undefined }, description: { type: String, default: undefined } },
    render(this: any, h: any) {
      return h('div', { class: 'ElStep' }, this.title)
    },
  })
})

const mountForm = (props: Record<string, unknown> = {}) =>
  new Vue({
    render: (h: any) => h(EsForm, { props: { model: {}, formItemList: [], ...props } }),
  }).$mount()

const fields = [
  { prop: 'name', label: '姓名', formtype: 'Input', group: 'basic' },
  { prop: 'phone', label: '电话', formtype: 'Input', group: 'contact' },
  { prop: 'email', label: '邮箱', formtype: 'Input', group: 'contact' },
]

describe('EsForm(vue2) - 分组容器', () => {
  it('未配置 layout 时不出现容器，字段仍在同一个 el-row 里', () => {
    const vm = mountForm({ formItemList: fields.map(({ group, ...rest }) => rest) })
    expect(vm.$el.querySelectorAll('.ElTabs').length).toBe(0)
    expect(vm.$el.querySelectorAll('.ElCollapse').length).toBe(0)
    expect(vm.$el.querySelectorAll('.ElSteps').length).toBe(0)
    expect(vm.$el.querySelectorAll('.ElRow').length).toBe(1)
    expect(vm.$el.querySelectorAll('.ElFormItem').length).toBe(3)
  })

  it('tabs：按声明顺序渲染页签，未分组字段落进「其他」', () => {
    const vm = mountForm({
      formItemList: [...fields, { prop: 'remark', label: '备注', formtype: 'Input' }],
      layoutFormProps: {
        layout: { type: 'tabs', groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }] },
      },
    })
    const panes = Array.from(vm.$el.querySelectorAll('.ElTabPane')) as HTMLElement[]
    expect(panes.map((p) => p.getAttribute('data-label'))).toEqual(['基本信息', '联系方式', '其他'])
    expect(vm.$el.querySelectorAll('.ElFormItem').length).toBe(4)
  })

  it('collapse：缺省全部展开，面板标题按声明解析', () => {
    const vm = mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: { type: 'collapse', groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }] },
      },
    })
    const items = Array.from(vm.$el.querySelectorAll('.ElCollapseItem')) as HTMLElement[]
    expect(items.map((n) => n.getAttribute('data-title'))).toEqual(['基本信息', '联系方式'])
    expect(vm.$el.querySelectorAll('.ElFormItem').length).toBe(3)
  })

  it('steps：只渲染当前组，下一步能切到下一组', async () => {
    const vm = mountForm({
      formItemList: fields,
      layoutFormProps: {
        layout: { type: 'steps', groups: [{ key: 'basic', label: '基本信息' }, { key: 'contact', label: '联系方式' }] },
      },
    })
    expect(vm.$el.querySelectorAll('.ElStep').length).toBe(2)
    expect(vm.$el.querySelectorAll('.ElFormItem').length).toBe(1)
    const nav = vm.$el.querySelectorAll('.es-form-groups__nav .ElButton') as NodeListOf<HTMLElement>
    expect(nav.length).toBe(2)
    nav[1].click()
    await vm.$nextTick()
    expect(vm.$el.querySelectorAll('.ElFormItem').length).toBe(2)
  })

  it('分组生效时隐藏折叠按钮', () => {
    const vm = mountForm({
      formItemList: fields,
      configBtn: [{ name: '查询', key: 'query' }],
      layoutFormProps: {
        rowLayProps: {},
        formLayProps: { minFoldRows: 1 },
        layout: { type: 'tabs' },
      },
    })
    expect(vm.$el.querySelectorAll('.ElTabs').length).toBe(1)
    expect(vm.$el.textContent).not.toContain('展开')
  })
})
