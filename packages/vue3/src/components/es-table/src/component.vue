<template>
  <el-config-provider :locale="locale">
    <div :ref="setTableContainer" class="table_component" :style="{ [heightType]: tabHeight }" v-bind="rootPassthroughAttrs">
      <div class="table_containers">
        <div
          v-if="showHeaderBar"
          ref="headBarRef"
          class="btn-slot"
          :style="(slotStyles.value && slotStyles.type === 'object' && slotStyles.value) as any"
          :class="slotStyles.type === 'string' ? slotStyles.value : { slotClass: slotState && slotStyles.type !== 'object' }"
        >
          <div class="headerBar" v-if="hasDefaultSlot" :style="{ paddingBottom: hasDefaultSlot ? '10px' : '0px' }">
            <slot />
          </div>
        </div>
        <div v-loading="loadStatus" element-loading-background="rgba(0, 0, 0, 0.03)" element-loading-text="努力加载中..." class="page-loading-con tableContainer">
          <div class="table_inner_containers">
            <table-btns
              ref="tbBtnRef"
              :instance="{ tableRef: instance, formInstance: formInstance, getVxeGrid: getVxeGridInstance }"
              v-if="((tableOptions.configBtn && (tableOptions.configBtn as any[]).length) || tableOptions.leftText) && !(isVxeEngine && (tableOptions.toolbarConfig || (tableOptions as any).vxeConfig?.toolbarConfig))"
              :btn-config="(tableOptions.configBtn as any[])"
              :left-text="(tableOptions.leftText as string)"
            />
            <virtual-engine
              v-if="isVirtual"
              ref="virtualEngineRef"
              :columns="filteredColumns"
              :data-source="displayDataSource"
              :table-height="tableHeight"
              :options="tableOptions"
              :parent-slots="($slots as any)"
              @sort-change="changeTableSort"
              @selection-change="handleVirtualEngineSelectionChange"
              @row-click="handleVirtualRowClick"
              @row-dblclick="handleVirtualRowDblclick"
              @row-contextmenu="handleVirtualRowContextmenu"
            />
            <!-- vxe 高性能引擎：attrs 穿透管道将 <es-table @xxx> 事件转发到 vxe-grid -->
            <vxe-engine
              v-else-if="isVxeEngine"
              ref="vxeEngineRef"
              v-bind="vxePassthroughAttrs"
              :columns="filteredColumns"
              :data-source="displayDataSource"
              :table-height="tableHeight"
              :options="tableOptions"
              :parent-slots="($slots as any)"
              @sort-change="changeTableSort"
              @selection-change="handleVirtualSelectionChange"
              @cell-edit="(payload) => emit('cell-edit', payload)"
            />
            <el-table
              v-else
              class="el-dp_tables"
              :id="tableId"
              :key="tableId"
              ref="tableRef"
              style="width: 100%"
              v-bind="tableBindAttrs"
              :data="displayDataSource"
              @sort-change="changeTableSort"
              @selection-change="handleTableSelectionChange"
            >
              <template #empty>
                <div class="es-empty es-empty-normal">
                  <div class="es-empty-image">
                    <svg class="es-empty-img-simple" width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg">
                      <g transform="translate(0 1)" fill="none" fill-rule="evenodd">
                        <ellipse class="es-empty-img-simple-ellipse" cx="32" cy="33" rx="32" ry="7" />
                        <g class="es-empty-img-simple-g" fill-rule="nonzero">
                          <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
                          <path d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" class="es-empty-img-simple-path" />
                        </g>
                      </g>
                    </svg>
                  </div>
                  <div class="es-empty-description">{{ tableOptions.emptyText || '暂无数据' }}</div>
                </div>
              </template>
              <column-item v-for="(cols, index) in elTableColumns" :key="cols.prop || cols.key || cols.type || index" :cols="{ ...cols, columnIndex: index }">
                <template v-if="cols.scopedSlots && cols.scopedSlots.customRender" #[cols.scopedSlots.customRender]="{ scope }">
                  <slot v-bind="{ ...cols, columnIndex: index, row: scope.row, column: scope.column }" :name="cols.scopedSlots.customRender" :scope="scope" />
                </template>
              </column-item>
            </el-table>
          </div>
          <!-- isVxeProxyMode 时 vxe 内置 pager 已接管分页，禁止双分页 -->
          <div
            v-if="showPagination && !isVxeProxyMode"
            ref="paginationRef"
            class="pagination_page"
            :style="{
              position: heightType === 'height' ? 'absolute' : 'static',
              bottom: '0px',
              left: '0px',
              zIndex: 5,
              // 写死 #fff 会让深色站点上出现一条白色分页带（吸底时尤其显眼）。
              // --es-bg 是三端设计 token 里的「卡片/面板底色」（浅色 #fff，
              // 深色跟随主题）；接入方没定义时回落到原来的 #fff，行为不变。
              background: 'var(--es-bg, #fff)'
            }"
          >
            <el-pagination
              :background="paginationBackground"
              :size="paginationIsSmall ? 'small' : paginationConfig.size"
              :total="paginationConfig.total"
              v-model:page-size="paginationConfig.pageSize"
              :page-sizes="paginationPageSizes"
              v-model:current-page="paginationConfig.current"
              :layout="layout"
              style="padding: 0; margin: 10px 0; text-align: center"
              @size-change="handleSizeChange"
              @current-change="handleIndexChange"
            />
          </div>
        </div>
      </div>
    </div>
  </el-config-provider>
</template>

<script lang="ts">
import type { TableOptions } from '../../../types'

export default { name: 'EsTable', inheritAttrs: false }

const defaultOptions: TableOptions = {
  multiSelect: false,
  expand: false,
  snIndex: false,
  loading: false,
  border: false,
  size: 'small',
  headerCellStyle: { background: '#f5f7fa' },
  highlightCurrentRow: true,
  cachePageSelection: true
}
</script>

<script setup lang="ts">
// @ts-nocheck - 动态槽转发 #[cols.scopedSlots.customRender] 无法被 vue-tsc 类型推断（scope 与 :name 动态索引）；其余类型已修复，仅保留此一处的文件级豁免
import { ref, computed, watch, inject, getCurrentInstance, provide, toRaw, unref, h, onMounted, useAttrs, nextTick } from 'vue'
import { ElTable, ElConfigProvider, ElPagination, vLoading, ElButton, ElTag } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ColumnItem from './column-item.vue'
import TableBtns from './table-btns.vue'
import VirtualEngine from './engines/virtual-engine.vue'
import VxeEngine from './engines/vxe-engine.vue'
import { getGlobalConfig } from '../../../config'
import { useTableResize } from '../../../composables/use-table-resize'
import { useTableSelection } from '../../../composables/use-table-selection'
import { isObject, findValueByKey } from '../../../utils/shared'
import type { CellEditPayload, TableEngineExposed } from './engines/types'
import {
  getCallback,
  getNestedValue,
  TABLE_CONTEXT_INJECT_KEY,
  resolveKeepPage,
  resolveHttpRequest,
  resolveComponentConfig,
  resolveFieldOutputProvider,
  computeBoundaryRollback,
  buildRowSpanMethod,
  resolveMergeConfig,
  resolveTableCellDisplay,
  toCssSize,
  buildLeadingColumns,
  resolveSortParam,
  seedSortState,
  toTableSortState,
  sameSortState,
  buildSortParams,
} from '@es-plus/core'
import type { TableSortState, FieldOutputProvider } from '@es-plus/core'
import type { TableColumn, PaginationConfig, VxeExportConfig } from '../../../types'

