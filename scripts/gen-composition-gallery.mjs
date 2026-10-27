#!/usr/bin/env node
/**
 * 站点「组合画廊」（S2）的单一真源生成器 + 守卫。
 *
 * ## 它生成什么
 *
 * `docs/cases/generated/composition-gallery.js`（再由 `cases:sync` 分发到三站副本）：
 * 18 例组合语料（6 个逻辑案例 × 3 target）的**同一份**视图模型 —— 意图表 surfaces、
 * 语料声明 expect、真的跑出来的组合事实 facts、生成产物（pageSchema / dialog composable）。
 *
 * ## 为什么要有生成步骤（偏离计划 §4.4 的「零新产物」）
 *
 * 计划原意是站点构建时直接 import `__tests__/golden/composition/*.json` 并在浏览器里
 * 跑 `composeCrudConfig`。两条硬约束让这条路走不通：
 *   1. **es-eui 没有 TS loader**（Vue 2 + vue-cli webpack，见 `es-eui/vue.config.js`），
 *      站点侧 import `@es-plus/shared` 的 TS 源码直接编译不过；
 *   2. 三站打包器不同（vite ×2 / webpack ×1），「跨仓根 import golden 目录」没有统一写法。
 * 因此把同一份计算放到 Node 侧做一次，落成逐字节确定的 JS 数据模块。**单一真源不变**：
 * 算它的仍是 `composeInputOf → composeCrudConfig → compositionFacts`（与被评测的打分器
 * 同一函数）与 `generateFromConfig`（与前门同一条生成路径）。
 *
 * ## `--check` 守什么（进 `check:consistency`）
 *
 * 1. **新鲜度**：重算模型，与单源文件和三站副本逐字节比对 —— 改语料/生成器忘了重跑即红。
 * 2. **模型自洽**：18 例 / 6 per target / 6 per shape；每例 `compositionProblems` 为空；
 *    `facts` 与 `expect` 逐项一致（与评测同一判据）；产物形态与形状匹配。
 * 3. **接线**：三站页面都 import 数据模块、路由都有 `/ai-gallery/composition`、
 *    画廊列表都有入口链接；主文档站与 es-pc 的页面逐字节相同（同一份数据检视页）。
 * 4. **非空证明**：删一例 / 篡改事实 / 去掉路由 —— 对应判据必须变红。
 *
 * 用法：
 *   node scripts/gen-composition-gallery.mjs            # 生成单源（随后 cases:sync 分发）
 *   node scripts/gen-composition-gallery.mjs --check     # 只校验（CI）
 *   npm run composition:gallery                          # 生成 + 分发（一条命令）
 * 退出码：0 = 生成成功 / 全绿；1 = 漂移或模型不自洽。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import {
  COMPOSITION_SHAPES,
  composeInputOf,
  compositionFactProblems,
  compositionFacts,
  compositionProblems,
  fragmentProblems,
} from './eval/composition-scorers.mjs'
import { captureFrontDoor, frontDoorArgs, ROOT } from './lib/front-door.mjs'
import { extractPageSchema } from './lib/ai-cases.mjs'
import { stripDocsOnlyMeta } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'composition')
const CANONICAL = join(ROOT, 'docs', 'cases', 'generated', 'composition-gallery.js')
const TARGETS = ['vue3', 'vue2', 'antdv']
const SITE_COPIES = ['es-plus-docs', 'es-pc', 'es-eui'].map((site) =>
  join(ROOT, site, 'src', 'cases', 'generated', 'composition-gallery.js')
)
const CHECK = process.argv.includes('--check')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

// ───────────────────────────── 模型构建 ─────────────────────────────

/**
 * 打包 `@es-plus/shared` 的**源码**（不是 build/）。
 *
 * 与 `check-capability-parity` 同一条理由：陈旧构建会让生成物静默展示旧行为。
 * `metafile` 自证输入来自 `packages/shared/src`、`packages/shared/build` 零命中。
 */
