/**
 * Tier-1 运行时 E2E 打样（adapter-antdv）
 * ────────────────────────────────────────────────────────────────────────
 * 与 @es-plus/vue3 的 __tests__/crud-runtime.spec.ts 同构：把 E2E 从「生成代码能编译」
 * 升级到「增删改查全链路在真实组件里跑通」。
 *
 * 本 spec 挂载【真实】EsCrudPage → 真实 EsTable(a-table) → 真实 EsForm → 真实 useDialog(a-modal)，
 * 不 stub 任何 es-plus 组件，只把「后端」换成内存实现，注入到唯一的 httpRequest 缝
 * （CrudPage httpRequest prop → mergedOptions.httpRequest）。
 *
 * 与 vue3 的差异（仅厂商 DOM 选择器不同，数据回环断言完全一致）：
 *   - 弹窗是 a-modal（.ant-modal），输入框是 .ant-input，按钮是 a-button(<button>)。
 *   - 行操作按钮在 a-table 的 #bodyCell 内渲染为 a-button。
 *   - es-table 默认 configTableField 映射 records→total, rows→tableData（与 vue3 相同）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
// 先初始化包入口，让整张模块图按「库自身既定顺序」完成初始化（对齐 vue3 spike 做法）。
// antdv 组件在模板中本地导入各 ant 组件（非全局 resolveComponent），故无需注册 EsPlus/Antd 插件；
// 仅保留此 side-effect import 保证模块图初始化顺序，避免直接 import es-crud-page.vue 触发循环依赖。
import '../src/index'
import EsCrudPage from '../src/components/es-crud-page/src/es-crud-page.vue'
import EsTable from '../src/components/es-table/src/component.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'

// ─── 内存后端：唯一的 httpRequest 缝，路由靠 url，替代真实服务端 ───
function createInMemoryBackend(seed: Array<Record<string, unknown>>) {
  let store = seed.map((r) => ({ ...r }))
  let nextId = Math.max(0, ...store.map((r) => Number(r.id) || 0)) + 1
  const calls = { list: 0, create: 0, update: 0, remove: 0 }

  const httpRequest = async (req: Record<string, any>) => {
    const { url = '', formParams = {}, pageIndex = 1, pageSize = 10 } = req
    if (url === '/api/create') {
      calls.create++
      store.push({ id: nextId++, ...formParams })
      return { code: 0 }
    }
    if (url === '/api/update') {
      calls.update++
      const i = store.findIndex((r) => r.id === formParams.id)
      if (i >= 0) store[i] = { ...store[i], ...formParams }
      return { code: 0 }
    }
    if (url === '/api/delete') {
      calls.remove++
      store = store.filter((r) => r.id !== formParams.id)
      return { code: 0 }
    }
    calls.list++
    const start = (Number(pageIndex) - 1) * Number(pageSize)
    return { records: store.length, rows: store.slice(start, start + Number(pageSize)) }
  }

  return {
    httpRequest,
    calls,
    get store() {
      return store
    },
  }
}

// 在给定根内按可见文字找按钮（a-button 渲染为原生 <button>）。
// 注意：ant-design-vue 会在按钮内的两个 CJK 字符间插入空格（"新增"→"新 增"），
// 故匹配前先去掉全部空白，避免选择器漏配。
function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  const norm = (s: string) => s.replace(/\s/g, '')
  const btns = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  return btns.find((b) => norm(b.textContent || '').includes(norm(text))) || null
}

let backend: ReturnType<typeof createInMemoryBackend>

function makeSchema(): CrudPageSchema {
  const addConfirm = async (formData: Record<string, unknown>, ctx: any) => {
    await backend.httpRequest({ url: '/api/create', method: 'post', formParams: { ...formData } })
    ctx.close()
    ctx.refresh()
  }
  const editConfirm = async (formData: Record<string, unknown>, ctx: any) => {
    await backend.httpRequest({ url: '/api/update', method: 'put', formParams: { id: ctx.row.id, ...formData } })
    ctx.close()
    ctx.refresh()
  }
  const deleteClick = (row: Record<string, unknown>, ctx: any) => {
    backend.httpRequest({ url: '/api/delete', method: 'delete', formParams: { id: row.id } }).then(() => ctx.refresh())
  }

  return {
    columns: [
      { prop: 'id', label: 'ID' },
      { prop: 'name', label: '姓名' },
    ],
    formItems: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 8 }],
    tableOptions: { actionUrl: '/api/list', rowkey: 'id' } as any,
    toolbarBtns: [{ name: '新增', key: 'add', type: 'primary', dialogKey: 'add' }],
    dialogs: {
      add: { title: '新增', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }], onConfirm: addConfirm },
      edit: { title: '编辑', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }], onConfirm: editConfirm },
    },
    operationColumn: {
      label: '操作',
      btns: [
        { name: '编辑', key: 'edit', type: 'primary', dialogKey: 'edit' },
        { name: '删除', key: 'delete', type: 'danger', click: deleteClick },
      ],
    },
  } as CrudPageSchema
}

function mountPage() {
  return mount(EsCrudPage, {
    props: { schema: makeSchema(), httpRequest: backend.httpRequest },
    attachTo: document.body,
  })
}

function dialogInput(): HTMLInputElement {
  return document.querySelector('.ant-modal input') as HTMLInputElement
}

describe('CRUD 运行时全链路（adapter-antdv, 真实组件 + 内存后端）', () => {
  beforeEach(() => {
    backend = createInMemoryBackend([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])
  })

  afterEach(() => {
    document.querySelectorAll('.dialog-containers, .ant-modal-root, .ant-modal-wrap, .ant-modal').forEach((el) => el.remove())
    document.body.innerHTML = ''
  })

  it('列表加载：挂载即经 httpRequest 拉数据并回写 data-source', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await nextTick()

    expect(backend.calls.list).toBeGreaterThanOrEqual(1)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds).toHaveLength(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('新增：点工具栏「新增」→ 弹窗填表 → 确定 → 后端 +1 → 列表刷新', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await nextTick()

    const addBtn = findButtonByText(wrapper.element, '新增')
    expect(addBtn, '工具栏应渲染出「新增」按钮').toBeTruthy()
    addBtn!.click()
    await nextTick()
    await flushPromises()

    const input = dialogInput()
    expect(input, '弹窗内应渲染出 EsForm 的输入框').toBeTruthy()
    input.value = 'Carol'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const confirmBtn = findButtonByText(document.body, '确定')
    expect(confirmBtn, '弹窗底部应渲染出「确定」按钮').toBeTruthy()
    confirmBtn!.click()
    await flushPromises()
    await nextTick()

    expect(backend.calls.create).toBe(1)
    expect(backend.store).toHaveLength(3)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds).toHaveLength(3)
    expect(wrapper.text()).toContain('Carol')
  })

  it('防重复提交：快速双击「确定」→ onConfirm 仅触发一次（新增只发生一次）', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await nextTick()

    findButtonByText(wrapper.element, '新增')!.click()
    await nextTick()
    await flushPromises()

    const input = dialogInput()
    expect(input).toBeTruthy()
    input.value = 'Carol'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const confirmBtn = findButtonByText(document.body, '确定')!
    expect(confirmBtn).toBeTruthy()
    // 在异步 onConfirm 未返回前连续点击两次：第二次应被防重入闸门忽略
    confirmBtn.click()
    confirmBtn.click()
    await flushPromises()
    await nextTick()

    expect(backend.calls.create, '双击确定后新增仅应发生一次').toBe(1)
    expect(backend.store).toHaveLength(3)
  })

  it('编辑：点行「编辑」→ 预填 → 改值 → 确定 → 后端更新 → 列表刷新', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await nextTick()

    const editBtn = findButtonByText(wrapper.element, '编辑')
    expect(editBtn, '行内应渲染出「编辑」按钮').toBeTruthy()
    editBtn!.click()
    await nextTick()
    await flushPromises()

    const input = dialogInput()
    expect(input).toBeTruthy()
    expect(input.value).toBe('Alice')
    input.value = 'Alice-Edited'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    findButtonByText(document.body, '确定')!.click()
    await flushPromises()
    await nextTick()

    expect(backend.calls.update).toBe(1)
    expect(backend.store.find((r) => r.id === 1)?.name).toBe('Alice-Edited')
    expect(wrapper.text()).toContain('Alice-Edited')
  })

  it('删除：点行「删除」→ 后端删除 → refresh → 列表 -1', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await nextTick()

    const delBtn = findButtonByText(wrapper.element, '删除')
    expect(delBtn, '行内应渲染出「删除」按钮').toBeTruthy()
    // danger 视觉对齐 vue3/EP：type:'danger' → ADV danger 布尔 → ant-btn-dangerous（实心红）。
    // 反例：type:'primary' 的「编辑」按钮不应带 dangerous 类。
    expect(delBtn!.className, '删除按钮应带 ant-btn-dangerous 类（danger 布尔已生效）').toContain('ant-btn-dangerous')
    const editBtnForContrast = findButtonByText(wrapper.element, '编辑')
    expect(editBtnForContrast!.className, 'primary 的编辑按钮不应带 dangerous 类').not.toContain('ant-btn-dangerous')
    delBtn!.click()
    await flushPromises()
    await nextTick()

    expect(backend.calls.remove).toBe(1)
    expect(backend.store).toHaveLength(1)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds).toHaveLength(1)
  })

  it('列表加载失败：自动请求 reject 被吞掉并经 request-error 暴露（无 unhandled rejection）', async () => {
    // 与 vue3 spec 同构：验证 onMounted 自动请求 rejection 被 .catch(handleAutoRequestError)
    // 吞掉，不产生 unhandled promise rejection，错误暴露到 EsTable.requestError 并 emit。
    const boom = new Error('list failed')
    const failingHttpRequest = async (req: Record<string, any>) => {
      if (!req.url || req.url === '/api/list') throw boom
      return { records: 0, rows: [] }
    }
    const unhandled: unknown[] = []
    const onUnhandled = (e: PromiseRejectionEvent) => {
      unhandled.push(e.reason)
      e.preventDefault()
    }
    window.addEventListener('unhandledrejection', onUnhandled)
    try {
      const wrapper = mount(EsCrudPage, {
        props: { schema: makeSchema(), httpRequest: failingHttpRequest },
        attachTo: document.body,
      })
      await flushPromises()
      await nextTick()

      const table = wrapper.findComponent(EsTable)
      expect((table.vm as any).requestError, '失败错误应暴露到 requestError').toBe(boom)
      expect(table.emitted('request-error'), '应 emit request-error').toBeTruthy()
      expect(unhandled, '不应出现 unhandled promise rejection').toHaveLength(0)
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  })
})
