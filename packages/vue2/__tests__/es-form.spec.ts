/**
 * Vue 2 适配器 — EsForm 组件挂载测试
 *
 * 覆盖 composable 单测覆盖不到的那一层：**接线** ——
 * required / rules 是否真的从表单项配置注入到了 el-form-item 上。
 *
 * ## 为什么用桩组件而不是真实的 element-ui
 *
 * element-ui 被 hoist 到仓库根目录，而它内部是用 CJS `require('vue')` 取 Vue 的
 * （`element-ui/lib/utils/types.js:12`）—— 该 require 解析到的是**根部的 vue@3.5**，
 * 不是本包的 vue@2.7.16（后者在 packages/vue2/node_modules）。版本错配会让 element-ui
 * 在模块初始化时就崩：`Cannot read properties of undefined (reading 'prototype')`。
 * 试过 vite `resolve.alias` 与 `server.deps.inline`，都按不住它内部的 CJS require。
 *
 * 因此这里注册**与 Element UI 同 prop 契约的桩组件**，只声明本包需要打交道的那些 prop。
 * 断言的是「我们把哪些值传给了 el-form-item 这个组件」—— 即本包自己要保住的接线契约。
 * Element UI 内部如何消费这些值，由 __tests__/e2e-runtime 的真实浏览器 harness 覆盖。
 *
 * 优先级契约（与 @es-plus/vue3 / adapter-antdv 一致）：
 *   formItemOptions.required / .rules  >  item.required / item.rules
 */
import { describe, it, expect, beforeAll } from 'vitest'
import Vue from 'vue'
import EsForm from '../src/components/es-form/es-form.vue'

const passthrough = (name: string, props: Record<string, unknown>) => ({
  name,
  props,
  render(this: any, h: any) {
    return h('div', { class: name }, this.$slots?.default)
  }
})

beforeAll(() => {
  // el-form-item 的 prop 契约对齐 element-ui/lib/form/src/form-item.vue
  Vue.component(
    'ElFormItem',
    passthrough('ElFormItem', {
      prop: { type: String, default: undefined },
      label: { type: String, default: undefined },
      required: { type: Boolean, default: undefined },
      rules: { type: [Array, Object], default: undefined },
      labelWidth: { type: String, default: undefined },
      error: { type: String, default: undefined },
      validateStatus: { type: String, default: undefined },
      showMessage: { type: Boolean, default: true },
      inlineMessage: { type: Boolean, default: false },
      size: { type: String, default: undefined }
    })
  )
  Vue.component(
    'ElForm',
    passthrough('ElForm', {
      model: { type: Object, default: undefined },
      rules: { type: Object, default: undefined },
      inline: { type: Boolean, default: false },
      labelWidth: { type: String, default: undefined },
      labelPosition: { type: String, default: undefined },
      size: { type: String, default: undefined },
      showMessage: { type: Boolean, default: true }
    })
  )
  Vue.component('ElRow', passthrough('ElRow', { gutter: Number, type: String, justify: String, align: String, tag: String }))
  Vue.component('ElCol', passthrough('ElCol', { span: Number, offset: Number, push: Number, pull: Number, tag: String }))
  Vue.component(
    'ElButton',
    passthrough('ElButton', {
      type: String, size: String, icon: String, disabled: Boolean,
      loading: Boolean, plain: Boolean, round: Boolean, circle: Boolean, link: Boolean
    })
  )
  // el-input 桩：把透传属性落到原生 input 上，便于断言顶层快捷字段是否真的到达控件。
  Vue.component('ElInput', {
    name: 'ElInput',
    inheritAttrs: false,
    render(this: any, h: any) {
      return h('input', { attrs: this.$attrs })
    }
  })
})

function mountForm(props: Record<string, unknown> = {}): any {
  return new Vue({
    render: (h) => h(EsForm as any, { props: { model: {}, formItemList: [], ...props } })
  }).$mount()
}