async function loadShared() {
  const outfile = join(ROOT, 'node_modules', '.cache', 'composition-gallery-shared.mjs')
  mkdirSync(dirname(outfile), { recursive: true })
  const result = await build({
    stdin: {
      contents: [
        `export { composeCrudConfig } from ${JSON.stringify(join(ROOT, 'packages/shared/src/compose-crud-config.ts'))}`,
        `export { generateFromConfig } from ${JSON.stringify(join(ROOT, 'packages/shared/src/structured-generator.ts'))}`,
      ].join('\n'),
      resolveDir: ROOT,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    external: ['esbuild'],
    metafile: true,
  })
  const inputs = Object.keys(result.metafile.inputs).map((p) => p.replace(/\\/g, '/'))
  const fromBuild = inputs.filter((p) => p.includes('packages/shared/build/'))
  if (fromBuild.length) {
    throw new Error(`打包拉到了 shared/build（${fromBuild.slice(0, 3).join(',')}）—— 陈旧构建会让画廊展示旧行为`)
  }
  return import(`file://${outfile.replace(/\\/g, '/')}?v=${Date.now()}`)
}

/**
 * 从围栏代码里取出「标题 → 语言 → 代码」。
 *
 * 为什么不用现成的 `fencedBlocks`：它只返回代码，标题（`## Dialog composable (useAddDialog)`）
 * 是片段名字的唯一来源。这里解析后与 `fencedBlocks` 的块数对照，防止两把尺子漂移。
 */
function extractBlocks(text) {
  const lines = String(text ?? '').split('\n')
  const out = []
  let heading = null
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{2,3}\s+(.+?)\s*$/.exec(lines[i])
    if (h) {
      heading = h[1]
      continue
    }
    const fence = /^```([a-zA-Z]*)\s*$/.exec(lines[i])
    if (!fence) continue
    const buf = []
    i++
    while (i < lines.length && !/^```\s*$/.test(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push({ heading, lang: fence[1] || 'ts', code: `${buf.join('\n')}\n` })
  }
  return out
}

/** 前门产物里的 `⚠️ Warnings:` 段（片段分支把 target 差异写在这里）。 */
function warningsOfText(text) {
  const lines = String(text ?? '').split('\n')
  const i = lines.findIndex((l) => /^⚠️\s*Warnings:/.test(l))
  if (i === -1) return []
  const out = []
  for (let j = i + 1; j < lines.length && /^\s+-\s+/.test(lines[j]); j++) {
    out.push(lines[j].replace(/^\s+-\s+/, '').trim())
  }
  return out
}

const baseIdOf = (id) => String(id).replace(/-(vue3|vue2|antdv)$/, '')
const canonJson = (v) =>
  JSON.stringify(
    (function sort(x) {
      if (Array.isArray(x)) return x.map(sort)
      if (x && typeof x === 'object') {
        return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])]))
      }
      return x
    })(v)
  )

/**
 * 组合事实的逐项对照（「语料声明 vs 实际」）。
 *
 * 这是**投影**不是新判据：每行都只是把 `facts` 与 `expect` 摆在一起，`pass` 用的仍是
 * `canonJson` 深等值。`modelProblems` 断言 `checks.every(pass) === factsMatchExpect`，
 * 两者不可能各自漂移。站点只渲染这些行，不在浏览器里重写一遍对照规则。
 */
