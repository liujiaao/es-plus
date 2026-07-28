import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import RenderDomTb from '../src/components/es-table/src/engines/render-dom-tb'

/**
 * 调用 setup 并执行返回的渲染函数。
 * setup 接收 reactive props，返回渲染函数（闭包）。
 */
function render(props: Record<string, any>): any {
  const setup = (RenderDomTb as any).setup
  const renderFn = setup(reactive(props), {})
  return renderFn()
}

describe('RenderDomTb (adapter-antdv)', () => {
  it('row=null → 返回 span vnode，不调用 render', () => {
    const renderFn = vi.fn()
    const vnode = render({ row: null, index: 0, dataKey: '', render: renderFn })
    expect(vnode.type).toBe('span')
    expect(renderFn).not.toHaveBeenCalled()
  })

  it('row=null → vnode.children 含 "-"', () => {
    const vnode = render({ row: null, index: 0, dataKey: '', render: vi.fn() })
    const children = vnode.children
    const text = Array.isArray(children) ? children.join('') : String(children)
    expect(text).toContain('-')
  })

  it('render(h, { value, row, index }) 参数正确', () => {
    const renderFn = vi.fn().mockReturnValue(null)
    const row = { name: 'Alice' }
    render({ row, index: 2, dataKey: 'name', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      { value: 'Alice', row, index: 2 }
    )
  })

  it('dataKey 有值 → value = row[dataKey]', () => {
    const renderFn = vi.fn().mockReturnValue(null)
    const row = { price: 99 }
    render({ row, index: 0, dataKey: 'price', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: 99 })
    )
  })

  it('dataKey 为空字符串 → value = null', () => {
    const renderFn = vi.fn().mockReturnValue(null)
    render({ row: { a: 1 }, index: 0, dataKey: '', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: null })
    )
  })

  it('render 返回字符串 → 包装为 span vnode', () => {
    const renderFn = vi.fn().mockReturnValue('some text')
    const vnode = render({ row: { a: 1 }, index: 0, dataKey: '', render: renderFn })
    expect(vnode.type).toBe('span')
  })

  it('render 返回 VNode → 直接透传', () => {
    const { h } = require('vue')
    const fakeVNode = h('div', 'content')
    const renderFn = vi.fn().mockReturnValue(fakeVNode)
    const result = render({ row: { a: 1 }, index: 0, dataKey: '', render: renderFn })
    expect(result).toBe(fakeVNode)
  })

  it('render 抛出异常 → 回退返回 span vnode', () => {
    const renderFn = vi.fn().mockImplementation(() => {
      throw new Error('render error')
    })
    const vnode = render({ row: { a: 1 }, index: 0, dataKey: '', render: renderFn })
    expect(vnode.type).toBe('span')
  })

  it('row 为空对象（非 falsy）→ 调用 render', () => {
    const renderFn = vi.fn().mockReturnValue(null)
    render({ row: {}, index: 0, dataKey: 'x', render: renderFn })
    expect(renderFn).toHaveBeenCalled()
  })

  it('dataKey 指向不存在的 key → value = undefined', () => {
    const renderFn = vi.fn().mockReturnValue(null)
    render({ row: { name: 'Bob' }, index: 0, dataKey: 'missing', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: undefined })
    )
  })
})
