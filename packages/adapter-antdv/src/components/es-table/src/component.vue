<!--
  ADV 适配器：EsTable 表格组件

  Ant Design Vue 版表格，核心差异：
  - a-table 替代 el-table，使用 columns 配置替代 el-table-column 子组件
  - 内置 virtual 滚动 (ADV 4.x 原生支持)
  - 选择使用 rowSelection 声明式配置
  - 排序/分页变化统一由 @change 事件触发
  - a-spin 替代 v-loading 指令
  - a-pagination 替代 el-pagination
  - a-config-provider 替代 el-config-provider
-->
<template>
  <a-config-provider :locale="antLocale">
    <div :ref="setTableContainer" class="table_component" :class="{ 'table-striped': options.stripe }" :style="{ [heightType]: tabHeight }">
      <a-spin :spinning="loadStatus" tip="努力加载中...">
        <div class="table_containers">
          <!-- 插槽区域 -->
          <div
            v-if="showHeaderBar"
            ref="headBarRef"
            class="btn-slot"
            :style="headerBarStyle"
            :class="headerBarClassList"
          >
            <div class="headerBar" v-if="hasDefaultSlot" :style="{ paddingBottom: hasDefaultSlot ? '10px' : '0px' }">
              <slot />
            </div>
          </div>

          <!-- 工具栏按钮 -->
          <table-btns
            ref="tbBtnRef"
            :instance="{ tableRef: instance, formInstance: formInstance, getVxeGrid: getVxeGridInstance }"
            v-if="((options.configBtn && (options.configBtn as any[]).length) || options.leftText) && !(isVxeEngine && ((options as any).toolbarConfig || (options as any).vxeConfig?.toolbarConfig))"
            :btn-config="(options.configBtn as any[])"
            :left-text="(options.leftText as string)"
          />

          <!-- vxe engine -->
          <!-- M-4: vxeFilteredColumns 注入了 operate.btns→render；M-7: v-bind="$attrs" 透传 -->
          <vxe-engine
            v-if="isVxeEngine"
            ref="vxeEngineRef"
            v-bind="$attrs"
            :columns="vxeFilteredColumns"
            :data-source="tableData.length ? tableData : dataSource"
            :table-height="tableHeight"
            :options="({ ...defaultOptions, ...options } as any)"
            :parent-slots="($slots as any)"
            @selection-change="(rows: Record<string, unknown>[]) => handleSelectionChange(rows, paginationConfig.current || 1)"
            @sort-change="handleVxeSortChange"
          />

          <!-- 表格主体 -->
          <a-table
            v-else
            ref="tableRef"
            :columns="adaptedColumns"
            :dataSource="tableData.length ? tableData : dataSource"
            :rowKey="rowKeyValue"
            :pagination="false"
            :loading="false"
            :bordered="options.border"
            :size="tableSize"
            :showHeader="options.showHeader !== false"
            :rowSelection="hasSelection ? resolvedRowSelection : undefined"
            :rowClassName="resolvedRowClassName"
            :customRow="resolvedCustomRow"
            :customHeaderRow="resolvedCustomHeaderRow"
            :scroll="tableScroll"
            :virtual="isVirtual"
            :sortDirections="['ascend', 'descend', 'ascend']"
            :locale="{ emptyText: options.emptyText || '暂无数据' }"
            :defaultExpandAllRows="false"
            @change="handleAdvTableChange"
            v-bind="tableBindAttrs"
          >
            <!-- 展开行 -->
            <template v-if="expandEnabled" #expandedRowRender="{ record }">
              <slot name="expand" :row="record" />
            </template>

            <!-- 自定义列渲染 (bodyCell 插槽) -->
            <template #bodyCell="{ column, text, record, index }">
              <!-- 操作列 -->
              <template v-if="isOperateColumn(column)">
                <a-button
                  v-for="(btn, bIdx) in getOperateBtns(column, record)"
                  :key="bIdx"
                  :type="mapBtnTypeAny(btn.type)"
                  :danger="mapBtnDanger(btn.type)"
                  size="small"
                  style="margin-right: 4px"
                  @click="btn.clickEvent?.(record)"
                >
                  <template #icon v-if="btn.icon">
                    <component :is="getAdvIconComponent(btn.icon)" />
                  </template>
                  {{ btn.name }}
                </a-button>
              </template>

              <!-- 自定义 render 函数列 -->
              <render-dom-tb
                v-else-if="getColumnRender(column)"
                :row="record"
                :index="index"
                :data-key="getColumnDataIndex(column)"
                :render="getColumnRender(column)"
              />

              <!-- 省略号列 -->
              <a-tooltip
                v-else-if="column.ellipsis && text != null && String(text).length > 20"
                :title="text"
                placement="top"
              >
                <span class="ellipsis-text">{{ text }}</span>
              </a-tooltip>

              <!-- scopedSlots 列 -->
              <template v-else-if="getColumnScopedSlotName(column)">
                <slot
                  v-bind="{ ...getColumnEsCol(column), row: record, column, index }"
                  :name="getColumnScopedSlotName(column)"
                />
              </template>
            </template>
          </a-table>
        </div>

        <!-- 分页 -->
        <div
          v-if="showPagination && !isVxeProxyMode"
          ref="paginationRef"
          class="pagination_page"
        >
          <a-pagination
            v-model:current="paginationConfig.current"
            v-model:pageSize="paginationConfig.pageSize"
            :total="paginationConfig.total"
            :showSizeChanger="true"
            :showQuickJumper="true"
            :pageSizeOptions="paginationPageSizes.map(String)"
            :size="paginationIsSmall ? 'small' : 'default'"
            :showTotal="(total: number) => `共 ${total} 条`"
            @change="handleAdvPageChange"
            @showSizeChange="handleAdvSizeChange"
          />
        </div>
      </a-spin>
    </div>
  </a-config-provider>
