// @ts-nocheck - TODO: migrate to strict when refactored
import { computed } from '../../../vue-compat'
import type { Ref } from '../../../vue-compat'
import type { TableColumn, TableOptions } from '@es-plus/core'

function unrefOptions(options: Ref<TableOptions> | TableOptions): TableOptions {
  return options && typeof (options as any).value !== 'undefined'
    ? (options as any).value as TableOptions
    : options as TableOptions
}

export interface VxeColumnOption {
  field?: string
  title?: string
  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  showOverflow?: boolean | 'ellipsis' | 'tooltip' | 'title'
  type?: 'seq' | 'checkbox' | 'radio' | 'expand' | 'html'
  formatter?: (params: { cellValue: any; row: any; rowIndex: number; column: any }) => string
  slots?: Record<string, string>
  children?: VxeColumnOption[]
  [key: string]: any
}

interface AdapterResult {
  columns: VxeColumnOption[]
  renderSlotMap: Map<string, TableColumn>
}

export function useVxeColumnAdapter(
  columns: Ref<TableColumn[]>,
  options: Ref<TableOptions> | TableOptions,
  t?: (key: string) => string,
) {
  const _result = computed((): AdapterResult => {
    const cols: VxeColumnOption[] = []
    const slotMap = new Map<string, TableColumn>()
    const colList = columns.value
    const opts = unrefOptions(options)

    if (opts.multiSelect && !colList.some(c => c.type === 'selection')) {
      cols.push({ type: 'checkbox', width: 50, fixed: 'left', align: 'center' })
    }
    if (opts.snIndex && !colList.some(c => c.type === 'index')) {
      cols.push({ type: 'seq', width: 60, title: '#', align: 'center' })
    }
    if (opts.expand && !colList.some(c => c.type === 'expand')) {
      cols.push({ type: 'expand', width: 50, fixed: 'left', align: 'center', slots: { content: 'expand' } })
    }

    for (const col of colList) {
      if (col.hidCol) continue

      if (col.type === 'selection') {
        cols.push({
          type: 'checkbox',
          width: typeof col.width === 'number' ? col.width : 50,
          fixed: col.fixed === true ? 'left' : (col.fixed as 'left' | 'right') || 'left',
          align: 'center',
          ...((col as any).vxeColumn || {}),
        })
      } else if (col.type === 'index') {
        cols.push({
          type: 'seq',
          title: resolveTitle(col, t),
          width: typeof col.width === 'number' ? col.width : 60,
          align: 'center',
          ...((col as any).vxeColumn || {}),
        })
      } else if (col.type === 'expand') {
        let expandContentSlot = 'expand'
        if (col.render) {
          expandContentSlot = `_expand_render_${slotMap.size}`
          slotMap.set(expandContentSlot, col)
        }
        cols.push({
          type: 'expand',
          title: resolveTitle(col, t),
          width: typeof col.width === 'number' ? col.width : 50,
          fixed: 'left',
          align: 'center',
          slots: { content: expandContentSlot },
          ...((col as any).vxeColumn || {}),
        })
      } else if (col.groups && col.groups.length > 0) {
        cols.push(adaptGroupCol(col, slotMap, t))
      } else {
        cols.push(adaptSingleCol(col, slotMap, t))
      }
    }

    // treeConfig 存在时：自动将第一个数据列标记为 treeNode，驱动 vxe 在该列渲染缩进和展开图标
    if ((opts as any).treeConfig && !cols.some(c => c.treeNode)) {
      const firstDataCol = cols.find(c => !c.type)
      if (firstDataCol) {
        firstDataCol.treeNode = true
        if (!firstDataCol.align || firstDataCol.align === 'center') firstDataCol.align = 'left'
      }
    }

    return { columns: cols, renderSlotMap: slotMap }
  })

  return {
    adaptedColumns: computed(() => _result.value.columns),
    renderSlotMap: computed(() => _result.value.renderSlotMap),
  }
}

function resolveTitle(col: TableColumn, t?: (key: string) => string): string {
  if (col.labelKey && t) return t(col.labelKey as string)
  return (col.label || '') as string
}

function adaptSingleCol(
  col: TableColumn,
  slotMap: Map<string, TableColumn>,
  t?: (key: string) => string,
): VxeColumnOption {
  const field = (col.prop || col.key || '') as string

  const base: VxeColumnOption = {
    field,
    title: resolveTitle(col, t),
    align: (col.align as VxeColumnOption['align']) || 'center',
  }

  if (col.width) base.width = col.width as number | string
  if (col.minWidth) base.minWidth = col.minWidth as number | string
  if (col.fixed) base.fixed = col.fixed === true ? 'left' : col.fixed as 'left' | 'right'
  if (col.sortable) base.sortable = true
  if (col.ellipsis) base.showOverflow = 'tooltip'
  if ((col as any).treeNode) base.treeNode = true

  if (col.render) {
    const slotName = `_render_${field || '_nofield'}_${slotMap.size}`
    base.slots = { default: slotName }
    slotMap.set(slotName, col)
  } else if ((col.scopedSlots as any)?.customRender) {
    const slotName = (col.scopedSlots as any).customRender as string
    base.slots = { default: slotName }
  } else if (col.formatter) {
    const orig = col.formatter as (row: any, col: any, val: any, idx: number) => string
    base.formatter = ({ cellValue, row, rowIndex }: any) =>
      String(orig(row, col, cellValue, rowIndex) ?? '')
  }

  if (col.editRender) {
    base.editRender = col.editRender
  }

  if (col.footerFormatter) {
    const origFmt = col.footerFormatter as (params: any) => string
    base.footerFormatter = (params: any) => String(origFmt(params) ?? '')
  }

  const vxeExtra = (col as any).vxeColumn
  if (vxeExtra && typeof vxeExtra === 'object') {
    const { slots: extraSlots, ...restExtra } = vxeExtra
    Object.assign(base, restExtra)
    if (extraSlots) base.slots = { ...(base.slots || {}), ...extraSlots }
  }

  return base
}

function adaptGroupCol(
  col: TableColumn,
  slotMap: Map<string, TableColumn>,
  t?: (key: string) => string,
): VxeColumnOption {
  const base = adaptSingleCol(col, slotMap, t)
  base.children = col.groups!.map(child => adaptSingleCol(child, slotMap, t))
  return base
}
