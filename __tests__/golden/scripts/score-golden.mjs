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
import { transformSync } from 'esbuild'
import { generateFromConfig, StructuredCrudConfigSchema } from '@es-plus/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', 'cases')

/** @typedef {{ file: string, failures: string[] }} CaseResult */

/**
 * 语法校验 —— 本层此前只做字符串匹配（countOccurrences / propPresent），
 * 因此**语法坏掉的生成物照样能通过 PR 门禁**：唯一的「能编译」证明在夜间的
 * golden-e2e（vite build），而它不阻塞合并、也不阻塞部署。
 *
 * 这里补一次真实解析，成本是毫秒级、无需 npm install：
 *   - schema 模式产出 `export const pageSchema = {<JSON>}` → 直接 JSON.parse 其载荷；
 *   - 两种模式的 SFC → 抽出 <script> 块交给 esbuild 解析（TS 语法错误会抛出）。
 *
 * 覆盖不到的是模板编译与依赖解析（那是 golden-e2e 的职责），但「生成器拼出语法错误代码」
 * 这一类真实故障从此在 PR 上就会红。
 */
function checkSyntax({ mode, code, wrapper, failures }) {
  /** esbuild 解析一段 TS/JS，返回错误信息或 null（只解析、不解析依赖） */
  const parseTs = (src, label) => {
    try {
      transformSync(src, { loader: 'ts' })
      return null
    } catch (err) {
      return `${label} failed to parse — ${String(err.message).split('\n')[0]}`
    }
  }

  if (mode !== 'sfc') {
    // schema 模式的 code 是一个 TS 模块：
    //   import type { CrudPageSchema } from '@es-plus/vue3'
    //   export const pageSchema: CrudPageSchema = { ...JSON... }
    // （typescript:false 时为 `export const pageSchema = { ... }`，无类型注解）
    const moduleErr = parseTs(code, 'schema mode: pageSchema module')
    if (moduleErr) failures.push(moduleErr)

    // 载荷必须是合法 JSON —— 这比「模块能解析」更严格，且能挡住生成器拼坏对象字面量
    const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
    if (!m) {
      failures.push('schema mode: could not locate the `pageSchema` object literal')
    } else {
      try {
        JSON.parse(m[1])
      } catch (err) {
        failures.push(`schema mode: pageSchema payload is not valid JSON — ${err.message}`)
      }
    }
  }

  // SFC（schema 模式的 wrapper / sfc 模式的 code）的 <script> 块必须能被解析
  const sfcs = []
  if (mode === 'sfc') {
    if (code.trim()) sfcs.push(['sfc code', code])
  } else if (wrapper && wrapper.trim()) {
    sfcs.push(['wrapper', wrapper])
  }
  for (const [label, sfc] of sfcs) {
    const blocks = [...sfc.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    for (const [, attrs, body] of blocks) {
      // 生成器产出的是 <script setup lang="tsx">（含 JSX 渲染函数）——用 'ts' 解析 JSX
      // 会误报「Expected ">" but found ...」。按声明语言选择 loader。
      const lang = (attrs.match(/lang\s*=\s*["']?([a-z]+)/i) || [])[1]?.toLowerCase()
      const loader = lang === 'tsx' ? 'tsx' : lang === 'jsx' ? 'jsx' : lang === 'ts' ? 'ts' : 'js'
      try {
        transformSync(body, { loader })
      } catch (err) {
        failures.push(`${label}: <script> block failed to parse — ${err.message.split('\n').slice(0, 2).join(' ')}`)
      }
    }
  }
}

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

// A field's prop can surface in two emitted shapes: the schema-mode pageSchema
// JSON (`"prop": "x"`) or the sfc-mode JS object literal (`prop: 'x'` — column
// builders emit single-quoted JS, not JSON). Accept either so the check is
// mode-agnostic instead of silently under-verifying sfc columns.
function propPresent(code, prop) {
  return code.includes(`"prop": "${prop}"`) || new RegExp(`prop:\\s*['"]${prop}['"]`).test(code)
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

  // (3b) 语法校验：生成物必须真的能被解析（此前本层只做字符串匹配，语法错误也能过）
  checkSyntax({ mode: config.mode, code, wrapper, failures })

  // (4) mode/wrapper coherence
  if (config.mode === 'schema' && !wrapper.trim()) {
    failures.push('schema mode must emit a wrapper SFC (wrapperCode) but it is empty')
  }
  if (config.mode === 'sfc' && wrapper.trim()) {
    failures.push('sfc mode must not emit a separate wrapperCode')
  }

  // (5) every table-visible field appears as a column
  for (const f of config.fields) {
    if (isVisible(f, 'inTable') && !propPresent(code, f.prop)) {
      failures.push(`table-visible field "${f.prop}" is missing from emitted columns`)
    }
  }

  // (6) every query-visible field appears somewhere in the emitted config
  for (const f of config.fields) {
    if (isVisible(f, 'inQuery') && !propPresent(code, f.prop)) {
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

  // (8) tableBtns positioning (code:1=left / code:2=right) preserved.
  //     This inspects the emitted pageSchema JSON (`"code": N`), which only
  //     exists in schema mode. In sfc mode tableBtns are not rendered as JSON
  //     at all — they are intentionally surfaced as a degradation warning
  //     instead (see check 8b), so this assertion is schema-mode-only.
  if (config.mode !== 'sfc' && Array.isArray(config.tableBtns) && config.tableBtns.length) {
    const want1 = config.tableBtns.filter((b) => (b.code ?? 1) === 1).length
    const want2 = config.tableBtns.filter((b) => b.code === 2).length
    const got1 = countOccurrences(code, '"code": 1')
    const got2 = countOccurrences(code, '"code": 2')
    if (got1 < want1) failures.push(`expected ${want1} left tableBtn(s) (code:1) but emitted ${got1}`)
    if (got2 < want2) failures.push(`expected ${want2} right tableBtn(s) (code:2) but emitted ${got2}`)
  }

  // (8c) position → code 归一化：用例里显式声明的 `position` 必须原样反映到解析后的 `code`。
  //      回归背景：Zod 默认 strip 未知键，只声明 code 时 `position: 'right'` 会被**静默**
  //      改写成 code:1（左侧）——解析成功、零告警，按钮落到错误一侧。
  //      这里拿 raw（声明值）与 parsed（归一化后）对照，正是 strip 会露馅的地方。
  const rawBtns = Array.isArray(raw.config?.tableBtns) ? raw.config.tableBtns : []
  const parsedBtns = Array.isArray(config.tableBtns) ? config.tableBtns : []
  rawBtns.forEach((rawBtn, i) => {
    if (!rawBtn?.position) return
    const expected = rawBtn.position === 'right' ? 2 : 1
    const actual = parsedBtns[i]?.code
    if (actual !== expected) {
      failures.push(
        `tableBtn "${rawBtn.name ?? i}" declares position="${rawBtn.position}" but normalized code=${actual} (expected ${expected}) — position was silently dropped`
      )
    }
  })

  // (8b) sfc mode does not yet consume tableBtns/operationColumn/dialogs. WS-5
  //      ("mark, never drop") requires these be SURFACED as a warning rather
  //      than silently ignored, so the host LLM/user knows to switch to schema
  //      mode or hand-complete the SFC.
  if (config.mode === 'sfc') {
    const dropped = []
    if (Array.isArray(config.tableBtns) && config.tableBtns.length) dropped.push('tableBtns')
    if (config.operationColumn) dropped.push('operationColumn')
    if (config.dialogs && Object.keys(config.dialogs).length) dropped.push('dialogs')
    const hasDegradeWarning = (result.warnings || []).some((w) => /does not yet consume/.test(w))
    if (dropped.length && !hasDegradeWarning) {
      failures.push(
        `sfc mode ignores ${dropped.join('/')} but emitted no degradation warning (WS-5: mark, never silently drop)`
      )
    }
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

  // (9b) "mark, never drop": formatter fields in schema mode must surface a
  //      degradation warning rather than being silently discarded.
  const formatterFields = config.fields.filter((f) => typeof f.formatter === 'string' && f.formatter)
  if (config.mode !== 'sfc' && formatterFields.length) {
    const hasFormatterWarning = (result.warnings || []).some((w) => /formatter/i.test(w))
    if (!hasFormatterWarning) {
      failures.push('formatter field(s) present but schema mode emitted no degradation warning (WS-5: mark, never silently drop)')
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
