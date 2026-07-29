import { computed, unref, type Ref } from 'vue'
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

    if (opts.multiSelect && !colList.some(c => c.type === 'selection')) {
      cols.push({ type: 'checkbox', width: 50, fixed: 'left', align: 'center' })
    }
    if (opts.snIndex && !colList.some(c => c.type === 'index' || c.type === 'snIndex')) {
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
      } else if (col.type === 'index' || col.type === 'snIndex') {
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
        // 树节点列左对齐更易读（仅当列未显式设置 align 时生效）
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
  // 显式 treeNode 透传（treeConfig 场景下用户可指定任意列作为树节点列）
  if ((col as any).treeNode) base.treeNode = true

  if (col.render) {
    const slotName = `_render_${field || '_nofield'}_${slotMap.size}`
    base.slots = { default: slotName }
    slotMap.set(slotName, col)
  } else if ((col.scopedSlots as any)?.customRender) {
    const slotName = (col.scopedSlots as any).customRender as string
    base.slots = { default: slotName }
    // 不加入 slotMap：由 namedParentSlots 自然透传用户的 template 插槽，
    // slotMap 只用于 render 函数列（需要 RenderDomTb 桥接）
  } else if (col.formatter) {
    const orig = col.formatter as (row: any, col: any, val: any, idx: number) => string
    base.formatter = ({ cellValue, row, rowIndex }: any) =>
      String(orig(row, col, cellValue, rowIndex) ?? '')
  }

  // editRender → vxe 行内编辑渲染器（一等公民字段）
  if (col.editRender) {
    base.editRender = col.editRender
  }

  // footerFormatter → vxe 表尾单元格格式化（一等公民字段）
  if (col.footerFormatter) {
    const origFmt = col.footerFormatter as (params: any) => string
    base.footerFormatter = (params: any) => String(origFmt(params) ?? '')
  }

  // vxeColumn 逃生舱（深合并，后写可覆盖上方一等公民字段）
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
