#!/usr/bin/env node
/**
 * 场景路由器字节等价门禁（P2）。
 *
 * `generate_scene` 是「按场景定义」的新入口，旧工具（`generate_crud` /
 * `generate_table` / `generate_form` / `generate_dialog`）在 P2 期间仍是兼容面。
 * 两者必须对**同一份语料**产出**逐字节相同**的文本 —— 不是「差不多」，因为：
 *
 *   - 宿主可能在同一会话里交替使用两个入口；产物不同会让「换了个工具」看起来
 *     像模型退化了；
 *   - `check-scene-parity` 是 P3 把 eval 切到 `generate_scene` 的前置条件：
 *     切换入口不得改变任何一行的评分。
 *
 * ## 驱动方式
 *
 * 与 `check-front-door.mjs` 同一条路：esbuild 现打包**源码**（不是 `build/`），
 * 用假 server 捕获五个工具的真 handler，入参先按各自工具的真 Zod 形状解析
 * （与 MCP 客户端走同一道校验）。CRUD 侧的 `config → surfaces` 复用
 * `scripts/lib/front-door.mjs`，避免守卫自造第二份投影。
 *
 * ## 判据
 *
 * 279 条语料逐条：
 *   ① 旧工具 handler 与 `generate_scene` handler 都返回同一种 `isError` 状态；
 *   ② `content[0].text` 字节相等。
 *
 * 任何一条不等 → 打印文件名 + 首个差异位置 + 两侧上下文，退出码 1。
 *
 * 用法：`node scripts/check-scene-parity.mjs`
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { DEFAULT_SCENE, sceneOf } from './eval/scenes.mjs'
import {
  ROOT,
  deriveSurfaces,
  fieldProjector,
  frontDoorArgs,
} from './lib/front-door.mjs'

const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return n
}

function excerpt(text, at) {
  const from = Math.max(0, at - 60)
  return text.slice(from, at + 120).replace(/\n/g, '⏎')
}

async function captureTools() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-scene-parity-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "import { registerGenerateCrud } from '../../packages/mcp-server/src/tools/generate-crud.ts'",
        "import { registerGenerateScene } from '../../packages/mcp-server/src/tools/generate-scene.ts'",
        "import { registerGenerateTable } from '../../packages/mcp-server/src/tools/generate-table.ts'",
        "import { registerGenerateForm } from '../../packages/mcp-server/src/tools/generate-form.ts'",
        "import { registerGenerateDialog } from '../../packages/mcp-server/src/tools/generate-dialog.ts'",
        "import { surfaceFieldSchema } from '../../packages/mcp-server/src/tools/_fragment-shapes.ts'",
        "import { z } from 'zod'",
        'function capture(register) {',
        '  let cap = null',
        '  const fake = { tool: (name, desc, shape, handler) => { cap = { name, desc, shape, handler } } }',
        '  register(fake)',
        '  return cap',
        '}',
        'export function captureAll() {',
        '  return {',
        '    crud: capture(registerGenerateCrud),',
        '    scene: capture(registerGenerateScene),',
        '    table: capture(registerGenerateTable),',
        '    form: capture(registerGenerateForm),',
        '    dialog: capture(registerGenerateDialog),',
        '    surfaceFieldSchema,',
        '  }',
        '}',
        "export function parseShape(shape, args) { return z.object(shape).passthrough().parse(args) }",
      ].join('\n'),
      'utf8',
    )
    const outfile = join(tmp, 'scene-parity.mjs')
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
    return {
      mod: await import(pathToFileURL(outfile).href),
      fromBuild: inputs.filter((p) => /shared[\\/]build[\\/]/.test(p)),
      fromSrc: inputs.filter((p) => /shared[\\/]src[\\/]/.test(p)),
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    }
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

async function main() {
  const { mod, cleanup, fromBuild, fromSrc } = await captureTools()
  try {
    if (fromBuild.length > 0) {
      console.error(`✗ 打包命中了 shared/build（${fromBuild.length} 个）：守卫会测到陈旧产物`)
      process.exitCode = 1
      return
    }
    if (fromSrc.length === 0) {
      console.error('✗ 打包没有拉到 shared/src —— 等价性断言测不到源码')
      process.exitCode = 1
      return
    }

    const { crud, scene, table, form, dialog, surfaceFieldSchema } = mod.captureAll()
    for (const [label, cap] of Object.entries({ crud, scene, table, form, dialog })) {
      if (!cap) {
        console.error(`✗ 没有捕获到 ${label} 的注册`)
        process.exitCode = 1
        return
      }
    }

    const project = fieldProjector(new Set(Object.keys(surfaceFieldSchema.shape)))
    const fragmentTools = { table, form, dialog }
    const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()

    let compared = 0
    let crudCount = 0
    let fragmentCount = 0
    const failures = []

    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
      const sceneId = sceneOf(raw)

      let oldCap
      let oldArgs
      if (sceneId === DEFAULT_SCENE) {
        const surfaces = deriveSurfaces(raw.config, project)
        oldArgs = frontDoorArgs(raw.config, surfaces)
        oldCap = crud
        crudCount++
      } else {
        oldCap = fragmentTools[sceneId]
        if (!oldCap) {
          failures.push(`${file}: 场景 ${sceneId} 没有对应的旧工具（注册表/门禁不一致）`)
          continue
        }
        oldArgs = { ...(raw.config || {}), target: raw.target }
        fragmentCount++
      }

      const oldParsed = mod.parseShape(oldCap.shape, oldArgs)
      const oldRes = await oldCap.handler(oldParsed)
      const oldText = oldRes.content?.[0]?.text ?? ''

      // 新入口必须从**原始入参**解析一次。若把已解析的 `oldParsed` 再喂给场景
      // 校验器，`TableBtnSchema` 的 `.transform(normalizeTableBtn)` 会跑第二次，
      // 只是键序变化、语义不变 —— 那是测量产物的假差异，不是产物不等价。
      const sceneParsed = mod.parseShape(scene.shape, { scene: sceneId, intent: oldArgs })
      const newRes = await scene.handler(sceneParsed)
      const newText = newRes.content?.[0]?.text ?? ''

      if (!!oldRes.isError !== !!newRes.isError) {
        failures.push(
          `${file}: isError 状态不同（旧=${!!oldRes.isError}，新=${!!newRes.isError}）` +
            `\n    旧: ${oldText.slice(0, 160).replace(/\n/g, '⏎')}` +
            `\n    新: ${newText.slice(0, 160).replace(/\n/g, '⏎')}`,
        )
        continue
      }
      if (oldText !== newText) {
        const at = firstDiff(oldText, newText)
        failures.push(
          `${file}: 产物不逐字节相等（首个差异 @${at}）` +
            `\n    旧: ${excerpt(oldText, at)}` +
            `\n    新: ${excerpt(newText, at)}`,
        )
        continue
      }
      compared++
    }

    if (failures.length > 0) {
      console.error(`\n✗ 场景路由器与旧工具不等价：${failures.length} 条失败（已比较 ${compared}/${files.length}）\n`)
      for (const f of failures.slice(0, 8)) console.error(`  - ${f}`)
      if (failures.length > 8) console.error(`  …另有 ${failures.length - 8} 条`)
      process.exitCode = 1
      return
    }

    console.log(
      `✓ 场景路由器字节等价：${compared}/${files.length} 条（crud ${crudCount} / 片段 ${fragmentCount}）`,
    )
  } finally {
    cleanup()
  }
}

main().catch((err) => {
  console.error('[scene-parity] 致命：', err)
  process.exit(1)
})