export function checksOf(c) {
  const eq = (a, b) => canonJson(a) === canonJson(b)
  const rows = []
  if (c.shape === 'form+dialog') {
    const keys = (c.surfaces?.dialog ?? []).map(String)
    const blocks = c.expect?.dialogBlocks ?? []
    const names = keys.map((k) => `use${k.charAt(0).toUpperCase()}${k.slice(1)}Dialog`)
    rows.push({
      key: 'dialogKeys',
      label: '弹窗块 key',
      pass: eq(c.facts.dialogKeys, [...keys].sort()),
      want: [...keys].sort(),
      got: c.facts.dialogKeys,
    })
    rows.push({
      key: 'dialogFields',
      label: '每个弹窗块的字段（= form 面）',
      pass: blocks.every((b) =>
        eq(c.facts.dialogBlocks.find((x) => x.key === String(b.key))?.fields ?? [], b.fields ?? [])
      ),
      want: blocks.map((b) => `${b.key}: ${(b.fields ?? []).join(', ')}`),
      got: c.facts.dialogBlocks.map((b) => `${b.key}: ${b.fields.join(', ')}`),
    })
    rows.push({
      key: 'composable',
      label: 'composable 命名（use<Key>Dialog）',
      pass: names.every((n) => c.facts.dialogBlocks.some((b) => b.composable === n)),
      want: names,
      got: c.facts.dialogBlocks.map((b) => b.composable),
    })
    return rows
  }
  const e = c.expect ?? {}
  rows.push({ key: 'shape', label: '形状', pass: c.facts.shape === c.shape, want: c.shape, got: c.facts.shape })
  rows.push({
    key: 'membership',
    label: '成员关系（同名归并后）',
    pass: eq(c.facts.membership, e.membership),
    want: e.membership,
    got: c.facts.membership,
  })
  rows.push({
    key: 'duplicates',
    label: '同名字段归并（无重复 prop）',
    pass: (c.facts.duplicates ?? []).length === 0,
    want: [],
    got: c.facts.duplicates ?? [],
  })
  rows.push({
    key: 'actions',
    label: '动作（由弹窗键派生）',
    pass: eq(c.facts.actions, [...(e.actions ?? [])].sort()),
    want: e.actions ?? [],
    got: c.facts.actions,
  })
  rows.push({
    key: 'dialogKeys',
    label: '弹窗键',
    pass: eq(c.facts.dialogKeys, [...(e.dialogKeys ?? [])].sort()),
    want: e.dialogKeys ?? [],
    got: c.facts.dialogKeys,
  })
  rows.push({
    key: 'legacy',
    label: 'legacy dialogFormItems 形态',
    pass: c.facts.legacyDialogFormItems === e.legacyDialogFormItems,
    want: e.legacyDialogFormItems,
    got: c.facts.legacyDialogFormItems,
  })
  rows.push({
    key: 'operationColumn',
    label: 'operationColumn',
    pass: eq(c.facts.operationColumn, e.operationColumn),
    want: e.operationColumn,
    got: c.facts.operationColumn,
  })
  return rows
}

