/**
 * ADV 表单请求 — 薄适配层，逻辑全部委托 @es-plus/core（单一权威源）
 *
 * 本层只负责 Vue 3 特有的 toRaw/unref 响应式解包 + nextTick 初始化时机；
 * 行为语义与 @es-plus/vue3 / @es-plus/vue2 完全一致：
 *   - responseTransform / crtn 接收"预提取列表"，与 callOptionListFormat 口径统一
 *   - 消除此前的本地分叉（crtn 拿原始响应、responseTransform 别名不生效、data 不剥层）
 */
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

export function useFormRequest(
  httpRequestGlobal?: (params: Record<string, unknown>) => Promise<unknown>,
) {
  /** 单条请求 —— 解包后委托 core */
  const queryTableListMethod = (
    params: Record<string, unknown>,
    options: RequestConfig = {},
    _option?: FormItemOption,
  ) => {
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
    fieldFieldOutput?: (defaults: Record<string, string>) => Record<string, string>,
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
    // antdv 本地 FormItemOption / Record<string,string> 与 core 的 FormItemOption /
    // ConfigFormFieldOut 类型存在差异（isHidden 签名等），运行时完全兼容，此处收敛到 core 时做类型断言。
    return coreGetEveryFormQueryField(
      unwrappedList as any,
      httpRequestGlobal,
      fieldFieldOutput as any,
    )
  }

  return {
    queryTableListMethod,
    getEveryFormQueryField,
    formatConfigOut,
    configFormField,
  }
}
