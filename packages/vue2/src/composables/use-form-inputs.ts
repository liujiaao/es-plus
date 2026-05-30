/**
 * Vue 2 + Element UI 表单输入适配器
 *
 * 与 Vue 3 + Element Plus 版本（packages/vue3/src/composables/use-form-inputs.ts）的核心差异：
 *
 * 1. h() 签名：
 *    - Vue 3：h(Comp, { modelValue, 'onUpdate:modelValue': fn, ...props })
 *    - Vue 2：h(Comp, { props: { value, ... }, on: { input, ... }, attrs: {...} })
 *
 * 2. v-model 实现：
 *    - Vue 3 默认 v-model 等价于 :modelValue + @update:modelValue
 *    - Vue 2 默认 v-model 等价于 :value + @input（原生输入框是 :value + @input；
 *      el-* 控件大多遵循该规范，少数有特殊 model 配置如 el-checkbox 用 checked/change）
 *
 * 3. 组件名：el-input / el-select / el-date-picker ...（kebab-case 字符串注册）
 *    - Element UI 通过 Vue.use(ElementUI) 全局注册了所有组件，可直接用字符串引用
 *
 * 4. 图标系统：Element UI 用 class（el-icon-xxx），不再使用图标组件
 *
 * 5. 嵌套属性 path：复用核心层的 getNestedValue / setNestedValue（Vue 2 中 setNestedValue
 *    需要配合 Vue.set 才能触发响应式 —— 由 EsForm 组件的 currentModel 经 reactive 包装解决）
 *
 * 用户保持一致的写法：
 *   {
 *     formtype: 'Input',
 *     prop: 'name',
 *     label: '姓名',
 *     attrs: { placeholder: '请输入', clearable: true },
 *     on: { input: (val) => console.log(val) }
 *   }
 *
 * 这样无论是 Vue 2 还是 Vue 3 项目，配置 schema 完全一致 —— 只有内部渲染层做差异化处理。
 */

import { getNestedValue, setNestedValue } from '@es-plus/core'
import type { FormItemOption, ModelData } from '@es-plus/core'

/**
 * Vue 2 createElement 函数类型
 * 来自 Vue 实例的 $createElement 或 render 函数的第一参数
 */
export type CreateElement = (tag: string | object, dataOrChildren?: unknown, children?: unknown) => unknown

/**
 * 表单输入渲染函数签名
 * - h：createElement 函数（Vue 2）
 * - model：当前 model 数据（响应式对象，需通过 setNestedValue 写入以触发响应式）
 * - ctx：包含 row（当前 FormItemOption）的上下文
 */
export type FormInputRenderer = (
  h: CreateElement,
  model: ModelData,
  ctx: { row: FormItemOption; index?: number }
) => unknown

/**
 * 解析 dataOptions：支持 Array 或 () => Array 两种形式
 */
function resolveDataOptions(dataOptions: FormItemOption['dataOptions'] | (() => unknown[])): Array<{
  label: string
  value: unknown
  disabled?: boolean
  children?: unknown[]
}> {
  if (Array.isArray(dataOptions)) return dataOptions
  if (typeof dataOptions === 'function') {
    const result = (dataOptions as () => unknown)()
    return Array.isArray(result) ? (result as Array<{ label: string; value: unknown }>) : []
  }
  return []
}

/**
 * 解析 attrs，特别处理 disabled 函数形式（与 es-eui 保持一致）
 */
function resolveAttrs(row: FormItemOption): Record<string, unknown> {
  const attrs: Record<string, unknown> = { ...(row.attrs || {}) }
  if (typeof attrs.disabled === 'function') {
    attrs.disabled = (attrs.disabled as () => boolean)()
  }
  return attrs
}

/**
 * 构造统一的事件监听器对象：
 * - 默认 input 事件用于 v-model 同步（写回 model）
 * - 用户配置的 input 优先（可拦截/转换值）
 * - 其它事件（focus/blur/change...）原样透传
 */
function buildEventHandlers(
  row: FormItemOption,
  defaultInputHandler: (val: unknown) => void
): Record<string, unknown> {
  const userOn = (row.on || {}) as Record<string, unknown>
  const handlers: Record<string, unknown> = {}

  for (const [key, handler] of Object.entries(userOn)) {
    if (typeof handler === 'function') {
      handlers[key] = handler
    }
  }

  // 用户没显式配置 input 时，绑定默认写回逻辑
  if (typeof handlers.input !== 'function') {
    handlers.input = defaultInputHandler
  }

  return handlers
}

