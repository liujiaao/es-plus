/**
 * EsDialog 的 type / direction（W3-4：CRUD Drawer 选项，Element Plus 侧）。
 *
 * 修复前的实况：`useDialog` 只有 dialog 一种底座，业务要做「列表 → 抽屉详情」只能
 * 绕过组件自建一个 el-drawer —— render / configBtn / beforeClose / cacheKey 缓存 /
 * 权限过滤这些能力在抽屉里全部拿不到。
 *
 * 现在 type 是 EsDialog 的声明 prop：`'drawer'` 把底座换成 el-drawer，其余能力
 * （头/身/脚、关闭链、缓存）复用同一份实现。两个底座共用 v-model / before-close /
 * header / footer 插槽，差异只落在 hostProps：
 *   - 抽屉用 size（横向管宽、纵向管高），弹窗用 width；
 *   - 抽屉没有 draggable / fullscreen（全屏图标隐藏，handleFullscreen 置空）。
 *
 * 断言读**真实 el-drawer 收到的 props**：只查 DOM 看不出「prop 声明了但没绑」。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick, h } from 'vue'
import { mount } from '@vue/test-utils'
import { ElDialog, ElDrawer } from 'element-plus'
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
const elDrawer = (wrapper: Wrapper) => wrapper.findComponent(ElDrawer)
/** 自绘图标：第一个是全屏、第二个是关闭；v-show=false 时留下内联 display:none */
const iconHidden = (wrapper: Wrapper, index: number) =>
  (wrapper.findAll('.btns .el-icon')[index]?.attributes('style') || '').includes('display: none')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog — type: drawer（底座切换）', () => {
  it('默认仍是 el-dialog：不传 type 时渲染路径零变化', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.findComponent(ElDialog).exists()).toBe(true)
    expect(elDrawer(wrapper).exists()).toBe(false)
  })

  it("type:'drawer' → 底座换成 el-drawer，尺寸旋钮 width 映射到 size", async () => {
    const wrapper = await mountDialog({ type: 'drawer', width: 420 })
    expect(elDrawer(wrapper).exists()).toBe(true)
    expect(wrapper.findComponent(ElDialog).exists()).toBe(false)
    expect(elDrawer(wrapper).props('size')).toBe(420)
    expect(elDrawer(wrapper).props('direction')).toBe('rtl')
  })

  it('direction 原样下发；ttb / btt 时 size 仍是同一个尺寸旋钮', async () => {
    const wrapper = await mountDialog({ type: 'drawer', direction: 'btt', width: '40%' })
    expect(elDrawer(wrapper).props('direction')).toBe('btt')
    expect(elDrawer(wrapper).props('size')).toBe('40%')
  })

  it('drawer 没有全屏态：全屏图标隐藏，关闭图标照常', async () => {
    const wrapper = await mountDialog({ type: 'drawer' })
    expect(iconHidden(wrapper, 0)).toBe(true)
    expect(iconHidden(wrapper, 1)).toBe(false)
  })

  it('dialog 下两个图标都可见（对照：隐藏只发生在 drawer）', async () => {
    const wrapper = await mountDialog()
    expect(iconHidden(wrapper, 0)).toBe(false)
    expect(iconHidden(wrapper, 1)).toBe(false)
  })

  it('footer 用 el-drawer 自己的 footer 槽（不在正文里，也不丢按钮）', async () => {
    const wrapper = await mountDialog({
      type: 'drawer',
      configBtn: [{ name: '确定', type: 'primary' }],
    })
    expect(elDrawer(wrapper).vm.$slots.footer).toBeTruthy()
  })

  it('render 与声明式子节点共用同一条正文路径（抽屉不另写一套）', async () => {
    const wrapper = await mountDialog({
      type: 'drawer',
      render: () => h('div', { class: 'drawer-content' }, '内容'),
    })
    expect(wrapper.find('.drawer-content').exists()).toBe(true)
  })

  it('appendTo 同样转发给 el-drawer（teleport 目标一致）', async () => {
    // teleport 的目标必须在挂载前存在（Element Plus 直接 :to 该选择器）
    const host = document.createElement('div')
    host.id = 'drawer-host'
    document.body.appendChild(host)
    const wrapper = await mountDialog({ type: 'drawer', appendTo: '#drawer-host' })
    expect(elDrawer(wrapper).props('appendTo')).toBe('#drawer-host')
    expect(elDrawer(wrapper).props('appendToBody')).toBe(true)
  })

  it('dialog 专有的透传属性不落到 drawer 根节点（静默不生效的东西不给它）', async () => {
    const wrapper = await mountDialog({ type: 'drawer', alignCenter: true, top: '10vh' })
    const root = elDrawer(wrapper)
    expect(root.attributes('align-center')).toBeUndefined()
    expect(root.attributes('top')).toBeUndefined()
  })
})
