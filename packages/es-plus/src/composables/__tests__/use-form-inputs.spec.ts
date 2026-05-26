import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import {
  ElInput,
  ElSelect,
  ElDatePicker,
  ElTimePicker,
  ElSlider,
  ElColorPicker,
  ElTransfer,
  ElCascader,
  ElRadioGroup,
  ElCheckboxGroup,
  ElSwitch,
  ElRate,
  ElUpload
} from 'element-plus'
import { getNestedValue, setNestedValue, useFormInputs } from '../use-form-inputs'
import type { FormItemOption } from '../../types'

describe('getNestedValue', () => {
  it('should get a simple top-level property', () => {
    const obj = { name: 'hello' }
    expect(getNestedValue(obj, 'name')).toBe('hello')
  })

  it('should get a dot-separated nested property', () => {
    const obj = { a: { b: { c: 42 } } }
    expect(getNestedValue(obj, 'a.b.c')).toBe(42)
  })

  it('should get a bracket-notation indexed property', () => {
    const obj = { items: ['zero', 'one', 'two'] }
    expect(getNestedValue(obj as any, 'items[1]')).toBe('one')
  })

  it('should get a mixed dot and bracket path', () => {
    const obj = { a: [{ b: { c: 'found' } }] }
    expect(getNestedValue(obj as any, 'a[0].b.c')).toBe('found')
  })

  it('should return undefined when the path does not exist', () => {
    const obj = { a: { b: 1 } }
    expect(getNestedValue(obj, 'a.x.y')).toBeUndefined()
  })

  it('should return undefined when obj is null-ish at an intermediate step', () => {
    const obj = { a: null }
    expect(getNestedValue(obj as any, 'a.b')).toBeUndefined()
  })

  it('should return undefined for a completely missing top-level key', () => {
    const obj = {}
    expect(getNestedValue(obj, 'missing')).toBeUndefined()
  })

  it('should handle numeric-like keys in dot paths', () => {
    const obj = { data: { '0': 'first' } }
    expect(getNestedValue(obj as any, 'data.0')).toBe('first')
  })

  it('should handle deeply nested bracket paths', () => {
    const obj = { matrix: [[['deep']]] }
    expect(getNestedValue(obj as any, 'matrix[0][0][0]')).toBe('deep')
  })

  it('should return the object itself if path resolves to an object', () => {
    const inner = { x: 1 }
    const obj = { a: inner }
    expect(getNestedValue(obj as any, 'a')).toBe(inner)
  })
})

describe('setNestedValue', () => {
  it('should set a simple top-level property', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'name', 'world')
    expect(obj.name).toBe('world')
  })

  it('should set a dot-separated nested property, creating intermediates', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a.b.c', 99)
    expect((obj as any).a.b.c).toBe(99)
  })

  it('should set a bracket-notation indexed property', () => {
    const obj: Record<string, unknown> = { items: ['a', 'b', 'c'] }
    setNestedValue(obj, 'items[1]', 'updated')
    expect((obj as any).items['1']).toBe('updated')
  })

  it('should set a mixed dot and bracket path', () => {
    const obj: Record<string, unknown> = { a: [{ b: {} }] }
    setNestedValue(obj, 'a[0].b.c', 'set')
    expect((obj as any).a['0'].b.c).toBe('set')
  })

  it('should create intermediate objects when they are null', () => {
    const obj: Record<string, unknown> = { a: null }
    setNestedValue(obj, 'a.b', 'created')
    // a was null, so setNestedValue tries current[key] which is null -> creates {}
    // This will throw because null isn't handled the same as undefined in the source
    // Actually looking at the source: if (current[key] == null) current[key] = {}
    // But current starts as obj, current['a'] is null -> current['a'] = {} -> then current['b'] = value
    expect((obj as any).a.b).toBe('created')
  })

  it('should overwrite an existing value', () => {
    const obj: Record<string, unknown> = { x: 'old' }
    setNestedValue(obj, 'x', 'new')
    expect(obj.x).toBe('new')
  })

  it('should handle setting a value to undefined', () => {
    const obj: Record<string, unknown> = { key: 'value' }
    setNestedValue(obj, 'key', undefined)
    expect(obj.key).toBeUndefined()
  })

  it('should handle setting a value to null', () => {
    const obj: Record<string, unknown> = { key: 'value' }
    setNestedValue(obj, 'key', null)
    expect(obj.key).toBeNull()
  })

  it('should handle deeply nested creation', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a.b.c.d.e', 'deep')
    expect((obj as any).a.b.c.d.e).toBe('deep')
  })

  it('should not throw when path is a single key', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'solo', 123)
    expect(obj.solo).toBe(123)
  })
})

