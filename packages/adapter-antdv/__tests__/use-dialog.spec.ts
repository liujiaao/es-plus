/**
 * adapter-antdv useDialog 单元测试
 *
 * 覆盖：
 *   - 默认模式（onlyInstance:false）：复用容器、close、destroy
 *   - onlyInstance:true 模式：每次创建新容器
 *   - onClosed 回调包装
 *   - appendTo 挂载目标选择
 *
 * 注意：测试不挂载 Vue 组件，仅测试 useDialog 返回的函数和 DOM 操作逻辑。
 * Vue render + createVNode 在 happy-dom 中可用（Vue 3 core 不依赖真实 DOM API）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── mock createVNode / render 防止真实渲染 ────────────────────────────────

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    createVNode: vi.fn((_comp: any, props: any) => ({
      _isMock: true,
      props,
      component: { props: { ...props } },
      appContext: null,
    })),
    render: vi.fn(),
    getCurrentInstance: vi.fn(() => null),
    // 默认无作用域 = 「不在组件 setup 里调用」，与真实语义一致：useDialog 不注册卸载清理。
    // 清理用例再把 getCurrentScope 改成返回一个作用域，捕获 onScopeDispose 的回调。
    getCurrentScope: vi.fn(() => null),
    onScopeDispose: vi.fn(),
  }
})

import { createVNode, getCurrentScope, onScopeDispose, render } from 'vue'
import { useDialog } from '../src/components/es-dialog/src/use-dialog'

const mockCreateVNode = createVNode as ReturnType<typeof vi.fn>
const mockRender = render as ReturnType<typeof vi.fn>
const mockGetCurrentScope = getCurrentScope as unknown as ReturnType<typeof vi.fn>
const mockOnScopeDispose = onScopeDispose as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  // 清理 DOM
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

// ─── 1. 默认模式（onlyInstance:false）────────────────────────────────────

describe('useDialog — 默认模式（onlyInstance:false）', () => {
  it('返回一个可调用函数（DialogComponent）', () => {
    const dialog = useDialog()
    expect(typeof dialog).toBe('function')
  })

  it('DialogComponent 有 close 方法', () => {
    const dialog = useDialog()
    expect(typeof (dialog as any).close).toBe('function')
  })

  it('DialogComponent 有 destroy 方法', () => {
    const dialog = useDialog()
    expect(typeof (dialog as any).destroy).toBe('function')
  })

  it('调用 dialog({}) → 调用 createVNode', () => {
    const dialog = useDialog()
    dialog({ title: '测试' })
    expect(mockCreateVNode).toHaveBeenCalledOnce()
  })

  it('调用 dialog({}) → 调用 render', () => {
    const dialog = useDialog()
    dialog({ title: '测试' })
    expect(mockRender).toHaveBeenCalledOnce()
  })

  it('container 被 appendChild 到 document.body', () => {
    const dialog = useDialog()
    dialog({ title: '测试' })
    expect(document.body.childElementCount).toBeGreaterThan(0)
  })

  it('第二次调用 dialog() → 复用容器（createVNode 不再重复调用）', () => {
    // 第一次 createVNode 返回一个带 component.props 的 vNode
    mockCreateVNode.mockReturnValue({
      _isMock: true,
      component: { props: { visible: true, title: '第一次' } },
      appContext: null,
    })
    const dialog = useDialog()
    dialog({ title: '第一次' })

    // 第二次：vNode.component 已存在 → 直接 assign props，不再 createVNode
    mockCreateVNode.mockClear()
    dialog({ title: '第二次' })
    expect(mockCreateVNode).not.toHaveBeenCalled()
  })

  it('onClosed 回调被包装：调用后触发 close', () => {
    const onClosed = vi.fn()
    const dialog = useDialog()
    const vNode = dialog({ onClosed })
    // 执行 mergedOptions.onClosed
    const mergedOnClosed = mockCreateVNode.mock.calls[0][1]?.onClosed
    mergedOnClosed?.()
    expect(onClosed).toHaveBeenCalled()
  })

  // ─── 回归：单例复用时 `onXxx` 必须写进 vNode.props（component.props 是死槽）───
  it('单例复用：第二次调用传入的 onClosed 生效，旧回调不再触发', () => {
    const first = vi.fn()
    const second = vi.fn()
    const dialog = useDialog()
    const r1 = dialog({ title: '添加', onClosed: first })
    const r2 = dialog({ title: '编辑', onClosed: second })
    expect(r2.instance).toBe(r1.instance) // 前提：确实复用了同一实例

    // 复用路径把包装写回 vNode.props；emit 按 vNode.props 派发
    r2.instance.props.onClosed?.()

    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('单例复用时省略 onClosed：上一次的回调不再触发', () => {
    const first = vi.fn()
    const dialog = useDialog()
    dialog({ title: 'a', onClosed: first })
    const r2 = dialog({ title: 'b' })

    r2.instance.props.onClosed?.()
    expect(first).not.toHaveBeenCalled()
  })

  it('mergedOptions 默认包含 visible:true + width:"50%"', () => {
    const dialog = useDialog()
    dialog({})
    const props = mockCreateVNode.mock.calls[0][1]
    expect(props?.visible).toBe(true)
    expect(props?.width).toBe('50%')
  })

  it('mergedOptions 默认包含 destroyOnClose:true', () => {
    const dialog = useDialog()
    dialog({})
    const props = mockCreateVNode.mock.calls[0][1]
    expect(props?.destroyOnClose).toBe(true)
  })
})

// ─── 2. onlyInstance:true 模式 ────────────────────────────────────────────

describe('useDialog — onlyInstance:true', () => {
  it('返回函数有 close 方法', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    expect(typeof (dialog as any).close).toBe('function')
  })

  it('每次调用 dialog() → 新建容器（createVNode 每次都调用）', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    dialog({ title: '第一次' })
    dialog({ title: '第二次' })
    expect(mockCreateVNode).toHaveBeenCalledTimes(2)
  })

  // 三端同构：vue3 的 onlyInstance 分支同样定义了 destroy（该模式 close 已卸载并移除容器，
  // destroy 与其等价）。此前本端缺失 destroy，跨端代码 `const { destroy } = dialog(...)` 会挂。
  it('onlyInstance 模式同样提供 destroy（对齐 vue3）', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    expect(typeof (dialog as any).destroy).toBe('function')
  })

  it('visible 默认置为 true', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    dialog({})
    const props = mockCreateVNode.mock.calls[0][1]
    expect(props?.visible).toBe(true)
  })

  it('onClosed 被包装：调用时触发用户回调', () => {
    const onClosed = vi.fn()
    const dialog = useDialog(undefined, { onlyInstance: true })
    dialog({ onClosed })
    const wrappedOnClosed = mockCreateVNode.mock.calls[0][1]?.onClosed
    wrappedOnClosed?.()
    expect(onClosed).toHaveBeenCalled()
  })
})

// ─── 3. appendTo 目标挂载 ─────────────────────────────────────────────────

describe('useDialog — appendTo 挂载目标', () => {
  it('appendTo 未指定 → 挂载到 document.body', () => {
    const dialog = useDialog()
    dialog({})
    expect(document.body.childElementCount).toBeGreaterThan(0)
  })

  it('appendTo 为 string selector → 挂载到对应元素', () => {
    const wrapper = document.createElement('div')
    wrapper.id = 'dialog-root'
    document.body.appendChild(wrapper)

    const dialog = useDialog()
    dialog({ appendTo: '#dialog-root' })
    expect(wrapper.childElementCount).toBeGreaterThan(0)
  })

  it('appendTo 为 HTMLElement → 挂载到该元素', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const dialog = useDialog()
    dialog({ appendTo: target })
    expect(target.childElementCount).toBeGreaterThan(0)
  })

  it('appendTo 为无效 selector → fallback 到 document.body', () => {
    const dialog = useDialog()
    dialog({ appendTo: '#nonexistent' })
    expect(document.body.childElementCount).toBeGreaterThan(0)
  })
})

// ─── 4. 自定义 Component ─────────────────────────────────────────────────

describe('useDialog — 自定义 Component', () => {
  it('传入自定义 Component → createVNode 使用该 Component', () => {
    const CustomComp = { name: 'CustomDialog', setup: () => ({}) }
    const dialog = useDialog(CustomComp)
    dialog({ title: '自定义' })
    expect(mockCreateVNode.mock.calls[0][0]).toBe(CustomComp)
  })

  it('不传 Component → 使用默认 EsDialog', () => {
    const dialog = useDialog()
    dialog({})
    const comp = mockCreateVNode.mock.calls[0][0]
    expect(comp).toBeDefined()
  })
})

/**
 * 三端同构：调用返回值形态。
 *
 * 此前 antdv 的 `dialog({...})` 直接返回 vNode，而 vue3/vue2 返回
 * `{ instance, close, destroy }`。es-eui（Vue2 站）的官方示例正是
 * `const { instance, close } = useDialog()({...})` 这种解构写法 ——
 * 即文档教的三端通用写法在本端会拿到 undefined。
 */
