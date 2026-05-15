import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

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

    const newHeight = Math.floor(tabContainer) - Math.round(paginationHeight + headBarHeight + tbBtnHeight)
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

      // Observe the main container
      const target = options.heightType === 'height'
        ? tableContainerRef.value.parentElement || tableContainerRef.value
        : tableContainerRef.value
      observer.value.observe(target)

      // Observe headBarRef to detect form expand/collapse height changes
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