</template>

<script lang="ts">
import type { TableOptions } from '../../../types'

export default { name: 'EsTable' }

const defaultOptions: TableOptions = {
  multiSelect: false,
  expand: false,
  snIndex: false,
  loading: false,
  border: false,
  size: 'small' as const,
  headerCellStyle: { background: '#f5f7fa' },
  highlightCurrentRow: true,
  cachePageSelection: true,
  showHeader: true,
  emptyText: '暂无数据',
}
</script>

<script setup lang="ts">
import { ref, computed, watch, inject, getCurrentInstance, provide, toRaw, unref, h, onMounted, useAttrs, useSlots } from 'vue'
import { Table as ATable, Pagination as APagination, Spin as ASpin, ConfigProvider as AConfigProvider, Button as AButton, Tooltip as ATooltip } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import TableBtns from './table-btns.vue'
import { getGlobalConfig } from '../../../config'
import { useTableResize } from '../../../composables/use-table-resize'
import { useTableSelection } from '../../../composables/use-table-selection'
import { isObject, findValueByKey, mapSize, mapButtonType, mapButtonDanger } from '../../../utils/shared'
import { getAdvIconComponent } from '../../../utils/icon'
import {
  getCallback,
  TABLE_CONTEXT_INJECT_KEY,
  resolveKeepPage,
  computeBoundaryRollback,
} from '@es-plus/core'
import { adaptColumn, createSnAdvColumn } from './column-adapter'
import type { TableColumn, PaginationConfig } from '../../../types'
import RenderDomTb from './render-dom-tb'
import VxeEngine from './engines/vxe-engine.vue'

// ─── Props ───────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    initTabHeight?: number
    headBarClass?: string | Record<string, unknown>
    showHeaderBar?: boolean
    dataSource: Record<string, unknown>[]
    columns: TableColumn[]
    options?: TableOptions
    pagination?: PaginationConfig
  }>(),
  {
    initTabHeight: 400,
    showHeaderBar: true,
    dataSource: () => [],
    columns: () => [],
    options: () => ({ ...defaultOptions }),
    pagination: () => ({}),
  }
)

const emit = defineEmits<{
  'update:dataSource': [data: Record<string, unknown>[]]
  'update:pagination': [pagination: PaginationConfig]
  'pagination-current-change': [pagination: PaginationConfig]
  'size-change': [pagination: PaginationConfig, size: number]
  'change-table-sort': [column: Record<string, unknown>]
  // 自动加载（onMounted / visibleShow 显隐）失败时派发，携带原始错误。
  // 命令式的 refresh/reload 返回 Promise 由调用方自行 catch，不经此事件。（对齐 vue3）
  'request-error': [error: unknown]
}>()

const slots = useSlots() as any

// ─── 国际化 ─────────────────────────────────────────
const antLocale = ref(zhCN)

// ─── 注入 ───────────────────────────────────────────
const instance = getCurrentInstance() as any
const $esPlusTable = inject<Record<string, unknown> | null>('$esPlusTable', null) ?? getGlobalConfig().EsTable ?? {}
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) ?? getGlobalConfig() ?? {}

function getVxeGridInstance() {
  if (!isVxeEngine.value) return null
  return (vxeEngineRef.value as any)?.vxeInstance?.()
}

const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

// ─── Refs ───────────────────────────────────────────
const tableRef = ref<any>(null)
const tbBtnRef = ref<any>(null)
const headBarRef = ref<HTMLElement | null>(null)
const paginationRef = ref<HTMLElement | null>(null)
const tableContainerRef = ref<HTMLElement | null>(null)
const tableData = ref<Record<string, unknown>[]>([])
const columnRowList = ref<TableColumn[]>([...props.columns])
const loadingStatus = ref(false)

const setTableContainer = (el: any) => {
  if (el) tableContainerRef.value = el
}

watch(() => props.columns, (val) => { columnRowList.value = [...val] })

// ─── 表单耦合 ───────────────────────────────────────
const bodyFormInstance = inject<(inst: unknown) => void>('bodyFormInstance', () => undefined)
const getVisibleShow = inject<(() => boolean) | boolean>('getVisibleShow', () => false)
const visibleShow = computed(() => (typeof getVisibleShow === 'function' ? getVisibleShow() : getVisibleShow))
const formInstance = ref<unknown>(null)

// 从默认插槽扫 EsForm 取其 model（对齐 vue3 isFormInstance）
const isFormInstance = computed(() => {
  const defaultSlots = (instance as any)?.slots?.default?.() || []
  const formVNode = defaultSlots.find((vnode: any) => {
    const type = vnode.type
    return type?.name === 'EsForm' || type?.displayName === 'EsForm'
  })
  if (formVNode) {
    formInstance.value = (formVNode as any).ctx?.refs?.[(formVNode as any).props?.ref] || formVNode
    bodyFormInstance(formInstance.value)
  }
  return formVNode || {}
})

// entryQuery 兜底（对齐 vue3 getListEntry）
const getListEntry = computed(() => {
  if (props.options.entryQuery && isObject(props.options.entryQuery) && Object.keys(props.options.entryQuery).length) {
    return props.options.entryQuery
  }
  return {}
})

// ─── 分页 ───────────────────────────────────────────
const paginationConfig = ref<PaginationConfig>({
  pageSize: 10,
  current: 1,
  total: 0,
  pageSizes: [],
  size: 'small',
  isSmall: true,
  ...props.pagination,
})

