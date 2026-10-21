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
import { compileProduct, fmtError } from '../../../scripts/eval/compile-leg.mjs'
import { SCENES, isCrudCase, sceneOf } from '../../../scripts/eval/scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', 'cases')

/** @typedef {{ file: string, failures: string[] }} CaseResult */

/**
 * 语法/编译校验 —— 本层在补合成之前只做字符串匹配（countOccurrences / propPresent），
 * 因此**语法坏掉的生成物照样能通过 PR 门禁**：唯一的「能编译」证明在夜间的
 * golden-e2e（vite build），而它不阻塞合并、也不阻塞部署。
 *
 * AN-12 起用 Tier A 编译腿（`scripts/eval/compile-leg.mjs`）：
 *   - schema 模式产出 `export const pageSchema = {<JSON>}` → JSON 载荷单独 JSON.parse
 *     （比「模块能解析」更严格，能挡住拼坏的对象字面量）；
 *   - 两种模式的产物（schema: code + wrapper；sfc: 整份 SFC）→ 真编译：脚本过
 *     `compileScript`、**模板过 `compileTemplate`**。旧尺子只把 `<script>` 块交给
 *     esbuild，模板从未被 Vue 编译器看过 —— 坏 mustache / 非法插槽名能一路绿到 PR 门禁。
 */
