#!/usr/bin/env node
/**
 * Layer-1 deterministic golden scorer (free, runs in CI on every PR).
 *
 * For every golden case in __tests__/golden/cases/*.json this proves the
 * config→code path is sound WITHOUT an LLM and WITHOUT a full vite build:
 *
 *   1. config validates against the authoritative StructuredCrudConfigSchema
 *   2. generateFromConfig(config) does not throw
 *   3. the emitted code carries every field/action/tableBtn the config declared
 *   4. business logic the schema can't express is MARKED (TODO(es-plus) + warnings),
 *      never silently dropped
 *
 * This is the regression net for "config→code is always coherent". The heavier
 * "config→code always compiles" proof (tsc + vite build) is covered by the e2e
 * harness (`run-e2e.mjs --from-config`), run nightly/manually, not per-PR.
 *
 * Exit code 0 = all cases pass; 1 = at least one invariant failed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateFromConfig, StructuredCrudConfigSchema } from '@es-plus/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', 'cases')

/** @typedef {{ file: string, failures: string[] }} CaseResult */

function isVisible(field, key) {
  // defaults resolved by the schema parse, but guard for raw usage too
  return field[key] !== false
}

function countOccurrences(haystack, needle) {
  let n = 0
  let i = 0
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

/** @returns {string[]} list of invariant-failure messages (empty === pass) */
function scoreCase(raw) {
  const failures = []

  // (1) schema validation
  const parsed = StructuredCrudConfigSchema.safeParse(raw.config)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    failures.push(`config failed schema validation: [${first.path.join('.')}] ${first.message}`)
    return failures // nothing else is meaningful once the config is invalid
  }
  const config = parsed.data

  // (2) generation must not throw
  let result
  try {
    result = generateFromConfig(config)
  } catch (err) {
    failures.push(`generateFromConfig threw: ${err instanceof Error ? err.message : String(err)}`)
    return failures
  }

  const code = result.code || ''
  const wrapper = result.wrapperCode || ''
  const combined = code + '\n' + wrapper

  // (3) code present
  if (!code.trim()) failures.push('emitted code is empty')

  // (4) mode/wrapper coherence
  if (config.mode === 'schema' && !wrapper.trim()) {
    failures.push('schema mode must emit a wrapper SFC (wrapperCode) but it is empty')
  }
  if (config.mode === 'sfc' && wrapper.trim()) {
    failures.push('sfc mode must not emit a separate wrapperCode')
  }

  // (5) every table-visible field appears as a column
  for (const f of config.fields) {
    if (isVisible(f, 'inTable') && !code.includes(`"prop": "${f.prop}"`)) {
      failures.push(`table-visible field "${f.prop}" is missing from emitted columns`)
    }
  }

  // (6) every query-visible field appears somewhere in the emitted config
  for (const f of config.fields) {
    if (isVisible(f, 'inQuery') && !code.includes(`"prop": "${f.prop}"`)) {
      failures.push(`query-visible field "${f.prop}" is missing from emitted schema`)
    }
  }

  // (7) actions reflected in the human summary
  const summary = result.summary || ''
  for (const action of config.actions) {
    if (!summary.includes(action)) {
      failures.push(`action "${action}" not reflected in generation summary`)
    }
  }

  // (8) tableBtns positioning (code:1=left / code:2=right) preserved
  if (Array.isArray(config.tableBtns) && config.tableBtns.length) {
    const want1 = config.tableBtns.filter((b) => (b.code ?? 1) === 1).length
    const want2 = config.tableBtns.filter((b) => b.code === 2).length
    const got1 = countOccurrences(code, '"code": 1')
    const got2 = countOccurrences(code, '"code": 2')
    if (got1 < want1) failures.push(`expected ${want1} left tableBtn(s) (code:1) but emitted ${got1}`)
    if (got2 < want2) failures.push(`expected ${want2} right tableBtn(s) (code:2) but emitted ${got2}`)
  }

  // (9) "mark, never drop": render fields must surface a marked extension point
  const renderFields = config.fields.filter((f) => typeof f.render === 'string' && f.render)
  if (renderFields.length) {
    if (!wrapper.includes('TODO(es-plus)')) {
      failures.push('render field(s) present but no TODO(es-plus) extension-point stub was emitted')
    }
    if (!result.warnings || result.warnings.length === 0) {
      failures.push('render field(s) present but generation returned no warnings')
    }
  }

  // (10) httpRequest wiring is intact. es-table has a single fetch path built
  //      from TWO cooperating pieces (the resolved "Flag #3"):
  //        Method A — tableOptions.apiParams.url: the fetch GATE + URL source
  //                   (no url → queryTableListMethod returns without fetching)
  //        Method B — the fetchData httpRequest({ url, method, params }) call:
  //                   the request FUNCTION es-crud-page binds via :http-request
  //      If either half is missing the list silently never loads. apiParams.url
  //      must be present in every mode; in schema mode the fetchData binding +
  //      an explicit method must coexist with it.
  const hasApiParamsUrl = /apiParams["']?\s*:\s*\{\s*["']?url/.test(combined)
  if (!hasApiParamsUrl) {
    failures.push('missing apiParams.url — es-table has no fetch gate/URL source, the list will not load')
  }
  if (config.mode === 'schema') {
    if (!/http-request="fetchData"/.test(combined)) {
      failures.push('schema mode: wrapper does not bind :http-request="fetchData" (Method B request fn missing)')
    }
    if (!/httpRequest\(\{[\s\S]*?method\s*:\s*["'][A-Z]+["']/.test(combined)) {
      failures.push('schema mode: fetchData httpRequest call carries no explicit method — Method A/B coexistence broken')
    }
  }

  // (11) pagination binding is target-correct in self-contained SFC mode. In
  //      schema mode pagination is owned internally by <es-crud-page> (no
  //      template binding), so this only applies to sfc. vue2 uses 2.6 `.sync`;
  //      vue3/antdv use `v-model:pagination`. A wrong/missing binding cuts the
  //      two-way page-state link and paging breaks.
  const hasTable = config.fields.some((f) => isVisible(f, 'inTable'))
  if (config.mode === 'sfc' && hasTable) {
    const target = config.target || 'vue3'
    if (target === 'vue2') {
      if (!combined.includes(':pagination.sync')) {
        failures.push('vue2 sfc must bind :pagination.sync (Vue 2.6 .sync), but it is missing')
      }
    } else if (!combined.includes('v-model:pagination')) {
      failures.push(`${target} sfc must bind v-model:pagination, but it is missing`)
    }
  }

  return failures
}

function main() {
  const files = readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()

  if (!files.length) {
    console.error(`No golden cases found in ${CASES_DIR}`)
    process.exit(1)
  }

  /** @type {CaseResult[]} */
  const results = []
  for (const file of files) {
    let raw
    try {
      raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
    } catch (err) {
      results.push({ file, failures: [`invalid JSON: ${err instanceof Error ? err.message : String(err)}`] })
      continue
    }
    if (!raw || typeof raw.nl !== 'string' || typeof raw.config !== 'object') {
      results.push({ file, failures: ['golden case must have { nl: string, config: object }'] })
      continue
    }
    results.push({ file, failures: scoreCase(raw) })
  }

  const passed = results.filter((r) => r.failures.length === 0)
  const failed = results.filter((r) => r.failures.length > 0)

  console.log('\nLayer-1 deterministic golden scorer')
  console.log('===================================')
  for (const r of results) {
    if (r.failures.length === 0) {
      console.log(`  PASS  ${r.file}`)
    } else {
      console.log(`  FAIL  ${r.file}`)
      for (const msg of r.failures) console.log(`          - ${msg}`)
    }
  }
  console.log('-----------------------------------')
  console.log(`  ${passed.length}/${results.length} cases passed`)

  if (failed.length) {
    console.error(`\n${failed.length} golden case(s) failed the deterministic scorer.`)
    process.exit(1)
  }
  console.log('\nAll golden cases coherent (config→code). ✔')
}

main()
