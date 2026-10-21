#!/usr/bin/env node
/**
 * AN-26 —— 工具面收敛守卫。
 *
 * ## 为什么要守卫
 *
 * 工具面是两个相反方向的力：
 *   · 对宿主 LLM，**工具越多越难选**（“front door”的价值就在于把选择压成一次
 *     `surfaces` 填空）；
 *   · 对既有调用方，**删工具就是破坏**（MCP client 里写死的工具名会直接报错）。
 *
 * 于是本项只做三件事，并逐条钉住：
 *   1. **唯一前门**：只有 `generate_crud` 的描述带 `FRONT DOOR` 标签；
 *   2. **层级标签**：`generate_crud_from_config` = ADVANCED，
 *      `generate_crud_page` / `generate_crud_schema` = LEGACY FALLBACK；
 *   3. **profile 开关**：`ESPLUS_MCP_PROFILE=front-door` 隐藏 1 个高级 + 2 个 legacy，
 *      其余工具（含单面片段与前门给宿主指的支撑工具）一个不少；未设置/未知值 = full。
 *
 * 守卫直接**从源码打包**注册函数并调用（不是扫文件字符串），因此读到的就是
 * `registerTools` 真正会注册的东西；`metafile` 同时证明打包拉的是 `shared/src`。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ROOT } from './lib/front-door.mjs'

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

/** `full` 必须注册的完整名单（新增/删除工具时**显式**改这里，避免面悄悄漂移）。 */
const FULL_TOOLS = [
  'detect_project_target',
  'generate_crud',
  'generate_form',
  'generate_table',
  'generate_dialog',
  'generate_crud_page',
  'generate_crud_schema',
  'generate_crud_from_config',
  'validate_config',
  'list_form_types',
  'ingest_schema',
  'refine_config',
  'get_component_api',
  'scaffold_page',
  'doctor_page',
]

/** `front-door` 相对 `full` 隐藏的 3 个工具（1 个高级 + 2 个 legacy）。 */
const FRONT_DOOR_HIDDEN = ['generate_crud_from_config', 'generate_crud_page', 'generate_crud_schema']

const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-tool-surface-'))
try {
  const entry = join(tmp, 'entry.ts')
  writeFileSync(
    entry,
    [
      "import { registerTools, resolveToolProfile } from '../../packages/mcp-server/src/tools/index.ts'",
      'export function capture(profile) {',
      '  const seen = []',
      '  const fake = { tool: (name, description) => seen.push({ name, description }) }',
      '  registerTools(fake, profile)',
      '  return seen',
      '}',
      'export { resolveToolProfile }',
    ].join('\n'),
    'utf8',
  )

  const outfile = join(tmp, 'tool-surface.mjs')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    metafile: true,
    alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })

  const inputs = Object.keys(result.metafile.inputs)
  const fromBuild = inputs.filter((p) => /shared[\\/]build[\\/]/.test(p))
  if (fromBuild.length) {
    fail(`打包命中了 shared/build（${fromBuild.length} 个）：守卫会测到陈旧产物`)
  }

  const mod = await import(pathToFileURL(outfile).href)

  const full = mod.capture('full')
  const frontDoor = mod.capture('front-door')

  const namesOf = (list) => list.map((t) => t.name)
  const fullNames = namesOf(full)
  const fdNames = namesOf(frontDoor)

  // 1. full 的名单必须与登记表逐项相等（漏注册 / 多注册都要红）。
  const missing = FULL_TOOLS.filter((n) => !fullNames.includes(n))
  const extra = fullNames.filter((n) => !FULL_TOOLS.includes(n))
  if (missing.length) fail(`full profile 漏注册：${missing.join(', ')}`)
  if (extra.length) fail(`full profile 多注册（登记表未收录）：${extra.join(', ')}`)
  if (new Set(fullNames).size !== fullNames.length) {
    fail(`full profile 存在重复注册：${fullNames.length - new Set(fullNames).size} 个重名`)
  }

  // 2. front-door 必须恰好是 full 减去 3 个工具（不能顺手藏起单面片段/支撑工具）。
  const expectedFd = FULL_TOOLS.filter((n) => !FRONT_DOOR_HIDDEN.includes(n))
  const fdMissing = expectedFd.filter((n) => !fdNames.includes(n))
  const fdExtra = fdNames.filter((n) => !expectedFd.includes(n))
  if (fdMissing.length) fail(`front-door profile 漏注册：${fdMissing.join(', ')}`)
  if (fdExtra.length) fail(`front-door profile 不该注册：${fdExtra.join(', ')}`)
  for (const name of ['generate_form', 'generate_table', 'generate_dialog']) {
    if (!fdNames.includes(name)) {
      fail(`front-door profile 隐藏了单面片段工具 ${name}：前门描述明确让宿主在这种场景用它`)
    }
  }

  // 3. 唯一 FRONT DOOR 标签。
  const frontDoorLabel = full.filter((t) => /FRONT DOOR/.test(t.description ?? ''))
  if (frontDoorLabel.length !== 1) {
    fail(
      `含 \`FRONT DOOR\` 字样的工具应有且只有 1 个，实际 ${frontDoorLabel.length} 个` +
        (frontDoorLabel.length ? `（${frontDoorLabel.map((t) => t.name).join(', ')}）` : ''),
    )
  } else if (frontDoorLabel[0].name !== 'generate_crud') {
    fail(`\`FRONT DOOR\` 标签落在 ${frontDoorLabel[0].name} 上，应为 generate_crud`)
  }

  // 4. 层级标签。
  const byName = new Map(full.map((t) => [t.name, t.description ?? '']))
  if (!/^ADVANCED\b/.test(byName.get('generate_crud_from_config') ?? '')) {
    fail('generate_crud_from_config 的描述应以 ADVANCED 开头')
  }
  for (const name of ['generate_crud_page', 'generate_crud_schema']) {
    if (!/^LEGACY FALLBACK\b/.test(byName.get(name) ?? '')) {
      fail(`${name} 的描述应以 LEGACY FALLBACK 开头`)
    }
  }

  // 5. profile 解析：未设置 / 未知值 = full；大小写与空白不敏感。
  const cases = [
    [undefined, 'full'],
    ['', 'full'],
    ['full', 'full'],
    ['bogus', 'full'],
    ['front-door', 'front-door'],
    ['  FRONT-DOOR  ', 'front-door'],
  ]
  for (const [raw, want] of cases) {
    const got = mod.resolveToolProfile(raw)
    if (got !== want) fail(`resolveToolProfile(${JSON.stringify(raw)}) = ${got}，应为 ${want}`)
  }

  if (!failures.length) {
    console.log(
      `✅ 工具面收敛：唯一 FRONT DOOR（generate_crud）；ADVANCED 1 / LEGACY 2；` +
        `full ${fullNames.length} 个工具，front-door ${fdNames.length} 个（隐藏 ${FRONT_DOOR_HIDDEN.length} 个）`,
    )
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (failures.length) process.exit(1)