/**
 * 创建一个表单输入渲染器映射
 *
 * 与 Vue 3 版本通过 useFormInputs() composable 调用一致；
 * Vue 2 中也提供同名函数以保证 API 一致性，方便未来共享代码。
 */
export function useFormInputs() {
  const formInputComponents = (item: FormItemOption): FormInputRenderer => {
    const formPutList = new Map<string, FormInputRenderer>([
      // ─────────────────────────────────────────────────────────────────
      // Input - 文本输入
      // ─────────────────────────────────────────────────────────────────
      [
        'Input',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-input', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // InputNumber - 数字输入（保留兼容 es-eui 的扩展类型）
      // ─────────────────────────────────────────────────────────────────
      [
        'InputNumber',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-input-number', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Select - 下拉选择
      // ─────────────────────────────────────────────────────────────────
      [
        'Select',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const dataOptions = resolveDataOptions(row.dataOptions as never)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h(
            'el-select',
            {
              attrs,
              props: { value, ...row.props },
              on: handlers,
            },
            dataOptions.map((opt, idx) =>
              h('el-option', {
                key: idx,
                props: { value: opt.value, label: opt.label, disabled: opt.disabled },
              })
            )
          )
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // datePicker - 日期选择（注意 Vue 3 用大写 DatePicker，Vue 2 用 datePicker；
      //             这里 Map key 跟 Vue 3 版本对齐，使用 'datePicker'）
      // ─────────────────────────────────────────────────────────────────
      [
        'datePicker',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-date-picker', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // timePicker - 时间选择
      // ─────────────────────────────────────────────────────────────────
      [
        'timePicker',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-time-picker', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Slider - 滑块
      // ─────────────────────────────────────────────────────────────────
      [
        'Slider',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-slider', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // ColorPicker - 颜色选择
      // Element UI 的 el-color-picker 使用 v-model 默认 prop 为 'value'，事件 'change'/'active-change'
      // 但同时支持 input 事件透传，这里保持 input 用作默认写回
      // ─────────────────────────────────────────────────────────────────
      [
        'ColorPicker',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          // ColorPicker 没有 input 事件，使用 change 作为默认写回
          const userOn = (row.on || {}) as Record<string, unknown>
          const handlers: Record<string, unknown> = {}
          for (const [key, handler] of Object.entries(userOn)) {
            if (typeof handler === 'function') handlers[key] = handler
          }
          if (typeof handlers.change !== 'function') {
            handlers.change = (val: unknown) => setNestedValue(model, row.prop, val)
          }
          return h('el-color-picker', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Transfer - 穿梭框
      // Element UI 中 el-transfer 默认 v-model 为 :value + @input，data 通过 props 传入
      // ─────────────────────────────────────────────────────────────────
      [
        'Transfer',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const dataOptions = resolveDataOptions(row.dataOptions as never)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-transfer', {
            attrs,
            props: {
              value,
              data: dataOptions.map((opt) => ({ key: opt.value, label: opt.label, disabled: opt.disabled })),
              ...row.props,
            },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Cascader - 级联选择
      // ─────────────────────────────────────────────────────────────────
      [
        'Cascader',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const dataOptions = resolveDataOptions(row.dataOptions as never)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-cascader', {
            // key 强制 dataOptions 变化时重渲染，Element UI 内部 cache 否则不刷新
            key: JSON.stringify(dataOptions),
            attrs,
            props: {
              value,
              options: dataOptions,
              ...row.props,
            },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Radio - 单选组
      // ─────────────────────────────────────────────────────────────────
      [
        'Radio',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const dataOptions = resolveDataOptions(row.dataOptions as never)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h(
            'el-radio-group',
            {
              attrs,
              props: { value, ...row.props },
              on: handlers,
            },
            dataOptions.map((opt, idx) =>
              h(
                'el-radio',
                {
                  key: idx,
                  // Element UI 中 el-radio 使用 :label 作为值
                  props: { label: opt.value, disabled: opt.disabled || (attrs.disabled as boolean) },
                },
                [opt.label]
              )
            )
          )
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Checkbox - 复选组
      // ─────────────────────────────────────────────────────────────────
      [
        'Checkbox',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const dataOptions = resolveDataOptions(row.dataOptions as never)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h(
            'el-checkbox-group',
            {
              attrs,
              props: { value, ...row.props },
              on: handlers,
            },
            dataOptions.map((opt, idx) =>
              h(
                'el-checkbox',
                {
                  key: idx,
                  props: { label: opt.value, disabled: opt.disabled || (attrs.disabled as boolean) },
                },
                [opt.label]
              )
            )
          )
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Switch - 开关
      // ─────────────────────────────────────────────────────────────────
      [
        'Switch',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          // Element UI 的 el-switch 默认 v-model 用 :value + @input
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-switch', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Rate - 评分
      // ─────────────────────────────────────────────────────────────────
      [
        'Rate',
        (h, model, { row }) => {
          const attrs = resolveAttrs(row)
          const value = getNestedValue(model, row.prop)
          const handlers = buildEventHandlers(row, (val) => setNestedValue(model, row.prop, val))
          return h('el-rate', {
            attrs,
            props: { value, ...row.props },
            on: handlers,
          })
        },
      ],

      // ─────────────────────────────────────────────────────────────────
      // Upload - 上传（最复杂的一个，需处理 fileList、httpRequest、自定义 trigger 等）
      // ─────────────────────────────────────────────────────────────────
      [
        'Upload',
        (h, model, { row }) => {
          const prop = row.prop
          const attrs = resolveAttrs(row)
          const userProps = (row.props || {}) as Record<string, unknown>
          const userOn = (row.on || {}) as Record<string, unknown>
          const fileList = (getNestedValue(model, prop) as unknown[]) || []

          const isCustomUpload = typeof row.httpRequest === 'function'

          // 用户配置 trigger 渲染（picture-card 模式 / 普通模式 都用 default slot 占位）
          const triggerRender = (row as FormItemOption & {
            triggerRender?: (h: CreateElement) => unknown
          }).triggerRender
          const fileRender = (row as FormItemOption & {
            fileRender?: (h: CreateElement, file: unknown, onRemove: () => void) => unknown
          }).fileRender

          // 默认 trigger 按钮（size 与 EsForm 默认 mini 对齐，避免视觉割裂）
          const triggerVnode = triggerRender
            ? triggerRender(h)
            : h('el-button', { props: { size: 'mini', type: 'primary' } }, ['选择文件'])

          // ── 上传成功处理（与 es-eui 保持一致的字段抽取规则） ──
          const processSuccess = (response: Record<string, unknown> | undefined, file: Record<string, unknown>, list: unknown[]) => {
            const url =
              (response?.link as string) ||
              (response?.url as string) ||
              ((response?.data as Record<string, unknown> | undefined)?.link as string) ||
              ((response?.data as Record<string, unknown> | undefined)?.url as string)

            if (url) file.url = url
            file.status = 'success'
            file.response = response

            if (typeof userOn.success === 'function') {
              ;(userOn.success as (...a: unknown[]) => void)(response, file, list)
            }
            // 触发响应式更新（替换为新数组引用以让 Vue 2 检测变化）
            setNestedValue(model, prop, [...list])
          }

          const processError = (err: unknown, file: Record<string, unknown>, list: unknown[]) => {
            file.status = 'fail'
            file.error = err
            if (typeof userOn.error === 'function') {
              ;(userOn.error as (...a: unknown[]) => void)(err, file, list)
            }
            setNestedValue(model, prop, [...list])
          }

          // ── 自定义 httpRequest 包装：el-upload 的 http-request 接收 { file, onSuccess, onError, onProgress } ──
          const httpRequestProp = isCustomUpload
            ? (options: { file: File; onSuccess: (res: unknown) => void; onError: (err: unknown) => void; onProgress?: (e: { percent: number }) => void }) => {
                const customRequest = row.httpRequest as (params: Record<string, unknown>) => Promise<unknown>
                customRequest({
                  file: options.file,
                  filename: options.file.name,
                  onProgress: options.onProgress,
                })
                  .then((res) => {
                    const resp = (res as Record<string, unknown>)?.data || res
                    options.onSuccess(resp)
                  })
                  .catch((err) => options.onError(err))
              }
            : undefined

          /**
           * Element UI 的 <el-upload> 把所有上传生命周期回调都暴露为 Function 类型 prop
           * （onPreview / onSuccess / onChange / onRemove / onError / onProgress / onExceed），
           * 而非通过 $emit 派发事件 —— 因此用户写 `on: { preview }` 在 Vue 2 render 函数里
           * 等价于 `v-on:preview`，永远不会触发（el-upload 不会 $emit('preview')）。
           *
           * 关键点：onPreview 在 Element UI 中**没有 noop 默认值**，
           * 当 prop 缺失时 upload-list 的 `v-if="handlePreview"` 为 false，
           * picture-card 模式下的"预览（放大镜）"图标会被隐藏 —— 这就是用户报的 bug。
           *
           * 修复：把 row.on 中的回调按 camelCase 转为 prop（key → onKey）。
           */
          const eventToProp: Record<string, string> = {
            preview: 'onPreview',
            change: 'onChange',
            success: 'onSuccess',
            error: 'onError',
            progress: 'onProgress',
            remove: 'onRemove',
            exceed: 'onExceed',
          }
          const uploadCallbackProps: Record<string, unknown> = {}
          for (const [key, handler] of Object.entries(userOn)) {
            if (typeof handler !== 'function') continue
            // success / error / remove 由我们包装后再写入，跳过原始用户函数
            if (key === 'success' || key === 'error' || key === 'remove') continue
            const propName = eventToProp[key]
            if (propName) uploadCallbackProps[propName] = handler
          }
          // 始终接管 success / error / remove —— 既调用用户回调，也同步 fileList 到 model
          uploadCallbackProps.onSuccess = processSuccess
          uploadCallbackProps.onError = processError
          uploadCallbackProps.onRemove = (file: Record<string, unknown>, list: unknown[]) => {
            if (typeof userOn.remove === 'function') {
              ;(userOn.remove as (...a: unknown[]) => void)(file, list)
            }
            setNestedValue(model, prop, [...list])
          }

          // 主体
          return h(
            'el-upload',
            {
              attrs: {
                ...attrs,
                action: (userProps.action as string) || (attrs.action as string) || '#',
                'file-list': fileList,
              },
              props: {
                ...userProps,
                fileList,
                // 自定义上传时禁用 auto-upload，由 httpRequest 接管
                autoUpload: isCustomUpload ? false : (userProps.autoUpload !== false),
                httpRequest: httpRequestProp,
                // 把 row.on.* 转换为 onXxx prop（覆盖在 userProps 之上：
                // 若用户已直接在 props 里给了 onPreview，这里仍以 row.on 为优先权来源）
                ...uploadCallbackProps,
              },
              // Vue 2 的 scopedSlots 用于自定义文件项渲染
              scopedSlots: fileRender
                ? {
                    file: ({ file }: { file: Record<string, unknown> }) =>
                      fileRender(h, file, () => {
                        const newList = fileList.filter((f) => f !== file)
                        setNestedValue(model, prop, newList)
                      }),
                  }
                : undefined,
            },
            [triggerVnode]
          )
        },
      ],
    ])

    /**
     * formtype 大小写兼容查找：
     *   - Vue 3 版本约定 `datePicker` / `timePicker` 用 camelCase，其它用 PascalCase
     *   - 原 es-eui 历史上一律使用 PascalCase（`DatePicker` / `TimePicker`）
     * 为了让旧 es-eui 案例无修改即可使用 @es-plus/vue2，这里做大小写兼容：
     *   1) 精确匹配（保持 Vue 3 习惯）
     *   2) 首字母翻转再试一次（覆盖 'DatePicker' ↔ 'datePicker' 这类差异）
     *   3) 全表 case-insensitive 兜底
     * 都未命中则返回空渲染器。
     */
    const formtype = (item.formtype ?? '') as string
    if (!formtype) return (): unknown => null

    const direct = formPutList.get(formtype)
    if (direct) return direct

    const flipped = formtype[0]
      ? (formtype[0] === formtype[0].toLowerCase()
          ? formtype[0].toUpperCase() + formtype.slice(1)
          : formtype[0].toLowerCase() + formtype.slice(1))
      : formtype
    const flippedHit = formPutList.get(flipped)
    if (flippedHit) return flippedHit

    const lower = formtype.toLowerCase()
    for (const [key, val] of formPutList) {
      if (key.toLowerCase() === lower) return val
    }
    return (): unknown => null
  }

  return { formInputComponents }
}
