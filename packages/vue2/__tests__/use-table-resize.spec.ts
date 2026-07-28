import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockObserve = vi.fn()
const mockDisconnect = vi.fn()

let resizeObserverCallback: ((entries?: any) => void) | null = null

const MockResizeObserver = vi.fn().mockImplementation((callback: any) => {
  resizeObserverCallback = callback
  return {
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: vi.fn(),
  }
})

vi.stubGlobal('ResizeObserver', MockResizeObserver)
vi.stubGlobal('requestAnimationFrame', vi.fn((cb: any) => { cb(0); return 0 }))

// vue2 生命周期钩子来自 vue-compat，mock 以便在组件外部调用
vi.mock('../src/vue-compat', async () => {
  const actual = await vi.importActual<any>('../src/vue-compat')
  return {
    ...actual,
    onMounted: vi.fn((fn: any) => fn()),
    onBeforeUnmount: vi.fn(),
  }
})

import { useTableResize } from '../src/composables/use-table-resize'
import { onBeforeUnmount, ref, nextTick } from '../src/vue-compat'

function mockEl(overrides: Partial<HTMLElement & { clientHeight?: number }> = {}): HTMLElement {
  return {
    offsetHeight: 0,
    clientHeight: 0,
    parentElement: null,
    ...overrides,
  } as unknown as HTMLElement
}