watch(() => props.pagination, (val) => {
  paginationConfig.value = { ...paginationConfig.value, ...val }
}, { deep: true, immediate: true })

// ─── 表格尺寸 ───────────────────────────────────────
const tableSize = computed(() => mapSize(props.options.size, 'middle') as 'large' | 'middle' | 'small')

// ─── 虚拟滚动 ─────────────────────────────────────
const isVirtual = computed(() =>
  props.options.virtual === true || props.options.engine === 'virtual'
)

// ─── vxe engine ─────────────────────────────────
const isVxeEngine = computed(() => props.options.engine === 'vxe')
const isVxeProxyMode = computed(() => {
  if (!isVxeEngine.value) return false
  const opts = props.options as any
  return !!(opts.proxyConfig || (opts.vxeConfig as any)?.proxyConfig)
})
const vxeEngineRef = ref<any>(null)

// ─── rowKey ─────────────────────────────────────────
const rowKeyValue = computed(() => {
  if (props.options.rowkey) return props.options.rowkey
  return 'id'
})

// ─── 表格滚动 ───────────────────────────────────────
// 固定列需 scroll.x 才能生效；无固定列时不设 scroll.x，让表格按容器宽度铺满，
// 弹性列（无 width）自动吸收剩余空间（对齐 el-table 铺满行为）。
const hasFixedColumn = computed(() => props.columns.some((col) => !!col.fixed))

const tableScroll = computed(() => {
  const scroll: Record<string, unknown> = {}
  if (heightType.value === 'height' || heightType.value === 'maxHeight') {
    scroll.y = tableHeight.value
  }
  if (hasFixedColumn.value) {
    scroll.x = 'max-content'
  }
  return Object.keys(scroll).length ? scroll : undefined
})

// ─── 数据 ───────────────────────────────────────────
const loadStatus = computed(() => props.options.loading || loadingStatus.value)
const isRequestConf = computed(() =>
  !!props.options.actionUrl ||
  (props.options.apiParams && isObject(props.options.apiParams) && Object.keys(props.options.apiParams).length > 0) ||
  !!(props.options?.httpRequest && typeof props.options.httpRequest === 'function')
)
// 分页栏显示：外部显式传入 total 时按外部值显示；请求模式（actionUrl/apiParams）必然带分页，始终显示
const showPagination = computed(() => {
  if (props.pagination.total !== undefined) return true
  if (isRequestConf.value) return true
  return false
})
const hasDefaultSlot = computed(() => !!slots.default?.())
const hasExpandSlot = computed(() => !!(slots as any).expand)
// 展开：options.expand 或显式声明 type:'expand' 列（对齐 el-table/vxe 约定）均启用
const hasExpandColumn = computed(() => props.columns.some((c) => c.type === 'expand'))
const expandEnabled = computed(() => (!!props.options.expand || hasExpandColumn.value) && hasExpandSlot.value)
const heightType = computed(() => (props.options.heightType || 'auto') as 'auto' | 'height' | 'maxHeight')

const slotStyles = computed(() => {
  const raw = props.headBarClass
  if (typeof raw === 'string') return { type: 'string', value: raw }
  if (isObject(raw)) return { type: 'object', value: raw }
  return { type: 'object', value: {} }
})

const headerBarStyle = computed(() => {
  if (slotStyles.value.type === 'object') {
    return slotStyles.value.value as Record<string, string | number>
  }
  return undefined
})

const headerBarClassList = computed(() => {
  const list: (string | Record<string, unknown>)[] = []
  if (props.headBarClass) list.push(props.headBarClass)
  if (slotStyles.value.type === 'string') {
    list.push(slotStyles.value.value as string)
  } else if (slotStyles.value.type !== 'object') {
    list.push({ slotClass: hasDefaultSlot.value })
  }
  return list
})

const tabHeight = computed(() => {
  if (typeof props.options.tabHeight === 'number') return `${props.options.tabHeight}px`
  if (heightType.value === 'height' && typeof props.options.height === 'number') {
    return `${props.options.height}px`
  }
  return '100%'
})

// ─── 分页布局配置 ───────────────────────────────────
const paginationLayoutConfig = computed(() => {
  const cfg = $esPlusTable?.paginationLayout
  if (!cfg) return null
  return typeof cfg === 'function' ? cfg() : cfg
})
const paginationPageSizes = computed(() =>
  paginationLayoutConfig.value?.pageSizes || paginationConfig.value.pageSizes || [10, 20, 50, 100]
)
const paginationIsSmall = computed(() => paginationLayoutConfig.value?.isSmall ?? paginationConfig.value.isSmall)

// ─── 表格选择 ───────────────────────────────────────
const {
  rowSelection,
  multipleSelection,
  handleSelectionChange,
  initSelection,
  clearAllSelection,
  clearSelection,
  toggleRowSelection,
  setCurrentPage,
} = useTableSelection(props.options.rowkey, props.options.cachePageSelection)

// ─── 过滤列 ─────────────────────────────────────────
const filteredColumns = computed(() => {
  return columnRowList.value.filter((item) => !item.hidCol)
})

