/**
 * Tier-1 运行时见证：**生成出来的片段**（AI-43）
 * ────────────────────────────────────────────────────────────────────────
 * 与 AI-42 的 Tier-0（真 `vite build`）是两把尺子：Tier-0 只证明「打包器能编译」，
 * 本 spec 证明「产物挂载后真的跑」——与 generated-runtime.spec.ts 对 CRUD 做的事同构，
 * 只是对象换成 `generate_table` / `generate_form` / `generate_dialog` 的三类片段。
 *
 * 生成物在运行时写盘、用**变量**动态 import（vitest 的模块 runner 会按需完成 SFC/TSX
 * 编译）。文件落在 `__tests__/.tmp-fragments/`，afterAll 清理；不要把产物提交进仓。
 *
 * 覆盖（全部来自 golden 语料，不是手写样张）：
 *   1. table：挂载即经全局 `httpRequest` 拉数 → 行真的渲染；行操作按钮由 `btns` 派生。
 *   2. table + pagination：`frag-table-02` 的 pageSize/pageSizes 真到 EsTable prop。
 *   3. form：字段/默认值/按钮渲染，输入回写 reactive model。
 *   4. form + formLayout：Wave 4 的 `layoutFormProps.formLayProps` 真到 EsForm prop。
 *   5. dialog（component 形态）：`defineExpose` 的 `open()` 真能开窗、预填、渲染表单。
 *   6. dialog（composable 形态）：`useXxxDialog().open()` 真能创建弹窗实例。
 *
 * 断言锚点优先选「组件 prop / 真实数据回环」，而不是厂商 DOM 细节：
 * 前者是契约，后者随 Element Plus 小版本抖动。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ElementPlus from 'element-plus'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 先初始化包入口（同 crud-runtime.spec.ts：让模块图按库自身顺序完成初始化）。
import EsPlus from '../src/index'
import EsForm from '../src/components/es-form/src/es-form.vue'
import EsTable from '../src/components/es-table/src/component.vue'
import { configureEsPlus, resetGlobalConfig } from '../src/config'
import {
  generateTableBlock,
  generateFormBlock,
  generateDialogBlock,
} from '../../shared/src/fragment-generator'
import { createInMemoryBackend, findButtonByText } from './runtime-harness'

const __dirname_ = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname_, '..', '..', '..', '__tests__', 'golden', 'cases')
const TMP_DIR = join(__dirname_, '.tmp-fragments')

/** 读 golden 片段用例的 config（片段输入本身不含 target）。 */
function loadFragmentConfig(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CASES_DIR, file), 'utf-8')).config
}

/** 把生成物写到磁盘，返回一个**变量** import 说明符（见文件头注释）。 */
function writeGenerated(file: string, code: string): string {
  writeFileSync(join(TMP_DIR, file), code)
  return `./.tmp-fragments/${file}`
}

/** 动态 import 一个运行时写盘的文件（说明符是变量 → 由 vitest 模块 runner 按需编译）。 */
async function importGenerated(spec: string): Promise<any> {
  return import(/* @vite-ignore */ spec)
}

function mountPlugin(backend: ReturnType<typeof createInMemoryBackend> = createInMemoryBackend([])) {
  return {
    plugins: [ElementPlus, [EsPlus, { httpRequest: backend.httpRequest }]] as any,
  }
}

