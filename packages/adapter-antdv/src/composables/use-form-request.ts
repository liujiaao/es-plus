/**
 * ADV 表单请求 — 完全对齐 @es-plus/vue3 的 use-form-request.ts
 *
 * 包含：查询、格式化、远程选项批量加载（带容错）。
 * ADV 版本与 vue3 版本逻辑完全一致，不依赖 Element Plus。
 */
import { nextTick, toRaw, unref } from 'vue'
import { isObject, findValueByKey, wrapPromise } from '../utils/shared'
import type { FormItemOption, ApiParams } from '../types'

export interface RequestConfig {
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  apiParams?: ApiParams
  success?: (res: Record<string, unknown>) => void
  fail?: (err: unknown) => void
  [key: string]: unknown
}

export function useFormRequest(
  httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>,
) {
  /** 单条请求 */
  const queryTableListMethod = (
    params: Record<string, unknown>,
    options: RequestConfig = {},
    _option?: FormItemOption,
  ) => {
    const { success, fail, ..._params } = options || {}
    if (
      isObject(options.apiParams) &&
      Object.keys(options.apiParams).length &&
      options.apiParams!.url
    ) {
      const initFormParams = {
        ...params,
        ...toRaw(unref(options.apiParams!.model || {})),
      }
      const requestOption = { ...toRaw(unref(options.apiParams!.options || {})) }
      if (options.apiParams!.method) {
        requestOption.method = options.apiParams!.method
      }

      const requestPayload = {
        url: options.apiParams!.url,
        headers: { ...(options.apiParams!.headers || {}) },
        formParams: initFormParams,
        ...requestOption,
      }

      const requestFn = options.httpRequest || httpRequestGlobal
      if (!requestFn) return

      requestFn(requestPayload)
        .then((res) => {
          if (
            typeof success === 'function' &&
            res &&
            (isObject(res) || Array.isArray(res))
          ) {
            success(res as Record<string, unknown>)
          }
        })
        .catch((e) => {
          if (typeof fail === 'function') fail(e)
        })
    }
  }

  /** 校验字段映射配置：obj 的每个键必须属于 4 个允许键且为 string（子集校验，对齐 vue3） */
  const checkQueryFields = (obj: Record<string, unknown>): boolean => {
    const checkListKey = ['total', 'pageSize', 'current', 'listData']
    if (isObject(obj)) {
      return Object.keys(obj).every(
        (it) => checkListKey.find((its) => its === it) && obj[it] && typeof obj[it] === 'string',
      )
    }
    return false
  }

  /** 获取字段映射配置 */
  const configFormField = (
    options: Record<string, unknown> = {},
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>,
  ) => {
    if (
      isObject(options.configFormOut) &&
      Object.keys(options.configFormOut).length &&
      checkQueryFields(options.configFormOut as Record<string, unknown>)
    ) {
      return options.configFormOut as Record<string, string>
    }

    if (typeof fieldFieldOutput === 'function') {
      const configFields = fieldFieldOutput({
        total: 'records',
        pageSize: 'pageSize',
        current: 'pageNo',
        listData: 'rows',
      })
      if (checkQueryFields(configFields)) return configFields
    }

    return { total: 'records', pageSize: 'pageSize', current: 'pageNo', listData: 'rows' }
  }

  /** 格式化响应数据 */
  const formatConfigOut = (
    row: Record<string, unknown>,
    keyList: string[],
    options: Record<string, unknown> = {},
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>,
  ) => {
    const configFieldOut = configFormField(options, fieldFieldOutput)
    const configDataOption: Record<string, unknown> = {}

    // 兼容直接返回数组的接口
    if (keyList.includes('listData') && Array.isArray(row)) {
      configDataOption['listData'] = row
      return configDataOption
    }

    if (isObject(configFieldOut) && Object.keys(configFieldOut).length) {
      for (const [key, value] of Object.entries(configFieldOut)) {
        const isKeyUsed = keyList.findIndex((it) => it === key)
        if (isKeyUsed === -1) continue

        const rowValue = row[value as string]
        if (rowValue !== undefined && rowValue !== null) {
          if (key === 'listData') {
            configDataOption[key] = Array.isArray(rowValue) ? rowValue : []
          } else {
            configDataOption[key] =
              typeof rowValue === 'number'
                ? rowValue
                : parseInt(rowValue as string, 10) || 0
          }
        } else {
          const resultData = findValueByKey(row, value as string)
          if (key === 'listData') {
            configDataOption[key] = Array.isArray(resultData) ? resultData : []
          } else {
            configDataOption[key] =
              typeof resultData === 'number'
                ? resultData
                : parseInt(resultData as string, 10) || 0
          }
        }
      }
    }
    return configDataOption
  }

  /** Promise 包装的单字段请求 */
  const httpRequestFormInstance = (
    model: Record<string, unknown>,
    options: RequestConfig,
    rows: FormItemOption,
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>,
  ) => {
    return new Promise<{
      data: Record<string, unknown>
      configRows: Record<string, unknown>
    }>((resolve, reject) => {
      nextTick(() => {
        queryTableListMethod(
          { pageIndex: 1, pageSize: 1000, ...(model || {}) },
          {
            ...(options || {}),
            success: (res) => {
              const configRows = formatConfigOut(
                res,
                ['total', 'listData'],
                rows as unknown as Record<string, unknown>,
                fieldFieldOutput,
              )
              resolve({ data: res, configRows })
            },
            fail: (err) => reject(err),
          },
          rows,
        )
      })
    })
  }

  /** 批量加载远程选项（容错） */
  const getEveryFormQueryField = async (
    rowsList: FormItemOption[],
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>,
  ) => {
    try {
      if (!Array.isArray(rowsList)) return []
      const apiUrlList = rowsList.filter(
        (it) =>
          it && it.apiParams && isObject(it.apiParams) && it.apiParams.url,
      )
      const apiResult: { prop: string; listData: unknown[] }[] = []

      const wrappedPromises = apiUrlList.map((option) => {
        const { httpRequest } = option
        const promiseThen = httpRequestFormInstance(
          { ...(option.apiParams?.model || {}) },
          {
            httpRequest,
            apiParams: option.apiParams,
            ...(option.apiParams?.options || {}),
          },
          option,
          fieldFieldOutput,
        )
        return wrapPromise(promiseThen)
      })

      const results = await Promise.all(wrappedPromises)

      results.forEach((item, index) => {
        if (item.status === 'fulfilled') {
          const { configRows, data } = item.value
          const option = apiUrlList[index]
          const listenToCallBack = option?.listenToCallBack as
            | Record<string, (params: unknown) => unknown>
            | undefined

          let listData: unknown[] = []
          // 优先使用 crtn 回调格式化数据
          if (listenToCallBack?.crtn) {
            listData = listenToCallBack.crtn(data) as unknown[]
          }
          // 降级使用 callOptionListFormat 或 dataOptions
          const newListOptions =
            Array.isArray(listData) && listData.length > 0
              ? listData
              : typeof option?.callOptionListFormat === 'function'
                ? option.callOptionListFormat(
                    (configRows?.listData as unknown[]) ||
                      option?.dataOptions ||
                      [],
                  )
                : undefined

          apiResult.push({
            prop: apiUrlList[index].prop,
            listData: Array.isArray(newListOptions)
              ? newListOptions
              : ((configRows?.listData as unknown[]) ||
                  apiUrlList[index]?.dataOptions ||
                  []),
          })
        }
      })
      return apiResult
    } catch {
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