// M-4: vxe 引擎专用列（注入 operate 列的 btns→render；普通列注入 emptyPlaceholder formatter，对齐 a-table 路径行为）
const vxeFilteredColumns = computed(() => {
  return filteredColumns.value.map((item) => {
    const col = { ...item }
    if ((col.prop === 'operate' || col.key === 'operate') && col.btns && !col.render) {
      col.render = (_h: any, { row }: { row: Record<string, unknown> }) =>
        h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center' }, [
          (col.btns?.filter((btn: any) => {
            if (!checkPermission(btn.permissionValue)) return false
            if (typeof btn.hidden === 'function') return !btn.hidden(row)
            return !btn.hidden
          }) || [])
            .map((btn: any) =>
              h(AButton, {
                onClick: () => btn.clickEvent?.(row),
                text: true,
                type: mapBtnTypeAny(btn.type || 'primary'),
                danger: mapBtnDanger(btn.type),
                size: 'small',
              }, () => btn.name)
            ),
        ])
    } else if (!col.render && !(col.scopedSlots as any)?.customRender && !col.formatter) {
      // 注入 emptyPlaceholder 兜底，对齐 a-table 路径的 customRender 占位符行为
      const ph = (col.emptyPlaceholder as string) || '-'
      const field = (col.prop || col.key) as string
      col.formatter = (row: Record<string, unknown>) => {
        const value = row[field]
        if (value == null || value === '') return ph
        return String(value)
      }
    } else if (col.formatter) {
      // 有用户自定义 formatter 时也追加 emptyPlaceholder 兜底
      const ph = (col.emptyPlaceholder as string) || '-'
      const orig = col.formatter as (row: Record<string, unknown>) => string
      col.formatter = (row: Record<string, unknown>) => {
        const result = orig(row)
        if (result == null || result === '') return ph
        return String(result)
      }
    }
    return col
  })
})

// ─── 选择列（type:'selection' 等价 options.multiSelect，对齐 vue3 约定）──
// ADV 通过 rowSelection 自动渲染复选框列，故选择列不进 adaptedColumns；
// 此处仅检测其存在，并把 width/align/fixed 合并进 rowSelection。
const selectionCol = computed(() => filteredColumns.value.find((c) => c.type === 'selection'))
const hasSelection = computed(() => props.options.multiSelect || !!selectionCol.value)
const resolvedRowSelection = computed(() => {
  const rs = rowSelection.value
  const col = selectionCol.value
  if (!col) return rs
  const merged: Record<string, unknown> = { ...rs }
  if (col.width) merged.columnWidth = col.width
  if (col.align) merged.columnAlign = col.align
  if (col.fixed === true) merged.fixed = 'left'
  else if (col.fixed) merged.fixed = col.fixed
  return merged
})

// ─── 适配列 ─────────────────────────────────────────
const adaptedColumns = computed(() => {
  const cols: Record<string, unknown>[] = []
  const visible = filteredColumns.value
  const hasIndexCol = visible.some((c) => c.type === 'index')

  // 序号列（options.snIndex 注入；已存在 type:'index' 列时跳过，避免重复）
  if (props.options.snIndex && !hasIndexCol) {
    cols.push(createSnAdvColumn())
  }

  const t = typeof esPlus.t === 'function' ? (esPlus.t as (k: string) => string) : undefined
  for (const col of visible) {
    // 选择列：ADV 通过 rowSelection 渲染，此处跳过（对齐 vue3 type:'selection' 约定）
    if (col.type === 'selection') continue

    // 序号列：type:'index' 等价 options.snIndex
    if (col.type === 'index') {
      cols.push(createSnAdvColumn(col))
      continue
    }

    // 展开列：ADV 通过 expandedRowRender 整行渲染展开内容，不作为数据列。
    // 若混入数据列，其 scopedSlots.customRender 会让 bodyCell 在每行的窄单元格内
    // 内联渲染展开内容（如宽 50 的列 → 中文逐字竖排换行）。对齐 vxe/vue3 type:'expand'。
    if (col.type === 'expand') continue

    // 操作列：添加 buttons
    if ((col.prop === 'operate' || col.key === 'operate') && col.btns) {
      const filteredBtns = col.btns.filter((btn) => checkPermission(btn.permissionValue))
      const operateTitle = (col.labelKey && t ? t(col.labelKey) : undefined) || col.label || '操作'
      cols.push({
        dataIndex: 'operate',
        key: 'operate',
        title: operateTitle,
        width: col.width || (filteredBtns.length * 70 + 20),
        align: 'center',
        fixed: col.fixed === true ? 'right' : col.fixed || undefined,
        _esCol: { ...col, btns: filteredBtns },
      } as any)
      continue
    }

    // 普通列（adaptColumn 处理 labelKey/sortable/groups）
    const advCol = adaptColumn(col, t)
    const placeholder = (col.emptyPlaceholder as string) || '-'

    // 格式化函数：有 formatter 时使用 formatter；否则兜底显示文本（对齐 vue3 emptyPlaceholder）
    if (col.formatter) {
      advCol.customRender = ({ text, record }: { text: unknown; record: Record<string, unknown> }) => {
        return col.formatter?.(record) ?? (text == null || text === '' ? placeholder : String(text))
      }
    } else if ((col.prop || col.key) && !advCol.customRender) {
      advCol.customRender = ({ text }: { text: unknown }) => {
        if (text == null || text === '') return placeholder
        return String(text)
      }
    }

    cols.push(advCol)
  }

  // 宽度自适应：如果没有弹性列，将最后一列的 width → minWidth
  const allFixedWidth = cols.length > 0 && cols.every((c) => c.width && !c.minWidth)
  if (allFixedWidth) {
    let flexIdx = cols.length - 1
    for (let i = cols.length - 1; i >= 0; i--) {
      if (!cols[i].fixed && cols[i].dataIndex !== 'operate') { flexIdx = i; break }
    }
    if (flexIdx >= 0) {
      const c = cols[flexIdx]
      c.minWidth = c.width
      delete c.width
    }
  }

  return cols
})