function cleanupDom() {
  document.querySelectorAll('.dialog-containers, .el-overlay, .el-dialog').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

/**
 * AN-16：弹窗提交的观察后端。`runtime-harness` 的内存后端按 CRUD 的四条固定 URL 路由，
 * 弹窗片段发的是自己的 `apiUrl`（`/api/users`），落到它的「默认列表」分支就看不到方法。
 * 这里只记录请求并回 `{ code: 0 }` —— 弹窗不消费响应，断言锚点是**发了什么**。
 */
function createRecordingBackend() {
  const requests: Array<{ url: string; method: string; data: Record<string, any> }> = []
  const httpRequest = async (req: Record<string, any>) => {
    requests.push({ url: String(req.url), method: String(req.method ?? 'GET'), data: req.data ?? {} })
    return { code: 0 }
  }
  return { httpRequest, requests }
}

/** 元素当前是否不可见（ElDialog 关闭后通常保留 DOM 并 `display:none`）。 */
function isHidden(el: Element | null): boolean {
  if (!el) return true
  return (el as HTMLElement).style.display === 'none' || getComputedStyle(el as HTMLElement).display === 'none'
}

/**
 * 弹窗是否已收起。
 *
 * 观察点必须选对：Element Plus 的 `v-show`（`dialog.vue` 里 `[[vShow, visible]]`）挂在
 * **最外层**容器上 —— `modal:true` 时是 `.el-overlay`，`modal:false` 时是
 * `.el-modal-dialog`（ElOverlay 无遮罩分支只保留 `overlayClass`）。内部 `.el-dialog`
 * 自身始终可见，拿它判「关了没」恒为 false。
 * 内容被 `destroyOnClose` 卸载时 `[role=dialog]` 直接消失，同样视为已收起。
 */
function isDialogClosed(root: ParentNode): boolean {
  const inner = root.querySelector('[role="dialog"]')
  if (!inner) return true
  const shell = (inner.closest('.el-overlay, .el-modal-dialog') as HTMLElement | null) ?? (inner as HTMLElement)
  return isHidden(shell)
}

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true })
  // 六个产物只生成一次 —— 每个用例的输入是确定的 golden 语料。
  writeFileSync(join(TMP_DIR, 'table-01.vue'), generateTableBlock({ ...loadFragmentConfig('frag-table-01-vue3.json'), target: 'vue3' }).code)
  writeFileSync(join(TMP_DIR, 'table-02.vue'), generateTableBlock({ ...loadFragmentConfig('frag-table-02-vue3.json'), target: 'vue3' }).code)
  writeFileSync(join(TMP_DIR, 'form-01.vue'), generateFormBlock({ ...loadFragmentConfig('frag-form-01-vue3.json'), target: 'vue3' }).code)
  writeFileSync(join(TMP_DIR, 'form-02.vue'), generateFormBlock({ ...loadFragmentConfig('frag-form-02-vue3.json'), target: 'vue3' }).code)
  writeFileSync(join(TMP_DIR, 'dialog-component.vue'), generateDialogBlock({ ...loadFragmentConfig('frag-dialog-02-component-vue3.json'), target: 'vue3' }).code)
  writeFileSync(join(TMP_DIR, 'dialog-composable.tsx'), generateDialogBlock({ ...loadFragmentConfig('frag-dialog-01-vue3.json'), target: 'vue3' }).code)
})

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

afterEach(() => {
  cleanupDom()
  resetGlobalConfig()
})

