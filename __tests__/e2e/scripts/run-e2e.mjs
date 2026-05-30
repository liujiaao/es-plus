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

function packPackage(pkgPath) {
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

function copyFixtureToSandbox(target) {
  const fixtureName = `${target}-fresh`
  const src = join(FIXTURES_DIR, fixtureName)
  const sandbox = join(tmpdir(), `es-plus-e2e-${fixtureName}-${process.pid}-${Date.now()}`)
  cpSync(src, sandbox, { recursive: true })
  return sandbox
}

function installDeps(sandbox, tarballs) {
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

function build(sandbox) {
  console.log(`[e2e] npm run build`)
  sh('npm', ['run', 'build', '--silent'], sandbox)
}

function cleanup(sandbox, keepOnFailure) {
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

async function runScenario({ target, mode, prompt, keepOnFailure }) {
  const tStart = Date.now()
  console.log(`\n=== e2e: target=${target}, mode=${mode} ===`)

  // Pack all packages our fixture will install. shared is a transitive dep of
  // vue3/vue2/cli/mcp-server, so it must be packed first.
  const sharedTar = packPackage(join(REPO_ROOT, 'packages/shared'))
  const targetPkgTar = packPackage(join(REPO_ROOT, `packages/${target}`))
  const cliTar = packPackage(join(REPO_ROOT, 'packages/cli'))

  // Build vue3/vue2 dist before packing — `files: ["dist"]` means an empty
  // dist directory produces a useless tarball. We assume the user (or the CI
  // workflow) ran `npm run build` first; if not, this errors loudly below.
  const distFile = join(REPO_ROOT, `packages/${target}/dist/es-plus-${target === 'vue3' ? 'vue3' : 'vue2'}.js`)
  const fallbackDist = target === 'vue3'
    ? join(REPO_ROOT, 'packages/vue3/dist/es-plus.js')   // vue3 historical name
    : join(REPO_ROOT, 'packages/vue2/dist/es-plus-vue2.js')
  if (!existsSync(distFile) && !existsSync(fallbackDist)) {
    throw new Error(
      `[e2e] packages/${target}/dist not built. Run \`npm --prefix packages/${target} run build\` first ` +
      `(or use the e2e:all script which builds everything before running).`
    )
  }

  const sandbox = copyFixtureToSandbox(target)
  let failed = false
  try {
    installDeps(sandbox, [sharedTar, targetPkgTar, cliTar])
    runCli(sandbox, { target, mode, prompt: prompt || PROMPT_DEFAULT })
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

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: 'vue3' },
    mode: { type: 'string', default: 'schema' },
    prompt: { type: 'string' },
    'keep-on-failure': { type: 'boolean', default: false },
  },
})

if (!['vue3', 'vue2'].includes(values.target)) {
  console.error(`--target must be vue3 or vue2 (got: ${values.target})`)
  process.exit(2)
}
if (!['schema', 'sfc'].includes(values.mode)) {
  console.error(`--mode must be schema or sfc (got: ${values.mode})`)
  process.exit(2)
}

await runScenario({
  target: values.target,
  mode: values.mode,
  prompt: values.prompt,
  keepOnFailure: values['keep-on-failure'],
})
