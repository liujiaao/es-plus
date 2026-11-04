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
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
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
    '| `front-door` | 12 |',
    '无专用工具、无语料',
    '多处静默丢弃',
    '`rowkey` 在 compose 调用中未透传',
    '入参无 `columns`/`treeConfig`/`expandConfig`/`mergeConfig`/`tableBtns`',
    '**没有**顶层 `columns`',
    '未知键被静默剥离',
    '字段级 `render`/`formatter` 在片段表单中被静默丢弃',
  ]
  for (const s of STALE) if (doc.includes(s)) fail(`文档仍含过时表述：「${s}」`)

  // ── 4. 已落地的事实必须留在文档里 ─────────────────────────────────────
  const REQUIRED = [
    ['PRD 语料规模', '22 例'],
    ['ingest 的 TS 输入', 'TypeScript interface'],
    ['ingest 的 SQL 输入', 'SQL DDL'],
    ['信封透出', 'structuredContent'],
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

if (failures.length) {
  console.error(`\n✗ check:doc-drift —— ${failures.length} 处文档与源码不一致`)
  process.exit(1)
}
console.log('✅ check:doc-drift：工具计数/名单/边界/描述与源码一致。')