const props = withDefaults(
  defineProps<{
    initTabHeight?: number
    headBarClass?: string | Record<string, unknown>
    showHeaderBar?: boolean
    dataSource?: Record<string, unknown>[]
    columns?: TableColumn[]
    options?: TableOptions
    pagination?: PaginationConfig
  }>(),
  {
    initTabHeight: 400,
    showHeaderBar: true,
    dataSource: () => [],
    columns: () => [],
    options: () => ({}),
    pagination: () => ({})
  }
)

const emit = defineEmits<{
  'update:dataSource': [data: Record<string, unknown>[]]
  'update:pagination': [pagination: PaginationConfig]
  'pagination-current-change': [pagination: PaginationConfig]
  'size-change': [pagination: PaginationConfig, size: number]
  'change-table-sort': [column: Record<string, unknown>]
  // 自动加载（onMounted / visibleShow 显隐）失败时派发，携带原始错误。
  // 命令式的 refresh/reload 返回 Promise 由调用方自行 catch，不经此事件。
  'request-error': [error: unknown]
  // 行内编辑提交（仅 vxe 引擎）：未改值不发。三端同形，见 core 的 CellEditPayload。
  'cell-edit': [payload: CellEditPayload]
}>()

const slots = defineSlots<{
  default?: () => any
}>()

const locale = ref(zhCn)
const injectedLocale = inject('elLocale', null)
if (injectedLocale) {
  locale.value = injectedLocale as any
}

const instance = getCurrentInstance() as any
// 注入值优先（app.use 路径下 Plugin 已经把 methods provide 成平键）；没有注入时回落到
// 模块单例，**必须经 resolveComponentConfig 展平 methods** —— configureEsPlus 写进单例的
// 是原样的 `{ methods: {...} }`，直接读会让 configQueryFieldOutput / paginationLayout
// 恒为 undefined（见 @es-plus/core 的同名函数注释）。
const $esPlusTable = inject<Record<string, unknown> | null>('$esPlusTable', null) ?? resolveComponentConfig(getGlobalConfig(), 'EsTable')
const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) ?? getGlobalConfig() ?? {}

/**
 * 实际生效的表格配置：`defaultOptions` 打底 → 全局 `EsTable.defaults` → 实例 `:options`。
 *
 * 为什么 prop 默认值改成 `{}`：原来 `options: () => ({ ...defaultOptions })` 让**每个键都被
 * 显式给出**，全局 `defaults` 永远被压掉（写了等于没写）。把内置默认值挪到这一层合并，
 * 「哪些是用户给的」才重新可辨：实例 > 全局 defaults > 内置默认。
 */
const tableOptions = computed<TableOptions>(() => ({
  ...defaultOptions,
  ...(($esPlusTable?.defaults as Record<string, unknown> | undefined) || {}),
  ...props.options
}) as TableOptions)

// configBtn 工具栏按钮通过此函数访问 vxe-grid 原生实例（惰性求值，避免在首次渲染时 template ref 为 null）
function getVxeGridInstance() {
  if (!isVxeEngine.value) return null
  return (vxeEngineRef.value as any)?.vxeInstance?.()
}

const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

// 虚拟滚动引擎切换
const isVirtual = computed(() =>
  tableOptions.value.virtual === true || tableOptions.value.engine === 'virtual'
)
const virtualEngineRef = ref<InstanceType<typeof VirtualEngine> | null>(null)

// vxe 高性能引擎切换
const isVxeEngine = computed(() => (tableOptions.value.engine as string | undefined) === 'vxe')
const vxeEngineRef = ref<InstanceType<typeof VxeEngine> | null>(null)
// 当 vxeConfig.proxyConfig 或一等公民 proxyConfig 存在时，由 vxe 接管请求层和分页，ES-Plus 原有机制退场
const isVxeProxyMode = computed(() => {
  const vxeExtraProxy = (tableOptions.value.vxeConfig as Record<string, unknown> | undefined)?.proxyConfig
  return isVxeEngine.value && !!(vxeExtraProxy || tableOptions.value.proxyConfig)
})
// Refs
const tableRef = ref<any>(null)
const tbBtnRef = ref<any>(null)
const headBarRef = ref<HTMLElement | null>(null)
const paginationRef = ref<HTMLElement | null>(null)
const tableContainerRef = ref<HTMLElement | null>(null)
const tableId = ref(`table_${Math.random().toString(36).substring(2, 12)}`)
const tableData = ref<Record<string, unknown>[]>([])
// 请求模式是否已拿到过响应：一旦为 true，tableData 就是渲染唯一真相 ——
// 否则请求返回空页（tableData=[]）会回落父级旧 dataSource，删空后仍显示上一页的行。
const hasRequested = ref(false)
const columnRowList = ref<TableColumn[]>([...props.columns])

watch(
  () => props.columns,
  (val) => {
    columnRowList.value = [...val]
  }
)

/**
 * 服务端排序（`tableOptions.sortParam`）：声明了才生效，求值全在 core 的 `table-sort`。
 *
 * 状态只需在这里存一份：请求参数由 `queryTableListMethod` 这个**唯一漏斗**合并，
 * 表头变化时把新状态写回再重取 —— 四个构造点（首屏 / 翻页 / 边界回退 / 表头）
 * 都不必各自拼排序参数。
 *
 * 初值来自 `defaultSort`：开了服务端排序时，它既是首屏的排序指示器，
 * 也是**首次请求**的排序参数（否则首屏数据与指示器不一致）。
 */
const serverSort = computed(() => resolveSortParam(tableOptions.value))
const sortState = ref<TableSortState | null>(seedSortState(tableOptions.value?.defaultSort))

const loadingStatus = ref(false)
// 请求序号（递增 ticket）：每次 queryTableListMethod 调用自增，只有最新序号的结果被采纳。
// 快速翻页时旧请求的响应/失败会被静默丢弃，不再覆盖新页数据、不再弹 request-error。
// 注意 computeBoundaryRollback 的递归调用会自增 ticket，从而正确“接管”外层请求，
// 不会因序号机制被误杀。
const requestTicket = ref(0)
const slotState = ref(false)
const showPagination = ref(false)

const setTableContainer = (el: HTMLElement | null) => {
  if (el) tableContainerRef.value = el
}

// 保留与 Form 的耦合
const bodyFormInstance = inject<(inst: unknown) => void>('bodyFormInstance', () => {})
const getVisibleShow = inject<(() => boolean) | boolean>('getVisibleShow', false)

const visibleShow = computed(() => (typeof getVisibleShow === 'function' ? getVisibleShow() : getVisibleShow))

const paginationConfig = ref<PaginationConfig>({
  pageSize: 10,
  current: 1,
  total: 0,
  pageSizes: [],
  size: 'small',
  isSmall: true,
  ...props.pagination
})

// 出站分页回传的值快照：emit 前先更新它，使父组件用 v-model:pagination 写回时，
// 入站 watcher 命中 str === lastPaginationStr 而 no-op，从值层面切断双向绑定回环。
// 初值用空串哨兵（JSON.stringify 永不产出 ''）：保证入站 watcher 的 immediate 首跑
// 必然放行（同步 showPagination 初值），而非被自身初值短路；首跑即写入真实快照。
let lastPaginationStr = ''
const emitPaginationUpdate = () => {
  const str = JSON.stringify(paginationConfig.value)
  if (str === lastPaginationStr) return
  lastPaginationStr = str
  emit('update:pagination', paginationConfig.value)
}

const formInstance = ref<unknown>(null)

// 计算属性
const getListEntry = computed(() => {
  if (tableOptions.value.entryQuery && isObject(tableOptions.value.entryQuery) && Object.keys(tableOptions.value.entryQuery).length) {
    return tableOptions.value.entryQuery
  }
  return {}
})

