#!/usr/bin/env node
// Golden-corpus e2e: iterate EVERY golden case into a real `vite build`.
//
// 两类用例、两条落盘路径，但**同一次 install、同一个沙箱、同一把 vite 尺子**：
//   - CRUD：`config` 经 cli `--from-config` → composeCrudConfig → generateFromConfig；
//   - 片段（table/form/dialog）：进程内跑 `generate*Block`，产物直接写 `src/App.vue`
//     （dialog 的 composable 形态另落一个宿主 SFC，见 scripts/lib/fragment-cases.mjs）。
//
// 这补的是 `AI-SCENE-COVERAGE-PLAN.md` §1.2 的「片段进 vite build」列 ——
// 此前本脚本 `.filter(isCrudCase)` 把片段用例**静默**跳过（语料 +18 例也不红）。
// 现在用例计划由 `scripts/lib/fragment-cases.mjs` 单源产出，
// `check-scene-coverage` 直接 import 本文件的 `loadCases` 断言片段没被过滤掉。
//
// Cost control: cases are grouped by target, and pack + fixture-copy + npm
// install happen ONCE per target. Each case then just rewrites src/App.vue and
// reruns `vite build` in the SAME sandbox. Install is the slow part, so
// amortizing it across a target's cases keeps the corpus cheap.
//
// Usage:
//   node run-golden.mjs                 # all cases, grouped by target
//   node run-golden.mjs --target antdv  # only antdv-target cases
//   node run-golden.mjs --kind fragment # only fragment cases (form/table/dialog)
//   node run-golden.mjs --keep-on-failure

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { cellOf } from '../../../scripts/eval/scenes.mjs'
import {
  loadGoldenCases,
  fragmentSandboxFiles,
} from '../../../scripts/lib/fragment-cases.mjs'
import {
  packPackage,
  copyFixtureToSandbox,
  installDeps,
  runCliFromConfig,
  build,
  cleanup,
  PKG_DIR,
  DIST_ENTRY,
  REPO_ROOT,
} from './run-e2e.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = resolve(REPO_ROOT, '__tests__/golden/cases')
const PACKED_DIR = resolve(__dirname, '../.packed')

/**
 * 全部 golden 用例，按「谁来发射」分组。
 *
 * ⚠ 这是 `check-scene-coverage` 的**行为锚点**：它 import 本函数并断言每条片段
 * 语料都在 `fragments` 里。若有人把 `.filter(isCrudCase)` 加回来，片段会静默
 * 掉出 vite build —— 该门禁会当场变红，而不是继续全绿。
 */
export function loadCases() {
  const { crud, fragments, errors } = loadGoldenCases(CASES_DIR)
  if (errors.length) {
    // 非法 JSON 在 e2e 里是硬错误：跳过 = 少构建一条却报绿。
    throw new Error(`[golden] 语料解析失败：\n  - ${errors.join('\n  - ')}`)
  }
  // CRUD 用例的 config 可能是 { nl, config, notes } 或裸配置，统一取内层。
  const crudCases = crud.map((c) => ({
    ...c,
    config: c.raw && c.raw.config ? c.raw.config : c.raw,
  }))
  return { crud: crudCases, fragments }
}

/**
 * 用例的有效 target / mode。
 *
 * CRUD 走 `config.target|mode`（裸配置也成立）；片段走用例顶层 `target` 与
 * 场景自己的 mode 轴（`cellOf` 单源）。**别把两者都塞给 `cellOf`**：裸配置的
 * `target` 在顶层而不是 `config` 里，`cellOf` 会按 CRUD 约定当成缺省 vue3。
 */
function targetOf(c) {
  return c.kind === 'crud' ? c.config.target || 'vue3' : cellOf(c.raw).target
}
function modeOf(c) {
  return c.kind === 'crud' ? c.config.mode || 'schema' : cellOf(c.raw).mode ?? 'single'
}

