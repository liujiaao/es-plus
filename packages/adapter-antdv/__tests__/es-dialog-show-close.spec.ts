/**
 * EsDialog 的 showClose 选项（antdv / Ant Design Vue 侧）。
 *
 * 与 vue3 / vue2 同形同修：模板把 `:closable` **硬编码成 false**，而 `showClose`
 * 虽然声明了 prop（默认 true）却**从未被读过** —— 还被列进 `filteredAttrs` 的忽略
 * 名单，等于彻底死掉。硬编码只在**内置头部**下成立：内置 header-actions 里自绘了
 * 一个 CloseOutlined。一旦调用方传入 `renderHeader`，自绘的随 `v-else` 消失、
 * 原生 X 又被关掉 ⇒ 弹窗**完全没有关闭入口**，且没有任何办法补回来。
 *
 * 这里用**真的** a-modal（ant-design-vue 已装），直接断言它收到的 `closable`
 * 与头部动作区里自绘按钮的个数 —— 该组件在 `<script setup>` 里本地 import，
 * 用 `global.stubs` 按名字打桩拦截不到（stubs 只作用于全局注册的组件）。
 * a-modal 走 teleport 到 body，头部 DOM 因此要查 document.body 而不是 wrapper。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(EsDialog, { props: { visible: true, render: () => null, ...props } })
  // a-modal 的 teleport + 过渡需要多冲几轮微任务才落 DOM
  await nextTick()
  await nextTick()
  await nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountDialog>>
const nativeClosable = (wrapper: Wrapper) =>
  wrapper.findComponent({ name: 'AModal' }).props('closable') as boolean | undefined
/** 内置头部自绘按钮 —— header-actions 里第一个是全屏，第二个才是关闭 */
const headerActionCount = () =>
  document.body.querySelectorAll('.es-dialog-header-actions > *').length

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog（antdv）— showClose 选项', () => {
  it('内置头部 + 不传 showClose → 原生 X 关闭、自绘 X 在（不出现两个 X）', async () => {
    const wrapper = await mountDialog()
    expect(nativeClosable(wrapper)).toBe(false)
    expect(headerActionCount()).toBe(2) // 全屏 + 自绘关闭
  })

  it('内置头部 + showClose:false → 只剩全屏按钮（showClose 不再是被忽略的死字段）', async () => {
    const wrapper = await mountDialog({ showClose: false })
    expect(nativeClosable(wrapper)).toBe(false)
    expect(headerActionCount()).toBe(1)
  })

  it('自定义 renderHeader + 不传 showClose → 放行原生 X（修复「完全没有关闭入口」）', async () => {
    const wrapper = await mountDialog({ renderHeader: () => null })
    expect(nativeClosable(wrapper)).toBe(true)
    expect(headerActionCount()).toBe(0) // 自绘头部整块不渲染
  })

  it('自定义 renderHeader + showClose:false → false 优先于头部模式', async () => {
    const wrapper = await mountDialog({ renderHeader: () => null, showClose: false })
    expect(nativeClosable(wrapper)).toBe(false)
  })
})
