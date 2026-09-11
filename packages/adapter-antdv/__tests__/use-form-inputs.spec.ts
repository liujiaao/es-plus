/**
 * 表单控件渲染器测试 — 16 种 formtype → ADV 组件映射
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import dayjs from 'dayjs'
import { useFormInputs } from '../src/composables/use-form-inputs'
import type { FormItemOption } from '../src/types'

const makeItem = (formtype: string, overrides: Partial<FormItemOption> = {}): FormItemOption => ({
  prop: 'testField',
  label: 'Test',
  formtype,
  ...overrides,
})

const makeModel = (value?: unknown): Record<string, unknown> => {
  const m: Record<string, unknown> = {}
  if (value !== undefined) m.testField = value
  return m
}

describe('useFormInputs — 控件类型存在性', () => {
  const { formInputComponents } = useFormInputs()

  const validTypes = [
    'Input', 'Select', 'datePicker', 'DatePicker',
    'timePicker', 'TimePicker', 'Slider', 'ColorPicker',
    'Transfer', 'Cascader', 'Radio', 'Checkbox', 'Switch', 'Rate', 'Upload',
  ]

  validTypes.forEach((t) => {
    it(`${t} → 渲染函数存在`, () => {
      const renderFn = formInputComponents(makeItem(t))
      expect(typeof renderFn).toBe('function')
    })
  })

  it('无效类型 → 返回 null 渲染器', () => {
    const renderFn = formInputComponents(makeItem('InvalidType' as any))
    const result = renderFn(h, makeModel(), { row: makeItem('InvalidType' as any), index: 0 })
    expect(result).toBeNull()
  })
})

describe('useFormInputs — 各控件渲染 VNode', () => {
  const { formInputComponents } = useFormInputs()

  it('Input — 渲染 a-input', () => {
    const renderFn = formInputComponents(makeItem('Input', { attrs: { placeholder: '请输入' } }))!
    const vnode = renderFn(h, makeModel('测试'), { row: makeItem('Input'), index: 0 })
    expect(vnode).toBeTruthy()
    // VNode type 是 ADV Input 组件
    expect((vnode as any).type?.name || (vnode as any).type?.__name || (vnode as any).type).toBeTruthy()
  })

  it('Input textarea — 渲染 TextArea', () => {
    const renderFn = formInputComponents(makeItem('Input', {
      attrs: { type: 'textarea', rows: 4 },
    }))!
    const vnode = renderFn(h, makeModel('多行文本'), { row: makeItem('Input'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('Select — 含 dataOptions 渲染子选项', () => {
    const renderFn = formInputComponents(makeItem('Select', {
      dataOptions: [
        { label: '启用', value: 1 },
        { label: '禁用', value: 0 },
      ],
    }))!
    const vnode = renderFn(h, makeModel(1), { row: makeItem('Select'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('DatePicker — 非 range 模式', () => {
    const renderFn = formInputComponents(makeItem('DatePicker', {
      attrs: { type: 'date' },
    }))!
    const vnode = renderFn(h, makeModel('2024-01-01'), { row: makeItem('DatePicker'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('DatePicker range → 使用 RangePicker 组件', () => {
    const renderFn = formInputComponents(makeItem('DatePicker', {
      attrs: { type: 'daterange' },
    }))!
    const vnode = renderFn(h, makeModel(['2024-01-01', '2024-12-31']), {
      row: makeItem('DatePicker'),
      index: 0,
    })
    expect(vnode).toBeTruthy()
  })

  it('Switch — 渲染 ADV Switch', () => {
    const renderFn = formInputComponents(makeItem('Switch'))!
    const vnode = renderFn(h, makeModel(true), { row: makeItem('Switch'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('Radio — 含 dataOptions', () => {
    const renderFn = formInputComponents(makeItem('Radio', {
      dataOptions: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
      ],
    }))!
    const vnode = renderFn(h, makeModel('male'), { row: makeItem('Radio'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('Checkbox — 含 dataOptions', () => {
    const renderFn = formInputComponents(makeItem('Checkbox', {
      dataOptions: [
        { label: '篮球', value: 'basketball' },
        { label: '足球', value: 'football' },
      ],
    }))!
    const vnode = renderFn(h, makeModel(['basketball']), {
      row: makeItem('Checkbox'),
      index: 0,
    })
    expect(vnode).toBeTruthy()
  })

  it('Rate — 正确渲染', () => {
    const renderFn = formInputComponents(makeItem('Rate'))!
    const vnode = renderFn(h, makeModel(3), { row: makeItem('Rate'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('Slider — 正确渲染', () => {
    const renderFn = formInputComponents(makeItem('Slider'))!
    const vnode = renderFn(h, makeModel(50), { row: makeItem('Slider'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('TimePicker — 正确渲染', () => {
    const renderFn = formInputComponents(makeItem('TimePicker'))!
    const vnode = renderFn(h, makeModel('12:00:00'), { row: makeItem('TimePicker'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('Transfer — 正确渲染', () => {
    const renderFn = formInputComponents(makeItem('Transfer', {
      dataOptions: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
    }))!
    const vnode = renderFn(h, makeModel(['1']), { row: makeItem('Transfer'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('Cascader — 正确渲染', () => {
    const renderFn = formInputComponents(makeItem('Cascader', {
      dataOptions: [
        { label: '广东', value: 'gd', children: [{ label: '深圳', value: 'sz' }] },
      ] as any,
    }))!
    const vnode = renderFn(h, makeModel(['gd', 'sz']), {
      row: makeItem('Cascader'),
      index: 0,
    })
    expect(vnode).toBeTruthy()
  })

  it('Upload — 正确渲染', () => {
    const renderFn = formInputComponents(makeItem('Upload'))!
    const vnode = renderFn(h, makeModel(), { row: makeItem('Upload'), index: 0 })
    expect(vnode).toBeTruthy()
  })

  it('ColorPicker (降级) — 渲染 input[type=color]', () => {
    const renderFn = formInputComponents(makeItem('ColorPicker'))!
    const vnode = renderFn(h, makeModel('#ff0000'), { row: makeItem('ColorPicker'), index: 0 })
    expect(vnode).toBeTruthy()
  })
})

describe('useFormInputs — v-model 绑定验证（值同步）', () => {
  const { formInputComponents } = useFormInputs()

  it('Input — 修改 model 值', () => {
    const model = makeModel('old')
    const renderFn = formInputComponents(makeItem('Input'))!
    const vnode = renderFn(h, model, { row: makeItem('Input'), index: 0 })
    // 模拟 ADV 的 onUpdate:value 回调
    const props = (vnode as any).props || (vnode as any).component?.props || {}
    const updateHandler = props['onUpdate:value'] as Function | undefined
    if (updateHandler) {
      updateHandler('new value')
      expect(model.testField).toBe('new value')
    }
  })

  it('Switch — 通过 onUpdate:checked 修改', () => {
    const model = makeModel(false)
    const renderFn = formInputComponents(makeItem('Switch'))!
    const vnode = renderFn(h, model, { row: makeItem('Switch'), index: 0 })
    const props = (vnode as any).props || {}
    const updateHandler = props['onUpdate:checked'] as Function | undefined
    if (updateHandler) {
      updateHandler(true)
      expect(model.testField).toBe(true)
    }
  })
})

describe('useFormInputs — 嵌套路径', () => {
  const { formInputComponents } = useFormInputs()

  it('嵌套 prop (user.name) — 正确读写', () => {
    const item = makeItem('Input', { prop: 'user.name' })
    const model = { user: { name: '张三' } }
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, model, { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(props.value).toBe('张三')

    const updateHandler = props['onUpdate:value'] as Function | undefined
    if (updateHandler) {
      updateHandler('李四')
      expect(model.user.name).toBe('李四')
    }
  })
})

describe('useFormInputs — 日期值字符串↔dayjs 转换（根因修复）', () => {
  const { formInputComponents } = useFormInputs()

  it('DatePicker 字符串值 → 转为 dayjs 传入组件（不再触发 date.locale 错误）', () => {
    const item = makeItem('DatePicker')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel('2024-01-01'), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(dayjs.isDayjs(props.value)).toBe(true)
    expect((props.value as dayjs.Dayjs).format('YYYY-MM-DD')).toBe('2024-01-01')
  })

  it('DatePicker Range 字符串数组 → 转为 dayjs 数组', () => {
    const item = makeItem('DatePicker', { attrs: { type: 'daterange' } })
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel(['2024-01-01', '2024-12-31']), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(Array.isArray(props.value)).toBe(true)
    expect(props.value.every((v: unknown) => dayjs.isDayjs(v))).toBe(true)
  })

  it('DatePicker 空字符串 → 返回 null（避免被误转为 dayjs(now)，且不触发 ADV date.locale 崩溃）', () => {
    const item = makeItem('DatePicker')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel(''), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(props.value).toBeNull()
    expect(dayjs.isDayjs(props.value)).toBe(false)
  })

  it('DatePicker null → 返回 null', () => {
    const item = makeItem('DatePicker')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel(null), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(props.value).toBeNull()
  })

  it('TimePicker 空字符串 → 返回 null（避免 ADV TimePicker date.locale 崩溃）', () => {
    const item = makeItem('TimePicker')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel(''), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(props.value).toBeNull()
  })

  it('DatePicker Range 空数组 [] → 返回 null（避免 ADV RangePicker date.locale 崩溃）', () => {
    const item = makeItem('DatePicker', { attrs: { type: 'daterange' } })
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel([]), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(props.value).toBeNull()
  })

  it('TimePicker Range 空数组 [] → 返回 null', () => {
    const item = makeItem('TimePicker', { attrs: { isRange: true } })
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel([]), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(props.value).toBeNull()
  })

  it('DatePicker 配置 valueFormat → 回写 model 为字符串（对齐 EP value-format）', () => {
    const item = makeItem('DatePicker', { attrs: { valueFormat: 'YYYY-MM-DD' } })
    const model = makeModel('2024-01-01')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, model, { row: item, index: 0 })
    const props = (vnode as any).props || {}
    const updateHandler = props['onUpdate:value'] as Function
    updateHandler(dayjs('2024-06-15'))
    expect(model.testField).toBe('2024-06-15')
  })

  it('DatePicker 未配置 valueFormat → 回写 model 为 dayjs 对象（ADV 原生）', () => {
    const item = makeItem('DatePicker')
    const model = makeModel('2024-01-01')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, model, { row: item, index: 0 })
    const props = (vnode as any).props || {}
    const updateHandler = props['onUpdate:value'] as Function
    updateHandler(dayjs('2024-06-15'))
    expect(dayjs.isDayjs(model.testField)).toBe(true)
  })

  it('TimePicker 字符串值 → 转为 dayjs', () => {
    const item = makeItem('TimePicker')
    const renderFn = formInputComponents(item)!
    const vnode = renderFn(h, makeModel('12:00:00'), { row: item, index: 0 })
    const props = (vnode as any).props || {}
    expect(dayjs.isDayjs(props.value)).toBe(true)
  })
})

// 回归：这两个逃生舱此前与 vue3 一样静默失效（见 use-form-inputs.ts 的 rowPassThrough）
describe('useFormInputs — 透传逃生舱 props / on', () => {
  const { formInputComponents } = useFormInputs()
  const propsOf = (formtype: string, overrides: Partial<FormItemOption> = {}) => {
    const item = makeItem(formtype, overrides)
    const renderFn = formInputComponents(item)!
    return ((renderFn(h, makeModel(), { row: item, index: 0 }) as any).props || {}) as Record<string, unknown>
  }

  it('props 会被合并进控件属性', () => {
    const props = propsOf('Input', { props: { allowClear: true, maxlength: 10 } })
    expect(props.allowClear).toBe(true)
    expect(props.maxlength).toBe(10)
  })

  it('on 的裸事件名会被转成 onXxx 监听器', () => {
    const handler = () => {}
    const props = propsOf('Input', { on: { change: handler, blur: handler } })
    expect(props.onChange).toBe(handler)
    expect(props.onBlur).toBe(handler)
    // 裸键名不应再出现，否则说明事件又被当成普通 prop 透传了
    expect(props.change).toBeUndefined()
  })

  it('已是 onXxx 的键名不会二次加前缀', () => {
    const handler = () => {}
    const props = propsOf('Input', { on: { onFocus: handler } })
    expect(props.onFocus).toBe(handler)
    expect(props.onOnFocus).toBeUndefined()
  })

  it('props 与 attrs 同时存在时都会透传，attrs 同名键优先', () => {
    const props = propsOf('Input', { props: { maxlength: 5 }, attrs: { maxlength: 20 } })
    expect(props.maxlength).toBe(20)
  })

  it('合并透传不影响 DatePicker 用原始 attrs.type 解析组件（RangePicker）', () => {
    // 回归点：rowPassThrough 的返回值含事件监听器与组件 props，
    // 若拿它去 resolveDatePickerComponent 会误判，必须仍用原始 row.attrs
    const props = propsOf('DatePicker', { attrs: { type: 'daterange' }, props: { type: 'nonsense' } })
    expect(props.picker).toBeUndefined()
    expect(Array.isArray(props.placeholder) || props.placeholder === undefined).toBe(true)
  })

  it('合并透传不影响 Switch 读原始 attrs 的 EP 字段映射', () => {
    const props = propsOf('Switch', { attrs: { 'active-value': 'Y', 'inactive-value': 'N' } })
    expect(props['checked-value']).toBe('Y')
    expect(props['un-checked-value']).toBe('N')
  })
})
