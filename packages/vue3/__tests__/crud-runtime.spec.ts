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
// 内存后端 + 按文字找按钮，与 generated-runtime.spec.ts（挂生成物）**共用同一实现**：
// 两边若各写一份，后端语义一分叉，两边的绿就没有可比性。见 runtime-harness.ts。
import { createInMemoryBackend, findButtonByText } from './runtime-harness'

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

function mountPage(schema: CrudPageSchema = makeSchema()) {
  return mount(EsCrudPage, {
    props: { schema, httpRequest: backend.httpRequest },
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

  it('AI-27 底座键白名单：dialog 数据键真的下发到弹窗组件（拆白名单某键即红）', async () => {
    // 为什么需要这条**运行时见证**：`check-schema-contract` 断言的是「白名单 == AI 契约的
    // 逐键转发子集」，那是静态等式；静态等式成立并不等于运行时真的把它们交给了弹窗。
    // 这里走真实 EsCrudPage → 真实 useDialog → 真实 EsDialog，直接读回
    // 弹窗组件拿到的 vnode props 与挂载点，把「白名单确实转发」钉成行为事实。
    //
    // 把 `DIALOG_PASSTHROUGH_KEYS` 里的任一键删掉，本用例立刻红（props 上读不到它；
    // 删 appendTo 则挂载点回落到 body）。
    const host = document.createElement('div')
    host.id = 'es-ai27-host'
    document.body.appendChild(host)

    const schema = makeSchema()
    schema.dialogs!.add = {
      ...schema.dialogs!.add,
      modal: false,
      showClose: false,
      // destroyOnClose 在 useDialog 的单例分支里默认 true —— 显式传 false 才能证明
      // 「是白名单把 false 送过去的」，而不是被默认值巧合命中。
      destroyOnClose: false,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      hiddenFullBtn: true,
      appendTo: '#es-ai27-host',
    } as CrudPageSchema['dialogs'][string]

    const wrapper = mountPage(schema)
    await flushPromises()
    await nextTick()

    findButtonByText(wrapper.element, '新增')!.click()
    await nextTick()
    await flushPromises()

    // ① 挂载点：appendTo 生效 → 弹窗容器挂在 #es-ai27-host 下而非 body 直下。
    const container = document.querySelector('.dialog-containers') as HTMLElement | null
    expect(container, '应渲染出弹窗容器').toBeTruthy()
    expect(container!.parentElement?.id).toBe('es-ai27-host')

    // ② 下发值：读回弹窗组件 vnode 上的 props。
    const props = (container as unknown as { _vnode?: { props?: Record<string, unknown> } })._vnode?.props ?? {}
    expect(props.modal).toBe(false)
    expect(props.showClose).toBe(false)
    expect(props.destroyOnClose).toBe(false)
    expect(props.closeOnClickModal).toBe(false)
    expect(props.closeOnPressEscape).toBe(false)
    expect(props.hiddenFullBtn).toBe(true)
    expect(props.appendTo).toBe('#es-ai27-host')
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

// ────────────────────────────────────────────────────────────────────────────
// AI-35 —— 工具栏「显式模式」的门只认 operationColumn，不认 dialogs
// ────────────────────────────────────────────────────────────────────────────
// 缺陷形状：`normalizedToolbarBtns` 曾把 `schema.dialogs` 也当作「按钮面归我」的显式模式
//   （`if (schema.toolbarBtns || schema.dialogs) …`）。于是只声明 dialogs、不写 toolbarBtns
//   的配置（正是教程教的「新模式」写法）工具栏直接空掉：「新增」按钮不派生，
//   `dialogs.add` 无人能打开，且全程零告警 —— 页面上「新增」入口凭空消失。
// 正确方向（由 schema 的 `columns.describe` 已发布契约反推）：**按钮一律由
//   `actions`/`operationColumn` 派生，`dialogs` 只定义弹窗、不参与按钮派生**。
// 下面四例把这个门的两半都钉住：①拨错的 dialogs 不再抑制派生；②operationColumn 仍然抑制
// （这才是「按钮面归我」）；③空 toolbarBtns 逃生舱照旧；④行内派生从未受影响。
// ────────────────────────────────────────────────────────────────────────────
describe('AI-35 —— dialogs 不再抑制工具栏派生（弹窗必须有人能打开）', () => {
  /** dialogs-only：只声明弹窗，按钮面交给 actions 派生（缺陷的原始形状）。 */
  function makeDialogsOnlySchema(withToolbarBtns?: unknown): CrudPageSchema {
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
    const schema = {
      columns: [
        { prop: 'id', label: 'ID' },
        { prop: 'name', label: '姓名' },
      ],
      formItems: [{ prop: 'name', label: '姓名', formtype: 'Input', span: 8 }],
      tableOptions: { actionUrl: '/api/list' },
      actions: ['add', 'edit', 'delete'],
      dialogs: {
        add: { title: '新增', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }], onConfirm: addConfirm },
        edit: { title: '编辑', formItems: [{ prop: 'name', label: '姓名', formtype: 'Input' }], onConfirm: editConfirm },
      },
    } as unknown as CrudPageSchema
    // `undefined` = 不声明（走派生）；`[]` / 数组 = 显式声明（走逃生舱）
    if (withToolbarBtns !== undefined) (schema as any).toolbarBtns = withToolbarBtns
    return schema
  }

  beforeEach(() => {
    backend = createInMemoryBackend([{ id: 1, name: 'Alice' }])
  })

  afterEach(() => {
    document.querySelectorAll('.dialog-containers, .el-overlay, .el-dialog').forEach((el) => el.remove())
    document.body.innerHTML = ''
  })

  it('① dialogs-only：工具栏仍派生「新增」，且点它真的打开 dialogs.add（修前此处必挂）', async () => {
    const wrapper = mountPage(makeDialogsOnlySchema())
    await flushPromises()
    await nextTick()

    const addBtn = findButtonByText(wrapper.element, '新增')
    expect(addBtn, 'AI-35：只声明 dialogs 不应抑制工具栏派生 —— 「新增」必须在').toBeTruthy()
    addBtn!.click()
    await nextTick()
    await flushPromises()

    // 声明的弹窗真的被打开了（而不是一个点了没反应的死按钮）
    expect(document.querySelector('.el-dialog .el-input__inner'), '「新增」应打开 dialogs.add').toBeTruthy()
  })

  it('② 行内派生同样不受 dialogs 影响：先点「新增」再关掉，行内「编辑」照样能开编辑弹窗', async () => {
    const wrapper = mountPage(makeDialogsOnlySchema())
    await flushPromises()
    await nextTick()

    const editBtn = findButtonByText(wrapper.element, '编辑')
    expect(editBtn, 'actions 含 edit ⇒ 行内「编辑」应派生').toBeTruthy()
    editBtn!.click()
    await nextTick()
    await flushPromises()

    const input = document.querySelector('.el-dialog .el-input__inner') as HTMLInputElement
    expect(input, '行内「编辑」应打开 dialogs.edit').toBeTruthy()
    // 打开的是 edit 而非 add：弹窗标题为「编辑」，且表单预填该行（Alice）
    expect(document.querySelector('.dialog-title')?.textContent).toContain('编辑')
    expect(input.value).toBe('Alice')
  })

  it('③ 显式 operationColumn 仍然整体接管按钮面：工具栏不派生「新增」（门没被拆掉）', async () => {
    const schema = makeDialogsOnlySchema()
    ;(schema as any).operationColumn = {
      label: '操作',
      btns: [{ name: '编辑', key: 'edit', type: 'primary', dialogKey: 'edit' }],
    }
    const wrapper = mountPage(schema)
    await flushPromises()
    await nextTick()

    expect(
      findButtonByText(wrapper.element, '新增'),
      '显式 operationColumn ⇒ 按钮面归用户，工具栏不应再派生「新增」'
    ).toBeFalsy()
    // 用户自己声明的行内按钮照常渲染并可开弹窗
    const editBtn = findButtonByText(wrapper.element, '编辑')
    expect(editBtn).toBeTruthy()
    editBtn!.click()
    await nextTick()
    await flushPromises()
    expect(document.querySelector('.el-dialog .el-input__inner')).toBeTruthy()
  })

  it('④ 空 toolbarBtns 逃生舱：显式「我不需要工具栏」→ 不派生「新增」，行内仍由 actions 派生', async () => {
    const wrapper = mountPage(makeDialogsOnlySchema([]))
    await flushPromises()
    await nextTick()

    expect(
      findButtonByText(wrapper.element, '新增'),
      'toolbarBtns: [] 是「按钮面归我」的逃生舱 ⇒ 不应派生「新增」'
    ).toBeFalsy()
    expect(findButtonByText(wrapper.element, '编辑'), '行内按钮不归 toolbarBtns 管，仍应派生').toBeTruthy()
  })
})
