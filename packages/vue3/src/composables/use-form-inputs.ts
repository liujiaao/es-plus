import { h } from 'vue'
import {
  ElInput,
  ElInputNumber,
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
import { normalizeFormType, getNestedValue, setNestedValue, VALID_FORM_TYPES } from '@es-plus/core'
export { getNestedValue, setNestedValue } from '@es-plus/core'

/** 表单控件渲染回调的上下文参数类型（与 FormItemOption.render 的 ctx 一致） */
type FormInputCtx = { row: FormItemOption; index: number }

/**
 * 把事件名转换为 Vue 3 `h()` 需要的 `onXxx` 形式。
 * 已经是 `onXxx` 的键名原样返回，避免二次加前缀（例如 `onUpdate:modelValue`）。
 */
function toOnKey(key: string): string {
  return /^on[A-Z]/.test(key) ? key : `on${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

/**
 * 构建表单项透传给输入控件的属性：合并 `props` 与 `attrs`，并把 `on` 的事件名转成 `onXxx`。
 *
 * 这两处此前都是静默失效的坑：
 * - `props` 从未被展开，而 core 的 FormItemOption 文档承诺「Vue 3 适配器中 props 与 attrs
 *   会被合并到一起透传」，于是照着文档写的配置在 Vue 2 生效、在 Vue 3 无声丢弃；
 * - `on` 为裸展开，`{ change: fn }` 会被当作名为 change 的 prop 而非事件监听器，
 *   导致除 Upload 外的 13 种控件的 `on` 配置全部失效。
 *
 * 调用方需在返回值之后展开内部的 `onUpdate:modelValue`，由它接管双向绑定。
 */
function rowPassThrough(row: FormItemOption): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...row.props, ...row.attrs }
  if (row.on) {
    for (const [key, handler] of Object.entries(row.on)) {
      merged[toOnKey(key)] = handler
    }
  }
  // 显式双向绑定优先：剔除用户经 props/attrs/on 透传的 modelValue 与 onUpdate:modelValue。
  // 各控件分支把内部 modelValue 展开在 rowPassThrough 之前，若不移除，用户透传值会覆盖
  // 表单 model 绑定，输入框与 model 静默脱钩（文档约定「内部双向绑定优先」）。
  delete merged.modelValue
  delete merged['onUpdate:modelValue']
  // disabled 的函数形式求值（对齐 vue2 resolveAttrs / es-eui 约定，见 vue2 composables.spec.ts）：
  // 不求值的话函数会原样落到控件 disabled prop，函数恒为真值 → 控件被永久禁用，
  // 同一份 `attrs: { disabled: () => cond }` 配置在 vue2 可用、在 vue3 永久禁用（三端不一致）。
  if (typeof merged.disabled === 'function') {
    merged.disabled = (merged.disabled as () => unknown)()
  }
  return merged
}

export function useFormInputs() {
  const formInputComponents = (item: FormItemOption) => {
    const formPutList = new Map([
      [
        'Input',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElInput, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...rowPassThrough(row),
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
              ...rowPassThrough(row),
              'onUpdate:modelValue': (val: unknown) => {
                setNestedValue(model, row.prop, val)
              }
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(ElOption, { key: idx, value: opt.value as string, label: opt.label, disabled: opt.disabled })
              )
          )
        }
      ],
      [
        'InputNumber',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElInputNumber, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...rowPassThrough(row),
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
            ...rowPassThrough(row),
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
            ...rowPassThrough(row),
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Transfer',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          // dataOptions → ElTransfer 的 data。
          //
          // 三端里此前只有 vue3 **完全没消费** dataOptions：vue2 是
          //   data: dataOptions.map(opt => ({ key: opt.value, label: opt.label, disabled: opt.disabled }))
          // antdv 是 normalizeTransferDataSource（value→key、label→title、无 key 回落下标），
          // 而 vue3 只传了 modelValue 与透传袋 —— 于是穿梭框两侧永远是空的，
          // 配置写得再全也白搭，且解析/编译/门禁全绿。
          //
          // ElTransfer 的 data 项**必须带 key**（它才是选中态与回写的标识），而 dataOptions
          // 用的是 value，直接透传会让每项都缺 key。key 缺失时回落下标，与 antdv 的兜底一致。
          // 位置与 Cascader 的 `options` 同理：放在 rowPassThrough 之前，用户显式透传的
          // data 仍可覆盖（沿用「内部绑定在前、透传袋在后」的既有优先级）。
          const dataOptions = row.dataOptions as Array<Record<string, unknown>> | undefined
          return hFn(ElTransfer, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...(Array.isArray(dataOptions)
              ? {
                  data: dataOptions.map((opt, idx) => ({
                    ...opt,
                    key: opt.key ?? opt.value ?? String(idx)
                  }))
                }
              : {}),
            ...rowPassThrough(row),
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
            options: row.dataOptions as any,
            ...rowPassThrough(row),
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
              ...rowPassThrough(row),
              'onUpdate:modelValue': (val: unknown) => {
                setNestedValue(model, row.prop, val)
              }
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(ElRadio, { key: idx, value: opt.value as any, disabled: opt.disabled }, () => opt.label)
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
              ...rowPassThrough(row),
              'onUpdate:modelValue': (val: unknown) => {
                setNestedValue(model, row.prop, val)
              }
            },
            () =>
              row.dataOptions?.map((opt, idx) =>
                hFn(ElCheckbox, { key: idx, value: opt.value as any, disabled: opt.disabled }, () => opt.label)
              )
          )
        }
      ],
      [
        'Switch',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
          return hFn(ElSwitch, {
            modelValue: getNestedValue(model, row.prop) as any,
            ...rowPassThrough(row),
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
            ...rowPassThrough(row),
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
            ...rowPassThrough(row),
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
            ...rowPassThrough(row),
            'onUpdate:modelValue': (val: unknown) => {
              setNestedValue(model, row.prop, val)
            }
          })
        }
      ],
      [
        'Upload',
        (hFn: typeof h, model: Record<string, unknown>, { row }: FormInputCtx) => {
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
              elUploadProps[toOnKey(key)] = handler
            }
          }

          // 合并 httpRequest（优先用表单项配置的，其次用 props 中的）
          if (httpRequest) {
            elUploadProps['http-request'] = httpRequest
          }

          // ── file-list 与 model 的双向绑定 ──
          //
          // 此前这个分支**连 modelValue/file-list 都没绑**（直接把 elUploadProps 丢给 ElUpload），
          // 于是上传成功后 model[prop] 仍是初始值 —— 表单提交上去是空的，且不报错。
          // vue2 的实现（use-form-inputs.ts 的 Upload 分支）一直是完整的：三个生命周期回调
          // 都把列表 setNestedValue 写回。这里补齐到同水平。
          //
          // ElUpload 内部是 `useVModel(props, 'fileList', …, { passive: true })`（见 element-plus
          // 的 upload/src/use-handlers.mjs），等价于官方的 `v-model:file-list`：读 props.fileList
          // 作初值，每次变更通过 `update:fileList` 抛出。所以绑定这一个事件就够了；
          // onSuccess / onError / onRemove 只是**用户回调**的入口（它们都是 ElUpload 的
          // Function prop，不是 $emit 事件），这里接管它们以便在调用户回调的同时写回 model。
          //
          // 传 `[]` 而不是 undefined：ElUpload 的 uploadFiles 直接对 props.fileList 调 .find()，
          // 给 undefined 会让首屏渲染就抛。
          const modelFileList = getNestedValue(model, row.prop)
          elUploadProps.fileList = Array.isArray(modelFileList) ? modelFileList : []

          // 用户在 `on: { success | error | remove }` 里给的回调，已被上面的 toOnKey 循环
          // 转成同名 prop 写进了 elUploadProps —— 先取出来，避免下面的接管把它吃掉。
          const userOnSuccess = elUploadProps.onSuccess as
            | ((...args: unknown[]) => void)
            | undefined
          const userOnError = elUploadProps.onError as ((...args: unknown[]) => void) | undefined
          const userOnRemove = elUploadProps.onRemove as ((...args: unknown[]) => void) | undefined
          // 用户若直接绑了 update:fileList（少见但合法），同样不能丢
          const userOnUpdateFileList = elUploadProps['onUpdate:fileList'] as
            | ((list: unknown[]) => void)
            | undefined

          const writeBack = (list: unknown): void => {
            // 换新数组引用而不是原地改：Vue 2 的数组变异检测依赖它，Vue 3 下也无害
            setNestedValue(model, row.prop, Array.isArray(list) ? [...list] : [])
          }

          elUploadProps.onSuccess = (
            response: unknown,
            file: Record<string, unknown>,
            list: unknown[]
          ) => {
            userOnSuccess?.(response, file, list)
            writeBack(list)
          }
          elUploadProps.onError = (
            err: unknown,
            file: Record<string, unknown>,
            list: unknown[]
          ) => {
            userOnError?.(err, file, list)
            // 失败的文件 ElUpload 会 removeFile（use-handlers.mjs 的 handleError），
            // 随后的 update:fileList 会再写一次 —— 这里先写，保证同步路径上 model 也是最新的
            writeBack(list)
          }
          elUploadProps.onRemove = (file: Record<string, unknown>, list: unknown[]) => {
            userOnRemove?.(file, list)
            // 注意 ElUpload 的 doRemove 是「先 removeFile 再调 onRemove」，
            // 所以这里的 list 已经是移除后的列表
            writeBack(list)
          }
          elUploadProps['onUpdate:fileList'] = (list: unknown) => {
            userOnUpdateFileList?.(list as unknown[])
            writeBack(list)
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
    const resolved = formPutList.get(normalizeFormType(item.formtype || ''))
    if (!resolved && item.formtype) {
      warnUnknownFormType(String(item.formtype), String(item.prop ?? ''))
    }
    return resolved || (() => null)
  }

  return { formInputComponents }
}

/**
 * 未知 formtype 的告警（dev-only，按值去重）。
 *
 * 三端此前都写成 `formPutList.get(...) || (() => null)` —— 未知 formtype **静默**
 * 渲染成空。配置写错时（AI 生成、手写 JSON、从别端复制、文档里抄错）用户只看到
 * 「这个字段不见了」，没有任何线索指向 formtype；Playground 的「应用配置」也曾因此
 * 对非法配置报「已应用」。三端在这里统一告警，每种值只告一次以免刷屏。
 *
 * 生产构建下 `import.meta.env.DEV` 为 false，不产生日志。
 * （本文件内已有 `import.meta.env.DEV` 的用法先例，见 es-table 的 vxe-engine。）
 */
const warnedFormTypes = new Set<string>()
function warnUnknownFormType(formtype: string, prop: string): void {
  if (!import.meta.env.DEV || warnedFormTypes.has(formtype)) return
  warnedFormTypes.add(formtype)
  console.warn(
    `[es-plus] 未知的 formtype「${formtype}」${prop ? `（字段 ${prop}）` : ''}：该字段不会被渲染。` +
      `合法值：${VALID_FORM_TYPES.join(', ')}。`,
  )
}
