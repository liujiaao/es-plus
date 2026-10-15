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
import { composeCrudConfig } from '../../shared/src/compose-crud-config'
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

// ────────────────────────────────────────────────────────────────────────────
// 5) 显式 columns / groups 的运行时见证（AI-09 子项①）
//    golden-48 用顶层 columns 逃生数组表达两级分组表头：「课程信息」下分课程名称/课时。
//    这里把**生成出来的** pageSchema 挂进真实 EsCrudPage + EsTable，断言组标题与子列
//    都真的渲染出来 —— 把「发射了 columns」升级为「columns 真的驱动了多级表头」。
//    （分组子列没有顶层 prop，故不能走 seedFromSchema；按 fields 自造行。）
// ────────────────────────────────────────────────────────────────────────────
describe('生成物运行时冒烟 — 48-course（显式 columns / groups 多级表头）', () => {
  afterEach(cleanup)

  it('生成物里的 columns/groups 真的驱动了两级表头与列渲染', async () => {
    const config = loadGoldenConfig('48-course-group-2level.json')
    const schema = generatePageSchema(config)

    // 生成物里确实带着显式列（两组、各含子列）——否则下面「看到分组表头」也无来由
    const cols = schema.columns as any[]
    expect(cols, '生成物应保留显式 columns（而非被 Zod 剥掉）').toHaveLength(2)
    expect(cols.map((c) => c.label)).toEqual(['课程信息', '教师信息'])
    expect(cols[0].groups.map((g: any) => g.prop)).toEqual(['courseName', 'hours'])

    // 种子：分组子列无顶层 prop，不能走 seedFromSchema —— 按 fields 造行。
    const props = (config.fields || []).map((f) => f.prop as string)
    const httpRequest = async () => ({
      records: 2,
      rows: [0, 1].map((i) => Object.fromEntries([['id', i + 1], ...props.map((p) => [p, `R${i + 1}-${p}`])])),
    })
    const wrapper = mount(EsCrudPage, {
      props: { schema, httpRequest },
      attachTo: document.body,
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await flushPromises()
    await nextTick()

    // 两级分组表头：组标题 + 子列标题都在表头渲染
    expect(wrapper.text()).toContain('课程信息')
    expect(wrapper.text()).toContain('教师信息')
    expect(wrapper.text()).toContain('课时')
    expect(wrapper.text()).toContain('职称')
    // 列真的驱动了数据渲染（不是只有空壳表头）
    expect(wrapper.text()).toContain('R1-courseName')
    expect(wrapper.text()).toContain('R1-teacher')
  })
})

describe('生成物运行时冒烟 — 62-supplier（声明式行展开 expandConfig）', () => {
  afterEach(cleanup)

  it('生成物里的 expandConfig 真的驱动了行展开明细渲染', async () => {
    const config = loadGoldenConfig('62-supplier-expand-index.json')
    const schema = generatePageSchema(config)

    // 生成物里表格列确实带上了 expandConfig（而非被 Zod / 适配层剥掉）——否则展开区恒空
    const cols = schema.columns as any[]
    const expandCol = cols.find((c) => c.type === 'expand')
    expect(expandCol, '生成物应包含 expand 列').toBeTruthy()
    expect(expandCol.expandConfig.title).toBe('联系方式')
    expect(expandCol.expandConfig.fields.map((f: any) => f.prop)).toEqual(['contact', 'address'])

    const props = (config.fields || []).map((f) => f.prop as string)
    const httpRequest = async () => ({
      records: 1,
      rows: [Object.fromEntries([['id', 1], ...props.map((p) => [p, `R-${p}`])])],
    })
    const wrapper = mount(EsCrudPage, {
      props: { schema, httpRequest },
      attachTo: document.body,
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await flushPromises()
    await nextTick()

    // 展开前：明细不在文档里
    expect(wrapper.find('.es-expand-content').exists()).toBe(false)

    // 展开列渲染出切换图标，点击展开
    const icon = wrapper.find('.el-table__expand-icon')
    expect(icon.exists(), '展开列应渲染出切换图标').toBe(true)
    await icon.trigger('click')
    await flushPromises()
    await nextTick()

    // 展开后：标题 + 字段明细（label: value）真的渲染出来
    expect(wrapper.find('.es-expand-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('联系方式')
    expect(wrapper.text()).toContain('联系人')
    expect(wrapper.text()).toContain('R-contact')
    expect(wrapper.text()).toContain('地址')
    expect(wrapper.text()).toContain('R-address')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 6) 声明式树表的运行时见证（AI-09 子项③ treeConfig）
//    golden-77 默认 children 键 + expandAll；golden-78 自定义 childrenField=subItems。
//    这里把**生成出来的** pageSchema 挂进真实 EsCrudPage + EsTable，喂**嵌套 rows**，
//    断言父子层级真的渲染 —— 把「发射了 treeConfig」升级为「treeConfig 真的驱动了树表」。
//    （el-table 渲染树靠 row-key + 行数据里的嵌套子数组；row-key 由生成器自动发射。）
// ────────────────────────────────────────────────────────────────────────────
describe('生成物运行时冒烟 — 77-dept-tree（声明式树表 treeConfig，默认 children 键 + expandAll）', () => {
  afterEach(cleanup)

  it('treeConfig 发射进 tableOptions，且嵌套 rows 真的渲染出父子层级（expandAll 初始全展开）', async () => {
    const schema = generatePageSchema(loadGoldenConfig('77-dept-tree-vue3.json'))

    // 生成物里 tableOptions 确实带上了 treeConfig（否则树表行为无来由）
    const to = schema.tableOptions as any
    expect(to.treeConfig, '生成物应保留 treeConfig（而非被 Zod / 适配层剥掉）').toBeTruthy()
    expect(to.treeConfig.expandAll).toBe(true)

    const httpRequest = async () => ({
      records: 3,
      rows: [
        {
          id: 1,
          deptName: '总公司',
          leader: 'A',
          children: [{ id: 2, deptName: '研发部', leader: 'B', children: [{ id: 3, deptName: '前端组', leader: 'C' }] }],
        },
      ],
    })
    const wrapper = mount(EsCrudPage, {
      props: { schema, httpRequest },
      attachTo: document.body,
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await flushPromises()
    await nextTick()

    // expandAll=true → 父 / 子 / 孙三层初始都可见
    expect(wrapper.text()).toContain('总公司')
    expect(wrapper.text()).toContain('研发部')
    expect(wrapper.text()).toContain('前端组')
  })
})

describe('生成物运行时冒烟 — 78-category-tree（自定义 childrenField=subItems）', () => {
  afterEach(cleanup)

  it('自定义子节点键名真的被翻译（嵌套在 subItems 下的行也能渲染）', async () => {
    const schema = generatePageSchema(loadGoldenConfig('78-category-tree-vue3-subitems.json'))
    const to = schema.tableOptions as any
    expect(to.treeConfig?.childrenField).toBe('subItems')

    const httpRequest = async () => ({
      records: 2,
      rows: [
        { id: 1, categoryName: '数码', sortNo: 1, subItems: [{ id: 2, categoryName: '手机', sortNo: 2 }] },
      ],
    })
    const wrapper = mount(EsCrudPage, {
      props: { schema, httpRequest },
      attachTo: document.body,
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await flushPromises()
    await nextTick()

    // el-table 默认只认 children 键；能渲染出「手机」证明 childrenField 被翻译成了 tree-props
    expect(wrapper.text()).toContain('数码')
    const icon = wrapper.find('.el-table__expand-icon')
    expect(icon.exists(), '自定义子键下父行也应渲染树展开图标').toBe(true)
    await icon.trigger('click')
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toContain('手机')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 6) 前门面字段 isHidden 的运行时见证（AI-21③）
//    AI-21③ 把 isHidden/reactions/labelKey 提进入口字段词汇。前门路由里**弹窗体 = form 面**
//    （generate-crud.ts: dialogBody = hasForm ? form : table），故 form 面上的 isHidden 必须
//    经 compose → generateFromConfig 落进弹窗表单，并**真的**驱动显隐。
//    这里直接把（前门那一步的）compose 结果喂给生成器，再把生成出的弹窗 formItems 挂到
//    真实 EsForm 上，随 model 切换退款方式，断言字段真的出现/消失。
//    注意语义：键名是 isHidden（**不是 isVisible**）—— 条件成立即隐藏。
// ────────────────────────────────────────────────────────────────────────────
describe('生成物运行时冒烟 — AI-21③ 前门面字段 isHidden 直达真实 EsForm', () => {
  afterEach(cleanup)

  it('compose（dialog 体 = form 面）产出的 isHidden 在真实 EsForm 上随 model 显隐', async () => {
    const formSurface = [
      {
        prop: 'refundType',
        label: '退款方式',
        formtype: 'Select',
        required: true,
        dataOptions: [
          { label: '部分退款', value: 'part' },
          { label: '全额退款', value: 'full' },
        ],
      },
      // 条件成立即隐藏：退款方式是「部分退款」时，隐藏退款原因。
      { prop: 'refundReason', label: '退款原因', formtype: 'Input', isHidden: { field: 'refundType', op: 'eq', value: 'part' } },
    ]

    const { config } = composeCrudConfig({
      name: 'RefundManage',
      apiUrl: '/api/refunds',
      table: [
        { prop: 'refundNo', label: '退款单号', formtype: 'Input' },
        { prop: 'refundType', label: '退款方式', formtype: 'Select' },
        { prop: 'refundReason', label: '退款原因', formtype: 'Input' },
      ],
      form: formSurface,
      // 复刻前门：dialogBody = hasForm ? form : table
      dialogs: { add: { title: '新增', formItems: formSurface } } as any,
    })

    const schema = generatePageSchema(config as StructuredCrudConfig)
    const dialogs = schema.dialogs as any
    const formItems = dialogs?.add?.formItems as unknown[]
    expect(formItems, '前门 compose 产出的弹窗应带 formItems').toBeTruthy()

    // 生成物里确实带着条件数据（纯 JSON，非函数）——否则下面即使「隐藏」也是因字段缺失
    const cond = formItems.find((f: any) => f.prop === 'refundReason')
    expect(cond, '退款原因字段应在弹窗表单里').toBeTruthy()
    expect((cond as any).isHidden).toEqual({ field: 'refundType', op: 'eq', value: 'part' })

    const model = reactive({ refundType: 'full', refundReason: '' })
    const wrapper = mount(EsForm, {
      props: { model, formItemList: formItems },
      global: { plugins: [ElementPlus, EsPlus] },
    })
    await nextTick()

    // refundType = 'full' → 条件不成立 → 退款原因可见
    expect(wrapper.text()).toContain('退款原因')

    model.refundType = 'part'
    await nextTick()
    expect(wrapper.text(), '退款方式为部分退款时「退款原因」应隐藏').not.toContain('退款原因')
  })
})

