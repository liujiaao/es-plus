/**
 * AN-09 —— 能力矩阵（key × target × 支持级别）。
 *
 * ## 为什么需要它
 *
 * 生成物对三端是**同一份 JSON**，但运行时的「消费点」不是同一套组件：vue3 用 Element Plus，
 * vue2 用 Element UI，antdv 用 Ant Design Vue；三者各有默认引擎 + vxe 引擎。于是存在两类静默：
 *
 *   1. target 级差异（例：vue2 没有 el-table-v2，`virtual` 必然降级）；
 *   2. engine 级差异（例：`editConfig` 只有 vxe 消费，与 target 无关）。
 *
 * 修前这两类差异散落在生成的字符串里（`structured-generator.ts` 里的三段 if）与注释表格里
 * （`target.ts` 顶部），没有单一事实源 —— 新增一个键时没人知道该不该补告警。
 *
 * ## 三条约定（守卫 `scripts/check-capability-parity.mjs` 会机械校验）
 *
 * - `key` 是 `tableOptions.<key>`（表层选项）或顶层 `<key>`（AI 契约里的顶层键），且**必须**
 *   真实存在于 schema 的对应形状；
 * - 每一格都必须带 `note`（证据 / 语义说明）—— 没有证据的格子不允许存在，`full` 也不是默认值；
 * - 只有 `none` 会产告警：`partial` 表示「在某个引擎/子键上生效」，属于文档事实，不该刷屏。
 *
 * ## 本表刻意不收的键
 *
 * 「不在表里」= 未发现 target 级差异，不代表承诺 full。真正需要的是**别撒谎**：
 * 宁可少一格，也不要给一个没核对过的 `full`。
 */

export type CapabilityTarget = 'vue3' | 'vue2' | 'antdv'

/** `full` = 三端按同一语义消费；`partial` = 仅部分引擎/子键生效；`none` = 该端运行时会忽略。 */
export type CapabilityLevel = 'full' | 'partial' | 'none'

export const CAPABILITY_TARGETS: readonly CapabilityTarget[] = ['vue3', 'vue2', 'antdv']

export interface CapabilityCell {
  level: CapabilityLevel
  /** 证据 / 语义说明（必填：格子代表一条主张，主张必须可追溯）。 */
  note: string
}

export interface CapabilityEntry {
  /**
   * `tableOptions.<key>` 或顶层 `<key>` —— 与 schema 的形状对账。
   *
   * 两个容器都用得到：`expandConfig` / `treeConfig` / `mergeConfig` 在 AI 契约里是**顶层**键
   * （跨端窄子集），而同名的 `tableOptions.expandConfig` / `tableOptions.treeConfig` 是
   * vxe-only 的富配置 —— 两者是不同层，不能混成一个 `tableOptions.*` 行。
   */
  key: string
  targets: Record<CapabilityTarget, CapabilityCell>
  /**
   * 也算「配置里设置了」的等价写法（**相对于本条目的容器**，与 `key` 同层）。
   * 例：`tableOptions.virtual` 的等价写法是 `tableOptions.engine: 'virtual'`。
   */
  equivalents?: ReadonlyArray<{ key: string; value: unknown }>
}

/** `tableOptions.x` → `['tableOptions','x']`；顶层键 → `[key]`。 */
export function splitKey(key: string): string[] {
  return key.split('.')
}

const full = (note: string): CapabilityCell => ({ level: 'full', note })
const partial = (note: string): CapabilityCell => ({ level: 'partial', note })
const none = (note: string): CapabilityCell => ({ level: 'none', note })

/**
 * 能力矩阵。
 *
 * 单元格的证据来源逐条注在 `note` 里，便于守卫 / 评审回溯到源码位置。
 */
