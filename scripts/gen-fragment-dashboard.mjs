#!/usr/bin/env node
/**
 * A8「片段拼装仪表盘」的单一真源生成器 + 守卫（`/fragment-dashboard`）。
 *
 * ## 它要证明什么
 *
 * 片段三件套（`generate_form` / `generate_table` / `generate_dialog`）的卖点是
 * 「拆得开、也拼得回」：产物是**自包含 SFC**，能嵌进一个**非 CRUD** 页面。
 * 本页就是那个非 CRUD 页面 —— 分析页：顶部筛选表单、中间结果表格、右侧原生图表、
 * 点行开弹窗。片段一行不改，宿主负责取数与编排。
 *
 * ## 与 S1 通用案例的区别（也是它单独成页的理由）
 *
 * 通用案例渲染的是一份 CrudPageSchema（`<es-crud-page :schema>`），页面形状由 schema 定；
 * 这里没有 schema —— 宿主自己写布局、自己取数、图表是原生 SVG。片段只贡献「字段与长相」。
 *
 * ## 为什么冻结入参而不是让模型现场生成
 *
 * 与 S3 同一条口径（plan §6 B1）：页面上能机械重算的只有「片段 = 工具(冻结入参)」，
 * 模型那一步不可重现。故 `KNOWN_GAPS` 与 `HOST` 的叙述都只描述**当前产物**，
 * 不承诺模型行为。
 *
 * ## `--check` 守什么（进 `check:consistency`）
 *
 * 1. **新鲜度**：重算三端 9 个片段，与产物 JSON / 源码模块 / 站点里的 `.vue` 逐字节比对。
 * 2. **确定性**：同进程连算两遍必须逐字节相同（防 Date / 路径泄漏）。
 * 3. **纯 JSON**：产物里不能出现函数式键或函数体字样（与 check:ai-cases 断言 3 同一把尺子）。
 * 4. **可编译**：9 个片段各过一次语法解析（`scripts/lib/compile-check.mjs`）——
 *    这是三端 claim=compile 的唯一证据；不解析模板、不解析依赖（那是 e2e 的事）。
 * 5. **接线**：三站路由 + 宿主页 import 本案例产物 + Cases 页入口；主文档站宿主页
 *    import 三个 `.vue` 片段（es-pc 同理），es-eui 不 import（Vue 2.6 跑不了面向
 *    Vue 2.7 的产物 —— 见 KNOWN_GAPS）。
 *
 * 用法：
 *   node scripts/gen-fragment-dashboard.mjs           # 生成
 *   node scripts/gen-fragment-dashboard.mjs --check   # 只校验（CI）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { createToolCaller, ROOT } from './lib/mcp-tools.mjs'
import { normalizeEol } from './lib/text-sync.mjs'
import { parseSfc } from './lib/compile-check.mjs'
import { pureJsonProblems } from './lib/ai-cases.mjs'

const CHECK = process.argv.includes('--check')

const ARTIFACT_REL = 'docs/cases/generated/fragment-dashboard.json'
const SOURCES_REL = 'docs/cases/generated/fragment-dashboard-sources.js'
const SITE_NAMES = ['es-plus-docs', 'es-pc', 'es-eui']
const SOURCES_COPIES = SITE_NAMES.map((s) => `${s}/src/cases/generated/fragment-dashboard-sources.js`)

/** 目标 → 站点里那份 `.vue` 的落点（只有能真跑的两站需要落盘）。 */
const TARGET_FRAGMENT_DIRS = {
  vue3: 'es-plus-docs/src/cases/generated/fragments',
  antdv: 'es-pc/src/cases/generated/fragments',
}

const FILE_NAMES = { filter: 'FilterBar.vue', table: 'ResultTable.vue', dialog: 'OrderDialog.vue' }
const FRAGMENT_KEYS = ['filter', 'table', 'dialog']
const TARGETS = ['vue3', 'vue2', 'antdv']

const WIRING = [
  {
    site: 'es-plus-docs',
    page: 'es-plus-docs/src/views/FragmentDashboard.vue',
    router: 'es-plus-docs/src/router/index.ts',
    cases: 'es-plus-docs/src/views/Cases.vue',
    fragments: 'vue3',
  },
  {
    site: 'es-pc',
    page: 'es-pc/src/views/FragmentDashboard.vue',
    router: 'es-pc/src/router/index.js',
    cases: 'es-pc/src/views/Cases.vue',
    fragments: 'antdv',
  },
  {
    site: 'es-eui',
    page: 'es-eui/src/views/fragment-dashboard.vue',
    router: 'es-eui/src/router/index.js',
    cases: 'es-eui/src/views/cases.vue',
    fragments: null,
  },
]

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

