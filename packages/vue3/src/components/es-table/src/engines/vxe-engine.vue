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
    @edit-actived="handleEditActived"
    @edit-closed="handleEditClosed"
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
import type { CellEditPayload, TableEngineExposed } from './types'
import { getGlobalConfig } from '../../../../config'
import RenderDomTb from './render-dom-tb'
import { useVxeColumnAdapter } from './use-vxe-column-adapter'
import { buildFirstClassGridOptions } from './use-vxe-grid-config'
import {
  buildRowSpanMethod,
  resolveMergeConfig,
  wantsCrossPageSelection,
  mergeSelectedRows,
  resolveSortParam,
  resolveEditProp,
  snapshotEditRow,
  diffEditRow,
} from '@es-plus/core'
import {
  normalizeVxeOrder,
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
  /** 行内编辑提交（仅 vxe 引擎）：未改值不发。 */
  'cell-edit': [payload: CellEditPayload]
}>()

const gridRef = ref<any>(null)
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) as Record<string, unknown> ?? getGlobalConfig() ?? {}

// 跨页保留勾选：判据收敛到 core 的 wantsCrossPageSelection —— 与 el-table 路径同口径
// （`options.multiSelect` 与显式 `type:'selection'` 列等价，`cachePageSelection:false` 一律关闭）。
// 此前只看 multiSelect，于是同一条列配置在 el-table 端能跨页、切到 vxe 就丢勾选。
const crossPageSelection = computed(() =>
  wantsCrossPageSelection(props.options, props.columns)
)

// P2：多选跨页保留依赖唯一键，缺少 rowkey 时给出明确警告（仅开发环境）
if (import.meta.env.DEV && crossPageSelection.value && !props.options.rowkey) {
  console.warn(
    '[es-plus] engine:"vxe" + 多选 建议设置 options.rowkey，' +
    '否则 vxe 无法通过 reserve 跨页保留已选行（当前默认以 "id" 字段作为 keyField）'
  )
}

// 行内编辑（editConfig）：这里**没有**「改动不回写」的警告 —— 那条旧警告是错的，已于
// 2026-10-26 删除。vxe 的 loadTableData 对入参只做 `reactive(datas.slice(0))`（同一个行对象
// 引用），编辑写的就是你传进 `:data-source` 的那一行；`keepSource` 只是另存一份快照供
// `revertData()` 用。于是 es-table 的深监听会照常发 `update:dataSource`。
// 宿主真正缺的是「改了哪一格、旧值是什么」，那由下面 edit-actived / edit-closed 归一后
// 的 `cell-edit` 补上（仅 vxe 引擎，见 core/table-edit.ts）。

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
    checkboxConfig: crossPageSelection.value
      ? { reserve: true, highlight: false }
      : undefined,
    sortConfig: {
      // 服务端排序的三种来源：proxyConfig 模式 / 列上写了 sortable:'custom' / 声明了 tableOptions.sortParam。
      // 命中任一就不再本地排（vxe 的 remote 语义），排序事实由后端给。
      remote: hasProxyConfig || props.columns.some((c: any) => c.sortable === 'custom') || !!resolveSortParam(props.options),
      trigger: 'cell',
    },
    // 当非 proxyConfig 模式时禁用内置分页（由 component.vue 统一管理 el-pagination）
    pagerConfig: hasProxyConfig ? (vxeExtra.pagerConfig || { enabled: true }) : { enabled: false },
  }

  if (opts.spanMethod) {
    base.mergeMethod = (params: any) => applySpanShim(opts.spanMethod, params)
  } else {
    // 合并单元格（AI-23）：声明式 mergeConfig → vxe mergeMethod，复用同一 core 闭包。
    const mergeCfg = resolveMergeConfig(opts)
    if (mergeCfg) {
      base.mergeMethod = (params: any) =>
        applySpanShim(buildRowSpanMethod(mergeCfg.rowsBy, props.dataSource), params)
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
// `selection-change` 的载荷口径与 el-table / a-table / 虚拟引擎一致：**只带当前页**。
// vxe 的事件同时给出 records（当前数据里的已选）与 reserves（其它页保留的行），
// 此前两者平铺合并后 emit —— 同一个事件在 vxe 端是跨页全集、在其它引擎是当前页，
// 文档又白纸黑字写「当前页选中行；跨页全集用 getSelectionRows() 取」。
// 跨页全集仍可用 getSelectionRows() 拿（见下方 defineExpose）。
function handleCheckboxChange({ records }: any) {
  emit('selection-change', records || [])
}

function handleCheckboxAll({ records }: any) {
  emit('selection-change', records || [])
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

// ─── 行内编辑会话 → `cell-edit` ──────────────────────────────
// vxe 的 edit-closed 只给 `{ row, column }`：没有旧值，字段名还埋在 column.property 里。
// 于是「进会话拍快照、出会话比一遍」（判定在 core/table-edit.ts，三端同一份）：
// 宿主拿到的永远是 { row, prop, value, oldValue }。
//
// vxe 同一时刻只有一个 actived 单元格/行（cell 模式一次一格，row 模式一次一行且
// 行内换格不会再派发 edit-actived），所以一个会话槽就够。
// 刻意用普通变量、不是 ref：这个会话只在两个事件处理器之间传递，不参与渲染；
// 而 ref 会把它深转成 reactive，读 `editSession.value.row` 拿到的是 `reactive(row)`
// 代理 —— 与 edit-closed 递进来的行对象**不是同一个引用**，身份校验会永远失败。
// （vxe 自己的行本来就是代理，reactive(代理) 返回同一个代理，所以真实环境下看不出问题。）
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
  // 以 gridConfig 为准：vxeConfig.editConfig 的深合并也走这里，读 props.options 会漏掉那一层
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
  const changes = diffEditRow(session.snapshot, row, prop)
  for (const change of changes) emit('cell-edit', { row, ...change })
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
  /**
   * 清空选择。
   *
   * `clearCheckboxRow()` 只遍历**当前表格数据**（`tableFullData`），开 reserve 后
   * 其它页的行留在 `checkboxReserveRowMap` 里 —— vxe 的 JSDoc 写着「彻底清空」，
   * 实现却按当前数据处理。少了 `clearCheckboxReserve()` 的话，用户点「清空」后
   * 翻回上一页，reserve 会把那些行**重新勾上**（实测：清空后 reserves 仍为 [1]）。
   * 两个方法都要调，顺序无所谓。
   */
  clearSelection: () => {
    gridRef.value?.clearCheckboxRow()
    gridRef.value?.clearCheckboxReserve?.()
  },
  // 当前数据已选 + 跨页保留：只调 getCheckboxRecords 会漏掉 reserve 里的其它页行
  // （实测跨页选中 3 行只回 1 行），两边都取，按 keyField 去重。
  getSelectedRows: () => mergeSelectedRows(
    gridRef.value?.getCheckboxRecords?.(),
    gridRef.value?.getCheckboxReserveRecords?.(),
    props.options.rowkey || 'id',
  ),
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
  // vxe4 的 <vxe-grid> 只代理 tableComponentMethodKeys 白名单（不含 print/exportData/getPrintHtml），
  // 直接 `grid.exportData()` 是 undefined 调用；统一下沉到内部 <vxe-table>。
  exportData: (opts?: any) => getInternalTable()?.exportData?.(opts),
  print:      (opts?: any) => getInternalTable()?.print?.(opts),
  getPrintHtml: (opts?: any) => getInternalTable()?.getPrintHtml?.(opts),
})
</script>