/** 深度优先按组件 name 查找实例 */
function findByName(vm: any, name: string): any {
  for (const child of vm.$children || []) {
    if (child.$options?.name === name) return child
    const found = findByName(child, name)
    if (found) return found
  }
  return null
}

const firstItem = (vm: any) => findByName(vm, 'ElFormItem')

describe('EsForm(vue2) - 基础渲染', () => {
  it('按 formItemList 渲染出 el-form-item', () => {
    const vm = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(firstItem(vm)).toBeTruthy()
  })
})

describe('EsForm(vue2) - item 级校验 required / rules 注入', () => {
  it('item.required 注入到 el-form-item', () => {
    const vm = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24, required: true }]
    })
    expect(firstItem(vm).$props.required).toBe(true)
  })

  it('item.rules 注入到 el-form-item', () => {
    const rules = [{ min: 3, message: '至少 3 个字符' }]
    const vm = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24, rules }]
    })
    expect(firstItem(vm).$props.rules).toEqual(rules)
  })

  it('formItemOptions.required 优先于 item.required', () => {
    const vm = mountForm({
      model: { name: '' },
      formItemList: [
        {
          prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          required: false,
          formItemOptions: { required: true }
        }
      ]
    })
    expect(firstItem(vm).$props.required).toBe(true)
  })

  it('formItemOptions.rules 优先于 item.rules', () => {
    const optsRules = [{ max: 10 }]
    const vm = mountForm({
      model: { name: '' },
      formItemList: [
        {
          prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          rules: [{ min: 3 }],
          formItemOptions: { rules: optsRules }
        }
      ]
    })
    expect(firstItem(vm).$props.rules).toEqual(optsRules)
  })

  it('注入不覆盖 formItemOptions 的其他键', () => {
    const vm = mountForm({
      model: { name: '' },
      formItemList: [
        {
          prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          required: true,
          formItemOptions: { labelWidth: '80px' }
        }
      ]
    })
    expect(firstItem(vm).$props.labelWidth).toBe('80px')
    expect(firstItem(vm).$props.required).toBe(true)
  })

  it('未配置时不注入空值', () => {
    const vm = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(firstItem(vm).$props.required).toBeUndefined()
    expect(firstItem(vm).$props.rules).toBeUndefined()
  })
})

describe('EsForm(vue2) - form 级规则（全局配置兜底）', () => {
  it('全局 EsForm.rules 兜底，组件 props.rules 同名字段优先', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    const localAge = [{ min: 18, message: '未成年' }]
    try {
      configureEsPlus({
        EsForm: { rules: { name: [{ required: true, message: '姓名必填' }], age: [{ min: 1 }] } }
      })
      const vm = mountForm({
        model: { name: '', age: '' },
        formItemList: [
          { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
          { prop: 'age', label: '年龄', formtype: 'Input', span: 24 }
        ],
        rules: { age: localAge }
      })
      const form = findByName(vm, 'ElForm')
      const formRules = form.$props.rules as Record<string, unknown>
      expect(formRules.age).toEqual(localAge)
      expect(formRules.name).toEqual([{ required: true, message: '姓名必填' }])
    } finally {
      resetGlobalConfig()
    }
  })
})

describe('EsForm(vue2) - 顶层快捷字段注入（placeholder / disabled）', () => {
  // 回归：顶层快捷字段此前三端全部静默丢弃
  it('顶层 placeholder / disabled 透传到 Input 控件', () => {
    const vm = mountForm({
      model: { name: '' },
      formItemList: [{
        prop: 'name', label: '姓名', formtype: 'Input', span: 24,
        placeholder: '请输入姓名', disabled: true
      }]
    })
    const input = findByName(vm, 'ElInput')
    expect(input).toBeTruthy()
    expect(input.$el.getAttribute('placeholder')).toBe('请输入姓名')
    expect(input.$el.hasAttribute('disabled')).toBe(true)
  })
})
