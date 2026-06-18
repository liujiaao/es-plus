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
    <div :ref="setTableContainer" class="table_component" :style="{ [heightType]: tabHeight }">
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
          :instance="{ tableRef: instance, formInstance: formInstance }"
          v-if="(options.configBtn && (options.configBtn as any[]).length) || options.leftText"
          :btn-config="(options.configBtn as any[])"
          :left-text="(options.leftText as string)"
        />

        <!-- 表格主体: a-spin 包裹 -->
        <a-spin :spinning="loadStatus" tip="努力加载中...">
          <a-table
            ref="tableRef"
            :columns="adaptedColumns"
            :dataSource="tableData.length ? tableData : dataSource"
            :rowKey="rowKeyValue"
            :pagination="false"
            :loading="false"
            :bordered="options.border"
            :size="tableSize"
            :showHeader="options.showHeader !== false"
            :rowSelection="options.multiSelect ? rowSelection : undefined"
            :rowClassName="resolvedRowClassName"
            :scroll="tableScroll"
            :virtual="isVirtual"
            :sortDirections="['ascend', 'descend']"
            :locale="{ emptyText: options.emptyText || '暂无数据' }"
            :defaultExpandAllRows="false"
            @change="handleAdvTableChange"
            v-bind="tableBindAttrs"
          >
            <!-- 展开行 -->
            <template v-if="options.expand && hasExpandSlot" #expandedRowRender="{ record }">
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
        </a-spin>
      </div>

      <!-- 分页 -->
      <div
        v-if="showPagination"
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
import { isObject, findValueByKey, mapSize, mapButtonType } from '../../../utils/shared'
import { getAdvIconComponent } from '../../../utils/icon'
import { getCallback } from '@es-plus/core'
import { adaptColumn, adaptColumns } from './column-adapter'
import type { TableColumn, PaginationConfig } from '../../../types'
import RenderDomTb from './render-dom-tb'

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
}>()

const slots = useSlots() as any

// ─── 国际化 ─────────────────────────────────────────
const antLocale = ref(zhCN)

// ─── 注入 ───────────────────────────────────────────
const instance = getCurrentInstance() as any
const $esPlusTable = inject<Record<string, unknown>>('$esPlusTable', {}) ?? getGlobalConfig().EsTable ?? {}
const esPlus = inject<Record<string, unknown>>('$EsPlus', {}) ?? getGlobalConfig() ?? {}

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

watch(() => props.columns, (val) => { columnRowList.value = [...val] }, { deep: true })

// ─── 表单耦合 ───────────────────────────────────────
const bodyFormInstance = inject<(inst: unknown) => void>('bodyFormInstance', () => undefined)
const getVisibleShow = inject<(() => boolean) | boolean>('getVisibleShow', () => false)
const visibleShow = computed(() => (typeof getVisibleShow === 'function' ? getVisibleShow() : getVisibleShow))
const formInstance = ref<unknown>(null)

// ─── 分页 ───────────────────────────────────────────
const paginationConfig = ref<PaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 0,
})
const showPagination = computed(() => paginationConfig.value.total !== undefined && paginationConfig.value.total > 0)

watch(() => props.pagination, (val) => {
  paginationConfig.value = {
    ...paginationConfig.value,
    current: val?.current || 1,
    pageSize: val?.pageSize || 10,
    total: val?.total ?? 0,
  }
}, { deep: true, immediate: true })

// ─── 表格尺寸 ───────────────────────────────────────
const tableSize = computed(() => mapSize(props.options.size, 'middle') as 'large' | 'middle' | 'small')

// ─── 虚拟滚动 ─────────────────────────────────────
const isVirtual = computed(() =>
  props.options.virtual === true || props.options.engine === 'virtual'
)

// ─── rowKey ─────────────────────────────────────────
const rowKeyValue = computed(() => {
  if (props.options.rowkey) return props.options.rowkey
  return 'id'
})

// ─── 表格滚动 ───────────────────────────────────────
const tableScroll = computed(() => {
  const scroll: Record<string, unknown> = {}
  if (heightType.value === 'height') {
    scroll.y = tableHeight.value
  } else if (heightType.value === 'maxHeight') {
    scroll.y = tableHeight.value
  }
  scroll.x = 'max-content'
  return Object.keys(scroll).length ? scroll : undefined
})

// ─── 数据 ───────────────────────────────────────────
const loadStatus = computed(() => props.options.loading || loadingStatus.value)
const isRequestConf = computed(() =>
  !!props.options.actionUrl ||
  (props.options.apiParams && isObject(props.options.apiParams) && Object.keys(props.options.apiParams).length > 0)
)
const hasDefaultSlot = computed(() => !!slots.default?.())
const hasExpandSlot = computed(() => !!(slots as any).expand)
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
} = useTableSelection(props.options.rowkey)

// ─── 过滤列 ─────────────────────────────────────────
const filteredColumns = computed(() => {
  return columnRowList.value.filter((item) => !item.hidCol)
})

