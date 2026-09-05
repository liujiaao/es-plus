#!/usr/bin/env node
// End-to-end harness for `@es-plus/cli` → npm package install → real `vite build`.
//
// One run = one (target, mode) combo. We:
//   1. Pack the local monorepo packages into tarballs (shared, vue3, vue2, cli)
//      — this catches `files` field mistakes that a `file:` link would hide.
//   2. Copy the matching fixture project to a sandbox directory under tmp/
//   3. `npm install` the fixture deps + the packed tarballs
//   4. Run `npx es-plus create App --description "<prompt>" --target X --mode Y
//          --output src/App.vue`
//   5. `npm run build` (vite) — non-zero exit fails the test
//
// We intentionally do NOT mock anything — the goal is to prove the generated
// SFC actually compiles in a fresh project with the real published-shape
// packages. If anything between the cli, shared package, vue3/vue2 component
// runtime, or the generated code breaks → vite build will tell us.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { parseArgs } from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const FIXTURES_DIR = resolve(__dirname, '../fixtures')
const PACKED_DIR = resolve(__dirname, '../.packed')

// Target → monorepo package directory. antdv's package lives at
// `packages/adapter-antdv` (the npm name is @es-plus/adapter-antdv), NOT
// `packages/antdv`, so the target string can't be used verbatim as the dir.
export const PKG_DIR = { vue3: 'vue3', vue2: 'vue2', antdv: 'adapter-antdv' }
// Target → the primary dist entry file `files:["dist"]` publishes. If this is
// missing the packed tarball would be useless, so we assert it exists first.
export const DIST_ENTRY = {
  vue3: 'es-plus-vue3.js',
  vue2: 'es-plus-vue2.js',
  antdv: 'es-plus-antdv.js',
}
export { REPO_ROOT }

// Cache the packed tarballs across runs in the same process so multiple e2e
// combos don't repack 4 packages 4 times — only once total.
const packedTarballs = new Map()

function sh(cmd, args, cwd, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: opts.silent ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(opts.env || {}) },
  })
  if (res.status !== 0) {
    const out = opts.silent ? `\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}` : ''
    throw new Error(`[${cmd} ${args.join(' ')}] exited ${res.status}${out}`)
  }
  return res
}

export function packPackage(pkgPath) {
  const pkgName = JSON.parse(readFileSync(join(pkgPath, 'package.json'), 'utf-8')).name
  if (packedTarballs.has(pkgName)) return packedTarballs.get(pkgName)

  mkdirSync(PACKED_DIR, { recursive: true })
  // `npm pack --pack-destination` puts the .tgz at a known path so we don't
  // have to parse npm pack's stdout (which differs across versions).
  console.log(`[e2e] npm pack ${pkgName}`)
  sh('npm', ['pack', '--pack-destination', PACKED_DIR, '--silent'], pkgPath, { silent: true })

  // Find the just-created tarball: npm names it as <name>-<version>.tgz
  // with scope dashes (`@es-plus/vue3` → `es-plus-vue3-1.4.0.tgz`).
  const pkgJson = JSON.parse(readFileSync(join(pkgPath, 'package.json'), 'utf-8'))
  const expectedName = `${pkgJson.name.replace('@', '').replace('/', '-')}-${pkgJson.version}.tgz`
  const tarballPath = join(PACKED_DIR, expectedName)
  if (!existsSync(tarballPath)) {
    const actual = readdirSync(PACKED_DIR).join(', ')
    throw new Error(`Expected ${expectedName} after pack, found: ${actual}`)
  }
  packedTarballs.set(pkgName, tarballPath)
  return tarballPath
}

export function copyFixtureToSandbox(target) {
  const fixtureName = `${target}-fresh`
  const src = join(FIXTURES_DIR, fixtureName)
  const sandbox = join(tmpdir(), `es-plus-e2e-${fixtureName}-${process.pid}-${Date.now()}`)
  cpSync(src, sandbox, { recursive: true })
  return sandbox
}

export function installDeps(sandbox, tarballs) {
  console.log(`[e2e] npm install in ${sandbox}`)
  // Install the local tarballs FIRST so npm resolves them to the right
  // version, then the rest of the fixture deps.
  sh('npm', ['install', ...tarballs, '--no-audit', '--no-fund', '--silent', '--legacy-peer-deps'], sandbox)
}

