/**
 * 嵌套对象表单字段（P1-3 第二期）—— 把「容器 + 子字段」的一层树摊平成渲染计划。
 *
 * 为什么需要单源：三端的表单渲染循环都是**扁平**的（一个 v-for 画 el-col），
 * 而嵌套对象的语义是「一个标题行 + 若干子字段」。如果在三端各自实现摊平，
 * 子字段 prop 的拼接规则、标题行的跨度、被过滤后的空容器处理都会悄悄漂移，
 * 最终三端的模型绑定路径都不一致。故规则只在这里定义，三端只负责「怎么画标题」。
 *
 * 约定（都会在单测里逐条断言）：
 * 1. **只支持一层**：子字段上的 `children` 被忽略（并告警一次），不会递归。
 * 2. **子字段 prop 解析为绝对路径**：`resolveNestedProp('address', 'city')` →
 *    `'address.city'`。已经是绝对路径（`=== parent` 或以 `parent.` 开头）时原样返回，
 *    因此重复摊平是幂等的，宿主手写绝对路径也照样能用。
 * 3. **容器自身不绑定数据**：它只占一个标题行（默认 span 24），不渲染输入控件、
 *    不产生校验规则；容器的 `formtype` 等控件字段一律忽略。
 * 4. **子字段继承容器的 `group`**（子字段自己声明优先）—— 否则分组容器开启后，
 *    标题落进页签而子字段掉进「未分组」桶，两者被拆散。
 * 5. **子字段的 span** 由容器内部单独计算（子字段自己声明优先），与顶层字段的
 *    auto-span 互不干扰；顶层 auto-span 只统计「标题行与子字段之外」的字段。
 * 6. **空容器不渲染**：子字段全被 `isHidden` / 权限过滤掉后，标题行一并消失。
 *
 * 纯函数、无 Vue 依赖：不解析 i18n（`labelKey` 原样透出），不读全局配置。
 */
import type { FormItemOption } from './types.js'

/** 渲染计划里的标题行标记（内部约定，不进 AI 契约 / 公开文档的字段名）。 */
export const NESTED_FORM_HEAD = '__esNestedHead'

/** 渲染计划里的子字段标记，值为其容器的 prop。 */
export const NESTED_FORM_PARENT = '__esNestedParent'

/** 摊平只需要的最小结构面：三端的表单类型都能直接传入。 */
export interface NestedFormItemLike {
  prop?: string
  /** 子字段（**只摊平一层**） */
  children?: readonly NestedFormItemLike[]
  /** 分组键（子字段继承容器的 group） */
  group?: string
  /** 栅格宽度 */
  span?: number
  [key: string]: unknown
}

/** 渲染计划里的一项。 */
export type NestedRenderItem<T> = T & {
  [NESTED_FORM_HEAD]?: boolean
  [NESTED_FORM_PARENT]?: string
}

/**
 * 子字段 prop 解析为绝对路径。
 *
 * 幂等：`resolveNestedProp('address', 'address.city') === 'address.city'`。
 * 容器没有 prop（理论上不该发生）时原样返回子 prop。
 */
export function resolveNestedProp(parentProp: unknown, childProp: unknown): string {
  const parent = typeof parentProp === 'string' ? parentProp.trim() : ''
  const child = typeof childProp === 'string' ? childProp.trim() : ''
  if (!parent) return child
  if (!child) return parent
  if (child === parent || child.startsWith(`${parent}.`)) return child
  return `${parent}.${child}`
}

/** 渲染计划里这一项是不是「容器标题行」？ */
export function isNestedFormHead(item: unknown): boolean {
  return !!item && typeof item === 'object' && (item as Record<string, unknown>)[NESTED_FORM_HEAD] === true
}

/** 渲染计划里这一项是不是某个容器的子字段？ */
export function isNestedFormChild(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const parent = (item as Record<string, unknown>)[NESTED_FORM_PARENT]
  return typeof parent === 'string' && parent !== ''
}

let warnedNestedDepth = false

/**
 * 丢掉「子字段全被过滤掉」的标题行。
 *
 * 摊平发生在**过滤之前**（reactions / 权限 / isHidden 都在渲染层的扁平管线里），所以
 * 容器标题行不会自己消失。渲染层在过滤之后调用本函数，保证「一个子字段都不剩的嵌套块」
 * 不留下一个孤零零的标题。
 */
export function pruneEmptyNestedContainers<T>(items: readonly NestedRenderItem<T>[]): NestedRenderItem<T>[] {
  const list = Array.isArray(items) ? items : []
  const parents = new Set<string>()
  for (const it of list) {
    if (isNestedFormChild(it)) parents.add(String((it as Record<string, unknown>)[NESTED_FORM_PARENT]))
  }
  return list.filter((it) => {
    if (!isNestedFormHead(it)) return true
    return parents.has(String((it as Record<string, unknown>).prop))
  })
}


/**
 * 摊平一层嵌套字段（容器标题行 + 子字段按声明顺序展开）。
 *
 * 入参是**已经过 reactions / normalize / 过滤**的字段列表（过滤后的空容器自然消失）；
 * 未声明 `children` 的字段原样返回（保持引用相等 —— 三端有按 prop 复用旧对象的逻辑）。
 *
 * @param items        字段列表（树，深度 1）
 * @param autoSpan     子字段缺省 span 的计算函数（缺省用 ``() => undefined``，即不填）
 */
export function flattenFormItems<T extends NestedFormItemLike>(
  items: readonly T[],
  autoSpan?: (siblings: T[]) => number
): NestedRenderItem<T>[] {
  const list: readonly T[] = Array.isArray(items) ? items : []
  const out: NestedRenderItem<T>[] = []

  for (const item of list) {
    if (!item) continue
    const children = Array.isArray(item.children) ? item.children : []

    if (!children.length) {
      // 非容器：剥掉空的 children 键，其余原样透传（引用不变）
      if ('children' in item) {
        const { children: _ignored, ...rest } = item as Record<string, unknown>
        out.push(rest as T)
      } else {
        out.push(item as T)
      }
      continue
    }

    const parentProp = typeof item.prop === 'string' ? item.prop : ''
    const siblings = children
      .filter((c): c is T => !!c && typeof c === 'object')
      .map((c) => {
        if (Array.isArray((c as NestedFormItemLike).children) && (c as NestedFormItemLike).children!.length) {
          if (!warnedNestedDepth) {
            warnedNestedDepth = true
            console.warn('[es-plus] 表单字段 children 只支持一层嵌套，更深层级的子字段已被忽略')
          }
        }
        const { children: _ignored, ...rest } = c as Record<string, unknown>
        return {
          ...rest,
          prop: resolveNestedProp(parentProp, (c as NestedFormItemLike).prop),
          // 子字段继承容器的分组，否则分组容器会把标题和子字段拆到两个桶里
          group: (c as NestedFormItemLike).group ?? item.group,
          [NESTED_FORM_PARENT]: parentProp,
        } as unknown as T
      })

    const childSpan = autoSpan && siblings.length ? autoSpan(siblings) : undefined
    const resolvedChildren = childSpan
      ? siblings.map((c) => ((c as NestedFormItemLike).span ? c : { ...c, span: childSpan } as T))
      : siblings

    // 容器：标题行、默认整行、不参与数据绑定
    const { children: _children, ...containerRest } = item as Record<string, unknown>
    out.push({
      ...containerRest,
      span: (item as NestedFormItemLike).span || 24,
      [NESTED_FORM_HEAD]: true,
    } as NestedRenderItem<T>)

    out.push(...resolvedChildren)
  }

  return out
}
