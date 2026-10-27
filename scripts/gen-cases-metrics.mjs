#!/usr/bin/env node
/**
 * F6「原生 vs es-plus」成本对照的**实测**数字生成。
 *
 * 背景：`cases.json` 里每条案例的 `pain` / `win` 是手写文案，「少写 70% 代码」这类说法
 * 无法复查。本脚本把口径落成可复算的东西：
 *
 *   1. 单源是成对的**完整示例**：`docs/examples/native/<场景>.vue` 与
 *      `docs/examples/es/<场景>.vue` 实现同一页面、同一功能范围（无省略号、无 stub）；
 *   2. 从两侧源码实算四个口径，产出 `docs/cases/cases-metrics.json` 供三站 Cases 页展示；
 *   3. 站点不写死任何数字 —— 展示的就是这里算出来的值，改示例即改数字。
 *
 * 四个口径（同一规则量两侧，都写进产出）：
 *   - lines     非空行数（整文件，含数据与 schema —— 不藏配置成本）；
 *   - events    模板里的事件绑定数（`@click` / `@btn-click` …，含修饰符写法）；
 *   - functions script 里自己写的函数数（`function f()` 与 `const f = (...) =>`）；
 *   - vIf       模板里的 `v-if` / `v-else-if` 分支数。
 *
 * 示例本身不进任何站点构建，所以这里用 `@vue/compiler-sfc` 把每个文件真编译一遍：
 * 语法坏了的示例会让 `--check` 变红，而不是悄悄让数字失真。
 *
 * 用法：
 *   node scripts/gen-cases-metrics.mjs           # 生成
 *   node scripts/gen-cases-metrics.mjs --check   # 校验产出是否为最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 示例缺失/编译失败/产出过期。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { readText, sameText } from './lib/text-sync.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'docs', 'examples')
const TARGET = join(ROOT, 'docs', 'cases', 'cases-metrics.json')
const CHECK = process.argv.includes('--check')

/** 场景标题（Cases 页直接展示）。新增场景必须在这里登记，否则脚本报错。 */
const TITLES = {
  'filter-table': '查询 + 表格 + 分页 + 行内查看',
  'status-column': '码值列：中文标签 + 空值占位',
}

/**
 * A9 三栏对照（`/native-vs-ai`）的第三栏：**同一能力范围的 AI 产物**（0 次模型调用 —— 复用 A1）。
 *
 * 为什么第三栏不是「filter-table 的严格同场景产物」：本仓没有为这个场景调过模型，硬造一份
 * 就等于把「确定性工具产物」冒充成「模型产物」。这里如实说明两侧功能**不是等量**的：
 * A1 产物是 **superset**（多一枚查询项、多一列、多三个弹窗、按钮权限），却仍只有 0 个函数 /
 * 0 个事件绑定 —— 这个方向的偏差**对 AI 不利**（多做功能，行数却没省），所以可以接受。
 *
 * 行数一栏刻意不设「AI 更短」的结论：纯 JSON 逐标量一行，物理行数不是复杂度信号。
 * 第三栏真正可比的是**事件 / 函数 / v-if 三项归零**与「一份产物三端跑」。
 */
const AI_SCENES = {
  'filter-table': {
    caseId: 'employee-roster',
    artifact: 'docs/cases/generated/employee-roster.json',
    meta: 'docs/cases/generated/employee-roster.meta.json',
    title: '员工花名册（模型生成，功能为 filter-table 的超集）',
    note:
      '多一枚查询项（在职状态）、多一列（入职日期）、多三个弹窗（新增/编辑/查看）；' +
      '同一份产物三站共用（es-plus-docs / es-pc / es-eui 副本逐字节一致）。',
  },
}

/** 三栏源码（原样、逐字节）供页面展示 —— 与 A8 的片段源码模块同一套做法。 */
const NVS_SOURCES = 'docs/cases/generated/native-vs-ai-sources.js'
const NVS_SITE_PAGES = [
  { site: 'es-plus-docs', page: 'es-plus-docs/src/views/NativeVsAi.vue', router: 'es-plus-docs/src/router/index.ts', cases: 'es-plus-docs/src/views/Cases.vue' },
  { site: 'es-pc', page: 'es-pc/src/views/NativeVsAi.vue', router: 'es-pc/src/router/index.js', cases: 'es-pc/src/views/Cases.vue' },
  { site: 'es-eui', page: 'es-eui/src/views/native-vs-ai.vue', router: 'es-eui/src/router/index.js', cases: 'es-eui/src/views/cases.vue' },
]
const NVS_COPIES = NVS_SITE_PAGES.map((p) => `${p.site}/src/cases/generated/native-vs-ai-sources.js`)

