/**
 * Ant Design Vue 表单控件渲染映射
 *
 * 对齐 @es-plus/vue3 use-form-inputs.ts 的结构与行为：
 * - row.on 直接展开（...row.on），与 vue3 一致；Upload 仍用 onXxx 转换（对齐 vue3 Upload 分支）
 * - v-model 绑定字段按 ADV 各组件适配（value/checked/targetKeys）
 * - DatePicker/TimePicker value 必须 dayjs（ADV 4.x），toDayjsValue/fromDayjsValue 做防御转换；
 *   配置 valueFormat 时回写字符串（对齐 EP value-format），未配置则保留 dayjs（ADV 原生）——此为 ADV 必要偏离
 * - DatePicker 单选 type→ADV picker 映射；range→RangePicker
 * - EP Cascader props / Switch active-* / Rate texts→tooltips 等做 EP→ADV 字段映射
 * - Upload customRequest 替代 http-request；itemRender 用 actions.remove 替代 handleRemove
 */
import { h } from 'vue'
import dayjs from 'dayjs'
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
} from 'ant-design-vue'
import type { FormItemOption } from '../types'
import { normalizeFormType } from '@es-plus/core'
import { getNestedValue, setNestedValue, isObject } from '../utils/shared'

type FormInputCtx = { row: FormItemOption; index: number }

/**
 * ADV 各组件的 v-model 绑定字段映射
 * EP 统一用 modelValue / onUpdate:modelValue，ADV 各组件字段名不同
 */
const V_MODEL_BINDING: Record<string, { prop: string; event: string }> = {
  Input: { prop: 'value', event: 'onUpdate:value' },
  Select: { prop: 'value', event: 'onUpdate:value' },
  DatePicker: { prop: 'value', event: 'onUpdate:value' },
  RangePicker: { prop: 'value', event: 'onUpdate:value' },
  TimePicker: { prop: 'value', event: 'onUpdate:value' },
  Slider: { prop: 'value', event: 'onUpdate:value' },
  Rate: { prop: 'value', event: 'onUpdate:value' },
  Cascader: { prop: 'value', event: 'onUpdate:value' },
  Radio: { prop: 'value', event: 'onUpdate:value' },
  Checkbox: { prop: 'value', event: 'onUpdate:value' },
  Switch: { prop: 'checked', event: 'onUpdate:checked' },
  Transfer: { prop: 'targetKeys', event: 'onUpdate:targetKeys' },
}

/** 解析 EP 风格的值格式（valueFormat / value-format） */
function resolveValueFormat(attrs: Record<string, unknown>): string | undefined {
  return (attrs.valueFormat as string) || (attrs['value-format'] as string) || undefined
}

/**
 * model → ADV：把字符串/Date/数字转成 dayjs 对象
 * ADV 4.x DatePicker/RangePicker/TimePicker 的 value 必须是 dayjs，直接传字符串会触发
 * `date.locale is not a function`。dayjs 与 ant-design-vue 共用同一实例（构建时 externalize）。
 */
function toDayjsValue(value: unknown, fmt?: string): unknown {
  if (value == null || value === '') return value
  if (Array.isArray(value)) return value.map((v) => toDayjsValue(v, fmt))
  if (dayjs.isDayjs(value)) return value
  const parsed = value as string | number | Date
  return fmt ? dayjs(parsed, fmt) : dayjs(parsed)
}

/** ADV → model：按需把 dayjs 转回 model 期望的形态（配 fmt→字符串，未配→dayjs） */
function fromDayjsValue(value: unknown, fmt?: string): unknown {
  if (value == null || value === '') return value
  if (Array.isArray(value)) return value.map((v) => fromDayjsValue(v, fmt))
  if (dayjs.isDayjs(value)) return fmt ? value.format(fmt) : value
  return value
}

/** EP type → ADV picker 映射（单选模式） */
function epTypeToAdvPicker(type: string | undefined): string | undefined {
  const map: Record<string, string> = {
    date: 'date',
    datetime: 'date',
    month: 'month',
    year: 'year',
    week: 'week',
  }
  return type ? map[type] : undefined
}