// ─── 表格 attrs 透传 ────────────────────────────────
const TABLE_INTERNAL_KEYS = new Set([
  'multiSelect', 'expand', 'snIndex', 'loading', 'cachePageSelection',
  'httpRequest', 'configTableOut', 'listenToCallBack',
  'apiParams', 'actionUrl', 'heightType', 'tabHeight',
  'isInitRun', 'entryQuery', 'configBtn', 'leftText', 'rowkey',
  'virtual', 'engine', 'rowHeight', 'estimatedRowHeight', 'overscanCount',
  'rowClassName', 'border', 'stripe', 'size', 'showHeader',
  'emptyText', 'headerCellStyle', 'highlightCurrentRow',
])

const fallthroughAttrs = useAttrs()
const tableBindAttrs = computed(() => {
  const result: Record<string, unknown> = {}
  if (props.options.rowkey) result.rowKey = props.options.rowkey
  for (const [k, v] of Object.entries(fallthroughAttrs)) {
    if (!TABLE_INTERNAL_KEYS.has(k)) result[k] = v
  }
  return result
})

// ─── 行样式/类名（对齐 vue3 签名 {row, rowIndex}）──────
const currentRowKey = ref<unknown>(null)

const resolvedRowClassName = computed(() => {
  const rc = props.options.rowClassName
  const highlighted = props.options.highlightCurrentRow
  const rk = rowKeyValue.value
  return (record: Record<string, unknown>, index: number): string => {
    const classes: string[] = []
    if (typeof rc === 'function') {
      const c = rc({ row: record, rowIndex: index })
      if (c) classes.push(c)
    } else if (typeof rc === 'string') {
      classes.push(rc)
    }
    // 高亮当前行（对齐 vue3 highlightCurrentRow）
    if (highlighted && currentRowKey.value !== null) {
      const key = (record as any)?.[rk] ?? index
      if (key === currentRowKey.value) classes.push('ant-table-row-highlighted')
    }
    return classes.join(' ')
  }
})

const resolvedCustomRow = computed((): any => {
  const rowStyle = props.options.rowStyle
  const highlighted = props.options.highlightCurrentRow
  const rk = rowKeyValue.value
  if (!rowStyle && !highlighted) return undefined
  return (record: Record<string, unknown>, index: number) => {
    const s: Record<string, unknown> = {}
    if (typeof rowStyle === 'function') Object.assign(s, rowStyle({ row: record, rowIndex: index }))
    else if (rowStyle) Object.assign(s, rowStyle)
    const onClick = highlighted
      ? () => { currentRowKey.value = (record as any)?.[rk] ?? index }
      : undefined
    return { style: Object.keys(s).length ? s : undefined, onClick }
  }
})

// 表头样式（对齐 vue3 headerCellStyle → ADV customHeaderRow）
const resolvedCustomHeaderRow = computed((): any => {
  const hs = props.options.headerCellStyle
  if (!hs) return undefined
  return () => ({ style: hs })
})

// ─── 高度自适应 ─────────────────────────────────────
const { tableHeight, resizeObservers } = useTableResize(
  tableContainerRef, headBarRef, tbBtnRef, paginationRef,
  {
    heightType: heightType.value,
    tabHeight: props.options.tabHeight ?? (heightType.value === 'height' ? props.options.height : undefined),
  }
)

// ─── vxe sort 事件（格式已对齐 el-table/vue3 约定）──
function handleVxeSortChange(sortInfo: { column: Record<string, unknown>; prop: string; order: string | null }) {
  emit('change-table-sort', sortInfo)
}

// ─── ADV Table 统一 change 事件 ─────────────────────
function handleAdvTableChange(
  _pag: any,
  _filters: any,
  sorter: any
) {
  // 对齐 vue3 changeTableSort：直接 emit { column, prop, order }，含排序清除（order: null）
  if (sorter && (sorter as any).column) {
    const s = sorter as { column: Record<string, unknown>; order: string | null; field: string }
    const order = s.order === 'ascend' ? 'ascending' : s.order === 'descend' ? 'descending' : null
    emit('change-table-sort', { column: s.column, prop: s.field, order })
  }
}

// ─── 分页事件 ───────────────────────────────────────
function handleAdvPageChange(page: number) {
  paginationConfig.value.current = page
  setCurrentPage(page)
  if (isRequestConf.value) {
    changePageIndexRequest()
  } else {
    emit('update:pagination', { ...paginationConfig.value })
    emit('pagination-current-change', { ...paginationConfig.value })
  }
}

function handleAdvSizeChange(current: number, size: number) {
  paginationConfig.value.pageSize = size
  paginationConfig.value.current = 1
  setCurrentPage(1)
  if (isRequestConf.value) {
    changePageSizeRequest()
  } else {
    emit('update:pagination', { ...paginationConfig.value })
    emit('size-change', { ...paginationConfig.value }, size)
  }
}

// ─── 操作列按钮 ─────────────────────────────────────
function mapBtnType(type?: string): string {
  return mapButtonType(type)
}
function mapBtnTypeAny(type?: string): any {
  return mapButtonType(type)
}
function mapBtnDanger(type?: string): boolean {
  return mapButtonDanger(type)
}

const isOperateColumn = (column: any) => column?.dataIndex === 'operate' || column?.key === 'operate'
const getColumnEsCol = (column: any) => column?._esCol || {}
const getColumnRender = (column: any) => getColumnEsCol(column)?.render
const getColumnDataIndex = (column: any) => getColumnEsCol(column)?.prop || column?.dataIndex
const getColumnScopedSlot = (column: any) => getColumnEsCol(column)?.scopedSlots?.customRender
const getColumnScopedSlotName = (column: any): string | undefined => getColumnScopedSlot(column)

