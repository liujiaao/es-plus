#!/usr/bin/env node
/**
 * 产物信封门禁（P5c）—— `es-plus.artifact@1`。
 *
 * ## 判据
 *
 * 对**全部** golden 语料（279 条）逐条：
 *   ① `emitSceneArtifact(plan).text` 与 `emitScene(plan).text` **逐字节相等**
 *      （信封是附加视图，不许改变入口字节）；
 *   ② 成功分支必有信封，失败分支必无信封；
 *   ③ 信封身份字段自洽：`contract` 是版本字面量、`scene` 与计划一致、
 *      `artifact` ∈ `ARTIFACT_KINDS` 且 `runtimeOf()` 认识、`target` 合法、
 *      `mode` 与场景/artifact 的轴一致；
 *   ④ `files` 非空、路径唯一、`language` 与扩展名自洽、每份 `code` 都真的出现在
 *      返回文本里（信封不是另编的一份代码）；
 *   ⑤ 指纹 16 位十六进制、同输入两次相同；改一个字节（内存里）指纹必变 —— 非空证明。
 *
 * 另外在内存里断言 `buildArtifactEnvelope` 拒绝空 `files` / 重复路径 —— 这两类错
 * 会让「信封说有几份文件」与宿主实际拿到的对不上。
 *
 * ## 驱动方式
 *
 * 与 `check-scene-parity.mjs` 同一条路：esbuild 现打包**源码**（命中 shared/build
 * 即判红），用 golden 语料的原始 config 装配场景计划；不调用任何 MCP handler。
 *
 * 用法：`node scripts/check-artifact-envelope.mjs`
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { DEFAULT_SCENE, sceneOf } from './eval/scenes.mjs'
import { ROOT, deriveSurfaces, fieldProjector, frontDoorArgs } from './lib/front-door.mjs'

const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const TARGETS = new Set(['vue3', 'vue2', 'antdv'])
const EXT_OF = { vue: '.vue', typescript: '.ts', javascript: '.js', tsx: '.tsx', jsx: '.jsx' }
const FINGERPRINT_RE = /^[0-9a-f]{16}$/

let failures = 0
function fail(message) {
  failures++
  console.error(`  ✗ ${message}`)
}

async function loadShared() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-artifact-envelope-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "export { emitScene, emitSceneArtifact } from '../../packages/shared/src/scene/emit.ts'",
        "export { ARTIFACT_KINDS, SCENE_REGISTRY, sceneContract } from '../../packages/shared/src/scene/registry.ts'",
        "export { ARTIFACT_CONTRACT_VERSION, buildArtifactEnvelope, fingerprintArtifact } from '../../packages/shared/src/scene/artifact.ts'",
        "export { runtimeOf } from '../../packages/shared/src/scene/runtime.ts'",
        'export { surfaceFieldSchema } from "../../packages/mcp-server/src/tools/_fragment-shapes.ts"',
      ].join('\n'),
      'utf8',
    )
    const outfile = join(tmp, 'artifact-envelope.mjs')
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

function planOf(raw, project, mod) {
  const scene = sceneOf(raw)
  if (scene === DEFAULT_SCENE) {
    const surfaces = deriveSurfaces(raw.config, project)
    return { scene, plan: { scene, intent: frontDoorArgs(raw.config, surfaces) } }
  }
  return { scene, plan: { scene, intent: { ...(raw.config || {}), target: raw.target } } }
}

function checkEnvelope(file, plan, envelope, text, mod) {
  const { ARTIFACT_CONTRACT_VERSION, ARTIFACT_KINDS, runtimeOf } = mod
  if (envelope.contract !== ARTIFACT_CONTRACT_VERSION) {
    fail(`${file}: contract=${JSON.stringify(envelope.contract)}，期望 ${ARTIFACT_CONTRACT_VERSION}`)
  }
  if (envelope.scene !== plan.scene) {
    fail(`${file}: envelope.scene=${envelope.scene}，计划场景=${plan.scene}`)
  }
  if (!ARTIFACT_KINDS.includes(envelope.artifact)) {
    fail(`${file}: artifact=${JSON.stringify(envelope.artifact)} 不在 ARTIFACT_KINDS`)
  } else {
    try {
      runtimeOf(envelope.artifact)
    } catch (err) {
      fail(`${file}: runtimeOf(${envelope.artifact}) 抛错：${err.message}`)
    }
  }
  if (!TARGETS.has(envelope.target)) {
    fail(`${file}: target=${JSON.stringify(envelope.target)} 不是合法 target`)
  }

  const intent = plan.intent || {}
  if (plan.scene === 'crud') {
    const expectedMode = intent.mode ?? 'schema'
    if (envelope.mode !== expectedMode) {
      fail(`${file}: mode=${JSON.stringify(envelope.mode)}，期望 ${expectedMode}（crud）`)
    }
    if (envelope.artifact !== 'crud-page' && envelope.mode !== 'sfc') {
      fail(`${file}: crud 片段包（artifact=${envelope.artifact}）的 mode 必须是 sfc，实际 ${envelope.mode}`)
    }
  } else if (plan.scene === 'dialog') {
    const expectedMode = intent.mode ?? 'composable'
    if (envelope.mode !== expectedMode) {
      fail(`${file}: mode=${JSON.stringify(envelope.mode)}，期望 ${expectedMode}（dialog）`)
    }
    const expectedArtifact = expectedMode === 'component' ? 'dialog-component' : 'dialog-composable'
    if (envelope.artifact !== expectedArtifact) {
      fail(`${file}: artifact=${envelope.artifact}，期望 ${expectedArtifact}`)
    }
  } else if (envelope.mode !== null) {
    fail(`${file}: ${plan.scene} 场景没有模式轴，mode 必须是 null，实际 ${JSON.stringify(envelope.mode)}`)
  }

  if (!Array.isArray(envelope.files) || envelope.files.length === 0) {
    fail(`${file}: files 为空`)
    return
  }
  const paths = new Set()
  for (const f of envelope.files) {
    if (paths.has(f.path)) fail(`${file}: 重复文件路径 ${f.path}`)
    paths.add(f.path)
    if (!f.code) fail(`${file}: ${f.path} 的 code 为空`)
    if (!text.includes(f.code)) fail(`${file}: ${f.path} 的 code 不在返回文本里（信封与文本不同源）`)
    if (EXT_OF[f.language] !== f.path.slice(f.path.lastIndexOf('.'))) {
      fail(`${file}: ${f.path} 的扩展名与 language=${f.language} 不自洽`)
    }
  }
  if (!FINGERPRINT_RE.test(envelope.fingerprint)) {
    fail(`${file}: fingerprint=${JSON.stringify(envelope.fingerprint)} 不是 16 位十六进制`)
  }
}

function checkStructuralGuards(mod) {
  const { buildArtifactEnvelope } = mod
  const draft = {
    scene: 'form',
    artifact: 'form',
    target: 'vue3',
    mode: null,
    files: [{ path: 'FormBlock.vue', code: '<template />', language: 'vue' }],
    config: { a: 1, b: 2 },
    warnings: [],
  }
  const throws = (fn) => {
    try {
      fn()
      return false
    } catch {
      return true
    }
  }
  if (!throws(() => buildArtifactEnvelope({ ...draft, files: [] }))) {
    fail('结构守卫：空 files 必须抛错')
  }
  if (
    !throws(() =>
      buildArtifactEnvelope({
        ...draft,
        files: [...draft.files, { ...draft.files[0] }],
      }),
    )
  ) {
    fail('结构守卫：重复文件路径必须抛错')
  }
  if (throws(() => buildArtifactEnvelope({ ...draft, artifact: 'nope' }))) {
    // expected to throw
  } else {
    fail('结构守卫：未知 artifact 必须抛错')
  }

  // 指纹非空证明：对象键序不同 → 同指纹；改一个字节 → 指纹变。
  const a = buildArtifactEnvelope(draft)
  const reordered = buildArtifactEnvelope({ ...draft, config: { b: 2, a: 1 } })
  if (a.fingerprint !== reordered.fingerprint) fail('指纹必须与对象键序无关')
  const changed = buildArtifactEnvelope({
    ...draft,
    files: [{ ...draft.files[0], code: '<template /> ' }],
  })
  if (a.fingerprint === changed.fingerprint) fail('非空证明：改一个字节后指纹必须变化')
  return a.fingerprint
}

async function main() {
  const { mod, cleanup, fromBuild, fromSrc } = await loadShared()
  try {
    if (fromBuild.length > 0) {
      console.error(`✗ 打包命中了 shared/build（${fromBuild.length} 个）：守卫会测到陈旧产物`)
      process.exitCode = 1
      return
    }
    if (fromSrc.length === 0) {
      console.error('✗ 打包没有拉到 shared/src —— 信封断言测不到源码')
      process.exitCode = 1
      return
    }

    const project = fieldProjector(new Set(Object.keys(mod.surfaceFieldSchema.shape)))
    const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
    const byScene = { crud: 0, table: 0, form: 0, dialog: 0 }
    let withEnvelope = 0
    let errorCases = 0
    const fingerprints = new Map()

    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
      const { scene, plan } = planOf(raw, project, mod)
      const plain = mod.emitScene(plan)
      const rich = mod.emitSceneArtifact(plan)

      if (plain.text !== rich.text) {
        fail(`${file}: emitScene 与 emitSceneArtifact 文本不等（信封改变了入口字节）`)
        continue
      }
      if (!!plain.isError !== !!rich.isError) {
        fail(`${file}: emitScene 与 emitSceneArtifact 的 isError 不一致`)
        continue
      }
      byScene[scene] += 1

      if (rich.isError) {
        errorCases++
        if (rich.envelope) fail(`${file}: isError 分支不该有信封`)
        continue
      }
      if (!rich.envelope) {
        fail(`${file}: 成功分支没有信封`)
        continue
      }
      withEnvelope++
      checkEnvelope(file, plan, rich.envelope, rich.text, mod)

      // 同输入两次必同指纹
      const again = mod.emitSceneArtifact(plan)
      if (again.envelope && again.envelope.fingerprint !== rich.envelope.fingerprint) {
        fail(`${file}: 同一输入两次发射的指纹不同（非确定性）`)
      }
      const prev = fingerprints.get(rich.envelope.fingerprint)
      if (prev) fail(`${file}: 与 ${prev} 指纹相同（不同语料撞指纹）`)
      else fingerprints.set(rich.envelope.fingerprint, file)
    }

    const seeded = checkStructuralGuards(mod)

    if (failures > 0) {
      console.error(`\n✗ 产物信封门禁：${failures} 条失败\n`)
      process.exitCode = 1
      return
    }

    console.log(
      `✓ 产物信封：${withEnvelope}/${files.length} 条带信封` +
        `（crud ${byScene.crud} / table ${byScene.table} / form ${byScene.form} / dialog ${byScene.dialog}）` +
        `，${errorCases} 条错误分支无信封，${fingerprints.size} 个唯一指纹` +
        `；结构守卫 3 条 + 指纹非空证明（seed ${seeded}）✅`,
    )
  } finally {
    cleanup()
  }
}

main().catch((err) => {
  console.error('[artifact-envelope] 致命：', err)
  process.exit(1)
})
