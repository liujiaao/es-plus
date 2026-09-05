/**
 * 表格高度自适应 (ADV 版本)
 *
 * 对齐 @es-plus/vue3 的 use-table-resize 行为：
 * - 支持 heightType: 'auto' | 'height'
 * - 支持 tabHeight 数字/字符串
 * - 使用 ResizeObserver 监听容器与头部高度变化
 */
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

export function useTableResize(
  tableContainerRef: { value: HTMLElement | null },
  headBarRef: { value: HTMLElement | null },
  tbBtnRef: { value: { $el?: HTMLElement } | null },
  paginationRef: { value: HTMLElement | null },
  options: { heightType?: 'auto' | 'height' | 'maxHeight'; tabHeight?: number | string }
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

    const containerHeight = typeof options.tabHeight === 'number'
      ? options.tabHeight
      : options.heightType === 'height'
        ? (element.parentElement?.offsetHeight || element.offsetHeight)
        : (parseInt(options.tabHeight as string, 10) || 450)

    const maxContainer = !isNaN(containerHeight) ? containerHeight : 450
    const minTableNum = maxContainer - totalContainerNum()
    const tabContainer = isNegative(minTableNum) ? totalContainerNum() + 300 : maxContainer

    const paginationHeight = paginationRef.value?.offsetHeight || 0
    const headBarHeight = headBarRef.value?.offsetHeight || 0
    const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0

    // a-table 的 scroll.y 只控制 body 高度，需额外扣除表头高度，
    // 否则 header + body 总高度会超出容器导致分页器被覆盖。
    const tableHeaderEl = element.querySelector('.ant-table-header') || element.querySelector('.ant-table-thead')
    const tableHeaderHeight = tableHeaderEl?.getBoundingClientRect().height || 0

    const newHeight = Math.floor(tabContainer) - Math.round(paginationHeight + headBarHeight + tbBtnHeight + tableHeaderHeight)
    if (tableHeight.value !== newHeight) {
      tableHeight.value = newHeight
    }
  }

  const startObserver = () => {
    nextTick(() => {
      if (!tableContainerRef.value || typeof ResizeObserver === 'undefined') return

      resizeObservers()

      observer.value = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (tableContainerRef.value) resizeObservers()
        })
      })

      const target = options.heightType === 'height'
        ? tableContainerRef.value.parentElement || tableContainerRef.value
        : tableContainerRef.value
      observer.value.observe(target)

      if (headBarRef.value) {
        observer.value.observe(headBarRef.value)
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

  return {
    tableHeight,
    resizeObservers,
    startObserver,
    stopObserver
  }
}
