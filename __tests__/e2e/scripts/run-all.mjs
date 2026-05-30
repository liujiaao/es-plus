#!/usr/bin/env node
// Run the full e2e matrix in-process. Used by `npm run test:e2e` at the
// repo root. CI runs the same matrix via GitHub Actions parallelism — but
// keep this script handy for local "everything green?" checks.

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RUNNER = resolve(__dirname, 'run-e2e.mjs')

const MATRIX = [
  { target: 'vue3', mode: 'schema' },
  { target: 'vue3', mode: 'sfc' },
  { target: 'vue2', mode: 'schema' },
  { target: 'vue2', mode: 'sfc' },
]

const failures = []
const t0 = Date.now()

for (const { target, mode } of MATRIX) {
  const res = spawnSync(process.execPath, [RUNNER, '--target', target, '--mode', mode], {
    stdio: 'inherit',
  })
  if (res.status !== 0) failures.push({ target, mode, status: res.status })
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n=== e2e matrix complete in ${elapsed}s ===`)
console.log(`  passed: ${MATRIX.length - failures.length}/${MATRIX.length}`)
if (failures.length) {
  for (const f of failures) console.log(`  ✗ target=${f.target}, mode=${f.mode} (exit ${f.status})`)
  process.exit(1)
}
console.log(`  ✓ all combos green`)