// ── 冻结入参（全是字面量：不发请求、不读宿主文件） ─────────────────────────

/** 与站点演示后端同值的三个状态（`/api/demo/orders` 里 0/1/2 都出现）。 */
const STATUS = [
  { label: '待发货', value: 0, tagType: 'warning' },
  { label: '已发货', value: 1, tagType: 'success' },
  { label: '已签收', value: 2, tagType: 'info' },
]

const FILTER_FIELDS = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', querySpan: 8 },
  { prop: 'status', label: '状态', formtype: 'Select', querySpan: 8, dataOptions: STATUS },
]

const TABLE_FIELDS = [
  { prop: 'orderNo', label: '订单号', formtype: 'Input', width: 150 },
  { prop: 'customer', label: '客户', formtype: 'Input', minWidth: 140 },
  { prop: 'amount', label: '金额', formtype: 'InputNumber', align: 'right' },
  { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS },
]

const DIALOG_FIELDS = [
  { prop: 'customer', label: '客户', formtype: 'Input', required: true },
  { prop: 'amount', label: '金额', formtype: 'InputNumber' },
  { prop: 'status', label: '状态', formtype: 'Select', dataOptions: STATUS },
]

/**
 * 片段入参（**不含 target** —— target 由外层循环补，三端共用同一份词表）。
 *
 * 表格刻意**不给 apiUrl**：仪表盘的数据由宿主一次取好（筛选条件只存在于宿主），
 * 片段负责展示与行事件。给了 apiUrl 反而会出现「宿主筛完、片段又自己拉一遍」的第二真相。
 */
const FRAGMENT_ARGS = {
  filter: { fields: FILTER_FIELDS, context: 'query', buttons: 'query' },
  table: { fields: TABLE_FIELDS, tableOptions: { border: true }, rowButtons: [{ name: '查看' }] },
  dialog: {
    fields: DIALOG_FIELDS,
    apiUrl: '/api/demo/orders',
    rowkey: 'id',
    mode: 'component',
    defaultTitle: '新增订单',
  },
}

const FRAGMENT_TOOLS = { filter: 'generate_form', table: 'generate_table', dialog: 'generate_dialog' }

const LABELS = { filter: '筛选表单', table: '结果表格', dialog: '详情弹窗' }

/**
 * 各站 claim —— 页面原样展示。
 *
 * 它与 `docs/cases/ai-cases.json` 的 `sites` 是同一件事的两次声明，故 `--check` 会
 * 逐站比对（见 `checkManifest()`）：页面上的徽章不许比 manifest 更强，也不许更弱。
 * 两端各写一份不是冗余 —— manifest 是守卫的输入，页面是读者的入口，谁都不能现编。
 *
 * es-pc 停在 `compile` 而不是 `execute`：那一端**确实**在跑（同一份宿主页 + antdv 三片段），
 * 但本仓库没有 es-pc 的 e2e project，`check:fragment-dashboard` 只能证到「解析 + 接线」。
 * 按 plan §11.4 的口径「跑过的才叫 execute」，无自动化证据的一端主张封顶 compile ——
 * 与 `order-batch` / `org-tree-table` 等在 es-pc 上的写法一致；人工验证不算证据。
 */
const SITE_CLAIMS = { 'es-plus-docs': 'execute', 'es-pc': 'compile', 'es-eui': 'compile' }

/** 宿主的接线点（页面据此渲染「片段 → 宿主」对照，守卫不解析这段文案）。 */
const HOST = {
  route: '/fragment-dashboard',
  dataPath:
    '宿主自己调一次 httpRequest（/api/demo/orders，带筛选条件），把行数据注入表格片段；' +
    '右侧图表读同一批行 —— 页面里只有一个数据源。',
  chart: '图表是原生 SVG（手写 <rect>/<text>，不经 es-plus），演示「片段与任何原生实现共存」。',
  wiring: [
    {
      fragment: 'filter',
      point: ':model + :config-btn',
      why: '片段的查询/重置按钮只认祖先 es-table 的注入上下文；独立宿主必须自己接管 model 与按钮点击。',
    },
    {
      fragment: 'table',
      point: ':data-source + :pagination',
      why: '无 apiUrl 的表格片段不自取数，行与分页由宿主给；行点击事件冒泡到宿主开弹窗。',
    },
    {
      fragment: 'dialog',
      point: 'ref.open(title, row)',
      why: '弹窗片段的集成契约（defineExpose）：标题、回填行、提交成功回调都由宿主传。',
    },
  ],
}