function loadCases() {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

async function buildModel() {
  const shared = await loadShared()
  const cases = loadCases()

  const { mod, cleanup } = await captureFrontDoor()
  let fragmentTexts
  try {
    const { cap } = mod.capture()
    fragmentTexts = new Map()
    for (const c of cases) {
      if (c.shape !== 'form+dialog') continue
      const r = await cap.handler(frontDoorArgs(c, c.surfaces))
      const text = r.content?.[0]?.text ?? ''
      if (r.isError) throw new Error(`${c.id}：前门返回 isError —— ${text.split('\n')[0]}`)
      fragmentTexts.set(c.id, text)
    }
  } finally {
    cleanup()
  }

  const out = []
  for (const c of cases) {
    if (c.shape === 'form+dialog') {
      const text = fragmentTexts.get(c.id) ?? ''
      const blocks = extractBlocks(text)
      const hostEntry = blocks.find((b) => /^App entry\b/.test(b.heading ?? '')) ?? null
      const fragments = blocks
        .filter((b) => /^Dialog composable\b/.test(b.heading ?? ''))
        .map((b) => ({
          name: (/\((\w+)\)/.exec(b.heading) ?? [])[1] ?? null,
          lang: b.lang,
          code: b.code,
        }))
      const fragmentProblemsFound = fragmentProblems(c, text)
      const facts = {
        shape: c.shape,
        dialogKeys: (c.surfaces?.dialog ?? []).map(String).sort(),
        dialogBlocks: fragments.map((f) => ({
          key: String(f.name ?? '').replace(/^use/, '').replace(/Dialog$/, '').toLowerCase(),
          composable: f.name,
          fields: (c.surfaces?.form ?? []).map((f) => f.prop),
        })),
      }
      out.push({
        id: c.id,
        baseId: baseIdOf(c.id),
        shape: c.shape,
        target: c.target,
        mode: c.mode,
        name: c.name,
        apiUrl: c.apiUrl,
        surfaces: c.surfaces,
        expect: c.expect,
        facts,
        factsMatchExpect: fragmentProblemsFound.length === 0,
        checks: checksOf({ shape: c.shape, surfaces: c.surfaces, expect: c.expect, facts }),
        warnings: warningsOfText(text),
        product: {
          kind: 'fragments',
          fragments,
          hostEntry: hostEntry ? { lang: hostEntry.lang, code: hostEntry.code } : null,
        },
      })
      continue
    }

    const { config, warnings } = shared.composeCrudConfig(composeInputOf(c))
    const facts = compositionFacts(config)
    const factProblemsFound = compositionFactProblems(c, facts)
    const product = shared.generateFromConfig(config)
    const pageSchema = extractPageSchema(product.code, `${c.id} 生成物`)
    out.push({
      id: c.id,
      baseId: baseIdOf(c.id),
      shape: c.shape,
      target: c.target,
      mode: c.mode,
      name: c.name,
      apiUrl: c.apiUrl,
      surfaces: c.surfaces,
      expect: c.expect,
      facts,
      factsMatchExpect: factProblemsFound.length === 0,
      checks: checksOf({ shape: c.shape, surfaces: c.surfaces, expect: c.expect, facts }),
      warnings: [...warnings, ...(product.warnings ?? [])],
      product: { kind: 'page', pageSchema, code: product.code },
    })
  }

  const bases = [...new Set(out.map((c) => c.baseId))].sort().map((baseId) => {
    const trio = out.filter((c) => c.baseId === baseId)
    const kind = trio[0]?.product.kind
    // 渲染端包名是**唯一**合法的端间差异：`@es-plus/vue3` / `@es-plus/vue2` /
    // `@es-plus/adapter-antdv`。归一后再比，才能把「只是 import 换了包」与
    // 「产物结构真的不同」区分开 —— 后者才是需要人看的信号。
    const normalize = (code) => String(code).replace(/@es-plus\/(vue3|vue2|adapter-antdv)/g, '@es-plus/<renderer>')
    const rawKey = (c) =>
      c.product.kind === 'page'
        ? c.product.code
        : canonJson({
            fragments: c.product.fragments.map((f) => ({ name: f.name, code: f.code })),
            hostEntry: c.product.hostEntry?.code ?? '',
          })
    // 「组合产物」= pageSchema 源码 / dialog composable；宿主装配块（前门预检）单列 ——
    // 它按端不同（Element Plus / Ant Design / Element UI），那不是组合差异。
    const generatedKey = (c) =>
      c.product.kind === 'page'
        ? normalize(c.product.code)
        : canonJson(c.product.fragments.map((f) => ({ name: f.name, code: normalize(f.code) })))
    const hostKey = (c) =>
      c.product.kind === 'page' ? null : normalize(c.product.hostEntry?.code ?? '')
    const codeEqual = new Set(trio.map(rawKey)).size === 1
    const factsEqual = new Set(trio.map((c) => canonJson(c.facts))).size === 1
    const generatedEqualIgnoringTargetImports = new Set(trio.map(generatedKey)).size === 1
    const hostEntryEqualIgnoringTargetImports = new Set(trio.map(hostKey)).size === 1
    const bytes = Object.fromEntries(
      TARGETS.map((t) => {
        const c = trio.find((x) => x.target === t)
        if (!c) return [t, 0]
        return [
          t,
          c.product.kind === 'page'
            ? c.product.code.length
            : c.product.fragments.reduce((n, f) => n + f.code.length, 0),
        ]
      })
    )
    const rendererOf = (c) => {
      const src = c.product.kind === 'page' ? c.product.code : c.product.hostEntry?.code ?? ''
      const m = /@es-plus\/(vue3|vue2|adapter-antdv)/.exec(src)
      return m ? `@es-plus/${m[1]}` : null
    }
    return {
      baseId,
      name: trio[0]?.name,
      shape: trio[0]?.shape,
      apiUrl: trio[0]?.apiUrl,
      kind,
      codeEqual,
      generatedEqualIgnoringTargetImports,
      hostEntryEqualIgnoringTargetImports,
      factsEqual,
      rendererByTarget: Object.fromEntries(TARGETS.map((t) => [t, rendererOf(trio.find((c) => c.target === t) ?? {})])),
      codeBytesByTarget: bytes,
      warningsByTarget: Object.fromEntries(TARGETS.map((t) => [t, trio.find((c) => c.target === t)?.warnings ?? []])),
      note:
        !factsEqual
          ? '三端组合事实不一致 —— 端间差异会被误当成模型能力差异，先查语料。'
          : codeEqual
            ? 'schema 模式：同一份 surfaces 在三端产出逐字节相同的产物；target 只体现在宿主预检文案与告警。'
            : generatedEqualIgnoringTargetImports && hostEntryEqualIgnoringTargetImports
              ? '三端产物只差 import 的渲染端包名（@es-plus/vue3 / @es-plus/vue2 / @es-plus/adapter-antdv），其余逐字节相同。'
              : generatedEqualIgnoringTargetImports
                ? '组合产物（dialog composable）只差 import 的渲染端包名；宿主装配块按端不同（Element Plus / Ant Design / Element UI）—— 那是宿主预检，不是组合差异。'
                : '三端产物存在结构性差异 —— 这是组合可见性的信号，请对照源码与告警。',
    }
  })

  return {
    version: 1,
    generatedBy: 'scripts/gen-composition-gallery.mjs',
    note: '自动生成，禁止手改。单源：__tests__/golden/composition/*.json；组合事实由 compositionFacts 计算（与评测同一函数），产物由 composeCrudConfig → generateFromConfig / 前门 no-table 分支产出。',
    source: '__tests__/golden/composition/*.json（18 例 = 6 逻辑案例 × 3 target）',
    shapes: [...COMPOSITION_SHAPES],
    targets: TARGETS,
    cases: out,
    bases,
  }
}

// ───────────────────────────── 文本与判据 ─────────────────────────────

function render(model) {
  return [
    '/**',
    ' * 自动生成：scripts/gen-composition-gallery.mjs —— **禁止手改**。',
    ' *',
    ' * `npm run check:composition-gallery` 会重算本文件并与仓库里的字节比对；',
    ' * 三站副本由 `npm run cases:sync` 分发（`check:ai-cases` 断言逐字节一致）。',
    ' */',
    `export const COMPOSITION_GALLERY = ${JSON.stringify(model, null, 2)}`,
    '',
  ].join('\n')
}

/** 模型自洽（数据侧）。返回问题数组。 */
export function modelProblems(model) {
  const problems = []
  const cases = model?.cases ?? []
  if (cases.length !== 18) problems.push(`语料应为 18 例，实得 ${cases.length}`)
  for (const target of TARGETS) {
    const n = cases.filter((c) => c.target === target).length
    if (n !== 6) problems.push(`${target} 应为 6 例，实得 ${n}`)
  }
  for (const shape of COMPOSITION_SHAPES) {
    const n = cases.filter((c) => c.shape === shape).length
    if (n !== 6) problems.push(`形状 ${shape} 应为 6 例，实得 ${n}`)
  }
  for (const c of cases) {
    for (const p of compositionProblems(c)) problems.push(p)
    if (!c.factsMatchExpect) problems.push(`${c.id}: 组合事实与语料声明不一致（画廊会展示一份评测没跑过的配置）`)
    // 不只信产物里的自述标记：把 `facts` 重新拿去和语料声明比一遍。
    // 手改生成物、或生成器回归把「不一致」写成 `true` 时，这条才会咬住 ——
    // 因此 `proveGuards` 的「篡改组合事实」注入改的是 facts 本身，不是标记。
    if (c.shape !== 'form+dialog') {
      for (const p of compositionFactProblems(c, c.facts)) problems.push(p)
    }
    // `checks` 是页面的逐项对照，`factsMatchExpect` 是评测判据 —— 两者必须同真同假，
    // 否则页面会出现「逐项全绿但总判红」这类自相矛盾的展示。
    if (!Array.isArray(c.checks) || c.checks.length === 0) {
      problems.push(`${c.id}: 缺逐项对照（checks）`)
    } else if (c.checks.every((r) => r.pass) !== c.factsMatchExpect) {
      problems.push(`${c.id}: checks 与 factsMatchExpect 不一致（逐项 ${c.checks.filter((r) => r.pass).length}/${c.checks.length} 通过）`)
    } else if (canonJson(checksOf(c)) !== canonJson(c.checks)) {
      // 逐项对照也是重算，不读回生成物里的自述结果。
      problems.push(`${c.id}: 逐项对照与重算不符（生成物被手改，或 checksOf 语义漂移）`)
    }
    if (c.shape === 'form+dialog') {
      if (c.product?.kind !== 'fragments') problems.push(`${c.id}: form+dialog 的产物应是片段`)
      if (!(c.product?.fragments ?? []).length) problems.push(`${c.id}: 没有 dialog composable 产物`)
      if (!c.product?.hostEntry) problems.push(`${c.id}: 缺宿主装配块（片段分支的前门预检）`)
    } else {
      if (c.product?.kind !== 'page') problems.push(`${c.id}: 有表形状的产物应是 pageSchema`)
      if (!c.product?.pageSchema?.columns?.length) problems.push(`${c.id}: pageSchema 没有 columns`)
      if (c.facts?.duplicates?.length) problems.push(`${c.id}: 同名字段归并失效（${c.facts.duplicates.join(',')}）`)
    }
  }
  const bases = model?.bases ?? []
  const baseIds = [...new Set(cases.map((c) => c.baseId))].sort()
  if (bases.length !== baseIds.length) problems.push(`基案例应为 ${baseIds.length} 个，实得 ${bases.length}`)
  for (const b of bases) {
    const trio = cases.filter((c) => c.baseId === b.baseId)
    if (trio.length !== 3) problems.push(`${b.baseId}: 三端语料不全（${trio.map((c) => c.target).join(',')}）`)
    if (!b.factsEqual) problems.push(`${b.baseId}: 三端组合事实不一致 —— 端间差异会被误当成模型能力差异`)
  }
  return problems
}

/** 页面 import 判据。 */
export function pageProblems(text, label) {
  const problems = []
  if (!/from\s+['"]@\/cases\/generated\/composition-gallery(?:\.js)?['"]/.test(text)) {
    problems.push(`${label}: 没有从 '@/cases/generated/composition-gallery' 引入数据模块`)
  }
  if (!/COMPOSITION_GALLERY/.test(text)) problems.push(`${label}: 没有使用 COMPOSITION_GALLERY`)
  return problems
}

/** 路由判据（三站写法不同：docs 带前导斜杠、es-pc 是嵌套 children 的相对路径）。 */
export function routerProblems(text, label) {
  const problems = []
  if (!/path:\s*['"]\/?ai-gallery\/composition['"]/.test(text)) {
    problems.push(`${label}: 路由表缺 /ai-gallery/composition`)
  }
  if (!/AiComposition|ai-composition/.test(text)) {
    problems.push(`${label}: 路由没有指向组合画廊组件`)
  }
  return problems
}

/** 画廊列表入口判据。 */
export function galleryLinkProblems(text, label) {
  return /\/ai-gallery\/composition/.test(text) ? [] : [`${label}: 画廊列表没有组合画廊入口`]
}

function wiringProblems() {
  const problems = []
  const pages = [
    ['es-plus-docs/src/views/AiComposition.vue', '主文档站'],
    ['es-pc/src/views/AiComposition.vue', 'es-pc'],
    ['es-eui/src/views/ai-composition.vue', 'es-eui'],
  ]
  for (const [rel, label] of pages) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      problems.push(`${label}: 缺页面 ${rel}`)
      continue
    }
    problems.push(...pageProblems(readFileSync(abs, 'utf8'), label))
  }
  const routers = [
    ['es-plus-docs/src/router/index.ts', '主文档站'],
    ['es-pc/src/router/index.js', 'es-pc'],
    ['es-eui/src/router/index.js', 'es-eui'],
  ]
  for (const [rel, label] of routers) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      problems.push(`${label}: 缺路由文件 ${rel}`)
      continue
    }
    problems.push(...routerProblems(readFileSync(abs, 'utf8'), label))
  }
  const galleries = [
    ['es-plus-docs/src/views/AiGallery.vue', '主文档站'],
    ['es-pc/src/views/AiGallery.vue', 'es-pc'],
    ['es-eui/src/views/ai-gallery.vue', 'es-eui'],
  ]
  for (const [rel, label] of galleries) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      problems.push(`${label}: 缺画廊页 ${rel}`)
      continue
    }
    problems.push(...galleryLinkProblems(readFileSync(abs, 'utf8'), label))
  }
  return problems
}

