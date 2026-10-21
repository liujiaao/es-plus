import type { TableColumn, TableOptions } from './types'

/**
 * AN-09 —— 前置非数据列（选择 / 序号 / 展开）的**合成单源**。
 *
 * ## 为什么需要它
 *
 * `options.multiSelect` / `options.snIndex` / `options.expand` 是「注入一列」的开关，
 * 不是数据字段。修前五个列产出路径各写一份判断：
 *   - vue3 虚拟引擎适配器、vue3/vue2/antdv 的 vxe 适配器：都有注入；
 *   - **vue3 与 vue2 的默认（el-table）引擎：都没有**。
 * 于是同一份配置在 vxe 引擎下有勾选列、切到默认引擎就凭空少了一列 —— 静默、无告警、
 * 且与 `type:'selection'` 显式列的语义（三端都认）自相矛盾。
 *
 * 三份 vxe 适配器之间还有**顺序**漂移：vxe 是「选择 → 序号 → 展开」，虚拟引擎是
 * 「选择 → 展开 → 序号」。顺序不是语义，但列位置是用户看得见的东西。
 *
 * ## 约定
 *
 * - 顺序固定为 `LEADING_COLUMN_ORDER`（选择 → 序号 → 展开），与三份 vxe 适配器一致；
 * - 「已存在同类型列就不注入」：判据看**原始列**（含 `hidCol` 的隐藏列）—— 显式声明
 *   过就意味着配置里有它，权限过滤是另一层；
 * - 返回**新对象**：调用方会往上加引擎专属字段（`slots` / `cellRenderer`），
 *   共享默认值对象会让这些字段互相串。
 */
export type LeadingColumnType = 'selection' | 'index' | 'expand'

/** 合成列的中性描述（不含任何引擎字段）。 */
export interface LeadingColumnSpec {
  type: LeadingColumnType
  width: number
  align: 'center'
  fixed?: 'left'
  label?: string
}

/** 合成列的顺序（三端 + 各引擎共用）。 */
export const LEADING_COLUMN_ORDER: readonly LeadingColumnType[] = ['selection', 'index', 'expand']

/**
 * 各类型的中性默认值。宽度取三端既有实现里的一致值：
 * 选择 50（el-table / vxe / 虚拟）、序号 60、展开 50。
 */
export const LEADING_COLUMN_DEFAULTS: Readonly<Record<LeadingColumnType, LeadingColumnSpec>> = {
  selection: { type: 'selection', width: 50, fixed: 'left', align: 'center' },
  index: { type: 'index', width: 60, label: '#', align: 'center' },
  expand: { type: 'expand', width: 50, fixed: 'left', align: 'center' },
}

type LeadingOptions = Pick<TableOptions, 'multiSelect' | 'snIndex' | 'expand'>

/**
 * 判定「是否已显式声明」时**只读 `type`** —— 所以参数刻意不收窄成 core 的 `TableColumn`：
 * vue3 / vue2 / antdv 各自有更宽的列类型（`btns[].type` 等字段并不完全同构），
 * 收窄会让三端调用点被迫 `as any`。这里用结构最小面（structural minimum）。
 */
type LeadingColumnProbe = { type?: TableColumn['type'] }

/**
 * 按开关合成应当前置的非数据列；已由 `columns` 显式声明同类型列时跳过该类型。
 *
 * @param options 只关心三个开关，其余选项（engine/rowkey…）与「注不注入」无关
 * @param columns 原始列（未做权限/隐藏过滤）
 */
export function synthesizeLeadingColumns(
  options: LeadingOptions | undefined | null,
  columns: readonly LeadingColumnProbe[] | undefined | null
): LeadingColumnSpec[] {
  if (!options) return []
  const declared = new Set<LeadingColumnType>()
  for (const col of columns ?? []) {
    if (col && (col.type === 'selection' || col.type === 'index' || col.type === 'expand')) {
      declared.add(col.type)
    }
  }

  const enabled: Record<LeadingColumnType, boolean> = {
    selection: options.multiSelect === true,
    index: options.snIndex === true,
    expand: options.expand === true,
  }

  const out: LeadingColumnSpec[] = []
  for (const type of LEADING_COLUMN_ORDER) {
    if (!enabled[type] || declared.has(type)) continue
    out.push({ ...LEADING_COLUMN_DEFAULTS[type] })
  }
  return out
}

/**
 * 中性描述 → 默认引擎（el-table / a-table）直接消费的 `TableColumn`。
 *
 * 只带回契约字段，让 `column-item` 的 `columnBindAttr` 原样透传给 `el-table-column`；
 * 引擎专属字段（vxe `slots`、虚拟 `cellRenderer`）一律不在这里出现。
 */
export function leadingColumnToTableColumn(spec: LeadingColumnSpec): TableColumn {
  const col: TableColumn = { type: spec.type, width: spec.width, align: spec.align }
  if (spec.fixed) col.fixed = spec.fixed
  if (spec.label !== undefined) col.label = spec.label
  return col
}

/**
 * `synthesizeLeadingColumns` 的 `TableColumn` 形态：默认引擎只需
 * `[...buildLeadingColumns(options, columns), ...dataColumns]`。
 */
export function buildLeadingColumns(
  options: LeadingOptions | undefined | null,
  columns: readonly LeadingColumnProbe[] | undefined | null
): TableColumn[] {
  return synthesizeLeadingColumns(options, columns).map(leadingColumnToTableColumn)
}
