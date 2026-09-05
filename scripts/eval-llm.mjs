#!/usr/bin/env node
/**
 * Layer-2 LLM accuracy scorer (nightly / manual — needs ANTHROPIC_API_KEY, costs money).
 *
 * For every golden case, this drives the REAL NL→config reasoning path
 * programmatically (the same steering prompt + few-shot the MCP host LLM and the
 * CLI --ai path use), then measures how close the model's config is to the
 * hand-authored golden config. This is how we put a number on the ">=95% in-schema
 * intent, zero manual edit" target.
 *
 * Pipeline per case:
 *   nl ──(Anthropic, claude-opus-5, adaptive thinking, few-shot system prompt)──▶ config'
 *      ──(StructuredCrudConfigSchema.safeParse + self-repair loop, <=2 retries)──▶ valid config'
 *      ──(field-level F1 vs golden + generateFromConfig compile check)──▶ score
 *
 * Metrics:
 *   - prop-set F1 (did it find the right fields?)
 *   - attribute accuracy on matched props (formtype / inQuery / inTable / inForm)
 *   - actions set F1
 *   - tableBtns.code multiset match
 *   - exactIntent: 1 iff prop set + all attributes + actions + tableBtn codes all match
 *   - compiles: generateFromConfig(config') did not throw
 *
 * "In-schema intent zero-edit accuracy" == mean(exactIntent). Target >= 0.95.
 *
 * WHY NOT strict json_schema output: the authoritative schema is recursive
 * (Cascader dataOptions.children) and the structured-output API forbids recursive
 * schemas. We use the prompt + Zod-validate + self-repair loop instead, which is
 * recursion-safe, zod4-native, and mirrors the host-LLM constrained path.
 *
 * Runs as a NO-OP (exit 0) when @anthropic-ai/sdk is not installed or no API key is
 * present, so it can sit in a nightly workflow without breaking key-less CI.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  StructuredCrudConfigSchema,
  generateFromConfig,
  buildNlToConfigSystemPrompt,
} from '@es-plus/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '__tests__', 'golden', 'cases')
const ACCURACY_FILE = join(__dirname, '..', '__tests__', 'golden', 'last-accuracy.json')
const MODEL = process.env.ESPLUS_EVAL_MODEL || 'claude-opus-5'
const TARGET_ACCURACY = Number(process.env.ESPLUS_EVAL_TARGET || '0.95')

// 与 few-shot 示例（shared/src/ai-nl-to-config-prompt.ts 的 NL_TO_CONFIG_FEWSHOT）同源/近变体的用例。
// 在这些用例上打分，测得的是"模型是否复述了它刚在 system prompt 里看到的 few-shot"，而非"泛化到未见场景"，
// 会系统性抬高准确率数字。因此单独报告为 few-shot recall，把 >=95% 的门禁落在留出集（heldout）上。
const FEWSHOT_DERIVED = new Set([
  '01-user-manage.json',        // ≈ example 1（逐字相同）
  '02-product-remote-select.json', // ≈ example 2（逐字相同）
  '03-order-tablebtns.json',    // ≈ example 3（左右互换变体）
  '07-vue2-task-manage.json',   // ≈ example 4（变体）
  '09-audit-readonly.json',     // ≈ example 5（变体）
  '16-dept-permissions.json',   // ≈ example 6（变体）
])

// --require-key: turn the "no key / no SDK" no-op into a hard failure. The
// nightly workflow passes this so a missing/rotated ANTHROPIC_API_KEY secret
// surfaces as a red build instead of a silent green skip that hides the fact
// the accuracy number was never actually measured.
const REQUIRE_KEY = process.argv.includes('--require-key')

function skip(msg) {
  if (REQUIRE_KEY) {
    console.error(`[eval:llm] FAIL (--require-key) — ${msg}`)
    process.exit(1)
  }
  console.log(`[eval:llm] SKIP — ${msg}`)
  process.exit(0)
}

async function loadSdk() {
  if (!process.env.ANTHROPIC_API_KEY) skip('ANTHROPIC_API_KEY not set')
  try {
    const mod = await import('@anthropic-ai/sdk')
    return mod.default || mod.Anthropic || mod
  } catch {
    skip('@anthropic-ai/sdk not installed (npm i -D @anthropic-ai/sdk to enable)')
  }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object found in model output')
  return JSON.parse(body.slice(start, end + 1))
}

function textOf(message) {
  return (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

async function callModel(client, system, messages) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system,
    messages,
  })
  return textOf(res)
}

/** NL → validated config, with a self-repair loop (<=2 retries feeding the Zod error back). */
async function nlToConfig(client, system, nl) {
  const messages = [{ role: 'user', content: nl }]
  let lastRaw = ''
  for (let attempt = 0; attempt <= 2; attempt++) {
    const raw = await callModel(client, system, messages)
    lastRaw = raw
    let candidate
    try {
      candidate = extractJson(raw)
    } catch (err) {
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: `That was not valid JSON (${err.message}). Respond with ONLY the JSON object.` })
      continue
    }
    const parsed = StructuredCrudConfigSchema.safeParse(candidate)
    if (parsed.success) return parsed.data
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) => `- [${i.path.join('.') || '(root)'}] ${i.message}`)
      .join('\n')
    messages.push({ role: 'assistant', content: JSON.stringify(candidate) })
    messages.push({
      role: 'user',
      content: `The config failed schema validation:\n${issues}\nFix these and respond with ONLY the corrected JSON object.`,
    })
  }
  throw new Error(`could not obtain a schema-valid config after repairs. Last output:\n${lastRaw.slice(0, 400)}`)
}

