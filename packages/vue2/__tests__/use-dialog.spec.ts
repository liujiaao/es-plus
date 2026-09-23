import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures these variables are available before vi.mock() factories run
const { MockCtor, mockVue, mockGetCurrentInstance, mockOnUnmounted } = vi.hoisted(() => {
  const MockCtor = vi.fn()
  const mockVue = {
    extend: vi.fn(() => MockCtor),
  }
  // 默认 null = 「不在组件 setup 里调用」：与真实 Composition API 的语义一致，
  // useDialog 因此不注册卸载清理（既有用例都不挂组件）。
  const mockGetCurrentInstance = vi.fn(() => null)
  const mockOnUnmounted = vi.fn()
  return { MockCtor, mockVue, mockGetCurrentInstance, mockOnUnmounted }
})

vi.mock('../src/vue-compat', async () => {
  const actual = await vi.importActual<any>('../src/vue-compat')
  return {
    ...actual,
    Vue: mockVue,
    getCurrentInstance: mockGetCurrentInstance,
    onUnmounted: mockOnUnmounted,
  }
})

// Avoid importing the actual EsDialog SFC (requires compiled Vue build + Element UI)
vi.mock('../src/components/es-dialog/component.vue', () => ({
  default: { name: 'EsDialogMock' },
}))

import { useDialog } from '../src/components/es-dialog/use-dialog'

// ─── Mock vm factory ──────────────────────────────────────────────────────────

function createMockVm(extra: Record<string, any> = {}) {
  // $on/$off 既是 spy 也是一套真的监听表：既有用例靠 .mock.calls 断言注册行为，
  // 而「回调是否真的被换掉」只有真的把事件发一遍才验得出来。
  const listeners: Record<string, Function[]> = {}
  return {
    $on: vi.fn((event: string, handler: Function) => {
      ;(listeners[event] = listeners[event] || []).push(handler)
    }),
    $off: vi.fn((event: string, handler?: Function) => {
      if (!handler) {
        delete listeners[event]
        return
      }
      listeners[event] = (listeners[event] || []).filter((h) => h !== handler)
    }),
    $emit: (event: string, ...args: unknown[]) => {
      ;(listeners[event] || []).slice().forEach((h) => h(...args))
    },
    $mount: vi.fn(),
    $el: document.createElement('div'),
    $destroy: vi.fn(),
    // 复用实例时 applyOptionsToVm 按「组件已声明的 prop」决定直写 vm[k] 还是汇入透传属性；
    // 真实 EsDialog 声明了这些 prop，mock 须同样声明，否则 title 等会被当未声明属性丢弃。
    $options: {
      props: {
        title: {}, visible: {}, width: {}, destroyOnClose: {},
        appendTo: {}, loading: {}, maxHeight: {}, isDraggable: {},
        configBtn: {}, render: {}, fullscreen: {},
      },
    },
    visible: false,
    ...extra,
  }
}

let vm: ReturnType<typeof createMockVm>

beforeEach(() => {
  vi.clearAllMocks()
  vm = createMockVm()
  MockCtor.mockImplementation(() => vm)
  mockVue.extend.mockImplementation(() => MockCtor)
})

// ─── extractEventHandlers —— 通过 initInstance 间接验证 ──────────────────────
describe('extractEventHandlers', () => {
  it('onXxx 函数属性 → 被转为 $on("xxx", handler) 监听', () => {
    const onClosed = vi.fn()
    const dialog = useDialog()
    dialog({ onClosed } as any)
    expect(vm.$on).toHaveBeenCalledWith('closed', expect.any(Function))
  })

  it('on 开头但 value 不是函数 → 作为 propsData 传入，不注册 $on', () => {
    const dialog = useDialog()
    dialog({ onSomeProp: 'not-a-fn' } as any)
    expect(MockCtor).toHaveBeenCalledWith(expect.objectContaining({
      propsData: expect.objectContaining({ onSomeProp: 'not-a-fn' }),
    }))
    const onCalls: any[] = (vm.$on as any).mock.calls
    expect(onCalls.some((c: any) => c[0] === 'someProp')).toBe(false)
  })

  it('普通 props（title、width）进入 propsData', () => {
    const dialog = useDialog()
    dialog({ title: 'My Dialog', width: '80%' } as any)
    expect(MockCtor).toHaveBeenCalledWith(expect.objectContaining({
      propsData: expect.objectContaining({ title: 'My Dialog', width: '80%' }),
    }))
  })
})

