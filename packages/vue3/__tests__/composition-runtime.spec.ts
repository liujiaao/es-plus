/**
 * Tier-1 运行时见证：**三组件组合**（AN-17，vue3）
 * ────────────────────────────────────────────────────────────────────────
 * AN-17 的 18 条组合语料（6 例/target）里，取一条 **full** 形状
 * （query+table+form+dialog）在真实组件栈里跑一遍 —— 组合不是「把三段代码拼在一起」，
 * 它必须真的变成一张能拉数、能查、能开弹窗的页面。
 *
 * 路径与生产一致（不是手写 schema）：
 *   composition case surfaces ──composeCrudConfig──▶ StructuredCrudConfig
 *   ──generateFromConfig(mode:schema)──▶ pageSchema
 *   ──mount(真实 EsCrudPage + EsTable + EsForm + useDialog)──▶ 断言
 *
 * 断言锚点选「组合才会有的东西」：
 *   1. 成员布尔落地：table-only 的 createdAt **不在**表单里、form-only 的 remark **不在**
 *      查询/表格里；查询面恰好是 query 的两个字段。
 *   2. 同名字段归并：name/status 同时出现在 query+table+form，页面上只有**一条**列、
 *      查询表单里一条、弹窗里一条（不是三份各自为政）。
 *   3. 动作派生：full 形状显式 dialogs → 工具栏「新增」可开窗，弹窗体 = form 面
 *      （含 remark），而不是把表格列当弹窗体。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ElementPlus from 'element-plus'
// 先初始化包入口（与 crud-runtime.spec.ts 同因：让整张模块图按库自身顺序完成初始化）。
import EsPlus from '../src/index'
import EsCrudPage from '../src/components/es-crud-page/src/es-crud-page.vue'
import EsTable from '../src/components/es-table/src/component.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'
import type { StructuredCrudConfig } from '../../shared/src/structured-generator'
import { composeCrudConfig } from '../../shared/src/compose-crud-config'
import {
  createInMemoryBackend,
  findButtonByText,
  generatePageSchema,
  seedFromSchema,
  firstColumnProp,
} from './runtime-harness'

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '__tests__', 'golden', 'composition')
const CASE_FILE = 'comp-full-01-vue3.json'

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

/**
 * 与 `generate-crud.ts` 有表支完全同构的组合：
 * 罐头 dialog key → `{ title: 默认标题, formItems: form 面（无则 table 面） }`。
 */
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

function mountPage(schema: CrudPageSchema, backend: ReturnType<typeof createInMemoryBackend>): VueWrapper {
  return mount(EsCrudPage, {
    props: { schema, httpRequest: backend.httpRequest },
    attachTo: document.body,
    global: { plugins: [ElementPlus, [EsPlus, {}]] as any },
  })
}

function cleanup() {
  document.querySelectorAll('.dialog-containers, .el-overlay, .el-dialog').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

describe('三组件组合运行时（vue3 · comp-full-01）', () => {
  let config: StructuredCrudConfig
  let schema: CrudPageSchema
  let backend: ReturnType<typeof createInMemoryBackend>
  let wrapper: VueWrapper

  beforeEach(async () => {
    config = composeCase(loadCase())
    schema = generatePageSchema(config)
    backend = createInMemoryBackend(seedFromSchema(schema))
    wrapper = mountPage(schema, backend)
    await flushPromises()
    await nextTick()
  })

  afterEach(cleanup)

  it('组合产物能渲染：挂载即拉数 → 行回写 → 表格列恰好是 table 面', () => {
    expect(backend.calls.list).toBeGreaterThanOrEqual(1)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds).toHaveLength(2)
    expect(wrapper.text()).toContain(`R1-${firstColumnProp(schema)}`)

    // 成员布尔真的进了列：table 面 = name/status/createdAt（form-only 的 remark 不得混入）。
    const columnProps = (schema.columns ?? []).map((c) => c.prop)
    expect(columnProps.sort()).toEqual(['createdAt', 'name', 'status'])
    expect(columnProps).not.toContain('remark')
  })

  it('同名字段归并 + 查询面：query 面恰好两个字段，且查询能触发表格重载', async () => {
    // 查询表单 = query 面（name/status）；createdAt 只在表格面，remark 只在表单面。
    const queryProps = (schema.formItems ?? []).map((it: any) => it.prop)
    expect(queryProps.sort()).toEqual(['name', 'status'])

    const input = wrapper.element.querySelector('.es-crud-page .el-input__inner') as HTMLInputElement | null
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

    const dialog = document.querySelector('.el-dialog')
    expect(dialog).toBeTruthy()
    const text = (dialog!.textContent || '').replace(/\s+/g, '')
    // form-only 字段必须出现；table-only 字段不得被当作弹窗体。
    expect(text).toContain('备注')
    expect(text).toContain('姓名')
    expect(text).toContain('状态')
    expect(text).not.toContain('创建时间')
  })
})
