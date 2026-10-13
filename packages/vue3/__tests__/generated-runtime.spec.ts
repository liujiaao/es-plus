/**
 * AI-03 —— runtime tier：挂载**生成出来的** schema（而非手写 schema）
 * ────────────────────────────────────────────────────────────────────────
 * 既有 crud-runtime.spec.ts 挂的是手写 CrudPageSchema —— 它证明「EsCrudPage 能跑」，
 * 但**不**证明「生成器产出的 schema 能跑」。golden 的 Tier-0（vite build）只证明
 * 「生成物能编译」，编译 ≠ 能跑。本 spec 补上缺的那一环：
 *
 *   golden config ──generateFromConfig(mode:schema)──▶ pageSchema（运行时对象）
 *   ──mount(真实 EsCrudPage + 真实 EsTable/EsForm/useDialog + 内存后端)──▶ 冒烟断言
 *
 * 断言三件事（对应 AI-03 验收「能渲染、表单能填、弹窗能开」）：
 *   1. 能渲染：挂载即经 httpRequest 拉数、回写 data-source、行文本可见。
 *   2. 表单能填 + 零代码联动：查询表单可输入，点「查询」即触发表格重载，
 *      且填入值确实作为 formParams 下发——这条正是 AI-18 的 form↔table provide/inject
 *      契约（schema 模式下由 EsCrudPage 内部嵌套 + triggerEvent 承载）在运行时真的通了。
 *   3. 弹窗能开：点开一个真实弹窗触发器 → 真实 useDialog 渲染出 EsDialog + EsForm 输入框。
 *
 * 用例取 golden 子集，覆盖三种装配路径：
 *   01 legacy actions 模式（actions 推导 toolbar/行操作/弹窗；工具栏有「新增」）
 *   05 显式 dialogs 新模式（**工具栏不自动生成「新增」**，弹窗靠行内「编辑」打开）
 *   13 多 formtype（查询表单里 Select/DatePicker/Radio/Switch 混排）
 * 另单列 30：列级 permissionValue 在运行时真的门控（AI-20 的运行时验证）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import ElementPlus from 'element-plus'
// 先初始化包入口（与 crud-runtime.spec.ts 同因：让整张模块图按库自身顺序完成初始化）。
import EsPlus from '../src/index'
import EsCrudPage from '../src/components/es-crud-page/src/es-crud-page.vue'
import EsTable from '../src/components/es-table/src/component.vue'
import EsForm from '../src/components/es-form/src/es-form.vue'
import type { CrudPageSchema } from '../src/components/es-crud-page/src/types'
import type { StructuredCrudConfig } from '../../shared/src/structured-generator'
import {
  createInMemoryBackend,
  findButtonByText,
  loadGoldenConfig,
  generatePageSchema,
  seedFromSchema,
  firstColumnProp,
} from './runtime-harness'

type Backend = ReturnType<typeof createInMemoryBackend>

/**
 * 挂载真实 EsCrudPage。
 *
 * ⚠ 全局配置（如 permission）**必须经插件选项**传入，不能先 `configureEsPlus()` 再挂载：
 * `EsPlus` 的 install 会执行 `configureEsPlus(options)`（把先前设的配置**洗掉**）并
 * `provide('$EsPlus', {...options})`（组件优先读注入值）。所以 `plugins: [[EsPlus, {permission}]]`
 * 是唯一生效路径。
 */
function mountPage(schema: CrudPageSchema, backend: Backend, pluginOptions: Record<string, unknown> = {}): VueWrapper {
  return mount(EsCrudPage, {
    props: { schema, httpRequest: backend.httpRequest },
    attachTo: document.body,
    global: { plugins: [ElementPlus, [EsPlus, pluginOptions]] },
  })
}

function cleanup() {
  document.querySelectorAll('.dialog-containers, .el-overlay, .el-dialog').forEach((el) => el.remove())
  document.body.innerHTML = ''
}

/** 第一个进查询表单的字段 prop（三个用例首字段均为 Input —— 见 cases 摘要）。 */
function firstQueryProp(config: StructuredCrudConfig): string {
  const f = (config.fields || []).find((x) => x.inQuery !== false && x.prop)
  if (!f) throw new Error('config 无查询字段')
  return f.prop as string
}