const toLF = (text) => text.replace(/\r\n?/g, '\n')
const nonEmptyLines = (text) => toLF(text).split('\n').filter((l) => l.trim() !== '').length

/** 抽出 <template>…</template> 与 <script …>…</script> 区（示例都是单块）。 */
function blocks(text) {
  const src = toLF(text)
  const tStart = src.indexOf('<template>')
  const tEnd = src.lastIndexOf('</template>')
  const sStart = src.search(/<script\b/)
  const sEnd = src.indexOf('</script>')
  return {
    template: tStart >= 0 && tEnd > tStart ? src.slice(tStart, tEnd) : '',
    script: sStart >= 0 && sEnd > sStart ? src.slice(sStart, sEnd) : '',
  }
}

/** 去掉模板里的 HTML 注释：注释里的「v-if」「@click」不是代码，计数必须看不见它们。 */
const stripComments = (template) => template.replace(/<!--[\s\S]*?-->/g, '')

/** 模板事件绑定：@click / @keyup.enter / @btn-click / @submit.prevent */
function countEvents(template) {
  return (stripComments(template).match(/@[A-Za-z][\w:.-]*/g) || []).length
}

/** 自己写的函数：function f() / async function f() / const f = (...) => / const f = async (...) => */
function countFunctions(script) {
  const names = new Set()
  for (const m of script.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1])
  for (const m of script.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) {
    names.add(m[1])
  }
  return names.size
}

/** v-if / v-else-if 分支数（v-else 只是兜底，不计） */
function countVIf(template) {
  return (stripComments(template).match(/\bv-(?:else-)?if\b/g) || []).length
}

/** 真编译一遍，语法坏了就停 —— 示例不进构建，这里是唯一的语法门。 */
function compileOrThrow(file, text) {
  const { descriptor, errors } = parse(text, { filename: file })
  if (errors.length) throw new Error(`${file} 解析失败：${errors[0].message}`)
  if (!descriptor.template) throw new Error(`${file} 缺少 <template>`)
  const compiled = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: 'cases-metrics',
  })
  if (compiled.errors.length) throw new Error(`${file} 模板编译失败：${compiled.errors[0]}`)
  if (descriptor.scriptSetup) compileScript(descriptor, { id: 'cases-metrics' })
}

function measure(file) {
  const text = readText(join(ROOT, file))
  compileOrThrow(file, text)
  const parts = blocks(text)
  return {
    file,
    lines: nonEmptyLines(text),
    events: countEvents(parts.template),
    functions: countFunctions(parts.script),
    vIf: countVIf(parts.template),
  }
}

const reduce = (native, es) => (native === 0 ? 0 : Math.round(((native - es) / native) * 1000) / 10)

/**
 * 第三栏（AI 产物）的四个口径。
 *
 * 事件 / 函数 / v-if 用**同一把尺子**量：JSON 里没有 `<template>` / `<script>`，`blocks()`
 * 取不到区就返回空串，于是三项必然为 0 —— 这是计数器的结果，不是写死的数字。
 *
 * **但这三项对 JSON 是没有定义的**：schema 允许 `formatter` / `render` 这类脚本字符串
 * （`structured-config.schema.ts`），它们住在 JSON 字符串里，`<script>` 派生计数器看不见。
 * 所以另记 `features.scriptStrings`（键名 `formatter` / `render` 的出现次数）：脚本藏进来的
 * 那一天，这三项仍是 0，而 `scriptStrings` 会立刻变成非 0 —— 页面与报告读的是后者。
 *
 * 行数/字节如实记录，但页面明写「JSON 物理行 ≠ 复杂度」：逐标量一行，行数不是优劣信号。
 */
