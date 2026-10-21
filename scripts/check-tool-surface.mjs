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
 *   4. **引导面同源**：front-door 下没有任何已注册工具的描述（或 initialize 的
 *      instructions）还教宿主「去调」被隐藏的工具 —— 工具表少三个、文案却不改，
 *      宿主只会拿到 tool not found，且链路上没有任何运行时错误提示这是契约分叉。
 *      full 档反向断言指路**仍存在**，否则该循环会空转（把描述整体删掉也能通过）。
 *
 * 守卫直接**从源码打包**注册函数并调用（不是扫文件字符串），因此读到的就是
 * `registerTools` 真正会注册的东西；`metafile` 同时证明打包拉的是 `shared/src`。
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs'
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
      "import { buildInstructions } from '../../packages/mcp-server/src/instructions.ts'",
      'export function capture(profile) {',
      '  const seen = []',
      '  const fake = { tool: (name, description) => seen.push({ name, description }) }',
      '  registerTools(fake, profile)',
      '  return seen',
      '}',
      'export { resolveToolProfile, buildInstructions }',
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

  // 6. 引导面与工具面同源：front-door 下**不得有任何已注册工具描述**把宿主指向被隐藏的
  //    工具。工具表少三个、描述却教宿主「去调它」，宿主只会拿到 tool not found，而整条
  //    链路上没有任何运行时错误提示这是契约分叉（与 prompts/resources 的 B2 同一类缺陷）。
  for (const t of frontDoor) {
    for (const hidden of FRONT_DOOR_HIDDEN) {
      if ((t.description ?? '').includes(hidden)) {
        fail(`front-door 下 ${t.name} 的描述仍指向未注册的 ${hidden}`)
      }
    }
  }
  //    反向断言：full 档里这些指路**必须存在**，否则上面的循环是空转（描述被整体删掉
  //    也能「通过」）。
  for (const name of ['refine_config', 'ingest_schema', 'detect_project_target']) {
    const desc = byName.get(name) ?? ''
    if (!/(generate_crud_from_config|generate_crud_page)/.test(desc)) {
      fail(`full 档 ${name} 的描述丢失了「下一步交给哪个生成工具」的指路`)
    }
  }

  // 7. instructions 同源：front-door 正文不得再宣称被隐藏工具「仍可用」，且要给出档位说明。
  const insFull = mod.buildInstructions('full')
  const insFd = mod.buildInstructions('front-door')
  if (!insFull.includes('`generate_crud_from_config` remains available')) {
    fail('full 档 instructions 丢失了「高级路径仍可用」的原话')
  }
  if (insFd.includes('remains available')) {
    fail('front-door 档 instructions 仍宣称未注册的工具可用（与档位说明自相矛盾）')
  }
  if (!insFd.includes('are NOT registered')) {
    fail('front-door 档 instructions 缺少「哪些工具未注册」的说明')
  }

  // 8. 文档声明同源：工具数 / 资源类别数 / prompt 数与源码相等，且参考文档列全了工具名。
  //
  //    背景：`docs/why-es-plus` 长期写「8 个 tools + 4 类 resources」，站点 `mcp-server.md`
  //    只覆盖 15 个工具里的 7 个 —— 工具面早就变了，文案还停在 1.0。数字写在文档里没有
  //    守卫，就一定会漂（与 check-readme-claims 的契约类型数量同一类问题），故在这里按
  //    **运行时抓到的** fullNames 断言，而不是再抄一份名单。
  {
    const docText = (rel) => {
      const p = join(ROOT, rel)
      if (!existsSync(p)) {
        fail(`缺少应被断言的文档 ${rel}（若移到别处，请同步本守卫）`)
        return null
      }
      return readFileSync(p, 'utf-8')
    }

    const resourcesSrc = readFileSync(
      join(ROOT, 'packages', 'mcp-server', 'src', 'resources', 'index.ts'),
      'utf-8',
    )
    const resourceFamilies = (resourcesSrc.match(/^\s*register\w+Resources?\(/gm) ?? []).length
    const promptsDir = join(ROOT, 'packages', 'mcp-server', 'src', 'prompts')
    const promptNames = readdirSync(promptsDir)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
      .flatMap((f) => [
        ...readFileSync(join(promptsDir, f), 'utf-8').matchAll(/server\.prompt\(\s*"([^"]+)"/g),
      ].map((m) => m[1]))
    if (!resourceFamilies) fail('未能从 resources/index.ts 解析出资源类别数（结构变了请同步本守卫）')
    if (!promptNames.length) fail('未能从 prompts/*.ts 解析出 prompt 名（结构变了请同步本守卫）')

    const claims = [
      {
        file: 'docs/why-es-plus.md',
        re: new RegExp(
          `暴露\\s*${fullNames.length}\\s*个\\s*tools[、，]\\s*${resourceFamilies}\\s*类\\s*resources\\s*与\\s*${promptNames.length}\\s*个\\s*prompts`,
        ),
        want: `${fullNames.length} 个 tools、${resourceFamilies} 类 resources 与 ${promptNames.length} 个 prompts`,
      },
      {
        file: 'docs/why-es-plus.en.md',
        re: new RegExp(
          `exposes\\s*${fullNames.length}\\s*tools,\\s*${resourceFamilies}\\s*resource families and\\s*${promptNames.length}\\s*prompts`,
        ),
        want: `${fullNames.length} tools, ${resourceFamilies} resource families and ${promptNames.length} prompts`,
      },
      {
        file: 'es-plus-docs/src/docs/mcp-server.md',
        re: new RegExp(`\\*\\*${fullNames.length}\\s*个工具\\*\\*`),
        want: `${fullNames.length} 个工具`,
      },
      {
        file: 'es-plus-docs/src/docs/mcp-server.en.md',
        re: new RegExp(`\\*\\*${fullNames.length}\\s*tools\\*\\*`),
        want: `${fullNames.length} tools`,
      },
      {
        file: 'packages/mcp-server/README.md',
        re: new RegExp(`\\*\\*${fullNames.length}\\s*个工具\\*\\*`),
        want: `${fullNames.length} 个工具`,
      },
    ]
    for (const { file, re, want } of claims) {
      const text = docText(file)
      if (text === null) continue
      if (!re.test(text)) {
        fail(`${file} 未声明「${want}」（与当前工具面/资源/prompts 数量不一致，或是表述改了没同步本守卫）`)
      }
    }

    // 同一事实的两处数字（开头的「暴露 N 个 tools」与 7.1 的节标题）必须同源，
    // 否则改了正文没改标题，读者仍会看到「8 个 Tools」。
    for (const [file, re] of [
      ['docs/why-es-plus.md', /###\s*7\.1\s*MCP Server 暴露的\s*(\d+)\s*个\s*Tools/],
      ['docs/why-es-plus.en.md', /###\s*7\.1\s*The\s*(\d+)\s*MCP Server Tools/],
    ]) {
      const text = docText(file)
      if (text === null) continue
      const m = text.match(re)
      if (!m) {
        fail(`${file} 未找到 7.1 节的工具数量标题（若改了标题，请同步本守卫）`)
      } else if (Number(m[1]) !== fullNames.length) {
        fail(`${file} 的 7.1 标题写 ${m[1]} 个 Tools，实际注册 ${fullNames.length} 个`)
      }
    }

    // 参考文档必须逐个**列条目**（表格行或小节标题），而不是在正文里顺嘴提一句：
    // 只改总数、正文还漏着几个工具，读者照样找不到。用「提一句」作判据会被
    // 「上一段的复述」轻易满足，守卫也就失去分辨力。
    const listedAsEntry = (text, name) =>
      new RegExp(`^\\|\\s*\`?${name}\`?\\s*\\|`, 'm').test(text) ||
      new RegExp(`^#{2,6}\\s*[^\\n]*\\b${name}\\b`, 'm').test(text)
    for (const file of [
      'es-plus-docs/src/docs/mcp-server.md',
      'es-plus-docs/src/docs/mcp-server.en.md',
      'packages/mcp-server/README.md',
    ]) {
      const text = docText(file)
      if (text === null) continue
      const absent = fullNames.filter((n) => !listedAsEntry(text, n))
      if (absent.length) fail(`${file} 的正文没有为这些工具列出条目（表格行或小节）：${absent.join(', ')}`)
      const absentPrompts = promptNames.filter((n) => !listedAsEntry(text, n))
      if (absentPrompts.length) fail(`${file} 的正文没有为这些 prompt 列出条目：${absentPrompts.join(', ')}`)
    }
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
