#!/usr/bin/env node
/**
 * S3 工作流页（`/ai-gallery/workflows`）的单一真源生成器 + 守卫。
 *
 * ## 它是什么
 *
 * 把「文档站说 AI 能做的事」从**散文**变成**可重放的调用记录**：四条工作流，共 12 次
 * **真工具调用**，每次记录入参与出参。这些工具此前只有文案、没有页面：
 *
 *   · W1 `detect_project_target → generate_crud → validate_config → refine_config`
 *     （前门的 surfaces 路径 + 一次「校验抓错 → 精修出 diff」的纠偏）
 *   · W2 `scaffold_page → doctor_page`（脚手架 → 宿主入口体检 → 缺失项与修法）
 *   · W3 `ingest_schema → list_form_types → get_component_api`（接管既有表单的入口）
 *   · W4 `generate_form → generate_table → generate_dialog`（片段拆装：三个独立 SFC/composable，
 *     字段词表与 generate_crud 相同，可各自嵌进非 CRUD 页面）
 *
 * **前门公开面 12 个工具全部至少出现一次**（W1–W4 合计）：`generate_crud` 走 surfaces 路径
 * （现有 hero 页走 CLI 的 NL→config 路径，不是 MCP 路径），其余 11 个在此前没有任何页面演示。
 *
 * ## 为什么生成而不是页面里现场跑
 *
 * 工具实现在 TS 源码里，而三站打包器不同（vite ×2 / vue-cli webpack ×1），站点侧
 * 无法 import MCP server 源码；这与 S2 组合画廊同一条约束。于是 Node 侧跑一次，
 * 落成逐字节确定的 JS 数据模块，三站副本在生成器里分发。
 *
 * **模型步不进记录**：`refine_config` 不调模型（见其头注），「按本轮 NL 纠正改写好
 * 的配置」是**冻结输入**（`REVISED`），与计划 §4.5 的「确定性步骤可重放；模型步冻结
 * 记录」一致 —— 页面文案必须说清这一点，不能暗示模型那一步可重现。
 *
 * ## `--check` 守什么（进 `check:consistency`）
 *
 * 1. **新鲜度**：重算记录，与单源 + 三站副本逐字节比对（忽略行尾符差异，见 text-sync）。
 * 2. **确定性**：同一进程内连算两遍，两次 JSON 必须逐字节相同（防 Date/Set/路径泄漏）。
 * 3. **覆盖**：前门公开面 12 个工具全部出现；每步都有非空出参。
 * 4. **预期失败**：恰好一步是「故意喂错配置」的 `validate_config`，且它确实报错 ——
 *    其余步骤必须成功。否则页面会把「工具坏了」展示成「工具在纠错」。
 * 5. **接线**：三站页面都 import 数据模块、路由都有 `/ai-gallery/workflows`、
 *    画廊页都有入口链接，主文档站与 es-pc 的两份页面逐字节相同。
 *
 * 用法：
 *   node scripts/gen-ai-workflows.mjs           # 生成单源 + 三站副本
 *   node scripts/gen-ai-workflows.mjs --check   # 只校验（CI）
 * 退出码：0 = 成功 / 全绿；1 = 漂移、覆盖缺失或接线断开。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createToolCaller, WORKFLOW_TOOLS, ROOT } from './lib/mcp-tools.mjs'
import { normalizeEol, stripDocsOnlyMeta } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CANONICAL = join(ROOT, 'docs', 'cases', 'generated', 'ai-workflows.js')
const SITES = ['es-plus-docs', 'es-pc', 'es-eui']
const SITE_COPIES = SITES.map((s) => join(ROOT, s, 'src', 'cases', 'generated', 'ai-workflows.js'))
const CHECK = process.argv.includes('--check')

/** 预览上限（字符）。完整出参的字节数单独记录 —— 页面不该吞掉 8 KB 代码，也不该假装那就是全文。 */
const PREVIEW_LIMIT = 3000

