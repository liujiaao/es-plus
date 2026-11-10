#!/usr/bin/env node
/**
 * P8 —— 文档漂移守卫（内部架构手册 vs 源码事实）。
 *
 * ## 为什么需要它
 *
 * `packages/mcp-server/AI-NATIVE-ARCHITECTURE.md` 是宿主/维护者判断能力的依据。
 * 2026-11 的复核发现它至少 5 处与源码相反：工具数写 15（实际 full 17 / front-door 14）、
 * PRD 写「无语料」（实际 22 例 + 观测腿）、片段表格写「无 tree/expand」（实际
 * `tableOptions` 已收 vxe 富树/展开）、未知键写「静默剥离」（实际已在边界报错并给
 * did-you-mean）、`rowkey` 写「未透传」（实际已并入并透传）。
 *
 * 这类漂移不会让任何测试变红，却会让「宣称的能力」与「交付的能力」永久分叉 ——
 * 正是本仓反复出现的失败形态。本守卫把**可机器核对的事实**钉死：
 *
 *   1. 工具计数与工具名单（从源码打包 `registerTools` 后实际捕获，不扫字符串）；
 *   2. 过时措辞不得回流；
 *   3. 已落地的事实必须留在文档里；
 *   4. 工具描述（tools/list 里宿主真正读到的第一句）不得与代码事实相反。
 *
 * 退出码：0 = 文档与源码一致；1 = 有漂移。
 */
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ROOT } from './lib/front-door.mjs'

const DOC = join(ROOT, 'packages', 'mcp-server', 'AI-NATIVE-ARCHITECTURE.md')
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

let doc
try {
  doc = readFileSync(DOC, 'utf8')
} catch (err) {
  console.error(`✗ 读不到 ${DOC}: ${err.message}`)
  process.exit(1)
}