export const CAPABILITIES: readonly CapabilityEntry[] = [
  // ── 前置非数据列（AN-09 的修复面：三端都必须响应这三个开关）──────────────
  {
    key: 'tableOptions.multiSelect',
    targets: {
      vue3: full('五个列产出路径统一走 core synthesizeLeadingColumns；默认 el-table 引擎修前完全无视该开关'),
      vue2: full('同上（packages/vue2 es-table filteredColumns 前置合成）'),
      antdv: full('ADV 走 rowSelection（hasSelection），vxe 引擎走 vxe 适配器'),
    },
  },
  {
    key: 'tableOptions.snIndex',
    targets: {
      vue3: full('默认引擎 / 虚拟引擎 / vxe 适配器三处同一判据'),
      vue2: full('默认引擎 / vxe 适配器同一判据'),
      antdv: full('a-table 通过 createSnAdvColumn 注入，vxe 引擎走 vxe 适配器'),
    },
  },
  {
    key: 'expandConfig',
    targets: {
      vue3: full('顶层 expandConfig：自动前置一条 expand 列，展开内容 = 只读字段明细（el-table expand 列）'),
      vue2: full('同 vue3（Element UI expand 列，column-item 消费列上 expandConfig）'),
      antdv: full('expandedRowRender 整行渲染（expandContent）'),
    },
  },

  // ── 虚拟滚动及其调参（唯一有 target 级硬差异的一组）──────────────────────
  {
    key: 'tableOptions.virtual',
    targets: {
      vue3: full('el-table-v2 引擎（engine: virtual 的等价写法）'),
      vue2: none(
        'Element UI 没有 el-table-v2，运行时降级普通 el-table 并在控制台告警。大表请用 server 分页，或改 engine: \'vxe\'（vue2 有完整 vxe 适配器）'
      ),
      antdv: full('透传 <a-table :virtual>（Ant Design Vue 4 原生虚拟滚动）'),
    },
    equivalents: [{ key: 'engine', value: 'virtual' }],
  },
  {
    key: 'tableOptions.rowHeight',
    targets: {
      vue3: partial('仅虚拟引擎（el-table-v2）消费；默认 / vxe 引擎忽略'),
      vue2: none('属内部键，默认引擎与 vxe 引擎都不消费（Element UI 无行高统一控制）'),
      antdv: none('属内部键（TABLE_INTERNAL_KEYS），不会绑定到 <a-table>'),
    },
  },
  {
    key: 'tableOptions.estimatedRowHeight',
    targets: {
      vue3: partial('仅虚拟引擎消费（动态行高估算）'),
      vue2: none('属内部键，无对应能力'),
      antdv: none('属内部键，不会绑定到 <a-table>'),
    },
  },
  {
    key: 'tableOptions.overscanCount',
    targets: {
      vue3: partial('仅虚拟引擎消费（预渲染行数）'),
      vue2: none('属内部键，无对应能力'),
      antdv: none('属内部键，不会绑定到 <a-table>'),
    },
  },

  // ── 引擎相关：与 target 无关，只与所选的 engine 有关 ────────────────────
  {
    key: 'tableOptions.engine',
    targets: {
      vue3: full('default / virtual / vxe 三引擎'),
      vue2: full('default / vxe（无 virtual，见 tableOptions.virtual 一格）'),
      antdv: full('default / vxe（virtual 由 tableOptions.virtual 透传）'),
    },
  },
  {
    key: 'tableOptions.editConfig',
    targets: {
      vue3: partial("仅 engine: 'vxe' 消费，其余引擎运行时忽略（生成器另发告警）"),
      vue2: partial('同上'),
      antdv: partial('同上'),
    },
  },
  {
    key: 'tableOptions.expandConfig',
    targets: {
      vue3: partial('仅 vxe 引擎的展开行为开关（accordion）；展开**内容**在列上 expandConfig'),
      vue2: partial('同上'),
      antdv: partial('同上'),
    },
  },
  {
    key: 'tableOptions.treeConfig',
    targets: {
      vue3: partial('childrenField / expandAll 映射到 el-table；transform / rowField / parentField / mapChildren / lazy 仅 vxe 引擎'),
      vue2: partial('同 vue3（映射到 Element UI el-table）'),
      antdv: partial('childrenField / expandAll 映射到 a-table；其余子键仅 vxe 引擎'),
    },
  },

  {
    key: 'treeConfig',
    targets: {
      vue3: full('顶层 treeConfig：childrenField / expandAll 映射到 el-table（嵌套 rows）'),
      vue2: full('同 vue3（Element UI el-table）'),
      antdv: full('childrenField → childrenColumnName，expandAll → defaultExpandAllRows'),
    },
  },

  // ── 已核对为三端同语义的键（列在这里是为了让「未列入 = 未核对」这条约定成立）──
  {
    key: 'mergeConfig',
    targets: {
      vue3: full('AI-23：core resolveMergeConfig → el-table spanMethod'),
      vue2: full('同上（Element UI span-method）'),
      antdv: full('同上（a-table 列级 customCell）'),
    },
  },
  {
    key: 'tableOptions.cachePageSelection',
    targets: {
      vue3: full('useTableSelection + core restoreSelectionForPage'),
      vue2: full('同 vue3'),
      antdv: full('同 vue3'),
    },
  },
  {
    key: 'tableOptions.sortParam',
    targets: {
      vue3: full(
        'core table-sort 是唯一求值点：请求漏斗合并 { sortField, sortOrder }，defaultSort 播种首屏参数，表头变化保留当前页重取；el-table 列降为 sortable:\'custom\'、vxe 置 sortConfig.remote'
      ),
      vue2: full("同 vue3（Element UI 的 sortable:'custom' + vxe 的 sortConfig.remote）"),
      antdv: full("a-table 的 sorter:true 本就是服务端语义（从不本地排），故只需漏斗 + change 重取；vxe 引擎置 sortConfig.remote"),
    },
  },
]

