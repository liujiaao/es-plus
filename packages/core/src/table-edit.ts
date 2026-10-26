/**
 * 行内编辑提交归一（`cell-edit` 事件的载荷）—— 三端共用一份求值点。
 *
 * ## 为什么需要它
 *
 * `editConfig` 只在 vxe 引擎消费（AN-09 记为 `partial`，与 target 无关），但这不代表
 * 「改了哪个字段、从什么变成什么」只有 vxe 知道 —— 那是**通用语义**。宿主真正要的是
 * 「哪一行、哪个字段、新值、旧值」四件事，而不是 vxe 的 `{ row, column, rowIndex, $rowIndex }`
 * 事件载荷（那里面没有旧值，也没有字段名的人话写法）。
 *
 * 于是三端引擎只做「进会话拍快照 / 出会话比一遍」，判定逻辑全在本模块：
 *   - `resolveEditProp`：vxe v4 用 `column.property`、vxe v3 用 `column.field`、
 *     el-table / a-table 用 `column.prop` —— 三种写法归一成一个字段名；
 *   - `snapshotEditRow`：进入编辑时拍一行（浅拷贝：vxe 只改值，不改行结构）；
 *   - `diffEditRow`：会话结束时比对，**只报真的变了的字段**。
 *
 * ## 三条约定
 *
 * 1. **只有 vxe 引擎发 `cell-edit`**：默认 / 虚拟引擎没有行内编辑，不发假事件。
 * 2. **值比较用 `Object.is`**：编辑器的产出是标量（string / number / Date 引用），
 *    引用相同即未改；刻意不做深比较 —— 行模式下一次提交比整行，深比较会把
 *    「换了引用但内容相同」也算成改动，反而制造噪声。
 * 3. **未改不发**：点一下单元格再失焦不产生事件；宿主不必自己过滤。
 *
 * 注意：vxe 的 `keepSource` 只是给 `revertData()` 留原始快照，**编辑改的就是你传进来的
 * 行对象本身**（同一引用）—— 这正是 `update:dataSource` 能收到改动的原因。
 */
import type { CellEditPayload } from './types'

/** vxe 列对象（v4 `property` / v3 `field`）或 el-table 列（`prop`）→ 字段名。 */
export function resolveEditProp(column: unknown): string | undefined {
  if (!column || typeof column !== 'object') return undefined
  const c = column as Record<string, unknown>
  const prop = c.property ?? c.field ?? c.prop
  return typeof prop === 'string' && prop ? prop : undefined
}

/** 进入编辑会话时拍一行。浅拷贝即可：编辑器只改值，不改行的键集合。 */
export function snapshotEditRow(row: Record<string, unknown>): Record<string, unknown> {
  return row && typeof row === 'object' ? { ...row } : {}
}

/**
 * 比对「会话开始时的快照」与「会话结束时的行」。
 *
 * @param prop 单元格模式传本次编辑的字段名（只比这一格）；
 *             行模式省略 —— 逐键比整行（vxe 行模式一次会话可改多格）。
 * @returns 只含真正变化的字段，顺序与行键顺序一致。
 */
export function diffEditRow(
  snapshot: Record<string, unknown>,
  row: Record<string, unknown>,
  prop?: string,
): Array<Pick<CellEditPayload, 'prop' | 'value' | 'oldValue'>> {
  if (!snapshot || !row) return []
  const keys = prop !== undefined ? [prop] : Object.keys(row)
  const changes: Array<Pick<CellEditPayload, 'prop' | 'value' | 'oldValue'>> = []
  for (const key of keys) {
    const oldValue = snapshot[key]
    const value = row[key]
    if (!Object.is(oldValue, value)) changes.push({ prop: key, value, oldValue })
  }
  return changes
}