/**
 * 已知边界 —— 页面原样展示，不藏。每一条都对应「宿主被迫多做一步」或「本端只做编译验证」。
 * 这些是**当前产物的形状**，不是缺陷清单之外的承诺。
 */
const KNOWN_GAPS = [
  '表单片段不 emit 任何事件：查询/重置按钮走的是「祖先 es-table 注入」这条路，独立宿主只能用底层 es-form 的 configBtn 契约接管点击。',
  '表格片段在不给 apiUrl 时不声明 props：数据只能由宿主用同名属性覆盖根组件的内部绑定（Vue 的属性透传），契约是隐式的而不是 defineProps。',
  '片段之间没有编排契约（无 props / emits / provide 约定）：拼装靠底层 es-form / es-table / es-dialog 的既有属性名，换组件就得重接线。',
  'vue2 目标的片段从 vue 导入 defineComponent / reactive（Vue 2.7 语义），而 es-eui 是 Vue 2.6 + composition-api 插件 —— 故该端只做语法编译验证，不在此运行。',
]

// ── 生成 ───────────────────────────────────────────────────────────────────

/** 从工具出参里抽出 ```vue 围栏；抽不到就是生成器坏了，不能静默产出空文件。 */
function extractVue(text, label) {
  const m = String(text).match(/```vue[ \t]*\r?\n([\s\S]*?)```/)
  if (!m) throw new Error(`${label} 的出参里没有 \`\`\`vue 围栏`)
  return `${m[1].trimEnd()}\n`
}

const countLines = (code) => code.split('\n').length - (code.endsWith('\n') ? 1 : 0)

async function buildAll() {
  const caller = await createToolCaller()
  try {
    if (caller.fromBuild.length > 0) fail(`打包命中了 shared/build（${caller.fromBuild.length} 处）—— 记录会反映陈旧构建`)
    const names = new Set(caller.names)
    for (const tool of Object.values(FRAGMENT_TOOLS)) if (!names.has(tool)) fail(`工具 ${tool} 未注册`)

    /** target → key → { code, bytes, lines } */
    const byTarget = {}
    for (const target of TARGETS) {
      byTarget[target] = {}
      for (const key of FRAGMENT_KEYS) {
        const res = await caller.call(FRAGMENT_TOOLS[key], { ...FRAGMENT_ARGS[key], target })
        if (!res.ok) throw new Error(`${FRAGMENT_TOOLS[key]}(target=${target}) 返回错误：${res.text.slice(0, 200)}`)
        const code = extractVue(res.text, `${FRAGMENT_TOOLS[key]}(target=${target})`)
        byTarget[target][key] = { code, bytes: Buffer.byteLength(code), lines: countLines(code) }
      }
    }
    return byTarget
  } finally {
    caller.cleanup()
  }
}

function buildArtifact(byTarget) {
  const live = byTarget.vue3
  return {
    id: 'fragment-dashboard',
    title: '片段拼装仪表盘',
    nl:
      '一个分析页：顶部用 es-form 做筛选，中间用 es-table 展示结果，右侧原生图表；点行打开一个 es-dialog 弹窗。',
    sites: SITE_CLAIMS,
    frozenArgs: {
      ...FRAGMENT_ARGS,
      targets: TARGETS,
    },
    fragments: Object.fromEntries(
      FRAGMENT_KEYS.map((key) => [
        key,
        {
          tool: FRAGMENT_TOOLS[key],
          label: LABELS[key],
          file: FILE_NAMES[key],
          lines: live[key].lines,
          bytes: live[key].bytes,
        },
      ])
    ),
    targets: Object.fromEntries(
      TARGETS.map((target) => [
        target,
        {
          bytes: Object.fromEntries(FRAGMENT_KEYS.map((key) => [key, byTarget[target][key].bytes])),
          note:
            target === 'vue3'
              ? 'Vue 3 + Element Plus（@es-plus/vue3）—— 主文档站真跑'
              : target === 'antdv'
                ? 'Vue 3 + Ant Design Vue（@es-plus/adapter-antdv）—— es-pc 真跑'
                : 'Vue 2 + Element UI（@es-plus/vue2）—— 只做语法编译验证（见 knownGaps）',
        },
      ])
    ),
    host: HOST,
    knownGaps: KNOWN_GAPS,
  }
}

