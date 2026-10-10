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
import { scoreAll, CAPABILITY_SCORERS } from './eval/scorers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '__tests__', 'golden', 'cases')
const ACCURACY_FILE = join(__dirname, '..', '__tests__', 'golden', 'last-accuracy.json')
// Shields.io "endpoint" badge payload (https://shields.io/badges/endpoint-badge).
// README points its badge at the raw URL of this file; a nightly commit-back keeps
// the published number honest without a server. Gate number drives it (heldout).
const BADGE_FILE = join(__dirname, '..', '__tests__', 'golden', 'last-accuracy-badge.json')
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

// 打分逻辑已抽到 ./eval/scorers.mjs（纯函数、无 SDK、可无 key 单测）。这里只负责
// 驱动模型拿到 pred，再交给 scoreAll 评分、聚合、持久化。

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
    // 双语：中文（raw.nl）始终跑并作门禁语言；英文（raw.nlEn）有则跑、只观测。
    const langs = [{ lang: 'zh', nl: raw.nl }]
    if (typeof raw.nlEn === 'string' && raw.nlEn.trim()) langs.push({ lang: 'en', nl: raw.nlEn })
    for (const { lang, nl } of langs) {
      process.stdout.write(`[eval:llm] ${file} [${lang}] … `)
      try {
        const pred = await nlToConfig(client, system, nl)
        let compiles = true
        try {
          generateFromConfig(pred)
        } catch {
          compiles = false
        }
        const s = scoreAll(gold, pred)
        rows.push({ file, lang, ...s, compiles, error: null, fewshotDerived: FEWSHOT_DERIVED.has(file) })
        console.log(
          `intent=${s.exactIntentCore ? 'EXACT' : 'diff'}${s.exactIntentFull ? '' : s.exactIntentCore ? ' (full:diff)' : ''} propF1=${s.propF1.f1.toFixed(2)} attr=${s.attrAcc.toFixed(2)} actF1=${s.actionsF1.f1.toFixed(2)} btns=${s.tableBtnsMatch ? 'ok' : 'X'} compiles=${compiles ? 'yes' : 'NO'}`
        )
        if (s.attrMisses.length) console.log(`           attr misses: ${s.attrMisses.join('; ')}`)
        const dimMisses = Object.entries(s.byCapability)
          .filter(([, v]) => v.applicable && !v.pass)
          .map(([k]) => k)
        if (dimMisses.length) console.log(`           dim misses: ${dimMisses.join(', ')}`)
      } catch (err) {
        rows.push({ file, lang, exactIntentCore: false, exactIntentFull: false, byCapability: {}, compiles: false, error: err.message, fewshotDerived: FEWSHOT_DERIVED.has(file) })
        console.log(`ERROR — ${err.message.split('\n')[0]}`)
      }
    }
  }

  // 门禁与主要数值落在中文（zh）行：英文只观测，不拖门禁，数值口径与改双语前连续。
  const zhRows = rows.filter((r) => r.lang === 'zh')
  const enRows = rows.filter((r) => r.lang === 'en')
  const n = zhRows.length
  const heldout = zhRows.filter((r) => !r.fewshotDerived)
  const fewshotRows = zhRows.filter((r) => r.fewshotDerived)
  const meanOf = (rs) => (sel) => (rs.length ? rs.reduce((a, r) => a + sel(r), 0) / rs.length : 0)
  const meanAll = meanOf(zhRows)
  const meanHeldout = meanOf(heldout)
  const meanFewshot = meanOf(fewshotRows)
  const exact = meanAll((r) => (r.exactIntentCore ? 1 : 0))
  const exactHeldout = heldout.length ? meanHeldout((r) => (r.exactIntentCore ? 1 : 0)) : null
  const exactFewshot = fewshotRows.length ? meanFewshot((r) => (r.exactIntentCore ? 1 : 0)) : null
  const exactFull = meanAll((r) => (r.exactIntentFull ? 1 : 0))
  const exactFullHeldout = heldout.length ? meanHeldout((r) => (r.exactIntentFull ? 1 : 0)) : null
  const compileRate = meanAll((r) => (r.compiles ? 1 : 0))
  const propF1 = meanAll((r) => r.propF1?.f1 ?? 0)
  const attrAcc = meanAll((r) => r.attrAcc ?? 0)
  const actF1 = meanAll((r) => r.actionsF1?.f1 ?? 0)

  // 按维度在留出集上聚合：applicable=被多少 case 用到，pass=命中数，rate=命中率。
  // 这是能定位回归到具体维度的诊断信号（AI-01 的核心产物）。
  const capRows = heldout.length ? heldout : rows
  const byCapability = {}
  for (const { key } of CAPABILITY_SCORERS) {
    let applicable = 0
    let pass = 0
    for (const r of capRows) {
      const c = r.byCapability?.[key]
      if (c && c.applicable) {
        applicable++
        if (c.pass) pass++
      }
    }
    byCapability[key] = {
      applicable,
      pass,
      rate: applicable ? Number((pass / applicable).toFixed(4)) : null,
    }
  }

  // 按语言汇总 exactIntentCore（留出集优先，空则退回全量）。zh 作门禁、en 只观测。
  const langExact = (rs) => {
    const ho = rs.filter((r) => !r.fewshotDerived)
    const base = ho.length ? ho : rs
    return base.length ? Number((base.reduce((a, r) => a + (r.exactIntentCore ? 1 : 0), 0) / base.length).toFixed(4)) : null
  }
  const byLanguage = { zh: langExact(zhRows), en: enRows.length ? langExact(enRows) : null }

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
  console.log(`  exactIntentFull (ALL dims, observed):  ${(exactFull * 100).toFixed(1)}%   (not gated — see decision B)`)
  if (exactFullHeldout !== null) {
    console.log(`  exactIntentFull (HELDOUT, observed):   ${(exactFullHeldout * 100).toFixed(1)}%`)
  }
  console.log(`  prop-set F1 (avg):     ${(propF1 * 100).toFixed(1)}%`)
  console.log(`  attribute acc (avg):   ${(attrAcc * 100).toFixed(1)}%`)
  console.log(`  actions F1 (avg):      ${(actF1 * 100).toFixed(1)}%`)
  console.log(`  compiles:              ${(compileRate * 100).toFixed(1)}%`)
  if (byLanguage.en !== null) {
    console.log(`  by language (heldout exactIntentCore): zh ${(byLanguage.zh * 100).toFixed(1)}% (gated) / en ${(byLanguage.en * 100).toFixed(1)}% (observed)`)
  }

  console.log(`\n  by capability (${heldout.length ? 'heldout' : 'all'} cases; n/a = no case exercises it)`)
  console.log('  ------------------------------------------')
  for (const { key } of CAPABILITY_SCORERS) {
    const c = byCapability[key]
    const label = c.applicable
      ? `${(c.rate * 100).toFixed(0).padStart(3)}%  (${c.pass}/${c.applicable})`
      : ' n/a'
    console.log(`    ${key.padEnd(16)} ${label}`)
  }

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
    exactIntentFull: Number((exactFullHeldout ?? exactFull).toFixed(4)),
    exactIntentFullAll: Number(exactFull.toFixed(4)),
    propSetF1: Number(propF1.toFixed(4)),
    attributeAccuracy: Number(attrAcc.toFixed(4)),
    actionsF1: Number(actF1.toFixed(4)),
    compileRate: Number(compileRate.toFixed(4)),
    byCapability,
    byLanguage,
    passed: gateExact >= TARGET_ACCURACY,
  }
  try {
    writeFileSync(ACCURACY_FILE, JSON.stringify(record, null, 2) + '\n')
    console.log(`  (persisted to ${ACCURACY_FILE})`)
  } catch (err) {
    console.warn(`  (could not persist accuracy: ${err.message})`)
  }

  // Shields endpoint payload. The badge reflects the GATE number (heldout
  // in-schema intent zero-edit) — the same figure the >=95% gate reads — so the
  // public badge can never diverge from what the gate actually enforces.
  const pct = gateExact * 100
  const color = pct >= 95 ? 'brightgreen' : pct >= 90 ? 'green' : pct >= 80 ? 'yellow' : 'red'
  const badge = {
    schemaVersion: 1,
    label: 'heldout accuracy',
    message: `${pct.toFixed(1)}%`,
    color,
  }
  try {
    writeFileSync(BADGE_FILE, JSON.stringify(badge, null, 2) + '\n')
    console.log(`  (badge written to ${BADGE_FILE})`)
  } catch (err) {
    console.warn(`  (could not write badge: ${err.message})`)
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