const configTableField = computed(() => {
  if (
    tableOptions.value.configTableOut &&
    isObject(tableOptions.value.configTableOut) &&
    Object.keys(tableOptions.value.configTableOut).length &&
    checkQueryFields(tableOptions.value.configTableOut)
  ) {
    return tableOptions.value.configTableOut
  }

  // 全局字段映射：字面量形态叠加在默认映射之上，函数形态按默认映射求值。
  // 此前只认函数，字面量被静默忽略（配了等于没配）。
  const fieldOutput = resolveFieldOutputProvider(
    $esPlusTable?.configQueryFieldOutput as FieldOutputProvider | undefined
  )
  if (fieldOutput) {
    const configFields = fieldOutput({
      total: 'records',
      pageSize: 'pageSize',
      current: 'pageNo',
      tableData: 'rows'
    })
    if (checkQueryFields(configFields)) return configFields
  }

  return {
    total: 'records',
    pageSize: 'pageSize',
    current: 'pageNo',
    tableData: 'rows'
  }
})

const isFormInstance = computed(() => {
  const defaultSlots = instance?.slots?.default?.() || []
  const formVNode = defaultSlots.find((vnode: any) => {
    const type = vnode.type
    return type?.name === 'EsForm' || type?.displayName === 'EsForm'
  })
  if (formVNode && formVNode.props?.ref) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    formInstance.value = formVNode.ctx?.refs[formVNode.props.ref as string]
    bodyFormInstance(formInstance.value)
  }
  return formVNode || {}
})

const hasDefaultSlot = computed(() => !!slots.default?.())
const heightType = computed(() => (tableOptions.value.heightType || 'auto') as 'auto' | 'height' | 'maxHeight')
const tabHeight = computed(() => {
  // `height` / `tabHeight` 的契约是 `number | string`（core types 与 MCP zod 同口径）。
  // 旧实现只认 number，字符串（`'420'` / `'420px'`）被静默忽略并回落 `100%` —— 声明与运行时漂移。
  const own = toCssSize(tableOptions.value.tabHeight)
  if (own !== undefined) return own
  if (heightType.value === 'height') return toCssSize(tableOptions.value.height) ?? '100%'
  return '100%'
})

const slotStyles = computed(() => {
  if (props.headBarClass) {
    return {
      type: typeof props.headBarClass === 'string' ? 'string' : 'object',
      value: props.headBarClass
    }
  }
  return { type: 'string', value: '' }
})

const paginationLayoutConfig = computed(() => {
  const cfg = $esPlusTable?.paginationLayout
  if (!cfg) return null
  return typeof cfg === 'function' ? cfg() : cfg
})
// 回落顺序与同级 pageSizes / isSmall / background 一致：全局 $esPlusTable.paginationLayout
// 优先，其次才是 pagination prop。此前只读全局那一路，于是 core 公开契约
// PaginationConfig.layout 在 `:pagination="{ layout }"` 这一路上被静默忽略 ——
// 同一个对象里的 pageSizes / isSmall 却生效。（vue2 同一处同样漏读，已一并修正。）
const layout = computed(
  () =>
    paginationLayoutConfig.value?.layout ||
    paginationConfig.value.layout ||
    'prev, pager, next, jumper, sizes, ->, total'
)
// 分页每页条数选项：始终包含当前生效的 pageSize，否则 el-pagination 的 size 选择器
// 会因「pageSize 不在 page-sizes 列表中」回退到 pageSizes[0]/10，导致播种的 pageSize
// 在分页器上显示与实际请求数不一致。
const paginationPageSizes = computed(() => {
  const configured = paginationLayoutConfig.value?.pageSizes || paginationConfig.value.pageSizes
  const size = Number(paginationConfig.value.pageSize) || 10
  const base = Array.isArray(configured) && configured.length ? configured.map((n: unknown) => Number(n)) : [10, 20, 30, 50, 100]
  return base.includes(size) ? base : [size, ...base].sort((a, b) => a - b)
})
const paginationIsSmall = computed(() => paginationLayoutConfig.value?.isSmall ?? paginationConfig.value.isSmall)
const paginationBackground = computed(() => paginationLayoutConfig.value?.background ?? true)
const loadStatus = computed(() => tableOptions.value.loading || loadingStatus.value)
const isRequestConf = computed(() => !!tableOptions.value.actionUrl || (tableOptions.value.apiParams && isObject(tableOptions.value.apiParams) && Object.keys(tableOptions.value.apiParams).length > 0) || isHttpRequest.value)
const isHttpRequest = computed(() => !!tableOptions.value?.httpRequest && typeof tableOptions.value.httpRequest === 'function')

// 内建客户端分页：全量 dataSource 由组件内部切片、自管 current/pageSize/total。
// 仅在非请求模式且非 vxe proxy 时生效。
const isLocalPagination = computed(
  () => tableOptions.value?.localPagination === true && !isRequestConf.value && !isVxeProxyMode.value
)
// 模板渲染用的数据源：本地分页时切当前页，否则优先内部请求数据、再回退 props.dataSource。
//
// 请求模式的结果落在内部 `tableData`，随后只会经 `update:dataSource` 回传 —— 父组件若
// 不绑 v-model（`:data-source` 一次性传值/干脆不传），那条回传就没人接，表格会拿到数据
// 却渲染空表。vue2（`effectiveDataSource`）与 antdv（`displayDataSource`）都以内部
// tableData 优先兜底，三端同规；仅当内部无数据时才透传 props.dataSource。
const displayDataSource = computed(() => {
  if (isLocalPagination.value) {
    const src = Array.isArray(props.dataSource) ? props.dataSource : []
    const size = Number(paginationConfig.value.pageSize) || 10
    const cur = Number(paginationConfig.value.current) || 1
    const start = (cur - 1) * size
    return src.slice(start, start + size)
  }
  return tableData.value.length || hasRequested.value ? tableData.value : props.dataSource
})
// 依据全量 dataSource 回填 total/showPagination + 边界回收（当前页超范围则回退）。
const syncLocalPagination = () => {
  if (!isLocalPagination.value) return
  const total = Array.isArray(props.dataSource) ? props.dataSource.length : 0
  const size = Number(paginationConfig.value.pageSize) || 10
  const maxPage = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Number(paginationConfig.value.current) || 1, maxPage)
  paginationConfig.value.total = total
  paginationConfig.value.current = current
  showPagination.value = true
  emitPaginationUpdate()
}

// 列上是否已有**用户显式**的单元格渲染（它们优先于声明式 dataOptions）。
const hasCustomCell = (col: TableColumn): boolean =>
  typeof col.render === 'function' ||
  typeof col.formatter === 'function' ||
  !!col.scopedSlots?.customRender

/**
 * 声明式 `dataOptions` → 单元格 render（含分组子列递归）。
 *
 * 为什么在这里就落成 `render`：es-table 的四条列产出路径（默认 el-table、vxe、虚拟引擎、
 * 分组子列）都只认列上的 render/formatter/slot 三件套，没有各自去读数据的通道。
 * 在 `filteredColumns` 这一处统一注入，等于让所有引擎天然支持它，且不必改四份适配器。
 *
 * 解析（取值 / 空值兜底 / 码值匹配）全部在 core 的 `resolveTableCellDisplay`，本函数
 * 只负责把结果包成本端的 Tag —— 这样 vue3 / vue2 / antdv 的差异只剩「用哪个标签组件」。
 */