function renderSources(byTarget) {
  const payload = Object.fromEntries(
    TARGETS.map((target) => [target, Object.fromEntries(FRAGMENT_KEYS.map((key) => [key, byTarget[target][key].code]))])
  )
  return (
    '/**\n' +
    ' * 由 `scripts/gen-fragment-dashboard.mjs` 生成，勿手改。\n' +
    ' * 三端 × 三片段的**原样产物**（工具出参里的 ```vue 围栏，逐字节）。\n' +
    ' * 站点用它做「产物未经手改」的现场展示；真跑的是各自 target 的 .vue 文件。\n' +
    ' */\n' +
    `export const FRAGMENT_TARGETS = ${JSON.stringify(TARGETS)}\n\n` +
    `export const FRAGMENT_SOURCES = ${JSON.stringify(payload, null, 2)}\n`
  )
}

/** 站点里的 `.vue` 片段（只落能给目标真跑的两站）。 */
function fragmentFiles(byTarget) {
  const out = []
  for (const [target, dir] of Object.entries(TARGET_FRAGMENT_DIRS)) {
    for (const key of FRAGMENT_KEYS) {
      out.push({ rel: `${dir}/${FILE_NAMES[key]}`, text: byTarget[target][key].code })
    }
  }
  return out
}

function writeAll(artifactText, sourcesText, files) {
  const writes = [
    { rel: ARTIFACT_REL, text: artifactText },
    { rel: SOURCES_REL, text: sourcesText },
    ...SOURCES_COPIES.map((rel) => ({ rel, text: sourcesText })),
    ...files,
  ]
  for (const { rel, text } of writes) {
    const abs = join(ROOT, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  return writes
}

const sameText = (a, b) => normalizeEol(a) === normalizeEol(b)

function checkCompiles(byTarget) {
  for (const target of TARGETS) {
    for (const key of FRAGMENT_KEYS) {
      const failures = []
      parseSfc(byTarget[target][key].code, `${key} × ${target}`, failures)
      for (const f of failures) fail(`片段不可编译：${f}`)
    }
  }
}

function checkWiring() {
  for (const w of WIRING) {
    const pagePath = join(ROOT, w.page)
    if (!existsSync(pagePath)) {
      fail(`${w.site} 缺少宿主页 ${w.page}`)
      continue
    }
    const page = normalizeEol(readFileSync(pagePath, 'utf8'))
    if (!page.includes('fragment-dashboard.json')) fail(`${w.page} 没有引用本案例产物 fragment-dashboard.json`)
    if (!page.includes('fragment-dashboard-sources')) fail(`${w.page} 没有引用片段源码模块`)
    if (!page.includes('data-testid="fragment-dashboard"')) fail(`${w.page} 缺少 data-testid="fragment-dashboard"`)

    if (w.fragments) {
      for (const key of FRAGMENT_KEYS) {
        if (!page.includes(FILE_NAMES[key])) fail(`${w.page} 没有 import 片段 ${FILE_NAMES[key]}（claim=execute 的页面必须真渲染）`)
      }
    }

    const routerPath = join(ROOT, w.router)
    if (!existsSync(routerPath)) {
      fail(`${w.site} 缺少路由文件 ${w.router}`)
    } else if (!normalizeEol(readFileSync(routerPath, 'utf8')).includes('fragment-dashboard')) {
      // 不锚前导 `/`：es-pc 用相对段写法。
      fail(`${w.router} 未注册 /fragment-dashboard 路由`)
    }

    const casesPath = join(ROOT, w.cases)
    if (!existsSync(casesPath)) {
      fail(`${w.site} 缺少案例页 ${w.cases}`)
    } else if (!normalizeEol(readFileSync(casesPath, 'utf8')).includes('/fragment-dashboard')) {
      fail(`${w.cases} 没有指向 /fragment-dashboard 的入口（页面加了没人链 = 隐形页面）`)
    }
  }

  // 两个 Vue3 站点共用同一份宿主页：数据、接线、图表都只有一份实现，端差异只在片段
  // （@es-plus/vue3 vs @es-plus/adapter-antdv）。改一处漏一处会立刻红。
  const docsPage = join(ROOT, 'es-plus-docs/src/views/FragmentDashboard.vue')
  const pcPage = join(ROOT, 'es-pc/src/views/FragmentDashboard.vue')
  if (existsSync(docsPage) && existsSync(pcPage)) {
    if (!sameText(readFileSync(docsPage, 'utf8'), readFileSync(pcPage, 'utf8'))) {
      fail('es-plus-docs 与 es-pc 的 FragmentDashboard.vue 不一致（同一份宿主页应逐字节相同）')
    }
  }
}

/**
 * 产物里的 claim / 路由必须与 manifest 一致 —— 页面徽章不许比 manifest 更强（那是过度承诺），
 * 也不许更弱（读者看到的比守卫证到的少，等于这个案例白做）。
 */
function checkManifest() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/cases/ai-cases.json'), 'utf8'))
  const entry = manifest.cases.find((c) => c.id === 'fragment-dashboard')
  if (!entry) {
    fail('docs/cases/ai-cases.json 里没有 fragment-dashboard 案例（页面存在但画廊/守卫看不见）')
    return
  }
  for (const [site, claim] of Object.entries(SITE_CLAIMS)) {
    if (entry.sites?.[site] !== claim) {
      fail(`manifest 里 ${site} 的 claim（${entry.sites?.[site]}）与产物（${claim}）不一致`)
    }
  }
  if (entry.host?.route !== HOST.route) {
    fail(`manifest 的宿主路由（${entry.host?.route}）与产物（${HOST.route}）不一致`)
  }
  if (entry.artifacts?.schema !== ARTIFACT_REL) {
    fail(`manifest 的 artifacts.schema（${entry.artifacts?.schema}）不是 ${ARTIFACT_REL}`)
  }
  if (entry.claim !== 'execute') {
    fail(`manifest 的顶层 claim（${entry.claim}）应等于各站最大值 execute`)
  }
}

async function main() {
  const byTarget = await buildAll()

  const artifact = buildArtifact(byTarget)
  const artifactText = `${JSON.stringify(artifact, null, 2)}\n`
  const sourcesText = renderSources(byTarget)
  const files = fragmentFiles(byTarget)

  // 纯 JSON：产物会被站点点开/下载，函数体或函数式键混进来就意味着「藏了代码」。
  const problems = pureJsonProblems(artifact, ARTIFACT_REL)
  for (const p of problems) fail(`产物不是纯 JSON：${p}`)

  const blob = artifactText + sourcesText
  if (/(?:^|[\s"'[])[A-Za-z]:[\\/]/.test(blob)) fail('产物里出现了绝对路径（会随机器漂移）')
  if (/es-mcp-tools-/.test(blob)) fail('产物里出现了打包临时目录名')

  checkCompiles(byTarget)

  if (!CHECK) {
    if (failed) process.exit(1)
    const writes = writeAll(artifactText, sourcesText, files)
    console.log(
      `✅ 已生成 ${ARTIFACT_REL} + 源码模块（三端 ${TARGETS.length * FRAGMENT_KEYS.length} 个片段）+ ` +
        `${writes.length - 2 - SOURCES_COPIES.length} 个站点片段文件`
    )
    return
  }

  // 确定性：连算两遍必须逐字节相同。
  const again = await buildAll()
  if (!sameText(artifactText, `${JSON.stringify(buildArtifact(again), null, 2)}\n`)) {
    fail('同一进程内两次生成的产物不一致（存在非确定性来源）')
  }
  if (!sameText(sourcesText, renderSources(again))) fail('同一进程内两次生成的源码模块不一致（存在非确定性来源）')

  const expected = [
    { rel: ARTIFACT_REL, text: artifactText },
    { rel: SOURCES_REL, text: sourcesText },
    ...SOURCES_COPIES.map((rel) => ({ rel, text: sourcesText })),
    ...files,
  ]
  for (const { rel, text } of expected) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      fail(`缺少生成物 ${rel} —— 运行 npm run fragment:dashboard`)
      continue
    }
    if (!sameText(readFileSync(abs, 'utf8'), text)) {
      fail(`${rel} 已过期 —— 运行 npm run fragment:dashboard（不要手改）`)
    }
  }

  checkWiring()
  checkManifest()

  if (failed) process.exit(1)
  const kb = (Buffer.byteLength(artifactText) / 1024).toFixed(1)
  console.log(
    `✅ 片段仪表盘一致（三端 × 三片段共 ${TARGETS.length * FRAGMENT_KEYS.length} 个片段全部可解析；` +
      `产物 ${kb} KB 纯 JSON；单源 + 站点副本逐字节一致；三站接线完整）`
  )
  console.log(`   产物清单：${relative(ROOT, join(ROOT, ARTIFACT_REL)).split('\\').join('/')}`)
}

main().catch((err) => {
  console.error(`\n[gen-fragment-dashboard] 失败：${err.stack || err.message}`)
  process.exit(1)
})