// ────────────────────────────────────────────────────────────────────────────
// 1) 三个装配路径的通用冒烟
//    第三个元素 = 该装配路径下真正能打开弹窗的按钮文案：
//      legacy 模式工具栏有「新增」；显式 dialogs 模式工具栏不生成「新增」，走行内「编辑」。
// ────────────────────────────────────────────────────────────────────────────
describe.each([
  ['01-user-manage.json', 'legacy actions 模式', '新增'],
  ['05-customer-multi-dialog.json', '显式 dialogs 新模式', '编辑'],
  ['13-all-formtypes.json', '多 formtype 查询表单', '新增'],
])('生成物运行时冒烟 — %s（%s）', (file, _label, dialogTrigger) => {
  let config: StructuredCrudConfig
  let schema: CrudPageSchema
  let backend: Backend
  let wrapper: VueWrapper

  beforeEach(async () => {
    config = loadGoldenConfig(file)
    schema = generatePageSchema(config)
    backend = createInMemoryBackend(seedFromSchema(schema))
    wrapper = mountPage(schema, backend)
    await flushPromises()
    await nextTick()
  })

  afterEach(cleanup)

  it('能渲染：挂载即拉数 → 回写 data-source → 行文本可见', () => {
    expect(backend.calls.list, '挂载应触发一次列表请求').toBeGreaterThanOrEqual(1)
    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds, '生成物应把后端 rows 回写到 data-source').toHaveLength(2)
    // 第一列的值来自种子数据（seedFromSchema 按列 prop 生成）——不依赖具体用例字段名。
    expect(wrapper.text()).toContain(`R1-${firstColumnProp(schema)}`)
  })

  it('表单能填 + 零代码联动：输入查询值 → 点「查询」→ 表格重载且值下发为 formParams', async () => {
    const input = wrapper.element.querySelector('.es-crud-page .el-input__inner') as HTMLInputElement | null
    expect(input, '查询表单应渲染出输入框').toBeTruthy()
    input!.value = 'ZZZ'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const before = backend.calls.list
    const queryBtn = findButtonByText(wrapper.element, '查询')
    expect(queryBtn, '查询表单应有「查询」按钮').toBeTruthy()
    queryBtn!.click()
    await flushPromises()
    await nextTick()

    // 「点了查询会重新取数」= form↔table 的 provide/inject + triggerEvent 契约真的打通
    expect(backend.calls.list, '点查询应触发一次新的列表请求').toBeGreaterThan(before)
    // 且填入值确实作为 formParams 下发（表单确实是「活」的，不是静态装饰）
    expect(backend.lastListParams?.[firstQueryProp(config)], '查询值应随 formParams 下发').toBe('ZZZ')
  })

  it(`弹窗能开：点「${dialogTrigger}」→ 真实 useDialog 渲染 EsForm 输入框`, async () => {
    const trigger = findButtonByText(wrapper.element, dialogTrigger)
    expect(trigger, `生成物应渲染出「${dialogTrigger}」按钮`).toBeTruthy()
    trigger!.click()
    await nextTick()
    await flushPromises()

    const dialogInput = document.querySelector('.el-dialog .el-input__inner')
    expect(dialogInput, '弹窗内应渲染出 EsForm 的输入框').toBeTruthy()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 2) 列级 permissionValue 的运行时门控（AI-20 的运行时验证）
//    golden-30 的 netPay 列挂 permissionValue:'payroll:netpay:view'。
//    「实发合计」这一列渲染与否，当且仅当全局 permission() 放行该码。
// ────────────────────────────────────────────────────────────────────────────
describe('生成物运行时冒烟 — 30-payroll（列级 permissionValue 门控）', () => {
  let schema: CrudPageSchema
  let backend: Backend

  beforeEach(() => {
    schema = generatePageSchema(loadGoldenConfig('30-payroll-field-permission.json'))
    backend = createInMemoryBackend(seedFromSchema(schema))
  })

  afterEach(cleanup)

  it('无权限：受控列不渲染，其余列照常', async () => {
    const wrapper = mountPage(schema, backend, { permission: (v: string) => v !== 'payroll:netpay:view' })
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toContain('员工姓名')
    expect(wrapper.text(), '无权查看「实发合计」时该列不应渲染').not.toContain('实发合计')
  })

  it('有权限：受控列正常渲染（证明是门控而非生成物根本没这列）', async () => {
    const wrapper = mountPage(schema, backend, { permission: (v: string) => v === 'payroll:netpay:view' })
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toContain('员工姓名')
    expect(wrapper.text(), '有权限时「实发合计」列应渲染').toContain('实发合计')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 3) configTableOut 响应映射的运行时见证（AI-08）
//    golden-31 声明 tableOptions.configTableOut = { tableData: 'list', total: 'totalCount' }。
//    这里用一个**只吐 { list, totalCount }** 的后端（库默认形状是 { rows, records }）：
//    只有当生成物真的把 configTableOut 接进了 EsTable，list 才会被回写到 data-source；
//    否则 configTableField 落到默认映射，表格恒空。这条断言把「发射了映射」升级为
//    「映射真的驱动了数据接线」，与 AI-20 的运行时见证同构。
// ────────────────────────────────────────────────────────────────────────────
describe('生成物运行时冒烟 — 31-inventory（configTableOut 响应映射）', () => {
  afterEach(cleanup)

  it('后端返回 { list, totalCount } 时仍渲染出行（映射真的生效，非静默丢弃）', async () => {
    const schema = generatePageSchema(loadGoldenConfig('31-inventory-response-map.json'))
    const first = firstColumnProp(schema)
    const listUrl = (schema.tableOptions as any)?.apiParams?.url as string | undefined
    const httpRequest = async (req: Record<string, any>) => {
      const url = req.url || listUrl || ''
      if (/\/api\/(create|update|delete)\b/.test(url) || req.method !== undefined && req.method !== 'get') {
        return { code: 0 }
      }
      // 自定义响应形状：只有 configTableOut 生效时才会被认作 tableData/total。
      return {
        list: [
          { id: 1, [first]: `L1-${first}` },
          { id: 2, [first]: `L2-${first}` },
        ],
        totalCount: 2,
      }
    }
    const wrapper = mount(EsCrudPage, {
      props: { schema, httpRequest },
      attachTo: document.body,
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await flushPromises()
    await nextTick()

    const ds = wrapper.findComponent(EsTable).props('dataSource') as unknown[]
    expect(ds, 'configTableOut 应把 list 映射到 tableData（否则这里恒为空）').toHaveLength(2)
    expect(wrapper.text()).toContain(`L1-${first}`)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 4) 声明式 isHidden 的运行时见证（AI-06）
//    golden-45 声明两个反相条件：`renewDiscount` 在 autoRenew truthy 时隐藏、
//    `expireNotice` 在 autoRenew falsy 时隐藏。两者都 inQuery:false，落在
//    生成的 `dialogFormItems` 上。这里把**生成出来的** formItems 挂进真实 EsForm，
//    用一个可变的 reactive model 驱动开关，断言字段真的随条件出现/消失 ——
//    把「发射了条件」升级为「条件真的驱动了可见性」（与 AI-08/AI-20 同构）。
// ────────────────────────────────────────────────────────────────────────────
describe('生成物运行时冒烟 — 45-subscription（声明式 isHidden 条件显隐）', () => {
  afterEach(cleanup)

  it('生成物里的 isHidden 在真实 EsForm 上生效，且随 model 变化', async () => {
    const schema = generatePageSchema(loadGoldenConfig('45-subscription-hidden-truthy.json'))
    const formItems = schema.dialogFormItems as unknown[]
    expect(formItems, '该用例的弹窗表单应包含条件字段').toBeTruthy()

    // 生成物里确实带着条件数据（纯 JSON，非函数）——否则下面即使「隐藏」也是因字段缺失
    const withCond = formItems.filter((f: any) => f.isHidden)
    expect(withCond.map((f: any) => f.prop).sort()).toEqual(['expireNotice', 'renewDiscount'])

    const model = reactive({ planName: '', price: 0, autoRenew: true, renewDiscount: 0, expireNotice: '' })
    const wrapper = mount(EsForm, {
      props: { model, formItemList: formItems },
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await nextTick()

    // autoRenew = true → 隐藏 expireNotice（falsy 条件不成立）→ 显示 renewDiscount（truthy 条件成立）
    expect(wrapper.text()).toContain('续费折扣')
    expect(wrapper.text(), 'autoRenew 为真时「到期提醒语」应隐藏').not.toContain('到期提醒语')

    model.autoRenew = false
    await nextTick()
    expect(wrapper.text()).toContain('到期提醒语')
    expect(wrapper.text(), 'autoRenew 为假时「续费折扣」应隐藏').not.toContain('续费折扣')
  })
})