/** 逐字节比对（统一换行后再比：工作区 CRLF、仓库 LF 不算漂移）。 */
function sameText(a, b) {
  return a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n')
}

/** 主文档站与 es-pc 的组合画廊页必须逐字节相同（同一份数据检视页，差异只在框架层之外）。
 *  唯一的例外是主文档站独有的逐页 meta 接线，见 stripDocsOnlyMeta 的说明。 */
function twinPageProblems() {
  const a = join(ROOT, 'es-plus-docs/src/views/AiComposition.vue')
  const b = join(ROOT, 'es-pc/src/views/AiComposition.vue')
  if (!existsSync(a) || !existsSync(b)) return ['两站组合画廊页缺失，无法比对']
  return sameText(stripDocsOnlyMeta(readFileSync(a, 'utf8')), stripDocsOnlyMeta(readFileSync(b, 'utf8')))
    ? []
    : ['主文档站与 es-pc 的组合画廊页出现分叉 —— 这是同一份数据检视页，请保持逐字节相同']
}

/** 非空证明（每次跑都验）。 */
function proveGuards(model) {
  const ok = (name, cond) => {
    if (cond) console.log(`✅ 非空证明 ${name} → 判据变红`)
    else fail(`非空证明失效：${name}`)
  }

  const dropped = { ...model, cases: model.cases.slice(1) }
  ok('删掉一例语料', modelProblems(dropped).some((p) => /17/.test(p)))

  const tampered = JSON.parse(JSON.stringify(model))
  const victim = tampered.cases.find((c) => c.shape !== 'form+dialog')
  victim.facts = { ...victim.facts, membership: { ...victim.facts.membership, __phantom: ['table'] } }
  victim.factsMatchExpect = true
  ok(
    '篡改组合事实',
    modelProblems(tampered).some((p) => p.includes(victim.id) && /成员|声明/.test(p))
  )

  ok('页面少了数据 import', pageProblems('<script setup>void 0</script>', '注入').length > 0)
  ok('路由少了组合页', routerProblems("path: '/ai-gallery/:id', component: AiGallery", '注入').length > 0)
  ok('画廊少了入口', galleryLinkProblems('<router-link to="/ai-gallery">全部</router-link>', '注入').length > 0)
  ok('文本漂移', !sameText('a\n', 'b\n'))
}

