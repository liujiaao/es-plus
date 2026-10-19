/**
 * Tier-1 运行时见证：**生成出来的片段**（AI-43，adapter-antdv）
 * ────────────────────────────────────────────────────────────────────────
 * 与 packages/vue3/__tests__/fragment-runtime.spec.ts **同构**：同一批 golden 片段语料、
 * 同一套内存后端契约、同一组断言锚点（组件 prop / 真实数据回环），只换了 renderer。
 *
 * 两端的绿必须可比 —— 若只给 vue3 补运行时见证，`AI-SCENE-COVERAGE-PLAN.md` §1.2
 * 的「运行时」列就又变成了单端声明。断言里刻意不依赖 ant 的 DOM 类名细节。
 *
 * 覆盖：
 *   1. table：挂载即经全局 `httpRequest` 拉数（**顶层配置**，core 权威写法）→ 行渲染。
 *   2. table：pagination 容器的 pageSize/pageSizes 真到 EsTable prop。
 *   3. form：字段渲染 + 输入回写 reactive model。
 *   4. form：`layoutFormProps.formLayProps` 真到 EsForm prop。
 *   5. dialog（component 形态）：`open()` 开窗、默认插槽里的表单真的渲染、预填生效。
 *   6. dialog（composable 形态）：`useXxxDialog().open()` 创建弹窗并渲染表单。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 先初始化包入口（对齐 crud-runtime.spec.ts：让模块图按库自身顺序初始化）。
import EsPlus from '../src/index'
import EsTable from '../src/components/es-table/src/component.vue'
import EsForm from '../src/components/es-form/src/es-form.vue'
import { configureEsPlus, resetGlobalConfig } from '../src/config'
import {
  generateTableBlock,
  generateFormBlock,
  generateDialogBlock,
} from '../../shared/src/fragment-generator'

const __dirname_ = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname_, '..', '..', '..', '__tests__', 'golden', 'cases')
const TMP_DIR = join(__dirname_, '.tmp-fragments')

function loadFragmentConfig(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CASES_DIR, file), 'utf-8')).config
}

/** 变量说明符 → vitest 模块 runner 按需编译运行时写盘的 SFC/TSX。 */
async function importGenerated(spec: string): Promise<any> {
  return import(/* @vite-ignore */ spec)
}

/** 内存后端：与 vue3 的 runtime-harness 同契约（列表返回 {records, rows}）。 */
function createInMemoryBackend(seed: Array<Record<string, unknown>>) {
  let store = seed.map((r) => ({ ...r }))
  const calls = { list: 0 }
  const httpRequest = async (req: Record<string, any>) => {
    const { formParams = {}, pageIndex = 1, pageSize = 10 } = req
    calls.list++
    const start = (Number(pageIndex) - 1) * Number(pageSize)
    return { records: store.length, rows: store.slice(start, start + Number(pageSize)) }
  }
  return { httpRequest, calls, get store() { return store } }
}

function mountPlugin(backend: ReturnType<typeof createInMemoryBackend>) {
  // ⚠ 插件选项必须用**嵌套元组** `[[EsPlus, options]]`：写成 `[EsPlus, options]`
  // 会被 Vue 当成「两个插件」，options 是纯对象 → 告警且全局配置根本没写进去。
  return { plugins: [[EsPlus, { httpRequest: backend.httpRequest }]] as any }
}

/** antdv 的 a-button 会在两个汉字之间插空格（「保 存」），文本断言先归一化。 */
function textOf(el: ParentNode): string {
  return (el.textContent || '').replace(/\s+/g, '')
}

function cleanupDom() {
  document.querySelectorAll('.dialog-containers, .ant-modal, .ant-modal-root').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true })
  writeFileSync(join(TMP_DIR, 'table-01.vue'), generateTableBlock({ ...loadFragmentConfig('frag-table-01-antdv.json'), target: 'antdv' }).code)
  writeFileSync(join(TMP_DIR, 'table-02.vue'), generateTableBlock({ ...loadFragmentConfig('frag-table-02-antdv.json'), target: 'antdv' }).code)
  writeFileSync(join(TMP_DIR, 'form-01.vue'), generateFormBlock({ ...loadFragmentConfig('frag-form-01-antdv.json'), target: 'antdv' }).code)
  writeFileSync(join(TMP_DIR, 'form-02.vue'), generateFormBlock({ ...loadFragmentConfig('frag-form-02-antdv.json'), target: 'antdv' }).code)
  writeFileSync(join(TMP_DIR, 'dialog-component.vue'), generateDialogBlock({ ...loadFragmentConfig('frag-dialog-02-component-antdv.json'), target: 'antdv' }).code)
  writeFileSync(join(TMP_DIR, 'dialog-composable.tsx'), generateDialogBlock({ ...loadFragmentConfig('frag-dialog-01-antdv.json'), target: 'antdv' }).code)
})

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

