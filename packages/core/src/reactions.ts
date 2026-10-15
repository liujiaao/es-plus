/**
 * 字段联动规划器（AI-07 底座）—— 框架无关、**零依赖**、**只读 model**。
 *
 * 与 `expr.ts` 一样手写、不引库：`@es-plus/core` 必须保持零依赖（见 constants.ts），
 * 它打进 vue2/vue3/antdv 三个渲染器的产物。
 *
 * 职责边界（刻意与 `isHidden` 的 `normalizeFormItem` 水合**不对称**）：
 *   - `isHidden` 的谓词与 item 无关，可一次编译进 normalizeFormItem；
 *   - 联动依赖**实时 model**、每次 model 变更都要重算，故只在这里暴露**纯函数**，
 *     由渲染层在调用点求值（显示派生合入 formItemListFilter；值回写交 model watcher）。
 *
 * 本模块**从不写 model**：`resolveReactionValues` 只算出「应写成什么」，是否变更、
 * 如何写入（含 Vue 2 的 $set）都是渲染层的事。
 *
 * fail-safe 方向与 `isHidden` 一致：**任何错误都保留静态值**（绝不产生空选项、
 * 绝不误禁控件、绝不写垃圾值）。同一个 fault 只告警一次。
 */

import { evalExpr } from './expr'
import type { FieldReaction, FormItemOption } from './types'

/** model 的最小结构化形态（与 types.ts 的 ModelData 兼容；不 import 类型以保持轻量）。 */
type ModelLike = Record<string, unknown>

/** 显示派生结果（合入 formItemListFilter，**不写 model**）。 */
type ReactionOverlay = Pick<FormItemOption, 'dataOptions' | 'required' | 'disabled'>

/** 值回写项：把 `value` 写到 `prop` 指向的 model 路径。 */
export interface ReactionValue {
  prop: string
  value: unknown
}

/** 未知 fault 只告警一次（避免每次重算刷屏）。 */
const warnedReactionFaults = new Set<string>()

function warnReactionOnce(key: string, message: string): void {
  if (warnedReactionFaults.has(key)) return
  warnedReactionFaults.add(key)
  console.warn(message)
}

