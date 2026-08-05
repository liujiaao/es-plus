import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures these variables are available before vi.mock() factories run
const { MockCtor, mockVue } = vi.hoisted(() => {
  const MockCtor = vi.fn()
  const mockVue = {
    extend: vi.fn(() => MockCtor),
  }
  return { MockCtor, mockVue }
})

vi.mock('../src/vue-compat', async () => {
  const actual = await vi.importActual<any>('../src/vue-compat')
  return {
    ...actual,
    Vue: mockVue,
  }
})

// Avoid importing the actual EsDialog SFC (requires compiled Vue build + Element UI)
vi.mock('../src/components/es-dialog/component.vue', () => ({
  default: { name: 'EsDialogMock' },
}))

import { useDialog } from '../src/components/es-dialog/use-dialog'

// ─── Mock vm factory ──────────────────────────────────────────────────────────

function createMockVm(extra: Record<string, any> = {}) {
  return {
    $on: vi.fn(),
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