const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-doc-drift-'))
try {
  const entry = join(tmp, 'entry.ts')
  writeFileSync(
    entry,
    [
      "import { registerTools } from '../../packages/mcp-server/src/tools/index.ts'",
      "import { INGEST_KINDS } from '@es-plus/shared'",
      'export { INGEST_KINDS }',
      'export function capture(profile) {',
      '  const seen = []',
      '  const fake = { tool: (name, description) => seen.push({ name, description }) }',
      '  registerTools(fake, profile)',
      '  return seen',
      '}',
    ].join('\n'),
    'utf8',
  )

  const outfile = join(tmp, 'doc-drift.mjs')
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })

  const mod = await import(pathToFileURL(outfile).href)
  const full = mod.capture('full')
  const frontDoor = mod.capture('front-door')
  const names = full.map((t) => t.name)
  const byName = Object.fromEntries(full.map((t) => [t.name, t.description ?? '']))

  // ── 1. 计数（从源码实际捕获，不读常量） ────────────────────────────────
  const heading = `## 4. 工具手册（full ${full.length} / front-door ${frontDoor.length}）`
  if (!doc.includes(heading)) fail(`缺少与源码一致的章节标题：${heading}`)
  if (!doc.includes(`| \`full\`（**默认**） | ${full.length} |`)) {
    fail(`profile 表里 full 注册数不是 ${full.length}`)
  }
  if (!doc.includes(`| \`front-door\` | ${frontDoor.length} |`)) {
    fail(`profile 表里 front-door 注册数不是 ${frontDoor.length}`)
  }

  // ── 2. 名单：每个已注册工具都必须在文档里出现 ─────────────────────────
  for (const name of names) {
    if (!doc.includes(`\`${name}\``)) fail(`文档未提及已注册工具 ${name}`)
  }

  // ── 3. 过时措辞不得回流（每条都对应一次已核实的源码事实） ──────────────
  const STALE = [
    '工具手册（15 个）',
    '| `full`（**默认**） | 15 |',
    // 不要把 `| \`front-door\` | N |` 钉进这张表：N 会随工具面变化（本条曾钉死 12，
    // 2026-11-10 W3 收缩后 12 变成**正确值**，静态黑名单反而把正确的文档判红）。
    // profile 表的两行数字已由上面第 1 段的动态断言覆盖。
    '无专用工具、无语料',
    '多处静默丢弃',
    '`rowkey` 在 compose 调用中未透传',
    '入参无 `columns`/`treeConfig`/`expandConfig`/`mergeConfig`/`tableBtns`',
    '**没有**顶层 `columns`',
    '未知键被静默剥离',
    '字段级 `render`/`formatter` 在片段表单中被静默丢弃',
    // P8 复核：ASCII 图 / 文件地图 / 信封适用范围曾与源码相反（14 工具、7 族资源、
    // 「生成类工具 2–10 全挂信封」）。这四处当时守卫只查 §4 标题与 profile 表，抓不到。
    '`tools    14 个`',
    '14 工具注册',
    'resources 7 族',
    '7 族资源',
    'prompts   2 个',
    '生成类工具（2–10）',
  ]
  for (const s of STALE) if (doc.includes(s)) fail(`文档仍含过时表述：「${s}」`)

  // ── 3b. 资源族 / prompt / ASCII 图 / 文件地图的计数从源码数出来 ──────────
  // 这些数字以前只活在图上，没有任何门禁；P8 复核时三处全错却全绿。
  const resourcesIdx = readFileSync(join(ROOT, 'packages', 'mcp-server', 'src', 'resources', 'index.ts'), 'utf8')
  const promptsIdx = readFileSync(join(ROOT, 'packages', 'mcp-server', 'src', 'prompts', 'index.ts'), 'utf8')
  const countCalls = (source, re) => (source.match(re) ?? []).length
  const resourceFamilies = countCalls(resourcesIdx, /^\s*register\w+Resources?\(server[,)]/gm)
  const promptCount = countCalls(promptsIdx, /^\s*register\w+Prompt\(server[,)]/gm)
  const asciiTools = doc.match(/· tools\s+(\d+) 个（full）/)?.[1]
  if (asciiTools !== String(full.length)) {
    fail(`ASCII 图的工具数写的是 ${asciiTools ?? '(缺失)'}，源码注册 ${full.length}（full profile）`)
  }
  if (!doc.includes(`resources ${resourceFamilies} 族`)) {
    fail(`文档没有写 resources ${resourceFamilies} 族（源码 registerResources 调用了 ${resourceFamilies} 个家族）`)
  }
  if (!doc.includes(`| \`src/resources/*\` | ${resourceFamilies} 族资源 |`)) {
    fail(`文件地图里 src/resources/* 的资源族数不是 ${resourceFamilies}`)
  }
  const asciiPrompts = doc.match(/· prompts\s+(\d+) 个/)?.[1]
  if (asciiPrompts !== String(promptCount)) {
    fail(`ASCII 图的 prompt 数写的是 ${asciiPrompts ?? '(缺失)'}，源码注册 ${promptCount} 个`)
  }
  if (!doc.includes(`| \`src/prompts/*\` | ${promptCount} 个 prompt |`)) {
    fail(`文件地图里 src/prompts/* 的 prompt 数不是 ${promptCount}`)
  }
  if (!doc.includes(`| \`src/tools/index.ts\` | ${full.length} 工具注册`)) {
    fail(`文件地图里 src/tools/index.ts 的工具数不是 ${full.length}（full profile）`)
  }

  // ── 3c. 信封适用范围：以源码里真正调用 withEnvelope 的工具为准 ─────────
  const toolsDir = join(ROOT, 'packages', 'mcp-server', 'src', 'tools')
  const envelopeTools = readdirSync(toolsDir)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .filter((f) => readFileSync(join(toolsDir, f), 'utf8').includes('withEnvelope('))
    .map((f) => f.replace(/^generate-/, 'generate_').replace(/\.ts$/, '').replace(/-/g, '_'))
    .filter((n) => names.includes(n))
    .sort()
  const envelopeNote = doc.split(/\n\n+/).find((p) => p.includes('structuredContent') && p.includes('只有**带场景产物'))
  if (!envelopeNote) {
    fail('文档缺少「信封只挂在哪些工具上」的适用范围说明')
  } else {
    for (const name of envelopeTools) {
      if (!envelopeNote.includes(`\`${name}\``)) fail(`信封范围说明漏了实际调用 withEnvelope 的工具 ${name}`)
    }
    for (const name of ['generate_form', 'generate_table', 'generate_dialog', 'generate_crud_from_config']) {
      if (!envelopeNote.includes(`\`${name}\``)) {
        fail(`信封范围说明没有点名不挂信封的生成入口 ${name}`)
      }
    }
  }

  // ── 3b+. ingest 的输入形态从源码派生 ───────────────────────────────────
  // 此前只钉住 TS / SQL 两个词 —— 新增一种输入而不改文档时守卫不会红。现在按
  // `INGEST_KINDS`（与 `z.enum` 同一常量）逐项要求文档出现对应词条。
  const INGEST_DOC_TOKEN = {
    openapi: 'OpenAPI',
    jsonSchema: 'JSON Schema',
    'sample-json': '样例 JSON',
    'ts-interface': 'TypeScript interface',
    'sql-ddl': 'SQL DDL',
  }
  for (const kind of mod.INGEST_KINDS) {
    const token = INGEST_DOC_TOKEN[kind]
    if (!token) fail(`ingest 输入形态 ${kind} 没有对应的文档词条（守卫需登记）`)
    else if (!doc.includes(token)) fail(`文档未声明 ingest 支持的输入形态 ${kind}（「${token}」）`)
  }

  const REQUIRED = [
    ['PRD 语料规模', '22 例'],
    ['信封透出', 'structuredContent'],
    ['信封形状声明（P8 复核）', 'outputSchema'],
    ['唯一前门', 'generate_scene'],
    ['组合页', 'generate_composition'],
    ['兼容入口标签', 'COMPAT ENTRY'],
    ['片段表格的真实边界', 'vxe 富树'],
    ['片段表格词汇对齐（P10）', 'sanitizeExplicitColumns'],
    ['能力台账协议', 'es-plus.capabilities@1'],
    ['能力台账资源', 'esplus://capabilities'],
  ]
  for (const [label, needle] of REQUIRED) {
    if (!doc.includes(needle)) fail(`文档缺少已落地事实（${label}）：「${needle}」`)
  }

  // ── 5. 工具描述是引导面的一部分，必须与代码事实一致 ────────────────────
  const tableDesc = byName.generate_table ?? ''
  if (!/treeConfig/.test(tableDesc)) fail('generate_table 描述没有列出已支持的 tableOptions.treeConfig')
  if (!/expandConfig/.test(tableDesc)) fail('generate_table 描述没有列出已支持的 tableOptions.expandConfig')
  if (!/tableBtns/.test(tableDesc) || !/generate_scene/.test(tableDesc)) {
    fail("generate_table 描述没有说明 tableBtns 是唯一不支持的表键并指向 generate_scene(scene='crud')")
  }
  const formDesc = byName.generate_form ?? ''
  if (!/render/.test(formDesc) || !/NOT consumed/.test(formDesc)) {
    fail('generate_form 描述没有说明字段级 render 不被消费')
  }
  for (const name of ['generate_scene', 'generate_crud', 'generate_composition']) {
    if (!/structuredContent/.test(byName[name] ?? '')) {
      fail(`${name} 描述没有说明产物信封通过 structuredContent 返回`)
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

// ── 6. 站点文档的过时措辞（W1-2）────────────────────────────────────────
//
// 此前的黑名单只扫 mcp-server 的架构手册，而 W1-2 那两处与源码相反的表述活在
// **站点文档**里（permission-i18n.md / faq.md 写「未传 permission 时所有按钮默认
// 显示、permissionValue 被忽略」，实际 field-resolver 是 fail-closed）。Guard 的
// 覆盖面比它的名字窄，等于没有守卫 —— 这里把站点文档源纳入同一张黑名单。
//
// 只扫 `es-plus-docs/src/docs/*.md`（源），不扫 `public/md`（由 llms:gen 生成的
// 镜像，同一句会被报两次）。
const SITE_DOC_DIR = join(ROOT, 'es-plus-docs', 'src', 'docs')
const SITE_STALE = [
  '所有按钮默认显示',
  '`permissionValue` 被忽略',
  '`permissionValue` 字段会被忽略',
]
const siteDocs = readdirSync(SITE_DOC_DIR).filter((n) => n.endsWith('.md'))
if (!siteDocs.length) fail(`站点文档目录为空或路径变了：${SITE_DOC_DIR}`)
for (const name of siteDocs) {
  const text = readFileSync(join(SITE_DOC_DIR, name), 'utf8')
  for (const stale of SITE_STALE) {
    if (text.includes(stale)) {
      fail(`站点文档 ${name} 仍含过时表述：「${stale}」（未配置 permission 时是 fail-closed，见 W1-2）`)
    }
  }
}
// 正向断言：更正后的语义必须留在文档里，否则「删掉旧句」也能让黑名单变绿。
for (const name of ['permission-i18n.md', 'faq.md']) {
  const text = readFileSync(join(SITE_DOC_DIR, name), 'utf8')
  if (!text.includes('fail-closed')) {
    fail(`站点文档 ${name} 缺少 fail-closed 语义说明（W1-2 的正确表述不能只靠删旧句）`)
  }
}

if (failures.length) {
  console.error(`\n✗ check:doc-drift —— ${failures.length} 处文档与源码不一致`)
  process.exit(1)
}
console.log('✅ check:doc-drift：工具计数/名单/边界/描述与源码一致；站点文档无已回流的过时措辞。')
