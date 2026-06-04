/**
 * 字段/按钮解析逻辑（框架无关）
 *
 * 提取自 EsForm 与 EsTable 中的纯逻辑：
 *   - 表单字段隐藏过滤
 *   - 自动 span 计算
 *   - 工具栏按钮按 position/code 分左右
 *   - 旧 API：按 direction 分左右（EsForm 内置按钮使用）
 *   - 权限过滤
 *   - 按钮 disabled 状态归一化（支持函数形式）
 *
 * 这些函数完全不依赖 Vue / Element，渲染层只需调用即可。
 */

import type { BtnConfig, FormItemOption, ModelData } from './types'

// ============================================================================
// 表单字段过滤与 span 计算
// ============================================================================

/**
 * 根据 isHidden 函数过滤字段
 *
 * @param formItemList 字段列表
 * @param model 当前表单 model（传给 isHidden）
 * @param formProps 透传给 isHidden 的 form props 上下文
 */
export function filterVisibleFormItems(
  formItemList: FormItemOption[],
  model: ModelData,
  formProps: unknown
): FormItemOption[] {
  const normalized: Array<FormItemOption | null> = formItemList.map((it) =>
    it ? ({ ...it, dataOptions: it.dataOptions || [] } as FormItemOption) : null
  )
  return normalized.filter((it): it is FormItemOption => {
    if (!it) return false
    if (typeof it.isHidden === 'function') {
      return !it.isHidden(model, it, formProps)
    }
    return true
  })
}

/**
 * 计算自动 span 值
 *
 * 算法（与 EsForm 1.3.5 保持一致）：
 *   - 没有任何字段配 span：按字段数 1/2/3/N → 24/12/8/6
 *   - 部分字段配了 span：剩余空间 ÷ 未配置字段数，min 4 max 12
 *
 * @param visibleFormItemList 已过滤可见的字段列表
 * @returns 自动 span 数值（4-24 之间）
 */
export function calculateAutoSpan(visibleFormItemList: FormItemOption[]): number {
  const itemsWithoutSpan = visibleFormItemList.filter((it) => !it.span)
  const autoCount = itemsWithoutSpan.length
  if (autoCount === 0) return 6

  const fixedTotal = visibleFormItemList.reduce((sum, it) => sum + (it.span || 0), 0)
  if (fixedTotal === 0) {
    if (autoCount === 1) return 24
    if (autoCount === 2) return 12
    if (autoCount === 3) return 8
    return 6
  }

  const remaining = 24 - (fixedTotal % 24 || (fixedTotal ? 24 : 0))
  let autoSpan = remaining >= autoCount ? Math.floor(remaining / autoCount) : 6
  if (autoSpan > 12) autoSpan = 12
  if (autoSpan < 4) autoSpan = 6
  return autoSpan
}

/**
 * 把可见字段填上 span（对未配 span 的字段使用 autoSpan）
 *
 * @returns 浅复制后的字段列表，每项 span 字段必填
 */
export function applyAutoSpan(
  visibleFormItemList: FormItemOption[]
): Array<FormItemOption & { span: number }> {
  const autoSpan = calculateAutoSpan(visibleFormItemList)
  return visibleFormItemList.map((it) => ({ ...it, span: it.span || autoSpan }))
}

// ============================================================================
// 按钮分组与权限过滤
// ============================================================================

/**
 * 按 direction 字段把按钮分左右两组（EsForm 内置按钮使用）
 *
 * 默认（不配 direction）视为右侧。
 */
export function splitButtonsByDirection(buttons: BtnConfig[]): {
  colLeftBtn: BtnConfig[]
  colRightBtn: BtnConfig[]
} {
  return {
    colRightBtn: buttons.filter((it) => it.direction === 'right' || !it.direction),
    colLeftBtn: buttons.filter((it) => it.direction === 'left'),
  }
}

/**
 * 解析按钮位置 —— 优先 position，fallback code
 *
 * - position 字段优先（推荐，语义自解释）
 * - code 字段兜底（@deprecated 兼容旧 API）
 * - 两者都未配时默认 'left'
 */
export function getButtonPosition(btn: BtnConfig): 'left' | 'right' {
  if (btn.position) return btn.position
  // fallback: 旧 code 映射
  if (btn.code === 2) return 'right'
  return 'left'
}

/**
 * 按 position/code 字段把表格工具栏按钮分左右两组
 * - position: 'right' 或 code === 2 → 右侧
 * - position: 'left' 或 code === 1 或未配置 → 左侧
 *
 * 注意：未配 position/code 的按钮默认归到 left。
 */
