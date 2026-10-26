<template>
  <div v-if="!vxeAvailable" style="padding: 16px; color: #ff4d4f; border: 1px solid #ffa39e; border-radius: 4px;">
    [es-plus] engine:'vxe' 需要先安装并注册 vxe-table：<br>
    <code>import VxeTable from 'vxe-table'; app.use(VxeTable)</code>
  </div>
  <vxe-grid
    v-else
    ref="gridRef"
    v-bind="{ ...gridConfig, ...$attrs }"
    :columns="(adaptedColumns as any)"
    :data="dataSource"
    @checkbox-change="handleCheckboxChange"
    @checkbox-all="handleCheckboxAll"
    @sort-change="handleSortChange"
    @cell-click="handleCellClick"
    @cell-dblclick="handleCellDblclick"
    @row-contextmenu="handleRowContextmenu"
    @edit-actived="handleEditActived"
    @edit-closed="handleEditClosed"
  >
    <template v-for="[slotName, col] in renderSlotMap" #[slotName]="{ row, rowIndex }">
      <RenderDomTb
        :key="slotName"
        :render="(col.render as any)"
        :row="row"
        :index="rowIndex"
        :data-key="(col.prop || col.key || '') as string"
      />
    </template>
    <template v-for="(slotFn, slotName) in namedParentSlots" #[slotName]="slotProps">
      <component :is="() => (slotFn as Function)(normalizeSlotProps(slotProps))" :key="slotName" />
    </template>
    <template v-if="!namedParentSlots['empty']" #empty>
      <div style="display:flex;justify-content:center;align-items:center;min-height:60px;color:#8c8c8c;font-size:14px">
        {{ props.options.emptyText || '暂无数据' }}
      </div>
    </template>
  </vxe-grid>
</template>

<script setup lang="ts">
import { computed, ref, inject, toRef, resolveComponent } from 'vue'
import type { TableColumn, TableOptions } from '../../../../types'
import type { CellEditPayload, TableEngineExposed } from '@es-plus/core'
import { getGlobalConfig } from '../../../../config'
import RenderDomTb from './render-dom-tb'
import { useVxeColumnAdapter } from './use-vxe-column-adapter'
import { buildFirstClassGridOptions, buildRowSpanMethod, resolveMergeConfig, resolveSortParam, wantsCrossPageSelection, mergeSelectedRows, resolveEditProp, snapshotEditRow, diffEditRow } from '@es-plus/core'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  columns: TableColumn[]
  dataSource: Record<string, unknown>[]
  tableHeight: number
  options: TableOptions
  parentSlots?: Record<string, (...args: any[]) => any>
}>()

const emit = defineEmits<{
  'sort-change': [payload: { column: any; prop: string; order: string | null }]
  'selection-change': [rows: Record<string, unknown>[]]
  'row-click': [row: Record<string, unknown>, event: Event]
  'row-dblclick': [row: Record<string, unknown>, event: Event]
  'row-contextmenu': [row: Record<string, unknown>, event: Event]
  /** 行内编辑提交（仅 vxe 引擎）：未改值不发。 */
  'cell-edit': [payload: CellEditPayload]
}>()

const gridRef = ref<any>(null)
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) as Record<string, unknown> ?? getGlobalConfig() ?? {}

// 跨页保留勾选：判据收敛到 core 的 wantsCrossPageSelection（与 el-table 路径同口径：
// multiSelect 与显式 type:'selection' 列等价，cachePageSelection:false 一律关闭）。
const crossPageSelection = computed(() =>
  wantsCrossPageSelection(props.options, props.columns as { type?: string }[])
)

if (crossPageSelection.value && !props.options.rowkey) {
  console.warn(
    '[es-plus] engine:"vxe" + 多选 建议设置 options.rowkey，' +
    '否则 vxe 无法通过 reserve 跨页保留已选行（当前默认以 "id" 字段作为 keyField）'
  )
}

const vxeAvailable = computed(() => {
  try {
    const c = resolveComponent('VxeGrid')
    return typeof c === 'object' || typeof c === 'function'
  } catch {
    return false
  }
})
const tFn = computed(() => (esPlus.t as ((key: string) => string) | undefined) || undefined)

