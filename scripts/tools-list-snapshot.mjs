#!/usr/bin/env node
/**
 * `tools/list` 快照 —— 宿主实际收到的工具面（W2 的前置测量）。
 *
 * ## 为什么不是扫源码
 *
 * `check-tool-surface` / `tool-surface.spec` 断言的是**注册名单与描述标签**；宿主看到的
 * 是 SDK 把 Zod 对象转成 JSON Schema 之后的那一坨字节。派生方案（shared 权威 schema →
 * 工具入参）一旦落地，最可能的变化恰恰在这一层：`.describe()` 顺序、`.default()` 是否
 * 被渲染、嵌套 `$defs` 的名称。所以这份快照走**真** `McpServer` + `InMemoryTransport` +
 * **真** `client.listTools()`，与宿主拿到的是同一条链路。
 *
 * ## 用法
 *
 *   node scripts/tools-list-snapshot.mjs            # 写快照
 *   node scripts/tools-list-snapshot.mjs --check    # 与快照逐工具比对（漂移则退出码 1）
 *   node scripts/tools-list-snapshot.mjs --json     # 只打印摘要 JSON
 *
 * 快照落在 `packages/mcp-server/tools-list.snapshot.json`。
 *
 * **两个 profile 必须分开存**：front-door 不只隐藏 3 个工具，还会改写**描述与入参字段
 * 的 describe**（把「去调 generate_crud_from_config」换成「交给前门」），这是 AN-26 的
 * 有意行为。曾试图按工具名合并两份定义，`validate_config` 立刻冲突。为控制体积与 diff
 * 噪声，每个工具压成**一行紧凑 JSON**：改一个工具只动一行，审阅时展开那一行即可。
 *
 * ## 为什么从源码打包
 *
 * 读 `packages/mcp-server/build/` 会在没重建时**静默测旧代码**（记忆
 * `generated-artifacts-go-stale`）。这里用与 `check-tool-surface` 相同的 esbuild 单源，
 * 并用 `metafile` 自证没有命中 `shared/build`。
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ROOT } from './lib/front-door.mjs'

const SNAPSHOT = join(ROOT, 'packages', 'mcp-server', 'tools-list.snapshot.json')
const CHECK = process.argv.includes('--check')
const JSON_ONLY = process.argv.includes('--json')
const PROFILES = ['front-door', 'full']

const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-tools-list-'))
let measured
try {
  const entry = join(tmp, 'entry.ts')
  writeFileSync(
    entry,
    [
      "import { registerTools } from '../../packages/mcp-server/src/tools/index.ts'",
      "import { registerResources } from '../../packages/mcp-server/src/resources/index.ts'",
      "import { registerPrompts } from '../../packages/mcp-server/src/prompts/index.ts'",
      'export { registerTools, registerResources, registerPrompts }',
    ].join('\n'),
    'utf8',
  )

  const outfile = join(tmp, 'tools-list.mjs')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    metafile: true,
    alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
    external: ['@modelcontextprotocol/sdk', 'zod'],
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })
  const fromBuild = Object.keys(result.metafile.inputs).filter((p) => /shared[\\/]build[\\/]/.test(p))
  if (fromBuild.length) {
    console.error(`✗ 打包命中了 shared/build（${fromBuild.length} 个）：快照测到的是陈旧产物`)
    process.exit(1)
  }

  const mod = await import(pathToFileURL(outfile).href)
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js')
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')

  measured = { version: 1, profiles: {}, tools: {} }
  for (const profile of PROFILES) {
    const server = new McpServer({ name: 'es-plus-snapshot', version: '0.0.0' })
    mod.registerTools(server, profile)
    mod.registerResources(server, profile)
    mod.registerPrompts(server, profile)
    const [clientT, serverT] = InMemoryTransport.createLinkedPair()
    await server.connect(serverT)
    const client = new Client({ name: 'snapshot-client', version: '0.0.0' })
    await client.connect(clientT)
    const { tools } = await client.listTools()
    await client.close()
    await server.close()

    measured.profiles[profile] = tools.map((t) => t.name).sort()
    for (const t of tools) {
      measured.tools[t.name] ??= {}
      measured.tools[t.name][profile] = {
        description: t.description ?? '',
        inputSchema: t.inputSchema ?? {},
        ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
      }
    }
  }
  measured.tools = Object.fromEntries(Object.entries(measured.tools).sort(([a], [b]) => a.localeCompare(b)))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

/** 每个工具一行紧凑 JSON —— 改一个工具只动一行。 */
function serialize(snap) {
  const lines = []
  lines.push('{')
  lines.push(`  "version": ${snap.version},`)
  lines.push('  "profiles": {')
  const profs = Object.entries(snap.profiles)
  profs.forEach(([profile, names], i) => {
    lines.push(`    ${JSON.stringify(profile)}: ${JSON.stringify(names)}${i < profs.length - 1 ? ',' : ''}`)
  })
  lines.push('  },')
  lines.push('  "tools": {')
  const entries = Object.entries(snap.tools)
  entries.forEach(([name, perProfile], i) => {
    lines.push(`    ${JSON.stringify(name)}: ${JSON.stringify(perProfile)}${i < entries.length - 1 ? ',' : ''}`)
  })
  lines.push('  }')
  lines.push('}')
  return lines.join('\n') + '\n'
}