describe('useFormInputs', () => {
  const { formInputComponents } = useFormInputs()

  it('should return a fallback function for unknown formtype', () => {
    const item = { prop: 'x', label: 'X', formtype: 'Unknown' } as unknown as FormItemOption
    const renderFn = formInputComponents(item)
    expect(typeof renderFn).toBe('function')
    expect(renderFn(h, {}, { row: item, index: 0 })).toBeNull()
  })

  it('should return a function for formtype undefined', () => {
    const item = { prop: 'x', label: 'X' } as FormItemOption
    const renderFn = formInputComponents(item)
    expect(typeof renderFn).toBe('function')
    expect(renderFn(h, {}, { row: item, index: 0 })).toBeNull()
  })

  describe('Input', () => {
    it('should render ElInput with correct modelValue', () => {
      const item: FormItemOption = { prop: 'name', label: 'Name', formtype: 'Input' }
      const model = { name: 'test-value' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElInput)
      expect(vnode.props?.modelValue).toBe('test-value')
    })

    it('should pass attrs to ElInput', () => {
      const item: FormItemOption = { prop: 'name', label: 'Name', formtype: 'Input', attrs: { placeholder: 'Enter' } }
      const model = { name: '' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.props?.placeholder).toBe('Enter')
    })

    it('should update model via onUpdate:modelValue', () => {
      const item: FormItemOption = { prop: 'name', label: 'Name', formtype: 'Input' }
      const model: Record<string, unknown> = { name: 'old' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      const updateFn = vnode.props?.['onUpdate:modelValue'] as (val: unknown) => void
      updateFn('new-value')
      expect(model.name).toBe('new-value')
    })
  })

  describe('Select', () => {
    it('should render ElSelect with correct modelValue', () => {
      const item: FormItemOption = {
        prop: 'status',
        label: 'Status',
        formtype: 'Select',
        dataOptions: [
          { label: 'Active', value: 1 },
          { label: 'Inactive', value: 0 }
        ]
      }
      const model = { status: 1 }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElSelect)
      expect(vnode.props?.modelValue).toBe(1)
    })

    it('should update model on Select change', () => {
      const item: FormItemOption = {
        prop: 'status',
        label: 'Status',
        formtype: 'Select',
        dataOptions: [{ label: 'A', value: 'a' }]
      }
      const model: Record<string, unknown> = { status: '' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      const updateFn = vnode.props?.['onUpdate:modelValue'] as (val: unknown) => void
      updateFn('a')
      expect(model.status).toBe('a')
    })
  })

  describe('datePicker', () => {
    it('should render ElDatePicker', () => {
      const item: FormItemOption = { prop: 'date', label: 'Date', formtype: 'datePicker' }
      const model = { date: '2024-01-01' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElDatePicker)
      expect(vnode.props?.modelValue).toBe('2024-01-01')
    })
  })

  describe('timePicker', () => {
    it('should render ElTimePicker', () => {
      const item: FormItemOption = { prop: 'time', label: 'Time', formtype: 'timePicker' }
      const model = { time: '12:00:00' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElTimePicker)
      expect(vnode.props?.modelValue).toBe('12:00:00')
    })
  })

  describe('Slider', () => {
    it('should render ElSlider', () => {
      const item: FormItemOption = { prop: 'volume', label: 'Volume', formtype: 'Slider' }
      const model = { volume: 50 }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElSlider)
      expect(vnode.props?.modelValue).toBe(50)
    })
  })

  describe('ColorPicker', () => {
    it('should render ElColorPicker', () => {
      const item: FormItemOption = { prop: 'color', label: 'Color', formtype: 'ColorPicker' }
      const model = { color: '#ff0000' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElColorPicker)
      expect(vnode.props?.modelValue).toBe('#ff0000')
    })
  })

  describe('Transfer', () => {
    it('should render ElTransfer', () => {
      const item: FormItemOption = { prop: 'selected', label: 'Transfer', formtype: 'Transfer' }
      const model = { selected: [1, 2] }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElTransfer)
      expect(vnode.props?.modelValue).toEqual([1, 2])
    })
  })

  describe('Cascader', () => {
    it('should render ElCascader with options', () => {
      const options = [{ label: 'A', value: 'a' }]
      const item: FormItemOption = { prop: 'region', label: 'Region', formtype: 'Cascader', dataOptions: options }
      const model = { region: ['a'] }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElCascader)
      expect(vnode.props?.modelValue).toEqual(['a'])
      expect(vnode.props?.options).toBe(options)
    })
  })

  describe('Radio', () => {
    it('should render ElRadioGroup', () => {
      const item: FormItemOption = {
        prop: 'gender',
        label: 'Gender',
        formtype: 'Radio',
        dataOptions: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' }
        ]
      }
      const model = { gender: 'male' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElRadioGroup)
      expect(vnode.props?.modelValue).toBe('male')
    })
  })

  describe('Checkbox', () => {
    it('should render ElCheckboxGroup', () => {
      const item: FormItemOption = {
        prop: 'hobbies',
        label: 'Hobbies',
        formtype: 'Checkbox',
        dataOptions: [
          { label: 'Reading', value: 'read' },
          { label: 'Sports', value: 'sport' }
        ]
      }
      const model = { hobbies: ['read'] }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElCheckboxGroup)
      expect(vnode.props?.modelValue).toEqual(['read'])
    })
  })

  describe('Switch', () => {
    it('should render ElSwitch', () => {
      const item: FormItemOption = { prop: 'active', label: 'Active', formtype: 'Switch' }
      const model = { active: true }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElSwitch)
      expect(vnode.props?.modelValue).toBe(true)
    })

    it('should update model on Switch toggle', () => {
      const item: FormItemOption = { prop: 'active', label: 'Active', formtype: 'Switch' }
      const model: Record<string, unknown> = { active: true }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      const updateFn = vnode.props?.['onUpdate:modelValue'] as (val: unknown) => void
      updateFn(false)
      expect(model.active).toBe(false)
    })
  })

  describe('Rate', () => {
    it('should render ElRate', () => {
      const item: FormItemOption = { prop: 'score', label: 'Score', formtype: 'Rate' }
      const model = { score: 3 }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElRate)
      expect(vnode.props?.modelValue).toBe(3)
    })
  })

  describe('Upload', () => {
    it('should render ElUpload', () => {
      const item: FormItemOption = { prop: 'file', label: 'File', formtype: 'Upload' }
      const model = { file: null }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElUpload)
    })
  })

  describe('nested prop paths in component rendering', () => {
    it('should read nested model value via dot path', () => {
      const item: FormItemOption = { prop: 'address.city', label: 'City', formtype: 'Input' }
      const model = { address: { city: 'Beijing' } }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model as any, { row: item, index: 0 })
      expect(vnode.props?.modelValue).toBe('Beijing')
    })

    it('should write nested model value via dot path on update', () => {
      const item: FormItemOption = { prop: 'address.city', label: 'City', formtype: 'Input' }
      const model: Record<string, unknown> = { address: { city: 'Beijing' } }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      const updateFn = vnode.props?.['onUpdate:modelValue'] as (val: unknown) => void
      updateFn('Shanghai')
      expect((model as any).address.city).toBe('Shanghai')
    })
  })
})