function getOperateBtns(column: any, row: Record<string, unknown>): any[] {
  const esCol = (column as any)?._esCol || {}
  const sourceBtns = esCol.btns
    ? esCol.btns
    : filteredColumns.value.find((c) => c.prop === 'operate' || c.key === 'operate')?.btns || []

  return sourceBtns.filter((b: any) => {
    if (!checkPermission(b.permissionValue)) return false
    if (typeof b.hidden === 'function') return !b.hidden(row)
    return !b.hidden
  })
}

// ─── 配置化请求 ─────────────────────────────────────
const configTableField = computed(() => {
  if (
    props.options.configTableOut &&
    isObject(props.options.configTableOut) &&
    Object.keys(props.options.configTableOut).length &&
    checkQueryFields(props.options.configTableOut)
  ) {
    return props.options.configTableOut
  }
  if ($esPlusTable?.configQueryFieldOutput && typeof $esPlusTable.configQueryFieldOutput === 'function') {
    const configFields = ($esPlusTable.configQueryFieldOutput as Function)({
      total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows',
    })
    if (checkQueryFields(configFields)) return configFields
  }
  return { total: 'records', pageSize: 'pageSize', current: 'pageNo', tableData: 'rows' }
})

function checkQueryFields(obj: Record<string, unknown>): boolean {
  const checkListKey = ['total', 'pageSize', 'current', 'tableData']
  if (isObject(obj)) {
    return Object.keys(obj).every((it) => checkListKey.find((its) => its === it) && obj[it] && typeof obj[it] === 'string')
  }
  return false
}

function getListenToCallBack(eventName: string, params: unknown) {
  const cb = props.options.listenToCallBack
  if (!cb) return undefined
  const fn = getCallback(cb as any, eventName)
  if (typeof fn === 'function') return fn(params)
  return undefined
}

function formatConfigOut(row: Record<string, unknown>, keyList: string[]) {
  if (isObject(configTableField.value) && Object.keys(configTableField.value).length) {
    Object.entries(configTableField.value).forEach(([key, value]) => {
      if (!keyList.includes(key)) return
      const rowData = row[value as string] ?? findValueByKey(row, value as string)
      if (key === 'tableData') {
        tableData.value = Array.isArray(rowData) ? rowData : []
      } else {
        ;(paginationConfig.value as any)[key] = typeof rowData === 'number' ? rowData : parseInt(rowData as string, 10) || 0
      }
    })
  }
}

function queryTableListMethod(
  params: Record<string, unknown>,
  options: { success?: (res: Record<string, unknown>) => void; fail?: (err: unknown) => void } = {}
) {
  const { success, fail } = options
  const apiParams = (props.options?.apiParams || {}) as Record<string, any>
  const url = props.options?.actionUrl || apiParams.url || ''
  // 无 url/apiParams 但配置了直接 httpRequest 时仍可发请求；否则 fail 让 Promise settle
  if ((!url || !Object.keys(apiParams).length) && !props.options.httpRequest) {
    if (typeof fail === 'function') fail(new Error('no url/apiParams configured'))
    return
  }

  const formData = Object.keys(isFormInstance.value).length
    ? toRaw(unref((isFormInstance.value as any).props?.model))
    : getListEntry.value || {}
  const fnParams = getListenToCallBack('beforeRequest', { ...formData, ...params, ...toRaw(unref(apiParams.model || {})) })
  const finalParams = isObject(fnParams) ? fnParams : { ...formData, ...toRaw(unref(apiParams.model || {})), ...params }
  const requestOption = { ...toRaw(unref(apiParams.options || {})) }
  if (apiParams?.method) requestOption.method = apiParams?.method

  const requestHandler = async (requestFn: Function) => {
    if (loadingStatus.value) {
      if (typeof fail === 'function') fail(new Error('request already in progress'))
      return
    }
    loadingStatus.value = true
    try {
      const res = await requestFn({
        url, formParams: finalParams, headers: apiParams.headers || {},
        ...requestOption, ...params,
      })
      const responseData = getListenToCallBack('afterResponse', res) || res
      if (isObject(res) && Object.keys(res).length && typeof success === 'function') {
        success(responseData as Record<string, unknown>)
      }
    } catch (e) {
      if (typeof fail === 'function') fail(e)
    } finally {
      loadingStatus.value = false
    }
  }

  if (props.options.httpRequest) {
    requestHandler(props.options.httpRequest)
  } else if ($esPlusTable.$httpRequest) {
    requestHandler($esPlusTable.$httpRequest as Function)
  } else {
    if (typeof fail === 'function') fail(new Error('no httpRequest configured'))
  }
}

