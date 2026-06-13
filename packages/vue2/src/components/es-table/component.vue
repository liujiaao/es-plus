<template>
  <div ref="tableContainerEl" class="table_component" :style="containerStyle">
    <div class="table_containers">
      <div
        v-if="showHeaderBar"
        ref="headBarRef"
        class="btn-slot"
        :style="slotStyleValue"
        :class="slotClassValue"
      >
        <div
          v-if="hasDefaultSlot"
          class="headerBar"
          :style="{ paddingBottom: hasDefaultSlot ? '10px' : '0px' }"
        >
          <slot />
        </div>
      </div>

      <div
        v-loading="loadStatus"
        element-loading-background="rgba(0, 0, 0, 0.03)"
        element-loading-text="努力加载中..."
        class="page-loading-con tableContainer"
      >
        <div class="table_inner_containers">
          <table-btns
            v-if="(options.configBtn && options.configBtn.length) || options.leftText"
            ref="tbBtnRef"
            :instance="{ tableRef: instance, formInstance: formInstance }"
            :btn-config="options.configBtn"
            :left-text="options.leftText"
          />

          <!--
            Vue 2 / Element UI 版本不支持虚拟滚动 (Element UI 无 el-table-v2)
            当用户配置 options.virtual === true 时，控制台会警告，仍按普通 el-table 渲染
          -->
          <!--
            v-on="$listeners" 把宿主在 <es-table> 上写的所有监听器透传到 <el-table>，
            让 row-click / cell-click / select / header-click 等 Element UI Table 原生事件
            能直接被使用方监听。Vue 2 的 _g 会把 $listeners 与下面显式的 @sort-change /
            @selection-change 合并为数组，不会覆盖我们的内部处理。
          -->
          <el-table
            class="el-dp_tables"
            :id="tableId"
            :key="tableId"
            ref="tableRef"
            style="width: 100%"
            v-bind="tableBindAttrs"
            v-on="$listeners"
            :data="effectiveDataSource"
            @sort-change="changeTableSort"
            @selection-change="handleTableSelectionChange"
          >
            <template #empty>
              <div class="ant-empty ant-empty-normal">
                <div class="ant-empty-image">
                  <svg
                    class="ant-empty-img-simple"
                    width="64"
                    height="41"
                    viewBox="0 0 64 41"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g transform="translate(0 1)" fill="none" fill-rule="evenodd">
                      <ellipse
                        class="ant-empty-img-simple-ellipse"
                        cx="32"
                        cy="33"
                        rx="32"
                        ry="7"
                      />
                      <g class="ant-empty-img-simple-g" fill-rule="nonzero">
                        <path
                          d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"
                        />
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

            <column-item
              v-for="(cols, index) in filteredColumns"
              :key="cols.prop || cols.key || index"
              :cols="Object.assign({}, cols, { columnIndex: index })"
            >
              <template
                v-if="cols.scopedSlots && cols.scopedSlots.customRender"
                #[cols.scopedSlots.customRender]="{ scope }"
              >
                <slot
                  :name="cols.scopedSlots.customRender"
                  v-bind="
                    Object.assign({}, cols, {
                      columnIndex: index,
                      row: scope.row,
                      column: scope.column,
                    })
                  "
                  :scope="scope"
                />
              </template>
            </column-item>
          </el-table>
        </div>
      </div>

      <!--
        分页区域放在 v-loading 元素之外（作为 .table_containers 的子元素），
        以避免 loading mask（z-index 2000）遮挡分页；
        分页用 static 定位（默认）参与 flex 列布局，使 .tableContainer (flex:1) 自动让出空间。
      -->
      <div
        v-if="showPagination"
        ref="paginationRef"
        class="pagination_page"
      >
        <!--
          Element UI 与 Element Plus 分页组件 API 差异：
            - current-page: .sync 双向绑定 (vs Vue 3 v-model:current-page)
            - page-size: .sync 双向绑定
        -->
        <el-pagination
          :background="paginationBackground"
          :size="paginationIsSmall ? 'small' : paginationConfig.size"
          :total="paginationConfig.total"
          :page-size.sync="paginationConfig.pageSize"
          :page-sizes="paginationPageSizes"
          :current-page.sync="paginationConfig.current"
          :layout="layout"
          :prev-text="paginationPrevText"
          :next-text="paginationNextText"
          style="padding: 0; margin: 10px 0; text-align: center"
          @size-change="handleSizeChange"
          @current-change="handleIndexChange"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * EsTable 表格组件 —— Vue 2 版本
 *
 * 与 Vue 3 版本的核心差异：
 *   1. <script setup> → defineComponent + setup()，props/emits/expose 通过返回值与 setup 第二参数实现
 *   2. el-pagination 双向绑定从 v-model:current-page → :current-page.sync
 *   3. ElConfigProvider 在 Element UI 中不存在 —— 国际化 locale 由用户在 main.js 中
 *      通过 Vue.use(ElementUI, { locale }) 全局配置
 *   4. 虚拟滚动 (virtual: true) Element UI 无对应 el-table-v2，本版本不支持，
 *      仅控制台警告并降级为普通 el-table 渲染
 *   5. ElButton 用于操作列时，Element UI 的 type='text' 取代 Element Plus 的 text 属性
 *   6. v-loading 指令在 Element UI 中由 Vue.use(ElementUI) 自动注册，无需 ./vLoading 导入
 *
 * 业务逻辑（请求/分页/选择/列规范化）100% 与 Vue 3 版本保持一致。
 */
