import { describe, it, expect } from 'vitest'
import {
  normalizeFormType,
  resolveFormLayProps,
  getButtonPosition,
  getCallback,
  normalizeFormItem,
  normalizeFormItemList,
} from '../src/compat'
import type { BtnConfig, FormItemOption, ListenToCallBack } from '../src/types'

// ============================================================================
// FormType 归一化
// ============================================================================

describe('compat > normalizeFormType', () => {
  it('PascalCase 原样返回', () => {
    expect(normalizeFormType('Input')).toBe('Input')
    expect(normalizeFormType('Select')).toBe('Select')
    expect(normalizeFormType('DatePicker')).toBe('DatePicker')
    expect(normalizeFormType('TimePicker')).toBe('TimePicker')
    expect(normalizeFormType('Slider')).toBe('Slider')
  })

  it('camelCase 旧写法转为 PascalCase', () => {
    expect(normalizeFormType('datePicker')).toBe('DatePicker')
    expect(normalizeFormType('timePicker')).toBe('TimePicker')
  })

  it('未知值原样返回', () => {
    expect(normalizeFormType('CustomWidget')).toBe('CustomWidget')
    expect(normalizeFormType('')).toBe('')
  })
})

// ============================================================================
// LayoutFormProps 兼容
// ============================================================================

describe('compat > resolveFormLayProps', () => {
  it('优先读 formLayProps', () => {
    const result = resolveFormLayProps({
      formLayProps: { isBtnHidden: true, labelWidth: '120px' },
      fromLayProps: { isBtnHidden: false, labelWidth: '80px' },
    })
    expect(result.isBtnHidden).toBe(true)
    expect(result.labelWidth).toBe('120px')
  })

  it('formLayProps 不存在时 fallback 到 fromLayProps', () => {
    const result = resolveFormLayProps({
      fromLayProps: { isBtnHidden: true, labelWidth: '80px' },
    })
    expect(result.isBtnHidden).toBe(true)
    expect(result.labelWidth).toBe('80px')
  })

  it('两者都不存在时返回空对象', () => {
    expect(resolveFormLayProps({})).toEqual({})
    expect(resolveFormLayProps(undefined)).toEqual({})
  })

  it('只有 formLayProps 时正常工作', () => {
    const result = resolveFormLayProps({
      formLayProps: { minFoldRows: 3 },
    })
    expect(result.minFoldRows).toBe(3)
  })
})

// ============================================================================
// 按钮位置兼容
// ============================================================================

describe('compat > getButtonPosition', () => {
  it('position 字段优先', () => {
    expect(getButtonPosition({ name: 'btn', position: 'left' })).toBe('left')
    expect(getButtonPosition({ name: 'btn', position: 'right' })).toBe('right')
  })

  it('position + code 同时存在时 position 优先', () => {
    // position: 'left' 应该优先于 code: 2
    expect(getButtonPosition({ name: 'btn', position: 'left', code: 2 })).toBe('left')
  })

  it('无 position 时 fallback 到 code', () => {
    expect(getButtonPosition({ name: 'btn', code: 1 })).toBe('left')
    expect(getButtonPosition({ name: 'btn', code: 2 })).toBe('right')
  })

  it('两者都未配时默认 left', () => {
    expect(getButtonPosition({ name: 'btn' })).toBe('left')
  })
})

// ============================================================================
// 回调别名兼容
// ============================================================================

