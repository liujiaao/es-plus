<template>
  <div v-if="!vxeAvailable" style="padding: 16px; color: #f56c6c; border: 1px solid #fbc4c4; border-radius: 4px;">
    [es-plus] engine:'vxe' 需要先安装并注册 vxe-table：<br>
    <code>import VxeTable from 'vxe-table'; app.use(VxeTable)</code>
  </div>
  <!--
    inheritAttrs:false + v-bind="$attrs" 实现事件穿透管道
    vxe-grid 内部使用 <vxe-table> 渲染表格，columns 是 grid 级别 prop（由 grid 通过 loadColumn() 转发给内部 table）。
    行内编辑 CRUD 方法（getUpdateRecords / clearEdit 等）在 grid 的 tableComponentMethodKeys 白名单之外，
    因此通过 getRefMaps().refTable.value 直接访问内部 <vxe-table> 实例调用。
  -->
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
    @zoom="handleZoom"
  >
    <!-- render 函数列：动态插槽分发 -->
    <template v-for="[slotName, col] in renderSlotMap" :key="slotName" #[slotName]="{ row, rowIndex }">
      <RenderDomTb
        :render="(col.render as any)"
        :row="row"
        :index="rowIndex"
        :data-key="(col.prop || col.key || '') as string"
      />
    </template>
    <!-- 用户具名插槽透传（scopedSlots.customRender） -->
    <template v-for="(slotFn, slotName) in namedParentSlots" :key="slotName" #[slotName]="slotProps">
      <component :is="() => (slotFn as Function)(normalizeSlotProps(slotProps))" />
    </template>
    <!-- 默认空数据 UI（用户未提供 #empty 时生效，样式与 el-table 保持一致） -->
    <template v-if="!namedParentSlots['empty']" #empty>
      <div style="display:flex;justify-content:center;align-items:center;min-height:60px;color:var(--el-text-color-secondary,#909399);font-size:14px">
        {{ props.options.emptyText || '暂无数据' }}
      </div>
    </template>
  </vxe-grid>
</template>


<script setup lang="ts">
import { computed, ref, inject, toRef, resolveComponent } from 'vue'
import type { TableColumn, TableOptions } from '../../../../types'
import type { TableEngineExposed } from './types'
import { getGlobalConfig } from '../../../../config'
import RenderDomTb from './render-dom-tb'
import { useVxeColumnAdapter } from './use-vxe-column-adapter'
import { buildFirstClassGridOptions } from './use-vxe-grid-config'
import {
  normalizeVxeOrder,
  mergeCheckboxRecords,
  applySpanShim,
  resolveInternalTable,
} from './vxe-engine-helpers'

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
}>()

const gridRef = ref<any>(null)
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) as Record<string, unknown> ?? getGlobalConfig() ?? {}

// P2：多选跨页保留依赖唯一键，缺少 rowkey 时给出明确警告（仅开发环境）
if (import.meta.env.DEV && props.options.multiSelect && !props.options.rowkey) {
  console.warn(
    '[es-plus] engine:"vxe" + multiSelect:true 建议设置 options.rowkey，' +
    '否则 vxe 无法通过 reserve 跨页保留已选行（当前默认以 "id" 字段作为 keyField）'
  )
}

// 行内编辑（editConfig）在 keepSource 下修改内部副本，不会回写 v-model:dataSource。
// 这里 DEV 提示用户改动需通过 getUpdateRecords() 或监听 edit-closed 手动持久化。
// 仅当用户尚未接入持久化处理器时才提示：已通过 vxeOn 监听 edit-closed/edit-actived
// 或显式关闭 keepSource（改动直接写入行对象）时视为已处理，避免误报刷屏。
if (import.meta.env.DEV && (props.options as any)?.editConfig) {
  const vxeOn = ((props.options as any)?.vxeOn ?? {}) as Record<string, unknown>
  const hasPersistHandler =
    typeof vxeOn['edit-closed'] === 'function' ||
    typeof vxeOn['editClosed'] === 'function' ||
    typeof vxeOn['onEditClosed'] === 'function' ||
    (props.options as any)?.keepSource === false
  if (!hasPersistHandler) {
    console.warn(
      '[es-plus] engine:"vxe" + editConfig 行内编辑修改的是内部副本（keepSource），' +
      '不会自动回写 :data-source 或触发 update:dataSource —— 请调用 getUpdateRecords() 或监听 edit-closed 事件手动持久化改动'
    )
  }
}