// ───────────────────────────── 入口 ─────────────────────────────

async function main() {
  const model = await buildModel()
  const text = render(model)

  const problems = modelProblems(model)
  for (const p of problems) fail(p)

  if (CHECK) {
    if (!existsSync(CANONICAL)) {
      fail('单源文件不存在：docs/cases/generated/composition-gallery.js（先跑 npm run composition:gallery）')
    } else if (!sameText(readFileSync(CANONICAL, 'utf8'), text)) {
      fail('组合画廊单源已过期 —— 语料或生成器改了但没重跑：npm run composition:gallery')
    }
    SITE_COPIES.forEach((abs, i) => {
      const label = ['es-plus-docs', 'es-pc', 'es-eui'][i]
      if (!existsSync(abs)) {
        fail(`${label}: 缺少副本 src/cases/generated/composition-gallery.js（先跑 npm run cases:sync）`)
      } else if (!sameText(readFileSync(abs, 'utf8'), text)) {
        fail(`${label}: 组合画廊副本与单源不一致（先跑 npm run cases:sync）`)
      }
    })
    for (const p of wiringProblems()) fail(p)
    for (const p of twinPageProblems()) fail(p)
    proveGuards(model)
  } else if (problems.length) {
    console.error('❌ 模型不自洽，拒绝写入单源（先修上面的问题）')
  } else {
    mkdirSync(dirname(CANONICAL), { recursive: true })
    writeFileSync(CANONICAL, text)
    console.log(`✅ 已生成 ${CANONICAL.replace(ROOT, '').replace(/\\/g, '/')}（18 例 / 6 基案例）`)
    console.log('   下一步：npm run cases:sync 分发三站副本')
  }

  if (failed) process.exit(1)
  if (CHECK) console.log('✅ 组合画廊：单源新鲜、三站副本一致、接线完整、6 条非空证明全绿')
}

main().catch((err) => {
  console.error(`❌ 组合画廊生成器自身异常：${err?.stack ?? err}`)
  process.exit(1)
})
