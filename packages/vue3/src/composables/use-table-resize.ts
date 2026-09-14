import { ref, nextTick, onMounted, onBeforeUnmount, unref, watch, type Ref } from 'vue'

/**
 * 兼容三种入参：原始值、ref/computed、getter。
 * 使用 unref 而非 toValue，以兼容 peer 允许的 Vue 3.2（toValue 3.3 才引入）。
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

  // 每次调用时读取，保证运行期改 options（传入 ref/computed 时）即时生效，而非快照旧值。
  const getHeightType = () => readOption(options.heightType)
  const getTabHeight = () => readOption(options.tabHeight)

  const totalContainerNum = () => {
    const headBarHeight = headBarRef.value?.offsetHeight || 0
    const tbBtnHeight = tbBtnRef.value?.$el?.offsetHeight || 0
    const paginationHeight = paginationRef.value?.offsetHeight || 0
    return Math.round(paginationHeight + headBarHeight + tbBtnHeight)
  }

  const resizeObservers = () => {
    const element = tableContainerRef.value
    if (!element) return

    const heightType = getHeightType()
    const tabHeight = getTabHeight()

    const containerHeight = typeof tabHeight === 'number'
      ? tabHeight
      : heightType === 'height'
        ? (element.parentElement?.offsetHeight || element.offsetHeight)
        : (parseInt(tabHeight as string, 10) || 450)

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

      resizeObservers()

      observer.value = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (tableContainerRef.value) resizeObservers()
        })
      })

      // Observe the main container
      const target = getHeightType() === 'height'
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

  // 运行期 options 变化：heightType 决定观察目标，需重挂 observer；tabHeight 变化只需重算。
  // 若传入的是原始值（非响应式），watch 源不会触发，行为与旧版一致。
  watch(
    () => [getHeightType(), getTabHeight()],
    () => {
      if (typeof ResizeObserver !== 'undefined' && tableContainerRef.value) {
        stopObserver()
        startObserver()
      } else {
        resizeObservers()
      }
    }
  )

  return {
    tableHeight,
    resizeObservers,
    startObserver,
    stopObserver
  }
}
