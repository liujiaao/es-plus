<template>
  <el-config-provider :locale="locale">
    <div :ref="setTableContainer" class="table_component" :style="{ [heightType]: tabHeight }">
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
              :instance="{ tableRef: instance, formInstance: formInstance }"
              v-if="(options.configBtn && (options.configBtn as any[]).length) || options.leftText"
              :btn-config="(options.configBtn as any[])"
              :left-text="(options.leftText as string)"
            />
            <el-table
              class="el-dp_tables"
              :id="tableId"
              :key="tableId"
              ref="tableRef"
              style="width: 100%"
              v-bind="tableBindAttrs"
              :data="dataSource"
              @sort-change="changeTableSort"
              @selection-change="handleTableSelectionChange"
            >
              <template #empty>
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
              </template>
              <column-item v-for="(cols, index) in filteredColumns" :key="cols.prop || cols.key || index" :cols="{ ...cols, columnIndex: index }">
                <template v-if="cols.scopedSlots && cols.scopedSlots.customRender" #[cols.scopedSlots.customRender]="{ scope }">
                  <slot v-bind="{ ...cols, columnIndex: index, row: scope.row, column: scope.column }" :name="cols.scopedSlots.customRender" :scope="scope" />
                </template>
              </column-item>
            </el-table>
          </div>
          <div
            v-if="showPagination"
            ref="paginationRef"
            class="pagination_page"
            :style="{
              position: heightType === 'height' ? 'absolute' : 'static',
              bottom: '0px',
              left: '0px',
              zIndex: 5,
              background: '#fff'
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
import { ref, computed, watch, inject, getCurrentInstance, provide, toRaw, unref, h, onMounted, useAttrs } from 'vue'
import { ElTable, ElConfigProvider, ElPagination, vLoading, ElButton } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ColumnItem from './column-item.vue'
import TableBtns from './table-btns.vue'
import { getGlobalConfig } from '../../../config'
import { useTableResize } from '../../../composables/use-table-resize'
import { useTableSelection } from '../../../composables/use-table-selection'
import { isObject, findValueByKey } from '../../../utils/shared'
import type { TableColumn, PaginationConfig } from '../../../types'

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
    pagination: () => ({})
  }
)

const emit = defineEmits<{
  'update:dataSource': [data: Record<string, unknown>[]]
  'update:pagination': [pagination: PaginationConfig]
  'pagination-current-change': [pagination: PaginationConfig]
  'size-change': [pagination: PaginationConfig, size: number]
  'change-table-sort': [column: Record<string, unknown>]
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
const $esPlusTable = inject<Record<string, unknown>>('$esPlusTable', null) ?? getGlobalConfig().EsTable ?? {}
const esPlus = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}

const checkPermission = (pvalue?: string): boolean => {
  if (!pvalue) return true
  const fn = esPlus.permission
  return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
}

// Refs
const tableRef = ref<any>(null)
const tbBtnRef = ref<any>(null)
const headBarRef = ref<HTMLElement | null>(null)
const paginationRef = ref<HTMLElement | null>(null)
const tableContainerRef = ref<HTMLElement | null>(null)
const tableId = ref(`table_${Math.random().toString(36).substring(2, 12)}`)
const tableData = ref<Record<string, unknown>[]>([])
const columnRowList = ref<TableColumn[]>([...props.columns])

watch(
  () => props.columns,
  (val) => {
    columnRowList.value = [...val]
  },
  { deep: true }
)
const loadingStatus = ref(false)
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

const formInstance = ref<unknown>(null)

// 计算属性
const getListEntry = computed(() => {
  if (props.options.entryQuery && isObject(props.options.entryQuery) && Object.keys(props.options.entryQuery).length) {
    return props.options.entryQuery
  }
  return {}
})

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
    formInstance.value = formVNode.ctx?.refs[formVNode.props.ref]
    bodyFormInstance(formInstance.value)
  }
  return formVNode || {}
})

