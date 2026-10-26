<template>
  <div v-if="!vxeAvailable" style="padding: 16px; color: #f56c6c; border: 1px solid #fbc4c4; border-radius: 4px;">
    [es-plus] engine:'vxe' 需要先安装并注册 vxe-table：<br>
    <code>import VxeTable from 'vxe-table'; Vue.use(VxeTable)</code>
  </div>
  <!-- inheritAttrs:false + v-on="vxeOnListeners" 透传 vxeOn 配置式事件 + $attrs 透传 -->
  <vxe-grid
    v-else
    ref="gridRef"
    v-bind="Object.assign({}, gridConfig, $attrs)"
    v-on="vxeOnListeners"
    :columns="adaptedColumns"
    :data="dataSource"
    @checkbox-change="handleCheckboxChange"
    @checkbox-all="handleCheckboxAll"
    @sort-change="handleSortChange"
    @cell-click="handleCellClick"
    @cell-dblclick="handleCellDblclick"
    @row-contextmenu="handleRowContextmenu"
  >
    <!-- render 函数列：动态插槽分发（M-2: Map v-for 改为数组 entries） -->
    <template v-for="entry in renderSlotEntries" v-slot:[entry.name]="{ row, rowIndex }">
      <render-dom-tb
        :key="entry.name"
        :render="entry.col.render"
        :row="row"
        :index="rowIndex"
        :data-key="entry.col.prop || entry.col.key || ''"
      />
    </template>
    <!-- 用户具名插槽透传（M-3: RenderSlotBridge 替代 <component :is="fn">） -->
    <template v-for="(slotFn, slotName) in namedParentSlots" v-slot:[slotName]="slotProps">
      <render-slot-bridge :key="slotName" :slot-fn="slotFn" :slot-props="normalizeSlotProps(slotProps)" />
    </template>
    <!-- 默认空数据 UI -->
    <template v-if="!namedParentSlots['empty']" v-slot:empty>
      <div style="display:flex;justify-content:center;align-items:center;min-height:60px;color:#909399;font-size:14px">
        {{ options.emptyText || '暂无数据' }}
      </div>
    </template>
  </vxe-grid>
</template>

<script lang="ts">
// 等 API 在 TypeScript 严格模式下无法完整类型化，保留 nocheck 以避免误报
import { defineComponent, ref, computed, inject, getCurrentInstance } from '../../../vue-compat'
import type { CellEditPayload, TableColumn, TableOptions, TableEngineExposed } from '@es-plus/core'
import { getGlobalConfig, buildFirstClassGridOptions, buildRowSpanMethod, resolveMergeConfig, resolveSortParam, wantsCrossPageSelection, mergeSelectedRows, resolveEditProp, snapshotEditRow, diffEditRow } from '@es-plus/core'
import RenderDomTb, { RenderSlotBridge } from './render-dom-tb'
import { useVxeColumnAdapter } from './use-vxe-column-adapter'
  import type { RenderSlotColumn } from './use-vxe-column-adapter'

