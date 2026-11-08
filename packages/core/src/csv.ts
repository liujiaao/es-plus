/**
 * 默认引擎的 CSV 导出兜底。
 *
 * 背景：`EsTable` 的 `exportData()` 原先只代理到引擎，而默认 el-table / a-table
 * 引擎没有该方法 —— 调用方拿到 `undefined`，导出按钮点了没反应且无报错。
 * 这里提供一份**不依赖框架**的纯函数实现：调用方拿当前渲染的 rows + 列配置
 * 生成 CSV；只有 vxe 引擎才走 vxe-table 自己的 exportData（xlsx 等格式）。
 *
 * 设计约束：
 * - 不 import Vue / DOM 类型，`downloadCsv` 在无 DOM 环境返回 false（SSR / 测试）；
 * - 不猜业务格式：`formatter` 优先，其次 `dataOptions` 的 label，最后原始值；
 * - 跳过选择列 / 展开列 / 操作列 —— 它们不是数据；
 * - 默认带 UTF-8 BOM，避免 Excel 打开中文乱码。
 */

import { getNestedValue } from './shared.js'
import { resolveTableCellDisplay } from './table-cell.js'
import type { TableColumn } from './types.js'

/** CSV 导出只依赖列的最小结构，不绑定 `TableColumn` 的全部字段。 */
export interface CsvColumnLike {
  prop?: string
  key?: string
  label?: string
  labelKey?: string
  type?: string
  formatter?: (row: Record<string, unknown>, value?: unknown, index?: number) => unknown
  dataOptions?: TableColumn['dataOptions']
  emptyPlaceholder?: string
  btns?: unknown[]
  hidCol?: boolean
}

export interface BuildCsvOptions {
  /** 是否输出表头行，默认 true。 */
  includeHeader?: boolean
  /** 是否加 UTF-8 BOM，默认 true（Excel 中文）。 */
  bom?: boolean
  /** 空值占位，默认空串（CSV 里比 '-' 更适合下游处理）。 */
  emptyPlaceholder?: string
}

const NEEDS_QUOTE = /[",\r\n]/

function escapeCell(value: string): string {
  return NEEDS_QUOTE.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** 选择列 / 展开列 / 操作列 / 显式隐藏列不进入 CSV。 */
export function isCsvExportableColumn(col: CsvColumnLike): boolean {
  if (!col || col.hidCol) return false
  if (col.type === 'selection' || col.type === 'expand') return false
  if (Array.isArray(col.btns) && col.btns.length > 0) return false
  if (col.prop === 'operate' || col.key === 'operate') return false
  return !!(col.prop || col.key || col.label)
}

/** 把行数据 + 列配置序列化成 CSV 文本（默认带 BOM）。 */
export function buildCsv(
  rows: Array<Record<string, unknown>>,
  columns: CsvColumnLike[],
  options: BuildCsvOptions = {},
): string {
  const list = columns.filter(isCsvExportableColumn)
  const includeHeader = options.includeHeader !== false
  const empty = options.emptyPlaceholder ?? ''
  const lines: string[] = []

  if (includeHeader) {
    lines.push(
      list
        .map((col) => escapeCell(String(col.label ?? col.labelKey ?? col.prop ?? col.key ?? '')))
        .join(','),
    )
  }

  rows.forEach((row, index) => {
    const cells = list.map((col) => {
      const prop = (col.prop || col.key || '') as string
      const raw = prop ? getNestedValue(row, prop) : undefined
      let text: string

      if (typeof col.formatter === 'function') {
        const formatted = col.formatter(row, raw, index)
        text = formatted == null ? empty : String(formatted)
      } else if (Array.isArray(col.dataOptions) && col.dataOptions.length > 0) {
        // `resolveTableCellDisplay` 把空值硬编码成 '-'，导出要的是空串/自定义占位。
        text =
          raw == null || raw === ''
            ? empty
            : resolveTableCellDisplay({ ...col, emptyPlaceholder: empty }, row).text
      } else {
        text = raw == null || raw === '' ? empty : String(raw)
      }

      return escapeCell(text)
    })
    lines.push(cells.join(','))
  })

  const body = lines.join('\r\n')
  return (options.bom === false ? '' : '﻿') + body
}

/** 补 `.csv` 扩展名（已有任意扩展名则保留）。 */
export function ensureCsvExtension(filename: string): string {
  const name = String(filename || 'export').trim() || 'export'
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.csv`
}

export interface TableCsvExportParams {
  rows: Array<Record<string, unknown>>
  columns: CsvColumnLike[]
  /** 文件名，缺省 `export`（自动补 `.csv`）。 */
  filename?: string
  /** 目标格式，缺省 csv；非 csv 明确抛错，不静默产出错格式。 */
  type?: string
  /** 空值占位，缺省空串。 */
  emptyPlaceholder?: string
}

/**
 * 默认引擎（el-table / el-table / a-table）的导出兜底。
 *
 * 三端 `exportData()` 共用这一条路径：vxe 引擎有原生 `exportData` 时优先；
 * 否则调用本函数。`type` 缺省按 csv 处理，非 csv（xlsx/html/...）只能走 vxe，
 * 这里抛出可读错误，避免调用方拿到一份后缀不对的文件。
 *
 * @returns 是否真的触发了浏览器下载（无 DOM 环境为 false）。
 */
export function exportTableCsv(params: TableCsvExportParams): boolean {
  const type = params.type ? String(params.type).toLowerCase() : 'csv'
  if (type !== 'csv') {
    throw new Error(
      `[es-plus] exportData: type "${params.type}" is only supported by the vxe engine. ` +
        `Set tableOptions.engine = 'vxe', or omit \`type\` to export CSV with the current engine.`,
    )
  }
  const content = buildCsv(params.rows || [], params.columns || [], {
    emptyPlaceholder: params.emptyPlaceholder,
  })
  return downloadCsv(params.filename || 'export', content)
}

/**
 * 浏览器下载。无 DOM（SSR / 单测）时返回 false，调用方仍可拿到 CSV 文本自行处理。
 */
export function downloadCsv(filename: string, content: string): boolean {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    !document.body
  ) {
    return false
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ensureCsvExtension(filename)
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // 立即 revoke 在部分浏览器会取消下载，放到下一轮事件循环。
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}