import {
  defineComponent,
  ref,
  computed,
  watch,
  inject,
  provide,
  getCurrentInstance,
  onMounted,
  h,
  nextTick,
} from '../../vue-compat'
import {
  getGlobalConfig,
  isObject,
  findValueByKey,
  type TableColumn,
  type PaginationConfig,
  type TableOptions,
} from '@es-plus/core'
import ColumnItem from './column-item.vue'
import TableBtns from './table-btns.vue'
import { useTableResize } from '../../composables/use-table-resize'
import { useTableSelection } from '../../composables/use-table-selection'
import { mapSize } from '../../utils/size'

const defaultOptions: TableOptions = {
  multiSelect: false,
  expand: false,
  snIndex: false,
  loading: false,
  border: false,
  size: 'small',
  headerCellStyle: { background: '#f5f7fa' },
  highlightCurrentRow: true,
  cachePageSelection: true,
}

// es-table 内部选项键，不应透传给 el-table
const TABLE_INTERNAL_KEYS = new Set([
  'multiSelect',
  'expand',
  'snIndex',
  'loading',
  'cachePageSelection',
  'httpRequest',
  'configTableOut',
  'listenToCallBack',
  'apiParams',
  'actionUrl',
  'heightType',
  'tabHeight',
  'isInitRun',
  'entryQuery',
  'configBtn',
  'leftText',
  'rowkey',
  'virtual',
  'engine',
  'rowHeight',
  'estimatedRowHeight',
  'overscanCount',
  'rowClassName',
  'lazyLoad',
])

const firstWordUpperCase = (str: string): string => {
  return str.toLowerCase().replace(/(\s|^)[a-z]/g, (char) => char.toUpperCase())
}

/**
 * 把 options 中的中划线属性、key/prop 双向映射等规范化为 el-table 可接受的 props
 */
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

const checkQueryFields = (obj: Record<string, unknown>): boolean => {
  const checkListKey = ['total', 'pageSize', 'current', 'tableData']
  if (isObject(obj)) {
    return Object.keys(obj).every((it) => {
      return checkListKey.find((its) => its === it) && obj[it] && typeof obj[it] === 'string'
    })
  }
  return false
}