export default defineComponent({
  name: 'VxeEngineVue2',
  inheritAttrs: false,
  components: { RenderDomTb, RenderSlotBridge },
  props: {
    columns: {
      type: Array as () => TableColumn[],
      required: true,
    },
    dataSource: {
      type: Array as () => Record<string, unknown>[],
      default: () => [],
    },
    tableHeight: {
      type: Number,
      default: undefined,
    },
    options: {
      type: Object as () => TableOptions,
      required: true,
    },
    parentSlots: {
      type: Object as () => Record<string, (...args: any[]) => any>,
      default: () => ({}),
    },
  },
  emits: ['sort-change', 'selection-change', 'row-click', 'row-dblclick', 'row-contextmenu', 'cell-edit'],
  setup(props, { emit, expose }) {
    const gridRef = ref(null)

    const esPlus = inject('$EsPlus', null) ?? getGlobalConfig() ?? {}
    const tFn = computed(() => (esPlus as any).t || undefined)

    // 跨页保留勾选：判据收敛到 core 的 wantsCrossPageSelection（与 el-table 路径同口径：
    // multiSelect 与显式 type:'selection' 列等价，cachePageSelection:false 一律关闭）。
    const crossPageSelection = computed(() =>
      wantsCrossPageSelection(props.options, props.columns as { type?: string }[])
    )

    // L3: 仅在开发环境输出 rowkey 缺失警告，避免生产环境无效日志
    if (process.env.NODE_ENV !== 'production' && crossPageSelection.value && !props.options.rowkey) {
      // eslint-disable-next-line no-console
      console.warn(
        '[es-plus] engine:"vxe" + 多选 建议设置 options.rowkey，' +
        '否则 vxe 无法通过 reserve 跨页保留已选行（当前默认以 "id" 字段作为 rowId）'
      )
    }

    // M-1: vxe-table 可用性检测
    // vm.$options.components 包含局部注册组件，但全局注册（Vue.use/Vue.component）最可靠路径
    // 是 vm.constructor.options.components（Vue 2 全局选项合并时写入）
    const vxeAvailable = computed(() => {
      try {
        const proxy = (getCurrentInstance() as any)?.proxy
        if (!proxy) return false
        // 优先检查 Vue 构造器全局选项（最可靠）
        const ctorComps: Record<string, any> = (proxy.constructor as any)?.options?.components || {}
        if (ctorComps['vxe-grid'] || ctorComps['VxeGrid']) return true
        // 兼容局部注册（组件 components:{} 声明）
        const localComps: Record<string, any> = proxy.$options?.components || {}
        if (localComps['vxe-grid'] || localComps['VxeGrid']) return true
        // 兜底：遍历父组件链（多 Vue 实例树场景）
        let parent = proxy.$parent
        while (parent) {
          const pComps: Record<string, any> = parent.$options?.components || {}
          if (pComps['vxe-grid'] || pComps['VxeGrid']) return true
          parent = parent.$parent || null
        }
        return false
      } catch {
        return false
      }
    })

    // ─── 列适配 ───────────────────────────────────────────────────
    const columnsRef = computed(() => props.columns)
    // P3: options 作为 computed ref 传入，保证 multiSelect/snIndex/expand 变更能触发列重算
    const optionsRef = computed(() => props.options)
    const { adaptedColumns, renderSlotMap } = useVxeColumnAdapter(
      columnsRef,
      optionsRef,
      tFn.value,
    )

    // M-2: Vue 2 模板不支持 Map v-for 数组解构，转换为普通对象数组
    const renderSlotEntries = computed(() => {
      const entries: Array<{ name: string; col: RenderSlotColumn }> = []
      renderSlotMap.value.forEach((col, name) => {
        entries.push({ name, col })
      })
      return entries
    })

    // ─── 具名插槽过滤 ───────────────────────────────────────────
    const namedParentSlots = computed(() => {
      const result: Record<string, (...args: any[]) => any> = {}
      const parentSlots = props.parentSlots || {}
      const usedByRenderMap = new Set(renderSlotMap.value.keys())
      for (const [name, fn] of Object.entries(parentSlots)) {
        if (name !== 'default' && !usedByRenderMap.has(name)) result[name] = fn
      }
      return result
    })

    // 统一自定义插槽 scope 形状（对齐 vue3/antdv）：vxe 原生无 scope/value，补上保持一致
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

    // ─── vxeOn 配置式事件注入（Vue 2：通过 v-on 对象传递，不是 onXxx props）
    // 行内编辑的两个原生事件在这里**串起来**：用户 vxeOn 里的 handler 先跑（逃生舱语义：
    // 原样载荷），随后的 handler 拍快照 / 比一遍并 emit 归一的 `cell-edit`。
    // 不用模板 `@edit-*`：Vue 2 的 `v-on="obj"` 与具名监听同键时会互相覆盖，
    // 而 Vue 3 的 mergeProps 会把同名 onXxx 合成数组（两端行为不同，见各端注释）。
    const vxeOnListeners = computed(() => {
      const opts = props.options as any
      const vxeOn = (opts.vxeOn || {}) as Record<string, Function>
      const chain = (ours: (params: any) => void, theirs?: unknown) => (params: any) => {
        try {
          if (typeof theirs === 'function') (theirs as (p: any) => void)(params)
        } finally {
          ours(params)
        }
      }
      return {
        ...vxeOn,
        'edit-actived': chain(handleEditActived, vxeOn['edit-actived']),
        'edit-closed': chain(handleEditClosed, vxeOn['edit-closed']),
      }
    })

    // ─── vxe-grid 配置映射（v3 API 与 v4 的差异见注释）────────────
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
        // 高度语义对齐 el-table：仅 heightType:'height' 传固定高度，'maxHeight' 传最大高度，
        // 默认 'auto' 两者皆 undefined —— 让 vxe-grid 按内容自适应，不再强塞 useTableResize 的
        // 兜底值（auto 模式下 ResizeObserver 直接 return，tableHeight 恒为 400，会导致表体被
        // 锁死 400px + scrollY 空白，即 #3 高度适配 / #6 逃生舱空白的根因）。
        height: opts.heightType === 'height' ? (props.tableHeight || undefined) : undefined,
        maxHeight: opts.heightType === 'maxHeight' ? (props.tableHeight || undefined) : undefined,
        keepSource: opts.keepSource === false ? false : !!(opts.editConfig || opts.keepSource),
        // ── vxe 3.22 API：rowConfig.keyField / isCurrent 替代已废弃的 rowId / highlightCurrentRow ──
        // （旧顶层属性仍可用但每次渲染都打印 deprecated 警告，改用 rowConfig 消除控制台噪音）
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

      // ── opts.spanMethod → vxe v3 spanMethod（v4 中为 mergeMethod）─
      if (opts.spanMethod) {
        base.spanMethod = ({ row, rowIndex, column, columnIndex }: any) => {
          const shimmedCol = column ? { ...column, property: column.field ?? column.property } : column
          const res = opts.spanMethod({ row, rowIndex, column: shimmedCol, columnIndex })
          if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
          return res || { rowspan: 1, colspan: 1 }
        }
      } else {
        // 合并单元格（AI-23）：声明式 mergeConfig → vxe spanMethod，复用同一 core 闭包。
        const mergeCfg = resolveMergeConfig(opts)
        if (mergeCfg) {
          const spanFn = buildRowSpanMethod(mergeCfg.rowsBy, props.dataSource as Record<string, unknown>[])
          base.spanMethod = ({ row, rowIndex, column, columnIndex }: any) => {
            const shimmedCol = column ? { ...column, property: column.field ?? column.property } : column
            const res = spanFn({ row, rowIndex, column: shimmedCol, columnIndex })
            if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
            return res || { rowspan: 1, colspan: 1 }
          }
        }
      }

      // ── vxe v3 API：rowClassName/rowStyle 为顶层属性（v4 中在 rowConfig 内）──
      if (opts.rowClassName) {
        base.rowClassName = ({ row, rowIndex }: any) =>
          typeof opts.rowClassName === 'function'
            ? opts.rowClassName({ row, rowIndex })
            : (opts.rowClassName || '')
      }
      if (opts.rowStyle) {
        base.rowStyle = ({ row, rowIndex }: any) =>
          typeof opts.rowStyle === 'function'
            ? opts.rowStyle({ row, rowIndex })
            : opts.rowStyle
      }

      // ── vxe v3 API：headerCellStyle/headerCellClassName 为顶层属性（v4 中在 headerCellConfig 内）──
      // 注意：vxe 表头竖线/底线是画在 .vxe-header--column 的 background-image(linear-gradient) 上，
      // 默认背景必须用 backgroundColor（而非 background 简写）——background 简写会把 background-image
      // 一并重置为 none，导致表头竖线消失（#5，表体不受影响因为未注入 cellStyle）。
      const effectiveHeaderStyle = opts.headerCellStyle !== undefined ? opts.headerCellStyle : { backgroundColor: '#f5f7fa' }
      if (effectiveHeaderStyle) {
        base.headerCellStyle = typeof effectiveHeaderStyle === 'function'
          ? ({ column, columnIndex }: any) => (effectiveHeaderStyle as Function)({ column, columnIndex })
          : effectiveHeaderStyle
      }
      if (opts.headerCellClassName) {
        base.headerCellClassName = typeof opts.headerCellClassName === 'function'
          ? ({ column, columnIndex }: any) => (opts.headerCellClassName as Function)({ column, columnIndex })
          : opts.headerCellClassName
      }

      // ── vxe v3 API：cellStyle/cellClassName 为顶层属性（v4 中在 cellConfig 内）──
      if (opts.cellStyle) {
        base.cellStyle = typeof opts.cellStyle === 'function'
          ? ({ row, rowIndex, column, columnIndex }: any) =>
              (opts.cellStyle as Function)({ row, rowIndex, column, columnIndex })
          : opts.cellStyle
      }
      if (opts.cellClassName) {
        base.cellClassName = typeof opts.cellClassName === 'function'
          ? ({ row, rowIndex, column, columnIndex }: any) =>
              (opts.cellClassName as Function)({ row, rowIndex, column, columnIndex })
          : opts.cellClassName
      }

      // ── defaultSort → vxe sortConfig.defaultSort ──────────────
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

      // ── 一等公民 API（合计行/行内编辑/导出/工具栏/列宽/键盘/鼠标/剪贴板/校验）──
      const firstClass = buildFirstClassGridOptions(opts)
      if (firstClass.columnConfig) {
        base.columnConfig = { ...(base.columnConfig || {}), ...(firstClass.columnConfig as Record<string, unknown>) }
        delete firstClass.columnConfig
      }
      Object.assign(base, firstClass)

      // ── vxeConfig 逃生舱（深合并，后写优先）──────────────────
      for (const [k, v] of Object.entries(vxeExtra)) {
        if (k === 'pagerConfig') continue
        const DEEP_MERGE_KEYS = ['checkboxConfig', 'sortConfig', 'columnConfig', 'editConfig', 'keyboardConfig', 'mouseConfig', 'rowConfig']
        if (DEEP_MERGE_KEYS.includes(k) && base[k] && typeof v === 'object') {
          base[k] = { ...base[k], ...v }
        } else {
          base[k] = v
        }
      }

      return base
    })

    // ─── 行内编辑会话 → `cell-edit` ──────────────────────────────
    // vxe 的 edit-closed 只给 `{ row, column }`：没有旧值，字段名还埋在 column.property 里。
    // 「进会话拍快照、出会话比一遍」的判定在 core/table-edit.ts（三端同一份）。
    // vxe 同一时刻只有一个 actived 单元格/行，一个会话槽足够；不进模板，故不用 ref。
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

    // ─── 事件处理 ───────────────────────────────────────────────
    // selection-change 只带当前页（与 el-table / a-table / 虚拟引擎、以及三站文档一致：
    // 「当前页选中行；跨页全集用 getSelectionRows() 取」）。vxe 的 reserves 是其它页
    // 保留的行，塞进事件会让同一个事件在不同引擎下语义不同。
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

    // ─── 标准接口实现（TableEngineExposed）─────────────────────
    // grid 只代理 tableComponentMethodKeys 白名单中的方法，
    // 行内编辑 CRUD（getUpdateRecords/clearEdit 等）不在其内，
    // 需要通过 getRefMaps().refTable 获取内部 <vxe-table> 实例直接调用
    const getInternalTable = () => {
      const refTable = (gridRef.value as any)?.getRefMaps?.()?.refTable
      return refTable?.value ?? refTable
    }

    const exposed: TableEngineExposed = {
      getTableRef: () => (gridRef.value as any),
      doLayout: () => (gridRef.value as any)?.recalculate?.(true),
      toggleRowSelection: (row, selected) => {
        (gridRef.value as any)?.setCheckboxRow?.(row, selected !== false)
      },
      // clearCheckboxRow 只清「当前表格数据」；reserve 里其它页的行得单独清，
      // 否则用户点「清空」后翻回上一页，那些行会被 reserve 重新勾上（实测 reserves 仍为 [1]）。
      clearSelection: () => {
        (gridRef.value as any)?.clearCheckboxRow?.()
        ;(gridRef.value as any)?.clearCheckboxReserve?.()
      },
      // 当前数据已选 + 跨页保留（getCheckboxRecords 只覆盖当前数据，reserve 行会漏）
      getSelectedRows: () => mergeSelectedRows(
        (gridRef.value as any)?.getCheckboxRecords?.(),
        (gridRef.value as any)?.getCheckboxReserveRecords?.(),
        props.options.rowkey || 'id'
      ),
      scrollToRow: (rowIndex: number) => {
        const row = props.dataSource[rowIndex]
        if (row) (gridRef.value as any)?.scrollToRow?.(row)
      },
      vxeInstance: () => (gridRef.value as any),

      // ── 行内编辑 CRUD（调用内部 <vxe-table> 实例）──────
      clearActived: () => getInternalTable()?.clearActived?.(),
      clearValidate: () => getInternalTable()?.clearValidate?.(),
      validate: (rows?: Record<string, unknown>[]) => getInternalTable()?.validate?.(rows),
      getInsertRecords: () => getInternalTable()?.getInsertRecords?.() ?? [],
      getUpdateRecords: () => getInternalTable()?.getUpdateRecords?.() ?? [],
      getRemoveRecords: () => getInternalTable()?.getRemoveRecords?.() ?? [],
      revertData: (rows?: Record<string, unknown> | Record<string, unknown>[]) =>
        getInternalTable()?.revertData?.(rows),

      // vxe4 的 <vxe-grid> 只代理 tableComponentMethodKeys 白名单（不含 print/exportData/getPrintHtml）；
      // vxe3 代理全部 table 方法，这里统一下沉到内部 <vxe-table>，三端行为一致。
      exportData: (opts?: any) => getInternalTable()?.exportData?.(opts),
      print: (opts?: any) => getInternalTable()?.print?.(opts),
      getPrintHtml: (opts?: any) => getInternalTable()?.getPrintHtml?.(opts),
    }

    if (typeof expose === 'function') {
      expose(exposed)
    }

    return {
      gridRef,
      vxeAvailable,
      gridConfig,
      vxeOnListeners,
      adaptedColumns,
      renderSlotMap,
      renderSlotEntries,
      namedParentSlots,
      normalizeSlotProps,
      handleCheckboxChange,
      handleCheckboxAll,
      handleSortChange,
      handleCellClick,
      handleCellDblclick,
      handleRowContextmenu,
      ...exposed,
    }
  },
})
</script>