/** 摘要：宿主每轮要读多少字节，按工具降序。 */
function summary(snap) {
  const out = {}
  for (const profile of PROFILES) {
    const names = snap.profiles[profile] ?? []
    let desc = 0
    let schema = 0
    const per = []
    for (const name of names) {
      const t = snap.tools[name]?.[profile]
      if (!t) continue
      const d = (t.description ?? '').length
      const s = JSON.stringify(t.inputSchema ?? {}).length
      desc += d
      schema += s
      per.push({ name, kb: (d + s) / 1024 })
    }
    per.sort((a, b) => b.kb - a.kb)
    out[profile] = {
      tools: names.length,
      kb: +((desc + schema) / 1024).toFixed(1),
      descriptionKb: +(desc / 1024).toFixed(1),
      schemaKb: +(schema / 1024).toFixed(1),
      largest: per.slice(0, 5).map((x) => `${x.name} ${x.kb.toFixed(1)} KB`),
    }
  }
  return out
}

const summaryOf = summary(measured)

if (JSON_ONLY) {
  console.log(JSON.stringify(summaryOf, null, 2))
  process.exit(0)
}

if (!CHECK) {
  writeFileSync(SNAPSHOT, serialize(measured), 'utf8')
  console.log(`[tools-list-snapshot] 已写入 packages/mcp-server/tools-list.snapshot.json`)
  for (const [profile, s] of Object.entries(summaryOf)) {
    console.log(`  ${profile}: ${s.tools} 个工具，${s.kb} KB（描述 ${s.descriptionKb} / schema ${s.schemaKb}）`)
    console.log(`    最大：${s.largest.join('、')}`)
  }
  process.exit(0)
}

// --check：逐工具比对，报告「新增 / 删除 / 定义变化」及字节增量。
if (!existsSync(SNAPSHOT)) {
  console.error(`✗ 快照不存在：${SNAPSHOT}\n  先运行 node scripts/tools-list-snapshot.mjs 生成基线`)
  process.exit(1)
}
const prev = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
const failures = []
const prevNames = new Set(Object.keys(prev.tools ?? {}))
const nextNames = new Set(Object.keys(measured.tools))
for (const name of [...nextNames].filter((n) => !prevNames.has(n)).sort()) failures.push(`新增工具 ${name}`)
for (const name of [...prevNames].filter((n) => !nextNames.has(n)).sort()) failures.push(`删除工具 ${name}`)
for (const name of [...nextNames].filter((n) => prevNames.has(n)).sort()) {
  for (const profile of PROFILES) {
    const before = prev.tools[name]?.[profile]
    const after = measured.tools[name]?.[profile]
    if (before === undefined && after === undefined) continue
    if (before === undefined) {
      failures.push(`${profile}: ${name} 新增（该 profile 此前不可见）`)
      continue
    }
    if (after === undefined) {
      failures.push(`${profile}: ${name} 消失`)
      continue
    }
    const b = JSON.stringify(before)
    const a = JSON.stringify(after)
    if (b === a) continue
    const delta = (a.length - b.length) / 1024
    const fields = ['description', 'inputSchema', 'outputSchema'].filter(
      (k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null),
    )
    failures.push(`${profile}: ${name} 定义变化：${fields.join(' / ')}（${delta >= 0 ? '+' : ''}${delta.toFixed(1)} KB）`)
  }
}
for (const profile of PROFILES) {
  const before = (prev.profiles?.[profile] ?? []).join(',')
  const after = (measured.profiles?.[profile] ?? []).join(',')
  if (before !== after) failures.push(`${profile} profile 成员变化`)
}

if (failures.length) {
  console.error(`[tools-list-snapshot] 与快照不一致（${failures.length} 处）：`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error('  —— 变更若是有意的，重跑本脚本覆盖快照并在 PR 里逐项审阅 diff。')
  process.exit(1)
}
for (const [profile, s] of Object.entries(summaryOf)) {
  console.log(`[tools-list-snapshot] ${profile}: ${s.tools} 个工具，${s.kb} KB —— 与快照一致 ✔`)
}
