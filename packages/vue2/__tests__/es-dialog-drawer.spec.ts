/**
 * EsDialog 的 type / direction（W3-4：CRUD Drawer 选项，Vue 2 / Element UI 侧）。
 *
 * Element UI 的 el-dialog 与 el-drawer 差异比 Element Plus 大：
 *   - 尺寸键名不同：dialog 用 width，drawer 用 size（横向管宽、纵向管高）；
 *   - drawer **没有 footer 槽**（源码只有 title + default），底部动作区必须放进默认插槽，
 *     否则按钮会静默消失 —— 这正是本测试要钉住的那条；
 *   - 点遮罩关闭在 drawer 上叫 wrapperClosable，dialog 上叫 closeOnClickModal。
 *
 * 用两个桩接住真实 props / 插槽：元素属性层面看不出绑定的是计算属性还是字面量。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Vue from 'vue'
import EsDialog from '../src/components/es-dialog/component.vue'
import RenderJsx from '../src/components/es-dialog/render-jsx.vue'

interface Captured {
  props: Record<string, unknown>
  slots: string[]
}

let drawer: Captured | null = null
let dialog: Captured | null = null

const ElDialogStub = {
  name: 'ElDialog',
  props: [
    'width', 'fullscreen', 'visible', 'showClose', 'appendToBody',
    'modalAppendToBody', 'closeOnClickModal', 'closeOnPressEscape', 'destroyOnClose',
  ],
  mounted(this: { $props: Record<string, unknown>; $slots: Record<string, unknown> }) {
    dialog = { props: { ...this.$props }, slots: Object.keys(this.$slots) }
  },
  render(h: (tag: string) => unknown) {
    return h('div')
  },
}

const ElDrawerStub = {
  name: 'ElDrawer',
  props: [
    'size', 'direction', 'wrapperClosable', 'visible', 'showClose', 'appendToBody',
    'modalAppendToBody', 'closeOnPressEscape', 'destroyOnClose',
  ],
  mounted(this: { $props: Record<string, unknown>; $slots: Record<string, unknown> }) {
    drawer = { props: { ...this.$props }, slots: Object.keys(this.$slots) }
  },
  render(this: { $slots: Record<string, unknown> }, h: (tag: string, data?: unknown, children?: unknown) => unknown) {
    // 默认插槽里应同时有正文与底部动作区（Element UI 的 drawer 没有 footer 槽）
    return h('div', { class: 'el-drawer-stub' }, [
      h('div', { class: 'drawer-title' }, this.$slots.title),
      h('div', { class: 'drawer-body' }, this.$slots.default),
    ])
  },
}

const mountDialog = async (propsData: Record<string, unknown> = {}) => {
  drawer = null
  dialog = null
  const vm = new (Vue as unknown as new (o: unknown) => {
    $mount: () => { $el: Element; $nextTick: () => Promise<void> }
  })({
    ...(EsDialog as unknown as Record<string, unknown>),
    components: { RenderJsx, 'el-dialog': ElDialogStub, 'el-drawer': ElDrawerStub },
    propsData: { visible: true, ...propsData },
  }).$mount()
  const mounted = vm as unknown as { $el: Element; $nextTick: () => Promise<void> }
  await mounted.$nextTick()
  return mounted
}

beforeEach(() => {
  drawer = null
  dialog = null
})

describe('EsDialog（vue2）— type: drawer', () => {
  it('默认仍是 el-dialog：不传 type 时渲染路径零变化', async () => {
    await mountDialog()
    expect(dialog).not.toBeNull()
    expect(drawer).toBeNull()
    expect(dialog!.props.width).toBe('50%')
  })

  it("type:'drawer' → 底座换成 el-drawer，width 映射到 size", async () => {
    await mountDialog({ type: 'drawer' })
    expect(dialog).toBeNull()
    expect(drawer).not.toBeNull()
    expect(drawer!.props.size).toBe('50%')
    expect(drawer!.props.direction).toBe('rtl')
  })

  it('数字宽度转 px；direction 原样下发', async () => {
    await mountDialog({ type: 'drawer', width: 420, direction: 'ltr' })
    expect(drawer!.props.size).toBe('420px')
    expect(drawer!.props.direction).toBe('ltr')
  })

  it('dialog 专有键不下发给 drawer（width / fullscreen 不出现）', async () => {
    await mountDialog({ type: 'drawer', fullscreen: true, isDraggable: true })
    expect(drawer!.props.width).toBeUndefined()
    expect(drawer!.props.fullscreen).toBeUndefined()
  })

  it('点遮罩关闭映射到 wrapperClosable', async () => {
    await mountDialog({ type: 'drawer', closeOnClickModal: false })
    expect(drawer!.props.wrapperClosable).toBe(false)
  })

  it('drawer 没有 footer 槽：底部动作区落在默认插槽里（不静默丢失）', async () => {
    const vm = await mountDialog({
      type: 'drawer',
      configBtn: [{ name: '确定', type: 'primary' }],
    })
    // Element UI 的 el-drawer 只认 title + default，组件不应把 footer 当具名槽塞给它
    expect(drawer!.slots).toContain('default')
    expect(drawer!.slots).not.toContain('footer')
    const footer = vm.$el.querySelector('.es-drawer-footer')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('确定')
  })

  it('isHiddenFooter 时 drawer 里也不出现动作区', async () => {
    const vm = await mountDialog({ type: 'drawer', isHiddenFooter: true, configBtn: [{ name: '确定' }] })
    expect(vm.$el.querySelector('.es-drawer-footer')).toBeNull()
  })
})
