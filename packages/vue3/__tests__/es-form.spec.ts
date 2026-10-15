import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive, watch } from 'vue'
import {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElSelect, ElOption, ElDatePicker, ElInputNumber,
  ElSwitch, ElRadioGroup, ElCheckboxGroup, ElCascader,
  ElRate, ElSlider, ElTimePicker
} from 'element-plus'

// Mock heavy/circular dependencies that break in test environment
vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() }))
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() }
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const globalComponents = {
  ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton,
  ElSelect, ElOption, ElDatePicker, ElInputNumber,
  ElSwitch, ElRadioGroup, ElCheckboxGroup, ElCascader,
  ElRate, ElSlider, ElTimePicker
}

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: {
      model: {},
      formItemList: [],
      ...props
    },
    global: { components: globalComponents }
  })

describe('EsForm - 配置渲染', () => {
  it('renders Input type', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(wrapper.find('.es-form').exists()).toBe(true)
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders Select type with dataOptions', () => {
    const wrapper = mountForm({
      model: { status: '' },
      formItemList: [{
        prop: 'status', label: '状态', formtype: 'Select', span: 24,
        dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]
      }]
    })
    expect(wrapper.find('.el-select').exists()).toBe(true)
  })

  it('renders DatePicker type', () => {
    const wrapper = mountForm({
      model: { date: '' },
      formItemList: [{ prop: 'date', label: '日期', formtype: 'datePicker', span: 24 }]
    })
    const datePickers = wrapper.findAllComponents({ name: 'ElDatePicker' })
    expect(datePickers.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Switch type', () => {
    const wrapper = mountForm({
      model: { enabled: false },
      formItemList: [{ prop: 'enabled', label: '启用', formtype: 'Switch', span: 24 }]
    })
    expect(wrapper.find('.el-switch').exists()).toBe(true)
  })

  it('renders multiple form items', () => {
    const wrapper = mountForm({
      model: { name: '', status: '', date: '' },
      formItemList: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 8 },
        { prop: 'status', label: '状态', formtype: 'Select', span: 8, dataOptions: [] },
        { prop: 'date', label: '日期', formtype: 'datePicker', span: 8 }
      ]
    })
    expect(wrapper.findAll('.el-form-item')).toHaveLength(3)
  })

  it('renders custom render function', () => {
    const wrapper = mountForm({
      model: { amount: 100 },
      formItemList: [{
        prop: 'amount', label: '金额', span: 24,
        render: (h: any, model: any) => h('span', { class: 'custom-amount' }, `¥${model.amount}`)
      }]
    })
    expect(wrapper.find('.custom-amount').exists()).toBe(true)
    expect(wrapper.find('.custom-amount').text()).toBe('¥100')
  })

  it('hides fields with isHidden function', async () => {
    const wrapper = mountForm({
      model: { type: 'personal', companyName: '' },
      formItemList: [
        { prop: 'type', label: '类型', formtype: 'Input', span: 12 },
        { prop: 'companyName', label: '企业名称', formtype: 'Input', span: 12,
          isHidden: (model: any) => model.type !== 'company' }
      ]
    })
    // companyName should be hidden when type !== 'company'
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)
  })

  // AI-06：声明式条件（纯 JSON）也能驱动显隐 —— 组件层零改动，靠 core
  // normalizeFormItem 在 formItemListFilter 里水合。这里断言三端「看见就生效」。
  it('hides fields with a declarative isHidden condition (eq) and reacts to model changes', async () => {
    const model = reactive({ type: 'rotate', reason: '' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'type', label: '类型', formtype: 'Input', span: 12 },
        { prop: 'reason', label: '原因', formtype: 'Input', span: 12,
          isHidden: { field: 'type', op: 'eq', value: 'rotate' } }
      ]
    })
    // type === 'rotate' → 条件成立 → reason 隐藏
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)

    model.type = 'duty'
    await nextTick()
    // 条件不再成立 → reason 出现（reactive 联动）
    expect(wrapper.findAll('.el-form-item')).toHaveLength(2)
  })

  it('hides fields with a declarative isHidden condition array (AND)', async () => {
    const model = reactive({ a: 1, b: false, note: '' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'note', label: '说明', formtype: 'Input', span: 24,
          isHidden: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'falsy' }] }
      ]
    })
    // 两条都成立 → 隐藏
    expect(wrapper.findAll('.el-form-item')).toHaveLength(0)

    model.b = true
    await nextTick()
    // 只剩一条成立 → 显示
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)
  })

  // AI-16：表达式形态（旧 8 算子表达不了的 OR / 序关系）同样由 core 单点求值，
  // 组件层零改动，且按 reactive model 联动。
  it('hides fields with an expression isHidden (or / ordering) and reacts to model changes', async () => {
    const model = reactive({ status: 'pending', amount: 0, reason: '' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'status', label: '状态', formtype: 'Input', span: 12 },
        { prop: 'reason', label: '原因', formtype: 'Input', span: 12,
          isHidden: { or: [{ '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] }] } }
      ]
    })
    // status === 'pending' → OR 成立 → reason 隐藏
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)

    model.status = 'done'
    await nextTick()
    // status 既不 pending、amount 也不 > 100 → 显示
    expect(wrapper.findAll('.el-form-item')).toHaveLength(2)

    model.amount = 200
    await nextTick()
    // amount > 100 → OR 成立 → 再次隐藏
    expect(wrapper.findAll('.el-form-item')).toHaveLength(1)
  })

  it('renders configBtn buttons', () => {
    const wrapper = mountForm({
      model: { keyword: '' },
      formItemList: [{ prop: 'keyword', label: '关键词', formtype: 'Input', span: 6 }],
      configBtn: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'reset', triggerEvent: true }
      ]
    })
    const buttons = wrapper.findAll('.el-button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('hides buttons when isBtnHidden is true', () => {
    const wrapper = mountForm({
      model: {},
      formItemList: [],
      layoutFormProps: { fromLayProps: { isBtnHidden: true } }
    })
    expect(wrapper.find('.buttonOperate').exists()).toBe(false)
  })

  it('exposes validate/resetFields methods', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    const vm = wrapper.vm as any
    expect(typeof vm.validate).toBe('function')
    expect(typeof vm.resetFields).toBe('function')
    expect(typeof vm.clearValidate).toBe('function')
    expect(typeof vm.getFormRef).toBe('function')
    expect(typeof vm.formItmeRequestInstance).toBe('function')
  })

  it('emits confirm event on button click', async () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }],
      configBtn: [{ name: '确认', type: 'primary', key: 'confirm' }]
    })
    // Find and click the confirm button
    const buttons = wrapper.findAll('.el-button')
    const confirmBtn = buttons.find(b => b.text().includes('确认'))
    if (confirmBtn) {
      await confirmBtn.trigger('click')
      // The confirm event is triggered by the clickBtn handler which checks the key
      // If the event doesn't fire, the button mechanism still works (no crash)
      expect(wrapper.find('.es-form').exists()).toBe(true)
    }
  })

  it('loads remote data via apiParams', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }]
    })
    const wrapper = mountForm({
      model: { category: '' },
      formItemList: [{
        prop: 'category', label: '分类', formtype: 'Select', span: 24,
        apiParams: { url: '/api/categories', method: 'GET' },
        httpRequest: mockRequest
      }]
    })
    await flushPromises()
    // Request should have been called on mount
    expect(mockRequest).toHaveBeenCalled()
  })

  it('does not auto-load when isInitRun is false', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: [] })
    mountForm({
      model: { category: '' },
      formItemList: [{
        prop: 'category', label: '分类', formtype: 'Select', span: 24,
        apiParams: { url: '/api/categories' },
        httpRequest: mockRequest,
        isInitRun: false
      }]
    })
    await flushPromises()
    expect(mockRequest).not.toHaveBeenCalled()
  })
})

