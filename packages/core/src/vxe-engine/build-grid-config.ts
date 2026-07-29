/**
 * 将 TableOptions 一等公民字段映射为 vxe-grid 局部配置
 * 纯函数，零框架依赖，可被 vue3 / adapter-antdv / vue2 包共享
 */
export function buildFirstClassGridOptions(
  opts: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // 合计行
  if (opts.showFooter) {
    result.showFooter = true
    if (typeof opts.footerMethod === 'function') {
      const fn = opts.footerMethod
      result.footerMethod = (params: unknown) => (fn as (p: unknown) => unknown)(params)
    }
    if (opts.footerData !== undefined) result.footerData = opts.footerData
  }

  // 行内编辑：editConfig 存在时自动开启 keepSource，否则 getUpdateRecords/getInsertRecords 永远返回空数组
  if (opts.editConfig !== undefined) {
    result.editConfig = opts.editConfig
    if (result.keepSource === undefined) result.keepSource = true
  }

  // Excel / CSV 导出
  if (opts.exportConfig !== undefined) {
    result.exportConfig = opts.exportConfig === true ? {} : opts.exportConfig
  }

  // 工具栏（true 展开为常用默认）
  if (opts.toolbarConfig !== undefined) {
    result.toolbarConfig = opts.toolbarConfig === true
      ? { export: true, refresh: true, custom: true }
      : opts.toolbarConfig
  }

  // 列宽拖拽（浅拷贝，防止外部修改影响 gridConfig）
  if (opts.columnConfig !== null && typeof opts.columnConfig === 'object') {
    result.columnConfig = { ...(opts.columnConfig as Record<string, unknown>) }
  }

  // 键盘导航 / 单元格选中 / 剪贴板 / 校验（直传）
  if (opts.keyboardConfig  !== undefined) result.keyboardConfig  = opts.keyboardConfig
  if (opts.mouseConfig     !== undefined) result.mouseConfig     = opts.mouseConfig
  if (opts.clipboardConfig !== undefined) result.clipboardConfig = opts.clipboardConfig
  if (opts.validConfig     !== undefined) result.validConfig     = opts.validConfig

  // 显式 keepSource（可覆盖 editConfig 自动注入的 true；用户设 false 时取消跟踪）
  if (opts.keepSource !== undefined) result.keepSource = opts.keepSource

  // 树形 / 代理请求 / 展开行 / 序号（一等公民字段，直传）
  if (opts.treeConfig   !== undefined) result.treeConfig   = opts.treeConfig
  if (opts.proxyConfig  !== undefined) result.proxyConfig  = opts.proxyConfig
  if (opts.expandConfig !== undefined) result.expandConfig = opts.expandConfig
  if (opts.seqConfig    !== undefined) result.seqConfig    = opts.seqConfig

  return result
}