function runCli(sandbox, { target, mode, prompt }) {
  // The cli's bin is `es-plus`, installed as a dep tarball. Use `npx` so the
  // path resolution works regardless of npm bin layout on win/linux.
  //
  // The cli has two output shapes depending on mode:
  //   sfc mode   → --output PATH is a single .vue file
  //   schema mode → --output PATH is a DIRECTORY; writes <PascalName>.vue + schema.ts inside
  //
  // We normalize both into `src/App.vue` (a file) so the fixture's main.ts
  // can use a stable import. For schema mode we point cli at `src/generated/`
  // and copy the inner App.vue out + leave schema.ts beside the SFC.
  console.log(`[e2e] es-plus create --target=${target} --mode=${mode}`)
  if (mode === 'sfc') {
    sh('npx', [
      'es-plus',
      'create',
      'App',
      '--description', prompt,
      '--target', target,
      '--mode', mode,
      '--output', 'src/App.vue',
    ], sandbox)
  } else {
    // schema mode → directory output
    sh('npx', [
      'es-plus',
      'create',
      'App',
      '--description', prompt,
      '--target', target,
      '--mode', mode,
      '--output', 'src/generated',
    ], sandbox)
    // Move src/generated/App.vue → src/App.vue, keep schema.ts where
    // the wrapper SFC imports it from (`./schema` relative to App.vue,
    // so it needs to sit alongside the wrapper).
    const genDir = join(sandbox, 'src', 'generated')
    const wrapperSrc = join(genDir, 'App.vue')
    const schemaSrc = join(genDir, 'schema.ts')
    const wrapperDst = join(sandbox, 'src', 'App.vue')
    const schemaDst = join(sandbox, 'src', 'schema.ts')
    if (!existsSync(wrapperSrc)) {
      throw new Error(`[e2e] schema mode: expected ${wrapperSrc} not found. cli output layout may have changed.`)
    }
    cpSync(wrapperSrc, wrapperDst)
    if (existsSync(schemaSrc)) cpSync(schemaSrc, schemaDst)
    rmSync(genDir, { recursive: true, force: true })
  }
}

// Drive the cli's config-driven path (`--from-config`) instead of `--description`.
// This exercises the SAME deterministic generator the golden Layer-1 scorer uses,
// but proves the emitted code actually compiles in a fresh project (vite build) —
// the heavy proof the in-process scorer intentionally skips for speed.
export function runCliFromConfig(sandbox, { mode, configPath }) {
  console.log(`[e2e] es-plus create --from-config (mode=${mode})`)
  const rel = 'es-plus.config.json'
  cpSync(configPath, join(sandbox, rel))
  if (mode === 'sfc') {
    sh('npx', [
      'es-plus', 'create', 'App',
      '--from-config', rel,
      '--output', 'src/App.vue',
    ], sandbox)
  } else {
    sh('npx', [
      'es-plus', 'create', 'App',
      '--from-config', rel,
      '--output', 'src/generated',
    ], sandbox)
    const genDir = join(sandbox, 'src', 'generated')
    const wrapperSrc = join(genDir, 'App.vue')
    const schemaSrc = join(genDir, 'schema.ts')
    if (!existsSync(wrapperSrc)) {
      throw new Error(`[e2e] schema mode: expected ${wrapperSrc} not found. cli output layout may have changed.`)
    }
    cpSync(wrapperSrc, join(sandbox, 'src', 'App.vue'))
    if (existsSync(schemaSrc)) cpSync(schemaSrc, join(sandbox, 'src', 'schema.ts'))
    rmSync(genDir, { recursive: true, force: true })
  }
}

export function build(sandbox) {
  console.log(`[e2e] npm run build`)
  sh('npm', ['run', 'build', '--silent'], sandbox)
}

export function cleanup(sandbox, keepOnFailure) {
  if (keepOnFailure) {
    console.log(`[e2e] keeping sandbox for inspection: ${sandbox}`)
    return
  }
  try {
    rmSync(sandbox, { recursive: true, force: true })
  } catch (err) {
    console.warn(`[e2e] cleanup failed (non-fatal): ${err.message}`)
  }
}

const PROMPT_DEFAULT = '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'