/** 归一化一个错误/值的可读描述（用作 warn-once 去重键的一部分）。 */
function describe(v: unknown): string {
  if (v instanceof Error) return v.message
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array(${v.length})`
  return typeof v
}

/** `when` 门控：缺省 → 生效；求值抛错 → 不生效（fail-safe：不联动好过乱联动）。 */
function ruleActive(rule: FieldReaction, model: ModelLike): boolean {
  if (rule.when === undefined) return true
  try {
    return !!evalExpr(rule.when, model)
  } catch (err) {
    warnReactionOnce(
      `when:${describe(err)}`,
      `[es-plus] reactions.when 表达式非法，该规则已跳过：${describe(err)}`
    )
    return false
  }
}

/**
 * 求值一个**布尔型** fulfill 键（`required` / `disabled`）并做类型收窄：必须求值成布尔，
 * 否则该键被**丢弃**（返回 undefined，交调用方保留静态值）。
 */
function evalBooleanKey(
  kind: 'required' | 'disabled',
  node: unknown,
  model: ModelLike
): boolean | undefined {
  if (node === undefined) return undefined
  let value: unknown
  try {
    value = evalExpr(node, model)
  } catch (err) {
    warnReactionOnce(
      `expr:${kind}:${describe(err)}`,
      `[es-plus] reactions.fulfill.${kind} 表达式非法，已保留静态值：${describe(err)}`
    )
    return undefined
  }
  if (typeof value !== 'boolean') {
    warnReactionOnce(
      `type:${kind}:${describe(value)}`,
      `[es-plus] reactions.fulfill.${kind} 求值结果非布尔，已保留静态值`
    )
    return undefined
  }
  return value
}

/**
 * 显示派生：把**生效规则**提供的 `dataOptions` / `required` / `disabled` 合出来。
 *
 * - 规则按声明顺序求值，**后声明的覆盖先声明的**（last-wins）；
 * - 无规则生效或全部被丢弃 → 返回 `null`（调用方据此跳过合并，保持原 item 引用）；
 * - 只读 model（`evalExpr` 经 `getNestedValue`），由外层 computed 负责响应式追踪。
 */
export function resolveReactionOverlay(
  reactions: FieldReaction[] | undefined,
  model: ModelLike
): ReactionOverlay | null {
  if (!Array.isArray(reactions) || reactions.length === 0) return null

  let dataOptions: ReactionOverlay['dataOptions']
  let required: ReactionOverlay['required']
  let disabled: ReactionOverlay['disabled']
  let touched = false

  for (const rule of reactions) {
    if (!rule || typeof rule !== 'object') continue
    const fulfill = (rule as { fulfill?: unknown }).fulfill
    if (!fulfill || typeof fulfill !== 'object') continue
    if (!ruleActive(rule, model)) continue
    const f = fulfill as Record<string, unknown>

    // dataOptions 是**字面量选项数组**（JSON 数据）—— 不是表达式：AI-16 DSL 的对象字面量
    // 被刻意排除（任何对象都是算子节点），故 `[{label,value}]` 无法由表达式构造。
    // 「选项随另一字段变化」的写法是**多条规则 + 各自的 when 谓词**（每个分支一套选项）。
    const dopts = f.dataOptions
    if (dopts !== undefined) {
      if (Array.isArray(dopts)) {
        dataOptions = dopts as ReactionOverlay['dataOptions']
        touched = true
      } else {
        warnReactionOnce(
          `type:dataOptions:${describe(dopts)}`,
          '[es-plus] reactions.fulfill.dataOptions 必须是字面量选项数组（不可用表达式构造），已保留静态值'
        )
      }
    }
    const req = evalBooleanKey('required', f.required, model)
    if (req !== undefined) {
      required = req
      touched = true
    }
    const dis = evalBooleanKey('disabled', f.disabled, model)
    if (dis !== undefined) {
      disabled = dis
      touched = true
    }
  }

  if (!touched) return null
  const overlay: ReactionOverlay = {}
  if (dataOptions !== undefined) overlay.dataOptions = dataOptions
  if (required !== undefined) overlay.required = required
  if (disabled !== undefined) overlay.disabled = disabled
  return overlay
}

/**
 * 值派生：给当前 model 算出所有**到期写回**（**无状态**——不含「是否变更」判断，
 * 那是渲染层的职责）。同名 prop 多规则命中时 **last-wins**。
 *
 * `fulfill.value` 存在但 `dependencies` 为空 → 跳过并告警一次：否则任何 model 变更
 * 都会重算并覆盖用户手改。
 */
export function resolveReactionValues(
  items: ReadonlyArray<{ prop?: string; reactions?: FieldReaction[] }>,
  model: ModelLike
): ReactionValue[] {
  const out = new Map<string, unknown>()
  for (const item of items) {
    if (!item || typeof item.prop !== 'string' || item.prop === '') continue
    const reactions = item.reactions
    if (!Array.isArray(reactions)) continue
    for (const rule of reactions) {
      if (!rule || typeof rule !== 'object') continue
      const fulfill = (rule as { fulfill?: unknown }).fulfill
      if (!fulfill || typeof fulfill !== 'object') continue
      const valueNode = (fulfill as Record<string, unknown>).value
      if (valueNode === undefined) continue

      if (!Array.isArray(rule.dependencies) || rule.dependencies.length === 0) {
        warnReactionOnce(
          `deps:${item.prop}`,
          `[es-plus] reactions.fulfill.value 缺少 dependencies（字段「${item.prop}」），该写回已跳过：` +
            '否则任何 model 变更都会重算并覆盖用户手改'
        )
        continue
      }
      if (!ruleActive(rule, model)) continue

      let value: unknown
      try {
        value = evalExpr(valueNode, model)
      } catch (err) {
        warnReactionOnce(
          `value:${item.prop}:${describe(err)}`,
          `[es-plus] reactions.fulfill.value 表达式非法，已跳过「${item.prop}」的写回：${describe(err)}`
        )
        continue
      }
      out.set(item.prop, value)
    }
  }
  return Array.from(out, ([prop, value]) => ({ prop, value }))
}

/**
 * 收集所有声明过的依赖路径（去重、保首次出现顺序）。渲染层据此构造 watcher 的
 * watch source（依赖值拼接串），从而「只在依赖真变时才重算写回」。
 *
 * 纯声明扫描，**不读 model**。
 */
export function collectReactionDependencies(
  items: ReadonlyArray<{ reactions?: FieldReaction[] }>
): string[] {
  const seen = new Set<string>()
  for (const item of items) {
    const reactions = item?.reactions
    if (!Array.isArray(reactions)) continue
    for (const rule of reactions) {
      const deps = rule?.dependencies
      if (!Array.isArray(deps)) continue
      for (const d of deps) {
        if (typeof d === 'string' && d !== '') seen.add(d)
      }
    }
  }
  return Array.from(seen)
}