function measureAi(rel) {
  return { file: rel, ...aiMetricsOf(readText(join(ROOT, rel))) }
}

/**
 * 纯函数部分（单测用）：同一份 JSON 文本无论 CRLF 还是 LF，产出必须**逐字段相同**。
 *
 * `bytes` 按 `toLF` 归一后的文本计 —— 否则本地 Windows（autocrlf=true，工作树 CRLF）
 * 算出 7994、Linux CI（检出 LF）算出 7631，`cases:metrics:check` 只在 CI 上红，
 * 而它挡的是 deploy-docs。2026-10-27 就是这么红过一次。
 */
export function aiMetricsOf(rawText) {
  const text = toLF(rawText)
  const parts = blocks(text)
  const schema = JSON.parse(text)
  const json = JSON.stringify(schema)
  return {
    lines: nonEmptyLines(text),
    bytes: Buffer.byteLength(text),
    events: countEvents(parts.template),
    functions: countFunctions(parts.script),
    vIf: countVIf(parts.template),
    features: {
      formItems: (schema.formItems ?? []).length,
      columns: (schema.columns ?? []).length,
      dialogs: Object.keys(schema.dialogs ?? {}).length,
      actions: (schema.actions ?? []).length,
      dataOptions: (json.match(/"dataOptions"/g) || []).length,
      permissionValue: (json.match(/"permissionValue"/g) || []).length,
      scriptStrings: (json.match(/"(?:formatter|render)"/g) || []).length,
    },
  }
}

/** 三栏源码模块（单源，另写三份站点副本 —— 与 A8 的片段源码模块同一套做法）。 */
function renderNvsSources(scenarios) {
  const payload = {}
  for (const s of scenarios) {
    const ai = AI_SCENES[s.id]
    if (!ai) continue
    const meta = JSON.parse(readText(join(ROOT, ai.meta)))
    payload[s.id] = {
      title: ai.title,
      note: ai.note,
      scene: s.title,
      columns: {
        native: { file: s.native.file, text: toLF(readText(join(ROOT, s.native.file))) },
        es: { file: s.es.file, text: toLF(readText(join(ROOT, s.es.file))) },
        ai: {
          file: ai.artifact,
          text: toLF(readText(join(ROOT, ai.artifact))),
          meta: {
            caseId: ai.caseId,
            model: meta.model ?? null,
            generatedAt: meta.generatedAt ?? null,
            attempts: meta.attempts ?? null,
            mode: meta.mode ?? null,
            nl: meta.nl ?? null,
          },
        },
      },
    }
  }
  return (
    '/**\n' +
    ' * 由 `scripts/gen-cases-metrics.mjs` 生成，勿手改。\n' +
    ' * `/native-vs-ai` 三栏展示的**原样源码**（原生 .vue / 手写 es-plus .vue / AI 产物 JSON）。\n' +
    ' * 行尾统一成 LF（仓库标准）：否则同一份示例在不同检出设置下会生成不同字节，守卫会假红。\n' +
    ' * 数字在 `cases-metrics.json` 里，源码在这里 —— 同一份度量脚本产出，改示例即两边同时变。\n' +
    ' */\n' +
    `export const NATIVE_VS_AI = ${JSON.stringify(payload, null, 2)}\n`
  )
}

