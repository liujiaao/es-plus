/**
 * Ant Design Vue 适配器 — EsForm 组件挂载测试
 *
 * 覆盖 use-form-inputs 单测覆盖不到的那一层：**接线** ——
 * required / rules 是否真的从表单项配置注入到了 a-form-item 上。
 *
 * 优先级契约（与 @es-plus/vue3 一致）：
 *   formItemOptions.required / .rules  >  item.required / item.rules
 * （低层逃生舱优先，与 attrs > placeholder/clearable/disabled 同构）
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { FormItem as AFormItem, Input as AInput } from 'ant-design-vue'

// 屏蔽重依赖：EsForm 会 import es-table 与 use-dialog，与 ESLint/单测无关，
// 但在 happy-dom 下加载真实实现代价高且会带出循环依赖。
vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: { model: {}, formItemList: [], ...props }
  })

const firstItem = (wrapper: ReturnType<typeof mountForm>) => wrapper.findComponent(AFormItem)

describe('EsForm(ADV) - 基础渲染', () => {
  it('按 formItemList 渲染出 a-form-item', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)
  })
})

describe('EsForm(ADV) - item 级校验 required / rules 注入', () => {
  it('item.required 注入到 a-form-item', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24, required: true }]
    })
    expect(firstItem(wrapper).props('required')).toBe(true)
  })

  it('item.rules 注入到 a-form-item', () => {
    const rules = [{ min: 3, message: '至少 3 个字符' }]
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24, rules }]
    })
    expect(firstItem(wrapper).props('rules')).toEqual(rules)
  })

  it('formItemOptions.required 优先于 item.required', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [
        {
          prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          required: false,
          formItemOptions: { required: true }
        }
      ]
    })
    expect(firstItem(wrapper).props('required')).toBe(true)
  })

  it('formItemOptions.rules 优先于 item.rules', () => {
    const optsRules = [{ max: 10 }]
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [
        {
          prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          rules: [{ min: 3 }],
          formItemOptions: { rules: optsRules }
        }
      ]
    })
    expect(firstItem(wrapper).props('rules')).toEqual(optsRules)
  })

  it('注入不覆盖 formItemOptions 的其他键', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [
        {
          prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          required: true,
          formItemOptions: { labelCol: { span: 4 } }
        }
      ]
    })
    expect(firstItem(wrapper).props('labelCol')).toEqual({ span: 4 })
    expect(firstItem(wrapper).props('required')).toBe(true)
  })

  it('未配置时不注入空值', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(firstItem(wrapper).props('required')).toBeUndefined()
    expect(firstItem(wrapper).props('rules')).toBeUndefined()
  })
})

describe('EsForm(ADV) - form 级规则（全局配置兜底）', () => {
  it('全局 EsForm.rules 兜底，组件 props.rules 同名字段优先', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    const localAge = [{ min: 18, message: '未成年' }]
    try {
      configureEsPlus({
        EsForm: { rules: { name: [{ required: true, message: '姓名必填' }], age: [{ min: 1 }] } }
      })
      const wrapper = mountForm({
        model: { name: '', age: '' },
        formItemList: [
          { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
          { prop: 'age', label: '年龄', formtype: 'Input', span: 24 }
        ],
        rules: { age: localAge }
      })
      // a-form 的 rules 通过 formProps 绑定，直接读组件 props
      const aForm = wrapper.findComponent({ name: 'AForm' })
      const formRules = aForm.props('rules') as Record<string, unknown>
      expect(formRules.age).toEqual(localAge)
      expect(formRules.name).toEqual([{ required: true, message: '姓名必填' }])
    } finally {
      resetGlobalConfig()
    }
  })
})

describe('EsForm(ADV) - 顶层快捷字段注入（placeholder / disabled）', () => {
  // 回归：顶层快捷字段此前三端全部静默丢弃
  it('顶层 placeholder / disabled 透传到 Input 控件', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{
        prop: 'name', label: '姓名', formtype: 'Input', span: 24,
        placeholder: '请输入姓名', disabled: true
      }]
    })
    const input = wrapper.findComponent(AInput)
    expect(input.exists()).toBe(true)
    expect(input.props('placeholder')).toBe('请输入姓名')
    expect(input.props('disabled')).toBe(true)
  })
})
