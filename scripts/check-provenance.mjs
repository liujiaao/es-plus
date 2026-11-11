#!/usr/bin/env node
/**
 * 出处两条指标的守卫（R5 / R6）—— 纯确定性、无模型、无付费。
 *
 * ## 守的是什么
 *
 * `page-source.ts` 的出处在 W4 时只有**三条手写用例**的往返断言（`page-source.spec.ts`）。
 * 手写用例证明得了「这条路走得通」，证明不了「227 条语料条条走得通」—— 归一化、mode
 * 分支、弹窗补全，任何一条只在特定语料上触发的路径都可能让出处不再是逆函数。
 *
 * 本守卫对**全部** CRUD 语料（golden + 站点生成配置 + 组合语料的表格形态）跑：
 *
 *   ① R5 出处往返率：三种出口（schema-ts / schema-js / sfc）各生成一次并回读，
 *      读回的配置重生成的**页面**必须逐字节等于原产物（`stripPageSourceArtifact` 之后，
 *      出处块自身的 `lossy[]` 不计 —— 归一化已消费掉的损失不是漂移）。
 *   ② R6 幂等率：`surfacesToConfig(configToSurfaces(cfg).intent)` 必须等于 `cfg`
 *      （归一化口径见 `scripts/eval/provenance.mjs` 头注）。不可比的配置**显式记账**，
 *      不是静默跳过。
 *
 * ## 驱动方式
 *
 * 与 `check-artifact-envelope.mjs` 同一条路：esbuild 现打包**源码**（命中 shared/build
 * 即判红），不调用任何 MCP handler。`composeInputOf` 来自组合打分的纯函数模块
 * （它只借用 `scenes.mjs` 的罐头标题表）。
 *
 * 用法：`node scripts/check-provenance.mjs [--json]`
 * 退出码：0 = 两条腿都 100%（分母按各自可比集合）；1 = 任一条有失败。
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ROOT } from './lib/front-door.mjs'
import { sceneOf } from './eval/scenes.mjs'
import { composeInputOf } from './eval/composition-scorers.mjs'
import {
  ROUND_TRIP_EXITS,
  roundTripOfConfig,
  summarizeRoundTrip,
  surfacesIdempotenceOf,
  summarizeSurfacesIdempotence,
} from './eval/provenance.mjs'

const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const DOCS_DIR = join(ROOT, 'docs', 'cases', 'generated')
const COMPOSITION_DIR = join(ROOT, '__tests__', 'golden', 'composition')
const JSON_OUT = process.argv.includes('--json')

async function loadShared() {
  const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-provenance-'))
  const entry = join(tmp, 'entry.ts')
  try {
    writeFileSync(
      entry,
      [
        "export { generateFromConfig } from '../../packages/shared/src/structured-generator.ts'",
        "export { StructuredCrudConfigSchema } from '../../packages/shared/src/structured-config.schema.ts'",
        "export { readPageSource, stripPageSourceArtifact, configToSurfaces } from '../../packages/shared/src/page-source.ts'",
        "export { surfacesToConfig } from '../../packages/shared/src/scene/surfaces-to-config.ts'",
        "export { composeCrudConfig } from '../../packages/shared/src/compose-crud-config.ts'",
      ].join('\n'),
      'utf8',
    )
    const outfile = join(tmp, 'provenance.mjs')
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

/** 所有 CRUD 配置来源（顺序冻结：golden → docs → composition）。 */
function collectProducts(mod) {
  const products = []
  for (const file of readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
    if (sceneOf(raw) !== 'crud') continue
    products.push({ source: `case:${file}`, config: raw.config })
  }
  if (readdirSync(DOCS_DIR).length) {
    for (const file of readdirSync(DOCS_DIR).filter((f) => f.endsWith('.config.json')).sort()) {
      products.push({ source: `docs:${file}`, config: JSON.parse(readFileSync(join(DOCS_DIR, file), 'utf8')) })
    }
  }
  for (const file of readdirSync(COMPOSITION_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const c = JSON.parse(readFileSync(join(COMPOSITION_DIR, file), 'utf8'))
    // form+dialog 走片段发射器（没有整页出处）；其余形态经组合层出整页。
    if (c.shape === 'form+dialog') continue
    const { config } = mod.composeCrudConfig(composeInputOf(c))
    products.push({ source: `composition:${c.id}`, config })
  }
  return products
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
      console.error('✗ 打包没有拉到 shared/src —— 度量测不到源码')
      process.exitCode = 1
      return
    }

    const products = collectProducts(mod)
    if (products.length < 200) {
      // 非空证明：语料目录读错时，「0 条全部通过」是最容易发生的假绿。
      console.error(`✗ 只收集到 ${products.length} 条 CRUD 配置 —— 语料加载出了问题，指标不构成测量`)
      process.exitCode = 1
      return
    }

    const roundTripResults = []
    for (const p of products) {
      for (const exit of ROUND_TRIP_EXITS) {
        roundTripResults.push({ source: p.source, exit: exit.id, ...roundTripOfConfig(p.config, exit, mod) })
      }
    }
    const roundTrip = summarizeRoundTrip(roundTripResults)

    const idemResults = products.map((p) => ({
      source: p.source,
      ...surfacesIdempotenceOf(p.config, mod),
    }))
    const idempotence = summarizeSurfacesIdempotence(idemResults)

    if (JSON_OUT) {
      console.log(JSON.stringify({ provenance: { roundTrip, surfacesIdempotence: idempotence } }, null, 2))
    } else {
      console.log('[provenance] R5 出处往返（读回配置重生成的页面必须逐字节等于原产物）')
      for (const exit of ROUND_TRIP_EXITS) {
        const b = roundTrip.byExit[exit.id] ?? { ok: 0, total: 0 }
        console.log(`  ${exit.id.padEnd(10)} ${b.ok}/${b.total} · ${(b.total ? b.ok / b.total : 0) * 100}%`)
      }
      console.log(`  合计 ${roundTrip.ok}/${roundTrip.total} = ${(roundTrip.rate ?? 0) * 100}%`)
      for (const f of roundTrip.failures) console.error(`  ✗ ${f.source} [${f.exit}] ${f.reason}`)

      console.log('[provenance] R6 config → surfaces → config 幂等')
      console.log(
        `  可比 ${idempotence.comparable} 条：${idempotence.ok}/${idempotence.comparable} = ${(idempotence.rate ?? 0) * 100}%` +
          `；显式排除 lossy ${idempotence.excluded.lossy} · children ${idempotence.excluded.children}` +
          ` · no-table ${idempotence.excluded['no-table']}`
      )
      for (const f of idempotence.failures) console.error(`  ✗ ${f.source} ${f.reason}`)
    }

    const failures = roundTrip.failed + idempotence.comparable - idempotence.ok
    if (failures > 0) {
      console.error(
        `\n✗ check:provenance：R5 失败 ${roundTrip.failed} 处、R6 失败 ${idempotence.comparable - idempotence.ok} 处`
      )
      process.exitCode = 1
      return
    }
    console.log(
      `✅ check:provenance：${products.length} 条配置 × ${ROUND_TRIP_EXITS.length} 出口全部往返，` +
        `R6 可比 ${idempotence.comparable} 条全部幂等。`
    )
  } finally {
    cleanup()
  }
}

main().catch((err) => {
  console.error('[provenance] 致命：', err)
  process.exit(1)
})