afterEach(() => {
  cleanupDom()
  resetGlobalConfig()
})

describe('片段运行时（adapter-antdv）', () => {
  it('table：顶层 httpRequest 配置即能拉数，行真的渲染', async () => {
    const backend = createInMemoryBackend([
      { id: 1, name: '张三', status: '启用', amount: 12, createdAt: '2026-01-01' },
      { id: 2, name: '李四', status: '禁用', amount: 3.5, createdAt: '2026-01-02' },
    ])
    const mod = await importGenerated('./.tmp-fragments/table-01.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(backend) })
    await flushPromises()
    await nextTick()

    expect(backend.calls.list).toBeGreaterThanOrEqual(1)
    expect((wrapper.findComponent(EsTable).props('dataSource') as any[]).length).toBe(2)
    expect(wrapper.text()).toContain('张三')
    for (const name of ['查看', '编辑', '删除']) {
      // a-button 对双汉字标签插空格（「查 看」）—— 归一化后再断言。
      expect(textOf(wrapper.element)).toContain(name)
    }
  })

  it('table：pagination 容器的 pageSize/pageSizes 真到 EsTable', async () => {
    const backend = createInMemoryBackend([{ id: 1, name: '张三', status: '启用', amount: 1, createdAt: '2026-01-01' }])
    const mod = await importGenerated('./.tmp-fragments/table-02.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(backend) })
    await flushPromises()

    const pagination = wrapper.findComponent(EsTable).props('pagination') as Record<string, any>
    expect(pagination.pageSize).toBe(20)
    expect(pagination.pageSizes).toEqual([10, 20, 50])
  })

  it('form：字段渲染 + 输入回写 reactive model', async () => {
    const mod = await importGenerated('./.tmp-fragments/form-01.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(createInMemoryBackend([])) })
    await nextTick()

    const form = wrapper.findComponent(EsForm)
    expect((form.props('formItemList') as any[]).length).toBe(5)
    expect(wrapper.text()).toContain('姓名')
    const input = wrapper.find('input')
    await input.setValue('王五')
    expect((input.element as HTMLInputElement).value).toBe('王五')
    expect(textOf(wrapper.element)).toContain('保存')
    expect(textOf(wrapper.element)).toContain('重置')
  })

  it('form：formLayout 经 layoutFormProps.formLayProps 真到 EsForm', async () => {
    const mod = await importGenerated('./.tmp-fragments/form-02.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(createInMemoryBackend([])) })
    await nextTick()

    expect(wrapper.findComponent(EsForm).props('layoutFormProps')).toEqual({
      formLayProps: { labelWidth: '110px', minFoldRows: 2 },
    })
    expect(wrapper.text()).toContain('关键字')
  })

  it('dialog（component 形态）：open() 开窗 + 默认插槽表单真渲染 + 预填', async () => {
    const mod = await importGenerated('./.tmp-fragments/dialog-component.vue')
    const wrapper = mount(mod.default, { attachTo: document.body, global: mountPlugin(createInMemoryBackend([])) })
    await nextTick()
    expect(wrapper.text()).toBeFalsy()

    ;(wrapper.vm as any).open('编辑', { name: '张三', status: 1 })
    await nextTick()
    await flushPromises()

    // a-modal 默认 teleport 到 document.body —— 观察点与 vue3 的 el-dialog 不同。
    expect(textOf(document.body)).toContain('编辑')
    // 默认插槽内容是关键：EsDialog 若只渲染 render 分支，这里会只剩标题与按钮。
    expect(textOf(document.body)).toContain('姓名')
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
    expect(inputs.some((i) => i.value === '张三')).toBe(true)
  })

  it('dialog（composable 形态）：useXxxDialog().open() 创建弹窗并渲染表单', async () => {
    const mod = await importGenerated('./.tmp-fragments/dialog-composable.tsx')
    expect(typeof mod.useUserDialog).toBe('function')

    configureEsPlus({ httpRequest: createInMemoryBackend([]).httpRequest })
    const dialog = mod.useUserDialog()
    dialog.open('新增')
    await nextTick()

    expect(document.querySelector('.dialog-containers')).toBeTruthy()
    expect(document.body.textContent).toContain('新增')
    expect(document.body.textContent).toContain('姓名')
  })
})
