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
import { nextTick, reactive } from 'vue'
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

// 回归：字段级 permissionValue 此前 schema+prompt+scorer 都认，组件 formItemListFilter 却只按
// isHidden 过滤 → 无权限的字段照样渲染（假承诺）。接线后应与 isHidden 同层被过滤。
describe('EsForm(ADV) - 字段级 permissionValue 门控', () => {
  const gateItems = () => [
    { prop: 'name', label: '姓名', formtype: 'Input' as const, span: 24 },
    { prop: 'salary', label: '工资', formtype: 'InputNumber' as const, span: 24, permissionValue: 'salary:view' },
  ]

  it('无权限的字段不渲染，有权限的字段正常渲染', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ permission: (v: string) => v !== 'salary:view' })
      const wrapper = mountForm({ model: { name: '', salary: '' }, formItemList: gateItems() })
      expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)
      expect(wrapper.text()).toContain('姓名')
      expect(wrapper.text()).not.toContain('工资')
    } finally {
      resetGlobalConfig()
    }
  })

  it('未配置全局 permission 时一律放行', async () => {
    const wrapper = mountForm({ model: { name: '', salary: '' }, formItemList: gateItems() })
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(2)
  })
})

// AI-06：声明式 isHidden（纯 JSON 条件）在 ADV 端同样生效且随 model 反应 ——
// 组件层零逻辑改动，靠 core normalizeFormItem 在 formItemListFilter 里水合。
describe('EsForm(ADV) - 声明式 isHidden 条件（AI-06）', () => {
  const items = () => [
    { prop: 'swapType', label: '申请类型', formtype: 'Input' as const, span: 12 },
    {
      prop: 'swapReason',
      label: '调班原因',
      formtype: 'Input' as const,
      span: 12,
      isHidden: { field: 'swapType', op: 'eq', value: 'rotate' },
    },
  ]

  it('条件成立时隐藏，随 model 变化恢复显示', async () => {
    const model = reactive({ swapType: 'rotate', swapReason: '' })
    const wrapper = mountForm({ model, formItemList: items() })
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('调班原因')

    model.swapType = 'duty'
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(2)
    expect(wrapper.text()).toContain('调班原因')
  })

  it('条件数组（AND）全部成立才隐藏', async () => {
    const model = reactive({ a: 1, b: false })
    const wrapper = mountForm({
      model,
      formItemList: [
        {
          prop: 'note',
          label: '说明',
          formtype: 'Input' as const,
          span: 24,
          isHidden: [{ field: 'a', op: 'eq' as const, value: 1 }, { field: 'b', op: 'falsy' as const }],
        },
      ],
    })
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(0)

    model.b = true
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)
  })

  // AI-16：表达式形态（or / 序关系）同样由 core 单点求值，ADV 端零改动、随 model 联动。
  it('表达式条件（or / 序关系）在 ADV 端同样生效', async () => {
    const model = reactive({ status: 'pending', amount: 0, reason: '' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'status', label: '状态', formtype: 'Input' as const, span: 12 },
        {
          prop: 'reason',
          label: '原因',
          formtype: 'Input' as const,
          span: 12,
          isHidden: { or: [{ '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] }] },
        },
      ],
    })
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)

    model.status = 'done'
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(2)

    model.amount = 200
    await nextTick()
    expect(wrapper.findAllComponents(AFormItem)).toHaveLength(1)
  })
})

describe('EsForm(ADV) - AI-07 字段联动 reactions', () => {
  // 求值全在 core（packages/core/__tests__/reactions.spec.ts）；此处只钉 antdv 的接线：
  // overlay 合并进 formItemListFilter、值回写交给 model watcher。
  const dbl = async () => { await nextTick(); await nextTick() }

  it('required：依赖变化时动态改变必填态', async () => {
    const model = reactive({ city: '' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'city', label: '城市', formtype: 'Input', span: 24 },
        {
          prop: 'invoiceNo', label: '发票号', formtype: 'Input', span: 24,
          reactions: [{ dependencies: ['city'], fulfill: { required: { notEmpty: [{ var: 'city' }] } } }],
        },
      ],
    })
    await dbl()
    const items = () => wrapper.findAllComponents(AFormItem)
    expect(items()[1].props('required')).not.toBe(true)

    model.city = 'hz'
    await dbl()
    expect(items()[1].props('required')).toBe(true)
  })

  it('disabled：条件禁用透传到控件', async () => {
    const model = reactive({ accountType: 'system' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'accountType', label: '类型', formtype: 'Input', span: 24 },
        {
          prop: 'username', label: '账号名', formtype: 'Input', span: 24,
          reactions: [{ dependencies: ['accountType'], fulfill: { disabled: { '==': [{ var: 'accountType' }, 'system'] } } }],
        },
      ],
    })
    await dbl()
    const usernameDisabled = () => wrapper.findAllComponents(AInput).some((i) => i.props('disabled') === true)
    expect(usernameDisabled()).toBe(true)

    model.accountType = 'normal'
    await dbl()
    expect(usernameDisabled()).toBe(false)
  })

  it('值回写：依赖变化时写入目标字段，且不踩无关编辑', async () => {
    const model = reactive({ province: '', region: '', note: '' })
    mountForm({
      model,
      formItemList: [
        { prop: 'province', label: '省份', formtype: 'Input', span: 24 },
        { prop: 'note', label: '备注', formtype: 'Input', span: 24 },
        {
          prop: 'region', label: '大区', formtype: 'Input', span: 24,
          reactions: [{ dependencies: ['province'], fulfill: { value: { var: 'province' } } }],
        },
      ],
    })
    await dbl()
    expect(model.region).toBe('')

    model.region = 'manual'
    model.note = 'x'
    await dbl()
    expect(model.region).toBe('manual')

    model.province = 'zj'
    await dbl()
    expect(model.region).toBe('zj')
  })
})