function checkSyntax({ mode, code, wrapper, failures }) {
  if (mode !== 'sfc') {
    // schema 模式的 code 是一个 TS 模块：
    //   import type { CrudPageSchema } from '@es-plus/vue3'
    //   export const pageSchema: CrudPageSchema = { ...JSON... }
    // （typescript:false 时为 `export const pageSchema = { ... }`，无类型注解）
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

  const leg = compileProduct({ code, wrapperCode: wrapper }, { filename: 'golden.ts' })
  if (!leg.ok) failures.push(`compile leg failed — ${fmtError(leg.error)}`)
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

  // (12) AI-22: authored `tableOptions` display/behavior keys AND field-level `labelKey`
  //      must be EMITTED, not silently dropped. These keys lived only in core `TableOptions`
  //      / the JSON single source and were stripped at the AI Zod gate (accepted by nobody,
  //      emitted by nobody). Now that they are declared + emitted, this is the regression net:
  //      schema mode parses the emitted pageSchema and asserts the key is really there; sfc mode
  //      falls back to key-name matching. No existing case authors these keys, so this is a
  //      no-op for the current 161 and only bites on the new AI-22 cases (and any future drop).
  const AI22_TO_KEYS = [
    'size', 'showHeader', 'emptyText', 'snIndex', 'leftText',
    'cachePageSelection', 'defaultSort', 'refetchKeepPage', 'localPagination',
  ]
  if (config.tableOptions) {
    const authored = AI22_TO_KEYS.filter((k) => config.tableOptions[k] !== undefined)
    if (authored.length) {
      if (config.mode !== 'sfc') {
        const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
        let emittedTO = null
        if (m) {
          try {
            emittedTO = JSON.parse(m[1]).tableOptions
          } catch {
            emittedTO = null
          }
        }
        if (!emittedTO) {
          failures.push('AI-22: could not parse pageSchema.tableOptions for the emission check')
        } else {
          for (const k of authored) {
            if (!(k in emittedTO)) {
              failures.push(`tableOptions.${k} was authored but NOT emitted into pageSchema.tableOptions (silently dropped)`)
            }
          }
        }
      } else {
        for (const k of authored) {
          if (!new RegExp(`\\b${k}\\s*:`).test(code)) {
            failures.push(`tableOptions.${k} was authored but not found in the emitted SFC options`)
          }
        }
      }
    }
  }
  for (const f of config.fields) {
    if (f.labelKey && !code.includes(f.labelKey)) {
      failures.push(`field "${f.prop}" declares labelKey "${f.labelKey}" but it is missing from the emitted code`)
    }
  }

  // (13) AI-23: authored top-level `mergeConfig` must be EMITTED into the runtime home
  //      (`tableOptions.mergeConfig`), not silently dropped. Same net as (12): the generator
  //      emits it, so a future regression that forgets the spread turns these cases red.
  if (config.mergeConfig) {
    if (config.mode !== 'sfc') {
      const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
      let emittedMC = null
      if (m) {
        try {
          emittedMC = JSON.parse(m[1]).tableOptions?.mergeConfig
        } catch {
          emittedMC = null
        }
      }
      if (!emittedMC) {
        failures.push('AI-23: pageSchema.tableOptions.mergeConfig missing (mergeConfig was authored but silently dropped)')
      } else if (JSON.stringify(emittedMC.rowsBy) !== JSON.stringify(config.mergeConfig.rowsBy)) {
        failures.push(
          `AI-23: pageSchema.tableOptions.mergeConfig.rowsBy = ${JSON.stringify(emittedMC.rowsBy)} != authored ${JSON.stringify(config.mergeConfig.rowsBy)}`
        )
      }
    } else if (!/\bmergeConfig\s*:/.test(code)) {
      failures.push('AI-23: mergeConfig was authored but not found in the emitted SFC options')
    }
  }

  // (14) AI-27: authored dialog base data keys + the declarative `configBtn` array must be
  //      EMITTED into `pageSchema.dialogs[k]`, not silently dropped. Same net as (12)/(13).
  //      Why this exists: before AI-27 the generator copied only nine hard-coded dialog keys,
  //      so a key the AI contract had just let through (`showClose:false` …) was dropped one
  //      step later — and the runtime's `openDialog` forwarded its own hard-coded list as a
  //      third gate. This assertion is the middle gate's regression net: delete one
  //      `dialogSchema.KEY = …` line in `structured-generator.ts` and these cases go red.
  //      Schema mode only — sfc mode ignores `config.dialogs` wholesale and must say so
  //      through the degradation warning asserted in (8b).
  const DIALOG_BASE_KEYS = [
    'showClose', 'destroyOnClose', 'modal', 'closeOnClickModal', 'closeOnPressEscape',
    'hiddenFullBtn', 'appendTo', 'cacheKey',
  ]
  if (config.mode !== 'sfc' && config.dialogs) {
    const authoredDialogKeys = []
    for (const [key, dlg] of Object.entries(config.dialogs)) {
      for (const k of DIALOG_BASE_KEYS) if (dlg[k] !== undefined) authoredDialogKeys.push([key, k, dlg[k]])
      if (dlg.configBtn) authoredDialogKeys.push([key, 'configBtn', dlg.configBtn])
    }
    if (authoredDialogKeys.length) {
      const m = code.match(/export\s+const\s+pageSchema\b[^=]*=\s*(\{[\s\S]*\})\s*$/)
      let emittedDialogs = null
      if (m) {
        try {
          emittedDialogs = JSON.parse(m[1]).dialogs
        } catch {
          emittedDialogs = null
        }
      }
      if (!emittedDialogs) {
        failures.push('AI-27: could not parse pageSchema.dialogs for the dialog emission check')
      } else {
        for (const [key, k, want] of authoredDialogKeys) {
          const got = emittedDialogs[key]?.[k]
          if (got === undefined) {
            failures.push(
              `dialogs.${key}.${k} was authored but NOT emitted into pageSchema.dialogs (silently dropped — check the dialog copy block in structured-generator.ts)`
            )
          } else if (JSON.stringify(got) !== JSON.stringify(want)) {
            failures.push(`dialogs.${key}.${k} = ${JSON.stringify(got)} != authored ${JSON.stringify(want)}`)
          }
        }
      }
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
    // nlEn 可选（双语 eval 用），但存在时必须是非空字符串——空串会让 eval 跑一次空 prompt。
    if (raw.nlEn !== undefined && (typeof raw.nlEn !== 'string' || !raw.nlEn.trim())) {
      results.push({ file, failures: ['nlEn, when present, must be a non-empty string'] })
      continue
    }
    // 规格掩码（B2，可选、可增量标注）：存在时必须是 string[]。token 的语义合法性
    // （维度名是否可记分）在 meta-eval（check:scorers）里对全量 case 校验，这里只管形状，
    // 以保持 Layer-1 不依赖 scorers.mjs。
    const maskShape = []
    for (const key of ['fixedFields', 'pinnedDims']) {
      if (raw[key] === undefined) continue
      if (!Array.isArray(raw[key]) || raw[key].some((x) => typeof x !== 'string')) {
        maskShape.push(`${key}, when present, must be a string[]`)
      }
    }
    if (maskShape.length) {
      results.push({ file, failures: maskShape })
      continue
    }
    // 精修语料（B3，可选）：refinements = 按轮次排列的 NL 纠正；convergesBy = 该 case 自称
    // 的收敛轮数上界。这里只管形状（Layer-1 不依赖模型/scorers）；真实收敛数字在付费 eval 跑。
    const refineShape = []
    if (raw.refinements !== undefined) {
      if (!Array.isArray(raw.refinements) || raw.refinements.length === 0) {
        refineShape.push('refinements, when present, must be a non-empty array')
      } else {
        raw.refinements.forEach((r, i) => {
          if (!r || typeof r.correction !== 'string' || !r.correction.trim()) {
            refineShape.push(`refinements[${i}].correction must be a non-empty string`)
          }
          if (r && r.turn !== undefined && (!Number.isInteger(r.turn) || r.turn < 1)) {
            refineShape.push(`refinements[${i}].turn, when present, must be a positive integer`)
          }
        })
      }
    }
    if (raw.convergesBy !== undefined && (!Number.isInteger(raw.convergesBy) || raw.convergesBy < 1)) {
      refineShape.push('convergesBy, when present, must be a positive integer')
    }
    if (raw.convergesBy !== undefined && raw.refinements === undefined) {
      refineShape.push('convergesBy requires refinements (nothing to converge without corrections)')
    }
    if (refineShape.length) {
      results.push({ file, failures: refineShape })
      continue
    }
    // 场景判别（Wave 1.1）：语料目录已统一承载四场景，`scene` 缺省即 'crud'（186 条既有
    // 用例一字未改）。这里只管**形状**：非法场景名要响亮翻红（否则它会静默落到 crud，
    // 再在下面 StructuredCrudConfigSchema 处报一个与真实原因无关的错）；片段场景必须带
    // 顶层 target（片段输入本身不含 target，没有它就无法断「三端都覆盖」）。
    const sceneShape = []
    if (raw.scene !== undefined && !SCENES.includes(raw.scene)) {
      sceneShape.push(`scene, when present, must be one of ${SCENES.join(' | ')} (got ${JSON.stringify(raw.scene)})`)
    }
    if (raw.scene !== undefined && !isCrudCase(raw) && typeof raw.target !== 'string') {
      sceneShape.push(`scene=${sceneOf(raw)} cases must declare a top-level target (fragment input carries no target)`)
    }
    if (sceneShape.length) {
      results.push({ file, failures: sceneShape })
      continue
    }
    // Layer-1 打分器是**CRUD 配置 → 代码**这一条路径的尺子（它按 pageSchema 载荷、
    // query/table 字段集、tableBtns/dialogs 结构做断言）。片段场景的产物形状完全不同，
    // 用这把尺子量没有意义，故在此显式跳过 —— 但不是「不管」：片段语料的编译断言在
    // check-scene-coverage.mjs，覆盖断言也在那里。
    if (!isCrudCase(raw)) continue
    results.push({ file, failures: scoreCase(raw), bilingual: typeof raw.nlEn === 'string' })
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
  const bilingual = results.filter((r) => r.bilingual).length
  console.log(`  bilingual (nlEn present): ${bilingual}/${results.length}`)

  if (failed.length) {
    console.error(`\n${failed.length} golden case(s) failed the deterministic scorer.`)
    process.exit(1)
  }
  console.log('\nAll golden cases coherent (config→code). ✔')
}

main()
