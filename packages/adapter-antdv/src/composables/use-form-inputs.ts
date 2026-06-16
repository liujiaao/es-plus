/**
 * Ant Design Vue 表单控件渲染映射
 *
 * 与 @es-plus/vue3 use-form-inputs.ts 的关键差异：
 * 1. v-model 绑定字段不同 —— ADV 多数控件用 value/onUpdate:value，Switch 用 checked，Transfer 用 targetKeys
 * 2. DatePicker range 模式 → ADV 使用独立 RangePicker 组件
 * 3. Upload 使用 customRequest 替代 http-request
 * 4. ColorPicker — ADV 无内置，使用 input[type=color] 降级方案
 * 5. Select / Radio / Checkbox 子选项使用 ADV 的 SelectOption / Radio / Checkbox
 */
import { h } from 'vue'
import {
  Input,
  InputPassword,
  Select,
  SelectOption,
  DatePicker,
  RangePicker,
  TimePicker,
  Slider,
  Transfer,
  Cascader,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  Switch,
  Rate,
  Upload,
  Button,
  Tag,
} from 'ant-design-vue'
import type { FormItemOption } from '../types'
import { normalizeFormType } from '@es-plus/core'
import { getNestedValue, setNestedValue } from '../utils/shared'

type FormInputCtx = { row: FormItemOption; index: number }

/**
 * Ant Design Vue 各组件的 v-model 绑定字段映射
 *
 * Element Plus 统一使用 modelValue / onUpdate:modelValue，
 * ADV 各组件使用不同的 v-model 字段名。
 */
const V_MODEL_BINDING: Record<string, { prop: string; event: string }> = {
  Input:      { prop: 'value',        event: 'onUpdate:value' },
  Select:     { prop: 'value',        event: 'onUpdate:value' },
  DatePicker: { prop: 'value',        event: 'onUpdate:value' },
  RangePicker:{ prop: 'value',        event: 'onUpdate:value' },
  TimePicker: { prop: 'value',        event: 'onUpdate:value' },
  Slider:     { prop: 'value',        event: 'onUpdate:value' },
  Rate:       { prop: 'value',        event: 'onUpdate:value' },
  Cascader:   { prop: 'value',        event: 'onUpdate:value' },
  Radio:      { prop: 'value',        event: 'onUpdate:value' },
  Checkbox:   { prop: 'value',        event: 'onUpdate:value' },
  Switch:     { prop: 'checked',      event: 'onUpdate:checked' },
  Transfer:   { prop: 'targetKeys',   event: 'onUpdate:targetKeys' },
}

/**
 * 根据 attrs.type 判断 DatePicker 是否为 range 模式，
 * ADV 的 range 使用独立的 RangePicker 组件。
 */
function resolveDatePickerComponent(attrs: Record<string, unknown>) {
  const type = attrs.type as string | undefined
  if (type === 'daterange' || type === 'datetimerange' || type === 'monthrange' || type === 'yearrange') {
    return { component: RangePicker, binding: V_MODEL_BINDING.RangePicker }
  }
  return { component: DatePicker, binding: V_MODEL_BINDING.DatePicker }
}

/**
 * EP type → ADV size 映射
 *   large → large, default → middle, small → small
 */
function mapSize(epSize: string | undefined, defaultValue: string = 'middle'): string {
  if (!epSize) return defaultValue
  const map: Record<string, string> = {
    large: 'large', default: 'middle', small: 'small',
    medium: 'middle', mini: 'small', '': 'middle',
  }
  return map[epSize] || defaultValue
}

/**
 * EP type → ADV button type 映射
 *   ''/default → default, primary → primary, text → link, success/warning/info → primary (降级)
 */
function mapButtonType(epType: string | undefined): string {
  if (!epType || epType === '' || epType === 'default') return 'default'
  if (epType === 'primary') return 'primary'
  if (epType === 'danger') return 'danger'  // ADV 的 danger = 'ghost' + danger? No, ADV has danger type
  if (epType === 'dashed') return 'dashed'
  if (epType === 'text' || epType === 'link') return 'link'
  // success / warning / info — ADV 不支持，降级为 default
  return 'default'
}

