/**
 * 向后兼容适配层
 *
 * 集中管理旧 API → 新 API 的运行时桥接逻辑，
 * 确保旧写法在新版本中仍然可用。
 */

import type { BtnConfig, FormItemOption, ListenToCallBack, ModelData } from './types'
import { FORM_TYPE_ALIASES } from './constants'

// ============================================================================
// FormType 归一化
// ============================================================================

/**
 * 将 FormType 归一化为 PascalCase
 * 旧写法（如 'datePicker'）会被转换为推荐写法（'DatePicker'），
 * 未知值原样返回。
 */
export function normalizeFormType(type: string): string {
  return FORM_TYPE_ALIASES[type] ?? type
}

// ============================================================================
// LayoutFormProps 兼容
// ============================================================================

/**
 * 从 LayoutFormProps 中读取表单布局配置
 * 优先读 formLayProps（正确拼写），fallback 到 fromLayProps（旧拼写）
 */
export function resolveFormLayProps(
  layoutProps?: { formLayProps?: Record<string, unknown>; fromLayProps?: Record<string, unknown> }
): Record<string, unknown> {
  if (!layoutProps) return {}
  return (layoutProps.formLayProps as Record<string, unknown>) ?? layoutProps.fromLayProps ?? {}
}

// ============================================================================
// 按钮位置兼容
// ============================================================================

/**
 * 解析按钮位置 —— 优先 position，fallback code
 *
 * - position 字段优先（推荐，语义自解释）
 * - code 字段兜底（@deprecated 兼容旧 API）
 * - 两者都未配时默认 'left'
 */
export function getButtonPosition(btn: BtnConfig): 'left' | 'right' {
  if (btn.position) return btn.position
  if (btn.code === 2) return 'right'
  return 'left'
}

/**
 * 判断按钮是否在右侧
 */
export function isButtonRight(btn: BtnConfig): boolean {
  return getButtonPosition(btn) === 'right'
}

/**
 * 判断按钮是否在左侧
 */
export function isButtonLeft(btn: BtnConfig): boolean {
  return getButtonPosition(btn) === 'left'
}

// ============================================================================
// 回调别名兼容
// ============================================================================

/**
 * 回调名映射：新名 → 旧名列表
 */
const CALLBACK_ALIASES: Record<string, string[]> = {
  responseTransform: ['crtn'],
  beforeRequest: ['brcb'],
  afterResponse: ['qrcb'],
}

/**
 * 反向映射缓存：旧名 → 新名
 */
const CALLBACK_REVERSE_ALIASES: Record<string, string> = {}
for (const [newName, oldNames] of Object.entries(CALLBACK_ALIASES)) {
  for (const old of oldNames) {
    CALLBACK_REVERSE_ALIASES[old] = newName
  }
}

/**
 * 从 ListenToCallBack 中获取回调函数
 * 优先新名称，fallback 旧名称，确保两种写法均可使用
 *
 * @param cb 回调映射对象
 * @param name 回调名（推荐新名称，也支持旧名称）
 * @returns 回调函数或 undefined
 */
export function getCallback(
  cb: ListenToCallBack | Record<string, (...args: unknown[]) => unknown> | undefined,
  name: string
): ((...args: unknown[]) => unknown) | undefined {
  if (!cb) return undefined

  // 1. 直接按名称查找
  const direct = cb[name]
  if (typeof direct === 'function') return direct

  // 2. 如果 name 是新名称，查找旧别名
  const aliases = CALLBACK_ALIASES[name]
  if (aliases) {
    for (const alias of aliases) {
      const fn = cb[alias]
      if (typeof fn === 'function') return fn
    }
  }

  // 3. 如果 name 是旧名称，查找新名称
  const newName = CALLBACK_REVERSE_ALIASES[name]
  if (newName) {
    const fn = cb[newName]
    if (typeof fn === 'function') return fn
  }

  return undefined
}

// ============================================================================
// FormItem 快捷属性合并
// ============================================================================

/**
 * FormItem 快捷属性列表
 * 这些属性可以被定义在 FormItemOption 顶层，
 * 内部会自动合并到 attrs 中（attrs 中已有的同名属性优先）
 */
const FORM_ITEM_SHORTCUT_KEYS = ['placeholder', 'clearable', 'disabled'] as const

/**
 * 归一化 FormItemOption：将顶层快捷属性合并到 attrs
 *
 * 规则：
 * - placeholder/clearable/disabled 等快捷属性自动注入到 attrs
 * - attrs 中已有的同名属性不会被覆盖（显式 attrs 优先）
 * - 原始顶层属性保留不删除（保持数据完整性）
 */
export function normalizeFormItem(item: FormItemOption): FormItemOption {
  const merged = { ...item }
  const mergedAttrs = { ...item.attrs }

  for (const key of FORM_ITEM_SHORTCUT_KEYS) {
    const value = item[key]
    if (value !== undefined && !(key in mergedAttrs)) {
      mergedAttrs[key] = value
    }
  }

  if (Object.keys(mergedAttrs).length > 0) {
    merged.attrs = mergedAttrs
  }

  return merged
}

/**
 * 批量归一化 FormItemOption 列表
 */
export function normalizeFormItemList(items: FormItemOption[]): FormItemOption[] {
  return items.map(normalizeFormItem)
}
