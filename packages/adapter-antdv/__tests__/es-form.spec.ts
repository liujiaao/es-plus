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

// 回归：ADV 的 getNamePath 不拆分 'user.name'，此前整串当单键读 model['user.name']
// → 嵌套字段能输入、校验必错。改为数组 name path 后测试才成立。
describe('EsForm(ADV) - 嵌套 prop 校验', () => {
  it('item.prop "user.name" 以数组 name path 传给 a-form-item', () => {
    const wrapper = mountForm({
      model: { user: { name: '' } },
      formItemList: [{ prop: 'user.name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(firstItem(wrapper).props('name')).toEqual(['user', 'name'])
  })

  it('嵌套字段 required + 空值 → 校验失败（不再因读错路径而必错/漏检）', async () => {
    const wrapper = mountForm({
      model: { user: { name: '' } },
      formItemList: [{ prop: 'user.name', label: '姓名', formtype: 'Input', span: 24, required: true }]
    })
    await expect(wrapper.vm.validate()).rejects.toBeTruthy()
  })

  it('嵌套字段 required + 有值 → 校验通过', async () => {
    const wrapper = mountForm({
      model: { user: { name: '张三' } },
      formItemList: [{ prop: 'user.name', label: '姓名', formtype: 'Input', span: 24, required: true }]
    })
    // ADV validate() resolve 的是表单值对象（非布尔），只断言不 reject
    await expect(wrapper.vm.validate()).resolves.toBeTruthy()
  })

  // 回归：schema 明确支持 `prop: 'a[0].b'`（core getNestedValue 按 /\.|\[|\]/ 分词）。
  // 只按 '.' 切分会得到 ['a[0]','b']，ADV 读 model['a[0]'] → undefined，校验必错。
  it('item.prop "a[0].b" 以数组 name path 传给 a-form-item（方括号写法）', () => {
    const wrapper = mountForm({
      model: { a: [{ b: '' }] },
      formItemList: [{ prop: 'a[0].b', label: '项', formtype: 'Input', span: 24 }]
    })
    expect(firstItem(wrapper).props('name')).toEqual(['a', '0', 'b'])
  })

  it('方括号嵌套字段 required：空值校验失败、有值通过', async () => {
    const empty = mountForm({
      model: { a: [{ b: '' }] },
      formItemList: [{ prop: 'a[0].b', label: '项', formtype: 'Input', span: 24, required: true }]
    })
    await expect(empty.vm.validate()).rejects.toBeTruthy()

    const filled = mountForm({
      model: { a: [{ b: 'x' }] },
      formItemList: [{ prop: 'a[0].b', label: '项', formtype: 'Input', span: 24, required: true }]
    })
    await expect(filled.vm.validate()).resolves.toBeTruthy()
  })
})

// 回归：item 级 name 改数组 path 后，form 级扁平键必须仍能匹配，
// 故绑定给 <a-form> 前把 'user.name' 展开为嵌套 { user: { name: [...] } }。
describe('EsForm(ADV) - 嵌套 form 级规则', () => {
  it("全局规则扁平键 'user.name' 展开为嵌套并生效", async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({
        EsForm: { rules: { 'user.name': [{ required: true, message: '姓名必填' }] } }
      })
      const wrapper = mountForm({
        model: { user: { name: '' } },
        formItemList: [{ prop: 'user.name', label: '姓名', formtype: 'Input', span: 24 }]
      })
      const aForm = wrapper.findComponent({ name: 'AForm' })
      expect(aForm.props('rules')).toEqual({
        user: { name: [{ required: true, message: '姓名必填' }] }
      })
      await expect(wrapper.vm.validate()).rejects.toBeTruthy()
    } finally {
      resetGlobalConfig()
    }
  })

  it('扁平字段规则不受嵌套展开影响', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ EsForm: { rules: { name: [{ required: true, message: '姓名必填' }] } } })
      const wrapper = mountForm({
        model: { name: '' },
        formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
      })
      const aForm = wrapper.findComponent({ name: 'AForm' })
      expect(aForm.props('rules')).toEqual({ name: [{ required: true, message: '姓名必填' }] })
      await expect(wrapper.vm.validate()).rejects.toBeTruthy()
    } finally {
      resetGlobalConfig()
    }
  })

  it("方括号扁平键 'a[0].b' 同样展开为嵌套规则", async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ EsForm: { rules: { 'a[0].b': [{ required: true, message: '必填' }] } } })
      const wrapper = mountForm({
        model: { a: [{ b: '' }] },
        formItemList: [{ prop: 'a[0].b', label: '项', formtype: 'Input', span: 24 }]
      })
      const aForm = wrapper.findComponent({ name: 'AForm' })
      expect(aForm.props('rules')).toEqual({ a: { '0': { b: [{ required: true, message: '必填' }] } } })
      await expect(wrapper.vm.validate()).rejects.toBeTruthy()
    } finally {
      resetGlobalConfig()
    }
  })
})