// ─── initInstance —— DOM 挂载路径 ─────────────────────────────────────────────
describe('initInstance — DOM 挂载', () => {
  it('$mount() 被调用', () => {
    const dialog = useDialog()
    dialog({} as any)
    expect(vm.$mount).toHaveBeenCalled()
  })

  it('vm.$el 被 appendChild 到 document.body（默认 appendTo）', () => {
    const spy = vi.spyOn(document.body, 'appendChild')
    const dialog = useDialog()
    dialog({} as any)
    expect(spy).toHaveBeenCalledWith(vm.$el)
    spy.mockRestore()
  })

  it('appendTo 为 HTMLElement → 追加到该元素', () => {
    const target = document.createElement('div')
    const spy = vi.spyOn(target, 'appendChild')
    const dialog = useDialog()
    dialog({ appendTo: target } as any)
    expect(spy).toHaveBeenCalledWith(vm.$el)
    spy.mockRestore()
  })

  it('Vue.extend 被调用（传入组件定义）', () => {
    const dialog = useDialog()
    dialog({} as any)
    expect(mockVue.extend).toHaveBeenCalled()
  })
})

// ─── 单例模式（默认 onlyInstance:false）──────────────────────────────────────
describe('useDialog — 单例模式', () => {
  it('首次调用 → 创建实例', () => {
    const dialog = useDialog()
    dialog({} as any)
    expect(MockCtor).toHaveBeenCalledTimes(1)
  })

  it('第二次调用 → 复用实例，不再 extend', () => {
    const dialog = useDialog()
    dialog({} as any)
    const extendCount = (mockVue.extend as any).mock.calls.length
    dialog({ title: 'Again' } as any)
    expect((mockVue.extend as any).mock.calls.length).toBe(extendCount)
    expect(MockCtor).toHaveBeenCalledTimes(1)
  })

  it('第二次调用 → 把非 on 属性写入 vm 并设置 visible=true', () => {
    const dialog = useDialog()
    dialog({} as any)
    dialog({ title: 'Updated' } as any)
    expect((vm as any).title).toBe('Updated')
    expect(vm.visible).toBe(true)
  })

  it('默认 propsData 包含 visible:true, width:"50%", destroyOnClose:true', () => {
    const dialog = useDialog()
    dialog({} as any)
    expect(MockCtor).toHaveBeenCalledWith(expect.objectContaining({
      propsData: expect.objectContaining({
        visible: true,
        width: '50%',
        destroyOnClose: true,
      }),
    }))
  })

  it('close() → vm.visible 设为 false', () => {
    const dialog = useDialog()
    dialog({} as any)
    vm.visible = true
    dialog.close()
    expect(vm.visible).toBe(false)
  })

  it('close() 在无实例时不抛出', () => {
    const dialog = useDialog()
    expect(() => dialog.close()).not.toThrow()
  })

  it('destroy() → 调用 $destroy 并从 parentNode 移除', () => {
    const parent = document.createElement('div')
    parent.appendChild(vm.$el)
    const dialog = useDialog()
    dialog({} as any)
    dialog.destroy()
    expect(vm.$destroy).toHaveBeenCalled()
    expect(parent.contains(vm.$el)).toBe(false)
  })

  it('destroy() → vm 引用清除，下次调用创建新实例', () => {
    const dialog = useDialog()
    dialog({} as any)
    dialog.destroy()
    const vm2 = createMockVm()
    MockCtor.mockImplementation(() => vm2)
    dialog({} as any)
    expect(MockCtor).toHaveBeenCalledTimes(2)
  })

  it('destroy() 在无实例时不抛出', () => {
    const dialog = useDialog()
    expect(() => dialog.destroy()).not.toThrow()
  })

  it('关闭链路经 update:visible 桥接翻转 vm.visible=false（编程式无父级 .sync）', () => {
    const dialog = useDialog()
    dialog({} as any)
    vm.visible = true
    // 编程式实例无父级 :visible.sync 回写，initInstance 注册 update:visible→vm.visible 桥接，
    // 组件自身关闭（X/取消/遮罩/ESC）emit('update:visible', false) 经此翻转 visible 真正收起。
    const bridgeCall = (vm.$on as any).mock.calls.find((c: any) => c[0] === 'update:visible')
    expect(bridgeCall).toBeDefined()
    bridgeCall[1](false)
    expect(vm.visible).toBe(false)
  })

  it('用户提供的 onClosed 在内置逻辑中被调用', () => {
    const originalOnClosed = vi.fn()
    const dialog = useDialog()
    dialog({ onClosed: originalOnClosed } as any)
    const closedCall = (vm.$on as any).mock.calls.find((c: any) => c[0] === 'closed')
    closedCall[1]()
    expect(originalOnClosed).toHaveBeenCalled()
  })
})

