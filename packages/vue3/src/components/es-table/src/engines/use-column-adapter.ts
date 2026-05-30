import { computed, h, ref, type Ref, type Slots, type VNode } from 'vue'
import { ElCheckbox, ElIcon, ElTooltip } from 'element-plus'
import type { TableColumn } from '../../../../types'

export interface VirtualColumn {
  key: string
  dataKey: string
  title: string
  width: number
  fixed?: true | 'left' | 'right'
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  cellRenderer?: (params: CellRendererParams) => any
  headerCellRenderer?: (params: HeaderCellRendererParams) => any
}

interface CellRendererParams {
  cellData: unknown
  column: VirtualColumn
  columnIndex: number
  rowData: Record<string, unknown>
  rowIndex: number
}

interface HeaderCellRendererParams {
  column: VirtualColumn
  columns: VirtualColumn[]
  columnIndex: number
  headerIndex: number
}

export interface ColumnAdapterOptions {
  multiSelect?: boolean
  snIndex?: boolean
  expand?: boolean
  selectedKeys: Ref<Set<string>>
  allSelected: Ref<boolean>
  indeterminate: Ref<boolean>
  onSelectAll: (val: boolean) => void
  onSelectRow: (rowKey: string, val: boolean) => void
  rowkey: string
  parentSlots?: Slots
  t?: (key: string) => string
  expandedKeys?: Ref<Set<string>>
  onToggleExpand?: (rowKey: string) => void
}

const DEFAULT_WIDTH = 150

export function useColumnAdapter(
  columns: Ref<TableColumn[]>,
  options: ColumnAdapterOptions
): Ref<VirtualColumn[]> {
  return computed(() => {
    const result: VirtualColumn[] = []
    const hasSelectionCol = columns.value.some(c => c.type === 'selection')
    const hasIndexCol = columns.value.some(c => c.type === 'index')
    const hasExpandCol = columns.value.some(c => c.type === 'expand')

    // options.multiSelect 注入选择列（仅当 columns 中没有 type:'selection' 时）
    if (options.multiSelect && !hasSelectionCol) {
      result.push(createSelectionColumn(options))
    }

    // options.expand 注入展开列（仅当 columns 中没有 type:'expand' 时）
    if (options.expand && !hasExpandCol) {
      result.push(createExpandColumn(options))
    }

    // options.snIndex 注入序号列（仅当 columns 中没有 type:'index' 时）
    if (options.snIndex && !hasIndexCol) {
      result.push(createIndexColumn())
    }

    for (const col of columns.value) {
      if (col.type === 'selection') {
        result.push(createSelectionColumn(options, col))
        continue
      }
      if (col.type === 'index') {
        result.push(createIndexColumn(col))
        continue
      }
      if (col.type === 'expand') {
        result.push(createExpandColumn(options, col))
        continue
      }

      if (col.groups && col.groups.length > 0) {
        for (const child of col.groups) {
          result.push(adaptColumn(child, options))
        }
      } else {
        result.push(adaptColumn(col, options))
      }
    }

    return result
  })
}

function adaptColumn(col: TableColumn, options: ColumnAdapterOptions): VirtualColumn {
  const key = (col.prop || col.key || '') as string
  const title = col.labelKey && options.t
    ? options.t(col.labelKey as string)
    : (col.label || '') as string

  const width = typeof col.width === 'number'
    ? col.width
    : typeof col.width === 'string'
      ? parseInt(col.width, 10) || DEFAULT_WIDTH
      : typeof col.minWidth === 'number'
        ? col.minWidth
        : typeof col.minWidth === 'string'
          ? parseInt(col.minWidth, 10) || DEFAULT_WIDTH
          : DEFAULT_WIDTH

  const base: VirtualColumn = {
    key,
    dataKey: key,
    title,
    width,
    align: (col.align as VirtualColumn['align']) || 'center',
  }

  if (col.fixed) {
    base.fixed = col.fixed === true ? 'left' : col.fixed as 'left' | 'right'
  }

  if (col.sortable) {
    base.sortable = true
  }

  if (col.render) {
    base.cellRenderer = createRenderCellRenderer(col)
  } else if (col.scopedSlots?.customRender && options.parentSlots) {
    base.cellRenderer = createSlotCellRenderer(col, options.parentSlots)
  } else if (col.ellipsis) {
    base.cellRenderer = createEllipsisCellRenderer(col)
  } else if (col.formatter) {
    base.cellRenderer = createFormatterCellRenderer(col)
  }

  return base
}

