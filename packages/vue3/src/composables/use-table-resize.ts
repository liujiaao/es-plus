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

/**
 * tabHeight 的解析结果，三类必须分开 —— 混为一谈就是**静默吃单位**：
 *   '600' / '600px'            → { px: 600 }   单位可忽略，或本就等价
 *   '100%' / '100vh' / '1.5rem' → { measure }   有单位，这里拿不到像素值：
 *                                此前 `parseInt('100%')` 得到 100，把「占满」静默当成 100px，
 *                                `parseInt('1.5rem')` 更是得到 1。这类值只能交给「量真实容器」
 *   'invalid' / undefined       → { fallback }  完全没有数字 → 沿用 450 默认
 */
type TabHeightParse = { kind: 'px'; value: number } | { kind: 'measure' } | { kind: 'fallback' }

function parseTabHeight(value: number | string | undefined): TabHeightParse {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { kind: 'px', value } : { kind: 'fallback' }
  }
  if (typeof value !== 'string') return { kind: 'fallback' }
  const trimmed = value.trim()
  const px = /^(-?\d+(?:\.\d+)?)(px)?$/i.exec(trimmed)
  if (px) return { kind: 'px', value: Number(px[1]) }
  if (/^-?\d+(?:\.\d+)?[a-z%]+$/i.test(trimmed)) return { kind: 'measure' }
  return { kind: 'fallback' }
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

    const tabHeightParsed = parseTabHeight(tabHeight)
    const containerHeight =
      tabHeightParsed.kind === 'px'
        ? tabHeightParsed.value
        : heightType === 'height' || tabHeightParsed.kind === 'measure'
          ? (element.parentElement?.offsetHeight || element.offsetHeight)
          : 450

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

      // 幂等：先断开可能仍存在的旧 observer，避免 deferred start 叠加导致重复观察 / 泄漏
      if (observer.value) {
        observer.value.disconnect()
        observer.value = null
      }

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
  let lastHeightType = getHeightType()
  watch(
    () => [getHeightType(), getTabHeight()] as const,
    ([heightType]) => {
      if (typeof ResizeObserver === 'undefined' || !tableContainerRef.value) {
        resizeObservers()
        return
      }
      // 仅 heightType 变化时才需要重挂（观察目标变了）；tabHeight 变化重算即可。
      // 否则频繁改 tabHeight 会在 nextTick 前反复 stop/start，泄漏前一个 observer。
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
