/**
 * EsDialog 的 showClose 选项（Vue 2 / Element UI 侧）。
 *
 * 与 vue3 同形：模板把 `:show-close` **硬编码成 false**（component.vue:15），props 里
 * 也没声明 `showClose`（它是 core 的 `DialogOptions.showClose`，README 写着默认 true）。
 * 硬编码只在**内置头部**下成立 —— 内置 `.btns` 里自绘了一个 `.el-icon-close`。
 * 一旦调用方传入 `renderHeader`，自绘的随 `v-else` 消失、原生 X 又被关掉
 * ⇒ 弹窗**完全没有关闭入口**。
 *
 * 本包没有 @vue/test-utils，故直接用 Vue 2.7 的构造函数挂载（`sfc-template-compile.spec.ts`
 * 已确认 vue-template-compiler 能编译本包 SFC），并用一个 el-dialog 桩接住下发值 ——
 * 元素属性层面的断言看不出「绑定的是计算属性还是字面量 false」，接住真实 props 才能。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Vue from 'vue'
import EsDialog from '../src/components/es-dialog/component.vue'
import RenderJsx from '../src/components/es-dialog/render-jsx.vue'

/** el-dialog 桩：把收到的 props 抄进 captured，供断言读取 */
let captured: Record<string, unknown> | null = null

const ElDialogStub = {
  name: 'ElDialog',
  props: ['showClose'],
  mounted(this: { $props: Record<string, unknown> }) {
    captured = { ...this.$props }
  },
  render(h: (tag: string) => unknown) {
    // 渲染出 header / footer 具名插槽，保证自绘头部那一支真的被渲染
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
  await Vue.nextTick()
  await Vue.nextTick()
  return vm as unknown as { $el: HTMLElement; showNativeClose: boolean; showClose: boolean }
}

beforeEach(() => {
  captured = null
})

describe('EsDialog（vue2）— showClose 选项', () => {
  it('内置头部 + 不传 showClose → 原生 X 关闭（不出现两个 X）', async () => {
    await mountDialog()
    expect(captured?.showClose).toBe(false)
  })

  it('内置头部 + showClose:true → 仍只有一个 X（自绘的那个）', async () => {
    await mountDialog({ showClose: true })
    expect(captured?.showClose).toBe(false)
  })

  it('自定义 renderHeader + 不传 showClose → 放行原生 X（修复「完全没有关闭入口」）', async () => {
    await mountDialog({ renderHeader: () => null })
    expect(captured?.showClose).toBe(true)
  })

  it('自定义 renderHeader + showClose:false → false 优先于头部模式', async () => {
    await mountDialog({ renderHeader: () => null, showClose: false })
    expect(captured?.showClose).toBe(false)
  })

  it('showClose 有 default true（不是 undefined），否则自绘 X 的 v-show 闸门会把默认状态关掉', async () => {
    const vm = await mountDialog()
    expect(vm.showClose).toBe(true)
  })
})
