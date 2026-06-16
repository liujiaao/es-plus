/**
 * 表格高度自适应 (ADV 版本)
 *
 * 使用 ResizeObserver 动态计算表格高度。
 * 逻辑与 @es-plus/vue3 版本一致，直接复用。
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { Ref } from 'vue'

interface ResizeOptions {
  heightType: 'auto' | 'height'
  tabHeight?: number | string
}

export function useTableResize(
  tableContainerRef: Ref<HTMLElement | null>,
  headBarRef: Ref<HTMLElement | null>,
  tbBtnRef: Ref<{ $el?: HTMLElement } | null>,
  paginationRef: Ref<HTMLElement | null>,
  options: Ref<ResizeOptions> | ResizeOptions,
) {
  const tableHeight = ref<number>(400)
  let resizeObserver: ResizeObserver | null = null

  const opts = 'value' in options ? options.value : options

  function computeHeight() {
    if (opts.heightType !== 'auto') return
    nextTick(() => {
      const container = tableContainerRef.value
      if (!container) return
      const containerHeight = container.clientHeight
      const headHeight = headBarRef.value?.offsetHeight || 0
      const btnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
      const paginationHeight = paginationRef.value?.offsetHeight || 56
      const padding = 32
      const available = containerHeight - headHeight - btnHeight - paginationHeight - padding
      tableHeight.value = Math.max(available, 200)
    })
  }

  onMounted(() => {
    computeHeight()
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => computeHeight())
      if (tableContainerRef.value) {
        resizeObserver.observe(tableContainerRef.value)
      }
    }
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
  })

  return { tableHeight }
}
