/**
 * EsForm 请求 composable —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异：
 *   - nextTick 来源从 'vue' 改为 './vue-compat'
 *   - toRaw/unref 不再需要：Vue 2 的响应式对象天然是 plain object（仅在 setter 处被 wrapped），
 *     而我们在请求时只读取值，无需 unwrap
 *   - 核心格式化逻辑 100% 复用 @es-plus/core/request
 *
 * 该 composable 仅做 Vue 包装，所有数据转换都委托给 @es-plus/core。
 */

import { nextTick } from '../vue-compat'
import {
  queryTableListMethod as coreQueryTableListMethod,
  configFormField as coreConfigFormField,
  formatConfigOut as coreFormatConfigOut,
  httpRequestFormInstance as coreHttpRequestFormInstance,
  getEveryFormQueryField as coreGetEveryFormQueryField,
  type RequestConfig,
  type ConfigFormFieldOut,
} from '@es-plus/core'
import type { FormItemOption } from '@es-plus/core'

export type { RequestConfig, ConfigFormFieldOut }

export function useFormRequest(
  httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>
) {
  const queryTableListMethod = (
    params: Record<string, unknown>,
    options: RequestConfig = {}
  ) => coreQueryTableListMethod(params, options, httpRequestGlobal)

  const configFormField = (
    options: Record<string, unknown> = {},
    fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut
  ) => coreConfigFormField(options, fieldFieldOutput)

  const formatConfigOut = (
    row: Record<string, unknown> | unknown[],
    keyList: string[],
    options: Record<string, unknown> = {},
    fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut
  ) => coreFormatConfigOut(row, keyList, options, fieldFieldOutput)

  const httpRequestFormInstance = (
    model: Record<string, unknown>,
    options: RequestConfig,
    rows: FormItemOption,
    fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut
  ) =>
    // 与原 es-eui httpRquestFormInstace 一致：data 字段已剥一层 res.data，
    // 因此类型是 unknown（可能是数组、对象或 undefined）。
    new Promise<{ data: unknown; configRows: Record<string, unknown> }>((resolve, reject) => {
      nextTick(() => {
        coreHttpRequestFormInstance(model, options, rows, httpRequestGlobal, fieldFieldOutput)
          .then(resolve)
          .catch(reject)
      })
    })

  const getEveryFormQueryField = (
    rowsList: FormItemOption[],
    fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut
  ) => coreGetEveryFormQueryField(rowsList, httpRequestGlobal, fieldFieldOutput)

  return {
    queryTableListMethod,
    getEveryFormQueryField,
    formatConfigOut,
    configFormField,
  }
}
