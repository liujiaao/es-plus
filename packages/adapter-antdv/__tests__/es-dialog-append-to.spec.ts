/**
 * EsDialog 的 appendTo 选项（antdv / Ant Design Vue 侧）。
 *
 * 此前 `appendTo` 既在 props 接口里声明，又被列进 `filteredAttrs` 的忽略名单 ——
 * 等于**彻底死掉**：声明式 `<es-dialog append-to="#app">` 的挂载目标被静默丢弃。
 *
 * a-modal 的等价能力是 `getContainer`（选择器 / HTMLElement / 函数），故修复 =
 * 显式转发 `:getContainer="props.appendTo"`。不传时保持 undefined，让 a-modal
 * 自己的默认值（document.body，或全局 ConfigProvider 的 getPopupContainer）生效。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(EsDialog, { props: { visible: true, render: () => null, ...props } })
  await nextTick()
  await nextTick()
  await nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountDialog>>
const containerProp = (wrapper: Wrapper) =>
  wrapper.findComponent({ name: 'AModal' }).props('getContainer') as unknown

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog（antdv）— appendTo 选项', () => {
  it('appendTo 选择器 → 原样转发为 a-modal 的 getContainer', async () => {
    const wrapper = await mountDialog({ appendTo: '#app' })
    expect(containerProp(wrapper)).toBe('#app')
  })

  it('不传 appendTo → getContainer 保持未设置（由 a-modal / ConfigProvider 决定默认容器）', async () => {
    const wrapper = await mountDialog()
    expect(containerProp(wrapper)).toBeUndefined()
  })
})
