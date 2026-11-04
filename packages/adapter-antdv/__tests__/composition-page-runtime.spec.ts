/**
 * Tier-1 运行时见证：**组合页**（P6b，adapter-antdv）
 * ────────────────────────────────────────────────────────────────────────
 * 与 `packages/vue3/__tests__/composition-page-runtime.spec.ts` **同构**：同一份组合
 * 语料、同一个 `emitComposition` 生产路径、同一组断言锚点（真实请求 / 真实弹窗 /
 * 真实行数据），只换了 renderer。
 *
 * 存在的理由：组合页的胶水是**生成出来的**，antdv 端的组件 prop / 事件名与 vue3
 * 不同。只给 vue3 见证会让 antdv 的组合产物停留在「编译通过」——那正是本仓反复
 * 咬到的「声明了却没人见证」。
 *
 * 断言刻意不依赖 ant 的 DOM 类名细节：按钮按**归一化文本**找（a-button 会在两个
 * CJK 字符间插空格），弹窗按标题文本 + 预填值判。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 先初始化包入口，让整张模块图按「库自身既定顺序」完成初始化。
import EsPlus from '../src/index'
import EsForm from '../src/components/es-form/src/es-form.vue'
import { resetGlobalConfig } from '../src/config'
import { emitComposition, type CompositionPlan } from '../../shared/src/scene/composition'

const __dirname_ = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname_, '..', '..', '..', '__tests__', 'golden', 'cases')
const TMP_DIR = join(__dirname_, '.tmp-composition')

function fragmentIntent(file: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf-8')) as {
    target: string
    config: Record<string, unknown>
  }
  return { ...raw.config, target: raw.target }
}

/**
 * 双路内存后端：列表请求（无 method）走 GET 分支返回种子行；弹窗的 PUT/POST
 * 只记录请求并回 `{ code: 0 }`。两条路由分开，避免把「提交」错判成「又拉了一次列表」。
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
    global: { plugins: [[EsPlus, { httpRequest: backend.httpRequest }]] as any },
  })
}

/** antdv 的 a-button 会在两个汉字之间插空格（「查 看」），文本断言先归一化。 */
function textOf(el: ParentNode): string {
  return (el.textContent || '').replace(/\s+/g, '')
}

function findButtonByText(root: ParentNode, text: string): HTMLElement | null {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLElement[]
  return buttons.find((b) => textOf(b).includes(text)) ?? null
}

function cleanupDom() {
  document.querySelectorAll('.dialog-containers, .ant-modal-root, .ant-modal-wrap, #app').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

/**
 * 弹窗片段的 `options.appendTo:'#app'` 是**挂载期**就解析的 Teleport 目标 ——
 * 容器必须早于组件存在。
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

afterEach(() => {
  cleanupDom()
  resetGlobalConfig()
})

function fullPlan(): CompositionPlan {
  return {
    target: 'antdv',
    nodes: [
      { id: 'users', plan: { scene: 'table', intent: fragmentIntent('frag-table-01-antdv.json') } },
      { id: 'filter', plan: { scene: 'form', intent: fragmentIntent('frag-form-02-antdv.json') } },
      { id: 'edit', plan: { scene: 'dialog', intent: fragmentIntent('frag-dialog-02-component-antdv.json') } },
    ],
  } as CompositionPlan
}

describe('组合页运行时（adapter-antdv · 表格 + 查询表单 + 弹窗）', () => {
  it('查询 model 真到请求参数；重置后用空条件重新取数', async () => {
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'full'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    expect(backend.listCalls).toBeGreaterThanOrEqual(1)
    expect(textOf(wrapper.element)).toContain('张三')

    const before = backend.listCalls
    const form = wrapper.findComponent(EsForm)
    expect(form.exists()).toBe(true)
    await form.find('input').setValue('ZZZ')
    findButtonByText(wrapper.element, '查询')!.click()
    await flushPromises()
    await nextTick()
    expect(backend.listCalls).toBe(before + 1)
    expect(backend.lastListParams?.keyword).toBe('ZZZ')

    const afterQuery = backend.listCalls
    findButtonByText(wrapper.element, '重置')!.click()
    await flushPromises()
    await nextTick()
    expect(backend.listCalls).toBe(afterQuery + 1)
    expect(backend.lastListParams?.keyword).toBeUndefined()
  })

  it('行按钮 edit → 以 intent.defaultTitle 开窗、带该行数据；提交成功 → 表格重新取数', async () => {
    const host = document.getElementById('app') as HTMLElement
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'full'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    findButtonByText(wrapper.element, '编辑')!.click()
    await nextTick()
    await flushPromises()

    // 标题来自语料的 intent.defaultTitle（'用户编辑'），不是节点 id。
    expect(host.textContent).toContain('用户编辑')
    const inputs = Array.from(host.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.some((i) => i.value === '张三')).toBe(true)

    const before = backend.listCalls
    findButtonByText(host, '确定')!.click()
    await flushPromises()
    await nextTick()

    expect(backend.writes).toHaveLength(1)
    expect(backend.writes[0]).toMatchObject({ method: 'PUT', url: '/api/users/1' })
    expect(backend.listCalls).toBe(before + 1)
  })

  it('没有 dialog 节点的行动作升级为页面事件 row-action', async () => {
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'full'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    findButtonByText(wrapper.element, '查看')!.click()
    await flushPromises()
    await nextTick()

    const emitted = wrapper.emitted('row-action') as any[] | undefined
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toMatchObject({ key: 'view', row: { id: 1, name: '张三' } })
  })

  it('页面 open(id, options) 命中返回 true，未知 id 返回 false', async () => {
    const host = document.getElementById('app') as HTMLElement
    const backend = createBackend(SEED)
    const Page = (await importPage(writeComposition(fullPlan(), 'open-api'))).default
    const wrapper = mountPage(Page, backend)
    await flushPromises()
    await nextTick()

    const vm = wrapper.vm as any
    expect(vm.open('nope')).toBe(false)
    expect(vm.open('edit', { row: SEED[1] })).toBe(true)
    await nextTick()
    await flushPromises()

    expect(host.textContent).toContain('用户编辑')
    const inputs = Array.from(host.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.some((i) => i.value === '李四')).toBe(true)
  })
})
