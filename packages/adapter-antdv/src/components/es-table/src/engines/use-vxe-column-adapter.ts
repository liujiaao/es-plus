import { computed, unref, type Ref } from 'vue'
import { synthesizeLeadingColumns } from '@es-plus/core'
import type { TableColumn, TableOptions } from '../../../../types'

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
    const opts = unref(options)

    // AN-09：前置列（选择 → 序号 → 展开）由 core 单源合成（与 vue3/vue2 同规则）。
    for (const spec of synthesizeLeadingColumns(opts, colList)) {
      if (spec.type === 'selection') {
        cols.push({ type: 'checkbox', width: spec.width, fixed: spec.fixed, align: spec.align })
      } else if (spec.type === 'index') {
        cols.push({ type: 'seq', width: spec.width, title: spec.label, align: spec.align })
      } else {
        cols.push({
          type: 'expand',
          width: spec.width,
          fixed: spec.fixed,
          align: spec.align,
          slots: { content: 'expand' },
        })
      }
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
  // AN-10：契约键 `ellipsis`；`showOverflowTooltip` 是 el-table 的存量写法，一并认（三端同规则）。
  if (col.ellipsis || (col as any).showOverflowTooltip) base.showOverflow = 'tooltip'
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

  if ((col as any).editRender) {
    base.editRender = (col as any).editRender
  }

  if ((col as any).footerFormatter) {
    const origFmt = (col as any).footerFormatter as (params: any) => string
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
  base.children = (col.groups as TableColumn[]).map(child => adaptSingleCol(child, slotMap, t))
  return base
}
