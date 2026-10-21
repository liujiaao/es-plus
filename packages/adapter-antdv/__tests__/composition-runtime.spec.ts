/**
 * Tier-1 运行时见证：**三组件组合**（AN-17，adapter-antdv）
 * ────────────────────────────────────────────────────────────────────────
 * 与 `packages/vue3/__tests__/composition-runtime.spec.ts` **同构**：同一份组合语料
 * （`comp-full-01`）、同一条生产路径（surfaces → composeCrudConfig → generateFromConfig
 * → 挂载真组件）、同一组组合断言（成员布尔落地 / 同名归并 / 弹窗体来自 form 面）。
 *
 * 断言刻意不依赖 ant 的 DOM 类名细节：按钮按**归一化文本**找（a-button 会在两个 CJK
 * 字符间插空格），弹窗体按文本判，「列字段」直接读 EsTable 的 columns prop。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// 先初始化包入口，让整张模块图按「库自身既定顺序」完成初始化（对齐 crud-runtime.spec.ts）。
import '../src/index'
import EsCrudPage from '../src/components/es-crud-page/src/es-crud-page.vue'
import EsTable from '../src/components/es-table/src/component.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'
import type { StructuredCrudConfig } from '../../shared/src/structured-generator'
import { composeCrudConfig } from '../../shared/src/compose-crud-config'
import { generateFromConfig } from '../../shared/src/structured-generator'

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '__tests__', 'golden', 'composition')
const CASE_FILE = 'comp-full-01-antdv.json'

interface CompositionCase {
  id: string
  shape: string
  target: string
  mode: 'schema' | 'sfc'
  name: string
  apiUrl: string
  surfaces: { query?: any[]; table?: any[]; form?: any[]; dialog?: string[] }
}

const DIALOG_TITLES: Record<string, string> = { add: '新增', edit: '编辑', view: '查看' }

/** 与 `generate-crud.ts` 有表支完全同构的组合装配。 */
function composeCase(c: CompositionCase): StructuredCrudConfig {
  const s = c.surfaces
  const table = s.table ?? []
  const form = s.form ?? []
  const dialogBody = form.length ? form : table
  const dialogs = s.dialog
    ? Object.fromEntries(s.dialog.map((key) => [key, { title: DIALOG_TITLES[key] ?? key, formItems: dialogBody }]))
    : undefined
  const { config } = composeCrudConfig({
    name: c.name,
    apiUrl: c.apiUrl,
    target: c.target as any,
    mode: c.mode,
    query: s.query ?? [],
    table,
    form,
    ...(dialogs ? { dialogs: dialogs as any } : {}),
  })
  return config as unknown as StructuredCrudConfig
}

function loadCase(): CompositionCase {
  return JSON.parse(readFileSync(join(CASES_DIR, CASE_FILE), 'utf-8')) as CompositionCase
}

/** schema 模式产物 → 运行时 pageSchema（与 vue3 runtime-harness 同一条正则）。 */
function pageSchemaOf(config: StructuredCrudConfig): CrudPageSchema {
  const { code } = generateFromConfig({ ...config, mode: 'schema' })
  const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
  if (!m) throw new Error(`生成物里找不到 pageSchema 对象字面量：\n${code.slice(0, 200)}`)
  return JSON.parse(m[1]) as CrudPageSchema
}

function createInMemoryBackend(seed: Array<Record<string, unknown>>) {
  let store = seed.map((r) => ({ ...r }))
  let nextId = Math.max(0, ...store.map((r) => Number(r.id) || 0)) + 1
  const calls = { list: 0, create: 0, update: 0, remove: 0 }
  let lastListParams: Record<string, unknown> | null = null
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
    lastListParams = { ...formParams }
    const start = (Number(pageIndex) - 1) * Number(pageSize)
    return { records: store.length, rows: store.slice(start, start + Number(pageSize)) }
  }
  return {
    httpRequest,
    calls,
    get store() {
      return store
    },
    get lastListParams() {
      return lastListParams
    },
  }
}

type Backend = ReturnType<typeof createInMemoryBackend>

function seedFromSchema(schema: CrudPageSchema, n = 2): Array<Record<string, unknown>> {
  const props = (schema.columns || []).map((c) => c.prop).filter((p): p is string => !!p && p !== 'operate')
  return Array.from({ length: n }, (_, i) => {
    const row: Record<string, unknown> = { id: i + 1 }
    for (const p of props) row[p] = `R${i + 1}-${p}`
    return row
  })
}

/** a-button 会在两汉字间插空格 —— 归一化后按包含匹配。 */
function findButtonByText(root: ParentNode, text: string): HTMLElement | null {
  const norm = (s: string) => s.replace(/\s+/g, '')
  const btns = Array.from(root.querySelectorAll('button')) as HTMLElement[]
  return btns.find((b) => norm(b.textContent || '').includes(norm(text))) ?? null
}

function cleanup() {
  document.querySelectorAll('.ant-modal, .ant-modal-root, .ant-modal-wrap, .dialog-containers').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

describe('三组件组合运行时（adapter-antdv · comp-full-01）', () => {
  let config: StructuredCrudConfig
  let schema: CrudPageSchema
  let backend: Backend
  let wrapper: VueWrapper

  beforeEach(async () => {
    config = composeCase(loadCase())
    schema = pageSchemaOf(config)
    backend = createInMemoryBackend(seedFromSchema(schema))
    wrapper = mount(EsCrudPage, {
      props: { schema, httpRequest: backend.httpRequest },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
  })

  afterEach(cleanup)

  it('组合产物能渲染：挂载即拉数 → 行回写 → 列恰好是 table 面', () => {
    expect(backend.calls.list).toBeGreaterThanOrEqual(1)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds).toHaveLength(2)
    expect(wrapper.text()).toContain('R1-name')

    const columnProps = (schema.columns ?? []).map((c) => c.prop)
    expect(columnProps.sort()).toEqual(['createdAt', 'name', 'status'])
    expect(columnProps).not.toContain('remark')
  })

  it('同名字段归并 + 查询面：query 面恰好两个字段，查询能触发表格重载', async () => {
    const queryProps = (schema.formItems ?? []).map((it: any) => it.prop)
    expect(queryProps.sort()).toEqual(['name', 'status'])

    const input = wrapper.element.querySelector('input') as HTMLInputElement | null
    expect(input).toBeTruthy()
    input!.value = 'ZZZ'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const before = backend.calls.list
    const queryBtn = findButtonByText(wrapper.element, '查询')
    expect(queryBtn).toBeTruthy()
    queryBtn!.click()
    await flushPromises()
    await nextTick()
    expect(backend.calls.list).toBeGreaterThan(before)
    expect(backend.lastListParams?.name).toBe('ZZZ')
  })

  it('弹窗体来自 form 面（不是表格面）：打开「新增」→ 有备注、无创建时间', async () => {
    const trigger = findButtonByText(wrapper.element, '新增')
    expect(trigger).toBeTruthy()
    trigger!.click()
    await nextTick()
    await flushPromises()

    const dialog = document.querySelector('.ant-modal')
    expect(dialog).toBeTruthy()
    const text = (dialog!.textContent || '').replace(/\s+/g, '')
    expect(text).toContain('备注')
    expect(text).toContain('姓名')
    expect(text).toContain('状态')
    expect(text).not.toContain('创建时间')
  })
})
