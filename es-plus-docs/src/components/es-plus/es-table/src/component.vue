<template>
   <el-config-provider :locale="locale">
    <div :ref="setContTableContainer" class="table_component" :style="{ [heightType]: tabHeight }">
      <div class="table_containers">
      <div
        v-if="showHeaderBar"
        ref="headBarRef"
        class="btn-slot"
        :style="slotStyles.value && slotStyles.type === 'object' && slotStyles.value"
        :class="slotStyles.type === 'string' ? slotStyles.value : { slotClass: slotState && slotStyles.type !== 'object' }"
      >
        <div class="headerBar" v-if="hasDefaultSlot" :style="{paddingBottom: hasDefaultSlot ? '10px' : '0px'}">
          <slot />
        </div>
      </div>
      <div v-loading="loadStatus" element-loading-background="rgba(0, 0, 0, 0.03)" element-loading-text="努力加载中..." class="page-loading-con tableContainer">
       <div class="table_inner_containers">
        <table-btns
          ref="tbBtnRef"
          :instance="{
            tableRef: instance,
            formInstance: formInstance
          }"
          v-if="(attrs.configBtn && attrs.configBtn.length) || attrs.leftText"
          :btn-config="attrs.configBtn"
          :left-text="attrs.leftText"
        />
        <el-table
          class="el-dp_tables"
          :id="tableId"
          :key="tableId"
          ref="tableRef"
          :border="attrs.border"
          style="width: 100%"
          v-bind:[heightType]="tableHeight"
          v-bind="$attrs"
          :data="dataSource"
          @sort-change="changeTableSort"
          @selection-change="handleSelectionChange"
        >
          <template #empty>
            <div class="ant-empty ant-empty-normal">
              <div class="ant-empty-image">
                <svg class="ant-empty-img-simple" width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg">
                  <g transform="translate(0 1)" fill="none" fill-rule="evenodd">
                    <ellipse class="ant-empty-img-simple-ellipse" cx="32" cy="33" rx="32" ry="7" />
                    <g class="ant-empty-img-simple-g" fill-rule="nonzero">
                      <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
                      <path
                        d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z"
                        class="ant-empty-img-simple-path"
                      />
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
            opacity: 1,// loadPaginationShow ? 1 : 0,
            position: heightType === 'height' ? 'absolute' : 'static',
            bottom: '0px',
            left: '0px',
            zIndex: 5,
            background: '#fff'
          }"
        >
          <el-pagination
            background
            :size="paginationConfig.size"
            :total="paginationConfig.total"
            v-model:page-size="paginationConfig.pageSize"
            :page-sizes="paginationConfig.pageSizes"
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

