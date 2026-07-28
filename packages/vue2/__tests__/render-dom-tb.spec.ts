import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/vue-compat', async () => {
  const actual = await vi.importActual<any>('../src/vue-compat')
  return {
    ...actual,
    h: (tag: string, children?: any) => ({ __tag: tag, __ch: children }),
  }
})

import RenderDomTb, { RenderSlotBridge } from '../src/components/es-table/engines/render-dom-tb'

function renderDomTb(props: Record<string, any>): any {
  return (RenderDomTb as any).render.call({ $props: props })
}

function renderSlotBridge(props: Record<string, any>): any {
  return (RenderSlotBridge as any).render.call({ $props: props })
}

describe('RenderDomTb', () => {
  it('row=null → 返回 h("span", ["-"])', () => {
    const result = renderDomTb({ row: null, index: 0, dataKey: '', render: vi.fn() })
    expect(result.__tag).toBe('span')
    expect(result.__ch).toContain('-')
  })

  it('render 为 undefined（falsy）→ 返回 h("span", ["-"])', () => {
    const result = renderDomTb({ row: { id: 1 }, index: 0, dataKey: '', render: undefined })
    expect(result.__tag).toBe('span')
    expect(result.__ch).toContain('-')
  })

  it('正常渲染：调用 render(h, { value, row, index }) 并返回其 VNode', () => {
    const vnode = { __tag: 'div' }
    const renderFn = vi.fn().mockReturnValue(vnode)
    const row = { id: 1, name: 'Alice' }
    const result = renderDomTb({ row, index: 5, dataKey: '', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: null, row, index: 5 })
    )
    expect(result).toBe(vnode)
  })

  it('dataKey 有值 → value = row[dataKey] 传入 render', () => {
    const renderFn = vi.fn().mockReturnValue({ __tag: 'span' })
    const row = { id: 1, name: 'Alice' }
    renderDomTb({ row, index: 0, dataKey: 'name', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: 'Alice' })
    )
  })

  it('dataKey 为空 → value = null 传入 render', () => {
    const renderFn = vi.fn().mockReturnValue({ __tag: 'span' })
    const row = { id: 1, name: 'Alice' }
    renderDomTb({ row, index: 0, dataKey: '', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: null })
    )
  })

  it('dataKey 对应的 key 在 row 中不存在 → value = undefined', () => {
    const renderFn = vi.fn().mockReturnValue({ __tag: 'span' })
    renderDomTb({ row: { id: 1 }, index: 2, dataKey: 'missing', render: renderFn })
    expect(renderFn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ value: undefined, index: 2 })
    )
  })

  it('render 返回字符串 → 包装为 h("span", [result])', () => {
    const renderFn = vi.fn().mockReturnValue('hello world')
    const result = renderDomTb({ row: {}, index: 0, dataKey: '', render: renderFn })
    expect(result.__tag).toBe('span')
    expect(result.__ch).toContain('hello world')
  })

  it('render 返回非字符串 VNode → 直接返回', () => {
    const vnode = { __tag: 'div', content: 'test' }
    const renderFn = vi.fn().mockReturnValue(vnode)
    const result = renderDomTb({ row: {}, index: 0, dataKey: '', render: renderFn })
    expect(result).toBe(vnode)
  })

  it('render 抛出异常 → catch 后回退到 h("span", ["-"])', () => {
    const renderFn = vi.fn().mockImplementation(() => { throw new Error('render error') })
    const result = renderDomTb({ row: {}, index: 0, dataKey: '', render: renderFn })
    expect(result.__tag).toBe('span')
    expect(result.__ch).toContain('-')
  })

  it('row 是空对象 → 不进入 falsy 分支（正常调用 render）', () => {
    const renderFn = vi.fn().mockReturnValue({ __tag: 'span' })
    renderDomTb({ row: {}, index: 0, dataKey: '', render: renderFn })
    expect(renderFn).toHaveBeenCalledOnce()
  })
})

describe('RenderSlotBridge', () => {
  it('正常调用 slotFn(slotProps) 并返回其 VNode', () => {
    const vnode = { __tag: 'div' }
    const slotFn = vi.fn().mockReturnValue(vnode)
    const slotProps = { row: { id: 1 }, column: {} }
    const result = renderSlotBridge({ slotFn, slotProps })
    expect(slotFn).toHaveBeenCalledWith(slotProps)
    expect(result).toBe(vnode)
  })

  it('slotFn 返回 null → fallback h("span")', () => {
    const slotFn = vi.fn().mockReturnValue(null)
    const result = renderSlotBridge({ slotFn, slotProps: {} })
    expect(result.__tag).toBe('span')
  })

  it('slotFn 返回 undefined → fallback h("span")', () => {
    const slotFn = vi.fn().mockReturnValue(undefined)
    const result = renderSlotBridge({ slotFn, slotProps: {} })
    expect(result.__tag).toBe('span')
  })

  it('slotFn 返回 false（falsy）→ fallback h("span")', () => {
    const slotFn = vi.fn().mockReturnValue(false as any)
    const result = renderSlotBridge({ slotFn, slotProps: {} })
    expect(result.__tag).toBe('span')
  })

  it('slotFn 抛出异常 → catch 后返回 h("span")', () => {
    const slotFn = vi.fn().mockImplementation(() => { throw new Error('slot error') })
    const result = renderSlotBridge({ slotFn, slotProps: {} })
    expect(result.__tag).toBe('span')
  })

  it('slotProps 被完整传入 slotFn', () => {
    const slotFn = vi.fn().mockReturnValue({ __tag: 'div' })
    const slotProps = { row: { id: 1 }, extra: 'data' }
    renderSlotBridge({ slotFn, slotProps })
    expect(slotFn).toHaveBeenCalledWith(slotProps)
  })

  it('slotFn 返回有效 VNode（非 null）→ 不走 fallback', () => {
    const vnode = { __tag: 'p', __ch: 'content' }
    const slotFn = vi.fn().mockReturnValue(vnode)
    const result = renderSlotBridge({ slotFn, slotProps: {} })
    expect(result).toBe(vnode)
  })
})
