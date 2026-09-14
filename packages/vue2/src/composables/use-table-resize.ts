/**
 * EsTable 容器尺寸自适应 composable —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异：
 *   - ref/nextTick/onMounted/onBeforeUnmount 来自 './vue-compat'
 *   - 业务逻辑 100% 一致（只是 Vue API 来源不同）
 *
 * 核心思路：通过 ResizeObserver 监听表格容器及表头按钮区高度，动态计算 el-table 的 height/maxHeight，
 * 让表格在 height 模式下分页固定贴底、在 auto 模式下随内容自适应。
 */

import { ref, nextTick, watch, unref, onMounted, onBeforeUnmount } from '../vue-compat'
import type { Ref } from '../vue-compat'

/**
 * 兼容三种入参：原始值、ref/computed、getter。
 * 与 vue3 对齐：用 unref 读取，使 options 以响应式传入时运行期修改即时生效。
 */
type MaybeRefLike<T> = T | Ref<T> | (() => T)

function readOption<T>(value: MaybeRefLike<T> | undefined): T | undefined {
  if (typeof value === 'function') return (value as () => T)()
  return unref(value as Ref<T> | T) as T
}

export function useTableResize(
  tableContainerRef: { value: HTMLElement | null },
  headBarRef: { value: HTMLElement | null },
  tbBtnRef: { value: { $el?: HTMLElement } | null },
  paginationRef: { value: HTMLElement | null },
  options: {
    heightType?: MaybeRefLike<'auto' | 'height' | 'maxHeight'>
    tabHeight?: MaybeRefLike<number | string | undefined>
  }
) {
  const tableHeight = ref(400)
  const observer = ref<ResizeObserver | null>(null)

  const isNegative = (num: number) => Math.sign(num) === -1

  // 每次调用时读取，保证运行期改 options（传入 ref/computed/getter 时）即时生效，而非快照旧值。
  const getHeightType = () => readOption(options.heightType)
  const getTabHeight = () => readOption(options.tabHeight)

  const totalContainerNum = () => {
    const headBarHeight = headBarRef.value?.offsetHeight || 0
    const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
    const paginationHeight = paginationRef.value?.offsetHeight || 0
    return Math.round(paginationHeight + headBarHeight + tbBtnHeight)
  }

  /**
   * 读取父容器可用于布局子元素的高度（即"内容区"高度）。
   *
   * `offsetHeight` 包含 padding + border + 滚动条；直接拿来当 .table_component 的
   * 可用空间，会让 es-table 撑出父容器的内容区，挤进父级 padding 甚至越过父级边界。
   *
   * `clientHeight` = padding + content（不含 border / 滚动条），再扣掉上下 padding 即为
   * 真实可放子元素的高度。fallback 到 offsetHeight - 上下 border 也行，但 clientHeight
   * 已自动排除 border，更直接。
   */
  const getParentContentHeight = (parent: HTMLElement | null | undefined): number => {
    if (!parent) return 0
    const cs = typeof window !== 'undefined' ? window.getComputedStyle(parent) : null
    const paddingTop = cs ? parseFloat(cs.paddingTop) || 0 : 0
    const paddingBottom = cs ? parseFloat(cs.paddingBottom) || 0 : 0
    const inner = parent.clientHeight - paddingTop - paddingBottom
    return inner > 0 ? inner : parent.clientHeight || parent.offsetHeight || 0
  }

  const resizeObservers = () => {
    const element = tableContainerRef.value
    if (!element) return

    const heightType = getHeightType()
    const tabHeight = getTabHeight()

    const containerHeight =
      typeof tabHeight === 'number'
        ? tabHeight
        : heightType === 'height'
          ? getParentContentHeight(element.parentElement) || element.offsetHeight
          : parseInt(tabHeight as string, 10) || 450

    const maxContainer = !isNaN(containerHeight) ? containerHeight : 450
    const minTableNum = maxContainer - totalContainerNum()
    const tabContainer = isNegative(minTableNum) ? totalContainerNum() + 300 : maxContainer

    const paginationHeight = paginationRef.value?.offsetHeight || 0
    const headBarHeight = headBarRef.value?.offsetHeight || 0
    const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0

    const newHeight =
      Math.floor(tabContainer) - Math.round(paginationHeight + headBarHeight + tbBtnHeight)
    if (tableHeight.value !== newHeight) {
      tableHeight.value = newHeight
    }
  }

  const startObserver = () => {
    nextTick(() => {
      // 幂等：先断开可能仍存在的旧 observer，避免 deferred start 叠加导致重复观察 / 泄漏
      if (observer.value) {
        observer.value.disconnect()
        observer.value = null
      }
      if (!tableContainerRef.value || typeof ResizeObserver === 'undefined') return

      // heightType === 'auto' 时 tableHeight 不绑定到 el-table（tableBindAttrs
      // 仅在 height/maxHeight 模式下才把 tableHeight 写进 result.height 或
      // result.maxHeight）。ResizeObserver 在此模式下纯粹是浪费，而且单页多实例
      //（如 EsTableDocs 16 个 demo）同时 fire 时会产生不必要的 computed 重算
      // 和 v-bind 新对象，在 Vue 2 下可能累积为 "infinite update loop" 告警。
      const ht = getHeightType()
      if (ht !== 'height' && ht !== 'maxHeight') return

      observer.value = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (tableContainerRef.value) resizeObservers()
        })
      })

      const target =
        ht === 'height'
          ? tableContainerRef.value.parentElement || tableContainerRef.value
          : tableContainerRef.value
      observer.value.observe(target)
      // 主动触发一次计算，避免依赖 ResizeObserver 的首次回调（某些环境不触发）。
      resizeObservers()

      if (headBarRef.value) {
        observer.value.observe(headBarRef.value)
      }
      if (paginationRef.value) {
        observer.value.observe(paginationRef.value)
      }
    })
  }

  const stopObserver = () => {
    if (observer.value) {
      observer.value.disconnect()
      observer.value = null
    }
  }

  onMounted(() => startObserver())
  onBeforeUnmount(() => stopObserver())

  // 运行期 options 变化：heightType 决定观察目标，需重挂 observer；tabHeight 变化只需重算。
  // 若传入的是原始值（非响应式），watch 源不会触发，行为与旧版一致。
  let lastHeightType = getHeightType()
  watch(
    () => [getHeightType(), getTabHeight()] as const,
    ([heightType]) => {
      if (typeof ResizeObserver === 'undefined' || !tableContainerRef.value) {
        resizeObservers()
        return
      }
      // 仅 heightType 变化时才需要重挂（观察目标变了）；tabHeight 变化重算即可。
      if (heightType !== lastHeightType) {
        lastHeightType = heightType
        stopObserver()
        startObserver()
      } else {
        resizeObservers()
      }
    }
  )

  return { tableHeight, resizeObservers, startObserver, stopObserver }
}