const withDataOptions = (col: TableColumn): TableColumn => {
  if (Array.isArray(col.groups) && col.groups.length) {
    // 分组表头：子列各自消费自己的 dataOptions（浅拷贝共享 groups 数组，必须重建）
    return { ...col, groups: col.groups.map(withDataOptions) }
  }
  if (!Array.isArray(col.dataOptions) || !col.dataOptions.length || hasCustomCell(col)) return col
  return {
    ...col,
    render: (h: any, { row }: { row: Record<string, unknown> }) => {
      const { text, tagType } = resolveTableCellDisplay(col, row)
      if (!tagType) return text
      return h(ElTag, { type: tagType, disableTransitions: true }, () => text)
    }
  }
}

const filteredColumns = computed(() => {
  // 浅拷贝：避免 computed 副作用（设置 formatter/render）污染原始列对象，防止跨引擎串扰
  // 列级 permissionValue 与 hidCol 同层过滤：无权限的列直接不渲染（未配全局 permission 时放行）。
  const list = columnRowList.value
    .filter((item) => !item.hidCol && checkPermission(item.permissionValue))
    .map((item) => withDataOptions({ ...item }))
  list.forEach((el) => {
    // 已有自定义单元格（dataOptions 注入的 render / 用户 render / 插槽）时不注入 formatter：
    // 三端引擎都按 render > slot > formatter 取用，注入的 formatter 永远轮不到，只会误导排错。
    if (
      el.prop !== 'operate' &&
      el.key !== 'operate' &&
      (el.prop || el.key) &&
      !hasCustomCell(el)
    ) {
      el.formatter = (row: Record<string, unknown>) => {
        // 用 ?? 避免把 0/false 等假值塌缩成 '-'；用 getNestedValue 支持嵌套 prop（a.b.c）
        const value = getNestedValue(row, el.prop as string) ?? getNestedValue(row, el.key as string)
        if (value == null || value === '') {
          return (el.emptyPlaceholder as string) || '-'
        }
        return value as string
      }
    }

    if ((el.prop === 'operate' || el.key === 'operate') && el.btns && !el.render) {
      el.render = (_h: any, { row }: { row: Record<string, unknown> }) => {
        return h('div', [
          el.btns
            ?.filter((btn: any) => {
              if (!checkPermission(btn.permissionValue)) return false
              if (typeof btn.hidden === 'function') return !btn.hidden(row)
              return !btn.hidden
            })
            .map((btn: any) =>
            h(ElButton, {
              onClick: () => btn.clickEvent?.(row),
              text: true,
              type: btn.type || 'primary'
            }, () => btn.name)
          )
        ])
      }
    }
  })

  // 当所有列都设置了固定 width 且没有 minWidth 时，将最后一个非固定列的 width 转为 minWidth 以填充剩余空间
  const allFixedWidth = list.length > 0 && list.every((col) => col.width && !col.minWidth)
  if (allFixedWidth) {
    let flexIdx = -1
    for (let i = list.length - 1; i >= 0; i--) {
      const col = list[i]
      if (!col.fixed && col.prop !== 'operate' && col.key !== 'operate') {
        flexIdx = i
        break
      }
    }
    if (flexIdx === -1) flexIdx = list.length - 1
    if (flexIdx >= 0) {
      const col = list[flexIdx]
      col.minWidth = col.width
      delete col.width
    }
  }

  // AN-09：前置非数据列（选择 → 序号 → 展开）由 core 单源合成，顺序/宽度与 vxe / 虚拟引擎一致。
  // 已显式声明同类型列（含 hidCol 隐藏列）时不重复注入；合成列没有 prop/key，
  // 因此不参与上面的 formatter 注入，也不参与 width→minWidth 转换（放在最后一步）。
  const leadingColumns = buildLeadingColumns(tableOptions.value, columnRowList.value) as unknown as TableColumn[]
  return [...leadingColumns, ...list]
})

// es-table 内部选项键，不应传递给 el-table
/**
 * el-table 分支使用的列。
 *
 * 开了服务端排序时把 sortable 改成 el-table 的 'custom'：表头照常可点、照常抛 sort-change，
 * 但**不在本地排**当前页（排序由后端给，翻页后顺序才稳定）。未声明时原样返回，行为不变。
 * vxe 分支不走这里（它用 sortConfig.remote 表达同一件事）。
 */
const elTableColumns = computed(() => {
  if (!serverSort.value) return filteredColumns.value
  return filteredColumns.value.map((col) =>
    col.sortable ? ({ ...col, sortable: 'custom' } as unknown as TableColumn) : col,
  )
})

const TABLE_INTERNAL_KEYS = new Set([
  'multiSelect', 'expand', 'snIndex', 'loading', 'cachePageSelection',
  'httpRequest', 'configTableOut', 'listenToCallBack',
  'apiParams', 'actionUrl', 'heightType', 'tabHeight',
  'isInitRun', 'entryQuery', 'configBtn', 'leftText', 'rowkey',
  'virtual', 'engine', 'rowHeight', 'estimatedRowHeight', 'overscanCount', 'rowClassName',
  // vxe 引擎专有字段，不传给 el-table
  'vxeConfig', 'vxeOn',
  'showFooter', 'footerMethod', 'footerData',
  'editConfig', 'exportConfig', 'toolbarConfig', 'columnConfig',
  'keyboardConfig', 'mouseConfig', 'validConfig',
  'treeConfig', 'proxyConfig', 'expandConfig', 'seqConfig',
  // AI-23：声明式合并单元格由组件侧翻译成 el-table 的 spanMethod，不是 el-table 的 prop。
  'mergeConfig',
  // 服务端排序声明：由请求层消费，el-table 没有这个 prop。
  'sortParam',
])

const tableAttrs = computed(() => {
  const merged = columnBindAttr({ ...defaultOptions, ...tableOptions.value })
  const { align, ...rest } = merged
  const result: Record<string, unknown> = {}
  for (const key in rest) {
    if (!TABLE_INTERNAL_KEYS.has(key)) {
      result[key] = rest[key]
    }
  }
  return result
})

// 合并 options attrs 和父级 fallthrough attrs，供 el-table 使用
const fallthroughAttrs = useAttrs()

/**
 * 虚拟滚动引擎的行事件转发（AN-11⑥）。
 *
 * el-table / vxe 两条路径都靠 attrs 透传把父级的 `onRowClick` 等送到引擎
 * （`tableBindAttrs` / `vxePassthroughAttrs`），唯独 virtual 分支是显式绑定、一个 on*
 * 都没接 —— 于是 `<es-table @row-click>` 在 virtual 引擎下被静默吞掉。这里补上同一条边。
 *
 * 行双击 / 右键同理：virtual-engine 会 emit `row-dblclick` / `row-contextmenu`，
 * 组件不接就等于这两个能力只存在于引擎里、对外不可见。
 */
const forwardVirtualRowEvent = (attr: string) => {
  const handler = fallthroughAttrs[attr] as
    | ((row: Record<string, unknown>, event: Event) => void)
    | undefined
  return (row: Record<string, unknown>, event: Event) => handler?.(row, event)
}

const handleVirtualRowClick = forwardVirtualRowEvent('onRowClick')
const handleVirtualRowDblclick = forwardVirtualRowEvent('onRowDblclick')
const handleVirtualRowContextmenu = forwardVirtualRowEvent('onRowContextmenu')

// 非事件 attrs 透传给根 div（保留 class/style/data-* 等）
const rootPassthroughAttrs = computed(() => {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fallthroughAttrs)) {
    if (!k.startsWith('on')) result[k] = v
  }
  return result
})
// vxe 事件 attrs 穿透管道：过滤掉 component.vue 已处理的 5 个标准事件
const VXE_SKIP_EVENTS = new Set([
  'onUpdate:dataSource', 'onUpdate:pagination',
  'onPaginationCurrentChange', 'onSizeChange', 'onChangeTableSort',
])
const vxePassthroughAttrs = computed(() => {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fallthroughAttrs)) {
    if (k.startsWith('on') && !VXE_SKIP_EVENTS.has(k)) result[k] = v
  }
  return result
})

