/**
 * Tier-1 运行时 E2E 打样（vue3）
 * ────────────────────────────────────────────────────────────────────────
 * 目标：把 E2E 从「生成代码能编译」升级到「增删改查全链路在真实组件里跑通」。
 *
 * 与既有 es-crud-page.spec.ts 的本质区别：
 *   - es-crud-page.spec.ts 把 <es-table>/<es-form> STUB 掉、并 mock useDialog，
 *     只验证 props 接线，看不到任何真实数据流。
 *   - 本 spec 挂载【真实】EsCrudPage → 真实 EsTable → 真实 EsForm → 真实 useDialog，
 *     不 stub 任何 es-plus 组件，只把「后端」换成一个内存实现，注入到唯一的
 *     httpRequest 缝（app.use(EsPlus, { httpRequest }) 的等价物：CrudPage httpRequest prop）。
 *
 * 覆盖的真实链路（无一处 stub es-plus 组件）：
 *   1. 列表加载：EsTable onMounted 自动请求 → 内存后端返回 {records,rows}
 *      → formatConfigOut 写 tableData → watch 触发 update:dataSource
 *      → CrudPage v-model:data-source 回写 → 再作为 prop 下发渲染。
 *   2. 新增：点真实工具栏「新增」按钮 → handleToolbarBtnClick → openDialog('add')
 *      → 真实 useDialog 渲染 EsDialog + EsForm → 填表 → 点「确定」
 *      → validateAndConfirm → onConfirm(create) → refresh → 列表 +1。
 *   3. 编辑：点行「编辑」→ openDialog('edit', row)（预填）→ 改值 → 确定
 *      → onConfirm(update, ctx.row.id) → refresh → 值变化。
 *   4. 删除：点行「删除」自定义 click → 内存后端删除 → ctx.refresh → 列表 -1。
 *
 * 断言锚点选择：优先断言「reactive 数据回环」——
 *   wrapper.findComponent(EsTable).props('dataSource') —— 它证明
 *   httpRequest → update:dataSource → v-model 回写 → 重新下发 整条链路真的通了，
 *   且不依赖 ElTable 内部行 DOM（happy-dom 下最稳）。辅以 wrapper.text() 断言可见渲染。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
// 先初始化包入口：让整张模块图按「库自身的既定顺序」完成初始化，避免直接 import
// es-crud-page.vue 时触发 es-dialog/component.vue ↔ es-form/index.ts 的循环依赖
// 在 install 赋值时读到未求值的 default（真实 app 用 app.use(EsPlus) 时不会有此问题）。
// 同时以真实插件注册所有 es-plus 组件，最大程度贴近「真实页面」的挂载方式。
import EsPlus from '../src/index'
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
    // 默认：列表查询（default configTableField 映射 records→total, rows→tableData）
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

// 在 document.body（弹窗 teleport 目标）内按可见文字找按钮
function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  const btns = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  return btns.find((b) => (b.textContent || '').trim().includes(text)) || null
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
    // 查询表单——同时承载工具栏「新增」按钮（EsForm 有 formItems 才渲染）
    formItems: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 8 }],
    tableOptions: { actionUrl: '/api/list' },
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
    global: { plugins: [ElementPlus, EsPlus] },
  })
}

describe('CRUD 运行时全链路（vue3, 真实组件 + 内存后端）', () => {
  beforeEach(() => {
    backend = createInMemoryBackend([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])
  })

  afterEach(() => {
    document.querySelectorAll('.dialog-containers, .el-overlay, .el-dialog').forEach((el) => el.remove())
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

    const dialogInput = document.querySelector('.el-dialog .el-input__inner') as HTMLInputElement
    expect(dialogInput, '弹窗内应渲染出 EsForm 的输入框').toBeTruthy()
    dialogInput.value = 'Carol'
    dialogInput.dispatchEvent(new Event('input', { bubbles: true }))
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

    const dialogInput = document.querySelector('.el-dialog .el-input__inner') as HTMLInputElement
    expect(dialogInput).toBeTruthy()
    dialogInput.value = 'Carol'
    dialogInput.dispatchEvent(new Event('input', { bubbles: true }))
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

    const dialogInput = document.querySelector('.el-dialog .el-input__inner') as HTMLInputElement
    expect(dialogInput).toBeTruthy()
    // 预填校验：第一行是 Alice
    expect(dialogInput.value).toBe('Alice')
    dialogInput.value = 'Alice-Edited'
    dialogInput.dispatchEvent(new Event('input', { bubbles: true }))
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
    delBtn!.click()
    await flushPromises()
    await nextTick()

    expect(backend.calls.remove).toBe(1)
    expect(backend.store).toHaveLength(1)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds).toHaveLength(1)
  })

  it('列表加载失败：自动请求 reject 被吞掉并经 request-error 暴露（无 unhandled rejection）', async () => {
    // 注入一个初始列表就 reject 的后端，验证 onMounted 自动请求的 rejection
    // 被 .catch(handleAutoRequestError) 吞掉：不产生 unhandled promise rejection，
    // 且错误被暴露到 EsTable.requestError 并 emit('request-error')。
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
        global: { plugins: [ElementPlus, EsPlus] },
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

  it('命令式刷新失败：EsCrudPage.refresh() 的 reject 被吞掉并经 request-error 暴露（无 unhandled rejection）', async () => {
    // F2 的核心：命令式调用者（refresh/EsForm 查询）历史上不 catch httpRequestInstance
    // 返回的 rejected Promise，失败即冒泡成 unhandled rejection 且用户无反馈。
    // 此处首屏成功、随后切到 reject 的后端，调用 refresh()：断言 refresh 自身不抛、
    // 错误经 request-error 暴露、且全程无 unhandled promise rejection。
    let failNow = false
    const boom = new Error('refresh failed')
    const flakyHttpRequest = async (req: Record<string, any>) => {
      const url = req.url || '/api/list'
      if (url === '/api/list' && failNow) throw boom
      if (url === '/api/list') return { records: 0, rows: [] }
      return { code: 0 }
    }
    const unhandled: unknown[] = []
    const onUnhandled = (e: PromiseRejectionEvent) => {
      unhandled.push(e.reason)
      e.preventDefault()
    }
    window.addEventListener('unhandledrejection', onUnhandled)
    try {
      const wrapper = mount(EsCrudPage, {
        props: { schema: makeSchema(), httpRequest: flakyHttpRequest },
        attachTo: document.body,
        global: { plugins: [ElementPlus, EsPlus] },
      })
      await flushPromises()
      await nextTick()

      failNow = true
      // refresh() 应返回一个已被 .catch 兜底的 Promise —— await 不应抛
      await (wrapper.vm as any).refresh()
      await flushPromises()
      await nextTick()

      const table = wrapper.findComponent(EsTable)
      expect((table.vm as any).requestError, '刷新失败应暴露到 requestError').toBe(boom)
      expect(table.emitted('request-error'), '应 emit request-error').toBeTruthy()
      expect(unhandled, '命令式刷新失败不应出现 unhandled promise rejection').toHaveLength(0)
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  })
})