const httpRequestInstance = (model?: Record<string, unknown>, reqOptions?: { keepPage?: boolean }) => {
  // 是否保留当前页码：本次调用显式传入的 keepPage 优先，其次回退到表级
  // refetchKeepPage（默认 false，向后兼容）。查询/重置按钮显式传 keepPage:false，
  // 使「查询」始终回到第 1 页（搜索语义），不受 refetchKeepPage 影响。（对齐 vue3）
  const keepPage = resolveKeepPage(reqOptions?.keepPage, props.options?.refetchKeepPage)
  // vxe proxy mode：vxe 的 proxyConfig 接管请求层，ES-Plus 直接委托给 vxe 的内置查询触发器
  if (isVxeProxyMode.value) {
    // 'reload' 回到第 1 页（搜索语义），'query' 保留当前页
    ;(vxeEngineRef.value?.getTableRef?.() as any)?.commitProxy?.(keepPage ? 'query' : 'reload')
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    if (!keepPage) {
      paginationConfig.value.current = 1
    }
    queryTableListMethod(
      { ...(model || {}), pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
      {
        success: (res) => {
          // 加载成功：清除上一轮自动加载的错误态（若有）（对齐 vue3）
          requestError.value = null
          formatConfigOut(res, ['total', 'tableData'])
          if (Object.keys(props.pagination).length) {
            emit('update:pagination', { ...paginationConfig.value })
          }
          // 分页边界回退：保留页模式下，若拉取后当前页已无数据且非首页
          //（如删除了本页最后一条），回退到最后一个有效页并再次拉取。（对齐 vue3）
          const { shouldRollback, maxPage } = computeBoundaryRollback({
            keepPage,
            rowCount: tableData.value?.length ?? 0,
            current: paginationConfig.value.current,
            total: paginationConfig.value.total,
            pageSize: paginationConfig.value.pageSize,
          })
          if (shouldRollback) {
            paginationConfig.value.current = maxPage
            // 外层请求的 loadingStatus 到 finally 才复位，此刻仍为 true；
            // 若不先手动释放，递归的 queryTableListMethod 会被
            // `if (loadingStatus.value) return` 挡掉，导致页码回退了却没拉到数据。（对齐 vue3）
            loadingStatus.value = false
            queryTableListMethod(
              { ...(model || {}), pageIndex: maxPage, pageSize: paginationConfig.value.pageSize },
              {
                success: (res2) => {
                  formatConfigOut(res2, ['total', 'tableData'])
                  if (Object.keys(props.pagination).length) {
                    emit('update:pagination', { ...paginationConfig.value })
                  }
                  emit('pagination-current-change', { ...paginationConfig.value })
                  resolve(res2)
                },
                fail: (err) => {
                  surfaceRequestError(err)
                  reject(err)
                },
              }
            )
            return
          }
          resolve(res)
        },
        fail: (err) => {
          surfaceRequestError(err)
          reject(err)
        },
      }
    )
  })
}