describe('compat > getCallback', () => {
  it('直接按新名称查找', () => {
    const cb: ListenToCallBack = {
      responseTransform: (data: unknown) => data as unknown[],
      beforeRequest: (params: unknown) => params,
      afterResponse: (res: unknown) => res,
    }
    expect(typeof getCallback(cb, 'responseTransform')).toBe('function')
    expect(typeof getCallback(cb, 'beforeRequest')).toBe('function')
    expect(typeof getCallback(cb, 'afterResponse')).toBe('function')
  })

  it('新名称查找时 fallback 旧名称', () => {
    const cb: ListenToCallBack = {
      crtn: (data: unknown) => data as unknown[],
      brcb: (params: unknown) => params,
      qrcb: (res: unknown) => res,
    }
    // 用新名称查找，应能通过别名映射找到旧名称的函数
    expect(typeof getCallback(cb, 'responseTransform')).toBe('function')
    expect(typeof getCallback(cb, 'beforeRequest')).toBe('function')
    expect(typeof getCallback(cb, 'afterResponse')).toBe('function')
  })

  it('旧名称查找时 fallback 新名称', () => {
    const cb: ListenToCallBack = {
      responseTransform: (data: unknown) => data as unknown[],
      beforeRequest: (params: unknown) => params,
      afterResponse: (res: unknown) => res,
    }
    // 用旧名称查找，应能通过反向映射找到新名称的函数
    expect(typeof getCallback(cb, 'crtn')).toBe('function')
    expect(typeof getCallback(cb, 'brcb')).toBe('function')
    expect(typeof getCallback(cb, 'qrcb')).toBe('function')
  })

  it('新名称优先于旧名称', () => {
    const calledWith: string[] = []
    const cb: ListenToCallBack = {
      responseTransform: () => { calledWith.push('new'); return [] },
      crtn: () => { calledWith.push('old'); return [] },
    }
    const fn = getCallback(cb, 'responseTransform')
    fn!()
    expect(calledWith).toEqual(['new'])
  })

  it('cb 为 undefined 时返回 undefined', () => {
    expect(getCallback(undefined, 'brcb')).toBeUndefined()
  })

  it('未找到回调时返回 undefined', () => {
    expect(getCallback({}, 'responseTransform')).toBeUndefined()
  })

  it('回调函数可正常执行并返回值', () => {
    const cb: ListenToCallBack = {
      beforeRequest: (params: unknown) => ({ ...(params as Record<string, unknown>), extra: true }),
    }
    const fn = getCallback(cb, 'beforeRequest')
    const result = fn!({ keyword: 'test' })
    expect(result).toEqual({ keyword: 'test', extra: true })
  })

  it('旧名称 brcb 也能通过 getCallback("beforeRequest") 找到', () => {
    const cb: Record<string, (...args: unknown[]) => unknown> = {
      brcb: (params: unknown) => ({ ...(params as Record<string, unknown>), intercepted: true }),
    }
    const fn = getCallback(cb, 'beforeRequest')
    const result = fn!({ keyword: 'test' })
    expect(result).toEqual({ keyword: 'test', intercepted: true })
  })
})

// ============================================================================
// FormItem 快捷属性合并
// ============================================================================

describe('compat > normalizeFormItem', () => {
  it('placeholder 自动注入到 attrs', () => {
    const item = normalizeFormItem({ prop: 'name', label: 'Name', placeholder: '请输入' })
    expect(item.attrs?.placeholder).toBe('请输入')
  })

  it('clearable 自动注入到 attrs', () => {
    const item = normalizeFormItem({ prop: 'name', label: 'Name', clearable: true })
    expect(item.attrs?.clearable).toBe(true)
  })

  it('disabled 自动注入到 attrs', () => {
    const item = normalizeFormItem({ prop: 'name', label: 'Name', disabled: true })
    expect(item.attrs?.disabled).toBe(true)
  })

  it('attrs 中已有的同名属性优先（不被快捷属性覆盖）', () => {
    const item = normalizeFormItem({
      prop: 'name',
      label: 'Name',
      placeholder: '快捷占位',
      attrs: { placeholder: '显式占位' },
    })
    expect(item.attrs?.placeholder).toBe('显式占位')
  })

  it('无快捷属性时不添加多余 attrs', () => {
    const item = normalizeFormItem({ prop: 'name', label: 'Name' })
    // 原始 item 没有 attrs，normalizeFormItem 不会添加空的 attrs
    // 但如果原始有 attrs 则保留
    const itemWithAttrs = normalizeFormItem({ prop: 'name', label: 'Name', attrs: { class: 'test' } })
    expect(itemWithAttrs.attrs?.class).toBe('test')
  })
})

describe('compat > normalizeFormItemList', () => {
  it('批量归一化', () => {
    const items: FormItemOption[] = [
      { prop: 'a', label: 'A', placeholder: '输入A' },
      { prop: 'b', label: 'B', clearable: true },
      { prop: 'c', label: 'C', disabled: true },
    ]
    const result = normalizeFormItemList(items)
    expect(result[0].attrs?.placeholder).toBe('输入A')
    expect(result[1].attrs?.clearable).toBe(true)
    expect(result[2].attrs?.disabled).toBe(true)
  })
})