function f1(goldSet, predSet) {
  const tp = [...goldSet].filter((x) => predSet.has(x)).length
  const fp = predSet.size - tp
  const fn = goldSet.size - tp
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  const score = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { precision, recall, f1: score }
}

function fieldMap(config) {
  const m = new Map()
  for (const f of config.fields) m.set(f.prop, f)
  return m
}

function scorePair(gold, pred) {
  const goldFields = fieldMap(gold)
  const predFields = fieldMap(pred)
  const propF1 = f1(new Set(goldFields.keys()), new Set(predFields.keys()))

  // attribute accuracy over props present in BOTH
  const shared = [...goldFields.keys()].filter((p) => predFields.has(p))
  const attrs = ['formtype', 'inQuery', 'inTable', 'inForm']
  let attrHits = 0
  let attrTotal = 0
  const attrMisses = []
  for (const prop of shared) {
    const g = goldFields.get(prop)
    const p = predFields.get(prop)
    for (const a of attrs) {
      attrTotal++
      if (g[a] === p[a]) attrHits++
      else attrMisses.push(`${prop}.${a} (want ${g[a]}, got ${p[a]})`)
    }
  }
  const attrAcc = attrTotal === 0 ? 1 : attrHits / attrTotal

  const actionsF1 = f1(new Set(gold.actions), new Set(pred.actions))

  const codes = (c) =>
    (c.tableBtns || [])
      .map((b) => (b.code ?? 1))
      .sort()
      .join(',')
  const tableBtnsMatch = codes(gold) === codes(pred)

  const exactIntent =
    propF1.f1 === 1 &&
    attrAcc === 1 &&
    actionsF1.f1 === 1 &&
    tableBtnsMatch

  return { propF1, attrAcc, attrMisses, actionsF1, tableBtnsMatch, exactIntent }
}

