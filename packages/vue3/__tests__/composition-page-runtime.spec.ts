/**
 * Tier-1 运行时见证：**组合页**（P6b，vue3）
 * ────────────────────────────────────────────────────────────────────────
 * `check-composition-contract` 证明「接线是从 ARTIFACT_RUNTIME 派生的、页面代码与
 * faces 自洽」；本 spec 证明另一半：**派生出来的胶水真的把三个片段接活了**。
 *
 * 输入全部来自 golden 片段语料（不是手写样张）：
 *   frag-table-01-vue3      → 表格节点 users（查看/编辑/删除 三个行按钮）
 *   frag-form-02-vue3       → 查询表单节点 filter（context=query）
 *   frag-dialog-02-component-vue3 → 弹窗节点 edit（mode=component，`appendTo:'#app'`）
 *
 * `emitComposition` 产物写到 `__tests__/.tmp-composition/`，用**变量**动态 import
 * 加载 `Page.vue`（与 fragment-runtime.spec.ts 同一条路：vitest 模块 runner 按需
 * 编译 SFC）。afterAll 清理；产物不进版本库。
 *
 * 断言锚点选「只有胶水接对了才会发生的事」：
 *   1. 查询表单的 model 真的到了表格请求参数（form.query → table.refresh(model)）；
 *   2. 表格行按钮 `edit` 真的打开了以注册表标题为题的弹窗，且带的是**该行**数据；
 *   3. 弹窗提交成功 → 表格真的重新取数（dialog.onSuccess → table.refresh()）；
 *   4. 没有 dialog 节点的 `view` 行动作升级为页面事件 `row-action`（不静默丢弃）；
 *   5. 提交表单 → 页面事件 `save`（片段不管「保存到哪」，交给宿主）。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 先初始化包入口（与 fragment-runtime.spec.ts 同因：让模块图按库自身顺序完成初始化）。
import EsPlus from '../src/index'
import EsForm from '../src/components/es-form/src/es-form.vue'
import { emitComposition, type CompositionPlan } from '../../shared/src/scene/composition'
import { findButtonByText } from './runtime-harness'

const __dirname_ = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname_, '..', '..', '..', '__tests__', 'golden', 'cases')
const TMP_DIR = join(__dirname_, '.tmp-composition')

/** 读 golden 片段用例，拼成 `emitSceneArtifact` 认的 intent（片段输入本身不含 target）。 */
function fragmentIntent(file: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf-8')) as {
    target: string
    config: Record<string, unknown>
  }
  return { ...raw.config, target: raw.target }
}

/**
 * 双路内存后端：列表请求（无 method）走 GET 分支返回种子行；弹窗的 PUT/POST
 * 只记录请求并回 `{ code: 0 }`。两条路由分开的原因见 fragment-runtime 的
 * `createRecordingBackend` 注释 —— 弹窗发的是它自己的 apiUrl，与列表同 URL 同后端时
 * 容易把「提交」错判成「又拉了一次列表」。
 */
function createBackend(seed: Array<Record<string, unknown>>) {
  const writes: Array<{ method: string; url: string; data: Record<string, any> }> = []
  let listCalls = 0
  let lastListParams: Record<string, unknown> | null = null
  const httpRequest = async (req: Record<string, any>) => {
    const method = String(req.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      listCalls++
      lastListParams = { ...(req.formParams ?? {}) }
      return { records: seed.length, rows: seed }
    }
    writes.push({ method, url: String(req.url), data: req.data ?? {} })
    return { code: 0 }
  }
  return {
    httpRequest,
    writes,
    get listCalls() {
      return listCalls
    },
    get lastListParams() {
      return lastListParams
    },
  }
}

type Backend = ReturnType<typeof createBackend>

/** 把组合产物写盘，返回 Page.vue 的**变量** import 说明符。 */
function writeComposition(plan: CompositionPlan, dir: string): string {
  const result = emitComposition(plan)
  if (result.isError) throw new Error(result.text)
  const sub = join(TMP_DIR, dir)
  mkdirSync(sub, { recursive: true })
  for (const file of result.files!) writeFileSync(join(sub, file.path), file.code)
  return `./.tmp-composition/${dir}/Page.vue`
}

async function importPage(spec: string): Promise<any> {
  return import(/* @vite-ignore */ spec)
}

function mountPage(Page: any, backend: Backend): VueWrapper {
  return mount(Page, {
    attachTo: document.body,
    global: { plugins: [ElementPlus, [EsPlus, { httpRequest: backend.httpRequest }]] as any },
  })
}