const tableBindAttrs = computed(() => {
  // class/style 已由根 div 通过 rootPassthroughAttrs 接收，不再传给 el-table 避免双重绑定
  const filteredFallthrough: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fallthroughAttrs)) {
    if (k !== 'class' && k !== 'style') filteredFallthrough[k] = v
  }
  const result: Record<string, unknown> = { ...tableAttrs.value, ...filteredFallthrough }
  if (tableOptions.value.rowkey) {
    result.rowKey = tableOptions.value.rowkey
  }
  // 默认排序（AN-10）：options.defaultSort → el-table 的 `default-sort`（camelCase 绑定同义）。
  // 显式映射而不是靠 TABLE_INTERNAL_KEYS 之外的键「碰巧流过去」：①三端契约要可断言；
  // ②el-table 只有在**目标列 sortable** 时才展示默认排序状态 —— 派生列的 sortable 由生成器
  // 补（见 shared/structured-generator 的 AN-10 分支），这里只负责把值送到。
  if (tableOptions.value.defaultSort) {
    result.defaultSort = tableOptions.value.defaultSort
  }
  // 树表（AI-09 子项③）：运行时家 options.treeConfig → el-table 原生 prop。
  // el-table 渲染树靠「row-key + 行数据里的嵌套子数组」，tree-props 只用于自定义子键名，
  // 故 childrenField 缺省 'children' 时不发（避免无谓的 prop）。expandAll → default-expand-all。
  const treeCfg = tableOptions.value.treeConfig
  if (treeCfg) {
    if (treeCfg.childrenField && treeCfg.childrenField !== 'children') {
      result.treeProps = { children: treeCfg.childrenField }
    }
    if (treeCfg.expandAll) {
      result.defaultExpandAll = true
    }
  }
  if (heightType.value === 'height') {
    result.height = tableHeight.value
  } else if (heightType.value === 'maxHeight') {
    result.maxHeight = tableHeight.value
  }
  // 合并单元格（AI-23）：声明式 mergeConfig → el-table 的 spanMethod。
  // 显式 spanMethod 是 Tier-3 逃生舱、优先级更高（两者并存时告警，不静默覆盖）。
  const mergeCfg = resolveMergeConfig(tableOptions.value)
  if (mergeCfg) {
    if (typeof result.spanMethod === 'function') {
      console.warn('[es-plus] 同时设置了 tableOptions.spanMethod 与 mergeConfig —— 显式 spanMethod 生效，mergeConfig 被忽略。')
    } else {
      result.spanMethod = buildRowSpanMethod(mergeCfg.rowsBy, displayDataSource.value as Record<string, unknown>[])
    }
  }
  return result
})

// 使用原生 ResizeObserver
// heightType / tabHeight 以 computed 传入，运行期修改 options 时能即时生效（此前是原始值快照）。
const resizeTabHeight = computed(() =>
  tableOptions.value.tabHeight ?? (heightType.value === 'height' ? tableOptions.value.height : undefined)
)
const { tableHeight, resizeObservers } = useTableResize(
  tableContainerRef,
  headBarRef,
  tbBtnRef,
  paginationRef,
  {
    heightType,
    tabHeight: resizeTabHeight,
  }
)

/**
 * 统一的"延迟重算高度"：等 DOM（分页器 / 工具栏 / EsForm）布局完成后再重算。
 *
 * 关键场景：httpRequest 异步表格在 onMounted 阶段还没拿到数据，showPagination 仍为 false、
 * 分页器尚未渲染（offsetHeight=0）。此时算出的 tableHeight 少扣了分页器高度 → el-table 偏高，
 * 撞穿 .tableContainer 的 overflow:hidden，把最后一行裁掉；只有等窗口 resize 命中容器 observer
 * 才纠正。数据到达、分页器出现后主动重算即可根除。
 */
const scheduleResize = () => {
  const ht = heightType.value
  if (ht !== 'height' && ht !== 'maxHeight') return
  nextTick(() => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resizeObservers())
    } else {
      resizeObservers()
    }
  })
}

// 分页器由隐藏→显示（异步数据到达点亮 showPagination，或客户端分页播种）会改变可用高度，
// 此刻必须重算，否则表格保持"分页器未计入"时的偏大高度而裁掉末行。
watch(showPagination, () => scheduleResize())

watch(
  visibleShow,
  async (val, oldVal) => {
    if (val && val !== oldVal) {
      if (tableOptions.value.actionUrl && !isVxeProxyMode.value) {
        // 失败已由 httpRequestInstance 内部 surfaceRequestError 暴露，这里仅吞掉 rejection
        await httpRequestInstance().catch(() => {})
      }
      tableRef.value?.doLayout?.()
      vxeEngineRef.value?.doLayout()
    }
  }
)

watch(
  () => props.pagination,
  (val) => {
    // 值比较守卫：与上次出站快照一致（多为自身 emit 经 v-model 写回）时直接 no-op，避免空转一轮
    const str = JSON.stringify(val || {})
    if (str === lastPaginationStr) return
    lastPaginationStr = str
    paginationConfig.value = { ...paginationConfig.value, ...val }
    showPagination.value = val.total !== undefined
  },
  { deep: true, immediate: true }
)

// 内建客户端分页：初始播种 total/showPagination，并在 dataSource 长度变化时
// 自动回填 total 与边界回收。当前页切片由 displayDataSource 派生。
syncLocalPagination()
watch(
  () => (Array.isArray(props.dataSource) ? props.dataSource.length : 0),
  () => syncLocalPagination()
)

// 跨页选择记忆：必须监听**渲染中的真实数据**（displayDataSource），不能监听 props.dataSource。
//
// 内建分页（options.localPagination）时 dataSource 是全量、翻页只改内部切片，props 引用不动
// —— 监听 props 就永远不会回显：翻回第 1 页时 el-table 的 setData 会先 clearSelection() 并
// emit selection-change([])，把第 1 页的缓存覆盖成空，且没有任何 restore 把它勾回来
// （实测：第 1 页选 id 1、第 2 页选 id 5，翻回第 1 页后 getSelectionRows() 只剩 [5]）。
// 请求模式同理：数据落在内部 tableData，父组件不绑 v-model 时 props 也不变。
// vue2 早已监听 effectiveDataSource（同一条修复），三端现在同规。
// vxe / virtual 自管选择状态（reserve / key 集合），不参与这条回显路径。
watch(
  displayDataSource,
  (val) => {
    if (isVxeEngine.value || isVirtual.value) return
    initSelection(Array.isArray(val) ? val as Record<string, unknown>[] : [], tableRef.value)
  },
  { deep: true }
)

watch(
  tableData,
  (val) => {
    if (Array.isArray(val)) {
      emit('update:dataSource', val)
    }
  },
  { deep: true }
)

// 配置化接口请求时，挂载自动加载数据（vxeProxyMode 下由 vxe proxyConfig 接管）
//
// 统一请求失败处理：httpRequestInstance 的所有失败路径都会调用 surfaceRequestError，
// 因此自动加载与命令式触发（查询/重置/刷新）的失败都会被一致地暴露：
//   - requestError：暴露给模板/命令式消费方与测试读取
//   - emit('request-error')：供上层 UI（如 EsCrudPage）呈现失败态
// httpRequestInstance 返回的 Promise 仍会 reject，程序化调用方可另行 catch。
const requestError = ref<unknown>(null)
const surfaceRequestError = (err: unknown) => {
  requestError.value = err
  emit('request-error', err)
}
onMounted(() => {
  if (isRequestConf.value && tableOptions.value.isInitRun !== false && !isVxeProxyMode.value) {
    // 失败已由 httpRequestInstance 内部 surfaceRequestError 暴露，这里仅吞掉 rejection
    httpRequestInstance().catch(() => {})
  }
})