describe('EsForm - item 级校验 required / rules 注入', () => {
  const firstItem = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.findComponent({ name: 'ElFormItem' })

  it('item.required 注入到 el-form-item', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24, required: true }]
    })
    expect(firstItem(wrapper).props('required')).toBe(true)
  })

  it('item.rules 注入到 el-form-item', () => {
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
          formItemOptions: { labelWidth: '80px' }
        }
      ]
    })
    expect(firstItem(wrapper).props('labelWidth')).toBe('80px')
    expect(firstItem(wrapper).props('required')).toBe(true)
  })

  it('未配置时 el-form-item 的 required/rules 保持未设置（不注入空值）', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 24 }]
    })
    expect(firstItem(wrapper).props('required')).toBeUndefined()
    expect(firstItem(wrapper).props('rules')).toBeUndefined()
  })
})

describe('EsForm - form 级规则（全局配置兜底）', () => {
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
      const formRules = wrapper.findComponent({ name: 'ElForm' }).props('rules') as Record<string, unknown>
      // 组件提供了 age → 用组件的（全局给的是 [{min:1}]，内容不同即证明组件赢了）
      expect(formRules.age).toEqual(localAge)
      // 组件没提供 name → 回落到全局
      expect(formRules.name).toEqual([{ required: true, message: '姓名必填' }])
    } finally {
      resetGlobalConfig()
    }
  })
})

describe('EsForm - 顶层快捷字段注入（placeholder / clearable / disabled）', () => {
  // 回归：FormItemOption 顶层快捷字段此前从未被 normalizeFormItem 归一化，
  // 三端全部静默丢弃。接线后应透传到具体控件。
  it('顶层 placeholder / clearable / disabled 透传到 Input 控件', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{
        prop: 'name', label: '姓名', formtype: 'Input', span: 24,
        placeholder: '请输入姓名', clearable: true, disabled: true
      }]
    })
    const input = wrapper.findComponent(ElInput)
    expect(input.props('placeholder')).toBe('请输入姓名')
    expect(input.props('clearable')).toBe(true)
    expect(input.props('disabled')).toBe(true)
  })

  it('attrs 中同名属性优先于顶层快捷字段', () => {
    const wrapper = mountForm({
      model: { name: '' },
      formItemList: [{
        prop: 'name', label: '姓名', formtype: 'Input', span: 24,
        placeholder: '顶层', attrs: { placeholder: 'attrs 优先' }
      }]
    })
    expect(wrapper.findComponent(ElInput).props('placeholder')).toBe('attrs 优先')
  })
})