export function splitToolbarButtonsByCode(buttons: BtnConfig[]): {
  leftBtns: BtnConfig[]
  rightBtns: BtnConfig[]
} {
  return {
    leftBtns: buttons.filter((it) => getButtonPosition(it) === 'left'),
    rightBtns: buttons.filter((it) => getButtonPosition(it) === 'right'),
  }
}

/**
 * 按权限校验函数过滤按钮
 *
 * @param buttons 按钮列表
 * @param permission 全局权限校验函数（返回 true 表示有权限）
 */
export function filterButtonsByPermission(
  buttons: BtnConfig[],
  permission?: (value: string) => boolean
): BtnConfig[] {
  if (typeof permission !== 'function') return buttons
  return buttons.filter((it) => {
    if (!it.permissionValue) return true
    return permission(it.permissionValue)
  })
}

/**
 * 处理按钮 isHide 状态（结合权限 + 函数式 isHide）
 *
 * 这是 EsTable table-btns 中 processButtonConfig 的纯化版本：
 * - 无权限 → isHide = true
 * - isHide 是函数 → 调用得到布尔
 * - 其它 → 直接转布尔
 *
 * @returns 浅复制后的按钮列表，每项 isHide 已被规范化为 boolean
 */
export function normalizeButtonsHideState(
  buttons: BtnConfig[],
  permission?: (value: string) => boolean
): Array<BtnConfig & { isHide: boolean }> {
  return buttons.map((item) => {
    const processed: BtnConfig & { isHide: boolean } = { ...item, isHide: false }
    const hasPerm =
      !item.permissionValue ||
      (typeof permission === 'function' ? permission(item.permissionValue) : true)

    if (!hasPerm) {
      processed.isHide = true
    } else if (typeof item.isHide === 'function') {
      processed.isHide = (item.isHide as () => boolean)()
    } else {
      processed.isHide = !!item.isHide
    }
    return processed
  })
}

/**
 * 解析按钮 disabled —— 支持布尔值或函数
 *
 * @param btn 按钮配置
 * @param model 当前 model（用于函数式 disabled）
 */
export function resolveButtonDisabled(btn: BtnConfig, model?: ModelData): boolean {
  if (typeof btn.disabled === 'function') {
    return !!(btn.disabled as (m?: ModelData) => boolean)(model)
  }
  return !!btn.disabled
}

// ============================================================================
// 后端响应字段映射 (ConfigTableOut)
// ============================================================================

/**
 * 把 ConfigTableOut（如 { tableData: 'rows', total: 'records' }）应用于一个响应对象
 *
 * 与 request.ts 中 formatConfigOut 的区别：
 * - 此函数面向表格（用 tableData 而不是 listData）
 * - 不做数字 parseInt 强转，保持原值
 * - 找不到时不会通过 findValueByKey 深搜，仅按平铺路径取
 *
 * 调用方：EsTable 在收到响应时把 { rows, records } 映射到 { tableData, total }
 */
export function applyConfigTableOut(
  response: Record<string, unknown> | unknown[],
  configTableOut: { total?: string; tableData?: string; pageSize?: string; current?: string }
): { tableData: unknown[]; total: number; pageSize?: number; current?: number } {
  // 数组响应直接作为 tableData，没有分页信息
  if (Array.isArray(response)) {
    return { tableData: response, total: response.length }
  }

  const totalKey = configTableOut.total || 'total'
  const dataKey = configTableOut.tableData || 'data'
  const pageSizeKey = configTableOut.pageSize
  const currentKey = configTableOut.current

  const result: ReturnType<typeof applyConfigTableOut> = {
    tableData: [],
    total: 0,
  }

  const rawList = (response as Record<string, unknown>)[dataKey]
  result.tableData = Array.isArray(rawList) ? rawList : []

  const rawTotal = (response as Record<string, unknown>)[totalKey]
  result.total = typeof rawTotal === 'number' ? rawTotal : parseInt(rawTotal as string, 10) || 0

  if (pageSizeKey) {
    const v = (response as Record<string, unknown>)[pageSizeKey]
    if (v !== undefined) {
      result.pageSize = typeof v === 'number' ? v : parseInt(v as string, 10) || undefined
    }
  }
  if (currentKey) {
    const v = (response as Record<string, unknown>)[currentKey]
    if (v !== undefined) {
      result.current = typeof v === 'number' ? v : parseInt(v as string, 10) || undefined
    }
  }

  return result
}
