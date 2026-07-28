import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'

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

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: vi.fn((fn: any) => fn()),
    onBeforeUnmount: vi.fn(),
  }
})

import { useTableResize } from '../src/composables/use-table-resize'
import { onBeforeUnmount } from 'vue'

function mockEl(overrides: Record<string, any> = {}): HTMLElement {
  return {
    offsetHeight: 0,
    clientHeight: 0,
    parentElement: null,
    querySelector: vi.fn(() => null),
    ...overrides,
  } as unknown as HTMLElement
}

describe('useTableResize (adapter-antdv)', () => {
  beforeEach(async () => {
    await nextTick()
    vi.clearAllMocks()
    resizeObserverCallback = null
  })

  afterEach(async () => {
    await nextTick()
  })

  // ─── 初始值与结构 ─────────────────────────────────────────────────────
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
    const containerEl = mockEl({ offsetHeight: 800, querySelector: vi.fn(() => null) })
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const tbBtnRef = ref({ $el: mockEl({ offsetHeight: 40 }) })
    const paginationRef = ref(mockEl({ offsetHeight: 36 }))

    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, tbBtnRef, paginationRef, { tabHeight: 800 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(674) // 800 - 50 - 40 - 36 - 0(no header)
  })

  it('所有子 ref 为 null → tableHeight 等于 tabHeight', () => {
    const containerEl = mockEl({ offsetHeight: 600, querySelector: vi.fn(() => null) })
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), ref(null), ref(null), ref(null), { tabHeight: 600 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(600)
  })

  it('tabHeight 字符串 "650" → parseInt 解析', () => {
    const containerEl = mockEl({ offsetHeight: 500, querySelector: vi.fn(() => null) })
    const headBarRef = ref(mockEl({ offsetHeight: 40 }))
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, ref(null), ref(null), { tabHeight: '650' }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(610) // 650 - 40
  })

  it('tabHeight 无效字符串 → fallback 450', () => {
    const containerEl = mockEl({ offsetHeight: 500, querySelector: vi.fn(() => null) })
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, ref(null), ref(null), { tabHeight: 'invalid' }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(400) // 450 - 50
  })

  it('heightType:"height" → 使用 parentElement.offsetHeight', () => {
    const parentEl = mockEl({ offsetHeight: 900 })
    const containerEl = mockEl({
      offsetHeight: 600,
      parentElement: parentEl,
      querySelector: vi.fn(() => null),
    } as any)
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const paginationRef = ref(mockEl({ offsetHeight: 36 }))

    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, ref(null), paginationRef, { heightType: 'height' }
    )
    resizeObservers()
    // 900 - 50 - 0 - 36 - 0(tableHeader) = 814
    expect(tableHeight.value).toBe(814)
  })

  it('heightType:"height" 且无 parentElement → fallback 到 element.offsetHeight', () => {
    const containerEl = mockEl({ offsetHeight: 700, querySelector: vi.fn(() => null) })
    const headBarRef = ref(mockEl({ offsetHeight: 30 }))
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, ref(null), ref(null), { heightType: 'height' }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(670) // 700 - 30
  })

  it('负值保护：子高度之和超过容器 → tabContainer = totalContainerNum() + 300', () => {
    const containerEl = mockEl({ offsetHeight: 100, querySelector: vi.fn(() => null) })
    const headBarRef = ref(mockEl({ offsetHeight: 200 }))
    const tbBtnRef = ref({ $el: mockEl({ offsetHeight: 200 }) })
    const paginationRef = ref(mockEl({ offsetHeight: 200 }))

    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, tbBtnRef, paginationRef, { tabHeight: 100 }
    )
    resizeObservers()
    // total = 600, tabContainer = 900, newHeight = 900 - 600 = 300
    expect(tableHeight.value).toBe(300)
  })

  // ─── .ant-table-header / .ant-table-thead 表头高度扣除 ──────────────
  it('.ant-table-header 存在 → 从高度中扣除表头高度', () => {
    const headerEl = {
      getBoundingClientRect: () => ({ height: 48 }),
    } as any
    const containerEl = mockEl({
      offsetHeight: 600,
      querySelector: vi.fn((sel: string) => sel === '.ant-table-header' ? headerEl : null),
    })
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), ref(null), ref(null), ref(null), { tabHeight: 600 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(552) // 600 - 48
  })

  it('.ant-table-header 不存在但 .ant-table-thead 存在 → 使用备用选择器', () => {
    const headerEl = {
      getBoundingClientRect: () => ({ height: 40 }),
    } as any
    const containerEl = mockEl({
      offsetHeight: 600,
      querySelector: vi.fn((sel: string) => sel === '.ant-table-thead' ? headerEl : null),
    })
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), ref(null), ref(null), ref(null), { tabHeight: 600 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(560) // 600 - 40
  })

  it('两个表头选择器均不存在 → tableHeaderHeight 视为 0', () => {
    const containerEl = mockEl({
      offsetHeight: 600,
      querySelector: vi.fn(() => null),
    })
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), ref(null), ref(null), ref(null), { tabHeight: 600 }
    )
    resizeObservers()
    expect(tableHeight.value).toBe(600)
  })

  it('连续相同尺寸调用两次 → tableHeight 不变', () => {
    const containerEl = mockEl({ offsetHeight: 500, querySelector: vi.fn(() => null) })
    const headBarRef = ref(mockEl({ offsetHeight: 50 }))
    const { tableHeight, resizeObservers } = useTableResize(
      ref(containerEl), headBarRef, ref(null), ref(null), { tabHeight: 500 }
    )
    resizeObservers()
    const v = tableHeight.value
    resizeObservers()
    expect(tableHeight.value).toBe(v)
  })

  // ─── startObserver ────────────────────────────────────────────────────
  it('containerRef 为 null → 不创建 ResizeObserver', async () => {
    MockResizeObserver.mockClear()
    useTableResize(ref(null), ref(null), ref(null), ref(null), { heightType: 'auto' })
    await nextTick()
    expect(MockResizeObserver).not.toHaveBeenCalled()
  })

  it('heightType:"auto" → 监听 containerEl', async () => {
    const containerEl = mockEl({ offsetHeight: 500 })
    useTableResize(ref(containerEl), ref(null), ref(null), ref(null), { heightType: 'auto' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(containerEl)
  })

  it('heightType:"height" → 监听 parentElement', async () => {
    const parentEl = mockEl({ offsetHeight: 900 })
    const containerEl = mockEl({ offsetHeight: 600, parentElement: parentEl } as any)
    useTableResize(ref(containerEl), ref(null), ref(null), ref(null), { heightType: 'height' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(parentEl)
  })

  it('headBarRef 存在 → 追加监听 headBarEl', async () => {
    const containerEl = mockEl({ offsetHeight: 500 })
    const headBarEl = mockEl({ offsetHeight: 40 })
    useTableResize(ref(containerEl), ref(headBarEl), ref(null), ref(null), { heightType: 'auto' })
    await nextTick()
    expect(mockObserve).toHaveBeenCalledWith(headBarEl)
  })

  // ─── stopObserver ─────────────────────────────────────────────────────
  it('stopObserver → 调用 disconnect', async () => {
    const containerEl = mockEl({ offsetHeight: 500 })
    const { stopObserver } = useTableResize(ref(containerEl), ref(null), ref(null), ref(null), { heightType: 'auto' })
    await nextTick()
    stopObserver()
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('stopObserver 在无活跃 observer 时不抛出', () => {
    const { stopObserver } = useTableResize(ref(null), ref(null), ref(null), ref(null), {})
    expect(() => stopObserver()).not.toThrow()
  })

  // ─── 生命周期钩子 ─────────────────────────────────────────────────────
  it('注册了 onBeforeUnmount 钩子', () => {
    useTableResize(ref(null), ref(null), ref(null), ref(null), {})
    expect(onBeforeUnmount).toHaveBeenCalled()
  })
})