// 表格选择逻辑
const { multipleSelection, handleSelectionChange, initSelection, clearAllSelection } = useTableSelection(tableOptions.value.rowkey, tableOptions.value.cachePageSelection)

const handleTableSelectionChange = (val: Record<string, unknown>[]) => {
  handleSelectionChange(val, paginationConfig.value.current || 1)
}

const handleVirtualSelectionChange = (rows: Record<string, unknown>[]) => {
  handleSelectionChange(rows, paginationConfig.value.current || 1)
}

/**
 * virtual 引擎的选择变化。
 *
 * 与 vxe 分支不同：vxe 走 `vxePassthroughAttrs` 把 `<es-table @xxx>` 原样转发给 vxe-grid，
 * 而 virtual 分支是显式绑定、一个 on* 都没接（同 handleVirtualRowClick 处的原因）——
 * 若不在这里补一条边，`@selection-change` 在 virtual 模式下会被静默吞掉。
 */
const handleVirtualEngineSelectionChange = (rows: Record<string, unknown>[]) => {
  handleVirtualSelectionChange(rows)
  const handler = fallthroughAttrs.onSelectionChange as
    | ((rows: Record<string, unknown>[]) => void)
    | undefined
  handler?.(rows)
}

// 请求逻辑
const checkQueryFields = (obj: Record<string, unknown>): boolean => {
  const checkListKey = ['total', 'pageSize', 'current', 'tableData']
  if (isObject(obj)) {
    return Object.keys(obj).every((it) => {
      return checkListKey.find((its) => its === it) && obj[it] && typeof obj[it] === 'string'
    })
  }
  return false
}

const getListenToCallBack = (eventName: string, params: unknown) => {
  const cb = tableOptions.value.listenToCallBack
  if (!cb) return undefined
  const fn = getCallback(cb as any, eventName)
  if (typeof fn === 'function') {
    return fn(params)
  }
  return undefined
}

const formatConfigOut = (row: Record<string, unknown> | unknown[], keyList: string[]) => {
  // 裸数组响应：直接作为表格数据（total = 长度）。此前数组响应会得到空表。
  if (Array.isArray(row)) {
    if (keyList.includes('tableData')) {
      tableData.value = row as Record<string, unknown>[]
      hasRequested.value = true
      if (keyList.includes('total')) {
        paginationConfig.value.total = row.length
        showPagination.value = true
      }
    }
    return
  }
  if (isObject(configTableField.value) && Object.keys(configTableField.value).length) {
    Object.entries(configTableField.value).forEach(([key, value]) => {
      const isKeyUsed = keyList.includes(key)
      if (!isKeyUsed) return

      const rowData = row[value as string] ?? findValueByKey(row, value as string)
      if (key === 'tableData') {
        tableData.value = Array.isArray(rowData) ? rowData : []
        hasRequested.value = true
      } else {
        ;(paginationConfig.value as any)[key] = typeof rowData === 'number' ? rowData : parseInt(rowData as string, 10) || 0
        // 服务端返回了 configTableOut 映射的 total 字段，即表示该表启用了服务端分页，
        // 自动点亮分页器——否则未显式传 :pagination 的 httpRequest 表格分页器恒不显示
        // （对齐 vue2/antdv）。仅置 true，永不隐藏，不影响既有行为。
        if (key === 'total') {
          showPagination.value = true
        }
      }
    })
  }
}

type QueryTableListCallbacks = {
  // isCurrent=false 表示本次请求已被更新的请求淘汰（序号过期）：调用方应静默丢弃结果，
  // 但仍需让回调把外层 Promise settle，避免调用方 await 永久挂起。
  success?: (res: Record<string, unknown>, isCurrent: boolean) => void
  fail?: (err: unknown, isCurrent: boolean) => void
}

const queryTableListMethod = (params: Record<string, unknown>, options: QueryTableListCallbacks = {}) => {
  const { success, fail } = options
  // 服务端排序（`tableOptions.sortParam`）：请求漏斗这一处合并排序参数，
  // 于是首屏 / 翻页 / 边界回退 / 表头重取四个构造点行为必然一致（core 保证三端同规）。
  // 未声明时 `buildSortParams` 返回 {}，与历史行为逐字节相同。
  const requestParams = { ...params, ...buildSortParams(tableOptions.value, sortState.value) }
  // 抢占序号：同步自增，保证并发调用按发起顺序确定“最新”。
  const ticket = ++requestTicket.value
  const apiParams = (tableOptions.value?.apiParams || {}) as Record<string, any>
  const url = tableOptions.value?.actionUrl || apiParams.url || ''

  // 无 url/apiParams 但配置了直接 httpRequest 时仍可发请求（由调用方自处理 url）。
  // 否则调用 fail 让外层 Promise settle，避免 refresh() 永久挂起。
  if ((!url || !Object.keys(apiParams).length) && !tableOptions.value.httpRequest) {
    // 同步配置错误不是“被淘汰请求”，必须按当前请求暴露（isCurrent=true）。
    // 本调用已抢占最新序号：此前若有在途请求，其 finally 会因序号过期而跳过收起 loading，这里补收。
    if (ticket === requestTicket.value) loadingStatus.value = false
    if (typeof fail === 'function') fail(new Error('no url/apiParams configured'), true)
    return
  }

  const formData = Object.keys(isFormInstance.value).length
    ? toRaw(unref((isFormInstance.value as any).props.model))
    : getListEntry.value || {}


  const fnParams = getListenToCallBack('beforeRequest', { ...formData, ...requestParams, ...toRaw(unref(apiParams.model || {})) })
  const finalParams = isObject(fnParams) ? fnParams : { ...formData, ...toRaw(unref(apiParams.model || {})), ...requestParams }
  const requestOption = { ...toRaw(unref(apiParams.options || {})) }
  if (apiParams?.method) {
    requestOption.method = apiParams?.method
  }

  const requestHandler = async (requestFn: Function) => {
    // 不再用 loadingStatus 当互斥锁：并发请求各自持有序号，由序号决定谁的结果生效。
    loadingStatus.value = true
    let isCurrent = false
    try {
      const res = await requestFn({
        url,
        formParams: finalParams,
        headers: apiParams.headers || {},
        ...requestOption,
        ...requestParams
      })
      isCurrent = ticket === requestTicket.value
      const responseData = getListenToCallBack('afterResponse', res) || res
      // 空 / 非对象响应（204、拦截器 return undefined、原始值）以及数组响应也要调用 success ——
      // httpRequestInstance 的 Promise 只在 success/fail 中 settle，否则表格加载永久挂起。
      // 非对象 / 空响应归一为 {}：本地 formatConfigOut 得到空结果（清空行、total 归 0），
      // 这是有意的取舍（不再挂起，代价是 204 会被当作空列表）。数组响应同样会 settle，
      // 但表格本地映射没有数组直传分支，会渲染为空表。
      if (typeof success === 'function') {
        const normalized = responseData && (isObject(responseData) || Array.isArray(responseData))
          ? responseData
          : {}
        success(normalized as Record<string, unknown>, isCurrent)
      }
    } catch (e) {
      isCurrent = ticket === requestTicket.value
      if (typeof fail === 'function') {
        fail(e, isCurrent)
      }
    } finally {
      // 只有最新请求才负责收起 loading；被淘汰请求不得清掉仍在途的最新请求的加载态。
      if (ticket === requestTicket.value) loadingStatus.value = false
    }
  }

  if (tableOptions.value.httpRequest) {
    requestHandler(tableOptions.value.httpRequest)
  } else {
    // 回落顺序：注入的 $esPlusTable.$httpRequest（更具体）→ core 的全局解析。
    // 后者必须走 resolveHttpRequest：它同时认顶层 `httpRequest`（core 权威字段，
    // 也是文档推荐写法）与 `EsTable.methods.$httpRequest`。此前这里只看注入值，
    // 于是「只配 app.use(EsPlus, { httpRequest })」的应用里，独立 es-table 直接报
    // "no httpRequest configured" —— 而同一个配置下 EsForm 的远端下拉与自由的
    // httpRequest() 都能用（与 docs/config.ts 的承诺三端不一致）。
    const resolved =
      ($esPlusTable.httpRequest as Function | undefined) ||
      ($esPlusTable.$httpRequest as Function | undefined) ||
      (resolveHttpRequest(getGlobalConfig()) as Function | null) ||
      undefined
    if (resolved) {
      requestHandler(resolved)
    } else {
      // 无任何请求函数 → fail 让 Promise settle，避免挂起（isCurrent=true，非淘汰请求）
      if (ticket === requestTicket.value) loadingStatus.value = false
      if (typeof fail === 'function') fail(new Error('no httpRequest configured'), true)
    }
  }
}

