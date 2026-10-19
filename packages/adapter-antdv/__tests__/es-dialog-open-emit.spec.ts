/**
 * EsDialog 的 `open` 事件（antdv / Ant Design Vue 侧）—— W2.3 / F5b。
 *
 * 缺陷形态：vue3 与 vue2 都在弹窗显示时派发 `open`（useDialog 的 `onOpen` 生命周期
 * 依赖它），antdv 的 defineEmits 却漏了这一条 —— 同一份宿主代码在 vue3/vue2 触发、
 * 在 antdv 静默。声明的另一半是「真的会触发」，故这里两条路径都钉住：
 *   1. 挂载时 visible 已为 true（程序化 useDialog 路径，watch 不会触发）；
 *   2. 声明式 visible false → true（watch 路径）。
 * 同时钉住否定事实：visible true → false 不派发 open。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(EsDialog, { props: { render: () => null, ...props } })
  await nextTick()
  await nextTick()
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog（antdv）— open 事件', () => {
  it('挂载时 visible:true → 派发一次 open（程序化 useDialog 路径）', async () => {
    const wrapper = await mountDialog({ visible: true })
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('挂载时 visible:false → 不派发 open', async () => {
    const wrapper = await mountDialog({ visible: false })
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('visible false → true 时补发 open（声明式路径）', async () => {
    const wrapper = await mountDialog({ visible: false })
    await wrapper.setProps({ visible: true })
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('visible true → false 不派发 open（否定事实：open 只对应「显示」）', async () => {
    const wrapper = await mountDialog({ visible: true })
    await wrapper.setProps({ visible: false })
    expect(wrapper.emitted('open')).toHaveLength(1) // 仅挂载时那一次
  })
})
