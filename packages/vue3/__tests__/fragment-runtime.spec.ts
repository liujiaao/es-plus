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
import { nextTick } from 'vue'
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
import { createInMemoryBackend } from './runtime-harness'

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
})