async function main() {
  const Anthropic = await loadSdk()
  const client = new Anthropic()
  const system = buildNlToConfigSystemPrompt()

  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  if (!files.length) skip(`no golden cases in ${CASES_DIR}`)

  const rows = []
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
    const gold = StructuredCrudConfigSchema.parse(raw.config)
    process.stdout.write(`[eval:llm] ${file} … `)
    try {
      const pred = await nlToConfig(client, system, raw.nl)
      let compiles = true
      try {
        generateFromConfig(pred)
      } catch {
        compiles = false
      }
      const s = scorePair(gold, pred)
      rows.push({ file, ...s, compiles, error: null, fewshotDerived: FEWSHOT_DERIVED.has(file) })
      console.log(
        `intent=${s.exactIntent ? 'EXACT' : 'diff'} propF1=${s.propF1.f1.toFixed(2)} attr=${s.attrAcc.toFixed(2)} actF1=${s.actionsF1.f1.toFixed(2)} btns=${s.tableBtnsMatch ? 'ok' : 'X'} compiles=${compiles ? 'yes' : 'NO'}`
      )
      if (s.attrMisses.length) console.log(`           attr misses: ${s.attrMisses.join('; ')}`)
    } catch (err) {
      rows.push({ file, exactIntent: false, compiles: false, error: err.message, fewshotDerived: FEWSHOT_DERIVED.has(file) })
      console.log(`ERROR — ${err.message.split('\n')[0]}`)
    }
  }

  const n = rows.length
  const heldout = rows.filter((r) => !r.fewshotDerived)
  const fewshotRows = rows.filter((r) => r.fewshotDerived)
  const meanOf = (rs) => (sel) => rs.reduce((a, r) => a + sel(r), 0) / rs.length
  const meanAll = meanOf(rows)
  const meanHeldout = meanOf(heldout)
  const meanFewshot = meanOf(fewshotRows)
  const exact = meanAll((r) => (r.exactIntent ? 1 : 0))
  const exactHeldout = heldout.length ? meanHeldout((r) => (r.exactIntent ? 1 : 0)) : null
  const exactFewshot = fewshotRows.length ? meanFewshot((r) => (r.exactIntent ? 1 : 0)) : null
  const compileRate = meanAll((r) => (r.compiles ? 1 : 0))
  const propF1 = meanAll((r) => r.propF1?.f1 ?? 0)
  const attrAcc = meanAll((r) => r.attrAcc ?? 0)
  const actF1 = meanAll((r) => r.actionsF1?.f1 ?? 0)

  // 门禁数字用留出集（heldout），若留出集为空则退回全量以避免除零。
  const gateExact = exactHeldout ?? exact

  console.log('\nLayer-2 LLM accuracy (model=' + MODEL + ')')
  console.log('==========================================')
  console.log(`  cases:                 ${n}  (heldout ${heldout.length} / fewshot-derived ${fewshotRows.length})`)
  console.log(`  in-schema intent zero-edit (ALL):      ${(exact * 100).toFixed(1)}%`)
  if (exactHeldout !== null) {
    console.log(`  in-schema intent zero-edit (HELDOUT):  ${(exactHeldout * 100).toFixed(1)}%   (target >= ${(TARGET_ACCURACY * 100).toFixed(0)}%)`)
  }
  if (exactFewshot !== null) {
    console.log(`  in-schema intent zero-edit (few-shot): ${(exactFewshot * 100).toFixed(1)}%   (recall, not generalization)`)
  }
  console.log(`  prop-set F1 (avg):     ${(propF1 * 100).toFixed(1)}%`)
  console.log(`  attribute acc (avg):   ${(attrAcc * 100).toFixed(1)}%`)
  console.log(`  actions F1 (avg):      ${(actF1 * 100).toFixed(1)}%`)
  console.log(`  compiles:              ${(compileRate * 100).toFixed(1)}%`)

  // Persist the last measured accuracy so a badge/dashboard has a source of
  // truth and drift is visible over time. This runs only on a real measured
  // pass (skip() exits before we get here), so the file always reflects a run
  // that actually called the model.
  const record = {
    measuredAt: new Date().toISOString(),
    model: MODEL,
    cases: n,
    heldoutCases: heldout.length,
    fewshotDerivedCases: fewshotRows.length,
    target: TARGET_ACCURACY,
    inSchemaIntentZeroEdit: Number(gateExact.toFixed(4)),
    inSchemaIntentZeroEditAll: Number(exact.toFixed(4)),
    propSetF1: Number(propF1.toFixed(4)),
    attributeAccuracy: Number(attrAcc.toFixed(4)),
    actionsF1: Number(actF1.toFixed(4)),
    compileRate: Number(compileRate.toFixed(4)),
    passed: gateExact >= TARGET_ACCURACY,
  }
  try {
    writeFileSync(ACCURACY_FILE, JSON.stringify(record, null, 2) + '\n')
    console.log(`  (persisted to ${ACCURACY_FILE})`)
  } catch (err) {
    console.warn(`  (could not persist accuracy: ${err.message})`)
  }

  if (gateExact < TARGET_ACCURACY) {
    console.error(`\n[eval:llm] heldout in-schema intent accuracy ${(gateExact * 100).toFixed(1)}% is below target ${(TARGET_ACCURACY * 100).toFixed(0)}%.`)
    process.exit(1)
  }
  console.log(`\n[eval:llm] target met. ✔`)
}

main().catch((err) => {
  console.error('[eval:llm] fatal:', err)
  process.exit(1)
})
