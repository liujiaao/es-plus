import { nextTick, toRaw, unref } from 'vue'
import {
  configFormField,
  formatConfigOut,
  getEveryFormQueryField as coreGetEveryFormQueryField,
  queryTableListMethod as coreQueryTableListMethod,
  type RequestConfig,
  type ConfigFormFieldOut,
} from '@es-plus/core'
import type { FormItemOption } from '../types'

export type { RequestConfig, ConfigFormFieldOut }

/** 解包 Vue 3 响应式 —— core 层不感知响应式，调用方须在传入前 unwrap */
function unwrap<T>(v: T): T {
  return toRaw(unref(v)) as T
}

/**
 * 表单 / 表格请求逻辑（Vue 3 薄适配层）
 *
 * 逻辑全部委托 @es-plus/core（单一权威源，见 core/src/request.ts）：
 *   - 本层只负责 Vue 3 特有的 toRaw/unref 响应式解包 + nextTick 初始化时机
 *   - 行为语义与 @es-plus/vue2 保持一致：responseTransform / crtn 接收"预提取列表"，
 *     与 callOptionListFormat 口径统一（见 core request.ts 的注释）
 */
export function useFormRequest(httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>) {
  /** 单条请求 —— 解包后委托 core */
  const queryTableListMethod = (params: Record<string, unknown>, options: RequestConfig = {}, _option?: FormItemOption) => {
    const unwrappedOptions: RequestConfig = options.apiParams
      ? {
          ...options,
          apiParams: {
            ...options.apiParams,
            model: unwrap(options.apiParams.model),
            options: unwrap(options.apiParams.options),
          },
        }
      : options
    return coreQueryTableListMethod(params, unwrappedOptions, httpRequestGlobal)
  }

  /** 批量拉取所有字段的远端选项 —— 解包后委托 core */
  const getEveryFormQueryField = async (
    rowsList: FormItemOption[],
    fieldFieldOutput?: (defaults: ConfigFormFieldOut) => ConfigFormFieldOut
  ) => {
    // 保留初始化时机：fall behind reactive flush 后再发请求
    await nextTick()
    const unwrappedList = Array.isArray(rowsList)
      ? rowsList.map((item) =>
          item && item.apiParams
            ? {
                ...item,
                apiParams: {
                  ...item.apiParams,
                  model: unwrap(item.apiParams.model),
                  options: unwrap(item.apiParams.options),
                },
              }
            : item
        )
      : rowsList
    return coreGetEveryFormQueryField(unwrappedList, httpRequestGlobal, fieldFieldOutput)
  }

  return {
    queryTableListMethod,
    getEveryFormQueryField,
    formatConfigOut,
    configFormField,
  }
}