function assertDistBuilt(target) {
  const pkgDir = PKG_DIR[target]
  const distFile = join(REPO_ROOT, `packages/${pkgDir}/dist/${DIST_ENTRY[target]}`)
  const fallback =
    target === 'vue3'
      ? join(REPO_ROOT, 'packages/vue3/dist/es-plus.js') // vue3 historical name
      : distFile
  if (!existsSync(distFile) && !existsSync(fallback)) {
    throw new Error(
      `[golden] packages/${pkgDir}/dist not built. Run \`npm --prefix packages/${pkgDir} run build\` first ` +
        `(or use the golden:e2e script which builds everything before running).`
    )
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' }, // optional filter: only this effective target
      kind: { type: 'string' }, // optional filter: crud | fragment（便于单独验证片段链路）
      'keep-on-failure': { type: 'boolean', default: false },
    },
  })

  const { crud, fragments } = loadCases()
  const allCases = [
    ...crud.map((c) => ({ ...c, kind: 'crud' })),
    ...fragments.map((c) => ({ ...c, kind: 'fragment' })),
  ]
  const cases = allCases.filter(
    (c) =>
      (!values.target || targetOf(c) === values.target) &&
      (!values.kind || c.kind === values.kind)
  )

  if (cases.length === 0) {
    console.error(
      `[golden] no cases found${values.target ? ` for target=${values.target}` : ''} in ${CASES_DIR}`
    )
    process.exit(1)
  }

  // Group by effective target so npm install runs once per target.
  const byTarget = new Map()
  for (const c of cases) {
    const t = targetOf(c)
    if (!PKG_DIR[t]) {
      console.warn(`[golden] skip ${c.file}: unknown target "${t}"`)
      continue
    }
    if (!byTarget.has(t)) byTarget.set(t, [])
    byTarget.get(t).push(c)
  }

  mkdirSync(PACKED_DIR, { recursive: true })
  const results = []
  let anyFailed = false

  for (const [target, targetCases] of byTarget) {
    console.log(
      `\n########## golden target=${target} (${targetCases.length} case${targetCases.length === 1 ? '' : 's'}) ##########`
    )
    assertDistBuilt(target)
    const pkgDir = PKG_DIR[target]
    const coreTar = packPackage(join(REPO_ROOT, 'packages/core'))
    const sharedTar = packPackage(join(REPO_ROOT, 'packages/shared'))
    const targetPkgTar = packPackage(join(REPO_ROOT, `packages/${pkgDir}`))
    const cliTar = packPackage(join(REPO_ROOT, 'packages/cli'))

    const sandbox = copyFixtureToSandbox(target)
    let targetFailed = false
    try {
      installDeps(sandbox, [coreTar, sharedTar, targetPkgTar, cliTar])
      for (const c of targetCases) {
        const mode = modeOf(c)
        const tStart = Date.now()
        try {
          if (c.kind === 'fragment') {
            // 片段：进程内生成 → 直接落沙箱文件 → 同一把 vite 尺子。
            const { files } = fragmentSandboxFiles(c)
            for (const f of files) writeFileSync(join(sandbox, f.path), f.content)
          } else {
            const cfgPath = join(PACKED_DIR, `golden-${c.file}`)
            writeFileSync(cfgPath, JSON.stringify(c.config, null, 2))
            runCliFromConfig(sandbox, { mode, configPath: cfgPath })
          }
          build(sandbox)
          const elapsed = ((Date.now() - tStart) / 1000).toFixed(1)
          console.log(`[golden] ✓ ${c.file} (${c.kind}, ${target}/${mode}) — ${elapsed}s`)
          results.push({ file: c.file, kind: c.kind, target, mode, ok: true })
        } catch (err) {
          targetFailed = true
          anyFailed = true
          console.error(`[golden] ✗ ${c.file} (${c.kind}, ${target}/${mode}): ${err.message}`)
          results.push({ file: c.file, kind: c.kind, target, mode, ok: false, error: err.message })
        }
      }
    } finally {
      cleanup(sandbox, values['keep-on-failure'] && targetFailed)
    }
  }

  console.log(`\n===== golden e2e summary =====`)
  for (const r of results) {
    console.log(
      `  ${r.ok ? '✓' : '✗'} ${r.file} [${r.kind}/${r.target}/${r.mode}]${r.ok ? '' : ` — ${r.error}`}`
    )
  }
  const passed = results.filter((r) => r.ok).length
  const fragmentTotal = results.filter((r) => r.kind === 'fragment').length
  console.log(
    `\n${passed}/${results.length} golden cases compiled via vite build（片段 ${fragmentTotal} 例同尺子）.`
  )
  process.exit(anyFailed ? 1 : 0)
}

// 只在直接执行时跑整个语料；被 `check-scene-coverage` import 时只取 `loadCases`
// （守卫要断言片段没被过滤掉，不能触发一次真安装 + 真构建）。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