/** 取一格（key 不存在时返回 undefined —— 未列入 ≠ 不支持）。 */
export function capabilityOf(
  key: string,
  target: CapabilityTarget
): CapabilityCell | undefined {
  return CAPABILITIES.find(e => e.key === key)?.targets[target]
}

export function capabilityLevel(
  key: string,
  target: CapabilityTarget
): CapabilityLevel | undefined {
  return capabilityOf(key, target)?.level
}

/** 沿点号路径取值（`tableOptions.rowHeight` 会先下钻一层）。 */
function readPath(config: unknown, parts: string[]): unknown {
  let node: unknown = config
  for (const p of parts) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[p]
  }
  return node
}

/** 「配置里设置了」：非 undefined 且不是显式 false（`virtual: false` 不该触发告警）。 */
function isSet(config: unknown, entry: CapabilityEntry): boolean {
  const own = splitKey(entry.key)
  const value = readPath(config, own)
  if (value !== undefined && value !== false) return true
  // 等价写法与本条目同容器（`tableOptions.virtual` ↔ `tableOptions.engine:'virtual'`）
  const container = own.slice(0, -1)
  return (entry.equivalents ?? []).some(
    eq => readPath(config, [...container, ...splitKey(eq.key)]) === eq.value
  )
}

/**
 * 目标端**不支持**（`none`）且配置里确实设了 → 一条告警。
 *
 * 只对 `none` 发声：`partial` 是「某引擎生效」的文档事实，每次生成都刷一遍会淹没真问题。
 *
 * @param config 整份生成配置（顶层键与 `tableOptions` 都会被读到）
 */
export function capabilityWarnings(
  target: CapabilityTarget,
  config: Record<string, unknown> | undefined | null
): string[] {
  const warnings: string[] = []
  for (const entry of CAPABILITIES) {
    const cell = entry.targets[target]
    if (!cell || cell.level !== 'none') continue
    if (!isSet(config, entry)) continue
    warnings.push(`target=${target}: ${entry.key} is not supported — ${cell.note}.`)
  }
  return warnings
}
