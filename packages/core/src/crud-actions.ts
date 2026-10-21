/**
 * `EsCrudPage` 的 action 面解析（三端共用）。
 *
 * ## 为什么必须是**一个**函数
 *
 * `actions` 决定三件事：工具栏有没有「新增/导出/导入」、操作列有没有
 * 「查看/编辑/删除」、旧模式要不要合成 `add/edit/view` 弹窗。三端此前各自写
 *
 * ```ts
 * const actions = props.schema.actions || ['add', 'edit', 'delete']
 * ```
 *
 * 于是同一个 schema 在三端得到同一组按钮 —— 但**同一组错误的**按钮：
 *
 *   · 新对话框模式（`pageSchema.dialogs`）里生成器**不发射** `actions`（AN-06），
 *     页面就凭空多出 add/edit/delete：`actions:['view']` 的只读页会渲染「新增」与
 *     「删除」，点「删除」还会真的发 DELETE。
 *   · 反过来，`dialogs:{ add, edit }` 的手写 schema 也拿到一个 `delete` 行按钮，
 *     而配置里根本没有删除的意图。
 *
 * 硬编码兜底的失效方式是**双向**的：既可能给出多余的危险动作，也可能盖掉真实意图。
 * 故按 schema 的**结构**推导，而不是按「缺省就猜一套 CRUD」：
 *
 *   1. 显式 `actions`（含 `[]`，表示只读）→ 原样使用；
 *   2. 有 `dialogs` → 从 dialog key 推导，只认 `add`/`edit`/`view`
 *      （这三个 key 在组件里有内建语义；`delete` 没有弹窗，无法从 key 推出，
 *        `export`/`import` 同理）；
 *   3. 有 `dialogFormItems` → 旧 schema（生成器 legacy 分支）兼容，回退
 *      `['add','edit','delete']`，与旧行为逐字一致；
 *   4. 都没有 → `[]`（只读）。
 *
 * `actions` 判据用 `Array.isArray` 而非真值：空数组是**显式的只读**，
 * 用 `||` 会把它换成默认的 add/edit/delete —— 正好是上面那类「多余的危险动作」。
 */
import { CRUD_PAGE_DIALOG_KEYS } from './constants'
import type { CrudActionLiteral } from './constants'

/** 解析所需的最小 schema 结构（三端 `CrudPageSchema` 都满足）。 */
export interface CrudActionsSource {
  actions?: readonly string[] | null
  dialogs?: Record<string, unknown> | null
  dialogFormItems?: readonly unknown[] | null
}

/** 旧 schema（只有 `dialogFormItems`）的兼容动作集 —— 与 AN-06 之前的三端硬编码一致。 */
export const LEGACY_CRUD_ACTIONS: readonly CrudActionLiteral[] = ['add', 'edit', 'delete']

/** 能从 dialog key 推导的动作（顺序即内建优先级，与弹窗合成顺序一致）。 */
const DIALOG_DERIVED_ACTIONS: readonly CrudActionLiteral[] = [
  CRUD_PAGE_DIALOG_KEYS.ADD,
  CRUD_PAGE_DIALOG_KEYS.EDIT,
  CRUD_PAGE_DIALOG_KEYS.VIEW,
]

/**
 * 由 schema 结构解析生效的 action 集。
 *
 * @param schema `CrudPageSchema`（或旧格式），可为 `null`/`undefined`
 */
export function resolveCrudActions(
  schema: CrudActionsSource | null | undefined
): CrudActionLiteral[] {
  if (!schema) return []

  // 1. 显式声明（含空数组 = 只读）
  if (Array.isArray(schema.actions)) return schema.actions as CrudActionLiteral[]

  // 2. 新对话框模式：从 dialog key 推导（只认有内建语义的三个）
  if (schema.dialogs && typeof schema.dialogs === 'object') {
    const keys = Object.keys(schema.dialogs)
    return DIALOG_DERIVED_ACTIONS.filter((action) => keys.includes(action))
  }

  // 3. 旧 schema 兼容：dialogFormItems 存在即沿用历史默认
  if (Array.isArray(schema.dialogFormItems) && schema.dialogFormItems.length > 0) {
    return [...LEGACY_CRUD_ACTIONS]
  }

  // 4. 只读
  return []
}
