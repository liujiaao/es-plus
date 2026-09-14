/**
 * 表格高度自适应 (ADV 版本)
 *
 * 对齐 @es-plus/vue3 的 use-table-resize 行为：
 * - 支持 heightType: 'auto' | 'height'
 * - 支持 tabHeight 数字/字符串
 * - 使用 ResizeObserver 监听容器与头部高度变化
 */
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
      // 幂等：先断开可能仍存在的旧 observer，避免 deferred start 叠加导致重复观察 / 泄漏
      if (observer.value) {
        observer.value.disconnect()
        observer.value = null
      }
      if (!tableContainerRef.value || typeof ResizeObserver === 'undefined') return

      resizeObservers()

      observer.value = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (tableContainerRef.value) resizeObservers()
        })
      })

      const target = getHeightType() === 'height'
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

  return {
    tableHeight,
    resizeObservers,
    startObserver,
    stopObserver
  }
}
