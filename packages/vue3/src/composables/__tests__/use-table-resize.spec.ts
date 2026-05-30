import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'

// Mock ResizeObserver before imports
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
const mockUnobserve = vi.fn()

let resizeObserverCallback: ((entries?: any) => void) | null = null

const MockResizeObserver = vi.fn().mockImplementation((callback: any) => {
  resizeObserverCallback = callback
  return {
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: mockUnobserve
  }
})

vi.stubGlobal('ResizeObserver', MockResizeObserver)
vi.stubGlobal('requestAnimationFrame', vi.fn((cb: any) => { cb(0); return 0 }))

// We need to mock lifecycle hooks since we're testing outside a component context
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: vi.fn((fn: any) => fn()),
    onBeforeUnmount: vi.fn()
  }
})

import { useTableResize } from '../use-table-resize'
import { onBeforeUnmount } from 'vue'

function createMockElement(overrides: Partial<HTMLElement> = {}): HTMLElement {
  return {
    offsetHeight: 0,
    offsetWidth: 0,
    parentElement: null,
    ...overrides
  } as unknown as HTMLElement
}

describe('useTableResize', () => {
  beforeEach(async () => {
    await nextTick()
    vi.clearAllMocks()
    resizeObserverCallback = null
  })

  afterEach(async () => {
    await nextTick()
  })

  it('should return tableHeight as a reactive ref', async () => {
    const containerRef = ref(createMockElement({ offsetHeight: 600 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight } = useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    expect(tableHeight).toBeDefined()
    expect(typeof tableHeight.value).toBe('number')
  })

  it('should return resizeObservers function', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 600 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const result = useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    expect(result.resizeObservers).toBeDefined()
    expect(typeof result.resizeObservers).toBe('function')
  })

  it('should return startObserver and stopObserver functions', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 600 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const result = useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    expect(result.startObserver).toBeDefined()
    expect(typeof result.startObserver).toBe('function')
    expect(result.stopObserver).toBeDefined()
    expect(typeof result.stopObserver).toBe('function')
  })

  it('should compute height correctly when all refs are provided', async () => {
    const containerRef = ref(createMockElement({ offsetHeight: 800 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 50 }))
    const tbBtnRef = ref({ $el: createMockElement({ offsetHeight: 40 }) })
    const paginationRef = ref(createMockElement({ offsetHeight: 36 }))

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 800 }
    )

    resizeObservers()

    // 800 - (50 + 40 + 36) = 674
    expect(tableHeight.value).toBe(674)
  })

  it('should handle null refs gracefully without errors', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 500 }
    )

    expect(() => resizeObservers()).not.toThrow()
  })

  it('should compute height with null refs treating their height as 0', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 600 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 600 }
    )

    resizeObservers()

    // 600 - (0 + 0 + 0) = 600
    expect(tableHeight.value).toBe(600)
  })

  it('should use tabHeight as numeric value when provided as a number', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 60 }))
    const tbBtnRef = ref(null)
    const paginationRef = ref(createMockElement({ offsetHeight: 32 }))

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 700 }
    )

    resizeObservers()

    // 700 - (60 + 0 + 32) = 608
    expect(tableHeight.value).toBe(608)
  })

  it('should parse tabHeight as string when provided as a string', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 40 }))
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: '650' }
    )

    resizeObservers()

    // parseInt('650') = 650, then 650 - (40 + 0 + 0) = 610
    expect(tableHeight.value).toBe(610)
  })

  it('should fall back to 450 when tabHeight is an unparseable string', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 50 }))
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 'invalid' }
    )

    resizeObservers()

    // parseInt('invalid') = NaN -> fallback 450, then 450 - (50 + 0 + 0) = 400
    expect(tableHeight.value).toBe(400)
  })

  it('should use parentElement offsetHeight when heightType is "height"', () => {
    const parentEl = createMockElement({ offsetHeight: 900 })
    const containerRef = ref(
      createMockElement({ offsetHeight: 600, parentElement: parentEl } as any)
    )
    const headBarRef = ref(createMockElement({ offsetHeight: 50 }))
    const tbBtnRef = ref({ $el: createMockElement({ offsetHeight: 40 }) })
    const paginationRef = ref(createMockElement({ offsetHeight: 36 }))

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { heightType: 'height' }
    )

    resizeObservers()

    // parentElement.offsetHeight = 900, then 900 - (50 + 40 + 36) = 774
    expect(tableHeight.value).toBe(774)
  })

  it('should fall back to element offsetHeight when heightType is "height" and no parentElement', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 700 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 30 }))
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { heightType: 'height' }
    )

    resizeObservers()

    // element.offsetHeight = 700 (no parent), then 700 - (30 + 0 + 0) = 670
    expect(tableHeight.value).toBe(670)
  })

  it('should start observing on mount via startObserver', async () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 30 }))
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    await nextTick()

    // ResizeObserver should have been created and observe called
    expect(global.ResizeObserver).toHaveBeenCalled()
    expect(mockObserve).toHaveBeenCalled()
  })

  it('should observe the container element when heightType is "auto"', async () => {
    const containerEl = createMockElement({ offsetHeight: 500 })
    const containerRef = ref(containerEl)
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    await nextTick()

    expect(mockObserve).toHaveBeenCalledWith(containerEl)
  })

  it('should observe parentElement when heightType is "height"', async () => {
    const parentEl = createMockElement({ offsetHeight: 900 })
    const containerEl = createMockElement({
      offsetHeight: 600,
      parentElement: parentEl
    } as any)
    const containerRef = ref(containerEl)
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'height'
    })

    await nextTick()

    expect(mockObserve).toHaveBeenCalledWith(parentEl)
  })

  it('should also observe headBarRef when it is provided', async () => {
    const containerEl = createMockElement({ offsetHeight: 500 })
    const headBarEl = createMockElement({ offsetHeight: 40 })
    const containerRef = ref(containerEl)
    const headBarRef = ref(headBarEl)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    await nextTick()

    // Should observe both container and headBar
    expect(mockObserve).toHaveBeenCalledWith(containerEl)
    expect(mockObserve).toHaveBeenCalledWith(headBarEl)
    expect(mockObserve).toHaveBeenCalledTimes(2)
  })

  it('should disconnect observer on stopObserver call', async () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { stopObserver } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { heightType: 'auto' }
    )

    await nextTick()

    stopObserver()

    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('should not throw when stopObserver is called without an active observer', () => {
    const containerRef = ref(null)
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { stopObserver } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { heightType: 'auto' }
    )

    expect(() => stopObserver()).not.toThrow()
  })

  it('should not create observer when containerRef is null', async () => {
    const containerRef = ref(null)
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    vi.mocked(global.ResizeObserver).mockClear()

    useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    await nextTick()

    // ResizeObserver constructor should not be called when container is null
    expect(vi.mocked(global.ResizeObserver)).not.toHaveBeenCalled()
  })

  it('should not update tableHeight when resizeObservers is called with null containerRef', () => {
    const containerRef = ref(null)
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 600 }
    )

    const initialHeight = tableHeight.value
    resizeObservers()

    // tableHeight should remain the default (400) since container is null
    expect(tableHeight.value).toBe(initialHeight)
  })

  it('should handle negative computed height by using fallback calculation', () => {
    // When components heights exceed container, it should use totalContainerNum() + 300
    const containerRef = ref(createMockElement({ offsetHeight: 100 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 200 }))
    const tbBtnRef = ref({ $el: createMockElement({ offsetHeight: 200 }) })
    const paginationRef = ref(createMockElement({ offsetHeight: 200 }))

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 100 }
    )

    resizeObservers()

    // totalContainerNum = 200 + 200 + 200 = 600
    // minTableNum = 100 - 600 = -500 (negative!)
    // tabContainer = totalContainerNum() + 300 = 600 + 300 = 900
    // newHeight = floor(900) - round(200 + 200 + 200) = 900 - 600 = 300
    expect(tableHeight.value).toBe(300)
  })

  it('should not update tableHeight if value has not changed', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(createMockElement({ offsetHeight: 50 }))
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 500 }
    )

    resizeObservers()
    const firstHeight = tableHeight.value

    // Call again with same dimensions - value should stay the same
    resizeObservers()
    expect(tableHeight.value).toBe(firstHeight)
  })

  it('should register onBeforeUnmount hook', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 500 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    useTableResize(containerRef, headBarRef, tbBtnRef, paginationRef, {
      heightType: 'auto'
    })

    expect(onBeforeUnmount).toHaveBeenCalled()
  })

  it('should handle tbBtnRef with $el property correctly', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 800 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref({ $el: createMockElement({ offsetHeight: 55 }) })
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 800 }
    )

    resizeObservers()

    // 800 - (0 + 55 + 0) = 745
    expect(tableHeight.value).toBe(745)
  })

  it('should handle tbBtnRef without $el property', () => {
    const containerRef = ref(createMockElement({ offsetHeight: 800 }))
    const headBarRef = ref(null)
    const tbBtnRef = ref({} as any)
    const paginationRef = ref(null)

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { tabHeight: 800 }
    )

    resizeObservers()

    // 800 - (0 + 0 + 0) = 800
    expect(tableHeight.value).toBe(800)
  })

  it('should have default tableHeight of 400', () => {
    const containerRef = ref(null)
    const headBarRef = ref(null)
    const tbBtnRef = ref(null)
    const paginationRef = ref(null)

    const { tableHeight } = useTableResize(
      containerRef,
      headBarRef,
      tbBtnRef,
      paginationRef,
      { heightType: 'auto' }
    )

    expect(tableHeight.value).toBe(400)
  })
})