export default defineComponent({
  name: 'EsTable',
  components: { ColumnItem, TableBtns },
  // 关闭自动 attrs 继承，避免 fallthrough 重复绑定
  inheritAttrs: false,
  props: {
    initTabHeight: { type: Number, default: 400 },
    headBarClass: {
      type: [String, Object] as unknown as () => string | Record<string, unknown>,
      default: '',
    },
    showHeaderBar: { type: Boolean, default: true },
    dataSource: {
      type: Array as () => Record<string, unknown>[],
      default: () => [],
    },
    columns: {
      type: Array as () => TableColumn[],
      default: () => [],
    },
    options: {
      type: Object as () => TableOptions,
      default: () => ({ ...defaultOptions }),
    },
    pagination: {
      type: Object as () => PaginationConfig,
      default: () => ({}),
    },
  },
  emits: [
    'update:dataSource',
    'update:pagination',
    'pagination-current-change',
    'size-change',
    'change-table-sort',
  ],
  setup(props, { emit, slots, attrs, expose }) {
    // ─── 注入全局配置 ─────────────────────────
    const instance = getCurrentInstance() as unknown as Record<string, unknown>
    const $esPlusTable =
      inject<Record<string, unknown>>(
        '$esPlusTable',
        null as unknown as Record<string, unknown>
      ) ??
      ((getGlobalConfig() as Record<string, unknown>).EsTable as Record<string, unknown>) ??
      {}
    const esPlus =
      inject<Record<string, unknown>>('$EsPlus', null as unknown as Record<string, unknown>) ??
      (getGlobalConfig() as Record<string, unknown>) ??
      {}

    const checkPermission = (pvalue?: string): boolean => {
      if (!pvalue) return true
      const fn = esPlus.permission
      return typeof fn === 'function' ? (fn as (v: string) => boolean)(pvalue) : true
    }

    // ─── 虚拟滚动降级 ─────────────────────────
    if (props.options.virtual === true || props.options.engine === 'virtual') {
      // eslint-disable-next-line no-console
      console.warn(
        '[@es-plus/vue2] 虚拟滚动 (virtual: true) 在 Vue 2 + Element UI 下不可用，已降级为普通 el-table 渲染。如需虚拟滚动请使用 Vue 3 + Element Plus 版本（@es-plus/vue3）。'
      )
    }

    // ─── Refs ─────────────────────────────────
    const tableRef = ref<any>(null)
    const tbBtnRef = ref<any>(null)
    const headBarRef = ref<HTMLElement | null>(null)
    const paginationRef = ref<HTMLElement | null>(null)
    const tableContainerRef = ref<HTMLElement | null>(null)
    const tableId = ref(`table_${Math.random().toString(36).substring(2, 12)}`)
    const tableData = ref<Record<string, unknown>[]>([])

    // Effective data source: 内部 tableData 优先（接口请求的数据），
    // 兼容父组件不使用 .sync 但又希望看到接口拉取数据的场景。
    // 当父组件传入了非空 dataSource 且内部 tableData 为空时，使用 dataSource。
    const effectiveDataSource = computed(() => {
      if (tableData.value && tableData.value.length) return tableData.value
      return props.dataSource
    })
    const columnRowList = ref<TableColumn[]>([...props.columns])

    // Only watch the columns array reference — not deep mutations.
    // deep: true would react to el.formatter / el.render / el.minWidth mutations
    // that filteredColumns applies to the column objects during render. In Vue 2,
    // props come from the parent's deeply observed data; each mutation triggers the
    // watcher → columnRowList reassign → filteredColumns recompute → potential
    // "infinite update loop" warning. Vue 3 avoids this because its props are
    // shallow-reactive by default.
    watch(
      () => props.columns,
      (val) => {
        columnRowList.value = [...val]
      }
    )

    const loadingStatus = ref(false)
    const slotState = ref(false)
    const showPagination = ref(false)

    // Vue 2 + @vue/composition-api 下函数式 ref `:ref="setterFn"` 在 SFC 模板中
    // 不会被运行时调用（已知兼容性问题）。改用字符串 ref（模板中 ref="xxx"），
    // 在 onMounted 内通过 vm.$refs.xxx 手动同步到 setup 中的 ref 变量。
    // 这是 Vue 2 + composition-api 下 100% 可靠的 DOM 引用方式。
    const syncDomRefs = () => {
      const proxy = (instance as any)?.proxy
      if (!proxy || !proxy.$refs) return
      tableContainerRef.value = (proxy.$refs.tableContainerEl as HTMLElement) || null
      headBarRef.value = (proxy.$refs.headBarRef as HTMLElement) || null
      paginationRef.value = (proxy.$refs.paginationRef as HTMLElement) || null
      // tbBtnRef 是 TableBtns 组件实例（不是 DOM），useTableResize 通过 .$el.offsetHeight 读高度。
      // 必须同步，否则 tbBtnHeight 永远为 0，导致 tableHeight 多算一个 toolbar 的高度（~40px），
      // 让 el-table 撞穿 .tableContainer 的 overflow:hidden 边界把最后一行裁掉。
      tbBtnRef.value = (proxy.$refs.tbBtnRef as any) || null
      // tableRef 同理 —— 虽然 useTableResize 不直接读它的高度，但 expose 出去的
      // clearSelection / refresh / scrollToRow / toggleSelection 等都依赖它指向真实 el-table 实例。
      tableRef.value = (proxy.$refs.tableRef as any) || null
    }

    // ─── 与 EsForm 的耦合 ─────────────────────
    const bodyFormInstance = inject<(inst: unknown) => void>('bodyFormInstance', () => {})
    const getVisibleShow = inject<(() => boolean) | boolean>('getVisibleShow', false)

    const visibleShow = computed(() =>
      typeof getVisibleShow === 'function' ? getVisibleShow() : getVisibleShow
    )

    const paginationConfig = ref<PaginationConfig>({
      pageSize: 10,
      current: 1,
      total: 0,
      pageSizes: [],
      size: 'small',
      isSmall: true,
      ...props.pagination,
    })

    const formInstance = ref<unknown>(null)

    // ─── 计算属性 ──────────────────────────────
    const getListEntry = computed(() => {
      const eq = props.options.entryQuery
      if (eq && isObject(eq) && Object.keys(eq).length) {
        return eq
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

      if (
        $esPlusTable?.configQueryFieldOutput &&
        typeof $esPlusTable.configQueryFieldOutput === 'function'
      ) {
        const configFields = ($esPlusTable.configQueryFieldOutput as Function)({
          total: 'records',
          pageSize: 'pageSize',
          current: 'pageNo',
          tableData: 'rows',
        })
        if (checkQueryFields(configFields)) return configFields
      }

      return {
        total: 'records',
        pageSize: 'pageSize',
        current: 'pageNo',
        tableData: 'rows',
      }
    })

    /**
     * 探测 default slot 中是否含 EsForm 实例 —— Vue 2 的 $children 模式
     *
     * 与 Vue 3 不同：Vue 2 中 vnode 没有 ctx，需要通过 $children 遍历查找。
     * 这里采用：等待挂载后，在 instance.$children 中找 name === 'EsForm' 的子组件。
     */
    const isFormInstance = computed(() => {
      const proxy = (instance as any)?.proxy
      if (!proxy || !proxy.$children) return {}
      const formChild = proxy.$children.find((child: any) => {
        const n = child?.$options?.name
        return n === 'EsForm'
      })
      if (formChild) {
        formInstance.value = formChild
        bodyFormInstance(formChild)
        // 返回的对象至少要保证 .props.model 可用
        return formChild
      }
      return {}
    })

    const hasDefaultSlot = computed(() => {
      // Vue 2 的 slots 是函数集合，调用后取得 vnode 数组
      const fn = (slots as any).default
      if (typeof fn === 'function') {
        const result = fn()
        return Array.isArray(result) ? result.length > 0 : !!result
      }
      // 兼容老式：$slots 是 vnode 数组
      const vnodes = (slots as any).default
      return Array.isArray(vnodes) && vnodes.length > 0
    })

    const heightType = computed(
      () => (props.options.heightType || 'auto') as 'auto' | 'height' | 'maxHeight'
    )

    const tabHeight = computed(() => {
      if (typeof props.options.tabHeight === 'number') {
        return `${props.options.tabHeight}px`
      }
      if (heightType.value === 'height' && typeof props.options.height === 'number') {
        return `${props.options.height}px`
      }
      return '100%'
    })

    const containerStyle = computed(() => ({
      [heightType.value]: tabHeight.value,
    }))

    const slotStyles = computed(() => {
      if (props.headBarClass) {
        return {
          type: typeof props.headBarClass === 'string' ? 'string' : 'object',
          value: props.headBarClass,
        }
      }
      return { type: 'string', value: '' }
    })

    /** Typed style/class for header bar slot — avoids Vue StyleValue type mismatch in template */
    const slotStyleValue = computed<Record<string, string | number>>(() => {
      const s = slotStyles.value
      if (s.type === 'object' && s.value && typeof s.value === 'object') {
        return s.value as Record<string, string | number>
      }
      return {}
    })
    const slotClassValue = computed<string>(() => {
      const s = slotStyles.value
      return s.type === 'string' ? (s.value as string) : ''
    })

    // ─── 分页布局配置（来自全局 EsTable 配置） ──
    const paginationLayoutConfig = computed(() => {
      const cfg = $esPlusTable?.paginationLayout
      if (!cfg) return null
      return typeof cfg === 'function' ? (cfg as Function)() : cfg
    })

    const layout = computed(
      () =>
        (paginationLayoutConfig.value as any)?.layout ||
        'prev, pager, next, jumper, sizes, ->, total'
    )
    const paginationPageSizes = computed(
      () =>
        (paginationLayoutConfig.value as any)?.pageSizes ||
        paginationConfig.value.pageSizes
    )
    const paginationIsSmall = computed(
      () => (paginationLayoutConfig.value as any)?.isSmall ?? paginationConfig.value.isSmall
    )
    const paginationBackground = computed(
      () => (paginationLayoutConfig.value as any)?.background ?? true
    )
    // prev/next 文字：未配置时返回空字符串，让 el-pagination 渲染默认 ‹/› 箭头
    const paginationPrevText = computed(
      () => ((paginationLayoutConfig.value as any)?.prevText as string) || ''
    )
    const paginationNextText = computed(
      () => ((paginationLayoutConfig.value as any)?.nextText as string) || ''
    )

    const paginationStyle = computed(() => ({
      position: heightType.value === 'height' ? ('absolute' as const) : ('static' as const),
      bottom: '0px',
      left: '0px',
      // z-index 必须高于 element-loading 蒙层（默认 2000），否则请求加载过程中分页会被蒙层遮挡。
      zIndex: 2001,
      background: '#fff',
    }))

    const loadStatus = computed(() => props.options.loading || loadingStatus.value)
    const isRequestConf = computed(
      () =>
        !!props.options.actionUrl ||
        (props.options.apiParams &&
          isObject(props.options.apiParams) &&
          Object.keys(props.options.apiParams).length > 0)
    )

    // ─── 列处理 ────────────────────────────────
    const filteredColumns = computed(() => {
      const list = columnRowList.value.filter((item) => !item.hidCol)
      list.forEach((el) => {
        if (
          el.prop !== 'operate' &&
          el.key !== 'operate' &&
          (el.prop || el.key) &&
          !el.formatter
        ) {
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
              el.btns
                ?.filter((btn: any) => checkPermission(btn.permissionValue))
                .map((btn: any) =>
                  // Element UI text 按钮：type="text" 而非 text 属性
                  h(
                    'el-button',
                    {
                      props: {
                        type: 'text',
                      },
                      attrs: {
                        ...(btn.type ? { 'data-btn-type': btn.type } : {}),
                      },
                      on: {
                        click: () => btn.clickEvent?.(row),
                      },
                    },
                    btn.name
                  )
                ),
            ])
          }
        }
      })

      // 当所有列都设置了固定 width 且没有 minWidth 时，把最后一个非固定列的 width 转为 minWidth
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

    const tableAttrs = computed(() => {
      const merged = columnBindAttr({ ...defaultOptions, ...props.options })
      const { align: _align, ...rest } = merged
      const result: Record<string, unknown> = {}
      for (const key in rest) {
        if (!TABLE_INTERNAL_KEYS.has(key)) {
          result[key] = rest[key]
        }
      }
      // 把 Element Plus 语义的 size（large/default/small）映射到 Element UI v2 语义
      // （medium/small/mini），让两套版本同一份 options 渲染出一致的视觉密度。
      // 详见 packages/vue2/src/utils/size.ts。
      if (result.size !== undefined) {
        const mapped = mapSize(result.size)
        if (mapped !== undefined) {
          result.size = mapped
        }
      }
      // Element UI 的 el-table 懒加载回调 prop 叫 load，但我们的公开 API 用 lazyLoad
      // 与 Vue 3 版本保持一致（el-table-v2 中也是 load）。映射后 el-table 的懒加载行为
      //（loadOrToggle → loadData → 用户提供的 lazyLoad 回调）才能正常工作。
      if (typeof props.options.lazyLoad === 'function') {
        result.load = props.options.lazyLoad
      }
      return result
    })

    // ─── ResizeObserver 自适应高度 ─────────────
    const { tableHeight, resizeObservers } = useTableResize(
      tableContainerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      {
        heightType: heightType.value as 'auto' | 'height',
        tabHeight: props.options.tabHeight,
      }
    )

    // 合并 options + fallthrough attrs，供 el-table 使用
    const tableBindAttrs = computed(() => {
      const result: Record<string, unknown> = { ...tableAttrs.value, ...(attrs as any) }
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

    // ─── 选择逻辑 ──────────────────────────────
    const {
      multipleSelection,
      handleSelectionChange,
      initSelection,
      clearAllSelection: clearAllSelectionInternal,
    } = useTableSelection(props.options.rowkey)

    const handleTableSelectionChange = (val: Record<string, unknown>[]) => {
      handleSelectionChange(val, paginationConfig.value.current || 1)
    }

    // ─── Watchers ─────────────────────────────
    watch(visibleShow, async (val, oldVal) => {
      if (val && val !== oldVal) {
        if (props.options.actionUrl) {
          await httpRequestInstance()
        }
        ;(tableRef.value as any)?.doLayout?.()
      }
    })

    // 兼容性修复：在 Vue 2.6 + @vue/composition-api 下，watch(() => props.pagination, ...)
    // 即使比对相同也会因为父组件 .sync 回传引发 watcher 触发 → 父组件 render watcher 循环。
    // 解决：emit 前先更新 lastPaginationStr，watcher 收到回传时序列化相同则 return。
    let lastPaginationStr = JSON.stringify(props.pagination || {})
    if (props.pagination && Object.keys(props.pagination).length) {
      paginationConfig.value = { ...paginationConfig.value, ...props.pagination }
      showPagination.value = (props.pagination as PaginationConfig).total !== undefined
    }
    /** Emit pagination 更新，并预先记录序列化值以阻断 .sync 回传循环 */
    const emitPaginationUpdate = () => {
      const snapshot = { ...paginationConfig.value }
      lastPaginationStr = JSON.stringify(snapshot)
      emit('update:pagination', snapshot)
    }
    watch(
      () => props.pagination,
      (val: PaginationConfig) => {
        const str = JSON.stringify(val || {})
        if (str === lastPaginationStr) return
        lastPaginationStr = str
        paginationConfig.value = { ...paginationConfig.value, ...val }
        showPagination.value = val.total !== undefined
      }
    )

    // 兼容性修复：移除 deep，仅监听数组引用变化即可触发 selection 重置。
    // .sync 回传相同引用时不会重复触发，避免循环。
    watch(
      () => props.dataSource,
      (val) => {
        initSelection(val, tableRef.value)
      }
    )

    // 兼容性修复：避免 Vue 2.6 + @vue/composition-api 下 .sync 双向绑定循环。
    // 仅在 tableData 引用变化时 emit，去掉 deep；并通过 lastEmittedRef 跳过
    // 「外部 .sync 回传 → props.dataSource 变化 → 内部赋值 → emit 再次回传」的循环。
    let lastEmittedTableData: unknown = null
    watch(tableData, (val) => {
      if (!Array.isArray(val)) return
      if (val === lastEmittedTableData) return
      lastEmittedTableData = val
      emit('update:dataSource', val)
    })

    onMounted(() => {
      // 立即同步一次 vm.$refs 到 setup 中的 ref 变量
      syncDomRefs()
      if (isRequestConf.value && props.options.isInitRun !== false) {
        httpRequestInstance()
      }
      // 等待所有子元素（含 pagination / EsForm）挂载完成后再同步并重算高度。
      nextTick(() => {
        syncDomRefs()
        // eslint-disable-next-line no-unused-expressions
        isFormInstance.value
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            syncDomRefs()
            resizeObservers()
          })
        } else {
          resizeObservers()
        }
      })
    })

    // ─── 请求逻辑 ──────────────────────────────
    const getListenToCallBack = (eventName: string, params: unknown) => {
      const eventNameList = [
        { eventName: 'brcb', isReturn: true },
        { eventName: 'qrcb', isReturn: true },
      ]
      const hasEventNameIndex = eventNameList.findIndex((it) => it.eventName === eventName)
      if (
        props.options.listenToCallBack &&
        (props.options.listenToCallBack as any)[eventName] &&
        hasEventNameIndex !== -1
      ) {
        const callObj = eventNameList[hasEventNameIndex]
        if (callObj.isReturn) {
          return (props.options.listenToCallBack as any)[eventName](params)
        }
      }
    }

    const formatConfigOut = (row: Record<string, unknown>, keyList: string[]) => {
      const cf = configTableField.value as Record<string, unknown>
      if (isObject(cf) && Object.keys(cf).length) {
        // 累积所有 pagination 字段更新，最后一次性整体替换 paginationConfig.value，
        // 避免直接 paginationConfig.value[key] = x 触发多次 setter / 多轮渲染。
        const paginationPatch: Record<string, unknown> = {}
        Object.entries(cf).forEach(([key, value]) => {
          const isKeyUsed = keyList.includes(key)
          if (!isKeyUsed) return

          const rowData = row[value as string] ?? findValueByKey(row, value as string)
          if (key === 'tableData') {
            tableData.value = Array.isArray(rowData) ? rowData : []
          } else {
            paginationPatch[key] =
              typeof rowData === 'number' ? rowData : parseInt(rowData as string, 10) || 0
          }
        })
        if (Object.keys(paginationPatch).length) {
          paginationConfig.value = { ...paginationConfig.value, ...paginationPatch }
        }
      }
    }

    const queryTableListMethod = (
      params: Record<string, unknown>,
      options: {
        success?: (res: Record<string, unknown>) => void
        fail?: (err: unknown) => void
      } = {}
    ) => {
      const { success, fail } = options
      const apiParams = (props.options?.apiParams || {}) as Record<string, any>
      const url = props.options?.actionUrl || apiParams.url || ''

      if (!url || !Object.keys(apiParams).length) return

      // Vue 2 中响应式对象天然是 plain object，无需 toRaw / unref
      const formObj = isFormInstance.value as any
      const formData =
        formObj && formObj.props && formObj.props.model
          ? { ...formObj.props.model }
          : getListEntry.value || {}

      const fnParams = getListenToCallBack('brcb', {
        ...formData,
        ...params,
        ...(apiParams.model || {}),
      })
      const finalParams = isObject(fnParams)
        ? fnParams
        : { ...formData, ...(apiParams.model || {}), ...params }
      const requestOption = { ...(apiParams.options || {}) }
      if (apiParams?.method) {
        requestOption.method = apiParams?.method
      }

      const requestHandler = async (requestFn: Function) => {
        if (loadingStatus.value) return
        loadingStatus.value = true
        try {
          const res = await requestFn({
            url,
            formParams: finalParams,
            headers: apiParams.headers || {},
            ...requestOption,
            ...params,
          })
          const responseData = getListenToCallBack('qrcb', res) || res
          if (
            isObject(res) &&
            Object.keys(res as object).length &&
            typeof success === 'function'
          ) {
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
        requestHandler(props.options.httpRequest as Function)
      } else if ($esPlusTable.$httpRequest) {
        requestHandler($esPlusTable.$httpRequest as Function)
      }
    }

    const httpRequestInstance = (model?: Record<string, unknown>) => {
      return new Promise((resolve, reject) => {
        paginationConfig.value = { ...paginationConfig.value, current: 1 }
        queryTableListMethod(
          {
            ...(model || {}),
            pageIndex: paginationConfig.value.current,
            pageSize: paginationConfig.value.pageSize,
          },
          {
            success: (res) => {
              formatConfigOut(res, ['total', 'tableData'])
              if (Object.keys(props.pagination).length) {
                emitPaginationUpdate()
              }
              resolve(res)
            },
            fail: (err) => {
              reject(err)
            },
          }
        )
      })
    }

    const changePageIndexRequest = () => {
      queryTableListMethod(
        {
          pageIndex: paginationConfig.value.current,
          pageSize: paginationConfig.value.pageSize,
        },
        {
          success: (res) => {
            formatConfigOut(res, ['total', 'tableData'])
            emitPaginationUpdate()
            emit('pagination-current-change', paginationConfig.value)
          },
        }
      )
    }

    const changePageSizeRequest = () => {
      queryTableListMethod(
        {
          pageIndex: paginationConfig.value.current,
          pageSize: paginationConfig.value.pageSize,
        },
        {
          success: (res) => {
            formatConfigOut(res, ['total', 'tableData'])
            emitPaginationUpdate()
          },
        }
      )
    }

    const handleSizeChange = (size: number) => {
      paginationConfig.value = { ...paginationConfig.value, pageSize: size, current: 1 }
      if (isRequestConf.value) {
        changePageSizeRequest()
      } else {
        emitPaginationUpdate()
        emit('size-change', paginationConfig.value, size)
      }
    }

    const handleIndexChange = (val: number) => {
      paginationConfig.value = { ...paginationConfig.value, current: val }
      if (isRequestConf.value) {
        changePageIndexRequest()
      } else {
        emitPaginationUpdate()
        emit('pagination-current-change', paginationConfig.value)
      }
    }

    const changeTableSort = (column: Record<string, unknown>) => {
      emit('change-table-sort', column)
    }

    // ─── 提供给子组件的实例 ────────────────────
    provide('getTableInstantce', () => ({
      tableRef,
      toggleSelection: (rows: Record<string, unknown>[]) => {
        if (rows) {
          rows.forEach((row) => {
            ;(tableRef.value as any)?.toggleRowSelection?.(row)
          })
        } else {
          ;(tableRef.value as any)?.clearSelection?.()
        }
      },
      clearAllSelection: () => clearAllSelectionInternal(tableRef.value),
      refsInstance: () => tableRef.value,
      httpRequestInstance,
    }))

    // ─── 暴露方法（Vue 2 通过 expose 或 return） ──
    const exposed = {
      httpRequestInstance,
      getSelectionRows: () => multipleSelection.value,
      clearSelection: () => (tableRef.value as any)?.clearSelection?.(),
      clearAllSelection: () => clearAllSelectionInternal(tableRef.value),
      refresh: () => (tableRef.value as any)?.doLayout?.(),
      // virtual 滚动占位（保持 API 一致，Vue 2 版本无效）
      scrollToRow: (_row: number) => {
        // noop in Vue 2 + Element UI
      },
    }

    if (typeof expose === 'function') {
      expose(exposed)
    }

    return {
      // refs
      tableRef,
      tbBtnRef,
      headBarRef,
      paginationRef,
      tableId,
      tableData,
      effectiveDataSource,
      // state
      loadStatus,
      paginationConfig,
      formInstance,
      // computeds
      filteredColumns,
      tableBindAttrs,
      hasDefaultSlot,
      heightType,
      tabHeight,
      slotStyles,
      slotStyleValue,
      slotClassValue,
      slotState,
      showPagination,
      containerStyle,
      paginationStyle,
      layout,
      paginationPageSizes,
      paginationIsSmall,
      paginationBackground,
      paginationPrevText,
      paginationNextText,
      // handlers
      handleTableSelectionChange,
      changeTableSort,
      handleSizeChange,
      handleIndexChange,
      // exposed methods (also accessible via $refs.tableRef.xxx in Vue 2)
      ...exposed,
      instance,
      resizeObservers,
    }
  },
})
</script>

<style lang="scss" scoped>
.el-dp_tables {
  height: auto;
  ::v-deep(.el-table__body-wrapper) {
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

    ::v-deep(.el-form-item--small .el-form-item__label) {
      box-sizing: border-box;
    }
  }
}

.tableContainer {
  border-radius: 0px;
  flex: 1;
  // flex 子项默认 min-height: auto（= min-content）会拒绝收缩到比内容还小，
  // 导致表单展开时 el-table prop height 还没更新的那 1-2 帧里
  // .tableContainer 被旧表格内容撑高，把分页栏推出视口然后回弹 —— 视觉上分页栏在跳。
  // min-height:0 + overflow:hidden 让 .tableContainer 严格服从 flex 分配的尺寸，
  // 内部表格尺寸暂时偏大时被裁住而不影响外部布局，分页栏全程稳定。
  min-height: 0;
  overflow: hidden;
  width: 100%;
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: flex-start;

  .table_inner_containers {
    width: 100%;
  }

  ::v-deep(.el-table__empty-block) {
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

  ::v-deep(.el-tag) {
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