function changePageIndexRequest() {
  queryTableListMethod(
    { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
    {
      success: (res) => {
        formatConfigOut(res, ['total', 'tableData'])
        emit('update:pagination', { ...paginationConfig.value })
        emit('pagination-current-change', { ...paginationConfig.value })
      },
    }
  )
}

function changePageSizeRequest() {
  queryTableListMethod(
    { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
    {
      success: (res) => {
        formatConfigOut(res, ['total', 'tableData'])
        emit('update:pagination', { ...paginationConfig.value })
      },
    }
  )
}

// ─── 生命周期 ───────────────────────────────────────
// 请求失败统一暴露（对齐 vue3）：所有失败路径——onMounted / visibleShow 两处「触发即忘」的
// 自动请求，以及 httpRequestInstance 内部 queryTableListMethod 的 fail 回调——都经此暴露：
//   - requestError：暴露给命令式消费方与测试读取
//   - emit('request-error')：供上层 UI 呈现失败态
// 命令式调用者（EsForm 查询/重置、EsCrudPage.refresh、翻页）拿到 rejected Promise
// 后各自 `.catch(() => {})` 兜底，避免 unhandled rejection。
const requestError = ref<unknown>(null)
const surfaceRequestError = (err: unknown) => {
  requestError.value = err
  emit('request-error', err)
}
onMounted(() => {
  if (isRequestConf.value && props.options.isInitRun !== false && !isVxeProxyMode.value) {
    httpRequestInstance().catch(() => {})
  }
})

watch(visibleShow, async (val, oldVal) => {
  if (val && val !== oldVal) {
    if (props.options.actionUrl && !isVxeProxyMode.value) {
      // fail 回调已 surfaceRequestError，这里只需吞掉 rejection 防 unhandled
      await httpRequestInstance().catch(() => {})
    }
    // ADV a-table 无 doLayout，等价重排（对齐 vue3 tableRef.doLayout）
    resizeObservers?.()
    tableRef.value?.$forceUpdate?.()
    vxeEngineRef.value?.doLayout?.()  // vxe 引擎：重算列宽（对齐 vue3/vue2 路径）
  }
})

watch(() => props.dataSource, (val) => {
  initSelection(val)
}, { deep: true })

watch(tableData, (val) => {
  if (Array.isArray(val)) emit('update:dataSource', val)
}, { deep: true })

// ─── Provide ─────────────────────────────────────────
provide(TABLE_CONTEXT_INJECT_KEY, () => ({
  ...(instance?.setupState || {}),
  tableRef: isVxeEngine.value ? vxeEngineRef : tableRef,
  toggleSelection: (rows: Record<string, unknown>[]) => {
    if (isVxeEngine.value) {
      if (rows) rows.forEach((r) => vxeEngineRef.value?.toggleRowSelection?.(r, true))
      else vxeEngineRef.value?.clearSelection?.()
    } else {
      if (rows) rows.forEach((r) => toggleRowSelection(r, true))
      else clearSelection()
    }
  },
  clearAllSelection: () => {
    clearAllSelection()
    if (isVxeEngine.value) vxeEngineRef.value?.clearSelection?.()
  },
  refsInstance: () => isVxeEngine.value ? vxeEngineRef.value?.vxeInstance?.() : tableRef.value,
  httpRequestInstance,
}))

// 全量重排：a-table 无 doLayout，用 resizeObservers + forceUpdate 等价重排；vxe 引擎调 doLayout
const doLayoutFn = () => {
  if (isVxeEngine.value) {
    vxeEngineRef.value?.doLayout?.()
  } else {
    resizeObservers?.()
    tableRef.value?.$forceUpdate?.()
  }
}

// ─── Expose（对齐 vue3 expose 集）─────────────────────
defineExpose({
  httpRequestInstance,
  // 最近一次自动加载（onMounted/visibleShow）的错误；成功后复位为 null（对齐 vue3）
  requestError,
  getSelectionRows: () => {
    if (isVxeEngine.value) return vxeEngineRef.value?.getSelectedRows?.() || []
    return multipleSelection.value
  },
  clearSelection: () => {
    if (isVxeEngine.value) vxeEngineRef.value?.clearSelection?.()
    else clearSelection()
  },
  clearAllSelection: () => {
    clearAllSelection()
    if (isVxeEngine.value) vxeEngineRef.value?.clearSelection?.()
  },
  // 刷新当前页：保留页码重新取数 + 重排。统一命令式刷新入口。（对齐 vue3）
  refresh: (model?: Record<string, unknown>) => {
    if (isVxeProxyMode.value) {
      ;(vxeEngineRef.value?.getTableRef?.() as any)?.commitProxy?.('query')
      return Promise.resolve()
    }
    if (isRequestConf.value) {
      return httpRequestInstance(model, { keepPage: true }).then((r) => {
        doLayoutFn()
        return r
      })
    }
    // 本地/静态：无网络，重排即可
    doLayoutFn()
    return Promise.resolve()
  },
  // 重新加载：回到第 1 页重新取数。搜索/重置语义。（对齐 vue3）
  reload: (model?: Record<string, unknown>) => {
    if (isVxeProxyMode.value) {
      ;(vxeEngineRef.value?.getTableRef?.() as any)?.commitProxy?.('reload')
      return Promise.resolve()
    }
    if (isRequestConf.value) {
      // httpRequestInstance 在 !keepPage 时内部已把 current 置 1
      return httpRequestInstance(model, { keepPage: false }).then((r) => {
        doLayoutFn()
        return r
      })
    }
    // 本地/静态：回到第 1 页
    paginationConfig.value.current = 1
    doLayoutFn()
    return Promise.resolve()
  },
  scrollToRow: (row: number) => {
    if (isVxeEngine.value) {
      vxeEngineRef.value?.scrollToRow?.(row)
    } else if (isVirtual.value) {
      ;(tableRef.value as any)?.scrollTo?.(row)
    } else {
      tableRef.value?.$el?.querySelectorAll?.('.ant-table-row')?.[row]?.scrollIntoView?.({ block: 'center' })
    }
  },
  toggleRowSelection: (row: Record<string, unknown>, selected?: boolean) => {
    if (isVxeEngine.value) vxeEngineRef.value?.toggleRowSelection?.(row, selected)
    else toggleRowSelection(row, selected !== false)
  },
  // 仅重排列宽/布局，不重新取数（旧 refresh 行为的逃生舱）（对齐 vue3）
  doLayout: doLayoutFn,
  // vxe 行内编辑 CRUD（engine:'vxe' 时有效）
  getUpdateRecords: () => isVxeEngine.value ? vxeEngineRef.value?.getUpdateRecords?.() ?? [] : [],
  getInsertRecords: () => isVxeEngine.value ? vxeEngineRef.value?.getInsertRecords?.() ?? [] : [],
  getRemoveRecords: () => isVxeEngine.value ? vxeEngineRef.value?.getRemoveRecords?.() ?? [] : [],
  revertData: (rows?: Record<string, unknown> | Record<string, unknown>[]) => vxeEngineRef.value?.revertData?.(rows),
  clearActived: () => vxeEngineRef.value?.clearActived?.(),
  clearValidate: () => vxeEngineRef.value?.clearValidate?.(),
  validate: (rows?: Record<string, unknown>[]) => vxeEngineRef.value?.validate?.(rows),
  // vxe 原始实例（100% vxe 方法/事件访问入口；getPrintHtml/print 等经此获取）
  vxeInstance: () => isVxeEngine.value ? vxeEngineRef.value?.vxeInstance?.() : null,
})
</script>

<style lang="scss" scoped>
.table_component {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  overflow: hidden;

  // a-spin 在 align-items:flex-start 的 flex 容器中会收缩到内容宽度，
  // 显式铺满并建立完整 flex 链（table_component → a-spin → ant-spin-container → table_containers + pagination），
  // 确保在固定高度容器（heightType: 'height'）中分页器始终可见。
  :deep(.ant-spin-nested-loading) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  :deep(.ant-spin-container) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
}

.table_containers {
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: flex-start;
  position: relative;

  // a-table 根在 flex 容器中会收缩到内容宽度，显式铺满以触发弹性列吸收剩余空间。
  :deep(.ant-table-wrapper) {
    width: 100%;
  }

  // vxe-grid / vxe-table 同样在 align-items:flex-start 的 flex 容器中收缩到内容宽度，
  // 导致 vxe 测量到的容器宽 = 各列宽之和，无剩余空间可分配，弹性列（仅设 minWidth）无法撑开。
  // 显式铺满后 vxe 才能按容器宽把剩余空间分配给弹性列。
  :deep(.vxe-grid),
  :deep(.vxe-table) {
    width: 100%;
  }
}

.pagination_page {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0;
}

// 斑马纹（对齐 vue3 stripe）
.table-striped {
  :deep(.ant-table-tbody > tr:nth-child(even)) {
    background: #fafafa;
  }
}

// 高亮当前行（对齐 vue3 highlightCurrentRow）
:deep(.ant-table-row-highlighted) {
  background: #e6f4ff !important;
}

.btn-slot {
  width: 100%;
  .headerBar {
    box-sizing: border-box;
    background-color: #fff;
    border-radius: 6px;
  }
}

.ellipsis-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  max-width: 100%;
}
</style>