const { adaptedColumns, renderSlotMap } = useVxeColumnAdapter(
  toRef(props, 'columns'),
  toRef(props, 'options'),
  tFn.value,
)

const namedParentSlots = computed(() => {
  const result: Record<string, (...args: any[]) => any> = {}
  const parentSlots = props.parentSlots || {}
  const usedByRenderMap = new Set(renderSlotMap.value.keys())
  for (const [name, fn] of Object.entries(parentSlots)) {
    if (name !== 'default' && !usedByRenderMap.has(name)) result[name] = fn
  }
  return result
})

// 统一自定义插槽 scope 形状：standard/virtual 引擎传 { row, column, scope, value }，
// vxe 原生只传 { row, rowIndex, column, ... }。补上 scope 与 value 保持一致。
function normalizeSlotProps(slotProps: any) {
  if (!slotProps) return slotProps
  const { row, rowIndex, column } = slotProps
  const prop = column?.property ?? column?.field
  return {
    ...slotProps,
    row,
    column,
    scope: { row, $index: rowIndex, column },
    value: prop && row ? row[prop] : undefined,
  }
}

const gridConfig = computed(() => {
  const opts = props.options as any
  const vxeExtra: Record<string, any> = opts.vxeConfig || {}
  const hasProxyConfig = !!(vxeExtra.proxyConfig || opts.proxyConfig)

  const base: Record<string, any> = {
    border: opts.border ? 'full' : false,
    stripe: opts.stripe || false,
    size: opts.size === 'mini' ? 'mini' : (opts.size === 'medium' || opts.size === 'middle') ? 'medium' : 'small',
    loading: opts.loading || false,
    showHeader: opts.showHeader !== false,
    height: opts.heightType === 'maxHeight' ? undefined : (props.tableHeight || undefined),
    maxHeight: opts.heightType === 'maxHeight' ? (props.tableHeight || undefined) : undefined,
    keepSource: opts.keepSource === false ? false : !!(opts.editConfig || opts.keepSource),
    rowConfig: {
      keyField: opts.rowkey || 'id',
      isCurrent: opts.highlightCurrentRow !== false,
      isHover: opts.highlightCurrentRow !== false,
    },
    checkboxConfig: crossPageSelection.value
      ? { reserve: true, highlight: false }
      : undefined,
    sortConfig: {
      // 排序必须由后端执行的三类情形：代理分页、列显式声明 sortable:'custom'、
      // 或 tableOptions.sortParam 已声明（服务端排序契约）。任一命中即不本地排。
      remote: hasProxyConfig || (props.columns || []).some((c: any) => c.sortable === 'custom') || !!resolveSortParam(opts),
      trigger: 'cell',
    },
    pagerConfig: hasProxyConfig ? (vxeExtra.pagerConfig || { enabled: true }) : { enabled: false },
  }

  if (opts.spanMethod) {
    base.mergeMethod = ({ row, rowIndex, column, columnIndex }: any) => {
      const shimmedCol = column ? { ...column, property: column.field ?? column.property } : column
      const res = opts.spanMethod({ row, rowIndex, column: shimmedCol, columnIndex })
      if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
      return res || { rowspan: 1, colspan: 1 }
    }
  } else {
    // 合并单元格（AI-23）：声明式 mergeConfig → vxe mergeMethod，复用同一 core 闭包。
    const mergeCfg = resolveMergeConfig(opts)
    if (mergeCfg) {
      const spanFn = buildRowSpanMethod(mergeCfg.rowsBy, props.dataSource as Record<string, unknown>[])
      base.mergeMethod = ({ row, rowIndex, column, columnIndex }: any) => {
        const shimmedCol = column ? { ...column, property: column.field ?? column.property } : column
        const res = spanFn({ row, rowIndex, column: shimmedCol, columnIndex })
        if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
        return res || { rowspan: 1, colspan: 1 }
      }
    }
  }

  if (opts.rowClassName) {
    base.rowConfig = {
      ...base.rowConfig,
      className: ({ row, rowIndex }: any) =>
        typeof opts.rowClassName === 'function'
          ? opts.rowClassName({ row, rowIndex })
          : (opts.rowClassName || ''),
    }
  }

  if (opts.rowStyle) {
    base.rowConfig = {
      ...base.rowConfig,
      style: ({ row, rowIndex }: any) =>
        typeof opts.rowStyle === 'function'
          ? opts.rowStyle({ row, rowIndex })
          : opts.rowStyle,
    }
  }

  const effectiveHeaderStyle = opts.headerCellStyle !== undefined ? opts.headerCellStyle : { background: '#f5f7fa' }
  if (effectiveHeaderStyle) {
    base.headerCellConfig = {
      style: typeof effectiveHeaderStyle === 'function'
        ? ({ column, columnIndex }: any) => (effectiveHeaderStyle as Function)({ column, columnIndex })
        : effectiveHeaderStyle,
    }
  }
  if (opts.headerCellClassName) {
    base.headerCellConfig = {
      ...(base.headerCellConfig || {}),
      className: typeof opts.headerCellClassName === 'function'
        ? ({ column, columnIndex }: any) => (opts.headerCellClassName as Function)({ column, columnIndex })
        : opts.headerCellClassName,
    }
  }

  if (opts.cellStyle || opts.cellClassName) {
    base.cellConfig = {}
    if (opts.cellStyle) {
      base.cellConfig.style = typeof opts.cellStyle === 'function'
        ? ({ row, rowIndex, column, columnIndex }: any) =>
            (opts.cellStyle as Function)({ row, rowIndex, column, columnIndex })
        : opts.cellStyle
    }
    if (opts.cellClassName) {
      base.cellConfig.className = typeof opts.cellClassName === 'function'
        ? ({ row, rowIndex, column, columnIndex }: any) =>
            (opts.cellClassName as Function)({ row, rowIndex, column, columnIndex })
        : opts.cellClassName
    }
  }

  if (opts.defaultSort) {
    const ds = opts.defaultSort as { prop?: string; order?: string }
    if (ds.prop) {
      const vxeOrder = ds.order === 'ascending' ? 'asc' : ds.order === 'descending' ? 'desc' : (ds.order as 'asc' | 'desc')
      base.sortConfig = {
        ...base.sortConfig,
        defaultSort: { field: ds.prop, order: vxeOrder },
      }
    }
  }

  const firstClass = buildFirstClassGridOptions(opts)
  if (firstClass.columnConfig) {
    base.columnConfig = { ...(base.columnConfig || {}), ...(firstClass.columnConfig as Record<string, unknown>) }
    delete firstClass.columnConfig
  }
  Object.assign(base, firstClass)

  for (const [k, v] of Object.entries(vxeExtra)) {
    if (k === 'pagerConfig') continue // 已特殊处理
    const DEEP_MERGE_KEYS = [
      'rowConfig', 'checkboxConfig', 'sortConfig', 'columnConfig',
      'editConfig', 'keyboardConfig', 'mouseConfig',
    ]
    if (DEEP_MERGE_KEYS.includes(k) && base[k] && typeof v === 'object') {
      base[k] = { ...base[k], ...v }
    } else {
      base[k] = v
    }
  }

  const vxeOn = opts.vxeOn as Record<string, Function> | undefined
  if (vxeOn) {
    for (const [evName, fn] of Object.entries(vxeOn)) {
      const camel = 'on' + evName.split('-').map((s: string) => s[0].toUpperCase() + s.slice(1)).join('')
      base[camel] = fn
    }
  }

  return base
})

