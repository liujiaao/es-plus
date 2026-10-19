/**
 * EsDialog 的 appendTo 选项（vue3 / Element Plus 侧）。
 *
 * 此前 `appendTo` 在 `withDefaults(defineProps<{...}>())` 里**声明了**，却从未绑到
 * `<el-dialog>` —— 声明式 `<es-dialog append-to="#app">` 的挂载目标被**静默丢弃**
 * （与 cacheKey 同族，但这里底层库支持）。Element Plus 2.14 的 el-dialog 自带
 * `appendTo`（teleport 的 `:to`）与 `appendToBody`（teleport 的启用开关）：
 * `:disabled="appendTo !== 'body' ? false : !appendToBody"`。
 *
 * 故修复 = 显式转发 appendTo，并在给了 appendTo 时打开 appendToBody
 *（appendTo === 'body' 时启用开关只认 appendToBody）。不传 appendTo 时
 * `appendToBody` 保持 false ⇒ 渲染位置与修复前一致。
 *
 * 断言读**真实 el-dialog 收到的 props**：只查 DOM 属性看不出「prop 声明了但没绑」。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { ElDialog } from 'element-plus'
import EsDialog from '../src/components/es-dialog/src/component.vue'

const mountDialog = async (props: Record<string, unknown> = {}) => {
  // teleport 的目标必须在挂载前就存在（Element Plus 的 el-dialog 直接 :to 该选择器）
  const host = document.createElement('div')
  host.id = 'dialog-host'
  document.body.appendChild(host)
  const wrapper = mount(EsDialog, {
    props: { visible: true, render: () => null, ...props },
  })
  await nextTick()
  await nextTick()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountDialog>>
const elDialogProps = (wrapper: Wrapper) => wrapper.findComponent(ElDialog).props()

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EsDialog — appendTo 选项', () => {
  it('不传 appendTo → 不启用 teleport（appendToBody=false），渲染位置保持原样', async () => {
    const p = elDialogProps(await mountDialog())
    expect(p.appendToBody).toBe(false)
    // el-dialog 的默认 appendTo 是 'body'，但 teleport 被 appendToBody=false 关掉
    expect(p.appendTo ?? 'body').toBe('body')
  })

  it('appendTo 选择器 → 原样转发给 el-dialog，并打开 appendToBody', async () => {
    const p = elDialogProps(await mountDialog({ appendTo: '#dialog-host' }))
    expect(p.appendTo).toBe('#dialog-host')
    // appendTo !== 'body' 时 teleport 恒开；显式置 true 让语义在 props 上也可见
    expect(p.appendToBody).toBe(true)
  })

  it('appendTo 选择器 → 弹窗真的被 teleport 到该容器（端到端，不只是 props）', async () => {
    await mountDialog({ appendTo: '#dialog-host' })
    await nextTick()
    const host = document.getElementById('dialog-host')!
    expect(host.querySelector('.el-overlay')).not.toBeNull()
  })

  it('不传 appendTo → 不 teleport 到任意容器（保持组件内渲染）', async () => {
    await mountDialog()
    const host = document.getElementById('dialog-host')!
    expect(host.querySelector('.el-overlay')).toBeNull()
  })

  it("appendTo='body' → 也打开 appendToBody（否则 teleport 的启用开关会把它关掉）", async () => {
    const p = elDialogProps(await mountDialog({ appendTo: 'body' }))
    expect(p.appendTo).toBe('body')
    expect(p.appendToBody).toBe(true)
  })
})
