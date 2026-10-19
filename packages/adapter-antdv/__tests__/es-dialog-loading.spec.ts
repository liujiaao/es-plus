/**
 * EsDialog 的 loading 选项（antdv / Ant Design Vue 侧）。
 *
 * 三端同形对齐的见证：vue3 用 `v-loading`、vue2 用 `v-loading`，
 * 而 antdv 的 a-modal **没有 loading 能力**，此前 `loading` 连 prop 都没声明 ——
 * 声明式 `<es-dialog :loading="true">` 在 antdv 端被静默丢弃（幻影能力）。
 *
 * 现在用 `<a-spin :spinning>` 包裹 body，与另外两端的「body 区域遮罩」同义。
 * 断言走真实 DOM 的 `.ant-spin-spinning`，而非打桩 —— a-scope 组件在
 * `<script setup>` 里本地 import，global stubs 拦不到。
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

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog（antdv）— loading 选项', () => {
  it('默认不加载：body 无 spinning 遮罩', async () => {
    await mountDialog()
    expect(document.body.querySelector('.ant-spin-spinning')).toBeNull()
  })

  it('loading:true → body 区域出现 a-spin 遮罩（不再是被静默丢弃的 prop）', async () => {
    await mountDialog({ loading: true })
    expect(document.body.querySelector('.ant-spin-spinning')).not.toBeNull()
  })

  it('loading 从 false 翻到 true → 遮罩随之出现（响应式，非一次性初始化）', async () => {
    const wrapper = await mountDialog()
    expect(document.body.querySelector('.ant-spin-spinning')).toBeNull()
    await wrapper.setProps({ loading: true })
    // a-spin 的 spinning 经 throttle-debounce 的 debounce(delay) 落地（默认 100ms，flush:post），
    // 所以要等一个宏任务；多冲 nextTick 不够。
    await new Promise((r) => setTimeout(r, 150))
    expect(document.body.querySelector('.ant-spin-spinning')).not.toBeNull()
  })
})
