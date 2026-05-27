<template>
  <div class="es-virtual-table-wrapper">
    <el-auto-resizer :disable-height="true">
      <template #default="{ width }">
        <el-table-v2
          ref="tableV2Ref"
          :columns="(adaptedColumns as any)"
          :data="dataSource"
          :width="width || 800"
          :height="tableHeight || 400"
          :row-height="options.rowHeight || 50"
          :estimated-row-height="options.estimatedRowHeight"
          :cache="options.overscanCount || 2"
          :row-key="options.rowkey || 'id'"
          :sort-by="(sortState as any)"
          :header-height="headerHeight"
          :class="tableClass"
          :row-class="rowClassName"
          :row-event-handlers="rowEventHandlers"
          @column-sort="handleColumnSort as any"
        />
      </template>
    </el-auto-resizer>
    <div v-if="!dataSource || dataSource.length === 0" class="es-virtual-table__empty">
      <slot name="empty">
        <div class="ant-empty ant-empty-normal">
          <div class="ant-empty-image">
            <svg class="ant-empty-img-simple" width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(0 1)" fill="none" fill-rule="evenodd">
                <ellipse class="ant-empty-img-simple-ellipse" cx="32" cy="33" rx="32" ry="7" />
                <g class="ant-empty-img-simple-g" fill-rule="nonzero">
                  <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
                  <path d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" class="ant-empty-img-simple-path" />
                </g>
              </g>
            </svg>
          </div>
          <div class="ant-empty-description">暂无数据</div>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, inject } from 'vue'
import { ElAutoResizer, ElTableV2 } from 'element-plus'
import type { TableColumn, TableOptions } from '../../../../types'
import { useColumnAdapter } from './use-column-adapter'
import { useVirtualSelection } from './use-virtual-selection'
import { useVirtualSort } from './use-virtual-sort'
import type { TableEngineExposed } from './types'
import { getGlobalConfig } from '../../../../config'

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
  'expand-change': [row: Record<string, unknown>, expanded: boolean]
}>()

const tableV2Ref = ref<InstanceType<typeof ElTableV2> | null>(null)
const headerHeight = 50

const esPlus = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}
const tFn = computed(() => (esPlus.t as ((key: string) => string) | undefined) || undefined)

const rowkey = computed(() => props.options.rowkey || 'id')
const dataSourceRef = toRef(props, 'dataSource')
const columnsRef = toRef(props, 'columns')

const {
  selectedKeys,
  allSelected,
  indeterminate,
  onSelectRow,
  onSelectAll,
  getSelectedRows,
  clearSelection,
  toggleRowSelection,
} = useVirtualSelection(dataSourceRef, rowkey.value)

const { sortState, onColumnSort, toSortChangePayload } = useVirtualSort()

const expandedKeys = ref<Set<string>>(new Set())

function onToggleExpand(key: string) {
  const next = new Set(expandedKeys.value)
  const row = props.dataSource.find(r => String(r[rowkey.value] ?? '') === key)
  if (next.has(key)) {
    next.delete(key)
    if (row) emit('expand-change', row, false)
  } else {
    next.add(key)
    if (row) emit('expand-change', row, true)
  }
  expandedKeys.value = next
}

let selectionChangeTimer: ReturnType<typeof setTimeout> | null = null
function emitSelectionChange() {
  if (selectionChangeTimer) clearTimeout(selectionChangeTimer)
  selectionChangeTimer = setTimeout(() => {
    emit('selection-change', getSelectedRows())
  }, 0)
}

const adaptedColumns = useColumnAdapter(columnsRef, {
  multiSelect: !!props.options.multiSelect,
  snIndex: !!props.options.snIndex,
  expand: !!props.options.expand,
  selectedKeys,
  allSelected,
  indeterminate,
  onSelectAll: (val: boolean) => {
    onSelectAll(val)
    emitSelectionChange()
  },
  onSelectRow: (key: string, val: boolean) => {
    onSelectRow(key, val)
    emitSelectionChange()
  },
  rowkey: rowkey.value,
  parentSlots: props.parentSlots,
  t: tFn.value,
  expandedKeys,
  onToggleExpand,
})

