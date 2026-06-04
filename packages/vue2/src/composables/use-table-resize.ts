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

import { ref, nextTick, onMounted, onBeforeUnmount } from '../vue-compat'

export function useTableResize(
  tableContainerRef: { value: HTMLElement | null },
  headBarRef: { value: HTMLElement | null },
  tbBtnRef: { value: { $el?: HTMLElement } | null },
  paginationRef: { value: HTMLElement | null },
  options: { heightType?: 'auto' | 'height'; tabHeight?: number | string }
) {
  const tableHeight = ref(400)
  const observer = ref<ResizeObserver | null>(null)

  const isNegative = (num: number) => Math.sign(num) === -1

  const totalContainerNum = () => {
    const headBarHeight = headBarRef.value?.offsetHeight || 0
    const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
    const paginationHeight = paginationRef.value?.offsetHeight || 0
    return Math.round(paginationHeight + headBarHeight + tbBtnHeight)
  }

  const resizeObservers = () => {
    const element = tableContainerRef.value
    if (!element) return

    const containerHeight =
      typeof options.tabHeight === 'number'
        ? options.tabHeight
        : options.heightType === 'height'
          ? element.parentElement?.offsetHeight || element.offsetHeight
          : parseInt(options.tabHeight as string, 10) || 450

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
      if (!tableContainerRef.value || typeof ResizeObserver === 'undefined') return

      observer.value = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (tableContainerRef.value) resizeObservers()
        })
      })

      const target =
        options.heightType === 'height'
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

  return { tableHeight, resizeObservers, startObserver, stopObserver }
}