const httpRequestInstance = (model?: Record<string, unknown>, reqOptions?: { keepPage?: boolean }) => {
  // 是否保留当前页码：本次调用显式传入的 keepPage 优先，其次回退到表级
  // refetchKeepPage（默认 false，向后兼容）。查询/重置按钮会显式传 keepPage:false，
  // 使「查询」始终回到第 1 页（搜索语义），不受 refetchKeepPage 影响。
  const keepPage = resolveKeepPage(reqOptions?.keepPage, tableOptions.value?.refetchKeepPage)
  // vxe proxy mode：vxe 的 proxyConfig 接管请求层，ES-Plus 直接委托给 vxe 的内置查询触发器
  if (isVxeProxyMode.value) {
    // 'reload' 会回到第 1 页（搜索语义），'query' 保留当前页
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
        success: (res, isCurrent) => {
          // 被更新的请求淘汰：静默丢弃结果并 settle，不写数据、不清错、不回滚页码。
          if (!isCurrent) {
            resolve(undefined)
            return
          }
          // 加载成功：清除上一轮自动加载的错误态（若有）
          requestError.value = null
          formatConfigOut(res, ['total', 'tableData'])
          emitPaginationUpdate()
          // 分页边界回退：保留页模式下，若拉取后当前页已无数据且非首页
          //（如删除了本页最后一条），回退到最后一个有效页并再次拉取。
          const { shouldRollback, maxPage } = computeBoundaryRollback({
            keepPage,
            rowCount: tableData.value?.length ?? 0,
            current: paginationConfig.value.current,
            total: paginationConfig.value.total,
            pageSize: paginationConfig.value.pageSize,
          })
          if (shouldRollback) {
            // 仅在页码确实需要回退时递归一次，避免死循环。
            // 递归调用会自增 requestTicket，自动接管“最新请求”身份：
            // 外层请求的 finally 因序号过期不会复位 loadingStatus，由递归请求负责收起。
            paginationConfig.value.current = maxPage
            queryTableListMethod(
              { ...(model || {}), pageIndex: maxPage, pageSize: paginationConfig.value.pageSize },
              {
                success: (res2, isCurrent2) => {
                  if (!isCurrent2) {
                    resolve(undefined)
                    return
                  }
                  formatConfigOut(res2, ['total', 'tableData'])
                  emitPaginationUpdate()
                  emit('pagination-current-change', paginationConfig.value)
                  resolve(res2)
                },
                fail: (err, isCurrent2) => {
                  if (!isCurrent2) {
                    resolve(undefined)
                    return
                  }
                  surfaceRequestError(err)
                  reject(err)
                }
              }
            )
            return
          }
          resolve(res)
        },
        fail: (err, isCurrent) => {
          // 被淘汰请求的失败静默丢弃，但必须 settle，避免 refresh() 等待的 Promise 悬空。
          if (!isCurrent) {
            resolve(undefined)
            return
          }
          surfaceRequestError(err)
          reject(err)
        }
      }
    )
  })
}