// ─── 适配列 ─────────────────────────────────────────
const adaptedColumns = computed(() => {
  const cols: Record<string, unknown>[] = []

  // 序号列
  if (props.options.snIndex) {
    cols.push({
      dataIndex: '_sn', key: '_sn', title: '#', width: 60, align: 'center',
      customRender: ({ index }: { index: number }) => index + 1,
    })
  }

  for (const col of filteredColumns.value) {
    // 操作列：添加 buttons
    if ((col.prop === 'operate' || col.key === 'operate') && col.btns) {
      const filteredBtns = col.btns.filter((btn) => checkPermission(btn.permissionValue))
      cols.push({
        dataIndex: 'operate',
        key: 'operate',
        title: col.label || '操作',
        width: col.width || (filteredBtns.length * 70 + 20),
        align: 'center',
        fixed: col.fixed === true ? 'right' : col.fixed || undefined,
        _esCol: { ...col, btns: filteredBtns },
      } as any)
      continue
    }

    // 普通列
    const advCol = adaptColumn(col)

    // 格式化函数：有 formatter 时使用 formatter；否则兜底显示文本
    if (col.formatter) {
      advCol.customRender = ({ text, record }: { text: unknown; record: Record<string, unknown> }) => {
        return col.formatter?.(record) ?? (text == null || text === '' ? '-' : String(text))
      }
    } else if ((col.prop || col.key)) {
      advCol.customRender = advCol.customRender || (({ text }: { text: unknown }) => {
        if (text == null || text === '') return '-'
        return String(text)
      })
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

// ─── 行样式/类名 ────────────────────────────────────
const resolvedRowClassName = computed(() => {
  const rc = props.options.rowClassName
  if (!rc) return undefined
  if (typeof rc === 'function') return rc
  return rc
})

const resolvedCustomRow = computed(() => {
  const rowStyle = props.options.rowStyle
  const highlighted = props.options.highlightCurrentRow
  if (!rowStyle && !highlighted) return undefined
  return (record: Record<string, unknown>, _index: number) => {
    const s: Record<string, unknown> = {}
    if (typeof rowStyle === 'function') Object.assign(s, rowStyle({ row: record, rowIndex: _index }))
    else if (rowStyle) Object.assign(s, rowStyle)
    return { style: Object.keys(s).length ? s : undefined }
  }
})

// ─── 高度自适应 ─────────────────────────────────────
const { tableHeight } = useTableResize(
  tableContainerRef, headBarRef, tbBtnRef, paginationRef,
  { heightType: heightType.value, tabHeight: props.options.tabHeight }
)

// ─── ADV Table 统一 change 事件 ─────────────────────
function handleAdvTableChange(
  _pag: any,
  _filters: any,
  sorter: any
) {
  if (sorter && (sorter as any).column) {
    const s = sorter as { column: Record<string, unknown>; order: string | null; field: string }
    if (s.order) {
      emit('change-table-sort', { prop: s.field, order: s.order === 'ascend' ? 'ascending' : 'descending' })
    }
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
    return checkListKey.every((it) => obj[it] && typeof obj[it] === 'string')
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
  if (!url || !Object.keys(apiParams).length) return

  const formData = formInstance.value
    ? toRaw(unref((formInstance.value as any).props?.model))
    : {}
  const fnParams = getListenToCallBack('beforeRequest', { ...formData, ...params, ...toRaw(unref(apiParams.model || {})) })
  const finalParams = isObject(fnParams) ? fnParams : { ...formData, ...toRaw(unref(apiParams.model || {})), ...params }
  const requestOption = { ...toRaw(unref(apiParams.options || {})) }
  if (apiParams?.method) requestOption.method = apiParams?.method

  const requestHandler = async (requestFn: Function) => {
    if (loadingStatus.value) return
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
  }
}

const httpRequestInstance = (model?: Record<string, unknown>) => {
  return new Promise((resolve, reject) => {
    paginationConfig.value.current = 1
    queryTableListMethod(
      { ...(model || {}), pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
      {
        success: (res) => {
          formatConfigOut(res, ['total', 'tableData'])
          if (Object.keys(props.pagination).length) {
            emit('update:pagination', { ...paginationConfig.value })
          }
          resolve(res)
        },
        fail: (err) => reject(err),
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
onMounted(() => {
  if (isRequestConf.value && props.options.isInitRun !== false) {
    httpRequestInstance()
  }
})

watch(visibleShow, async (val, oldVal) => {
  if (val && val !== oldVal && props.options.actionUrl) {
    await httpRequestInstance()
  }
})

watch(() => props.dataSource, (val) => {
  initSelection(val)
}, { deep: true })

watch(tableData, (val) => {
  if (Array.isArray(val)) emit('update:dataSource', val)
}, { deep: true })

// ─── Provide ─────────────────────────────────────────
provide('getTableInstantce', () => ({
  ...(instance?.setupState || {}),
  tableRef,
  toggleSelection: (rows: Record<string, unknown>[]) => {
    if (rows) rows.forEach((r) => toggleRowSelection(r, true))
    else clearSelection()
  },
  clearAllSelection,
  refsInstance: () => tableRef.value,
  httpRequestInstance,
}))

// ─── Expose ──────────────────────────────────────────
defineExpose({
  httpRequestInstance,
  getSelectionRows: () => multipleSelection.value,
  clearSelection,
  clearAllSelection,
  toggleRowSelection,
  refresh: () => httpRequestInstance(),
  scrollToRow: (row: number | string) => {
    // ADV a-table 没有 scrollToRow，降级处理
    if (typeof row === 'number') {
      tableRef.value?.$el?.querySelectorAll?.('.ant-table-row')?.[row]?.scrollIntoView?.({ block: 'center' })
    } else if (typeof row === 'string' && row) {
      tableRef.value?.$el?.querySelector?.(`[data-row-key="${row}"]`)?.scrollIntoView?.({ block: 'center' })
    }
  },
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
  justify-content: flex-end;
  align-items: center;
  padding: 10px 0;
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