describe('片段运行时（vue3）', () => {
  it('table：挂载即拉数，行真的渲染（v-model:data-source 回环）', async () => {
    const seed = [
      { id: 1, name: '张三', status: '启用', amount: 12, createdAt: '2026-01-01' },
      { id: 2, name: '李四', status: '禁用', amount: 3.5, createdAt: '2026-01-02' },
    ]
    const backend = createInMemoryBackend(seed)
    const mod = await importGenerated('./.tmp-fragments/table-01.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(backend) })
    await flushPromises()
    await nextTick()

    expect(backend.calls.list).toBeGreaterThanOrEqual(1)
    const table = wrapper.findComponent(EsTable)
    // 请求回写的数据真到了 EsTable 的 dataSource prop（不是只渲染了空壳）。
    expect((table.props('dataSource') as any[]).length).toBe(2)
    expect(wrapper.text()).toContain('张三')
    // 行操作按钮由列定义的 btns 派生（frag-table-01 的 operate 列）。
    for (const name of ['查看', '编辑', '删除']) {
      expect(wrapper.text()).toContain(name)
    }
  })

  it('table：pagination 容器的 pageSize/pageSizes 真到 EsTable（Wave 4 词汇）', async () => {
    const seed = [{ id: 1, name: '张三', status: '启用', amount: 1, createdAt: '2026-01-01' }]
    const backend = createInMemoryBackend(seed)
    const mod = await importGenerated('./.tmp-fragments/table-02.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(backend) })
    await flushPromises()

    const pagination = wrapper.findComponent(EsTable).props('pagination') as Record<string, any>
    expect(pagination.pageSize).toBe(20)
    expect(pagination.pageSizes).toEqual([10, 20, 50])
  })

  it('form：字段渲染 + 输入回写 reactive model', async () => {
    const mod = await importGenerated('./.tmp-fragments/form-01.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin() })
    await nextTick()

    // 5 个字段（姓名/状态/生日/简介/启用）都渲染成真实 form item。
    const form = wrapper.findComponent(EsForm)
    expect((form.props('formItemList') as any[]).length).toBe(5)
    expect(wrapper.text()).toContain('姓名')
    // 输入 → DOM 里能看到值（v-model 绑定的是生成器产出的 reactive model）。
    const input = wrapper.find('input')
    await input.setValue('王五')
    expect((input.element as HTMLInputElement).value).toBe('王五')
    // 按钮区（保存/重置）由 configBtn 渲染。
    expect(wrapper.text()).toContain('保存')
    expect(wrapper.text()).toContain('重置')
  })

  it('form：formLayout 经 layoutFormProps.formLayProps 真到 EsForm（Wave 4）', async () => {
    const mod = await importGenerated('./.tmp-fragments/form-02.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin() })
    await nextTick()

    expect(wrapper.findComponent(EsForm).props('layoutFormProps')).toEqual({
      formLayProps: { labelWidth: '110px', minFoldRows: 2 },
    })
    expect(wrapper.text()).toContain('关键字')
  })

  it('dialog（component 形态）：defineExpose 的 open() 真能开窗并预填', async () => {
    // 该语料带 options.appendTo='#app'。EsDialog 现在**真的**把它转发给 el-dialog
    // （此前是声明了却不读的死 prop），故目标容器必须在挂载前存在；
    // 同时观察点随 teleport 走 —— 内容不再在 wrapper 里，而在 #app 内。
    const host = document.createElement('div')
    host.id = 'app'
    document.body.appendChild(host)

    const mod = await importGenerated('./.tmp-fragments/dialog-component.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin() })
    await nextTick()
    expect(wrapper.text()).toBeFalsy()

    ;(wrapper.vm as any).open('编辑', { name: '张三', status: 1 })
    await nextTick()
    await flushPromises()

    // es-dialog 用 visible v-model；开窗后真实渲染出表单与预填值。
    expect(host.textContent).toContain('编辑')
    expect(host.textContent).toContain('姓名')
    const inputs = Array.from(host.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.some((i) => i.value === '张三')).toBe(true)
    // appendTo 落到位的直接证据：弹窗节点在该容器里（不只是 props 上转发）。
    // 该语料 modal:false —— 没有 .el-overlay，故直接看 .el-dialog。
    expect(host.querySelector('.el-dialog')).not.toBeNull()
  })

  it('dialog（component 形态）：确定 → PUT/POST、view 只读、关闭真关窗（AN-16）', async () => {
    // 与上一条同一份语料、同一个 appendTo 容器；这条盯**提交/只读/关闭**三件事，
    // 它们都不是配置字段（方法由运行时 title 派生），只能在这里见证。
    const host = document.createElement('div')
    host.id = 'app'
    document.body.appendChild(host)

    const backend = createRecordingBackend()
    const mod = await importGenerated('./.tmp-fragments/dialog-component.vue')
    const wrapper = mount(mod.default, {
      attachTo: document.body,
      global: { plugins: [ElementPlus, [EsPlus, { httpRequest: backend.httpRequest }]] as any },
    })
    await nextTick()

    // ── 编辑 → PUT `${apiUrl}/${row[rowkey]}` ──
    ;(wrapper.vm as any).open('编辑', { id: 1, name: '张三', status: 1 })
    await nextTick()
    await flushPromises()
    findButtonByText(host, '确定')!.click()
    await flushPromises()
    await nextTick()
    expect(backend.requests).toHaveLength(1)
    expect(backend.requests[0]).toMatchObject({ method: 'PUT', url: '/api/users/1' })
    expect(backend.requests[0].data.name).toBe('张三')
    expect(isDialogClosed(host)).toBe(true)

    // ── 新增 → POST apiUrl ──
    ;(wrapper.vm as any).open('新增', { name: '王五' })
    await nextTick()
    await flushPromises()
    findButtonByText(host, '确定')!.click()
    await flushPromises()
    await nextTick()
    expect(backend.requests).toHaveLength(2)
    expect(backend.requests[1]).toMatchObject({ method: 'POST', url: '/api/users' })
    expect(backend.requests[1].data.name).toBe('王五')

    // ── 查看 → 只读：只有「关闭」，没有「确定/取消」；且不发任何请求 ──
    ;(wrapper.vm as any).open('查看', { id: 1, name: '张三' })
    await nextTick()
    await flushPromises()
    expect(host.textContent).toContain('查看')
    expect(findButtonByText(host, '关闭')).not.toBeNull()
    expect(findButtonByText(host, '确定')).toBeNull()
    expect(findButtonByText(host, '取消')).toBeNull()
    expect(backend.requests).toHaveLength(2)

    // ── 关闭 → 弹窗真的收起 ──
    findButtonByText(host, '关闭')!.click()
    await flushPromises()
    await nextTick()
    expect(isDialogClosed(host)).toBe(true)
  })

  it('dialog（composable 形态）：useXxxDialog().open() 真能创建弹窗实例并渲染表单', async () => {
    const mod = await importGenerated('./.tmp-fragments/dialog-composable.tsx')
    expect(typeof mod.useUserDialog).toBe('function')

    const backend = createInMemoryBackend([])
    configureEsPlus({ httpRequest: backend.httpRequest })
    const dialog = mod.useUserDialog()
    dialog.open('新增')
    await nextTick()

    // useDialog 的容器挂在 document.body（与 use-dialog.spec.ts 同一观察点）。
    expect(document.querySelector('.dialog-containers')).toBeTruthy()
    expect(document.body.textContent).toContain('新增')
    expect(document.body.textContent).toContain('姓名')
  })

  it('dialog（composable 形态）：确定 → POST、取消关窗（AN-16）', async () => {
    const backend = createRecordingBackend()
    configureEsPlus({ httpRequest: backend.httpRequest })

    // 先清掉上一条用例可能留下的容器（useDialog 的实例挂在 body）。
    cleanupDom()
    const mod = await importGenerated('./.tmp-fragments/dialog-composable.tsx')
    const dialog = mod.useUserDialog()

    dialog.open('新增', { name: '赵六' })
    await nextTick()
    await flushPromises()
    findButtonByText(document.body, '确定')!.click()
    await flushPromises()
    await nextTick()

    expect(backend.requests).toHaveLength(1)
    expect(backend.requests[0]).toMatchObject({ method: 'POST', url: '/api/users' })
    expect(backend.requests[0].data.name).toBe('赵六')
    // 提交后 close()：单例模式的 `close()` 只翻转 visible（容器由 `destroy()` 才移除，
    // 见 use-dialog.ts 单例分支），故观察点是「弹窗收起」而不是「容器消失」。
    expect(isDialogClosed(document.body)).toBe(true)

    // 再开一次，验证「取消」只关窗、不发请求（单例复用同一 vNode）。
    dialog.open('新增', { name: '赵六' })
    await nextTick()
    await flushPromises()
    expect(isDialogClosed(document.body)).toBe(false)
    findButtonByText(document.body, '取消')!.click()
    await flushPromises()
    await nextTick()
    expect(backend.requests).toHaveLength(1)
    expect(isDialogClosed(document.body)).toBe(true)
  })
})

/**
 * P4 · 产物运行时契约见证（refresh / validate / success）。
 *
 * 三条通道都**不是**「配置字段」：它们是片段包装层向宿主暴露的方法/事件/回调，
 * 记分卡结构上覆盖不到 —— 只有挂载后真的调用一次才知道它是否存在。
 */
describe('P4 运行时契约（vue3）', () => {
  it('table：expose 的 refresh() 真的重新取数', async () => {
    const backend = createInMemoryBackend([{ id: 1, name: '张三', status: '启用', amount: 12, createdAt: '2026-01-01' }])
    const mod = await importGenerated('./.tmp-fragments/table-01.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(backend) })
    await flushPromises()
    await nextTick()

    const before = backend.calls.list
    await (wrapper.vm as any).refresh()
    await flushPromises()
    await nextTick()
    expect(backend.calls.list).toBe(before + 1)
    expect(typeof (wrapper.vm as any).reload).toBe('function')
  })

  it('form：expose 的 validate() 把底层校验结果原样交给宿主、resetFields 真的复位 model 与输入', async () => {
    const mod = await importGenerated('./.tmp-fragments/form-01.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin() })
    await nextTick()

    // 为什么在这里改写底层 exposed.validate 而不是「空必填点保存」：
    // happy-dom 下 Element Plus 2.14 的 form-item 在失败态会把 `fields` 丢成 undefined
    // （form.validate 因此 resolve true），真实浏览器没有这个问题 —— 与 element-ui 在
    // vitest 下的既有记录同源（见 __tests__/e2e-runtime/README.md 的分层说明）。
    // Tier-1 要见证的是**片段包装层的委托契约**：底层 reject 必须原样冒泡（不得吞掉、
    // 不得改写），真实失败态拦截由 Tier-2（vue2 真实浏览器）见证。
    const exposed = (wrapper.findComponent(EsForm).vm as any).$.exposed as Record<string, any>
    const realValidate = exposed.validate
    exposed.validate = () => Promise.reject({ name: [{ message: '请输入姓名' }] })
    await expect((wrapper.vm as any).validate()).rejects.toBeDefined()

    exposed.validate = realValidate
    await wrapper.find('input').setValue('王五')
    expect((wrapper.vm as any).model.name).toBe('王五')
    await expect((wrapper.vm as any).validate()).resolves.toBe(true)

    expect(typeof (wrapper.vm as any).resetFields).toBe('function')
    ;(wrapper.vm as any).resetFields()
    await nextTick()
    expect((wrapper.vm as any).model.name).toBe('')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
  })

  it('dialog：open(title, row, onSuccess) 提交成功后回调真的带数据触发', async () => {
    const host = document.createElement('div')
    host.id = 'app'
    document.body.appendChild(host)

    const backend = createRecordingBackend()
    const mod = await importGenerated('./.tmp-fragments/dialog-component.vue')
    const wrapper = mount(mod.default, {
      attachTo: document.body,
      global: { plugins: [ElementPlus, [EsPlus, { httpRequest: backend.httpRequest }]] as any },
    })
    await nextTick()

    const received: any[] = []
    ;(wrapper.vm as any).open('编辑', { id: 1, name: '张三', status: 1 }, (data: any) => received.push(data))
    await nextTick()
    await flushPromises()
    findButtonByText(host, '确定')!.click()
    await flushPromises()
    await nextTick()

    expect(backend.requests).toHaveLength(1)
    expect(received).toHaveLength(1)
    expect(received[0].name).toBe('张三')
  })
})

/**
 * P4 · 组合四类接线。
 *
 * 四个片段来自 golden 语料（table-01 / form-02 / form-01 / dialog-component），
 * 宿主只做四件事 —— 这四件事正是「独立产物能不能拼成一张页面」的全部判据：
 *   ① table 的 row-action → dialog.open(title, row)
 *   ② dialog 的 onSuccess → table.refresh()
 *   ③ form 的 query → table.refresh(model)
 *   ④ form 的 submit 先 validate、通过后才派发
 */
describe('P4 组合四类接线（vue3）', () => {
  const appHost = () => {
    let host = document.getElementById('app')
    if (!host) {
      host = document.createElement('div')
      host.id = 'app'
      document.body.appendChild(host)
    }
    return host
  }

  async function mountWiring() {
    appHost()
    const Table = (await importGenerated('./.tmp-fragments/table-01.vue')).default
    const QueryForm = (await importGenerated('./.tmp-fragments/form-02.vue')).default
    const EditForm = (await importGenerated('./.tmp-fragments/form-01.vue')).default
    const DialogFrag = (await importGenerated('./.tmp-fragments/dialog-component.vue')).default

    const requests: any[] = []
    const rows = [{ id: 1, name: '张三', status: 1, amount: 12, createdAt: '2026-01-01' }]
    const httpRequest = async (req: any) => {
      requests.push(req)
      if (String(req.method ?? 'GET') === 'GET') return { records: rows.length, rows }
      return { code: 0 }
    }
    const listCount = () => requests.filter((r) => String(r.method ?? 'GET') === 'GET').length

    const submitted: any[] = []
    const queries: any[] = []
    const Host = defineComponent({
      setup() {
        const table = ref<any>(null)
        const dialog = ref<any>(null)
        const onRowAction = ({ key, row }: any) => {
          // 接线①：行内「编辑」→ 打开弹窗并把整行预填进去。
          if (key === 'edit') dialog.value?.open('编辑', row, () => table.value?.refresh())
        }
        const onQuery = (model: any) => {
          // 接线③：查询表单 → 表格按查询条件刷新。
          queries.push(model)
          return table.value?.refresh(model)
        }
        const onSubmit = (model: any) => {
          // 接线④：保存（片段内部已 validate）→ 宿主接住提交值。
          submitted.push(model)
        }
        return () =>
          h('div', [
            h(Table, { ref: (el: any) => (table.value = el), onRowAction }),
            h(QueryForm, { ref: () => undefined, onQuery }),
            h(EditForm, { ref: () => undefined, onSubmit }),
            // 接线②：弹窗提交成功 → 刷新表格（宿主自己的表格，片段不持有）。
            h(DialogFrag, { ref: (el: any) => (dialog.value = el) }),
          ])
      },
    })
    const wrapper = mount(Host, { attachTo: document.body, global: mountPlugin({ httpRequest } as any) })
    await flushPromises()
    await nextTick()
    return { wrapper, requests, listCount, submitted, queries }
  }

  it('① table row-action → dialog.open(title, row)', async () => {
    const { wrapper } = await mountWiring()
    expect(findButtonByText(wrapper.element, '编辑')).toBeTruthy()
    findButtonByText(wrapper.element, '编辑')!.click()
    await nextTick()
    await flushPromises()

    const host = appHost()
    expect(host.textContent).toContain('编辑')
    const inputs = Array.from(host.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.some((i) => i.value === '张三')).toBe(true)
  })

  it('② dialog onSuccess → table.refresh()', async () => {
    const { wrapper, requests, listCount } = await mountWiring()
    const before = listCount()
    findButtonByText(wrapper.element, '编辑')!.click()
    await nextTick()
    await flushPromises()

    findButtonByText(appHost(), '确定')!.click()
    await flushPromises()
    await nextTick()

    expect(requests.some((r) => String(r.method) === 'PUT')).toBe(true)
    expect(listCount()).toBeGreaterThan(before)
  })

  it('③ form query → table.refresh(model)', async () => {
    const { wrapper, listCount, queries } = await mountWiring()
    const btn = findButtonByText(wrapper.element, '查询')!
    const formEl = btn.closest('form')!
    const input = formEl.querySelector('input') as HTMLInputElement
    input.value = 'abc'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const before = listCount()
    btn.click()
    await flushPromises()
    await nextTick()

    expect(queries).toHaveLength(1)
    expect(queries[0].keyword).toBe('abc')
    expect(listCount()).toBeGreaterThan(before)
  })

  it('④ form submit：校验失败不派发，校验通过才把 model 快照派发给宿主', async () => {
    const { wrapper, submitted } = await mountWiring()
    const save = findButtonByText(wrapper.element, '保存')!
    const formEl = save.closest('form')!
    const input = formEl.querySelector('input') as HTMLInputElement
    // form-01（编辑表单）是宿主里包住「保存」的那个 es-form；查询表单是另一个实例。
    const editForm = wrapper.findAllComponents(EsForm).find((c) => c.element.contains(save))!
    const exposed = (editForm.vm as any).$.exposed as Record<string, any>
    const realValidate = exposed.validate

    // 失败态：包装层必须在 emit 之前停下（真实失败态由 Tier-2 见证，见上一个用例）。
    exposed.validate = () => Promise.reject({ name: [{ message: '请输入姓名' }] })
    save.click()
    await flushPromises()
    await nextTick()
    expect(submitted).toHaveLength(0)

    // 通过态：宿主拿到的是快照而不是 reactive model 本身。
    exposed.validate = realValidate
    input.value = '王五'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    save.click()
    await flushPromises()
    await nextTick()
    expect(submitted).toHaveLength(1)
    expect(submitted[0].name).toBe('王五')
  })
})
