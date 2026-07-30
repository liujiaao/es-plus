/**
 * vxe-table 打印辅助工具
 *
 * 背景：vxe-grid 打印 HTML 时只读静态 mergeBodyList，不执行 mergeMethod/spanMethod。
 * 使用 setMergeCells 又与 spanMethod 互斥（source 层有 errConflicts 报错）。
 * 解决方案：getPrintHtml 生成基础 HTML → patchHtmlRowSpans 修正 tbody rowspan/colspan
 *            → grid.print({ html: fixedHtml }) 绕过静态注册表直接使用修正后的 HTML。
 */

/**
 * 修正由 vxe getPrintHtml 生成的 HTML 中 tbody 单元格的 rowspan/colspan。
 *
 * @param html     vxe getPrintHtml 返回的完整 HTML 字符串
 * @param spanFn   接收 (rowIndex, colIndex) 返回 { rowspan, colspan } 的函数，
 *                 语义与 el-table spanMethod 相同：rowspan=0 表示该格被上方格覆盖（需删除）
 * @returns        修正后的 HTML 字符串（可直接传给 grid.print({ html }) ）
 */
export function patchHtmlRowSpans(
  html: string,
  spanFn: (rowIndex: number, colIndex: number) => { rowspan: number; colspan: number }
): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  Array.from(doc.querySelectorAll('tbody tr')).forEach((tr, ri) => {
    // 先快照 td 列表，避免 remove() 影响后续遍历的 ci 偏移
    Array.from(tr.querySelectorAll('td')).forEach((td, ci) => {
      const { rowspan, colspan } = spanFn(ri, ci)
      if (rowspan === 0) { td.remove(); return }
      if (rowspan > 1) td.setAttribute('rowspan', String(rowspan))
      if (colspan > 1) td.setAttribute('colspan', String(colspan))
    })
  })
  return doc.body.innerHTML
}