// selection-change 只带当前页（与 el-table / a-table / 虚拟引擎、以及三站文档一致：
// 「当前页选中行；跨页全集用 getSelectionRows() 取」）。
function handleCheckboxChange({ records }: any) {
  emit('selection-change', records || [])
}

function handleCheckboxAll({ records }: any) {
  emit('selection-change', records || [])
}

function handleSortChange({ field, order }: any) {
  const esOrder = order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : null
  emit('sort-change', { column: { prop: field }, prop: field, order: esOrder })
}

function handleCellClick({ row, $event }: any) {
  emit('row-click', row, $event)
}

function handleCellDblclick({ row, $event }: any) {
  emit('row-dblclick', row, $event)
}

function handleRowContextmenu({ row, $event }: any) {
  emit('row-contextmenu', row, $event)
}

// ─── 行内编辑会话 → `cell-edit` ──────────────────────────────
// vxe 的 edit-closed 只给 `{ row, column }`：没有旧值，字段名还埋在 column.property 里。
// 「进会话拍快照、出会话比一遍」的判定在 core/table-edit.ts（三端同一份）。
// vxe 同一时刻只有一个 actived 单元格/行，一个会话槽足够。
let editSession: {
  row: Record<string, unknown>
  mode: 'cell' | 'row'
  prop?: string
  snapshot: Record<string, unknown>
} | null = null

