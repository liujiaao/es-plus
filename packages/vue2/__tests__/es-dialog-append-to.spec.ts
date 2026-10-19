/**
 * EsDialog 的 appendTo 选项（Vue 2 / Element UI 侧）。
 *
 * `appendTo` 此前只在 props 里声明、模板从不读 —— 声明式
 * `<es-dialog append-to="#app">` 被**静默丢弃**（与 cacheKey 同族）。
 *
 * Element UI 2.x 的 el-dialog **没有选择器级挂载点**，只有布尔
 * `append-to-body`（三端里唯一的能力缺口）。修复口径：
 *   - `appendTo:'body'`：与 `append-to-body` 语义完全一致，直接落成该布尔；
 *   - 任意其它选择器 / DOM 元素：同样打开 `append-to-body`（至少脱离当前层级），
 *     并**显式告警**「Element UI 不支持选择器级挂载」—— 降级可以，静默不行。
 *
 * 用 el-dialog 桩接住真实 props（元素属性层面看不出绑定的是计算属性还是字面量）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Vue from 'vue'
import EsDialog from '../src/components/es-dialog/component.vue'
import RenderJsx from '../src/components/es-dialog/render-jsx.vue'

let captured: Record<string, unknown> | null = null

const ElDialogStub = {
  name: 'ElDialog',
  props: ['appendToBody'],
  mounted(this: { $props: Record<string, unknown> }) {
    captured = { ...this.$props }
  },
  render(h: (tag: string) => unknown) {
    return h('div')
  },
}

const mountDialog = async (propsData: Record<string, unknown> = {}) => {
  captured = null
  const vm = new (Vue as unknown as new (o: unknown) => { $mount: () => unknown; $nextTick: () => Promise<void> })({
    ...(EsDialog as unknown as Record<string, unknown>),
    components: { RenderJsx, 'el-dialog': ElDialogStub },
    propsData: { visible: true, ...propsData },
  }).$mount()
  await (vm as { $nextTick: () => Promise<void> }).$nextTick()
  return vm
}

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
})

describe('EsDialog（vue2）— appendTo 选项', () => {
  it('不传 appendTo → appendToBody 保持 false（行为与修复前一致）', async () => {
    await mountDialog()
    expect(captured?.appendToBody).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("appendTo='body' → 落成 append-to-body，且不告警（语义完全等价）", async () => {
    await mountDialog({ appendTo: 'body' })
    expect(captured?.appendToBody).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('appendTo 选择器 → 打开 append-to-body，并显式告警能力缺口（不静默）', async () => {
    await mountDialog({ appendTo: '#app' })
    expect(captured?.appendToBody).toBe(true)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0][0])).toContain('appendTo')
    expect(String(warnSpy.mock.calls[0][0])).toContain('#app')
  })

  it('显式 appendToBody 仍然生效（旧用法零回归）', async () => {
    await mountDialog({ appendToBody: true })
    expect(captured?.appendToBody).toBe(true)
  })
})
