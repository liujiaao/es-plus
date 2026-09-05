/**
 * adapter-antdv useDialog 单元测试
 *
 * 覆盖：
 *   - 默认模式（onlyInstance:false）：复用容器、close、destroy
 *   - onlyInstance:true 模式：每次创建新容器
 *   - onClosed / onSubmit 回调包装
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
  }
})

import { createVNode, render } from 'vue'
import { useDialog } from '../src/components/es-dialog/src/use-dialog'

const mockCreateVNode = createVNode as ReturnType<typeof vi.fn>
const mockRender = render as ReturnType<typeof vi.fn>

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

  it('onSubmit 回调被包装：调用后触发 close', () => {
    const onSubmit = vi.fn()
    const dialog = useDialog()
    dialog({ onSubmit })
    const mergedOnSubmit = mockCreateVNode.mock.calls[0][1]?.onSubmit
    const closeFn = vi.fn()
    mergedOnSubmit?.(closeFn)
    expect(onSubmit).toHaveBeenCalledWith(closeFn)
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

  it('onlyInstance 模式没有 destroy 方法', () => {
    const dialog = useDialog(undefined, { onlyInstance: true })
    expect((dialog as any).destroy).toBeUndefined()
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