const tableClass = computed(() => {
  const cls: string[] = ['es-virtual-table']
  if (props.options.border) cls.push('es-virtual-table--border')
  if (props.options.stripe) cls.push('es-virtual-table--stripe')
  if (props.options.highlightCurrentRow) cls.push('es-virtual-table--highlight')
  return cls.join(' ')
})

const currentRowKey = ref<string>('')

const rowClassName = computed(() => {
  return ({ rowData, rowIndex }: { rowData: Record<string, unknown>; rowIndex: number }) => {
    const classes: string[] = []
    if (props.options.highlightCurrentRow) {
      const key = String(rowData[rowkey.value] ?? '')
      if (key === currentRowKey.value) {
        classes.push('current-row')
      }
    }
    const rowClassNameOpt = props.options.rowClassName as string | ((params: any) => string) | undefined
    if (typeof rowClassNameOpt === 'function') {
      const cls = rowClassNameOpt({ row: rowData, rowIndex })
      if (cls) classes.push(cls)
    } else if (typeof rowClassNameOpt === 'string' && rowClassNameOpt) {
      classes.push(rowClassNameOpt)
    }
    return classes.join(' ')
  }
})

const rowEventHandlers = computed(() => ({
  onClick: (e: { rowData: Record<string, unknown>; event: Event }) => {
    const key = String(e.rowData[rowkey.value] ?? '')
    currentRowKey.value = key
    emit('row-click', e.rowData, e.event)
  },
  onDblclick: (e: { rowData: Record<string, unknown>; event: Event }) => {
    emit('row-dblclick', e.rowData, e.event)
  },
  onContextmenu: (e: { rowData: Record<string, unknown>; event: Event }) => {
    emit('row-contextmenu', e.rowData, e.event)
  },
}))

function handleColumnSort(params: { key: string | number; order: 'asc' | 'desc' }) {
  onColumnSort(params)
  const payload = toSortChangePayload(props.columns)
  emit('sort-change', payload)
}

defineExpose<TableEngineExposed>({
  getTableRef: () => tableV2Ref.value,
  doLayout: () => {},
  toggleRowSelection,
  clearSelection,
  getSelectedRows,
  scrollToRow: (row: number) => {
    (tableV2Ref.value as any)?.scrollToRow?.(row)
  },
})
</script>

<style>
.es-virtual-table-wrapper {
  position: relative;
  width: 100%;
}
.es-virtual-table--border .el-table-v2 {
  border: 1px solid var(--el-border-color-lighter);
}
.es-virtual-table--border .el-table-v2 .el-table-v2__header-cell,
.es-virtual-table--border .el-table-v2 .el-table-v2__row-cell {
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.es-virtual-table--stripe .el-table-v2__row:nth-child(even) {
  background-color: var(--el-fill-color-lighter);
}
.es-virtual-table--highlight .el-table-v2__row.current-row {
  background-color: var(--el-color-primary-light-9) !important;
}
.es-virtual-table--highlight .el-table-v2__row:hover {
  background-color: var(--el-fill-color-light);
}
.es-virtual-table__empty {
  position: absolute;
  top: 50px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  z-index: 1;
}
.es-virtual-table__empty .ant-empty-image {
  height: 40px;
  margin-bottom: 8px;
}
.es-virtual-table__empty .ant-empty-img-simple-ellipse {
  fill: #f5f5f5;
}
.es-virtual-table__empty .ant-empty-img-simple-g {
  stroke: #d9d9d9;
}
.es-virtual-table__empty .ant-empty-img-simple-path {
  fill: #fafafa;
}
.es-virtual-table__empty .ant-empty-description {
  color: rgba(0, 0, 0, 0.25);
  font-size: 14px;
}
.es-virtual-expand-icon {
  color: var(--el-text-color-secondary);
}
.es-virtual-expand-icon:hover {
  color: var(--el-color-primary);
}
</style>
