#!/usr/bin/env node
// Golden-corpus e2e: iterate EVERY golden case through the config-driven cli
// (`--from-config`) into a real `vite build`. This proves generateFromConfig's
// output compiles for the WHOLE corpus — not just the 4 hand-picked prompts
// run-all.mjs exercises. It is the heavy counterpart to the in-process Layer-1
// scorer (score-golden.mjs), which checks emitted strings but never compiles.
//
// Cost control: cases are grouped by target, and pack + fixture-copy + npm
// install happen ONCE per target. Each case then just regenerates src/App.vue
// (`--from-config`) and reruns `vite build` in the SAME sandbox. Install is the
// slow part, so amortizing it across a target's cases keeps the corpus cheap.
//
// Usage:
//   node run-golden.mjs                 # all cases, grouped by target
//   node run-golden.mjs --target antdv  # only antdv-target cases
//   node run-golden.mjs --keep-on-failure

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
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

function loadCases() {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      // Golden files are { nl, config, notes? }; tolerate a bare-config file too.
      const parsed = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf-8'))
      const config = parsed && parsed.config ? parsed.config : parsed
      return { file: f, config }
    })
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
      'keep-on-failure': { type: 'boolean', default: false },
    },
  })

  const allCases = loadCases()
  const cases = values.target
    ? allCases.filter((c) => (c.config.target || 'vue3') === values.target)
    : allCases

  if (cases.length === 0) {
    console.error(
      `[golden] no cases found${values.target ? ` for target=${values.target}` : ''} in ${CASES_DIR}`
    )
    process.exit(1)
  }

  // Group by effective target so npm install runs once per target.
  const byTarget = new Map()
  for (const c of cases) {
    const t = c.config.target || 'vue3'
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
        const mode = c.config.mode || 'schema'
        const cfgPath = join(PACKED_DIR, `golden-${c.file}`)
        writeFileSync(cfgPath, JSON.stringify(c.config, null, 2))
        const tStart = Date.now()
        try {
          runCliFromConfig(sandbox, { mode, configPath: cfgPath })
          build(sandbox)
          const elapsed = ((Date.now() - tStart) / 1000).toFixed(1)
          console.log(`[golden] ✓ ${c.file} (${target}/${mode}) — ${elapsed}s`)
          results.push({ file: c.file, target, mode, ok: true })
        } catch (err) {
          targetFailed = true
          anyFailed = true
          console.error(`[golden] ✗ ${c.file} (${target}/${mode}): ${err.message}`)
          results.push({ file: c.file, target, mode, ok: false, error: err.message })
        }
      }
    } finally {
      cleanup(sandbox, values['keep-on-failure'] && targetFailed)
    }
  }

  console.log(`\n===== golden e2e summary =====`)
  for (const r of results) {
    console.log(
      `  ${r.ok ? '✓' : '✗'} ${r.file} [${r.target}/${r.mode}]${r.ok ? '' : ` — ${r.error}`}`
    )
  }
  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} golden cases compiled via vite build.`)
  process.exit(anyFailed ? 1 : 0)
}

main()