const hasDefaultSlot = computed(() => !!slots.default?.())
const heightType = computed(() => (props.options.heightType || 'auto') as 'auto' | 'height' | 'maxHeight')
const tabHeight = computed(() => {
  if (typeof props.options.tabHeight === 'number') {
    return `${props.options.tabHeight}px`
  }
  if (heightType.value === 'height' && typeof props.options.height === 'number') {
    return `${props.options.height}px`
  }
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
const layout = computed(() => paginationLayoutConfig.value?.layout || 'prev, pager, next, jumper, sizes, ->, total')
const paginationPageSizes = computed(() => paginationLayoutConfig.value?.pageSizes || paginationConfig.value.pageSizes)
const paginationIsSmall = computed(() => paginationLayoutConfig.value?.isSmall ?? paginationConfig.value.isSmall)
const paginationBackground = computed(() => paginationLayoutConfig.value?.background ?? true)
const loadStatus = computed(() => props.options.loading || loadingStatus.value)
const isRequestConf = computed(() => !!props.options.actionUrl || (props.options.apiParams && isObject(props.options.apiParams) && Object.keys(props.options.apiParams).length > 0))
const isHttpRequest = computed(() => !!props.options?.httpRequest && typeof props.options.httpRequest === 'function')

const filteredColumns = computed(() => {
  const list = columnRowList.value.filter((item) => !item.hidCol)
  list.forEach((el) => {
    if (el.prop !== 'operate' && el.key !== 'operate' && (el.prop || el.key) && !el.formatter) {
      el.formatter = (row: Record<string, unknown>) => {
        const value = row[el.prop as string] || row[el.key as string]
        if (value == null || value === '') {
          return (el.emptyPlaceholder as string) || '-'
        }
        return value as string
      }
    }

    if ((el.prop === 'operate' || el.key === 'operate') && el.btns && !el.render) {
      el.render = (_h: any, { row }: { row: Record<string, unknown> }) => {
        return h('div', [
          el.btns?.filter((btn: any) => checkPermission(btn.permissionValue))
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

  return list
})

// es-table 内部选项键，不应传递给 el-table
const TABLE_INTERNAL_KEYS = new Set([
  'multiSelect', 'expand', 'snIndex', 'loading', 'cachePageSelection',
  'httpRequest', 'configTableOut', 'listenToCallBack',
  'apiParams', 'actionUrl', 'heightType', 'tabHeight',
  'isInitRun', 'entryQuery', 'configBtn', 'leftText', 'rowkey'
])

const tableAttrs = computed(() => {
  const merged = columnBindAttr({ ...defaultOptions, ...props.options })
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
const tableBindAttrs = computed(() => {
  const result: Record<string, unknown> = { ...tableAttrs.value, ...fallthroughAttrs }
  if (props.options.rowkey) {
    result.rowKey = props.options.rowkey
  }
  if (heightType.value === 'height') {
    result.height = tableHeight.value
  } else if (heightType.value === 'maxHeight') {
    result.maxHeight = tableHeight.value
  }
  return result
})

// 使用原生 ResizeObserver
const { tableHeight, resizeObservers } = useTableResize(
  tableContainerRef,
  headBarRef,
  tbBtnRef,
  paginationRef,
  { heightType: heightType.value as 'auto' | 'height', tabHeight: props.options.tabHeight }
)

watch(
  visibleShow,
  async (val, oldVal) => {
    if (val && val !== oldVal) {
      if (props.options.actionUrl) {
        await httpRequestInstance()
      }
      tableRef.value?.doLayout?.()
    }
  }
)

watch(
  () => props.pagination,
  (val) => {
    paginationConfig.value = { ...paginationConfig.value, ...val }
    showPagination.value = val.total !== undefined
  },
  { deep: true, immediate: true }
)

watch(
  () => props.dataSource,
  (val) => {
    initSelection(val, tableRef.value)
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

// 配置化接口请求时，挂载自动加载数据
onMounted(() => {
  if (isRequestConf.value && props.options.isInitRun !== false) {
    httpRequestInstance()
  }
})

// 表格选择逻辑
const { multipleSelection, handleSelectionChange, initSelection, clearAllSelection } = useTableSelection(props.options.rowkey)

const handleTableSelectionChange = (val: Record<string, unknown>[]) => {
  handleSelectionChange(val, paginationConfig.value.current || 1)
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
  const eventNameList = [
    { eventName: 'brcb', isReturn: true },
    { eventName: 'qrcb', isReturn: true }
  ]
  const hasEventNameIndex = eventNameList.findIndex((it) => it.eventName === eventName)
  if (props.options.listenToCallBack && props.options.listenToCallBack[eventName] && hasEventNameIndex !== -1) {
    const callObj = eventNameList[hasEventNameIndex]
    if (callObj.isReturn) {
      return props.options.listenToCallBack[eventName](params)
    }
  }
}

const formatConfigOut = (row: Record<string, unknown>, keyList: string[]) => {
  if (isObject(configTableField.value) && Object.keys(configTableField.value).length) {
    Object.entries(configTableField.value).forEach(([key, value]) => {
      const isKeyUsed = keyList.includes(key)
      if (!isKeyUsed) return

      const rowData = row[value as string] ?? findValueByKey(row, value as string)
      if (key === 'tableData') {
        tableData.value = Array.isArray(rowData) ? rowData : []
      } else {
        ;(paginationConfig.value as any)[key] = typeof rowData === 'number' ? rowData : parseInt(rowData as string, 10) || 0
      }
    })
  }
}

const queryTableListMethod = (params: Record<string, unknown>, options: { success?: (res: Record<string, unknown>) => void; fail?: (err: unknown) => void } = {}) => {
  const { success, fail } = options
  const apiParams = (props.options?.apiParams || {}) as Record<string, any>
  const url = props.options?.actionUrl || apiParams.url || ''

  if (!url || !Object.keys(apiParams).length) return

  const formData = Object.keys(isFormInstance.value).length
    ? toRaw(unref((isFormInstance.value as any).props.model))
    : getListEntry.value || {}


  const fnParams = getListenToCallBack('brcb', { ...formData, ...params, ...toRaw(unref(apiParams.model || {})) })
  const finalParams = isObject(fnParams) ? fnParams : { ...formData, ...toRaw(unref(apiParams.model || {})), ...params }
  const requestOption = { ...toRaw(unref(apiParams.options || {})) }
  if (apiParams?.method) {
    requestOption.method = apiParams?.method
  }

  const requestHandler = async (requestFn: Function) => {
    if (loadingStatus.value) return
    loadingStatus.value = true
  console.log('formData///', finalParams)
    try {
      const res = await requestFn({
        url,
        formParams: finalParams,
        headers: apiParams.headers || {},
        ...requestOption,
        ...params
      })
      const responseData = getListenToCallBack('qrcb', res) || res
      if (isObject(res) && Object.keys(res).length && typeof success === 'function') {
        success(responseData as Record<string, unknown>)
      }
    } catch (e) {
      if (typeof fail === 'function') {
        fail(e)
      }
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
            emit('update:pagination', paginationConfig.value)
          }
          resolve(res)
        },
        fail: (err) => {
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
      success: (res) => {
        formatConfigOut(res, ['total', 'tableData'])
        emit('update:pagination', paginationConfig.value)
        emit('pagination-current-change', paginationConfig.value)
      }
    }
  )
}

const changePageSizeRequest = () => {
  queryTableListMethod(
    { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
    {
      success: (res) => {
        formatConfigOut(res, ['total', 'tableData'])
        emit('update:pagination', paginationConfig.value)
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
    emit('update:pagination', paginationConfig.value)
    emit('size-change', paginationConfig.value, size)
  }
}

const handleIndexChange = (val: number) => {
  paginationConfig.value.current = val
  if (isRequestConf.value) {
    console.log('indexPages//', val)
    changePageIndexRequest()
  } else {
    emit('update:pagination', paginationConfig.value)
    emit('pagination-current-change', paginationConfig.value)
  }
}

const changeTableSort = (column: Record<string, unknown>) => {
  emit('change-table-sort', column)
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

// 提供表格实例给子组件（保留与 Form 的耦合）
provide('getTableInstantce', () => ({
  ...(instance?.setupState || {}),
  tableRef,
  toggleSelection: (rows: Record<string, unknown>[]) => {
    if (rows) {
      rows.forEach((row) => {
        tableRef.value?.toggleRowSelection(row)
      })
    } else {
      tableRef.value?.clearSelection()
    }
  },
  clearAllSelection: () => clearAllSelection(tableRef.value),
  refsInstance: () => tableRef.value,
  httpRequestInstance
}))

// 暴露方法
defineExpose({
  httpRequestInstance,
  getSelectionRows: () => multipleSelection.value,
  clearSelection: () => tableRef.value?.clearSelection?.(),
  clearAllSelection: () => clearAllSelection(tableRef.value),
  refresh: () => tableRef.value?.doLayout?.()
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
    background-color: #fff;
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

    .ant-empty-image {
      height: 40px;
      margin-bottom: 8px;

      .ant-empty-img-simple-ellipse {
        fill: #f5f5f5;
      }

      .ant-empty-img-simple-g {
        stroke: #d9d9d9;
      }

      .ant-empty-img-simple-path {
        fill: #fafafa;
      }
    }

    .ant-empty-description {
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