describe('useDialog — 返回值与 vue3/vue2 的 DialogResult 同构', () => {
  it('默认模式：返回 { instance, close, destroy }', () => {
    const dialog = useDialog()
    const result = dialog({ title: 'x' })
    expect(result).toBeTruthy()
    expect(result.instance).toBeTruthy()
    expect(typeof result.close).toBe('function')
    expect(typeof result.destroy).toBe('function')
  })

  it('onlyInstance 模式：同样返回 { instance, close, destroy }', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    const result = dialog({ title: 'x' })
    expect(result.instance).toBeTruthy()
    expect(typeof result.close).toBe('function')
    expect(typeof result.destroy).toBe('function')
  })

  it('解构写法可用，且 close 与 callable.close 是同一函数', () => {
    const dialog = useDialog()
    const { close } = dialog({ title: 'x' })
    expect(close).toBe((dialog as any).close)
  })

  it('instance 指向本次渲染的 vNode（可做响应式 props 更新）', () => {
    const dialog = useDialog()
    const { instance } = dialog({ title: 'x' })
    expect(instance).toBe(mockCreateVNode.mock.results[0].value)
  })
})

/**
 * cacheKey 实例缓存（Wave 5：与 vue3/vue2 对齐）。
 *
 * 此前本端没有缓存通道：cacheKey 既不下发也不复用，`check-type-exports.mjs` 把它
 * 登记成「有意偏差」。现在三端同构 —— 同一 cacheKey 跨调用复用实例（保留内部状态），
 * 关闭后 TTL 10 分钟回收；cacheKey 只是 hook 的缓存键，**不得**漏进组件 props。
 */
