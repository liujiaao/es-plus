/**
 * 向后兼容适配层
 *
 * 集中管理旧 API → 新 API 的运行时桥接逻辑，
 * 确保旧写法在新版本中仍然可用。
 */

import type { BtnConfig, FormItemOption, ListenToCallBack, ModelData } from './types'
import { FORM_TYPE_ALIASES } from './constants'
import { resolveButtonSide } from './field-resolver'

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
 * 解析按钮位置（表格工具栏语义）—— 委托给唯一的解析入口。
 *
 * 这里此前是一份**独立实现**：
 *   `if (btn.position) return btn.position; if (btn.code === 2) return 'right'; return 'left'`
 * 与 `field-resolver.ts` 的同名函数（读 `resolveButtonSide(btn, 'table')`）在合法输入上
 * 完全同解，但非法输入分叉：配置来自手写 JSON / AI 生成时 `position` 完全可能是
 * `'center'`、`'top'` 这类不在类型里的值，那时本实现会把 `'center'` **原样返回**
 * （返回值类型写着 'left' | 'right'，是撒谎），于是 `isButtonRight` 与 `isButtonLeft`
 * 双双为 false —— 按钮在左右两栏里都不出现，静默消失，且不报错。
 * field-resolver 的 `only()` 会把非法值当成未配置，继续 fallback 到 code → left。
 *
 * `isButtonRight`/`isButtonLeft` 就是基于本函数的差集过滤（三端 table-btns.vue 用的
 * 是 `index.ts` 里 field-resolver 那一版 `getButtonPosition`，这两个辅助函数则只由
 * `resolveButtonPosition` 一族对外暴露），所以非法值的分叉只污染这几个导出。
 *
 * 委托后 `resolveButtonPosition` / `isButtonLeft` / `isButtonRight` 与
 * `getButtonPosition` / `splitToolbarButtonsByCode` 全部同解，非法值不再静默丢按钮。
 * 合法输入下行为逐字未变（原 4 条断言全部照常成立）。
 */
export function getButtonPosition(btn: BtnConfig): 'left' | 'right' {
  return resolveButtonSide(btn, 'table')
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
// 按钮配置透传过滤（单一权威源）
// ============================================================================

/**
 * 按钮编排字段：这些键 **不应** 随 v-bind 透传给底层按钮组件（el-button / a-button）。
 *
 * 分两类：
 * 1. es-plus 编排语义键（click/render/position/code/permissionValue/... / dialogKey / actionType）
 *    —— 属于配置协议，不是按钮组件的 prop。
 * 2. 各端模板已显式单独绑定/渲染的键（icon 用 getCompIcon 绑、disabled 求值后绑、name 作文本渲染）
 *    —— 再随 v-bind 摊一次会重复甚至冲突（如 disabled 的函数形被原样透传触发告警）。
 *
 * 最关键的是 `click`：它是函数，若透传到原生 <button>，Vue 会执行 `el.click = fn`
 * （因 `'click' in HTMLElement`），**遮蔽原生 HTMLElement.prototype.click()**，
 * 使程序化 `.click()` 调到无上下文的原始回调而非派发真实点击事件。
 */
export const BTN_ORCHESTRATION_KEYS = [
  'click', 'render', 'name', 'key', 'icon', 'disabled',
  'permissionValue', 'position', 'code', 'direction',
  'action', 'actionType', 'dialogKey', 'triggerEvent',
  'isHide', 'isHidden', 'hidden',
] as const

/**
 * 过滤按钮配置：剥离编排字段，仅保留可安全透传给底层按钮组件的 props
 * （type/size/loading/plain/round/... 及用户自定义 props）。
 *
 * @param btn 按钮配置对象
 * @param extraOmit 额外需剥离的键 —— 各端模板已显式绑定的键（如 table 工具栏另绑 :type/:size/:loading）
 * @returns 可安全 v-bind 到按钮组件的属性对象
 */
export function filterBtnProps(
  btn: Record<string, unknown>,
  extraOmit?: readonly string[]
): Record<string, unknown> {
  const omit = new Set<string>(BTN_ORCHESTRATION_KEYS as readonly string[])
  if (extraOmit) for (const k of extraOmit) omit.add(k)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(btn)) {
    if (!omit.has(k)) out[k] = v
  }
  return out
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
 * normalizeFormItem 需要的最小结构约束。
 *
 * 不直接收完整的 `FormItemOption`：三个渲染器各自特化了 `render` / `isHidden` 签名，
 * 与 core 的 `FormItemOption` 互不兼容（antdv / vue2 会编译失败）。本函数只用这四个字段，
 * 就只要求这四个字段 —— 与 `resolveItemValidateProps` 的处理方式同构。
 */
export interface FormItemShortcutSource {
  attrs?: Record<string, unknown>
  placeholder?: unknown
  clearable?: unknown
  disabled?: unknown
  // 允许其余字段（prop/label/render…）—— 否则对象字面量会被 excess property 检查拒绝
  [key: string]: unknown
}

/**
 * 归一化 FormItemOption：将顶层快捷属性合并到 attrs
 *
 * 规则：
 * - placeholder/clearable/disabled 等快捷属性自动注入到 attrs
 * - attrs 中已有的同名属性不会被覆盖（显式 attrs 优先）
 * - 原始顶层属性保留不删除（保持数据完整性）
 */
export function normalizeFormItem<T extends FormItemShortcutSource>(
  item: T
): T & { attrs?: Record<string, unknown> } {
  const merged = { ...item } as T & { attrs?: Record<string, unknown> }
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
export function normalizeFormItemList<T extends FormItemShortcutSource>(
  items: T[]
): Array<T & { attrs?: Record<string, unknown> }> {
  return items.map((item) => normalizeFormItem(item))
}
