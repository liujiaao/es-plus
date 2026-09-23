/**
 * EsDialog 的 fullscreen 选项。
 *
 * `fullscreen` 是**声明 prop**（component.vue:109），Vue 会把它从 `attrs` 里摘走。
 * 此前模板读的是 `filteredAttrs?.fullscreen`（永远 undefined），于是：
 *   - `fullscreen: true` 完全不生效（isFullscreen 恒从 ref(false) 起步）
 *   - `handleFullscreen` 里的 `if (attrs?.fullscreen) return` 是死代码
 * 而 vue2（:165 `ref(!!props.fullscreen)`）与 antdv（:222 `ref(props.fullscreen || false)`）
 * 都是「从 prop 取初值」——三端只有 vue3 漏了这一步。
 *
 * 文档（advanced-doc.data.ts:88 / component-doc.data.ts:330）写的是
 * 「fullscreen: boolean，默认 false，全屏」= 初值语义。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { ElDialog } from 'element-plus'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountDialog = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(EsDialog, {
    props: { visible: true, render: () => null, ...props },
  })
  // el-dialog 的 body 在首帧后才渲染，需要把微任务冲干净
  await nextTick()
  await nextTick()
  return wrapper
}

const elDialogFullscreen = (wrapper: Awaited<ReturnType<typeof mountDialog>>) =>
  wrapper.findComponent(ElDialog).props('fullscreen')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog — fullscreen 选项', () => {
  it('fullscreen:true → 下发给 el-dialog 的就是 true（prop 取初值）', async () => {
    const wrapper = await mountDialog({ fullscreen: true })
    expect(elDialogFullscreen(wrapper)).toBe(true)
  })

  it('不传 fullscreen → 默认 false', async () => {
    const wrapper = await mountDialog()
    expect(elDialogFullscreen(wrapper)).toBe(false)
  })

  it('fullscreen:true → 容器类为 dialogFull（与内部状态一致）', async () => {
    const wrapper = await mountDialog({ fullscreen: true })
    expect(wrapper.find('.dg-dialog').classes()).toContain('dialogFull')
  })

  it('fullscreen:true → 主体按 height 撑满，而非 maxHeight 夹住', async () => {
    const wrapper = await mountDialog({ fullscreen: true })
    const style = wrapper.find('.dialog_body_layouts').attributes('style') || ''
    // 全屏态走 `height: <viewH>px`，非全屏态走 `max-height: <viewH>px`
    expect(style).toContain('height:')
    expect(style).not.toContain('max-height:')
  })

  it('点击头部图标仍可切换（三端一致：prop 只定初值，不锁死）', async () => {
    const wrapper = await mountDialog({ fullscreen: true })
    expect(elDialogFullscreen(wrapper)).toBe(true)

    await wrapper.find('.btns .el-icon').trigger('click')
    await nextTick()

    expect(elDialogFullscreen(wrapper)).toBe(false)
  })
})