/**
 * 零页面演示工具：本页的存在理由（缺一个就是没覆盖到位）。
 * 口径是「**站点页面**里此前搜不到这些工具的调用」—— 不是一张已存在的台账：
 * 本仓此前没有工具覆盖账本，`ai-tools.json` / `AiCrud.vue` 只是文档与 NL→config 演示。
 * `generate_crud` 除外：它在 S1 案例里已有页面，只是那批走 CLI 的 NL→config 路径。
 */
const ZERO_CASE_TOOLS = WORKFLOW_TOOLS.filter((t) => t !== 'generate_crud')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

// ── 冻结输入（全部是字面量：不发请求、不读宿主文件，重放才有意义） ──

const STATUS = [
  { label: '待发货', value: 0, tagType: 'warning' },
  { label: '已发货', value: 1, tagType: 'success' },
]

const SURFACES = {
  query: [
    { prop: 'keyword', label: '关键词', formtype: 'Input', querySpan: 8 },
    { prop: 'status', label: '状态', formtype: 'Select', querySpan: 8, dataOptions: STATUS },
  ],
  table: [
    { prop: 'orderNo', label: '订单号', formtype: 'Input', width: 150 },
    { prop: 'customer', label: '客户', formtype: 'Input', minWidth: 140 },
    { prop: 'amount', label: '金额', formtype: 'InputNumber', align: 'right' },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS },
  ],
  form: [
    { prop: 'customer', label: '客户', formtype: 'Input', required: true },
    { prop: 'amount', label: '金额', formtype: 'InputNumber' },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS },
  ],
  dialog: ['add', 'edit'],
}

/** 宿主「已 pin」的配置 —— validate/refine 的基准。 */
const PINNED = {
  name: 'OrderWorkbench',
  apiUrl: '/api/orders',
  actions: ['add', 'edit', 'view'],
  fields: [
    { prop: 'orderNo', label: '订单号', formtype: 'Input', inQuery: true, inTable: true, inForm: false, querySpan: 8 },
    {
      prop: 'customer',
      label: '客户',
      formtype: 'Input',
      inQuery: true,
      inTable: true,
      inForm: true,
      querySpan: 8,
      required: true,
    },
    { prop: 'amount', label: '金额', formtype: 'InputNumber', inQuery: false, inTable: true, inForm: true, align: 'right' },
    { prop: 'status', label: '状态', formtype: 'Select', inQuery: true, inTable: true, inForm: true, dataOptions: STATUS },
  ],
  dialogs: {
    view: {
      title: '订单详情',
      formItems: [
        { prop: 'orderNo', label: '订单号', formtype: 'Input' },
        { prop: 'customer', label: '客户', formtype: 'Input' },
        { prop: 'amount', label: '金额', formtype: 'InputNumber' },
        { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS },
      ],
    },
  },
  tableOptions: { border: true, rowkey: 'id' },
  pagination: { pageSize: 10 },
}

/** 故意写坏的草稿：一个拼错的 formtype + 一个放错层的键（都是模型真实会犯的错）。 */
function brokenDraft() {
  const draft = structuredClone(PINNED)
  draft.formFields = draft.fields
  draft.fields[2].formtype = 'InputNumbr'
  return draft
}

/** 宿主 LLM 「按本轮纠正改写好的」配置 —— 冻结输入，不是模型现场生成。 */
function revisedConfig() {
  const revised = structuredClone(PINNED)
  revised.dialogs.edit = {
    title: '编辑订单',
    formItems: [
      { prop: 'customer', label: '客户', formtype: 'Input', required: true },
      { prop: 'amount', label: '金额', formtype: 'InputNumber' },
      { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS },
    ],
  }
  revised.operationColumn = {
    label: '操作',
    btns: [
      { name: '查看', dialogKey: 'view' },
      { name: '编辑', dialogKey: 'edit' },
    ],
  }
  return revised
}