// vxe-table 可用性检测（运行时判断，不强制 peerDep）
const vxeAvailable = computed(() => {
  try {
    const c = resolveComponent('VxeGrid')
    return typeof c === 'object' || typeof c === 'function'
  } catch {
    return false
  }
})
const tFn = computed(() => (esPlus.t as ((key: string) => string) | undefined) || undefined)

// ─── 列适配 ───────────────────────────────────────────────────
const { adaptedColumns, renderSlotMap } = useVxeColumnAdapter(
  toRef(props, 'columns'),
  toRef(props, 'options'),
  tFn.value,
)

// ─── 具名插槽过滤（排除 default + 已在 renderSlotMap 中的 slot，防止双重绑定）──
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
// 而 vxe 原生只传 { row, rowIndex, column, ... }（无 scope/value）。这里补上 scope 与
// value，让用户在三个引擎下都能用 #slot="{ scope }" 读取 scope.row。
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

// ─── vxe-grid 配置映射（options → gridConfig）───────────────
const gridConfig = computed(() => {
  const opts = props.options as any
  const vxeExtra: Record<string, any> = opts.vxeConfig || {}
  const hasProxyConfig = !!(vxeExtra.proxyConfig || opts.proxyConfig)

  const base: Record<string, any> = {
    border: opts.border ? 'full' : false,
    stripe: opts.stripe || false,
    size: opts.size === 'mini' ? 'mini' : opts.size === 'medium' ? 'medium' : 'small',
    loading: opts.loading || false,
    showHeader: opts.showHeader !== false,
    height: opts.heightType === 'maxHeight' ? undefined : (props.tableHeight || undefined),
    maxHeight: opts.heightType === 'maxHeight' ? (props.tableHeight || undefined) : undefined,
    // keepSource 必须在 base 初始即设置，确保 vxe-grid 首次渲染就将它转发给内部 <vxe-table>
    keepSource: opts.keepSource === false ? false : !!(opts.editConfig || opts.keepSource),
    rowConfig: {
      keyField: opts.rowkey || 'id',
      isCurrent: opts.highlightCurrentRow !== false,
      isHover: opts.highlightCurrentRow !== false,
    },
    checkboxConfig: opts.multiSelect
      ? { reserve: true, highlight: false }
      : undefined,
    sortConfig: {
      // proxyConfig 模式 或 有 sortable:'custom' 列时启用服务端排序（不在前端本地排序）
      remote: hasProxyConfig || props.columns.some((c: any) => c.sortable === 'custom'),
      trigger: 'cell',
    },
    // 当非 proxyConfig 模式时禁用内置分页（由 component.vue 统一管理 el-pagination）
    pagerConfig: hasProxyConfig ? (vxeExtra.pagerConfig || { enabled: true }) : { enabled: false },
  }

  if (opts.spanMethod) {
    base.mergeMethod = (params: any) => applySpanShim(opts.spanMethod, params)
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

  // headerCellStyle：未显式设置时沿用 defaultOptions 同款默认背景，对齐 el-table 路径行为
  // 显式设置 false/null 可关闭背景；设置对象/函数则使用指定样式
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

  // P1：cellStyle / cellClassName → vxe cellConfig
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

  // P1：defaultSort → vxe sortConfig.defaultSort（格式转换：ascending/descending → asc/desc）
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

  // ── 一等公民 API 映射（合计行 / 行内编辑 / 导出 / 工具栏 / 列宽 / 键盘 / 鼠标 / 剪贴板 / 校验）
  const firstClass = buildFirstClassGridOptions(opts)
  if (firstClass.columnConfig) {
    // columnConfig 与 base 已有值深合并（base.columnConfig 此时为 undefined，直接赋值即可）
    base.columnConfig = { ...(base.columnConfig || {}), ...(firstClass.columnConfig as Record<string, unknown>) }
    delete firstClass.columnConfig
  }
  Object.assign(base, firstClass)

  // ── vxeConfig 逃生舱：深合并（后写优先，可覆盖上方一等公民配置）──
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

  // options.vxeOn 配置式事件注入
  const vxeOn = opts.vxeOn as Record<string, Function> | undefined
  if (vxeOn) {
    for (const [evName, fn] of Object.entries(vxeOn)) {
      const camel = 'on' + evName.split('-').map((s: string) => s[0].toUpperCase() + s.slice(1)).join('')
      base[camel] = fn
    }
  }

  return base
})

// ─── 事件处理 ───────────────────────────────────────────────
function handleCheckboxChange({ records, reserves }: any) {
  emit('selection-change', mergeCheckboxRecords(records, reserves))
}

function handleCheckboxAll({ records, reserves }: any) {
  emit('selection-change', mergeCheckboxRecords(records, reserves))
}

function handleSortChange({ field, order }: any) {
  emit('sort-change', { column: { prop: field }, prop: field, order: normalizeVxeOrder(order) })
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

// vxeOn 事件转发：vxe-grid 通过 emit 发出的 native 事件，
// 经由显式 @event 监听后转发给用户在 vxeOn 中注册的回调
function handleZoom(params: any) {
  const handler = (props.options as any)?.vxeOn?.zoom
  if (handler) handler(params)
}

// ─── 标准接口实现 ────────────────────────────────────────────
// grid 只代理 tableComponentMethodKeys 白名单中的方法，
// 行内编辑 CRUD（getUpdateRecords/clearEdit 等）不在其内，
// 需要通过 getRefMaps().refTable 获取内部 <vxe-table> 实例直接调用
const getInternalTable = () => {
  const tbl = resolveInternalTable(gridRef)
  // getRefMaps 是 vxe-grid 内部 API（非公开），大版本升级可能重命名。
  // DEV 下主动警告，生产环境各方法已有 ?. 兜底不会崩溃。
  if (import.meta.env.DEV && gridRef.value && !tbl) {
    console.warn(
      '[es-plus] vxe-engine: getRefMaps().refTable 不可用——行内编辑方法（validate/getUpdateRecords 等）已失效。' +
      '请检查 vxe-table 版本兼容性。'
    )
  }
  return tbl
}

defineExpose<TableEngineExposed>({
  getTableRef: () => gridRef.value,
  doLayout: () => gridRef.value?.recalculate(true),
  toggleRowSelection: (row, selected) => {
    gridRef.value?.setCheckboxRow(row, selected !== false)
  },
  clearSelection: () => gridRef.value?.clearCheckboxRow(),
  getSelectedRows: () => gridRef.value?.getCheckboxRecords(true) || [],
  scrollToRow: (rowIndex: number) => {
    const row = props.dataSource[rowIndex]
    if (row) gridRef.value?.scrollToRow(row)
  },
  // vxe 原始实例：完整访问 60+ 方法和 45+ 事件
  vxeInstance: () => gridRef.value,

  // ── 行内编辑 CRUD（调用内部 <vxe-table> 实例，grid 不代理这些方法）──
  clearActived:     () => getInternalTable()?.clearActived?.(),
  clearValidate:    () => getInternalTable()?.clearValidate?.(),
  validate:         (rows?: Record<string, unknown>[]) => getInternalTable()?.validate?.(rows),
  getInsertRecords: () => getInternalTable()?.getInsertRecords?.() ?? [],
  getUpdateRecords: () => getInternalTable()?.getUpdateRecords?.() ?? [],
  getRemoveRecords: () => getInternalTable()?.getRemoveRecords?.() ?? [],
  revertData:       (rows?: Record<string, unknown> | Record<string, unknown>[]) => getInternalTable()?.revertData?.(rows),

  // ── 导出 / 打印 ─────────────────────────────────────────
  exportData: (opts?: any) => gridRef.value?.exportData?.(opts),
  print:      () => gridRef.value?.print?.(),
})
</script>