function handleEditActived({ row, column }: any) {
  if (!row) {
    editSession = null
    return
  }
  // 以 gridConfig 为准：vxeConfig.editConfig 的深合并也走这里
  const mode = (gridConfig.value.editConfig as any)?.mode === 'row' ? 'row' : 'cell'
  editSession = {
    row,
    mode,
    prop: mode === 'cell' ? resolveEditProp(column) : undefined,
    snapshot: snapshotEditRow(row),
  }
}

function handleEditClosed({ row, column }: any) {
  const session = editSession
  editSession = null
  // 会话与关闭对不上（数据被换掉 / 事件乱序）时不猜旧值 —— 宁可不发，也不发假载荷
  if (!session || !row || session.row !== row) return
  const prop = session.mode === 'cell' ? session.prop ?? resolveEditProp(column) : undefined
  for (const change of diffEditRow(session.snapshot, row, prop)) {
    emit('cell-edit', { row, ...change })
  }
}

// grid 只代理 tableComponentMethodKeys 白名单中的方法，
// 行内编辑 CRUD（getUpdateRecords/clearEdit 等）不在其内，
// 需要通过 getRefMaps().refTable 获取内部 <vxe-table> 实例直接调用
const getInternalTable = () => {
  const refTable = gridRef.value?.getRefMaps?.()?.refTable
  return refTable?.value ?? refTable
}

defineExpose<TableEngineExposed>({
  getTableRef: () => gridRef.value,
  doLayout: () => gridRef.value?.recalculate(true),
  toggleRowSelection: (row, selected) => {
    gridRef.value?.setCheckboxRow(row, selected !== false)
  },
  // clearCheckboxRow 只清「当前表格数据」；reserve 里其它页的行得单独清，
  // 否则用户点「清空」后翻回上一页，那些行会被 reserve 重新勾上（实测 reserves 仍为 [1]）。
  clearSelection: () => {
    gridRef.value?.clearCheckboxRow()
    gridRef.value?.clearCheckboxReserve?.()
  },
  // 当前数据已选 + 跨页保留（getCheckboxRecords 只覆盖当前数据，reserve 行会漏）
  getSelectedRows: () => mergeSelectedRows(
    gridRef.value?.getCheckboxRecords?.(),
    gridRef.value?.getCheckboxReserveRecords?.(),
    props.options.rowkey || 'id'
  ),
  scrollToRow: (rowIndex: number) => {
    const row = props.dataSource[rowIndex]
    if (row) gridRef.value?.scrollToRow(row)
  },
  vxeInstance: () => gridRef.value,

  // ── 行内编辑 CRUD（调用内部 <vxe-table> 实例）──────────────
  clearActived:     () => getInternalTable()?.clearActived?.(),
  clearValidate:    () => getInternalTable()?.clearValidate?.(),
  validate:         (rows?: Record<string, unknown>[]) => getInternalTable()?.validate?.(rows),
  getInsertRecords: () => getInternalTable()?.getInsertRecords?.() ?? [],
  getUpdateRecords: () => getInternalTable()?.getUpdateRecords?.() ?? [],
  getRemoveRecords: () => getInternalTable()?.getRemoveRecords?.() ?? [],
  revertData:       (rows?: Record<string, unknown> | Record<string, unknown>[]) => getInternalTable()?.revertData?.(rows),

  // vxe4 的 <vxe-grid> 只代理 tableComponentMethodKeys 白名单（不含 print/exportData/getPrintHtml），
  // 直接 `grid.exportData()` 是 undefined 调用；统一下沉到内部 <vxe-table>。
  exportData: (opts?: any) => getInternalTable()?.exportData?.(opts),
  print:      (opts?: any) => getInternalTable()?.print?.(opts),
  getPrintHtml: (opts?: any) => getInternalTable()?.getPrintHtml?.(opts),
})
</script>
