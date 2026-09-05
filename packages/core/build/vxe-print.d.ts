/**
 * vxe-table 打印辅助工具（框架无关）
 *
 * 背景：vxe-grid 打印 HTML 时只读静态 mergeBodyList，不执行 mergeMethod/spanMethod。
 * 使用 setMergeCells 又与 spanMethod 互斥（source 层有 errConflicts 报错）。
 * 解决方案：getPrintHtml 生成基础 HTML → patchHtmlRowSpans 修正 tbody rowspan/colspan
 *            → grid.print({ html: fixedHtml }) 绕过静态注册表直接使用修正后的 HTML。
 *
 * 本函数为纯 DOM 字符串变换（仅依赖浏览器 DOMParser），无 Vue/Element 依赖，
 * 因此下沉到 @es-plus/core，由 vue3 / vue2 / adapter-antdv 三端统一从此处导出，避免漂移。
 * 注意：仅在浏览器环境调用（依赖 DOMParser）；Node（MCP/CLI）侧不会触及。
 */
/**
 * 修正由 vxe getPrintHtml 生成的 HTML 中 tbody 单元格的 rowspan/colspan。
 *
 * @param html     vxe getPrintHtml 返回的完整 HTML 字符串
 * @param spanFn   接收 (rowIndex, colIndex) 返回 { rowspan, colspan } 的函数，
 *                 语义与 el-table spanMethod 相同：rowspan=0 表示该格被上方格覆盖（需删除）
 * @returns        修正后的 HTML 字符串（可直接传给 grid.print({ html }) ）
 */
export declare function patchHtmlRowSpans(html: string, spanFn: (rowIndex: number, colIndex: number) => {
    rowspan: number;
    colspan: number;
}): string;
//# sourceMappingURL=vxe-print.d.ts.map