function createSelectionColumn(options: ColumnAdapterOptions, col?: TableColumn): VirtualColumn {
  const width = typeof col?.width === 'number' ? col.width
    : typeof col?.width === 'string' ? parseInt(col.width, 10) || 50
    : 50
  const fixed = col?.fixed != null
    ? (col.fixed === true ? 'left' : col.fixed as 'left' | 'right')
    : 'left'
  return {
    key: '__selection__',
    dataKey: '__selection__',
    title: '',
    width,
    fixed,
    align: 'center',
    cellRenderer: ({ rowData }) => {
      const rowKey = String(rowData[options.rowkey] ?? '')
      const checked = options.selectedKeys.value.has(rowKey)
      return h(ElCheckbox, {
        modelValue: checked,
        'onUpdate:modelValue': (val: boolean) => options.onSelectRow(rowKey, val),
        onClick: (e: Event) => e.stopPropagation(),
      })
    },
    headerCellRenderer: () => {
      return h(ElCheckbox, {
        modelValue: options.allSelected.value,
        indeterminate: options.indeterminate.value,
        'onUpdate:modelValue': (val: boolean) => options.onSelectAll(val),
      })
    },
  }
}

function createIndexColumn(col?: TableColumn): VirtualColumn {
  return {
    key: '__index__',
    dataKey: '__index__',
    title: (col?.label as string) || '#',
    width: typeof col?.width === 'number' ? col.width : 60,
    align: 'center',
    cellRenderer: ({ rowIndex }) => h('span', String(rowIndex + 1)),
  }
}

function createExpandColumn(options: ColumnAdapterOptions, col?: TableColumn): VirtualColumn {
  return {
    key: '__expand__',
    dataKey: '__expand__',
    title: (col?.label as string) || '',
    width: typeof col?.width === 'number' ? col.width : 50,
    fixed: 'left',
    align: 'center',
    cellRenderer: ({ rowData }) => {
      const rowKey = String(rowData[options.rowkey] ?? '')
      const expanded = options.expandedKeys?.value.has(rowKey) ?? false
      return h('span', {
        class: ['es-virtual-expand-icon', expanded ? 'is-expanded' : ''],
        style: {
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        },
        onClick: (e: Event) => {
          e.stopPropagation()
          options.onToggleExpand?.(rowKey)
        },
      }, h(ElIcon, { size: 14 }, () => h('svg', {
        viewBox: '0 0 1024 1024',
        width: '1em',
        height: '1em',
      }, h('path', {
        fill: 'currentColor',
        d: 'M384 192v640l384-320z',
      }))))
    },
  }
}

function createRenderCellRenderer(col: TableColumn) {
  return ({ cellData, rowData, rowIndex }: CellRendererParams) => {
    const renderFn = col.render as (h: typeof import('vue')['h'], ctx: any) => VNode
    return renderFn(h, { value: cellData, row: rowData, index: rowIndex })
  }
}

function createSlotCellRenderer(col: TableColumn, parentSlots: Slots) {
  const slotName = (col.scopedSlots as any).customRender as string
  return ({ cellData, rowData, rowIndex }: CellRendererParams) => {
    const slotFn = parentSlots[slotName]
    if (slotFn) {
      return slotFn({ row: rowData, column: col, scope: { row: rowData, $index: rowIndex }, value: cellData })
    }
    return h('span', String(cellData ?? ''))
  }
}

function createEllipsisCellRenderer(col: TableColumn) {
  return ({ cellData, rowData }: CellRendererParams) => {
    let text: string
    if (col.formatter) {
      const formatter = col.formatter as (row: any, column: any, cellValue: any, index: number) => string
      text = String(formatter(rowData, col, cellData, 0) ?? '')
    } else {
      text = String(cellData ?? '')
    }
    return h(ElTooltip, { content: text, placement: 'top', showAfter: 300 }, {
      default: () => h('div', {
        style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
      }, text)
    })
  }
}

function createFormatterCellRenderer(col: TableColumn) {
  const formatter = col.formatter as (row: any, column: any, cellValue: any, index: number) => string
  return ({ cellData, rowData, rowIndex }: CellRendererParams) => {
    const formatted = formatter(rowData, col, cellData, rowIndex)
    return h('span', String(formatted ?? ''))
  }
}