/** 宿主入口：缺 httpRequest（doctor 的「缺失 + 怎么修」正是要展示的东西）。 */
const ENTRY = `import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ESPlus from '@es-plus/vue3'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
`

const TS_INTERFACE = `interface Product {
  /** 商品编码 */
  sku: string
  /** 商品名称 */
  name: string
  /** 单价 */
  price: number
  /** 上架 */
  active: boolean
}`

/** 片段三件套的字段：与 generate_crud 的 surfaces 同一份词表（这是「片段能拼回页」的前提）。 */
const FRAGMENT = {
  formFields: SURFACES.query,
  tableFields: SURFACES.table,
  dialogFields: SURFACES.form,
}

/**
 * 工作流定义。`jsonArgs` 列出**必须以 JSON 字符串传**的参数（工具签名如此），
 * 记录里仍存可读对象；重放时由同一函数编码，页面与调用不会各说各话。
 */
function workflowPlan() {
  return {
    tools: WORKFLOW_TOOLS,
    zeroCaseTools: ZERO_CASE_TOOLS,
    note:
      'S3 工具工作流：四条链、12 次真 handler 调用。入参冻结在生成器里，出参是逐字节的真实返回；' +
      '`refine_config` 的 revised 是冻结输入（该工具不调模型）。check:ai-workflows 重算并逐字节比对。',
    workflows: [
      {
        id: 'w1',
        title: '一句话 → 页面 → 纠偏',
        oneLiner: '先探目标，再用一张意图表（surfaces）出页；校验抓住两处写错，精修给出这一轮改了什么。',
        tools: ['detect_project_target', 'generate_crud', 'validate_config', 'refine_config'],
        steps: [
          {
            tool: 'detect_project_target',
            note: '探目标读的是宿主传入的 package.json 文本 —— 依赖里已有 @es-plus/vue3，判 vue3/high。',
            args: {
              packageJson: JSON.stringify({
                dependencies: { vue: '^3.4.0', 'element-plus': '^2.4.0', '@es-plus/vue3': '^1.0.0' },
              }),
            },
          },
          {
            tool: 'generate_crud',
            note: '同一张意图表 → 查询/表格/表单三面 + add/edit 两个弹窗；产物是纯 JSON schema + 包装 SFC。',
            args: { name: 'OrderWorkbench', apiUrl: '/api/orders', surfaces: SURFACES, target: 'vue3', mode: 'schema' },
          },
          {
            tool: 'validate_config',
            expect: 'error',
            note: '宿主照抄时写错了两处（InputNumbr、把 fields 复制成 formFields）—— 校验器只判不改，逐条点名并给建议。',
            args: { config: brokenDraft(), type: 'structured-crud-config' },
            jsonArgs: ['config'],
          },
          {
            tool: 'refine_config',
            note: '改好的这一版相对 pin 的改动：新增 edit 弹窗与操作列 —— diff 逐块回显，不靠人眼比对两份 JSON。',
            args: { previous: PINNED, revised: revisedConfig() },
            jsonArgs: ['previous', 'revised'],
          },
        ],
      },
      {
        id: 'w2',
        title: '脚手架 → 诊断 → 修',
        oneLiner: '先给一份能跑的最小页面骨架与前置清单，再静态体检宿主入口，缺什么、怎么补都写在报告里。',
        tools: ['scaffold_page', 'doctor_page'],
        steps: [
          {
            tool: 'scaffold_page',
            note: '与生成器共用同一份 preflight 清单（AN-15②）—— 脚手架说的前置项和生成页要求的是同一套。',
            args: { name: 'workflow-demo', features: ['query', 'table', 'dialog'], target: 'vue3' },
          },
          {
            tool: 'doctor_page',
            note: '同一份入口做静态体检：UI 库/插件注册在，httpRequest 缺 —— 报告给出「Do:」修法；只做字面扫描，看不到的记 unverified。',
            args: { entry: ENTRY, target: 'vue3', config: PINNED },
          },
        ],
      },
      {
        id: 'w3',
        title: '接管既有表单',
        oneLiner: '把一份既有的 TS interface 摄成草拟配置，再让宿主按需查控件清单与组件 API —— 三条确定性查询。',
        tools: ['ingest_schema', 'list_form_types', 'get_component_api'],
        steps: [
          {
            tool: 'ingest_schema',
            note: '类型→formtype 由摄取器定（number→InputNumber、boolean→Switch），查询面留空由宿主收窄。',
            args: { kind: 'ts-interface', text: TS_INTERFACE, name: 'ProductManage', apiUrl: '/api/products' },
          },
          {
            tool: 'list_form_types',
            note: '三端共用同一份 formtype 枚举 —— 宿主补字段时查这一份，不是各端各猜。',
            args: {},
          },
          {
            tool: 'get_component_api',
            note: '组件 API 按 target 渲染（这里是 vue3）：同一份模板拼出三端差异，只换包名与 SFC 写法。',
            args: { component: 'EsCrudPage', target: 'vue3' },
          },
        ],
      },
      {
        id: 'w4',
        title: '片段拆装：表单、表格、弹窗各自独立',
        oneLiner:
          '三个片段工具共用 generate_crud 那张字段词表，产物却是可单独嵌进非 CRUD 页面的 SFC / composable —— 拆得开、也拼得回。',
        tools: ['generate_form', 'generate_table', 'generate_dialog'],
        steps: [
          {
            tool: 'generate_form',
            note: '表单片段 = 自带 reactive model + formItemList 的独立 SFC；context:query 让 span 收窄，与 CRUD 查询区同一套尺寸语义。',
            args: { fields: FRAGMENT.formFields, target: 'vue3', context: 'query', buttons: 'query' },
          },
          {
            tool: 'generate_table',
            note: '表格片段自带 columns/options/data-source/pagination；给 apiUrl 就走 es-table 的 apiParams 自动取数，操作列只发事件、不生成处理函数体（片段才可能独立编译）。',
            args: {
              fields: FRAGMENT.tableFields,
              apiUrl: '/api/orders',
              target: 'vue3',
              tableOptions: { border: true },
              pagination: { pageSize: 10 },
              rowButtons: [{ name: '查看' }],
            },
          },
          {
            tool: 'generate_dialog',
            note: '弹窗片段 mode=component 走 <es-dialog> SFC（不需要 JSX 插件）；集成契约仍是 open(title, row?, onSuccess?) —— 提交成功后由宿主刷新自己的表格。',
            args: {
              fields: FRAGMENT.dialogFields,
              apiUrl: '/api/orders',
              rowkey: 'id',
              mode: 'component',
              defaultTitle: '新增订单',
              target: 'vue3',
            },
          },
        ],
      },
    ],
  }
}

