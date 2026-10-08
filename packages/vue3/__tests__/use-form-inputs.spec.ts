// @ts-nocheck - TODO: migrate to strict when refactored
import { describe, it, expect, vi } from 'vitest'
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
import { getNestedValue, setNestedValue, useFormInputs } from '../src/composables/use-form-inputs'
import type { FormItemOption } from '../src/types'

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

    it('attrs.disabled 为函数时被求值（对齐 vue2 / es-eui；不求值则函数恒真，控件永久禁用）', () => {
      const item = {
        prop: 'name', label: 'Name', formtype: 'Input',
        attrs: { disabled: () => true },
      } as unknown as FormItemOption
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, { name: '' }, { row: item, index: 0 })
      expect(vnode.props?.disabled).toBe(true)
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

    it('dataOptions.disabled 透传到选项（回归：此前丢弃，禁用项仍可点）', () => {
      const item: FormItemOption = {
        prop: 'status',
        label: 'Status',
        formtype: 'Select',
        dataOptions: [
          { label: 'Active', value: 1 },
          { label: 'Inactive', value: 0, disabled: true }
        ]
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, {}, { row: item, index: 0 })
      const slots = vnode.children as unknown as
        | (() => { props?: { disabled?: boolean } }[])
        | { default: () => { props?: { disabled?: boolean } }[] }
      const options = typeof slots === 'function' ? slots() : slots.default()
      expect(options[0].props?.disabled).toBeUndefined()
      expect(options[1].props?.disabled).toBe(true)
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

  describe('DatePicker', () => {
    it('should render ElDatePicker with PascalCase', () => {
      const item: FormItemOption = { prop: 'date', label: 'Date', formtype: 'DatePicker' }
      const model = { date: '2024-01-01' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElDatePicker)
      expect(vnode.props?.modelValue).toBe('2024-01-01')
    })

    it('should render ElDatePicker with legacy camelCase (datePicker)', () => {
      // Backward compatibility: 'datePicker' should still work via normalizeFormType
      const item = { prop: 'date', label: 'Date', formtype: 'datePicker' } as unknown as FormItemOption
      const model = { date: '2024-01-01' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElDatePicker)
      expect(vnode.props?.modelValue).toBe('2024-01-01')
    })
  })

  describe('TimePicker', () => {
    it('should render ElTimePicker with PascalCase', () => {
      const item: FormItemOption = { prop: 'time', label: 'Time', formtype: 'TimePicker' }
      const model = { time: '12:00:00' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.type).toBe(ElTimePicker)
      expect(vnode.props?.modelValue).toBe('12:00:00')
    })

    it('should render ElTimePicker with legacy camelCase (timePicker)', () => {
      // Backward compatibility: 'timePicker' should still work via normalizeFormType
      const item = { prop: 'time', label: 'Time', formtype: 'timePicker' } as unknown as FormItemOption
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

    // dataOptions → data：三端里此前只有 vue3 没消费（vue2 自己 map，antdv 走
    // normalizeTransferDataSource），穿梭框两侧恒为空。这组用例把它钉住。
    it('dataOptions → data，且 value 必须改名成 key（ElTransfer 的标识字段）', () => {
      const item: FormItemOption = {
        prop: 'selected',
        label: 'Transfer',
        formtype: 'Transfer',
        dataOptions: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b', disabled: true }
        ]
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, { selected: [] }, { row: item, index: 0 })
      expect(vnode.props?.data).toEqual([
        { label: 'A', value: 'a', key: 'a' },
        { label: 'B', value: 'b', disabled: true, key: 'b' }
      ])
    })

    it('dataOptions 的 value 为 0 时不能用 || 兜底（0 是合法 key）', () => {
      const item: FormItemOption = {
        prop: 'selected',
        label: 'Transfer',
        formtype: 'Transfer',
        dataOptions: [{ label: '零', value: 0 }]
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, { selected: [] }, { row: item, index: 0 })
      expect(vnode.props?.data?.[0].key).toBe(0)
    })

    it('已带 key 的选项保留原 key（不强行改写成 value）', () => {
      const item: FormItemOption = {
        prop: 'selected',
        label: 'Transfer',
        formtype: 'Transfer',
        dataOptions: [{ label: 'A', value: 'a', key: 'k-a' }]
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, { selected: [] }, { row: item, index: 0 })
      expect(vnode.props?.data?.[0].key).toBe('k-a')
    })

    it('都没有 key/value 时回落下标（与 antdv 的兜底一致，避免每项同 key）', () => {
      const item: FormItemOption = {
        prop: 'selected',
        label: 'Transfer',
        formtype: 'Transfer',
        dataOptions: [{ label: 'A' }, { label: 'B' }]
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, { selected: [] }, { row: item, index: 0 })
      expect(vnode.props?.data?.map((d: any) => d.key)).toEqual(['0', '1'])
    })

    it('用户经 attrs 显式透传的 data 优先于 dataOptions（沿用既有优先级）', () => {
      const explicit = [{ label: 'X', key: 'x' }]
      const item: FormItemOption = {
        prop: 'selected',
        label: 'Transfer',
        formtype: 'Transfer',
        dataOptions: [{ label: 'A', value: 'a' }],
        attrs: { data: explicit }
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, { selected: [] }, { row: item, index: 0 })
      expect(vnode.props?.data).toEqual(explicit)
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

    // ── file-list ↔ model 双向绑定 ──────────────────────────────────────
    // 此前这个分支连 file-list 都没绑：上传完 model[prop] 仍是初始值，
    // 表单提交上去是空的，且不报错。vue2 一直是完整的，vue3 漏了。
    const uploadItem = (extra: Record<string, unknown> = {}): FormItemOption =>
      ({ prop: 'file', label: 'File', formtype: 'Upload', ...extra }) as FormItemOption

    it('el-upload 的 fileList 取自 model[prop]', () => {
      const files = [{ name: 'a.png', uid: 1 }]
      const vnode = formInputComponents(uploadItem())!(h, { file: files }, {
        row: uploadItem(),
        index: 0,
      })
      expect(vnode.props?.fileList).toEqual(files)
    })

    it('model[prop] 不是数组时给 []，而不是 undefined', () => {
      // ElUpload 内部（use-handlers.mjs 的 getFile）直接对 props.fileList 调 .find()，
      // 传 undefined 会让首屏渲染就抛。
      for (const empty of [{}, { file: null }, { file: undefined }, { file: 'not-array' }]) {
        const vnode = formInputComponents(uploadItem())!(h, empty, {
          row: uploadItem(),
          index: 0,
        })
        expect(vnode.props?.fileList, JSON.stringify(empty)).toEqual([])
      }
    })

    it('update:fileList 把新列表写回 model[prop]，且换新数组引用', () => {
      const model: Record<string, unknown> = { file: [] }
      const vnode = formInputComponents(uploadItem())!(h, model, {
        row: uploadItem(),
        index: 0,
      })
      const next = [{ name: 'b.png', uid: 2 }]
      vnode.props!['onUpdate:fileList'](next)
      expect(model.file).toEqual(next)
      // 必须换引用：Vue 2 那条线靠它触发数组更新，这里保持三端一致
      expect(model.file).not.toBe(next)
    })

    it('onSuccess 既调用户回调，也把文件列表写回 model', () => {
      const userSuccess = vi.fn()
      const item = uploadItem({ on: { success: userSuccess } })
      const model: Record<string, unknown> = { file: [] }
      const vnode = formInputComponents(item)!(h, model, { row: item, index: 0 })
      // 用户回调经 toOnKey 变成 onSuccess prop，随后被接管包装
      expect(vnode.props?.onSuccess).not.toBe(userSuccess)

      const list = [{ name: 'c.png', uid: 3, status: 'success' }]
      vnode.props!.onSuccess({ url: '/c.png' }, list[0], list)

      expect(userSuccess).toHaveBeenCalledWith({ url: '/c.png' }, list[0], list)
      expect(model.file).toEqual(list)
    })

    it('onError / onRemove 同样写回（失败与删除都要落到 model）', () => {
      const userError = vi.fn()
      const userRemove = vi.fn()
      const item = uploadItem({ on: { error: userError, remove: userRemove } })
      const model: Record<string, unknown> = { file: [{ uid: 1 }, { uid: 2 }] }
      const vnode = formInputComponents(item)!(h, model, { row: item, index: 0 })

      const afterErr = [{ uid: 1 }]
      vnode.props!.onError(new Error('boom'), { uid: 2 }, afterErr)
      expect(userError).toHaveBeenCalled()
      expect(model.file).toEqual(afterErr)

      const afterRemove = [{ uid: 1 }]
      vnode.props!.onRemove({ uid: 2 }, afterRemove)
      expect(userRemove).toHaveBeenCalled()
      expect(model.file).toEqual(afterRemove)
    })

    it('支持嵌套 prop 路径（写回走 setNestedValue）', () => {
      const item = { prop: 'docs.files', label: '附件', formtype: 'Upload' } as FormItemOption
      const model: Record<string, unknown> = { docs: { files: [] } }
      const vnode = formInputComponents(item)!(h, model, { row: item, index: 0 })
      const next = [{ uid: 9 }]
      vnode.props!['onUpdate:fileList'](next)
      expect((model.docs as Record<string, unknown>).files).toEqual(next)
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

  // 回归：这两个逃生舱此前在 Vue 3 下静默失效（见 use-form-inputs.ts 的 rowPassThrough）
  describe('透传逃生舱 props / on', () => {
    it('should merge props into the control props', () => {
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        props: { clearable: true, maxlength: 10 }
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, {}, { row: item, index: 0 })
      expect(vnode.props?.clearable).toBe(true)
      expect(vnode.props?.maxlength).toBe(10)
    })

    it('should convert raw on keys to onXxx listeners', () => {
      const handler = () => {}
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        on: { change: handler, blur: handler }
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, {}, { row: item, index: 0 })
      expect(vnode.props?.onChange).toBe(handler)
      expect(vnode.props?.onBlur).toBe(handler)
      // 裸键名不应再出现，否则说明事件又被当成普通 prop 透传了
      expect(vnode.props?.change).toBeUndefined()
    })

    it('should not double-prefix keys already in onXxx form', () => {
      const handler = () => {}
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        on: { onFocus: handler }
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, {}, { row: item, index: 0 })
      expect(vnode.props?.onFocus).toBe(handler)
      expect(vnode.props?.onOnFocus).toBeUndefined()
    })

    it('should let the internal two-way binding win over a user-supplied update handler', () => {
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        on: { 'update:modelValue': () => {} }
      }
      const model: Record<string, unknown> = { name: 'old' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      const updateFn = vnode.props?.['onUpdate:modelValue'] as (val: unknown) => void
      updateFn('new')
      expect(model.name).toBe('new')
    })

    // 回归：props/attrs 展开在显式 modelValue 之后会覆盖内部绑定，输入框与 model 静默脱钩
    it('props 中的 modelValue 不得覆盖内部 model 绑定', () => {
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        props: { modelValue: 'hijacked-by-props' }
      }
      const model = { name: 'bound-value' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.props?.modelValue).toBe('bound-value')
    })

    it('attrs 中的 modelValue 不得覆盖内部 model 绑定', () => {
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        attrs: { modelValue: 'hijacked-by-attrs' }
      }
      const model = { name: 'bound-value' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      expect(vnode.props?.modelValue).toBe('bound-value')
    })

    it('attrs 中的 onUpdate:modelValue 不得劫持内部回写', () => {
      const spy = vi.fn()
      const item: FormItemOption = {
        prop: 'name',
        label: 'Name',
        formtype: 'Input',
        attrs: { 'onUpdate:modelValue': spy }
      }
      const model: Record<string, unknown> = { name: 'old' }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, model, { row: item, index: 0 })
      const updateFn = vnode.props?.['onUpdate:modelValue'] as (val: unknown) => void
      updateFn('new')
      expect(model.name).toBe('new')
      expect(spy).not.toHaveBeenCalled()
    })

    it('should apply props and on to a non-Input control too', () => {
      const handler = () => {}
      const item: FormItemOption = {
        prop: 'pick',
        label: 'Pick',
        formtype: 'DatePicker',
        props: { valueFormat: 'YYYY-MM-DD' },
        on: { change: handler }
      }
      const renderFn = formInputComponents(item)
      const vnode = renderFn(h, {}, { row: item, index: 0 })
      expect(vnode.type).toBe(ElDatePicker)
      expect(vnode.props?.valueFormat).toBe('YYYY-MM-DD')
      expect(vnode.props?.onChange).toBe(handler)
    })
  })
})

describe('useFormInputs — 未知 formtype 的告警', () => {
  const { formInputComponents } = useFormInputs()

  it('未知 formtype 告警一次并点名字段，同值不重复告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    formInputComponents({ prop: 'weirdField', label: 'T', formtype: '__probe_unknown_a__' } as any)
    formInputComponents({ prop: 'secondField', label: 'T', formtype: '__probe_unknown_a__' } as any)
    formInputComponents({ prop: 'thirdField', label: 'T', formtype: '__probe_unknown_b__' } as any)
    const msgs = warn.mock.calls.map((c) => String(c[0]))
    expect(msgs.filter((m) => m.includes('__probe_unknown_a__'))).toHaveLength(1)
    expect(msgs.filter((m) => m.includes('__probe_unknown_b__'))).toHaveLength(1)
    expect(msgs.some((m) => m.includes('weirdField'))).toBe(true)
    // 提示里必须给出合法值，否则用户不知道改成什么
    expect(msgs.some((m) => m.includes('合法值') && m.includes('Input'))).toBe(true)
    warn.mockRestore()
  })

  it('合法 formtype 不告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    formInputComponents({ prop: 'okField', label: 'T', formtype: 'Input' } as any)
    formInputComponents({ prop: 'okField2', label: 'T', formtype: 'DatePicker' } as any)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