function cleanupDom() {
  document.querySelectorAll('.dialog-containers, .el-overlay, .el-dialog, #app').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

/**
 * 弹窗片段的 `appendTo:'#app'` 是**挂载期**就解析的 Teleport 目标 —— 容器必须早于
 * 组件存在，否则 Vue 会发 warn（happy-dom 下这条警告的格式化本身会崩）。
 */
function createAppHost(): HTMLElement {
  const host = document.createElement('div')
  host.id = 'app'
  document.body.appendChild(host)
  return host
}

const SEED = [
  { id: 1, name: '张三', status: 1, amount: 12, createdAt: '2026-01-01' },
  { id: 2, name: '李四', status: 0, amount: 3.5, createdAt: '2026-01-02' },
]

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true })
})

beforeEach(() => {
  createAppHost()
})

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

afterEach(cleanupDom)

function fullPlan(): CompositionPlan {
  return {
    target: 'vue3',
    nodes: [
      { id: 'users', plan: { scene: 'table', intent: fragmentIntent('frag-table-01-vue3.json') } },
      { id: 'filter', plan: { scene: 'form', intent: fragmentIntent('frag-form-02-vue3.json') } },
      { id: 'edit', plan: { scene: 'dialog', intent: fragmentIntent('frag-dialog-02-component-vue3.json') } },
    ],
  } as CompositionPlan
}

describe('组合页运行时（vue3 · 表格 + 查询表单 + 弹窗）', () => {
  it('查询 model 真的下发到表格请求（form.query → table.refresh(model)）', async () => {
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'full'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    expect(backend.listCalls).toBeGreaterThanOrEqual(1)
    // 表格片段真的从后端拿回了行（不是只挂了个空壳）。
    expect(wrapper.text()).toContain('张三')

    const before = backend.listCalls
    const form = wrapper.findComponent(EsForm)
    expect(form.exists()).toBe(true)
    await form.find('input').setValue('ZZZ')
    findButtonByText(wrapper.element, '查询')!.click()
    await flushPromises()
    await nextTick()

    expect(backend.listCalls).toBe(before + 1)
    expect(backend.lastListParams?.keyword).toBe('ZZZ')
  })

  it('行按钮 edit → 以注册表标题打开弹窗、带该行数据；提交成功 → 表格重新取数', async () => {
    const host = document.getElementById('app') as HTMLElement
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'full'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    // 表格行的「编辑」按钮（弹窗此时还没开，页面上只有这一处）。
    const editBtn = findButtonByText(wrapper.element, '编辑')
    expect(editBtn).toBeTruthy()
    editBtn!.click()
    await nextTick()
    await flushPromises()

    // 标题来自 DIALOG_TITLES.edit（节点 id = 行动作 key），不是表格按钮的 name。
    expect(host.querySelector('.el-dialog')).not.toBeNull()
    expect(host.textContent).toContain('编辑')
    // 带的是**该行**的数据（表格第一行 张三）。
    const inputs = Array.from(host.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.some((i) => i.value === '张三')).toBe(true)

    const before = backend.listCalls
    findButtonByText(host, '确定')!.click()
    await flushPromises()
    await nextTick()

    // 提交走 PUT（编辑语义），成功后 onSuccess → 页面 onTableSuccess → 表格 refresh。
    expect(backend.writes).toHaveLength(1)
    expect(backend.writes[0]).toMatchObject({ method: 'PUT', url: '/api/users/1' })
    expect(backend.listCalls).toBe(before + 1)
  })

  it('没有 dialog 节点的行动作升级为页面事件 row-action（不静默丢弃）', async () => {
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'full'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    // 「查看」没有 id=view 的 dialog 节点 —— 契约要求它升级为页面事件。
    findButtonByText(wrapper.element, '查看')!.click()
    await flushPromises()
    await nextTick()

    const emitted = wrapper.emitted('row-action') as any[] | undefined
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toMatchObject({ key: 'view' })
    expect(emitted![0][0].row).toMatchObject({ id: 1, name: '张三' })
    // 有表格时页面仍暴露 refresh / reload（faces.expose 与产物一致）。
    expect(typeof (wrapper.vm as any).refresh).toBe('function')
    expect(typeof (wrapper.vm as any).reload).toBe('function')
  })

  it('提交表单 → 页面事件 save 携带 model（片段不替宿主决定保存到哪）', async () => {
    const plan: CompositionPlan = {
      target: 'vue3',
      nodes: [
        { id: 'users', plan: { scene: 'table', intent: fragmentIntent('frag-table-01-vue3.json') } },
        { id: 'save-form', plan: { scene: 'form', intent: fragmentIntent('frag-form-01-vue3.json') } },
      ],
    } as CompositionPlan
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(plan, 'save'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    // frag-form-01：姓名必填；填上再点「保存」（片段先 validate 再 emit submit）。
    await wrapper.findComponent(EsForm).find('input').setValue('王五')
    findButtonByText(wrapper.element, '保存')!.click()
    await flushPromises()
    await nextTick()

    const save = wrapper.emitted('save') as any[] | undefined
    expect(save).toBeTruthy()
    expect(save![0][0]).toMatchObject({ name: '王五' })
  })
})