/** 三站页面/路由/入口接线 —— 路由加了没人链 = 隐形页面。 */
function checkNvsWiring() {
  const problems = []
  for (const w of NVS_SITE_PAGES) {
    const pagePath = join(ROOT, w.page)
    if (!existsSync(pagePath)) {
      problems.push(`${w.site} 缺少对照页 ${w.page}`)
      continue
    }
    const page = toLF(readFileSync(pagePath, 'utf8'))
    if (!page.includes('native-vs-ai-sources')) problems.push(`${w.page} 没有引用三栏源码模块`)
    if (!page.includes('data-testid="native-vs-ai"')) problems.push(`${w.page} 缺少 data-testid="native-vs-ai"`)
    // 数字必须来自度量单源：只查「文件存在」证不到这一点 —— 写死 123/7/6/2 的页面
    // 照样能 import 一份用不上的 JSON。es-eui 没有 e2e project，这条静态检查是它唯一的
    // 「不写死」证据（docs 端另有 e2e 兜底，但同样先从单源取值）。
    // 必须匹配**import 语句**而不是文件名：页头注释里就写着 cases-metrics.json，
    // 只查子串会让「删掉 import、写死数字」的页面照样绿（负向测试踩到过）。
    if (!/from\s+'@\/cases\/cases-metrics\.json'/.test(page)) {
      problems.push(`${w.page} 没有 import '@/cases/cases-metrics.json'（注释里提到不算读取单源）`)
    }
    if (!/scenarios[\s\S]{0,120}\.find\(/.test(page)) {
      problems.push(`${w.page} 没有按 id 从 cases-metrics.json 取场景（数字可能是写死的）`)
    }
    const routerPath = join(ROOT, w.router)
    if (!existsSync(routerPath) || !toLF(readFileSync(routerPath, 'utf8')).includes('native-vs-ai')) {
      problems.push(`${w.router} 未注册 /native-vs-ai 路由`)
    }
    const casesPath = join(ROOT, w.cases)
    if (!existsSync(casesPath) || !toLF(readFileSync(casesPath, 'utf8')).includes('/native-vs-ai')) {
      problems.push(`${w.cases} 没有指向 /native-vs-ai 的入口`)
    }
  }
  // 两个 Vue3 站点共用同一份对照页：数字来自同一个单源模块，端差异不该在这里出现。
  const docs = join(ROOT, 'es-plus-docs/src/views/NativeVsAi.vue')
  const pc = join(ROOT, 'es-pc/src/views/NativeVsAi.vue')
  if (existsSync(docs) && existsSync(pc) && !sameText(readFileSync(docs, 'utf8'), readFileSync(pc, 'utf8'))) {
    problems.push('es-plus-docs 与 es-pc 的 NativeVsAi.vue 不一致（同一份对照页应逐字节相同）')
  }
  return problems
}

/** 三站 Cases 页必须展示这份实测值，而不是手写百分比。 */
const SITE_CASES = [
  'es-plus-docs/src/views/Cases.vue',
  'es-pc/src/views/Cases.vue',
  'es-eui/src/views/cases.vue',
]

function checkSites() {
  for (const file of SITE_CASES) {
    const text = readText(join(ROOT, file))
    if (!text.includes("from '@/cases/cases-metrics.json'")) {
      throw new Error(`${file} 没有读取实测数字（应 import '@/cases/cases-metrics.json'）`)
    }
    if (!/metrics\.scenarios/.test(text)) {
      throw new Error(`${file} 没有渲染 metrics.scenarios —— 数字必须是实测值，不能手写`)
    }
  }
}

function main() {
  const nativeDir = join(SRC_DIR, 'native')
  if (!existsSync(nativeDir)) throw new Error('docs/examples/native 不存在')
  const names = readdirSync(nativeDir)
    .filter((f) => f.endsWith('.vue'))
    .map((f) => f.slice(0, -4))
    .sort()

  const scenarios = names.map((name) => {
    const title = TITLES[name]
    if (!title) throw new Error(`场景 ${name} 没有登记标题（scripts/gen-cases-metrics.mjs 的 TITLES）`)
    const esFile = `docs/examples/es/${name}.vue`
    if (!existsSync(join(ROOT, esFile))) throw new Error(`缺少对照实现 ${esFile}`)
    const native = measure(`docs/examples/native/${name}.vue`)
    const es = measure(esFile)
    const ai = AI_SCENES[name] ? measureAi(AI_SCENES[name].artifact) : null
    return {
      id: name,
      title,
      native,
      es,
      ...(ai ? { ai } : {}),
      reduction: {
        lines: reduce(native.lines, es.lines),
        events: reduce(native.events, es.events),
        functions: reduce(native.functions, es.functions),
        vIf: reduce(native.vIf, es.vIf),
      },
    }
  })

  // 汇总按「侧」分开累计：把两侧相加得到的是一个没有含义的数（原生 123 + es 77 = 200
  // 说明不了任何事）。keys 与 scenarios[].native / .es 完全一致，读的人不用再猜。
  const sumSide = (side, key) => scenarios.reduce((acc, s) => acc + s[side][key], 0)
  const sideTotals = (side) => ({
    lines: sumSide(side, 'lines'),
    events: sumSide(side, 'events'),
    functions: sumSide(side, 'functions'),
    vIf: sumSide(side, 'vIf'),
  })

  const out = {
    $comment:
      '由 scripts/gen-cases-metrics.mjs 从 docs/examples/{native,es}/*.vue 与 AI 产物实测生成，禁止手改。Cases 页展示的行数/事件/函数/v-if 就是这里算出来的，改示例即改数字；scenarios[].ai 是 /native-vs-ai 的第三栏（同一把尺子量 AI 产物）。',
    method:
      '同一场景两侧实现同一功能范围（无省略号、无 stub）；lines = 整文件非空行（含数据与 schema，不藏配置成本）；events = 模板事件绑定数；functions = script 自写函数数；vIf = v-if/v-else-if 分支数；reduction = (native - es) / native。第三栏（ai）用同一把尺子量 AI 产出的纯 JSON：没有 <template>/<script>，故 events/functions/vIf 由计数器算得为 0；lines 是 JSON 物理行（不是复杂度信号，页面里明写）。',
    scenarios,
    totals: { native: sideTotals('native'), es: sideTotals('es') },
  }

  const text = `${JSON.stringify(out, null, 2)}\n`
  const sourcesText = renderNvsSources(scenarios)
  const wiring = checkNvsWiring()
  if (wiring.length) {
    for (const p of wiring) console.error(`❌ ${p}`)
    process.exit(1)
  }
  checkSites()
  if (CHECK) {
    if (!existsSync(TARGET)) {
      console.error('[cases-metrics] 缺少 docs/cases/cases-metrics.json，先运行 node scripts/gen-cases-metrics.mjs')
      process.exit(1)
    }
    if (!sameText(readFileSync(TARGET, 'utf8'), text)) {
      console.error('[cases-metrics] 产出过期：示例改了而 cases-metrics.json 没更新（或反之）。运行 node scripts/gen-cases-metrics.mjs')
      process.exit(1)
    }
    for (const rel of [NVS_SOURCES, ...NVS_COPIES]) {
      const abs = join(ROOT, rel)
      if (!existsSync(abs)) {
        console.error(`[cases-metrics] 缺少三栏源码模块 ${rel} —— 运行 node scripts/gen-cases-metrics.mjs`)
        process.exit(1)
      }
      if (!sameText(readFileSync(abs, 'utf8'), sourcesText)) {
        console.error(`[cases-metrics] ${rel} 过期（示例/产物改了而源码模块没重算）`)
        process.exit(1)
      }
    }
    const withAi = scenarios.filter((s) => s.ai).length
    console.log(`[cases-metrics] 一致：${scenarios.length} 个场景（其中 ${withAi} 个有 AI 对照栏）`)
    return
  }

  writeFileSync(TARGET, text)
  for (const rel of [NVS_SOURCES, ...NVS_COPIES]) {
    const abs = join(ROOT, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, sourcesText)
  }
  console.log(
    `[cases-metrics] 已生成 ${scenarios.length} 个场景 → docs/cases/cases-metrics.json` +
      `（三栏源码 ${NVS_SOURCES} + ${NVS_COPIES.length} 份站点副本）`
  )
  for (const s of scenarios) {
    // 降幅可能为负（声明式配置在很小的场景里不一定更短）—— 负数如实显示成 +x%
    const pct = (v) => (v >= 0 ? `−${v}%` : `+${Math.abs(v)}%`)
    console.log(
      `  · ${s.id}：行 ${s.native.lines}→${s.es.lines}（${pct(s.reduction.lines)}）` +
        ` · 事件 ${s.native.events}→${s.es.events}（${pct(s.reduction.events)}）` +
        ` · 函数 ${s.native.functions}→${s.es.functions}（${pct(s.reduction.functions)}）` +
        ` · v-if ${s.native.vIf}→${s.es.vIf}（${pct(s.reduction.vIf)}）`,
    )
  }
}

// 只在直接运行时生成：被 import（测试、别的脚本）时不得覆写产物。
// 与本仓 `gen-one-config-diff.mjs` 的教训一致 —— 那个脚本没有 main-guard，import 它会写文件。
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