describe('useTableResize (vue2)', () => {
  beforeEach(async () => {
    await nextTick()
    vi.clearAllMocks()
    resizeObserverCallback = null
    // 恢复 window stub
    vi.stubGlobal('window', {
      getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px' }),
    })
  })

  afterEach(async () => {
    await nextTick()
  })

  // ─── 返回值结构 ────────────────────────────────────────────────────────
  it('tableHeight 初始值为 400', () => {
    const { tableHeight } = useTableResize(ref(null), ref(null), ref(null), ref(null), {})
    expect(tableHeight.value).toBe(400)
  })

  it('返回 resizeObservers / startObserver / stopObserver 函数', () => {
    const r = useTableResize(ref(null), ref(null), ref(null), ref(null), {})
    expect(typeof r.resizeObservers).toBe('function')
    expect(typeof r.startObserver).toBe('function')
    expect(typeof r.stopObserver).toBe('function')
  })

  // ─── resizeObservers 高度计算 ──────────────────────────────────────────
  it('containerRef 为 null → resizeObservers() 不更新 tableHeight', () => {
    const { tableHeight, resizeObservers } = useTableResize(ref(null), ref(null), ref(null), ref(null), { tabHeight: 600 })
    resizeObservers()
    expect(tableHeight.value).toBe(400)
  })

  it('tabHeight 数字 800，三个子 ref 均有高度 → 正确减法', () => {
    const containerRef = ref(mockEl({ offsetHeight: 800 }))
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const tbBtnRef = ref({ $el: mockEl({ offsetHeight: 40 }) })
    const paginationRef = ref(mockEl({ offsetHeight: 36 }))

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, headBarRef, tbBtnRef, paginationRef, { tabHeight: 800 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(674) // 800 - 50 - 40 - 36
  })

  it('所有子 ref 为 null → tableHeight 等于 tabHeight', () => {
    const containerRef = ref(mockEl({ offsetHeight: 600 }))
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, ref(null), ref(null), ref(null), { tabHeight: 600 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(600)
  })

  it('tabHeight 字符串 "650" → parseInt 解析后计算', () => {
    const containerRef = ref(mockEl({ offsetHeight: 500 }))
    const headBarRef = ref(mockEl({ offsetHeight: 40 }))
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, headBarRef, ref(null), ref(null), { tabHeight: '650' }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(610) // 650 - 40
  })

  it('tabHeight 无效字符串 "invalid" → fallback 450', () => {
    const containerRef = ref(mockEl({ offsetHeight: 500 }))
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, headBarRef, ref(null), ref(null), { tabHeight: 'invalid' }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(400) // 450 - 50
  })

  it('heightType:"height" → 使用 getParentContentHeight(parentElement)', () => {
    const parentEl = mockEl({ clientHeight: 900, offsetHeight: 900 })
    const containerEl = mockEl({ offsetHeight: 600, parentElement: parentEl } as any)
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const tbBtnRef = ref({ $el: mockEl({ offsetHeight: 40 }) })
    const paginationRef = ref(mockEl({ offsetHeight: 36 }))

    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, tbBtnRef, paginationRef, { heightType: 'height' }
    )
    resizeObservers()
    // clientHeight 900 - paddingTop 0 - paddingBottom 0 = 900, 900 - 126 = 774
    expect(tableHeight.value).toBe(774)
  })

  it('heightType:"height" 且无 parentElement → fallback 到容器 offsetHeight', () => {
    const containerRef = ref(mockEl({ offsetHeight: 700, clientHeight: 700 }))
    const headBarRef = ref(mockEl({ offsetHeight: 30 }))
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, headBarRef, ref(null), ref(null), { heightType: 'height' }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(670) // 700 - 30
  })

  it('负值保护：子高度之和超过容器 → tabContainer = totalContainerNum() + 300', () => {
    const containerRef = ref(mockEl({ offsetHeight: 100 }))
    const headBarRef = ref(mockEl({ offsetHeight: 200 }))
    const tbBtnRef = ref({ $el: mockEl({ offsetHeight: 200 }) })
    const paginationRef = ref(mockEl({ offsetHeight: 200 }))

    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, headBarRef, tbBtnRef, paginationRef, { tabHeight: 100 }
    )
    resizeObservers()
    // total = 600, tabContainer = 900, newHeight = 900 - 600 = 300
    expect(tableHeight.value).toBe(300)
  })

  it('tbBtnRef 有 $el → 使用 $el.offsetHeight', () => {
    const containerRef = ref(mockEl({ offsetHeight: 800 }))
    const tbBtnRef = ref({ $el: mockEl({ offsetHeight: 55 }) })
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, ref(null), tbBtnRef, ref(null), { tabHeight: 800 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(745)
  })

  it('tbBtnRef 无 $el → 视为 0', () => {
    const containerRef = ref(mockEl({ offsetHeight: 800 }))
    const tbBtnRef = ref({} as any)
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, ref(null), tbBtnRef, ref(null), { tabHeight: 800 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(800)
  })

  it('连续调用两次相同尺寸 → tableHeight 不变', () => {
    const containerRef = ref(mockEl({ offsetHeight: 500 }))
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const { tableHeight, resizeObservers } = useTableResize(
      containerRef, headBarRef, ref(null), ref(null), { tabHeight: 500 }
    )
    resizeObservers()
    const v = tableHeight.value
    resizeObservers()
    expect(tableHeight.value).toBe(v)
  })

  // ─── startObserver 行为（vue2 版：auto 模式不创建 observer） ───────────
  it('heightType 非 "height"/"maxHeight" → 不创建 ResizeObserver', async () => {
    MockResizeObserver.mockClear()
    const containerRef = ref(mockEl({ offsetHeight: 500 }))
    useTableResize(containerRef, ref(null), ref(null), ref(null), { heightType: 'auto' })
    await nextTick()
    expect(MockResizeObserver).not.toHaveBeenCalled()
  })

  it('containerRef 为 null → 不创建 ResizeObserver', async () => {
    MockResizeObserver.mockClear()
    useTableResize(ref(null), ref(null), ref(null), ref(null), { heightType: 'height' })
    await nextTick()
    expect(MockResizeObserver).not.toHaveBeenCalled()
  })

  it('heightType:"height" → 监听 parentElement', async () => {
    const parentEl = mockEl({ offsetHeight: 900 })
    const containerEl = mockEl({ offsetHeight: 600, parentElement: parentEl } as any)
    useTableResize(ref(containerEl), ref(null), ref(null), ref(null), { heightType: 'height' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(parentEl)
  })

  it('heightType:"maxHeight" → 监听 containerEl', async () => {
    const containerEl = mockEl({ offsetHeight: 500 })
    useTableResize(ref(containerEl), ref(null), ref(null), ref(null), { heightType: 'maxHeight' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(containerEl)
  })

  it('headBarRef 存在 → 追加监听 headBarEl', async () => {
    const containerEl = mockEl({ offsetHeight: 500 })
    const headBarEl = mockEl({ offsetHeight: 40 })
    useTableResize(ref(containerEl), ref(headBarEl), ref(null), ref(null), { heightType: 'height' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(headBarEl)
  })

  it('paginationRef 存在 → 追加监听 paginationEl', async () => {
    const containerEl = mockEl({ offsetHeight: 500 })
    const paginationEl = mockEl({ offsetHeight: 36 })
    useTableResize(ref(containerEl), ref(null), ref(null), ref(paginationEl), { heightType: 'height' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(paginationEl)
  })

  // ─── stopObserver ─────────────────────────────────────────────────────
  it('stopObserver → 调用 disconnect', async () => {
    const containerRef = ref(mockEl({ offsetHeight: 500 }))
    const { stopObserver } = useTableResize(containerRef, ref(null), ref(null), ref(null), { heightType: 'height' })
    await nextTick()
    stopObserver()
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('stopObserver 在无活跃 observer 时不抛出', () => {
    const { stopObserver } = useTableResize(ref(null), ref(null), ref(null), ref(null), {})
    expect(() => stopObserver()).not.toThrow()
  })

  // ─── 生命周期钩子注册 ─────────────────────────────────────────────────
  it('注册了 onBeforeUnmount 钩子', () => {
    useTableResize(ref(null), ref(null), ref(null), ref(null), {})
    expect(onBeforeUnmount).toHaveBeenCalled()
  })
})
