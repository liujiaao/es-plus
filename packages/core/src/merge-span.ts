/**
 * 声明式合并单元格（AI-23）—— 跨端窄子集 `mergeConfig: { rowsBy: string[] }`
 *
 * 为什么是「按字段相邻相等」而不是函数式 `spanMethod`：
 *   `TableOptions.spanMethod` 是任意闭包，**antdv 默认引擎无通道**（a-table 没有
 *   span-method prop，只能逐列给 `customCell`），故函数式只能留 Tier-3 逃生舱。
 *   可跨端的是**纯 JSON 的窄子集**：声明若干列，按「相邻行该列值相等」合并。
 *
 * 求值全部收敛在本模块（三端只做「取值 → 调用 → 交给各自组件」），所以
 * 「三端等价」由构造保证，不靠三份复制实现对齐。
 *
 * 约定（三端一致）：
 *   - 段内**首行** rowspan = 段长；段内其余行 rowspan = 0（= 该格被合并掉）。
 *   - 不在 `rowsBy` 里的列原样返回 [1, 1]。
 *   - `0` 的返回形态：el-table / antdv 都要求「整格消失」，故 colspan 也返回 0
 *     （返回 [0, 1] 会留下一个空列宽）。
 */

export interface MergeConfig {
  /** 参与合并的列 prop（按相邻行相等分组）。至少一项。 */
  rowsBy: string[]
}

/** 行数据类型（宽进：只按下标与属性名取值）。 */
export type MergeRow = Record<string, unknown>

/**
 * 单列按「相邻相等」分组 → 每行的 rowSpan。
 * 段内首行 = 段长，其余 = 0。空数组 → 空数组。
 */
export function buildColumnSpans(values: unknown[]): number[] {
  const spans = values.map(() => 1)
  let i = 0
  while (i < values.length) {
    let j = i
    while (j + 1 < values.length && values[j + 1] === values[i]) j++
    spans[i] = j - i + 1
    for (let k = i + 1; k <= j; k++) spans[k] = 0
    i = j + 1
  }
  return spans
}

/** 列对象里取 prop 的三端统一顺序（el-table=property / vxe=field / es-plus 列=prop|key）。 */
function columnProp(column: unknown): string | undefined {
  if (!column || typeof column !== 'object') return undefined
  const c = column as Record<string, unknown>
  const v = c.property ?? c.field ?? c.prop ?? c.key ?? c.dataIndex
  return v == null ? undefined : String(v)
}

/**
 * 构造 el-table / vxe 通用的 span-method。
 *
 * 返回值形态为 `[rowspan, colspan]`（el-table 原生；vxe 侧由 applySpanShim 归一化为
 * `{rowspan, colspan}` 的 mergeMethod）。
 *
 * 每列的 span 数组在**构造时**按当前 rows 预计算一次，避免逐格 O(n) 重算
 * （rows × cols 次调用 → O(n²·m)）。
 */
export function buildRowSpanMethod(
  rowsBy: string[],
  rows: MergeRow[],
): (params: { row?: unknown; column?: unknown; rowIndex: number; columnIndex?: number }) => [number, number] {
  const byCol = new Map<string, number[]>()
  for (const prop of rowsBy) {
    byCol.set(prop, buildColumnSpans(rows.map((r) => (r == null ? undefined : r[prop]))))
  }
  return (params) => {
    const prop = columnProp(params.column)
    const arr = prop === undefined ? undefined : byCol.get(prop)
    if (!arr) return [1, 1]
    const span = arr[params.rowIndex]
    if (span === undefined) return [1, 1]
    return span === 0 ? [0, 0] : [span, 1]
  }
}

/**
 * 宽容读取并归一化 `options.mergeConfig`。
 * 非法形状（非对象 / rowsBy 非数组 / 空数组 / 全非字符串）→ undefined（不生效）。
 * 三端共用同一判定，避免「一端认、一端不认」的静默分歧。
 */
export function resolveMergeConfig(options: unknown): MergeConfig | undefined {
  if (!options || typeof options !== 'object') return undefined
  const raw = (options as Record<string, unknown>).mergeConfig
  if (!raw || typeof raw !== 'object') return undefined
  const rowsBy = (raw as Record<string, unknown>).rowsBy
  if (!Array.isArray(rowsBy)) return undefined
  const clean = rowsBy.filter((v): v is string => typeof v === 'string' && v.length > 0)
  return clean.length > 0 ? { rowsBy: clean } : undefined
}