export function useFormInputs() {
  const formInputComponents = (item: FormItemOption) => {
    const normalizedType = normalizeFormType(item.formtype || '')

    // 安全渲染包装器：捕获所有渲染异常
    const safeCall = (fn: Function): typeof fn => {
      return (...args: unknown[]) => {
        try {
          return fn(...args)
        } catch (err) {
          console.error(`[es-plus/antdv] Form control "${normalizedType}" render error:`, err)
          return h('span', { style: { color: 'red' } }, '[Render Error]')
        }
      }
    }

    const formPutList = new Map<string, (hFn: typeof h, model: Record<string, unknown>, ctx: FormInputCtx) => ReturnType<typeof h>>([

      // ─── Input ─────────────────────────────────────────────
      [
        'Input',
        (hFn, model, { row }: FormInputCtx) => {
          const { component: InputComp, binding } = resolveInputComponent(row.attrs || {})
          const props: Record<string, unknown> = {
            [binding.prop]: getNestedValue(model, row.prop),
            ...row.attrs,
          }
          // Merge row.on events
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              const eventKey = key.startsWith('on') ? key : `on${key.charAt(0).toUpperCase()}${key.slice(1)}`
              props[eventKey] = handler
            }
          }
          props[binding.event] = (val: unknown) => { setNestedValue(model, row.prop, val) }
          return hFn(InputComp, props)
        },
      ],

      // ─── Select ────────────────────────────────────────────
      [
        'Select',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          // Merge events
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              const eventKey = key.startsWith('on') ? key : `on${key.charAt(0).toUpperCase()}${key.slice(1)}`
              props[eventKey] = handler
            }
          }
          const children = () =>
            (row.dataOptions || []).map((opt, idx) =>
              hFn(SelectOption, { key: idx, value: opt.value }, () => opt.label)
            )
          return hFn(Select, props, children)
        },
      ],

      // ─── DatePicker (含 range 自动切换 RangePicker) ────────
      [
        'datePicker',
        (hFn, model, { row }: FormInputCtx) => {
          const { component: DateComp, binding } = resolveDatePickerComponent(row.attrs as Record<string, unknown> || {})
          const props: Record<string, unknown> = {
            [binding.prop]: getNestedValue(model, row.prop),
            ...row.attrs,
            [binding.event]: (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          // EP → ADV prop 转换：valueFormat → format
          if (props.valueFormat && !props.format) {
            props.format = props.valueFormat
          }
          // EP daterange → ADV RangePicker 不需要 type prop
          if (DateComp === RangePicker) {
            delete props.type
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(DateComp, props)
        },
      ],
      [
        'DatePicker',
        (hFn, model, { row }: FormInputCtx) => {
          const { component: DateComp, binding } = resolveDatePickerComponent(row.attrs as Record<string, unknown> || {})
          const props: Record<string, unknown> = {
            [binding.prop]: getNestedValue(model, row.prop),
            ...row.attrs,
            [binding.event]: (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (props.valueFormat && !props.format) {
            props.format = props.valueFormat
          }
          if (DateComp === RangePicker) {
            delete props.type
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(DateComp, props)
        },
      ],

      // ─── TimePicker ────────────────────────────────────────
      [
        'timePicker',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (props.valueFormat && !props.format) {
            props.format = props.valueFormat
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(TimePicker, props)
        },
      ],
      [
        'TimePicker',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (props.valueFormat && !props.format) {
            props.format = props.valueFormat
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(TimePicker, props)
        },
      ],

      // ─── Slider ────────────────────────────────────────────
      [
        'Slider',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(Slider, props)
        },
      ],

      // ─── ColorPicker — ADV 无内置, 使用 input[type=color] 降级 ──
      [
        'ColorPicker',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop) as string || '#000000',
            type: 'color',
            ...row.attrs,
            onInput: (e: Event) => {
              const val = (e.target as HTMLInputElement)?.value
              setNestedValue(model, row.prop, val)
            },
            style: {
              width: '42px',
              height: '32px',
              padding: '2px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              cursor: 'pointer',
              ...(row.attrs?.style as Record<string, unknown> || {}),
            },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn('input', props)
        },
      ],

      // ─── Transfer ──────────────────────────────────────────
      [
        'Transfer',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            targetKeys: getNestedValue(model, row.prop) as string[] || [],
            ...row.attrs,
            'onUpdate:targetKeys': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          // ADV Transfer 用 dataSource 替代 data
          if (props.data && !props.dataSource) {
            props.dataSource = props.data
            delete props.data
          }
          // ADV Transfer render 函数用 renderList 或通过 dataSource 的 title/description
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(Transfer, props)
        },
      ],

      // ─── Cascader ──────────────────────────────────────────
      [
        'Cascader',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            options: row.dataOptions,
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(Cascader, props)
        },
      ],

      // ─── Radio ─────────────────────────────────────────────
      [
        'Radio',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          const children = () =>
            (row.dataOptions || []).map((opt, idx) =>
              hFn(Radio, { key: idx, value: opt.value, disabled: opt.disabled }, () => opt.label)
            )
          return hFn(RadioGroup, props, children)
        },
      ],

      // ─── Checkbox ──────────────────────────────────────────
      [
        'Checkbox',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          const children = () =>
            (row.dataOptions || []).map((opt, idx) =>
              hFn(Checkbox, { key: idx, value: opt.value, disabled: opt.disabled }, () => opt.label)
            )
          return hFn(CheckboxGroup, props, children)
        },
      ],

      // ─── Switch — ADV 使用 checked/onUpdate:checked ────────
      [
        'Switch',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            checked: getNestedValue(model, row.prop) as boolean || false,
            ...row.attrs,
            'onUpdate:checked': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(Switch, props)
        },
      ],

      // ─── Rate ──────────────────────────────────────────────
      [
        'Rate',
        (hFn, model, { row }: FormInputCtx) => {
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop) as number || 0,
            ...row.attrs,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (row.on) {
            for (const [key, handler] of Object.entries(row.on)) {
              props[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }
          return hFn(Rate, props)
        },
      ],

      // ─── Upload — ADV 用 customRequest 替代 http-request ────
      [
        'Upload',
        (hFn, _model, { row }: FormInputCtx) => {
          const { props: uploadProps, httpRequest, triggerRender, fileRender, ...restRow } = row as FormItemOption & {
            props?: Record<string, unknown>
            httpRequest?: (options: Record<string, unknown>) => Promise<unknown>
            triggerRender?: (h: typeof hFn) => ReturnType<typeof hFn>
            fileRender?: (h: typeof hFn, file: Record<string, unknown>, onRemove: () => void) => ReturnType<typeof hFn>
          }

          let uploadInstance: { handleRemove?: (file: Record<string, unknown>) => void } | null = null

          // 构建 AUpload 属性
          const uploadCfg: Record<string, unknown> = {
            ...uploadProps,
            ...restRow.attrs,
            ref: (el: unknown) => {
              uploadInstance = el as typeof uploadInstance
            },
          }

          // EP http-request → ADV customRequest
          if (httpRequest) {
            uploadCfg.customRequest = httpRequest
          }

          // ADV showUploadList 替代 EP 的 show-file-list
          if (uploadCfg['show-file-list'] !== undefined && uploadCfg.showUploadList === undefined) {
            uploadCfg.showUploadList = uploadCfg['show-file-list']
          }

          // 事件转换
          if (restRow.on) {
            for (const [key, handler] of Object.entries(restRow.on)) {
              uploadCfg[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }

          // ADV Upload 插槽命名
          const slots: Record<string, (...args: unknown[]) => ReturnType<typeof hFn>> = {}

          if (triggerRender) {
            const listType = uploadCfg.listType || uploadCfg['list-type']
            if (listType === 'picture-card') {
              // ADV picture-card 模式，上传按钮用 #default slot 或用 showUploadList 控制
              slots.default = () => triggerRender(hFn)
            } else {
              slots.default = () => triggerRender(hFn)
            }
          }

          if (fileRender) {
            // ADV Upload 的 itemRender 自定义文件项
            ;(uploadCfg as any).itemRender = ({ file }: { file: Record<string, unknown> }) => {
              return fileRender(hFn, file, () => {
                uploadInstance?.handleRemove?.(file)
              })
            }
          }

          return hFn(Upload, uploadCfg, slots)
        },
      ],
    ])

    const renderer = formPutList.get(normalizedType)
    // 返回安全包装的渲染函数：捕获异常防止整个表单崩溃
    return renderer ? safeCall(renderer) : (() => null)
  }

  return { formInputComponents }
}

/**
 * 根据 attrs.type 解析 Input 组件变体
 *   textarea → ADV TextArea (通过 Input.TextArea)
 *   password → ADV InputPassword
 *   默认 → ADV Input
 */
function resolveInputComponent(attrs: Record<string, unknown>): {
  component: any
  binding: { prop: string; event: string }
} {
  const type = attrs.type as string | undefined
  if (type === 'textarea') {
    return { component: (Input as any).TextArea || Input, binding: V_MODEL_BINDING.Input }
  }
  if (type === 'password') {
    return { component: InputPassword, binding: V_MODEL_BINDING.Input }
  }
  return { component: Input, binding: V_MODEL_BINDING.Input }
}

export { getNestedValue, setNestedValue } from '../utils/shared'
