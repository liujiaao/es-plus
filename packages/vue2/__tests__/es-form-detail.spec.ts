/**
 * Vue 2 — EsForm 详情（只读）模式。
 *
 * 用最小桩组件挂载（element-ui 的 CJS require 会解析到根部 vue@3，不能真装，
 * 见 es-form.spec.ts 头注）。详情模式不渲染输入控件，这正是本文件要断言的接线：
 * 同一个 formItemList 在 edit / detail 下标签与栅格不变，值变成文本。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import Vue from 'vue'
import { VALID_FORM_TYPES } from '@es-plus/core'
import EsForm from '../src/components/es-form/es-form.vue'

const passthrough = (name: string, props: Record<string, unknown>) => ({
  name,
  props,
  render(this: any, h: any) {
    return h('div', { class: name }, this.$slots?.default)
  },
})

beforeAll(() => {
  Vue.component('ElForm', passthrough('ElForm', { model: Object, rules: Object, inline: Boolean }))
  Vue.component(
    'ElFormItem',
    passthrough('ElFormItem', {
      prop: { type: String, default: undefined },
      label: { type: String, default: undefined },
      required: { type: Boolean, default: undefined },
      rules: { type: [Array, Object], default: undefined },
      labelWidth: { type: String, default: undefined },
    }),
  )
  Vue.component('ElRow', passthrough('ElRow', { gutter: Number, type: String, justify: String, align: String, tag: String }))
  Vue.component('ElCol', passthrough('ElCol', { span: Number, offset: Number, push: Number, pull: Number, tag: String }))
  Vue.component('ElButton', passthrough('ElButton', { type: String, size: String, icon: String, disabled: Boolean, loading: Boolean, plain: Boolean, round: Boolean, circle: Boolean, link: Boolean }))
  // 编辑模式对照用例会渲染一次输入控件；桩只负责让 el-input 可控，能断言它出现在 edit 而消失于 detail
  Vue.component('ElInput', {
    name: 'ElInput',
    inheritAttrs: false,
    render(this: any, h: any) {
      return h('input', { attrs: this.$attrs })
    },
  })
})

function mountForm(props: Record<string, unknown> = {}): any {
  return new Vue({
    render: (h) => h(EsForm as any, { props: { model: {}, formItemList: [], ...props } }),
  }).$mount()
}

const detailTexts = (vm: any): string[] =>
  Array.from(vm.$el.querySelectorAll('.es-form-detail__text') as NodeListOf<HTMLElement>).map((n) => n.textContent || '')

describe('EsForm(vue2) detail 模式', () => {
  it('14 种控件都渲染成文本，DOM 里没有 input / textarea / select', () => {
    const formItemList = VALID_FORM_TYPES.map((formtype, i) => ({
      prop: `f${i}`,
      label: formtype,
      formtype,
      span: 24,
    }))
    const model = Object.fromEntries(formItemList.map((it, i) => [it.prop, `值${i}`]))
    const vm = mountForm({ mode: 'detail', model, formItemList })

    expect(vm.$el.classList.contains('es-form--detail')).toBe(true)
    expect(detailTexts(vm)).toHaveLength(VALID_FORM_TYPES.length)
    expect(vm.$el.querySelector('input')).toBeNull()
    expect(vm.$el.querySelector('textarea')).toBeNull()
    expect(vm.$el.querySelector('select')).toBeNull()
  })

  it('dataOptions 映射标签、空值走占位符', () => {
    const vm = mountForm({
      mode: 'detail',
      model: { status: 1, remark: '' },
      formItemList: [
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
        },
        { prop: 'remark', label: '备注', formtype: 'Input', emptyPlaceholder: '暂无' },
      ],
    })
    expect(detailTexts(vm)).toEqual(['启用', '暂无'])
  })

  it('label 与栅格布局和编辑模式一致', () => {
    const formItemList = [{ prop: 'name', label: '姓名', formtype: 'Input', span: 12 }]
    const edit = mountForm({ model: { name: '张三' }, formItemList })
    const detail = mountForm({ mode: 'detail', model: { name: '张三' }, formItemList })
    expect(detail.$el.querySelectorAll('.ElFormItem')).toHaveLength(
      edit.$el.querySelectorAll('.ElFormItem').length,
    )
  })

  it('render 字段在 detail 下仍走自定义渲染', () => {
    const vm = mountForm({
      mode: 'detail',
      model: { extra: 'x' },
      formItemList: [
        {
          prop: 'extra',
          label: '扩展',
          render: (h: any) => h('b', { class: 'custom-render' }, '自定义内容'),
        },
      ],
    })
    expect(vm.$el.querySelector('.custom-render')?.textContent).toBe('自定义内容')
  })

  it('detail 下隐藏 triggerEvent 按钮，保留动作按钮', () => {
    const vm = mountForm({
      mode: 'detail',
      model: {},
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input' }],
      configBtn: [
        { name: '查询', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true },
        { name: '关闭', key: 'close' },
      ],
    })
    const text = vm.$el.textContent || ''
    expect(text).toContain('关闭')
    expect(text).not.toContain('查询')
    expect(text).not.toContain('重置')
  })
})