describe('useDialog — cacheKey 实例缓存', () => {
  // 每个 vNode 必须是独立对象 —— 文件上方有个用例用 mockReturnValue 固定了返回值，
  // 那会让「重新创建」与「命中缓存」在引用上无法区分。
  beforeEach(() => {
    mockCreateVNode.mockImplementation((_comp: any, props: any) => ({
      _isMock: true,
      props,
      component: { props: { ...props } },
      appContext: null,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('同一 cacheKey 第二次调用复用实例（不新建 vNode）', () => {
    const dialog = useDialog()
    const first = dialog({ cacheKey: 'k1', title: 'A' })
    expect(mockCreateVNode).toHaveBeenCalledTimes(1)

    const second = dialog({ cacheKey: 'k1', title: 'B' })
    expect(mockCreateVNode).toHaveBeenCalledTimes(1)
    expect(second.instance).toBe(first.instance)
  })

  it('cacheKey 不下发到组件（仅作为 hook 缓存键）', () => {
    const dialog = useDialog()
    dialog({ cacheKey: 'k1', title: 'A' })
    expect(mockCreateVNode.mock.calls[0][1]?.cacheKey).toBeUndefined()
  })

  it('close 只翻转该缓存实例的 visible，不卸载容器', () => {
    const dialog = useDialog()
    const { instance, close } = dialog({ cacheKey: 'k1', title: 'A' })
    close()
    expect(instance.component.props.visible).toBe(false)
    // 缓存实例关闭后仍留在 DOM，等待 TTL 回收
    expect(document.body.childElementCount).toBe(1)
  })

  // 回归：程序化关闭不经过组件事件（不 emit 'closed'），TTL 必须在 closeCache 里补武装
  it('程序化 close() 关闭缓存实例后同样武装 TTL（不会永久常驻）', () => {
    vi.useFakeTimers()
    const dialog = useDialog()
    const { close } = dialog({ cacheKey: 'k-ttl', title: 'A' })
    close()
    // 程序中没有人 emit 'closed' —— 此前 TTL 只挂在 onClosed 包装上，永不回收
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(document.body.childElementCount).toBe(0)
  })

  it('关闭后重新打开：visible 置回 true，且省略的 prop 回退到创建时的基线', () => {
    const dialog = useDialog()
    const first = dialog({ cacheKey: 'k1', title: 'A' })
    first.close()

    dialog({ cacheKey: 'k1', title: 'B' })
    expect(first.instance.component.props.title).toBe('B')
    expect(first.instance.component.props.visible).toBe(true)

    // 本次省略 title → 回退基线 A，而不是残留上一次调用写的 B
    dialog({ cacheKey: 'k1' })
    expect(first.instance.component.props.title).toBe('A')
  })

  it('关闭后 10 分钟 → 自动销毁并移除容器；重新打开会取消定时器', () => {
    vi.useFakeTimers()
    const dialog = useDialog()
    const { close } = dialog({ cacheKey: 'k1', title: 'A' })

    close()
    // 关闭动作由组件 emit closed 触发，缓存包装在 onClosed 里武装 TTL
    const wrappedOnClosed = mockCreateVNode.mock.calls[0][1]?.onClosed
    wrappedOnClosed?.()

    // 到期前重新打开 → 定时器取消
    vi.advanceTimersByTime(9 * 60 * 1000)
    dialog({ cacheKey: 'k1' })
    close()
    wrappedOnClosed?.()

    vi.advanceTimersByTime(9 * 60 * 1000)
    // 第二次关闭重新计时，尚未满 10 分钟 → 容器仍在
    expect(document.body.childElementCount).toBe(1)

    mockRender.mockClear()
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(mockRender).toHaveBeenCalledWith(null, expect.anything())
    expect(document.body.childElementCount).toBe(0)
  })

  it('destroy(cacheKey) 只销毁该缓存实例，不误伤单例 vNode', () => {
    const dialog = useDialog()
    const single = dialog({ title: 'single' })
    const { instance: cached, destroy } = dialog({ cacheKey: 'k1', title: 'cached' })

    destroy('k1')

    // 单例实例仍可用：再次调用复用同一个 instance
    const again = dialog({ title: 'single-2' })
    expect(again.instance).toBe(single.instance)

    // 被销毁的缓存实例不再命中：同 cacheKey 会重新创建
    const callsBefore = mockCreateVNode.mock.calls.length
    const reopened = dialog({ cacheKey: 'k1', title: 'cached-2' })
    expect(mockCreateVNode).toHaveBeenCalledTimes(callsBefore + 1)
    expect(reopened.instance).not.toBe(cached)
  })

  it('destroy() 无参 = 单例 + 全部缓存一起销毁', () => {
    const dialog = useDialog()
    dialog({ title: 'single' })
    dialog({ cacheKey: 'k1', title: 'cached' })

    ;(dialog as any).destroy()

    expect(document.body.childElementCount).toBe(0)
  })

  // 回归：只关一个弹窗（无 cacheKey）时不能调 destroy() 无参，否则会清掉别人的缓存。
  it('destroyCurrent() 只销毁单例，保留 cacheKey 缓存', () => {
    const dialog = useDialog()
    dialog({ title: 'single' })
    const { instance: cached } = dialog({ cacheKey: 'k1', title: 'cached' })

    dialog.destroyCurrent()
    mockRender.mockClear()

    const again = dialog({ cacheKey: 'k1', title: 'cached-2' })
    expect(again.instance).toBe(cached)
    // 缓存实例没有被卸载（未再 render(null, container)）
    expect(mockRender).not.toHaveBeenCalled()
  })

  it('onlyInstance 模式同样支持 cacheKey 复用', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    const first = dialog({ cacheKey: 'k1', title: 'A' })
    const second = dialog({ cacheKey: 'k1', title: 'B' })
    expect(mockCreateVNode).toHaveBeenCalledTimes(1)
    expect(second.instance).toBe(first.instance)
  })
})

/**
 * 宿主作用域销毁（卸载）时的回收。
 *
 * 弹窗容器是手工 append 到 appendTo 的，不在任何组件子树里 —— 宿主卸载不会连带移除它，
 * 此前也没有任何清理挂载点，容器与已渲染的弹窗会活过宿主组件。
 */
describe('useDialog — 宿主作用域销毁时的回收', () => {
  const withScope = (fn: (dispose: () => void) => void) => {
    let dispose: (() => void) | undefined
    mockGetCurrentScope.mockReturnValue({} as any)
    mockOnScopeDispose.mockImplementation((cb: () => void) => {
      dispose = cb
    })
    try {
      fn(() => dispose?.())
    } finally {
      mockGetCurrentScope.mockReturnValue(null)
      mockOnScopeDispose.mockReset()
    }
  }

  it('默认模式：注册 onScopeDispose，销毁时卸载 vNode 并移除容器', () => {
    withScope((dispose) => {
      const dialog = useDialog()
      dialog({ title: 'x' })
      expect(mockOnScopeDispose).toHaveBeenCalledTimes(1)

      const containersBefore = document.body.childElementCount
      expect(containersBefore).toBeGreaterThan(0)
      mockRender.mockClear()

      dispose()

      expect(mockRender).toHaveBeenCalledWith(null, expect.anything())
      expect(document.body.childElementCount).toBe(0)
    })
  })

  it('onlyInstance 模式：注册 onScopeDispose，销毁时移除容器', () => {
    withScope((dispose) => {
      const dialog = useDialog(undefined, { onlyInstance: true })
      dialog({ title: 'x' })
      expect(mockOnScopeDispose).toHaveBeenCalledTimes(1)

      dispose()

      expect(mockRender).toHaveBeenCalledWith(null, expect.anything())
      expect(document.body.childElementCount).toBe(0)
    })
  })

  it('不在组件 setup 里调用（无作用域）→ 不注册清理，不抛错', () => {
    const dialog = useDialog()
    expect(mockOnScopeDispose).not.toHaveBeenCalled()
    expect(typeof dialog).toBe('function')
  })
})
