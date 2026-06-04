import { h } from 'vue'
import {
  ElInput,
  ElSelect,
  ElOption,
  ElDatePicker,
  ElTimePicker,
  ElSlider,
  ElColorPicker,
  ElTransfer,
  ElCascader,
  ElRadioGroup,
  ElRadio,
  ElCheckboxGroup,
  ElCheckbox,
  ElSwitch,
  ElRate,
  ElUpload
} from 'element-plus'
import type { FormItemOption } from '../types'
import { normalizeFormType } from '@es-plus/core'

/** 表单控件渲染回调的上下文参数类型（与 FormItemOption.render 的 ctx 一致） */
type FormInputCtx = { row: FormItemOption; index: number }

// 支持嵌套属性路径的取值和赋值
export const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  const keys = path.split(/\.|\[|\]/).filter(Boolean)
  let result = obj
  for (const key of keys) {
    if (result == null) return undefined
    result = result[key] as Record<string, unknown>
  }
  return result
}

export const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split(/\.|\[|\]/).filter(Boolean)
  const lastKey = keys.pop()
  let current: Record<string, unknown> = obj
  for (const key of keys) {
    if (current[key] == null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  if (lastKey) {
    current[lastKey] = value
  }
}

export function useFormInputs() {
  const formInputComponents = (item: FormItemOption) => {
    const formPutList = new Map([
      [
        'Input',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElInput, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Select',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(
            ElSelect,
            {
              modelValue: getNestedValue(model, row.prop) as any,
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val: unknown) => {
                setNestedValue(model, row.prop, val)
              }
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(ElOption, { key: idx, value: opt.value, label: opt.label })
              )
          )
        }
      ],
      [
        'datePicker',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElDatePicker, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'timePicker',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElTimePicker, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Slider',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElSlider, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'ColorPicker',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElColorPicker, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Transfer',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElTransfer, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Cascader',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElCascader, {
            modelValue: getNestedValue(model, row.prop) as any,
            options: row.dataOptions,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Radio',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(
            ElRadioGroup,
            {
              modelValue: getNestedValue(model, row.prop) as any,
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val: unknown) => {
                setNestedValue(model, row.prop, val)
              }
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(ElRadio, { key: idx, value: opt.value as any }, () => opt.label)
              )
          )
        }
      ],
      [
        'Checkbox',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(
            ElCheckboxGroup,
            {
              modelValue: getNestedValue(model, row.prop) as any,
              ...row.attrs,
              ...row.on,
              'onUpdate:modelValue': (val: unknown) => {
                setNestedValue(model, row.prop, val)
              }
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(ElCheckbox, { key: idx, value: opt.value as any }, () => opt.label)
              )
          )
        }
      ],
      [
        'Switch',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElSwitch, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Rate',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElRate, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'DatePicker',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElDatePicker, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'TimePicker',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElTimePicker, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...row.attrs,
            ...row.on,
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Upload',
        (hFn: typeof h, _model: Record<string, unknown>, { row }: FormInputCtx) => {
          const { props: uploadProps, httpRequest, triggerRender, fileRender, ...restRow } = row as FormItemOption & {
            props?: Record<string, unknown>
            httpRequest?: (options: Record<string, unknown>) => Promise<unknown>
            triggerRender?: (h: typeof hFn) => ReturnType<typeof hFn>
            fileRender?: (h: typeof hFn, file: Record<string, unknown>, onRemove: () => void) => ReturnType<typeof hFn>
          }

          let uploadInstance: { handleRemove: (file: Record<string, unknown>) => void } | null = null

          // 构建 ElUpload 属性
          const elUploadProps: Record<string, unknown> = {
            ...uploadProps,       // props 中的配置：action, accept, listType, limit, multiple 等
            ...restRow.attrs,     // attrs 中的配置（兼容两种方式）
            ref: (el: { handleRemove: (file: Record<string, unknown>) => void } | null) => {
              uploadInstance = el
            }
          }

          // 将 on 中的事件转换为 Vue 3 h() 需要的 onXxx 格式
          if (restRow.on) {
            for (const [key, handler] of Object.entries(restRow.on)) {
              elUploadProps[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = handler
            }
          }

          // 合并 httpRequest（优先用表单项配置的，其次用 props 中的）
          if (httpRequest) {
            elUploadProps['http-request'] = httpRequest
          }

          // Vue 3 h() 的 slots 参数：通过第三个参数传递命名插槽
          const slots: Record<string, (...args: unknown[]) => ReturnType<typeof hFn>> = {}

          // #trigger / #default 插槽
          if (triggerRender) {
            const listType = elUploadProps['listType'] || elUploadProps['list-type']
            if (listType === 'picture-card') {
              slots.trigger = () => triggerRender(hFn)
            } else {
              slots.default = () => triggerRender(hFn)
            }
          }

          // #file 插槽：自定义文件列表项渲染
          if (fileRender) {
            slots.file = ({ file }: { file: Record<string, unknown> }) => {
              return fileRender(hFn, file, () => {
                uploadInstance?.handleRemove(file)
              })
            }
          }

          return hFn(ElUpload, elUploadProps, slots)
        }
      ]
    ])
    return formPutList.get(normalizeFormType(item.formtype || '')) || (() => null)
  }

  return { formInputComponents }
}
