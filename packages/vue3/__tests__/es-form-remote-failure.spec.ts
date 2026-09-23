/**
 * EsForm 远端取数失败时的降级行为
 *
 * 覆盖两条已被坐实的缺陷，二者都在「远端下拉取不到数据」这条路径上：
 *
 *   1. D1/D2 —— 请求函数解析不到（忘记配置全局 httpRequest）时 core 曾经
 *      `if (!requestFn) return`，Promise 永不 settle → 整体挂起且无任何报错。
 *      以及 EsForm 只认 `$esPlusForm.$httpRequest`，看不见 core 权威的顶层
 *      `httpRequest`（正是错误提示推荐的写法）→ 按文档配置反而挂起。
 *   2. D6 —— 一次取数失败后，失败的字段被无条件标记为「已加载」，于是**永久**
 *      停在空选项：既没有报错也不会重试。
 *
 * 断言的是「用户可见的后果」而非内部标记：请求有没有真的再发一次、选项有没有出现。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton, ElSelect, ElOption } from 'element-plus'
import { configureEsPlus, resetGlobalConfig } from '@es-plus/core'

vi.mock('../src/components/es-dialog/src/use-dialog', () => ({
  useDialog: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
  default: vi.fn(() => ({ close: vi.fn(), destroy: vi.fn() })),
}))
vi.mock('../src/components/es-table', () => ({
  default: { name: 'EsTable', install: vi.fn() },
}))

import EsForm from '../src/components/es-form/src/es-form.vue'

const globalComponents = { ElForm, ElRow, ElCol, ElFormItem, ElInput, ElButton, ElSelect, ElOption }

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(EsForm, {
    props: { model: {}, formItemList: [], ...props },
    global: { components: globalComponents },
  })

/** 一次成功响应：core 会剥一层 res.data 作为列表 */
const okResponse = {
  data: [
    { label: '选项A', value: 'a' },
    { label: '选项B', value: 'b' },
  ],
}

const remoteItem = (over: Record<string, unknown> = {}) => ({
  prop: 'cat',
  label: '分类',
  formtype: 'Select',
  span: 24,
  apiParams: { url: '/api/cat', method: 'GET' },
  ...over,
})

async function settle() {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

/**
 * 读出该 Select 当前拥有的选项 label。
 *
 * 不能断言 `wrapper.html()`：Element Plus 的下拉是 teleport + 懒渲染的，
 * 不点开就没有选项节点（`<!--v-if-->`）。这里直接读 ElSelect 的默认插槽 vnode，
 * 既避开 teleport，又正是 `use-form-inputs` 真正喂给 ElOption 的那份数据。
 */
function selectLabels(wrapper: ReturnType<typeof mountForm>): unknown[] {
  const select = wrapper.findComponent(ElSelect)
  if (!select.exists()) return []
  const vnodes = (select.vm.$slots.default?.() ?? []) as Array<{ props?: { label?: unknown } }>
  return vnodes.map((v) => v?.props?.label)
}

describe('EsForm 远端取数 —— 失败后的降级与重试', () => {
  beforeEach(() => {
    resetGlobalConfig()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    resetGlobalConfig()
  })

  it('字段级 httpRequest 失败后，换一个可用的请求函数应能重新取到选项（不被永久钉死）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failReq = vi.fn().mockRejectedValue(new Error('backend 500'))
    const okReq = vi.fn().mockResolvedValue(okResponse)

    const wrapper = mountForm({
      model: { cat: '' },
      formItemList: [remoteItem({ httpRequest: failReq })],
    })
    await settle()

    // 第一次确实发了请求，并且失败了
    expect(failReq).toHaveBeenCalledTimes(1)
    // 失败必须是可见的：开发期告警点名字段，而不是静默空选项
    expect(warn.mock.calls.flat().join(' ')).toContain('cat')

    // 同一字段、这次带一个可用的请求函数（模拟重试 / 后端恢复）
    await wrapper.setProps({
      formItemList: [remoteItem({ httpRequest: okReq })],
    })
    await settle()

    // 关键断言：失败过的字段必须还能再取一次
    expect(okReq).toHaveBeenCalledTimes(1)
    expect(selectLabels(wrapper)).toContain('选项A')
  })

  it('成功过的字段不会因为 formItemList 变化而重复请求', async () => {
    const req = vi.fn().mockResolvedValue(okResponse)
    const wrapper = mountForm({
      model: { cat: '' },
      formItemList: [remoteItem({ httpRequest: req })],
    })
    await settle()
    expect(req).toHaveBeenCalledTimes(1)

    // 加一个普通字段，触发 watcher
    await wrapper.setProps({
      formItemList: [remoteItem({ httpRequest: req }), { prop: 'name', label: '名称', formtype: 'Input', span: 24 }],
    })
    await settle()

    // 已加载过的字段不该被再次请求（本修复不能把「重试」做成「每次都重发」）
    expect(req).toHaveBeenCalledTimes(1)
  })

  it('顶层 httpRequest（core 权威字段）对 EsForm 生效', async () => {
    const top = vi.fn().mockResolvedValue(okResponse)
    configureEsPlus({ httpRequest: top })

    const wrapper = mountForm({
      model: { cat: '' },
      formItemList: [remoteItem()], // 字段级不给 httpRequest
    })
    await settle()

    expect(top).toHaveBeenCalledTimes(1)
    expect(selectLabels(wrapper)).toContain('选项A')
  })

  it('旧约定 EsTable.methods.$httpRequest 对 EsForm 同样生效', async () => {
    const legacy = vi.fn().mockResolvedValue(okResponse)
    configureEsPlus({ EsTable: { methods: { $httpRequest: legacy } } })

    const wrapper = mountForm({
      model: { cat: '' },
      formItemList: [remoteItem()],
    })
    await settle()

    expect(legacy).toHaveBeenCalledTimes(1)
    expect(selectLabels(wrapper)).toContain('选项A')
  })
})