// ─── onlyInstance 模式 ────────────────────────────────────────────────────────
describe('useDialog — onlyInstance 模式', () => {
  it('每次调用都创建新实例', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    dialog({ visible: true } as any)
    const vm2 = createMockVm()
    MockCtor.mockImplementation(() => vm2)
    dialog({ visible: true } as any)
    expect(MockCtor).toHaveBeenCalledTimes(2)
  })

  it('onlyInstance 模式同样暴露 destroy 方法（对齐 vue3/ 统一两端）', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    // 统一两端 API：onlyInstance 模式同样提供 destroy（传 cacheKey 只销毁该缓存实例）
    expect(typeof (dialog as any).destroy).toBe('function')
    expect(() => (dialog as any).destroy()).not.toThrow()
  })

  it('暴露 close 方法', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    expect(typeof dialog.close).toBe('function')
  })

  it('close() → 设置 vm.visible=false', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    dialog({} as any)
    vm.visible = true
    dialog.close()
    expect(vm.visible).toBe(false)
  })

  it('close() → 300ms 后调用 $destroy', () => {
    vi.useFakeTimers()
    try {
      const dialog = useDialog(undefined, { onlyInstance: true })
      dialog({} as any)
      vm.visible = true // close() 守卫 visible===false 早退；开启态方进入延迟销毁分支
      dialog.close()
      expect(vm.$destroy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(300)
      expect(vm.$destroy).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('close() → 300ms 后从 DOM 中移除 $el', () => {
    vi.useFakeTimers()
    try {
      const parent = document.createElement('div')
      parent.appendChild(vm.$el)
      const dialog = useDialog(undefined, { onlyInstance: true })
      dialog({} as any)
      dialog.close()
      vi.advanceTimersByTime(300)
      expect(parent.contains(vm.$el)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('可传入自定义组件', () => {
    const CustomComp = { name: 'Custom' }
    const dialog = useDialog(CustomComp, { onlyInstance: true })
    dialog({} as any)
    expect(mockVue.extend).toHaveBeenCalledWith(CustomComp)
  })
})

// ─── 延迟销毁竞态：关闭后 300ms 内重开，旧回调不得销毁新实例 ─────────────────────
describe('useDialog — 延迟销毁竞态', () => {
  const findClosedHandler = () =>
    (vm.$on as any).mock.calls.find((c: any) => c[0] === 'closed')?.[1]

  it('onlyInstance: close() 的延迟销毁只作用于被关闭的旧实例', () => {
    vi.useFakeTimers()
    try {
      const dialog = useDialog(undefined, { onlyInstance: true })
      dialog({} as any)
      vm.visible = true
      dialog.close() // 武装 300ms 延迟销毁，目标应为 vm

      // 关闭后 300ms 内重开 → 创建新实例 vm2 并覆盖 lastVm
      const vm2 = createMockVm()
      MockCtor.mockImplementation(() => vm2)
      dialog({ visible: true } as any)

      vi.advanceTimersByTime(300)
      expect(vm.$destroy).toHaveBeenCalled()
      expect(vm2.$destroy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('onlyInstance: onClosed 的延迟销毁只作用于本次创建的实例', () => {
    vi.useFakeTimers()
    try {
      const dialog = useDialog(undefined, { onlyInstance: true })
      dialog({ onClosed: vi.fn() } as any)
      findClosedHandler()()

      const vm2 = createMockVm()
      MockCtor.mockImplementation(() => vm2)
      dialog({ visible: true, onClosed: vi.fn() } as any)

      vi.advanceTimersByTime(300)
      expect(vm.$destroy).toHaveBeenCalled()
      expect(vm2.$destroy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('单例: 300ms 内重开后，旧的 onClosed 延迟销毁不销毁复用中的实例', () => {
    vi.useFakeTimers()
    try {
      const dialog = useDialog()
      dialog({ onClosed: vi.fn() } as any)
      findClosedHandler()() // 武装延迟销毁

      // 重开：单例复用同一 vm 并 visible=true
      dialog({ title: 'reopen' } as any)
      expect(vm.visible).toBe(true)

      vi.advanceTimersByTime(300)
      expect(vm.$destroy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─── 回归：缓存实例的回调必须能更新（此前 pickProps + applyOptionsToVm 双双丢弃 on*）──
describe('useDialog — cacheKey 复用时的回调更新', () => {
  it('同一 cacheKey 第二次打开：新 onClosed 生效，旧回调不再被调用', () => {
    const first = vi.fn()
    const second = vi.fn()
    const dialog = useDialog()
    dialog({ cacheKey: 'k-cb', onClosed: first } as any)
    dialog({ cacheKey: 'k-cb', onClosed: second } as any)

    // 真的把 'closed' 发一遍（mock vm 的 $on/$off 是一套真的监听表）
    ;(vm as any).$emit('closed', true)

    // 回归：此前 pickProps 剥光 on*、applyOptionsToVm 又跳过 on*，
    // 这次调用什么也没注册，跑的还是第一次那批回调 —— second 从不被调用
    expect(second).toHaveBeenCalledWith(true)
    expect(first).not.toHaveBeenCalled()
  })

  it('省略 onClosed 时回退到基线回调，而不是继续沿用上一次临时传入的', () => {
    const base = vi.fn()
    const temp = vi.fn()
    const dialog = useDialog()
    dialog({ cacheKey: 'k-fb', onClosed: base } as any)
    dialog({ cacheKey: 'k-fb', onClosed: temp } as any)
    dialog({ cacheKey: 'k-fb' } as any)

    ;(vm as any).$emit('closed', true)

    expect(base).toHaveBeenCalledWith(true)
    expect(temp).not.toHaveBeenCalled()
  })

  it('换回调不会波及挂在同一事件上的 TTL 武装监听：关闭后缓存仍被回收', () => {
    vi.useFakeTimers()
    try {
      const dialog = useDialog()
      dialog({ cacheKey: 'k-keep', onClosed: vi.fn() } as any)
      dialog({ cacheKey: 'k-keep', onClosed: vi.fn() } as any)

      vm.visible = false
      ;(vm as any).$emit('closed', false) // 触发 TTL 武装
      // 摘监听若用「整体 $off('closed')」，就会把这个武装监听一起摘掉 —— 缓存再无回收
      vi.advanceTimersByTime(10 * 60 * 1000)

      expect(vm.$destroy).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─── 回归：宿主组件卸载时的回收（此前 $el 与 TTL 定时器都会活过宿主）───────────
describe('useDialog — 宿主组件卸载时的回收', () => {
  const runInSetup = (fn: () => void) => {
    ;(mockGetCurrentInstance as any).mockReturnValue({})
    try {
      fn()
    } finally {
      ;(mockGetCurrentInstance as any).mockReturnValue(null)
    }
  }

  it('注册 onUnmounted 清理：卸载时销毁缓存实例并从 DOM 摘除 $el', () => {
    runInSetup(() => {
      const dialog = useDialog()
      dialog({ cacheKey: 'k-scope', onClosed: vi.fn() } as any)

      // 回归：此前完全不注册卸载清理（容器是手工 append 的，宿主卸载不会连带移除）
      expect(mockOnUnmounted).toHaveBeenCalledTimes(1)

      const parent = document.createElement('div')
      parent.appendChild(vm.$el)
      expect(vm.$destroy).not.toHaveBeenCalled()

      ;(mockOnUnmounted as any).mock.calls[0][0]()

      expect(vm.$destroy).toHaveBeenCalled()
      expect(parent.contains(vm.$el)).toBe(false)
    })
  })

  it('清理同时清空缓存：卸载后再以同 cacheKey 打开会新建实例', () => {
    runInSetup(() => {
      const dialog = useDialog()
      dialog({ cacheKey: 'k-scope2', onClosed: vi.fn() } as any)
      const created = MockCtor.mock.calls.length

      ;(mockOnUnmounted as any).mock.calls[0][0]()

      dialog({ cacheKey: 'k-scope2', visible: true } as any)
      expect(MockCtor.mock.calls.length).toBe(created + 1)
    })
  })

  it('单例模式同样注册清理，无实例时调用不抛出', () => {
    runInSetup(() => {
      const dialog = useDialog()
      expect(mockOnUnmounted).toHaveBeenCalledTimes(1)
      expect(() => (mockOnUnmounted as any).mock.calls[0][0]()).not.toThrow()
    })
  })
})
