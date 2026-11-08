/**
 * 表单详情（只读）展示解析 —— 声明式详情模式的**单一权威实现**。
 *
 * 为什么放在 core：同一份 `formItemList` 在 edit / detail 两种模式下必须给出相同的
 * 标签与布局，差异只在「值怎么展示」。把「码值 → 文案、日期 → 文本、空值 → 占位」
 * 写进三端模板，最先漂移的一定是空值兜底与选项匹配（表格单元格就踩过这个坑，
 * 见 `table-cell.ts`）。三端只消费这里的结果，渲染自己的一个 `<span>`。
 *
 * 规则（三端同规）：
 *   1. 取 `model[prop]`（支持 `a.b` / `list[0].name` 嵌套路径）；
 *   2. 空值（`null` / `undefined` / `''` / 空数组）→ `item.emptyPlaceholder`，缺省 `'-'`；
 *   3. 数组值：Cascader 的层级路径（options 带 `children`）逐层取标签后用 ` / ` 连接；
 *      其余（多选 / Checkbox 组 / Transfer）逐项映射标签后用 `、` 连接；
 *   4. 标量值命中 `dataOptions` → 选项 `label`（`looseEqual` 宽松比较，1 命中 "1"）；
 *   5. 未命中 → 标量字符串化（`Date` 格式化为 `YYYY-MM-DD[ HH:mm:ss]`）。
 *
 * 未命中**不回退成占位符**：没登记的新码值仍要能看见，与表格单元格同规。
 */

import type { FormDataOption, FormItemOption, ModelData } from './types.js'
import { getNestedValue } from './shared.js'
import { looseEqual } from './expr.js'

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * `Date` → `YYYY-MM-DD HH:mm:ss`；时分秒全为 0 时只输出 `YYYY-MM-DD`。
 *
 * 用本地时间而不是 `toISOString()`：日期选择器写入的是本地语义的 Date，
 * UTC 序列化在东八区会把 `2026-11-08 00:00:00` 显示成前一天 16:00。
 */
export function formatDetailDate(value: Date): string {
  const date = `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
  const h = value.getHours()
  const m = value.getMinutes()
  const s = value.getSeconds()
  if (h === 0 && m === 0 && s === 0) return date
  return `${date} ${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function formatScalar(value: unknown): string {
  if (value instanceof Date) return formatDetailDate(value)
  return String(value)
}

/** 在一层选项里找命中值的选项（宽松相等；空值不参与匹配）。 */
function findOption(options: readonly FormDataOption[] | undefined, value: unknown): FormDataOption | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined
  if (value === null || value === undefined || value === '') return undefined
  return options.find((option) => !!option && looseEqual(option.value, value))
}

const hasChildren = (options: readonly FormDataOption[] | undefined): boolean =>
  Array.isArray(options) && options.some((o) => !!o && Array.isArray(o.children) && o.children.length > 0)

/** Cascader 值路径 → 各层标签（` / ` 连接）。任一层未命中则返回 undefined。 */
function resolveTreePath(options: readonly FormDataOption[], path: readonly unknown[]): string | undefined {
  let level: readonly FormDataOption[] | undefined = options
  const labels: string[] = []
  for (const part of path) {
    const hit = findOption(level, part)
    if (!hit) return undefined
    labels.push(hit.label)
    level = hit.children
  }
  return labels.length > 0 ? labels.join(' / ') : undefined
}

/**
 * 详情解析只依赖这三个键 —— 三个渲染端的 `FormItemOption` 是 shape-compatible 的副本，
 * 用 `Pick` 收窄入参，避免调用方为了满足整份接口做转型。
 */
export type FormDetailItem = Pick<FormItemOption, 'prop' | 'dataOptions' | 'emptyPlaceholder'>

/**
 * 把表单项的 model 值解析成详情态展示文本。
 *
 * `item.dataOptions` 在运行时可能已被远端接口替换（`apiParams`），所以这里直接读
 * 调用点传进来的 item，不缓存。
 */
export function resolveFormDetailText(item: FormDetailItem, model: ModelData | undefined): string {
  const value = item?.prop ? getNestedValue(model ?? {}, item.prop) : undefined
  const empty = typeof item?.emptyPlaceholder === 'string' ? item.emptyPlaceholder : '-'
  if (value === null || value === undefined || value === '') return empty

  const options = item.dataOptions
  if (Array.isArray(value)) {
    if (value.length === 0) return empty
    if (hasChildren(options)) {
      const tree = resolveTreePath(options as FormDataOption[], value)
      if (tree !== undefined) return tree
    }
    return value.map((v) => findOption(options, v)?.label ?? formatScalar(v)).join('、')
  }

  return findOption(options, value)?.label ?? formatScalar(value)
}