async function runScenario({ target, mode, prompt, keepOnFailure, fromConfig }) {
  const tStart = Date.now()
  console.log(`\n=== e2e: target=${target}, mode=${mode}${fromConfig ? ` (from-config: ${fromConfig})` : ''} ===`)

  // Pack all packages our fixture will install. core + shared are transitive
  // deps of vue3/vue2/cli/mcp-server, so they must be packed first. All three
  // renderers (vue3/vue2/antdv) externalize `@es-plus/core` and declare it as a
  // dependency, so without packing the LOCAL core, npm would resolve it from the
  // registry — where a stale published version can lag the freshly-built dist's
  // imports.
  const pkgDir = PKG_DIR[target]
  const coreTar = packPackage(join(REPO_ROOT, 'packages/core'))
  const sharedTar = packPackage(join(REPO_ROOT, 'packages/shared'))
  const targetPkgTar = packPackage(join(REPO_ROOT, `packages/${pkgDir}`))
  const cliTar = packPackage(join(REPO_ROOT, 'packages/cli'))

  // Build the target dist before packing — `files: ["dist"]` means an empty
  // dist directory produces a useless tarball. We assume the user (or the CI
  // workflow) ran `npm run build` first; if not, this errors loudly below.
  const distFile = join(REPO_ROOT, `packages/${pkgDir}/dist/${DIST_ENTRY[target]}`)
  const fallbackDist = target === 'vue3'
    ? join(REPO_ROOT, 'packages/vue3/dist/es-plus.js')   // vue3 historical name
    : distFile
  if (!existsSync(distFile) && !existsSync(fallbackDist)) {
    throw new Error(
      `[e2e] packages/${pkgDir}/dist not built. Run \`npm --prefix packages/${pkgDir} run build\` first ` +
      `(or use the e2e:all script which builds everything before running).`
    )
  }

  const sandbox = copyFixtureToSandbox(target)
  let failed = false
  try {
    installDeps(sandbox, [coreTar, sharedTar, targetPkgTar, cliTar])
    if (fromConfig) {
      runCliFromConfig(sandbox, { mode, configPath: fromConfig })
    } else {
      runCli(sandbox, { target, mode, prompt: prompt || PROMPT_DEFAULT })
    }
    build(sandbox)
    const elapsed = ((Date.now() - tStart) / 1000).toFixed(1)
    console.log(`[e2e] ✓ target=${target}, mode=${mode} — ${elapsed}s`)
  } catch (err) {
    failed = true
    console.error(`[e2e] ✗ target=${target}, mode=${mode}: ${err.message}`)
    throw err
  } finally {
    cleanup(sandbox, keepOnFailure && failed)
  }
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────
// Only parse args + run when invoked directly (`node run-e2e.mjs …`). When
// imported (e.g. by run-golden.mjs to reuse packPackage/installDeps/build),
// this block is skipped so importing has no side effects.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      target: { type: 'string', default: 'vue3' },
      mode: { type: 'string', default: 'schema' },
      prompt: { type: 'string' },
      'from-config': { type: 'string' },
      'keep-on-failure': { type: 'boolean', default: false },
    },
  })

  // --from-config accepts either a bare StructuredCrudConfig JSON or a golden-case
  // file ({ nl, config, notes }). We normalize to a bare-config file the cli reads,
  // and let the config's own target/mode override the CLI flags (matching create.ts).
  let effectiveTarget = values.target
  let effectiveMode = values.mode
  let fromConfigPath = null
  if (values['from-config']) {
    const srcPath = resolve(process.cwd(), values['from-config'])
    if (!existsSync(srcPath)) {
      console.error(`--from-config file not found: ${srcPath}`)
      process.exit(2)
    }
    const parsed = JSON.parse(readFileSync(srcPath, 'utf-8'))
    const config = parsed && typeof parsed === 'object' && parsed.config && parsed.nl ? parsed.config : parsed
    effectiveTarget = config.target || values.target
    effectiveMode = config.mode || values.mode
    // Write the bare config to a temp file the harness copies into the sandbox.
    mkdirSync(PACKED_DIR, { recursive: true })
    fromConfigPath = join(PACKED_DIR, `from-config-${process.pid}.json`)
    writeFileSync(fromConfigPath, JSON.stringify(config, null, 2))
  }

  if (!['vue3', 'vue2', 'antdv'].includes(effectiveTarget)) {
    console.error(
      `--target must be vue3, vue2, or antdv (got: ${effectiveTarget}).`
    )
    process.exit(2)
  }
  if (!['schema', 'sfc'].includes(effectiveMode)) {
    console.error(`--mode must be schema or sfc (got: ${effectiveMode})`)
    process.exit(2)
  }

  await runScenario({
    target: effectiveTarget,
    mode: effectiveMode,
    prompt: values.prompt,
    keepOnFailure: values['keep-on-failure'],
    fromConfig: fromConfigPath,
  })
}
