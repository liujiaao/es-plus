import { nextTick, toRaw, unref } from 'vue'
import { isObject, wrapPromise } from '../utils/shared'
import {
  configFormField,
  formatConfigOut,
  type RequestConfig,
  type ConfigFormFieldOut,
} from '@es-plus/core'
import type { FormItemOption } from '../types'

export type { RequestConfig, ConfigFormFieldOut }

export function useFormRequest(httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>) {
  /**
   * 单条请求 — 保留 toRaw/unref 以正确处理 Vue 3 响应式 model/options
   * （core 层不感知响应式，调用方须在传入前 unwrap）
   */
  const queryTableListMethod = (params: Record<string, unknown>, options: RequestConfig = {}, _option?: FormItemOption) => {
    const { success, fail } = options || {}
    if (isObject(options.apiParams) && Object.keys(options.apiParams).length && options.apiParams.url) {
      const initFormParams = { ...params, ...toRaw(unref(options.apiParams.model || {})) }
      const requestOption = { ...toRaw(unref(options.apiParams.options || {})) }
      if (options.apiParams.method) {
        requestOption.method = options.apiParams.method
      }

      const requestPayload = {
        url: options.apiParams.url,
        headers: { ...(options.apiParams.headers || {}) },
        formParams: initFormParams,
        ...requestOption
      }

      const requestFn = options.httpRequest || httpRequestGlobal
      if (!requestFn) return

      requestFn(requestPayload)
        .then((res) => {
          if (typeof success === 'function' && res && (isObject(res) || Array.isArray(res))) {
            success(res as Record<string, unknown>)
          }
        })
        .catch((e) => {
          if (typeof fail === 'function') {
            fail(e)
          }
        })
    }
  }

  const httpRequestFormInstance = (model: Record<string, unknown>, options: RequestConfig, rows: FormItemOption, fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>) => {
    return new Promise<{ data: Record<string, unknown>; configRows: Record<string, unknown> }>((resolve, reject) => {
      nextTick(() => {
        queryTableListMethod(
          { pageIndex: 1, pageSize: 1000, ...(model || {}) },
          {
            ...(options || {}),
            success: (res) => {
              const configRows = formatConfigOut(res, ['total', 'listData'], rows as unknown as Record<string, unknown>, fieldFieldOutput as unknown as ((defaults: ConfigFormFieldOut) => ConfigFormFieldOut) | undefined)
              resolve({ data: res, configRows })
            },
            fail: (err) => {
              reject(err)
            }
          },
          rows
        )
      })
    })
  }

  const getEveryFormQueryField = async (rowsList: FormItemOption[], fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>) => {
    try {
      if (!Array.isArray(rowsList)) return []
      const apiUrlList = rowsList.filter((it) => it && it.apiParams && isObject(it.apiParams) && it.apiParams.url)
      const apiResult: { prop: string; listData: unknown[] }[] = []

      const wrappedPromises = apiUrlList.map((option) => {
        const { httpRequest } = option
        const promiseThen = httpRequestFormInstance(
          { ...(option.apiParams?.model || {}) },
          { httpRequest, apiParams: option.apiParams, ...(option.apiParams?.options || {}) },
          option,
          fieldFieldOutput
        )
        return wrapPromise(promiseThen)
      })

      const results = await Promise.all(wrappedPromises)

      results.forEach((item, index) => {
        if (item.status === 'fulfilled') {
          const { configRows, data } = item.value
          const option = apiUrlList[index]
          const listenToCallBack = option?.listenToCallBack as Record<string, (params: unknown) => unknown> | undefined

          let listData: unknown[] = []
          if (listenToCallBack?.crtn) {
            listData = listenToCallBack.crtn(data) as unknown[]
          }

          const newListOptions =
            Array.isArray(listData) && listData.length > 0
              ? listData
              : typeof option?.callOptionListFormat === 'function'
                ? option.callOptionListFormat(configRows?.listData as unknown[] || option?.dataOptions || [])
                : undefined

          apiResult.push({
            prop: apiUrlList[index].prop,
            listData: Array.isArray(newListOptions) ? newListOptions : (configRows?.listData as unknown[] || apiUrlList[index]?.dataOptions || [])
          })
        }
      })
      return apiResult
    } catch (e) {
      return []
    }
  }

  return {
    queryTableListMethod,
    getEveryFormQueryField,
    formatConfigOut,
    configFormField,
  }
}