/** 编码某一步的**线上入参**（`jsonArgs` 里的对象 → JSON 字符串，与客户端同形）。 */
function wireArgs(step) {
  const out = { ...step.args }
  for (const key of step.jsonArgs ?? []) out[key] = JSON.stringify(step.args[key])
  return out
}

function preview(text) {
  return { result: text.slice(0, PREVIEW_LIMIT), truncated: text.length > PREVIEW_LIMIT, bytes: Buffer.byteLength(text) }
}

/** 真正跑一遍三条工作流，产出记录对象（除调用外一切纯函数）。 */
async function buildRecord() {
  const caller = await createToolCaller()
  try {
    if (caller.fromBuild.length > 0) {
      fail(`打包命中了 shared/build（${caller.fromBuild.length} 个文件）—— 记录会反映陈旧构建，不是源码`)
    }
    const names = new Set(caller.names)
    for (const t of WORKFLOW_TOOLS) if (!names.has(t)) fail(`工具 ${t} 未注册（front-door 档）`)

    const plan = workflowPlan()
    const workflows = []
    for (const wf of plan.workflows) {
      const steps = []
      for (const step of wf.steps) {
        const res = await caller.call(step.tool, wireArgs(step))
        steps.push({
          tool: step.tool,
          note: step.note,
          expect: step.expect ?? 'ok',
          ok: res.ok,
          args: step.args,
          ...(step.jsonArgs ? { jsonArgs: step.jsonArgs } : {}),
          ...preview(res.text),
        })
      }
      workflows.push({ id: wf.id, title: wf.title, oneLiner: wf.oneLiner, tools: wf.tools, steps })
    }
    return { ...plan, workflows }
  } finally {
    caller.cleanup()
  }
}

