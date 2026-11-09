/**
 * 表单分组容器（P1-3 第一期）—— 把扁平的 `FormItemOption[]` 按 `group` 分桶。
 *
 * 为什么放在 core 而不是三端各写一份：分桶规则（声明顺序、未分组落点、空组丢弃）
 * 一旦各端各写一份，tabs / steps / collapse 三种容器里的字段顺序就会悄悄漂移。
 * 三端只负责「怎么画容器」，**画哪些组、每组有哪些字段**由这里唯一决定。
 *
 * 纯函数、无 Vue 依赖：不解析 i18n（`labelKey` 原样透出，由渲染层用宿主的 `t` 解析），
 * 不读全局配置（`defaultLabel` 缺省时由渲染层回落到库内置文案「其他」）。
 */
import type { FormGroupLayout, FormGroupOption } from './types.js'

/** 分桶只需要一个 `group` 字段；用结构最小面，三端的表单类型都能直接传入。 */
export interface FormGroupItemLike {
  /** 分组键；缺省 / 空串表示「未分组」 */
  group?: string
}

/** 分桶后的一个分组。 */
export interface ResolvedFormGroup<T> {
  /** 分组键；未分组桶为 `''` */
  key: string
  label?: string
  labelKey?: string
  description?: string
  items: T[]
}

/** `groupFormItems` 的返回值。 */
export interface FormGroupResult<T> {
  /** 是否启用分组容器（false 时 groups 恒为「单组 = 全部字段」） */
  active: boolean
  groups: ResolvedFormGroup<T>[]
}

/** 未分组桶的键（渲染层据此回落到内置文案「其他」）。 */
export const UNGROUPED_FORM_GROUP_KEY = ''

/**
 * 按 `layout` 把表单字段分桶。
 *
 * 规则（三条都会在单测里逐条断言）：
 * 1. **没有真正分组就保持扁平**：`layout` 未配置 / 没有 `type` / 字段一个都没写
 *    `group` 且 `groups` 也没声明 —— 原样返回单组，`active: false`。历史行为不变。
 * 2. **顺序**：先按 `layout.groups` 声明顺序，未声明的组按字段首次出现顺序追加，
 *    未分组桶（`ungrouped: 'default'`）排最后。**空组一律丢弃**（字段被
 *    `isHidden` / 权限过滤后会自然消失，不留空页签）。
 * 3. **未分组落点**：`'default'` 单独成组、`'first'` 并入第一个组、`'hidden'` 丢弃。
 *    若 `'first'` 时没有任何可用组，退化为扁平（不静默吞字段）。
 *
 * @param items  已过滤 / 归一化后的表单字段（顺序即字段顺序）
 * @param layout `layoutFormProps.layout`
 */
export function groupFormItems<T extends FormGroupItemLike>(
  items: readonly T[],
  layout?: FormGroupLayout | null
): FormGroupResult<T> {
  const list = Array.isArray(items) ? items : []
  const flat = (): FormGroupResult<T> => ({
    active: false,
    groups: [{ key: UNGROUPED_FORM_GROUP_KEY, items: [...list] }],
  })

  if (!layout || !layout.type) return flat()

  const declared = Array.isArray(layout.groups) ? layout.groups : []
  const hasExplicit = list.some(
    (it) => it && typeof it.group === 'string' && it.group.trim() !== ''
  )
  if (!hasExplicit && declared.length === 0) return flat()

  // 声明顺序 + 元信息。重复 / 空 key 忽略（后者无从与字段对应）。
  const order: string[] = []
  const meta = new Map<string, FormGroupOption>()
  for (const g of declared) {
    if (!g) continue
    const key = String(g.key ?? '').trim()
    if (!key || meta.has(key)) continue
    meta.set(key, g)
    order.push(key)
  }

  const buckets = new Map<string, T[]>()
  const push = (key: string, item: T) => {
    let arr = buckets.get(key)
    if (!arr) {
      arr = []
      buckets.set(key, arr)
      if (!order.includes(key)) order.push(key)
    }
    arr.push(item)
  }

  const ungrouped: T[] = []
  for (const it of list) {
    if (!it) continue
    const key = typeof it.group === 'string' ? it.group.trim() : ''
    if (key) push(key, it)
    else ungrouped.push(it)
  }

  const mode = layout.ungrouped ?? 'default'
  if (ungrouped.length && mode !== 'hidden') {
    if (mode === 'first') {
      const firstKey = order[0]
      // 没有任何组可并入时不吞字段：退回扁平，让「配错了」可见而不是静默丢字段。
      if (!firstKey) return flat()
      for (const it of ungrouped) push(firstKey, it)
    } else {
      // 未分组桶固定排最后：先放桶，出组时单独追加。
      buckets.set(UNGROUPED_FORM_GROUP_KEY, ungrouped)
    }
  }

  const groups: ResolvedFormGroup<T>[] = []
  const pushGroup = (key: string, groupItems: T[] | undefined) => {
    if (!groupItems || !groupItems.length) return
    const m = meta.get(key)
    const isUngrouped = key === UNGROUPED_FORM_GROUP_KEY
    groups.push({
      key,
      label: m?.label ?? (isUngrouped ? layout.defaultLabel : undefined),
      labelKey: m?.labelKey,
      description: m?.description,
      items: groupItems,
    })
  }
  for (const key of order) pushGroup(key, buckets.get(key))
  // 未分组桶固定排最后（它不在 order 里）
  pushGroup(UNGROUPED_FORM_GROUP_KEY, buckets.get(UNGROUPED_FORM_GROUP_KEY))
  return groups.length ? { active: true, groups } : flat()
}
