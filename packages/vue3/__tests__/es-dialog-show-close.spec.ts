/**
 * EsDialog 的 showClose 选项。
 *
 * 此前模板把 `:show-close` **硬编码成 false**（component.vue:9），props 里既没声明
 * `showClose`，attr 也覆盖不掉 —— `v-bind="filteredAttrs"` 在前、显式绑定在后，后者胜出。
 * 而 `DialogOptions.showClose` 一直是声明过的（core/src/types.ts），README 也写着
 * 「默认 true」。于是文档、类型、实现三方各说各话：
 *
 *   - 内置头部：看着正常，但那是自绘的 `.btns` 里的 X 在工作，与 showClose 无关；
 *   - 自定义 `renderHeader`：自绘 X 随 `v-else` 消失，原生 X 又被硬编码关掉
 *     ⇒ 弹窗**完全没有关闭入口**，且没有任何办法补回来。
 *
 * 现在 `showClose` 是真正的 prop（默认 true），并由 `showNativeClose` 决定要不要
 * 放出原生按钮 —— 内置头部用自绘的、自定义头部用原生的，任何组合都不会出现两个 X。
 * vue2 / antdv 两端同形同修（两端也各自硬编码了 close 的关闭）。
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

type Wrapper = Awaited<ReturnType<typeof mountDialog>>
const nativeShowClose = (wrapper: Wrapper) => wrapper.findComponent(ElDialog).props('showClose')
/** 内置头部自绘的 X —— `.btns` 里第一个是全屏图标，第二个才是关闭 */
const customCloseIcon = (wrapper: Wrapper) => wrapper.findAll('.btns .el-icon')[1]
/**
 * 自绘 X 是否被 v-show 关掉。
 *
 * 刻意不用 `wrapper.isVisible()`：happy-dom 下它对带 `style="display: none"` 的元素
 * 仍返回 true（实测），会给出假绿。直接查 v-show 落下的内联样式最稳。
 */
const customCloseHidden = (wrapper: Wrapper) =>
  (customCloseIcon(wrapper).attributes('style') || '').includes('display: none')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog — showClose 选项', () => {
  it('内置头部 + 不传 showClose → 原生 X 关闭、自绘 X 可见（不出现两个 X）', async () => {
    const wrapper = await mountDialog()
    expect(nativeShowClose(wrapper)).toBe(false)
    expect(customCloseHidden(wrapper)).toBe(false)
  })

  it('内置头部 + showClose:false → 原生与自绘一起隐藏', async () => {
    const wrapper = await mountDialog({ showClose: false })
    expect(nativeShowClose(wrapper)).toBe(false)
    expect(customCloseHidden(wrapper)).toBe(true)
  })

  it('内置头部 + showClose:true → 与默认一致（自绘 X，不叠加原生的）', async () => {
    const wrapper = await mountDialog({ showClose: true })
    expect(nativeShowClose(wrapper)).toBe(false)
    expect(customCloseHidden(wrapper)).toBe(false)
  })

  it('自定义 renderHeader + 不传 showClose → 放行原生 X（修复「完全没有关闭入口」）', async () => {
    const wrapper = await mountDialog({ renderHeader: () => null })
    expect(nativeShowClose(wrapper)).toBe(true)
  })

  it('自定义 renderHeader + showClose:false → 原生 X 也关掉（false 优先于头部模式）', async () => {
    const wrapper = await mountDialog({ renderHeader: () => null, showClose: false })
    expect(nativeShowClose(wrapper)).toBe(false)
  })

  it('showClose 是声明 prop，不会被 attrs 抢走（v-bind 在前、显式绑定在后）', async () => {
    const wrapper = await mountDialog({ showClose: false })
    // 若 showClose 未声明，它会留在 attrs 里经 v-bind 冲掉显式绑定，此时原生 X 反而为 true
    expect(wrapper.findComponent(ElDialog).props('showClose')).toBe(false)
  })
})