/**
 * 解析 DatePicker 组件：range 类型→RangePicker；单选 type→picker + showTime
 */
function resolveDatePickerComponent(attrs: Record<string, unknown>): {
  component: any
  binding: { prop: string; event: string }
  picker?: string
  showTime?: boolean
} {
  const type = attrs.type as string | undefined
  if (type === 'daterange' || type === 'datetimerange' || type === 'monthrange' || type === 'yearrange') {
    return { component: RangePicker, binding: V_MODEL_BINDING.RangePicker, showTime: type === 'datetimerange' }
  }
  return {
    component: DatePicker,
    binding: V_MODEL_BINDING.DatePicker,
    picker: epTypeToAdvPicker(type),
    showTime: type === 'datetime',
  }
}

/**
 * 解析 Input 组件变体：textarea→Input.TextArea，password→InputPassword，默认→Input
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

export function useFormInputs() {
  const formInputComponents = (item: FormItemOption) => {
    const normalizedType = normalizeFormType(item.formtype || '')

    const formPutList = new Map<string, (hFn: typeof h, model: Record<string, unknown>, ctx: FormInputCtx) => ReturnType<typeof h>>([

      // ─── Input ─────────────────────────────────────────────
      [
        'Input',
        (hFn, model, { row }: FormInputCtx) => {
          const { component: InputComp, binding } = resolveInputComponent(row.attrs || {})
          return hFn(InputComp, {
            [binding.prop]: getNestedValue(model, row.prop),
            ...row.attrs,
            ...row.on,
            [binding.event]: (val: unknown) => { setNestedValue(model, row.prop, val) },
          })
        },
      ],

      // ─── Select ────────────────────────────────────────────
      [
        'Select',
        (hFn, model, { row }: FormInputCtx) => {
          return hFn(
            Select as any,
            {
              value: getNestedValue(model, row.prop),
              ...row.attrs,
              ...row.on,
              'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(SelectOption, { key: idx, value: opt.value, label: opt.label }),
              ),
          )
        },
      ],

      // ─── DatePicker (含 range→RangePicker，type→picker) ────
      [
        'datePicker',
        (hFn, model, { row }: FormInputCtx) => renderDatePicker(hFn, model, row),
      ],
      [
        'DatePicker',
        (hFn, model, { row }: FormInputCtx) => renderDatePicker(hFn, model, row),
      ],

      // ─── TimePicker (含 is-range→TimePicker.RangePicker) ───
      [
        'timePicker',
        (hFn, model, { row }: FormInputCtx) => renderTimePicker(hFn, model, row),
      ],
      [
        'TimePicker',
        (hFn, model, { row }: FormInputCtx) => renderTimePicker(hFn, model, row),
      ],

      // ─── Slider ────────────────────────────────────────────
      [
        'Slider',
        (hFn, model, { row }: FormInputCtx) => {
          return hFn(Slider, {
            value: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          })
        },
      ],

      // ─── ColorPicker — ADV 4.x 无内置，使用 input[type=color] 降级 ──
      [
        'ColorPicker',
        (hFn, model, { row }: FormInputCtx) => {
          const attrs = row.attrs || {}
          return hFn('input', {
            value: getNestedValue(model, row.prop) as string || '#000000',
            type: 'color',
            ...attrs,
            ...row.on,
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
              ...((attrs.style as Record<string, unknown>) || {}),
            },
          })
        },
      ],

      // ─── Transfer ──────────────────────────────────────────
      [
        'Transfer',
        (hFn, model, { row }: FormInputCtx) => {
          const attrs = row.attrs || {}
          const props: Record<string, unknown> = {
            targetKeys: getNestedValue(model, row.prop) as string[] || [],
            ...attrs,
            ...row.on,
            'onUpdate:targetKeys': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          // EP data → ADV dataSource
          if (props.data && !props.dataSource) {
            props.dataSource = props.data
            delete props.data
          }
          return hFn(Transfer, props)
        },
      ],

      // ─── Cascader (EP props → ADV fieldNames/changeOnSelect/multiple) ──
      [
        'Cascader',
        (hFn, model, { row }: FormInputCtx) => {
          const attrs = row.attrs || {}
          const props: Record<string, unknown> = {
            value: getNestedValue(model, row.prop),
            options: row.dataOptions,
            ...attrs,
            ...row.on,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          // EP Cascader 的 props 配置 → ADV 扁平字段
          const epProps = attrs.props as Record<string, unknown> | undefined
          if (isObject(epProps)) {
            if (epProps.multiple !== undefined && props.multiple === undefined) props.multiple = epProps.multiple
            if (epProps.checkStrictly !== undefined && props.checkStrictly === undefined) props.checkStrictly = epProps.checkStrictly
            if (epProps.expandTrigger !== undefined && props.expandTrigger === undefined) props.expandTrigger = epProps.expandTrigger
            if (epProps.emitPath === false && props.changeOnSelect === undefined) props.changeOnSelect = true
            if (epProps.label || epProps.value || epProps.children) {
              props.fieldNames = {
                label: epProps.label || 'label',
                value: epProps.value || 'value',
                children: epProps.children || 'children',
              }
            }
          }
          return hFn(Cascader, props)
        },
      ],

      // ─── Radio ─────────────────────────────────────────────
      [
        'Radio',
        (hFn, model, { row }: FormInputCtx) => {
          return hFn(
            RadioGroup,
            {
              value: getNestedValue(model, row.prop),
              ...row.attrs,
              ...row.on,
              'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(Radio, { key: idx, value: opt.value }, () => opt.label),
              ),
          )
        },
      ],

      // ─── Checkbox ──────────────────────────────────────────
      [
        'Checkbox',
        (hFn, model, { row }: FormInputCtx) => {
          return hFn(
            CheckboxGroup,
            {
              value: getNestedValue(model, row.prop) as any,
              ...row.attrs,
              ...row.on,
              'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(Checkbox, { key: idx, value: opt.value }, () => opt.label),
              ),
          )
        },
      ],

      // ─── Switch (EP active-*/inactive-* → ADV checked-*/un-checked-*) ──
      [
        'Switch',
        (hFn, model, { row }: FormInputCtx) => {
          const attrs = row.attrs || {}
          const props: Record<string, unknown> = {
            ...attrs,
            checked: getNestedValue(model, row.prop),
            ...row.on,
            'onUpdate:checked': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (attrs['active-value'] !== undefined && props['checked-value'] === undefined) {
            props['checked-value'] = attrs['active-value']
          }
          if (attrs['inactive-value'] !== undefined && props['un-checked-value'] === undefined) {
            props['un-checked-value'] = attrs['inactive-value']
          }
          if (attrs['active-text'] && !props['checked-children']) props['checked-children'] = attrs['active-text']
          if (attrs['inactive-text'] && !props['un-checked-children']) props['un-checked-children'] = attrs['inactive-text']
          return hFn(Switch, props)
        },
      ],

      // ─── Rate (EP texts→tooltips, max→count) ───────────────
      [
        'Rate',
        (hFn, model, { row }: FormInputCtx) => {
          const attrs = row.attrs || {}
          const props: Record<string, unknown> = {
            ...attrs,
            value: getNestedValue(model, row.prop),
            ...row.on,
            'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, val) },
          }
          if (attrs.texts && !props.tooltips) props.tooltips = attrs.texts
          if (attrs.max !== undefined && props.count === undefined) props.count = attrs.max
          return hFn(Rate, props)
        },
      ],

      // ─── Upload — ADV 用 customRequest 替代 http-request，itemRender 用 actions.remove ──
      [
        'Upload',
        (hFn, _model, { row }: FormInputCtx) => {
          const { props: uploadProps, httpRequest, triggerRender, fileRender, ...restRow } = row as FormItemOption & {
            props?: Record<string, unknown>
            httpRequest?: (options: Record<string, unknown>) => Promise<unknown>
            triggerRender?: (h: typeof hFn) => ReturnType<typeof hFn>
            fileRender?: (h: typeof hFn, file: Record<string, unknown>, onRemove: () => void) => ReturnType<typeof hFn>
          }

          // 构建 AUpload 属性
          const uploadCfg: Record<string, unknown> = {
            ...uploadProps,
            ...restRow.attrs,
          }

          // EP http-request → ADV customRequest（签名基本兼容，直接透传）
          if (httpRequest) {
            uploadCfg.customRequest = httpRequest
          }

          // EP show-file-list → ADV showUploadList；EP list-type → ADV listType
          if (uploadCfg['show-file-list'] !== undefined && uploadCfg.showUploadList === undefined) {
            uploadCfg.showUploadList = uploadCfg['show-file-list']
          }
          if (uploadCfg['list-type'] !== undefined && uploadCfg.listType === undefined) {
            uploadCfg.listType = uploadCfg['list-type']
          }

          // 事件转换（对齐 vue3 Upload 分支：onXxx 形式）
          if (restRow.on) {
            for (const [key, handler] of Object.entries(restRow.on)) {
              uploadCfg[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }

          // ADV Upload 插槽
          const slots: Record<string, (...args: unknown[]) => ReturnType<typeof hFn>> = {}
          if (triggerRender) {
            // ADV Upload 触发区用 #default slot（ADV 无 #trigger，必要偏离）
            slots.default = () => triggerRender(hFn)
          }
          if (fileRender) {
            // ADV itemRender 自定义文件项；onRemove 调用 actions.remove（ADV Upload 实例无 handleRemove）
            ;(uploadCfg as any).itemRender = ({ file, actions }: { file: Record<string, unknown>; actions?: { remove?: (file: unknown) => void } }) => {
              return fileRender(hFn, file, () => actions?.remove?.(file))
            }
          }

          return hFn(Upload, uploadCfg, slots)
        },
      ],
    ])

    return formPutList.get(normalizedType) || (() => null)
  }

  return { formInputComponents }
}

