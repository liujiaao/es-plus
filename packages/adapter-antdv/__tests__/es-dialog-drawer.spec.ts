/**
 * EsDialog 的 type / direction（W3-4：CRUD Drawer 选项，Ant Design Vue 侧）。
 *
 * a-modal 与 a-drawer 的差异：
 *   - 方向：modal 无方向；drawer 用 placement（right/left/top/bottom），
 *     由组件的 direction（rtl/ltr/ttb/btt）映射而来；
 *   - 尺寸：drawer 横向用 width、纵向用 height，都取 width 这个同一个尺寸旋钮；
 *   - 关闭事件：modal 用 cancel，drawer 用 close（它没有 cancel）。
 *
 * 另外钉住一条顺带修正的关闭链缺陷：antd 的 Modal / Drawer 在关闭时**先** emit
 * update:open(false)、**再** emit cancel / close（源码两行相邻）。此前 onUpdateOpen
 * 对 false 也调 handleClose，于是 update:open(false) + cancel 让 beforeClose 在一次
 * 关闭里跑两遍。现在 update:open 只处理「打开」，关闭只由 close/cancel 一条路走。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { nextTick, h } from 'vue'
import { mount } from '@vue/test-utils'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(EsDialog, {
    props: { visible: true, render: () => null, ...props },
  })
  await nextTick()
  await nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountDialog>>
const aDrawer = (wrapper: Wrapper) => wrapper.findComponent({ name: 'ADrawer' })
const aModal = (wrapper: Wrapper) => wrapper.findComponent({ name: 'AModal' })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog — type: drawer（底座切换）', () => {
  it('默认仍是 a-modal：不传 type 时渲染路径零变化', async () => {
    const wrapper = await mountDialog()
    expect(aModal(wrapper).exists()).toBe(true)
    expect(aDrawer(wrapper).exists()).toBe(false)
  })

  it("type:'drawer' → 底座换成 a-drawer，placement 由 direction 映射", async () => {
    const wrapper = await mountDialog({ type: 'drawer' })
    expect(aDrawer(wrapper).exists()).toBe(true)
    expect(aModal(wrapper).exists()).toBe(false)
    expect(aDrawer(wrapper).props('placement')).toBe('right')
    expect(aDrawer(wrapper).props('width')).toBe('600px')
  })

  it('direction 映射：ltr→left、ttb→top、btt→bottom；纵向时尺寸走 height', async () => {
    const ltr = await mountDialog({ type: 'drawer', direction: 'ltr' })
    expect(aDrawer(ltr).props('placement')).toBe('left')

    const ttb = await mountDialog({ type: 'drawer', direction: 'ttb', width: 360 })
    expect(aDrawer(ttb).props('placement')).toBe('top')
    expect(aDrawer(ttb).props('height')).toBe(360)
    expect(aDrawer(ttb).props('width')).toBeUndefined()

    const btt = await mountDialog({ type: 'drawer', direction: 'btt' })
    expect(aDrawer(btt).props('placement')).toBe('bottom')
  })

  it('drawer 没有全屏态：头部全屏按钮不渲染（只剩关闭）', async () => {
    await mountDialog({ type: 'drawer' })
    // a-drawer 默认 teleport 到 body，wrapper.find 看不到 portal 里的内容
    expect(document.body.querySelectorAll('.es-dialog-header-actions button').length).toBe(1)
  })

  it('dialog 下两个按钮都在（对照：隐藏只发生在 drawer）', async () => {
    await mountDialog()
    expect(document.body.querySelectorAll('.es-dialog-header-actions button').length).toBe(2)
  })

  it('footer 走 a-drawer 的 footer 槽（与 modal 同一套 configBtn）', async () => {
    const wrapper = await mountDialog({
      type: 'drawer',
      configBtn: [{ name: '确定', type: 'primary' }],
    })
    expect(aDrawer(wrapper).vm.$slots.footer).toBeTruthy()
  })

  it('render 与声明式子节点共用同一条正文路径', async () => {
    await mountDialog({
      type: 'drawer',
      render: () => h('div', { class: 'drawer-content' }, '内容'),
    })
    // 同上：正文在 teleport 出去的 .ant-drawer-body 里
    expect(document.body.querySelector('.drawer-content')).not.toBeNull()
  })

  it('关闭只走一条路：update:open(false) + close 同发，beforeClose 只跑一次且可拦下', async () => {
    // beforeClose 不调 done → 关闭被拦下，弹窗仍开着
    const beforeClose = vi.fn()
    const wrapper = await mountDialog({ type: 'drawer', beforeClose })
    const drawer = aDrawer(wrapper)
    // antd 关闭时的真实顺序（Drawer.js close：先 update:open，再 close）
    drawer.vm.$emit('update:open', false)
    drawer.vm.$emit('close')
    await nextTick()
    expect(beforeClose).toHaveBeenCalledTimes(1)
    expect(aDrawer(wrapper).props('open')).toBe(true)
  })
})