function render(record) {
  return (
    '/**\n' +
    ' * 由 `scripts/gen-ai-workflows.mjs` 生成，勿手改。\n' +
    ' * 单源：三条工作流的 9 次真 handler 调用（入参冻结、出参逐字节）。\n' +
    ' * 守卫：`npm run check:ai-workflows`（新鲜度 / 确定性 / 覆盖 / 预期失败 / 接线）。\n' +
    ' */\n' +
    `export const AI_WORKFLOWS = ${JSON.stringify(record, null, 2)}\n`
  )
}

/** 记录自洽性 + 接线（不依赖文件新鲜度也能先判）。 */
function assertRecord(record) {
  const steps = record.workflows.flatMap((w) => w.steps)
  const called = new Set(steps.map((s) => s.tool))
  for (const t of ZERO_CASE_TOOLS) if (!called.has(t)) fail(`零页面演示工具 ${t} 未出现在任何工作流中`)
  if (!called.has('generate_crud')) fail('generate_crud（surfaces 路径）未出现')
  for (const t of called) if (!WORKFLOW_TOOLS.includes(t)) fail(`工作流调用了未登记的工具 ${t}`)

  for (const step of steps) {
    if (!step.result || step.result.trim().length === 0) fail(`${step.tool} 的出参为空`)
    if (step.bytes <= 0) fail(`${step.tool} 未记录出参字节数`)
    if (step.expect === 'error' && step.ok) {
      fail(`${step.tool} 标了「故意出错」却返回成功 —— 预期失败的步骤必须真的失败`)
    }
    if (step.expect !== 'error' && !step.ok) fail(`${step.tool} 返回了错误（非预期）：${step.result.slice(0, 200)}`)
  }
  const expectedErrors = steps.filter((s) => s.expect === 'error')
  if (expectedErrors.length !== 1) {
    fail(`「故意出错」的步骤应恰好 1 个，实际 ${expectedErrors.length} 个 —— 否则无法区分「工具在纠错」与「工具坏了」`)
  }
  // 本地路径进站点 = 泄漏 + 跨机器不可重放。锚在行首/引号/空白后，避免把 `https:/` 当盘符。
  const blob = JSON.stringify(record)
  if (/(?:^|[\s"'[])[A-Za-z]:[\\/]/.test(blob)) fail('记录里出现了绝对路径（会随机器漂移，不该进站点）')
  if (/es-mcp-tools-/.test(blob)) fail('记录里出现了打包临时目录名')
}

const WIRING = [
  { site: 'es-plus-docs', page: 'es-plus-docs/src/views/AiWorkflows.vue', router: 'es-plus-docs/src/router/index.ts', gallery: 'es-plus-docs/src/views/AiGallery.vue' },
  { site: 'es-pc', page: 'es-pc/src/views/AiWorkflows.vue', router: 'es-pc/src/router/index.js', gallery: 'es-pc/src/views/AiGallery.vue' },
  { site: 'es-eui', page: 'es-eui/src/views/ai-workflows.vue', router: 'es-eui/src/router/index.js', gallery: 'es-eui/src/views/ai-gallery.vue' },
]

function assertWiring() {
  for (const w of WIRING) {
    const pagePath = join(ROOT, w.page)
    if (!existsSync(pagePath)) {
      fail(`${w.site} 缺少工作流页 ${w.page}`)
      continue
    }
    const page = normalizeEol(readFileSync(pagePath, 'utf8'))
    if (!page.includes("@/cases/generated/ai-workflows")) fail(`${w.page} 未 import 数据模块`)
    if (!page.includes('data-testid="workflows-page"')) fail(`${w.page} 缺少 data-testid="workflows-page"`)

    const routerPath = join(ROOT, w.router)
    if (!existsSync(routerPath)) {
      fail(`${w.site} 缺少路由文件 ${w.router}`)
    } else if (!normalizeEol(readFileSync(routerPath, 'utf8')).includes('ai-gallery/workflows')) {
      // 不锚前导 `/`：es-pc 用的是路由表的相对段写法（`ai-gallery/workflows`）。
      fail(`${w.router} 未注册 /ai-gallery/workflows 路由`)
    }

    const galleryPath = join(ROOT, w.gallery)
    if (!existsSync(galleryPath)) {
      fail(`${w.site} 缺少画廊页 ${w.gallery}`)
    } else {
      const gallery = normalizeEol(readFileSync(galleryPath, 'utf8'))
      if (!gallery.includes('to="/ai-gallery/workflows"')) fail(`${w.gallery} 没有工作流入口链接（路由加了没人链 = 隐形页面）`)
    }
  }
  // 两个 Vue3 站点共用同一份数据检视页：渲染逻辑只有一份，改一处漏一处会立刻红。
  // 唯一例外是主文档站独有的逐页 meta 接线（usePageMeta），见 stripDocsOnlyMeta。
  const docsPage = join(ROOT, 'es-plus-docs/src/views/AiWorkflows.vue')
  const pcPage = join(ROOT, 'es-pc/src/views/AiWorkflows.vue')
  if (existsSync(docsPage) && existsSync(pcPage)) {
    if (
      stripDocsOnlyMeta(readFileSync(docsPage, 'utf8')) !== stripDocsOnlyMeta(readFileSync(pcPage, 'utf8'))
    ) {
      fail('es-plus-docs 与 es-pc 的 AiWorkflows.vue 不一致（同一份数据检视页应逐字节相同）')
    }
  }
}

function sameText(a, b) {
  return normalizeEol(a) === normalizeEol(b)
}

function writeAll(text) {
  for (const target of [CANONICAL, ...SITE_COPIES]) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, text)
  }
}

async function main() {
  const record = await buildRecord()
  assertRecord(record)
  const text = render(record)

  if (CHECK) {
    // 确定性：连算两遍必须逐字节相同（Date / Set 序 / 临时路径都会在这里露馅）。
    const again = render(await buildRecord())
    if (!sameText(text, again)) fail('同一进程内两次生成的记录不一致（存在非确定性来源）')

    const targets = [CANONICAL, ...SITE_COPIES]
    for (const target of targets) {
      const rel = target.replace(ROOT + '/', '').replace(/\\/g, '/')
      if (!existsSync(target)) {
        fail(`缺少生成物 ${rel} —— 运行 npm run ai:workflows`)
      } else if (!sameText(readFileSync(target, 'utf8'), text)) {
        fail(`${rel} 已过期 —— 运行 npm run ai:workflows`)
      }
    }
    assertWiring()

    if (failed) process.exit(1)
    const steps = record.workflows.flatMap((w) => w.steps)
    console.log(
      `✅ 工作流页一致（${record.workflows.length} 条工作流 / ${steps.length} 次工具调用；` +
        `零页面演示工具 ${ZERO_CASE_TOOLS.length}/${ZERO_CASE_TOOLS.length} 覆盖；单源 + 三站副本逐字节一致；接线完整）`,
    )
    process.exit(0)
  }

  if (failed) process.exit(1)
  writeAll(text)
  const steps = record.workflows.flatMap((w) => w.steps)
  console.log(`✅ 已生成 docs/cases/generated/ai-workflows.js（${steps.length} 步）+ ${SITE_COPIES.length} 站副本`)
}

main()