<script>
import { getCurrentInstance, defineComponent, ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, onDeactivated, onActivated, nextTick, provide, inject, toRaw, unref, h } from 'vue'
import { ElTable, ElConfigProvider, ElPagination, vLoading } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ColumnItem from './columnItem.vue'
import TableBtns from './tableBtns.vue'
import resizeObserver from './resizeObserver'
// 默认表格配置
const defaultOptions = {
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

export default defineComponent({
  name: 'EsTable',
  components: {
    ColumnItem,
    TableBtns,
    ElTable,
    ElPagination,
    ElConfigProvider
  },
  directives: {
    loading: vLoading
  },
  props: {
    initTabHeight: {
      type: Number,
      default: 400
    },
    headBarClass: {
      type: [String, Object],
      default: ''
    },
    showHeaderBar: {
      type: Boolean,
      default: true
    },
    dataSource: {
      type: Array,
      default: () => []
    },
    columns: {
      type: Array,
      default: () => []
    },
    options: {
      type: Object,
      default: () => ({ ...defaultOptions })
    },
    pagination: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:dataSource', 'update:pagination', 'pagination-current-change', 'size-change', 'change-table-sort'],
  setup(props, { emit, slots }) {
    const locale = ref(zhCn)
    // 获取弹窗注入的语言环境
    const injectedLocale = inject('elLocale', null)
    if (injectedLocale) {
      locale.value = injectedLocale
      console.log('[EsTable] 使用弹窗注入的语言环境:', injectedLocale.name)
    }
    
    const loadPaginationShow = ref(true)
    const tableRef = ref(null)
    const tbBtnRef = ref(null)
    const headBarRef = ref(null)
    const paginationRef = ref(null)
    const erd = ref(null)
    const erdform = ref(null)
    const observeresize = ref(null)
    const tableId = ref(`table_${Math.random().toString(36).substring(2, 12)}`)
    const tableContainerRef = ref(null) // ref(`tab_container_${Math.random().toString(36).substring(2, 12)}`)
    const tableHeight = ref(props.initTabHeight)
    const showPagination = ref(false)
    const slotState = ref(false)
    const timer = ref(null)
    const tableData = ref([])
    const columnRowList = ref([...props.columns])
    const multipleSelection = ref([])
    const selectionsByPage = ref({})
    const isInitChange = ref(false)
    const loadingStatus = ref(false)
    const bodyFormInstantce = inject('bodyFormInstantce', (inst) => {})
    const getVisibleShow = inject('getVisibleShow', false)
    const visibleShow = computed(() => (typeof getVisibleShow === 'function' ? getVisibleShow() : getVisibleShow))
    const $esPlusTable = inject('$esPlusTable', {})
    const instance = getCurrentInstance() || {}

    const setContTableContainer = (el) => {
      if (el) tableContainerRef.value = el
    }
    // 分页配置
    const paginationConfig = ref({
      pageSize: 10,
      current: 1,
      total: 0,
      pageSizes: [],
      size: 'small',
      isSmall: true,
      ...props.pagination
    })

    const formInstance = ref(null)

    // 独立的表格入参
    const getListEntry = computed(() => {
      if (props.options.entryQuery && Object.prototype.toString.call(props.options.entryQuery).slice(8, -1) === 'Object' && Object.keys(props.options.entryQuery).length) {
        return props.options.entryQuery
      } else {
        return {}
      }
    })
    // 表格查询输出字段配置
    const configTablefield = computed(() => {
      if (
        props.options.configTableOut &&
        Object.prototype.toString.call(props.options.configTableOut).slice(8, -1) === 'Object' &&
        Object.keys(props.options.configTableOut).length &&
        checkQueryFields(props.options.configTableOut)
      ) {
        return props.options.configTableOut
      } else {
        if ($esPlusTable?.configQueryfieldOutput && typeof $esPlusTable.configQueryfieldOutput === 'function') {
          const configFields = $esPlusTable.configQueryfieldOutput({
            total: 'records',
            pageSize: 'pageSize',
            current: 'pageNo',
            tableData: 'rows'
          })
          const isPass = checkQueryFields(configFields)
          if (isPass) {
            return configFields
          } else {
            return {
              total: 'records',
              pageSize: 'pageSize',
              current: 'pageNo',
              tableData: 'rows'
            }
          }
        } else {
          return {
            total: 'records',
            pageSize: 'pageSize',
            current: 'pageNo',
            tableData: 'rows'
          }
        }
      }
    })

    const getDataSouce = computed(() => {
      return props.dataSource
    })
    const isFormInstace = computed(() => {
      const defaultSlots = instance?.slots.default?.() || []
      const formVNode = defaultSlots.find((vnode) => {
        const type = vnode.type
        return type?.name === 'EsForm' || type?.displayName === 'EsForm'
      })
      console.log('formInstance///', formVNode, formInstance.value)
      if (formVNode && formVNode.props?.ref) {
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        formInstance.value = formVNode.ctx?.refs[formVNode.props.ref]
        bodyFormInstantce(formInstance.value)
      }

      return formVNode || {}
    })

    const isListenToCallBack = computed(() => {
      if (props.options.listenToCallBack && Object.prototype.toString.call(props.options.listenToCallBack).slice(8, -1) === 'Object' && Object.keys(props.options.listenToCallBack).length) {
        return props.options.listenToCallBack
      }
      return false
    })

    const hasDefaultSlot = computed(() => !!slots.default?.())
    const heightType = computed(() => props.options.heightType || 'auto')
    const tabHeight = computed(() => {
      if (typeof props.options.tabHeight === 'number') {
        return `${props.options.tabHeight}px`
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
    const layout = computed(() => ['prev, pager, next, jumper, sizes, ->, total'].join(','))
    const loadStatus = computed(() => props.options.loading || loadingStatus.value)
    const isRequesConf = computed(() => !!props.options.actionUrl || (props.options.apiParams && typeof props.options.apiParams === 'object' && Object.keys(props.options.apiParams).length > 0))
    const isHttpRequest = computed(() => !!props.options?.httpRequest && typeof props.options.httpRequest === 'function')

    // 过滤并处理列配置
    const filteredColumns = computed(() => {
      const list = columnRowList.value.filter((item) => !item.hidCol)
      list.forEach((el) => {
        // 增加缺省属性
        if (el.prop !== 'operate' && el.key !== 'operate' && (el.prop || el.key) && !el.formatter) {
          el.formatter = (row) => {
            const value = row[el.prop] || row[el.key]
            if (value == null || value === '') {
              return el.emptyPlaceholder || '-'
            }
            return value
          }
        }

        // 增加默认按钮组
        if ((el.prop === 'operate' || el.key === 'operate') && el.btns && !el.render) {
          el.render = (text, row, index) => {
            return h('div', [
              el.btns && el.btns.map((btn) =>
                h('el-button', {
                  onClick: () => btn.clickEvent && btn.clickEvent(row),
                  text: true,
                  type: btn.type || 'primary'
                }, btn.name)
              )
            ])
          }
        }
      })
      return list
    })

    // 表格属性
    const attrs = computed(() => {
      const { httpRequest, configTableOut, listenToCallBack, ...options } = props.options
      const { align, ...attr } = columnbindAttr({
        ...defaultOptions,
        ...options,
        ...props.options
      })
      return attr
    })

    // 监听器
    watch(visibleShow, async (val, oldVal) => {
      if (val && val !== oldVal) {
        if (props.options.actionUrl) {
          await httpRequestInstance()
        }
        nextTick(() => {
          tableRef.value?.doLayout?.()
        })
      }
    })

    watch(
      () => props.pagination,
      (val) => {
        paginationConfig.value = { ...paginationConfig.value, ...val }
        showPagination.value = val.total !== undefined
      },
      {
        deep: true,
        immediate: true
      }
    )

    watch(
      () => props.dataSource,
      (val) => {
        isInitChange.value = true
        if (props.options.cachePageSelection) {
          nextTick(() => {
            handleSelectData(val)
            isInitChange.value = false
          })
        } else {
          nextTick(() => {
            tableRef.value?.clearSelection?.()
            isInitChange.value = false
          })
        }
      },
      { deep: true }
    )

    watch(
      tableData,
      (val, old) => {
        if (Array.isArray(val)) {
          emit('update:dataSource', val)
        }
      },
      { deep: true }
    )

    // 方法
    const elementResize = () => {
      nextTick(() => {
        // 创建带有增强防抖和节流配置的resizeObserver实例
        // 针对表单折叠/展开场景优化配置
        erd.value = new resizeObserver({
          debounceDelay: 150,   // 150ms防抖延迟，平衡响应性和性能
          throttleDelay: 100,   // 100ms节流延迟，减少频繁触发
          maxRetries: 2,        // 最大重试次数
          retryDelay: 100,      // 重试延迟增加
          enableDebug: true,    // 开启调试模式以便监控
          // 针对表单折叠/展开的特殊阈值
          formCollapseThreshold: {
            minWidthChange: 10,   // 最小宽度变化阈值
            minHeightChange: 50,  // 最小高度变化阈值（表单折叠通常变化较大）
            heightChangeRatio: 0.3  // 高度变化比例阈值
          }
        })
        console.log('[ResizeObserver] Initialized with optimized settings', tableContainerRef.value)
        
        // 使用安全的回调函数包装
        const safeResizeCallback = (dimensions) => {
          try {
            // 防止在组件卸载后执行
            if (!tableContainerRef.value) return
            
            // 使用 requestAnimationFrame 来避免在同一帧内多次触发
            requestAnimationFrame(() => {
              if (tableContainerRef.value) {
                resizeObservers(tableContainerRef.value)
              }
            })
          } catch (error) {
            console.error('[ResizeObserver] Callback error:', error)
          }
        }
        
        erd.value.observe(tableContainerRef.value, safeResizeCallback)
      })
    }

    const headerBarResize = () => {
      erdform.value = new resizeObserver() // elementResizeDetectorMaker()
      if (headBarRef.value) {
        erdform.value.observe(headBarRef.value, resizeBar)
      }
    }

    const cleanupResizeListeners = () => {
      try {
        console.log('[ResizeObserver] Cleaning up listeners...')
        
        if (erd.value) {
          // 完全断开所有观察
          erd.value.disconnect?.()
          erd.value = null
          console.log('[ResizeObserver] Main observer disconnected')
        }
        
        if (erdform.value) {
          // 完全断开表单观察器
          erdform.value.disconnect?.()
          erdform.value = null
          console.log('[ResizeObserver] Form observer disconnected')
        }
        
        if (observeresize.value) {
          observeresize.value.cancel?.()
          observeresize.value = null
        }
        
        // 清理所有定时器
        if (timer.value) {
          clearTimeout(timer.value)
          timer.value = null
        }
        
        console.log('[ResizeObserver] Cleanup completed')
      } catch (error) {
        console.error('[ResizeObserver] Error during cleanup:', error)
      }
    }

    const resizeBar = () => {
      if (tableContainerRef.value) {
        resizeObservers(tableContainerRef.value)
      }
    }
    const isNegative = (num) => {
      return Math.sign(num) === -1
    }
    const totalContianerNum = () => {
      const headBarHeight = headBarRef.value ? headBarRef.value.offsetHeight : 0
      const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
      const paginationHeight = paginationRef.value?.offsetHeight || 0
      return Math.round(paginationHeight + headBarHeight + tbBtnHeight)
    }
    const resizeObservers = (element) => {
      if (!element) return
      if (heightType.value === 'height') {
        const tabContainer = element.height || element.offsetHeight
        const maxTabContainer = !isNaN(parseInt(tabContainer)) ? parseInt(tabContainer) : 450
        const isMinTableNum = maxTabContainer - totalContianerNum()
        const TabContainer = isNegative(isMinTableNum) ? totalContianerNum() + 300 : maxTabContainer

        const paginationHeight = paginationRef.value?.offsetHeight || 0

        //  if (headBarRef.value) {
        const headBarHeight = headBarRef.value ? headBarRef.value.offsetHeight : 0
        slotState.value = headBarHeight > 0

        const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
        const tbMaxHeight = Math.floor(TabContainer) - Math.round(paginationHeight + headBarHeight + tbBtnHeight)
         console.log('heightType///', maxTabContainer, isMinTableNum, totalContianerNum())
        tableHeight.value = tbMaxHeight
        if (tableHeight.value === props.initTabHeight) {
          loadPaginationShow.value = true
        }
        //  }
      } else {
        const maxTabContainer = !isNaN(parseInt(tabHeight.value)) ? parseInt(tabHeight.value) : 450
        const isMinTableNum = maxTabContainer - totalContianerNum()
        const TabContainer = isNegative(isMinTableNum) ? totalContianerNum() + 300 : maxTabContainer
        const paginationHeight = paginationRef.value?.offsetHeight || 0
        console.log('heightType///', maxTabContainer, isMinTableNum, totalContianerNum())
        // if (headBarRef.value) {
        const headBarHeight = headBarRef.value ? headBarRef.value.offsetHeight : 0
        slotState.value = headBarHeight > 0

        const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
        const tbMaxHeight = Math.floor(TabContainer) - Math.round(paginationHeight + headBarHeight + tbBtnHeight)
        tableHeight.value = tbMaxHeight

        if (tableHeight.value === props.initTabHeight) {
          loadPaginationShow.value = true
        }
        // }
      }
    }

    const handleSelectionChange = (val) => {
      if (props.options.cachePageSelection) {
        if (isInitChange.value) return

        selectionsByPage.value[paginationConfig.value.current] = val
        let allSelections = []
        const { rowkey } = props.options

        Object.values(selectionsByPage.value).forEach((pageSelections) => {
          if (rowkey) {
            const uniqueMap = {}
            pageSelections.forEach((item) => {
              const key = item[rowkey]
              if (key && !uniqueMap[key]) {
                allSelections.push(item)
                uniqueMap[key] = true
              }
            })
          } else {
            allSelections = [...allSelections, ...pageSelections]
          }
        })

        multipleSelection.value = allSelections
      } else {
        multipleSelection.value = val
      }
    }

    const handleSelectData = (dataList) => {
      const { cachePageSelection, rowkey } = props.options
      if (dataList?.length && cachePageSelection && rowkey && multipleSelection.value.length) {
        const pageSelecteds = []
        dataList.forEach((row) => {
          multipleSelection.value.forEach((selectedRow) => {
            if (row[rowkey] === selectedRow[rowkey]) {
              pageSelecteds.push(row)
            }
          })
        })

        pageSelecteds.forEach((row) => {
          tableRef.value?.toggleRowSelection?.(row, true)
        })
      }
    }

    const firstWordUpperCase = (str) => {
      return str.toLowerCase().replace(/(\s|^)[a-z]/g, (char) => char.toUpperCase())
    }

    const columnbindAttr = (cols) => {
      const options = {}
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

    const getCustomerTable = () => {
      return columnRowList.value.filter((it) => !it.type)
    }
    const checkQueryFields = (obj) => {
      const checkListkey = ['total', 'pageSize', 'current', 'tableData']
      if (Object.prototype.toString.call(obj).slice(8, -1) === 'Object') {
        return Object.keys(obj).every((it) => {
          return checkListkey.find((its) => its === it) && obj[it] && typeof obj[it] === 'string'
        })
      }
      return false
    }
    const addKeydown = () => {
      nextTick(() => {
        const tabDom = document.getElementById(tableId).getElementsByClassName('el-table__body-wrapper')[0]
        document.addEventListener('keydown', tableKeydown)
      })
    }
    const removeKeydown = () => {
      nextTick(() => {
        document.removeEventListener('keydown', tableKeydown)
      })
    }
    const tableKeydown = (event) => {
      const curel = document.activeElement //当前元素
      const curcellIndex = document.activeElement?.parentNode?.parentNode?.cellIndex // 当前元素行单元格索引
      const curRowIndex = document.activeElement?.parentNode?.parentNode?.parentNode?.sectionRowIndex //当前元素行的索引；
      const curtbody = document.activeElement?.parentNode?.parentNode?.parentNode?.parentNode?.children //当前tbody内容的整个表单

      if (event && event.keyCode === 9) {
        // 检查按键是否是Tab

        if (event.target.nodeName === 'TEXTAREA' || event.target.nodeName === 'INPUT') {
          //const activeRow = document.activeElement.parentNode.parentNode.parentNode;
          // console.log('Tab///', curRowIndex)
        } else {
          event.preventDefault()
        }
      }
    }
    // 表格回调集合增强处理
    const getListenToCallBack = (eventName, params) => {
      const eventNameList = [
        { eventName: 'brcb', isReturn: true }, // 查询前参数过滤或处理
        { eventName: 'qrcb', isReturn: true } // 查询respons回调
      ]
      const hasEventNameIndex = eventNameList.findIndex((it) => it.eventName === eventName)
      if (isListenToCallBack.value && isListenToCallBack.value[eventName] && hasEventNameIndex !== -1) {
        const callObj = eventNameList[hasEventNameIndex]
        if (callObj.isReturn) {
          return isListenToCallBack.value[eventName](params)
        } else {
          isListenToCallBack.value[eventName](params)
        }
      }
    }

    /*
    const findValueByKey = (obj, key) => {
      // eslint-disable-next-line no-prototype-builtins
      if (Object.prototype.toString.call(obj).slice(8, -1) === 'Object' && obj.hasOwnProperty(key)) {
        return obj[key]
      }
      for (const prop in obj) {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(prop) && Object.prototype.toString.call(obj[prop]).slice(8, -1) === 'Object') {
          const value = findValueByKey(obj[prop], key)
          if (value !== undefined) {
            return value
          }
        }
      }
      return undefined
    } */


       const findValueByKey = (obj, key, depth = 0) => {
      if (depth > 3) {
        return undefined
      }
      const currentValue = Object.prototype.toString.call(obj).slice(8, -1) === 'Object' && obj.hasOwnProperty(key)
        ? obj[key]
        : undefined

      for (const prop in obj) {
        if (obj.hasOwnProperty(prop) && Object.prototype.toString.call(obj[prop]).slice(8, -1) === 'Object') {
          const deepValue = findValueByKey(obj[prop], key, depth + 1)
          if (deepValue !== undefined) {
            return deepValue
          }
        }
      }
      return currentValue
    }

    // 配置分页和列表属性
    const formatConfigout = (row = {}, keyList = []) => {
      if (configTablefield.value && Object.prototype.toString.call(configTablefield.value).slice(8, -1) === 'Object' && Object.keys(configTablefield.value).length) {
        Object.entries(configTablefield.value).forEach(([key, value]) => {
          const isKeyUsed = keyList.includes(key)

          if (isKeyUsed) {
            const rowData = row[value] ?? findValueByKey(row, value)
            if (key === 'tableData') {
              tableData.value = Array.isArray(rowData) ? rowData : []
            } else {
              paginationConfig.value[key] = typeof rowData === 'number' ? rowData : parseInt(rowData) || 0
            }
          }
        })
      }
    }
    // 辅助函数：判断是否为对象
    const isObject = (value) => {
      return typeof value === 'object' && value !== null && Object.prototype.toString.call(value).slice(8, -1) === 'Object'
    }

    const queryTableListMethod = (params, options = {}) => {
      const { success, fail } = options
      const apiParams = props.options?.apiParams || {}
      const url = props.options?.actionUrl || apiParams.url || ''

      if (!url || !Object.keys(apiParams).length) return

      const formData = Object.keys(isFormInstace).length ? toRaw(unref(isFormInstace.value.props.model)) : getListEntry.value || {}
      const fnParams = getListenToCallBack('brcb', { ...formData, ...params, ...toRaw(unref(apiParams.model || {})) })
      const finalParams = isObject(fnParams) ? fnParams : { ...formData, ...toRaw(unref(apiParams.model || {})), ...params }
      const requestOption = {...toRaw(unref(apiParams.options || {}))}
        if(apiParams?.method) {
          requestOption.method = apiParams?.method
        }
      const requestHandler = async (requestFn) => {
        if (loadingStatus.value) return
        loadingStatus.value = true

        try {
          const res = await requestFn({
            url,
            formParams: finalParams,
            headers: apiParams.headers || {},
            ...requestOption,
            ...params
          })
        //  getListenToCallBack('qrcb', res)
           const responsData = getListenToCallBack('qrcb', res)
           const formatResPonsData = responsData || res
          if (isObject(res) && Object.keys(res).length && typeof success === 'function') {
            success(formatResPonsData)
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
        requestHandler($esPlusTable.$httpRequest)
      }
    }
    // 表格列表查询实例
    const httpRequestInstance = (model) => {
      return new Promise((resolve, reject) => {
        nextTick(() => {
          paginationConfig.value.current = 1
          queryTableListMethod(
            { ...(model || {}), pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
            {
              success: (res) => {
                formatConfigout(res, ['total', 'tableData'])
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
      })
    }

    // 分页自动化查询
    const changePageIndexRquest = (val) => {
      nextTick(() => {
        queryTableListMethod(
          { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
          {
            success: (res) => {
              formatConfigout(res, ['total', 'tableData'])
              emit('update:pagination', paginationConfig.value)
              emit('pagination-current-change', paginationConfig.value)
            }
          }
        )
      })
    }

    const changePageSizeRquest = (size) => {
      nextTick(() => {
        queryTableListMethod(
          { pageIndex: paginationConfig.value.current, pageSize: paginationConfig.value.pageSize },
          {
            success: (res) => {
              formatConfigout(res, ['total', 'tableData'])
              emit('update:pagination', paginationConfig.value)
              emit('size-change', paginationConfig.value, size)
            }
          }
        )
      })
    }

    const handleSizeChange = (size) => {
      paginationConfig.value.pageSize = size
      paginationConfig.value.current = 1
      if (Object.keys(isFormInstace).length && isRequesConf) {
        changePageSizeRquest(size)
      } else {
        emit('update:pagination', paginationConfig.value)
        emit('size-change', paginationConfig.value, size)
      }
    }

    const handleIndexChange = (val) => {
      paginationConfig.value.current = val
      if (Object.keys(isFormInstace).length && isRequesConf) {
        changePageIndexRquest(val)
      } else {
        emit('update:pagination', paginationConfig.value)
        emit('pagination-current-change', paginationConfig.value)
      }
    }

    const changeTableSort = (column) => {
      emit('change-table-sort', column)
    }
    // 生命周期钩子
    onMounted(() => {
      elementResize()
      headerBarResize()
      tableRef.value?.doLayout?.()
      if (props.options.isInitRun && isRequesConf.value) {
        httpRequestInstance()
      }
    })

    onBeforeUnmount(() => {
      console.log('[Component] onBeforeUnmount - cleaning up')
      cleanupResizeListeners()
    })

    onUnmounted(() => {
      console.log('[Component] onUnmounted - final cleanup')
      cleanupResizeListeners()
    })

    onDeactivated(() => {
      console.log('[Component] onDeactivated - suspending')
      cleanupResizeListeners()
    })

    onActivated(() => {
      console.log('[Component] onActivated - resuming')
      // 延迟重新初始化以避免立即触发
      nextTick(() => {
        setTimeout(() => {
          elementResize()
          headerBarResize()
        }, 100)
      })
    })

    // 提供表格实例给子组件
    provide('getTableInstantce', () => ({
      ...(instance?.setupState || {}),
      // ...(instance?.ctx || {}),
      tableRef,
      toggleSelection: (rows) => {
        if (rows) {
          rows.forEach((row) => {
            tableRef.value?.toggleRowSelection(row)
          })
        } else {
          tableRef.value?.clearSelection()
        }
      },
      clearAllSelection: () => {
        multipleSelection.value = []
        selectionsByPage.value = {}
        tableRef.value?.clearSelection()
      },
      refsInstance: () => tableRef.value
    }))

    return {
      setContTableContainer,
      httpRequestInstance,
      getCustomerTable,
      locale,
      tableContainerRef,
      tableRef,
      tbBtnRef,
      headBarRef,
      paginationRef,
      tableId,
      tableHeight,
      showPagination,
      slotState,
      loadPaginationShow,
      paginationConfig,
      hasDefaultSlot,
      heightType,
      tabHeight,
      slotStyles,
      layout,
      loadStatus,
      filteredColumns,
      attrs,
      instance,
      formInstance,
      handleSelectionChange,
      handleSizeChange,
      handleIndexChange,
      changeTableSort,
      columnbindAttr,
      // 暴露常用方法供外部调用
      refresh: () => {
        if (tableRef.value) {
          tableRef.value.doLayout()
        }
      },
      clearSelection: () => {
        if (tableRef.value) {
          tableRef.value.clearSelection()
        }
      },
      clearAllSelection: () => {
        multipleSelection.value = []
        selectionsByPage.value = {}
        if (tableRef.value) {
          tableRef.value.clearSelection()
        }
      }
    }
  }
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

.slotClass {
  /* padding: 10px 0px; */
}

.btn-slot {
  width: 100%;

  .headerBar {
    box-sizing: border-box;
    background-color: #fff;
    border-radius: 6px;

    :deep(.el-form-item--small.el-form-item) {
      // margin-bottom: 16px;
    }

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
  .table_inner_containers{
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
