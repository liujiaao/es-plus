/**
 * ADV 表格选择适配 — 完全对齐 @es-plus/vue3 逻辑
 *
 * 关键差异：
 * - vue3 使用 el-table 的命令式 API (toggleRowSelection/clearSelection)
 * - ADV 使用 rowSelection 声明式配置
 *
 * 跨页选择累积逻辑复用 @es-plus/core applySelectionChange，消除维护偏离副本。
 * ADV 专有状态（selectedRowKeys / rowSelection / toggleRowSelection / setCurrentPage）保持不变。
 */
import { ref, nextTick, computed, unref, type Ref } from 'vue'
import {
  createSelectionState,
  applySelectionChange,
} from '@es-plus/core'

// 无 rowkey 调用 toggleRowSelection 的一次性开发告警标记（模块级，避免刷屏）
let warnedNoRowkeyToggle = false

// 支持原始字符串 / ref / getter：每次调用时读取最新 rowkey，
// 避免运行期切换 options.rowkey 后内部仍用旧键（对齐 vue3 的 rowkey 运行期快照修复）。
type RowkeyInput = string | Ref<string | undefined> | (() => string | undefined)

export function useTableSelection(rowkey?: RowkeyInput, cachePageSelection: boolean = true) {
  const getRowkey = (): string | undefined =>
    typeof rowkey === 'function' ? rowkey() : unref(rowkey as string | Ref<string | undefined>)

  const state = createSelectionState()
  const multipleSelection = ref<Record<string, unknown>[]>([])
  const selectionsByPage = ref<Record<number, Record<string, unknown>[]>>({})
  const isInitChange = ref(false)

  // ─── ADV 声明式选择状态（对外给 a-table 的 :rowSelection 使用） ──
  const selectedRowKeys = ref<(string | number)[]>([])
  const currentPage = ref(1)
  const setCurrentPage = (page: number) => { currentPage.value = page }

  const sync = () => {
    multipleSelection.value = [...state.multipleSelection]
    selectionsByPage.value = { ...state.selectionsByPage }
    isInitChange.value = state.isInitChange
    const rk = getRowkey()
    if (rk) {
      selectedRowKeys.value = state.multipleSelection.map((r) => r[rk] as string | number)
    }
  }

  /**
   * ADV 声明式 rowSelection 配置
   */
  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    preserveSelectedRowKeys: cachePageSelection,
    onChange: (keys: (string | number)[], rows: Record<string, unknown>[]) => {
      handleSelectionChange(rows, currentPage.value)
    },
  }))

  /**
   * 选择变化处理 — 跨页累积逻辑复用 core applySelectionChange
   */
  const handleSelectionChange = (val: Record<string, unknown>[], page: number) => {
    const rk = getRowkey()
    applySelectionChange(state, val, page, rk, cachePageSelection)
    sync()
    if (!rk) {
      // 无 rowkey 时 selectedRowKeys 退化为当前页 id/key
      selectedRowKeys.value = val.map((r) => r.id || r.key || Object.values(r)[0]) as (string | number)[]
    }
  }

  /**
   * 页面切换后恢复选中状态 — selectedRowKeys 已是全量 key，
   * ADV preserveSelectedRowKeys 自动保持跨页选中。
   * 此处仅合并当前页命中行到 selectedRowKeys（对齐 vue3 toggleRowSelection 追加语义）。
   */
  const handleSelectData = (dataList: Record<string, unknown>[], _tableRef: unknown) => {
    const currentSelection = multipleSelection.value
    const rk = getRowkey()
    if (dataList?.length && rk && cachePageSelection && currentSelection.length) {
      const pageKeys = new Set(
        dataList
          .filter((row) => currentSelection.some((s) => s[rk] === row[rk]))
          .map((row) => row[rk] as string | number),
      )
      const merged = new Set(selectedRowKeys.value)
      pageKeys.forEach((k) => merged.add(k))
      selectedRowKeys.value = Array.from(merged)
    }
  }

  /**
   * 清除全部选择（含跨页缓存）
   */
  const clearAllSelection = (_tableRef?: unknown) => {
    state.multipleSelection = []
    state.selectionsByPage = {}
    state.isInitChange = false
    selectedRowKeys.value = []
    sync()
  }

  /**
   * 清除选择（对齐 vue3 clearSelection 清空语义：视觉 + 数据全清）
   */
  const clearSelection = () => {
    state.multipleSelection = []
    state.selectionsByPage = {}
    selectedRowKeys.value = []
    multipleSelection.value = []
    selectionsByPage.value = {}
  }

  /**
   * 切换行选中状态（同步 multipleSelection，保证 getSelectionRows 一致）
   */
  const toggleRowSelection = (row: Record<string, unknown>, selected?: boolean) => {
    const rk = getRowkey()
    if (!rk) {
      // ant-design-vue 的选择是基于 rowKey 的（selectedRowKeys），无 rowkey 无法定位行——
      // 与 vue3/vue2（el-table 基于行对象的原生命令）不同，此处只能 no-op。
      // 开发期一次性告警，使这一框架约束可见（生产构建静默）。
      if (
        !warnedNoRowkeyToggle &&
        !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
      ) {
        warnedNoRowkeyToggle = true
        // eslint-disable-next-line no-console
        console.warn(
          '[@es-plus/adapter-antdv] toggleRowSelection 需要配置 rowkey 才能生效' +
            '（ant-design-vue 的行选择基于 rowKey）；未配置 rowkey 时此调用被忽略。',
        )
      }
      return
    }
    const key = row[rk] as string | number
    const exists = selectedRowKeys.value.includes(key)
    const shouldSelect = selected === undefined ? !exists : selected
    if (shouldSelect && !exists) {
      selectedRowKeys.value = [...selectedRowKeys.value, key]
      if (!state.multipleSelection.some((r) => r[rk] === key)) {
        state.multipleSelection = [...state.multipleSelection, row]
        multipleSelection.value = [...state.multipleSelection]
      }
    } else if (!shouldSelect && exists) {
      selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== key)
      state.multipleSelection = state.multipleSelection.filter((r) => r[rk] !== key)
      multipleSelection.value = [...state.multipleSelection]
    }
  }

  /**
   * 初始化选择状态 — 数据变化时调用
   */
  const initSelection = (dataList: Record<string, unknown>[]) => {
    // Only flip the guard flag — do NOT sync (which would wipe multipleSelection.value)
    state.isInitChange = true
    isInitChange.value = true
    const rk = getRowkey()
    if (rk && cachePageSelection) {
      nextTick(() => {
        handleSelectData(dataList, null)
        state.isInitChange = false
        isInitChange.value = false
      })
    } else {
      nextTick(() => {
        selectedRowKeys.value = []
        state.isInitChange = false
        isInitChange.value = false
      })
    }
  }

  return {
    multipleSelection,
    selectionsByPage,
    isInitChange,
    // ADV 声明式配置
    rowSelection,
    selectedRowKeys,
    currentPage,
    setCurrentPage,
    // 命令式 API（与 vue3 版本完全兼容）
    handleSelectionChange,
    handleSelectData,
    clearAllSelection,
    clearSelection,
    toggleRowSelection,
    initSelection,
  }
}