const changePageIndexRequest = () => {
  queryTableListMethod(
    { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
    {
      success: (res, isCurrent) => {
        // 页码已被后续翻页更新时丢弃本次旧页响应，否则数据会回跳到旧页。
        if (!isCurrent) return
        formatConfigOut(res, ['total', 'tableData'])
        emitPaginationUpdate()
        emit('pagination-current-change', paginationConfig.value)
      },
      // 翻页失败同样经统一暴露：写 requestError + emit('request-error')，
      // 否则加载态消失、数据留旧值而用户无任何失败反馈（对齐 F2）。
      // 被淘汰请求的失败不暴露（避免快速翻页时误报 request-error）。
      fail: (err, isCurrent) => {
        if (isCurrent) surfaceRequestError(err)
      }
    }
  )
}

const changePageSizeRequest = () => {
  queryTableListMethod(
    { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
    {
      success: (res, isCurrent) => {
        if (!isCurrent) return
        formatConfigOut(res, ['total', 'tableData'])
        emitPaginationUpdate()
      },
      fail: (err, isCurrent) => {
        if (isCurrent) surfaceRequestError(err)
      }
    }
  )
}

const handleSizeChange = (size: number) => {
  paginationConfig.value.pageSize = size
  paginationConfig.value.current = 1
  if (isRequestConf.value) {
    changePageSizeRequest()
  } else {
    emitPaginationUpdate()
    emit('size-change', paginationConfig.value, size)
  }
}

const handleIndexChange = (val: number) => {
  paginationConfig.value.current = val
  if (isRequestConf.value) {
    changePageIndexRequest()
  } else {
    emitPaginationUpdate()
    emit('pagination-current-change', paginationConfig.value)
  }
}

/**
 * 表头排序变化。
 *
 * 服务端排序（tableOptions.sortParam）声明后：写入排序状态 → **保留当前页**重取。
 * 只有状态**真的变了**才重取 —— el-table / a-table / vxe 在挂载时都会为 defaultSort
 * 回抛一次 sort-change，那一次与初值等价，不能变成第二次请求。
 */
const changeTableSort = (payload: Record<string, unknown>) => {
  const next = toTableSortState(payload as { prop?: unknown; order?: unknown; column?: unknown })
  if (serverSort.value && next) {
    const changed = !sameSortState(sortState.value, next)
    sortState.value = next
    if (changed) {
      // 排序是「同一批数据的另一种顺序」，不把用户踢回第 1 页（与 a-table 的 change 语义一致）
      httpRequestInstance(undefined, { keepPage: true }).catch(() => {})
    }
  }
  emit('change-table-sort', payload)
}

const firstWordUpperCase = (str: string): string => {
  return str.toLowerCase().replace(/(\s|^)[a-z]/g, (char) => char.toUpperCase())
}

const columnBindAttr = (cols: Record<string, unknown>) => {
  const options: Record<string, unknown> = {}
  for (const t in cols) {
    if (t === 'groups' || t === 'scopedSlots' || t === 'render') continue

    if (t.includes('-')) {
      const parts = t.split('-')
      let newkey = parts[0]
      for (let j = 1; j < parts.length; j++) {
        newkey += firstWordUpperCase(parts[j])
      }
      options[newkey] = cols[t]
    } else if (t === 'key') {
      options.prop = cols[t]
      options[t] = cols[t]
    } else {
      options[t] = cols[t]
    }
  }

  if (!options.align) {
    options.align = 'center'
  }

  return options
}

// 活跃引擎统一代理（isVirtual / isVxeEngine / 默认 el-table 三路）
const activeEngineRef = computed((): TableEngineExposed | null =>
  isVirtual.value ? (virtualEngineRef.value as unknown as TableEngineExposed)
  : isVxeEngine.value ? (vxeEngineRef.value as unknown as TableEngineExposed)
  : null
)

// 提供表格实例给子组件（保留与 Form 的耦合）
// 注：EsForm 消费侧仅调用 httpRequestInstance()，tableRef/refsInstance 未被任何组件读取，
// vxe 模式下 tableRef 指向 vxeEngineRef（TableEngineExposed）是安全的。
provide(TABLE_CONTEXT_INJECT_KEY, () => ({
  ...(instance?.setupState || {}),
  tableRef: isVirtual.value ? virtualEngineRef : isVxeEngine.value ? vxeEngineRef : tableRef,
  toggleSelection: (rows: Record<string, unknown>[]) => {
    if (activeEngineRef.value) {
      if (rows) rows.forEach(row => activeEngineRef.value?.toggleRowSelection(row, true))
      else activeEngineRef.value?.clearSelection()
    } else {
      if (rows) rows.forEach(row => tableRef.value?.toggleRowSelection(row))
      else tableRef.value?.clearSelection()
    }
  },
  clearAllSelection: () => {
    clearAllSelection(isVxeEngine.value || isVirtual.value ? null : tableRef.value)
    activeEngineRef.value?.clearSelection()
  },
  refsInstance: () => activeEngineRef.value
    ? activeEngineRef.value?.getTableRef()
    : tableRef.value,
  httpRequestInstance,
}))

// 暴露方法
// 纯重排列宽/布局（不重新取数），供方法族与逃生舱复用。
const doLayoutFn = () =>
  activeEngineRef.value ? activeEngineRef.value?.doLayout() : tableRef.value?.doLayout?.()

// 清除选择：**四引擎同义 = 清空全部**（含跨页缓存）。
//
// 为什么不保留「只清当前页」：el-table 的 `clearSelection()` 只清当前页的勾选，
// 但跨页缓存（selectionsByPage / multipleSelection）里其它页的行还在 —— 用户点
// 「清空」后翻回上一页，`restoreSelectionForPage` 会把它们**重新勾上**，表现为
// 「清空没生效」。vxe / virtual 的引擎级清空能整表清掉（vxe 要
// `clearCheckboxRow` + `clearCheckboxReserve` 两步，见引擎注释），所以「只清当前页」
// 在三个引擎下本来就不一致；统一成「清空全部」既消除了幽灵选中，又只有一种语义要记。
// `clearAllSelection` 保留为同义别名（旧代码在用）。
function clearSelectionAll() {
  clearAllSelection(isVxeEngine.value || isVirtual.value ? null : tableRef.value)
  activeEngineRef.value?.clearSelection()
}

defineExpose({
  httpRequestInstance,
  // 最近一次自动加载（onMounted/visibleShow）的错误；成功后复位为 null
  requestError,
  getSelectionRows: () => activeEngineRef.value
    ? activeEngineRef.value?.getSelectedRows() ?? []
    : multipleSelection.value,
  clearSelection: clearSelectionAll,
  clearAllSelection: clearSelectionAll,
  // 刷新当前页：保留页码重新取数 + 重排。统一命令式刷新入口。
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
    // 本地/静态：无网络，重排即可（本地分页顺带回收边界并回传父组件）
    syncLocalPagination()
    doLayoutFn()
    return Promise.resolve()
  },
  // 重新加载：回到第 1 页重新取数。搜索/重置语义。
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
    syncLocalPagination()
    doLayoutFn()
    return Promise.resolve()
  },
  // 仅重排列宽/布局，不重新取数（旧 refresh 行为的逃生舱）
  doLayout: doLayoutFn,
  scrollToRow: (row: number) => activeEngineRef.value?.scrollToRow(row),
  // 命令式勾选单行（对齐 antdv/vue2 的同名方法）：selected 省略时切换，传入布尔时强制置位。
  // el-table / vxe / virtual 三引擎的 toggleRowSelection 均为 (row, selected?) 签名。
  toggleRowSelection: (row: Record<string, unknown>, selected?: boolean) => {
    if (activeEngineRef.value) activeEngineRef.value?.toggleRowSelection?.(row, selected)
    else tableRef.value?.toggleRowSelection?.(row, selected)
  },
  // vxe 行内编辑 CRUD（engine:'vxe' 时有效）
  getUpdateRecords: () => activeEngineRef.value?.getUpdateRecords?.() ?? [],
  getInsertRecords: () => activeEngineRef.value?.getInsertRecords?.() ?? [],
  getRemoveRecords: () => activeEngineRef.value?.getRemoveRecords?.() ?? [],
  revertData: (rows?: Record<string, unknown> | Record<string, unknown>[]) => activeEngineRef.value?.revertData?.(rows),
  clearActived: () => activeEngineRef.value?.clearActived?.(),
  clearValidate: () => activeEngineRef.value?.clearValidate?.(),
  validate: (rows?: Record<string, unknown>[]) => activeEngineRef.value?.validate?.(rows),
  // vxe 导出/打印（engine:'vxe' 时有效）
  exportData: (opts?: VxeExportConfig) => activeEngineRef.value?.exportData?.(opts),
  print: (opts?: Record<string, unknown>) => activeEngineRef.value?.print?.(opts),
  getPrintHtml: (opts?: Record<string, unknown>) => activeEngineRef.value?.getPrintHtml?.(opts),
  // vxe 原始实例（100% vxe 方法/事件访问入口）
  vxeInstance: () => isVxeEngine.value ? vxeEngineRef.value?.vxeInstance?.() : null,
})
</script>

<style lang="scss" scoped>
.el-dp_tables {
  height: auto;
  :deep(.el-table__body-wrapper) {
    height: auto;
  }
}

.table_component {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  overflow: hidden;
}

.table_containers {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
}

.pagination_page {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn-slot {
  width: 100%;

  .headerBar {
    box-sizing: border-box;
    // 同分页带：走 token 才跟得上深色主题（接入方未定义时仍是 #fff）
    background-color: var(--es-bg, #fff);
    border-radius: 6px;

    :deep(.el-form-item--small .el-form-item__label) {
      box-sizing: border-box;
    }
  }
}

.tableContainer {
  border-radius: 0px;
  transition: all 1.5s;
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: flex-start;

  .table_inner_containers {
    width: 100%;
  }

  :deep(.el-table__empty-block) {
    width: 100% !important;
    margin: 32px 0;
    font-size: 14px;
    line-height: 1.5715;

    .el-table__empty-text {
      width: auto !important;
    }

    .es-empty-image {
      height: 40px;
      margin-bottom: 8px;

      .es-empty-img-simple-ellipse {
        fill: #f5f5f5;
      }

      .es-empty-img-simple-g {
        stroke: #d9d9d9;
      }

      .es-empty-img-simple-path {
        fill: #fafafa;
      }
    }

    .es-empty-description {
      line-height: 1.5715;
      color: rgba(0, 0, 0, 0.25);
    }
  }

  :deep(.el-tag) {
    height: 20px;
    padding: 0 7px;
    line-height: 20px;
    background: #fafafa;
    border: none;
    border-radius: 4px;

    &.el-tag--info {
      color: rgba(0, 0, 0, 0.85);
    }

    &.el-tag--success {
      color: #52c41a;
      background: #f6ffed;
      border-color: #b7eb8f;
    }
  }
}
</style>