// ─── DatePicker / TimePicker 渲染（共享逻辑） ────────────────
function renderDatePicker(hFn: typeof h, model: Record<string, unknown>, row: FormItemOption) {
  const attrs = (row.attrs as Record<string, unknown>) || {}
  const { component: DateComp, binding, picker, showTime } = resolveDatePickerComponent(attrs)
  const fmt = resolveValueFormat(attrs)
  const props: Record<string, unknown> = {
    ...attrs,
    [binding.prop]: toDayjsValue(getNestedValue(model, row.prop), fmt),
    ...row.on,
    [binding.event]: (val: unknown) => { setNestedValue(model, row.prop, fromDayjsValue(val, fmt)) },
  }
  if (picker) props.picker = picker
  if (showTime) props.showTime = true
  // EP valueFormat → ADV format
  if (props.valueFormat && !props.format) {
    props.format = props.valueFormat
  }
  // ADV 不认 EP type
  delete props.type
  return hFn(DateComp as any, props)
}

function renderTimePicker(hFn: typeof h, model: Record<string, unknown>, row: FormItemOption) {
  const attrs = (row.attrs as Record<string, unknown>) || {}
  const isRange = attrs['is-range'] || attrs.isRange
  const TimeComp = isRange ? ((TimePicker as any).RangePicker || TimePicker) : TimePicker
  const fmt = resolveValueFormat(attrs)
  const props: Record<string, unknown> = {
    ...attrs,
    value: toDayjsValue(getNestedValue(model, row.prop), fmt),
    ...row.on,
    'onUpdate:value': (val: unknown) => { setNestedValue(model, row.prop, fromDayjsValue(val, fmt)) },
  }
  if (props.valueFormat && !props.format) {
    props.format = props.valueFormat
  }
  delete props['is-range']
  delete props.isRange
  return hFn(TimeComp as any, props)
}