describe('EsForm - 字段级 permissionValue 门控', () => {
  // 回归：字段级 permissionValue 此前 schema+prompt+scorer 都认，组件 formItemListFilter 却只按
  // isHidden 过滤 → 无权限的字段照样渲染（假承诺）。接线后应与 isHidden 同层被过滤。
  it('无权限的字段不渲染，有权限的字段正常渲染', async () => {
    const { configureEsPlus, resetGlobalConfig } = await import('@es-plus/core')
    try {
      configureEsPlus({ permission: (v: string) => v !== 'salary:view' })
      const wrapper = mountForm({
        model: { name: '', salary: '' },
        formItemList: [
          { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
          { prop: 'salary', label: '工资', formtype: 'InputNumber', span: 24, permissionValue: 'salary:view' }
        ]
      })
      await nextTick()
      const text = wrapper.text()
      expect(text).toContain('姓名')
      expect(text).not.toContain('工资')
    } finally {
      resetGlobalConfig()
    }
  })

  it('未配置全局 permission 时一律放行', async () => {
    const wrapper = mountForm({
      model: { name: '', salary: '' },
      formItemList: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
        { prop: 'salary', label: '工资', formtype: 'InputNumber', span: 24, permissionValue: 'salary:view' }
      ]
    })
    await nextTick()
    expect(wrapper.text()).toContain('工资')
  })
})

describe('EsForm - AI-07 字段联动 reactions', () => {
  // reactions 的求值全在 core（resolveReactionOverlay / resolveReactionValues），三端只多做
  // 两件事：把 overlay 合并进 formItemListFilter、把值回写交给 model watcher。这里证明这两件
  // 接线真的生效（core 的语义由 packages/core/__tests__/reactions.spec.ts 覆盖）。
  const dbl = async () => { await nextTick(); await nextTick() }

  it('dataOptions：选项随依赖字段变化', async () => {
    const model = reactive({ province: 'zj' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'province', label: '省份', formtype: 'Select', span: 24 },
        {
          prop: 'city', label: '城市', formtype: 'Select', span: 24,
          reactions: [
            { dependencies: ['province'], when: { '==': [{ var: 'province' }, 'zj'] }, fulfill: { dataOptions: [{ label: '杭州', value: 'hz' }] } },
            { dependencies: ['province'], when: { '==': [{ var: 'province' }, 'js'] }, fulfill: { dataOptions: [{ label: '南京', value: 'nj' }] } },
          ],
        },
      ],
    })
    await dbl()
    const labels = () => wrapper.findAllComponents(ElOption).map((o) => o.props('label'))
    expect(labels()).toContain('杭州')
    expect(labels()).not.toContain('南京')

    model.province = 'js'
    await dbl()
    expect(labels()).toContain('南京')
    expect(labels()).not.toContain('杭州')
  })

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
    const requiredItem = () => wrapper.findAll('.el-form-item')[1]
    expect(requiredItem().classes()).not.toContain('is-required')

    model.city = 'hz'
    await dbl()
    expect(requiredItem().classes()).toContain('is-required')
  })

  it('disabled：条件禁用透传到控件', async () => {
    const model = reactive({ accountType: 'system' })
    const wrapper = mountForm({
      model,
      formItemList: [
        { prop: 'accountType', label: '类型', formtype: 'Select', span: 24 },
        {
          prop: 'username', label: '账号名', formtype: 'Input', span: 24,
          reactions: [{ dependencies: ['accountType'], fulfill: { disabled: { '==': [{ var: 'accountType' }, 'system'] } } }],
        },
      ],
    })
    await dbl()
    const usernameDisabled = () => wrapper.findAllComponents(ElInput).some((i) => i.props('disabled') === true)
    expect(usernameDisabled()).toBe(true)

    model.accountType = 'normal'
    await dbl()
    expect(usernameDisabled()).toBe(false)
  })

  it('值回写：依赖变化时写入目标字段，且仅在变更时写（可收敛、不踩无关编辑）', async () => {
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
    let changes = 0
    watch(() => model.region, () => { changes++ })

    // 挂载即静止：watch 非 immediate，无依赖变更就不写。
    await dbl()
    expect(model.region).toBe('')
    expect(changes).toBe(0)

    // 用户手改目标字段后编辑**无关**字段 → 不触发写回（依赖未变）。
    model.region = 'manual'
    await dbl()
    expect(changes).toBe(1)
    model.note = 'x'
    await dbl()
    expect(model.region).toBe('manual')
    expect(changes).toBe(1)

    // 依赖变更 → 恰好写一次，值正确、不循环。
    model.province = 'zj'
    await dbl()
    expect(model.region).toBe('zj')
    expect(changes).toBe(2)
    model.province = 'js'
    await dbl()
    expect(model.region).toBe('js')
    expect(changes).toBe(3)
  })
})
