/**
 * vxe-engine 纯函数辅助集（可单测）
 *
 * 背景：这些逻辑原先内联在 vxe-engine.vue 的事件处理器 / gridConfig 里，测试只能复制一份
 * 副本来验证（「测试剧场」——测的是副本不是发货代码）。抽取为纯函数后，SFC 与单测共享
 * 同一实现，回归测试才真正覆盖线上行为。
 */

/** vxe 内部 order（'asc'/'desc'/null）→ es-plus 公共 order（handleSortChange 使用）。 */
export function normalizeVxeOrder(
  order: string | null | undefined,
): 'ascending' | 'descending' | null {
  return order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : null
}

/**
 * checkbox 事件的 records（当前页勾选）+ reserves（跨页保留）平铺合并
 * （handleCheckboxChange / handleCheckboxAll 使用）。
 */
export function mergeCheckboxRecords<T = Record<string, unknown>>(
  records: T[] | undefined,
  reserves: T[] | undefined,
): T[] {
  return [...(records || []), ...(reserves || [])]
}

/**
 * spanMethod → vxe mergeMethod shim（gridConfig.mergeMethod 使用）。
 * vxe 列用 column.field，el-table 列用 column.property；这里统一补齐 property，
 * 并把数组 [rowspan, colspan] / 对象 / 空返回值标准化为 { rowspan, colspan }。
 */
export function applySpanShim(
  spanMethod: (params: {
    row: unknown
    rowIndex: number
    column: unknown
    columnIndex: number
  }) => unknown,
  params: { row: unknown; rowIndex: number; column: any; columnIndex: number },
): { rowspan: number; colspan: number } {
  const { row, rowIndex, column, columnIndex } = params
  const shimmedCol = column
    ? { ...column, property: column.field ?? column.property }
    : column
  const res = spanMethod({ row, rowIndex, column: shimmedCol, columnIndex })
  if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
  return (res as { rowspan: number; colspan: number }) || { rowspan: 1, colspan: 1 }
}

/**
 * 从 vxe-grid ref 解析内部 <vxe-table> 实例（getInternalTable 防御链的纯部分）。
 * getRefMaps().refTable 在不同 vxe 版本下可能是 Ref（需 .value）或原始对象。
 */
export function resolveInternalTable(gridRef: { value: any } | null | undefined): any {
  const refTable = gridRef?.value?.getRefMaps?.()?.refTable
  return refTable?.value ?? refTable
}
