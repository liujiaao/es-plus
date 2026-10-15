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
import { scoreAll, CAPABILITY_SCORERS, firstConvergedTurn, summarizeConvergence, summarize95, describeDimMiss } from './eval/scorers.mjs'
import { buildInitialMessages } from './eval/prompt.mjs'
import { FEWSHOT_DERIVED } from './eval/fewshot-derived.mjs'
import { isCrudCase, sceneOf, SCENES } from './eval/scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '__tests__', 'golden', 'cases')
const ACCURACY_FILE = join(__dirname, '..', '__tests__', 'golden', 'last-accuracy.json')
// Shields.io "endpoint" badge payload (https://shields.io/badges/endpoint-badge).
// README points its badge at the raw URL of this file; a nightly commit-back keeps
// the published number honest without a server. Gate number drives it (heldout).
const BADGE_FILE = join(__dirname, '..', '__tests__', 'golden', 'last-accuracy-badge.json')
// Parallel scoped-metric badge (B2). Additive — core badge above remains the gated one.
const BADGE_SCOPED_FILE = join(__dirname, '..', '__tests__', 'golden', 'last-accuracy-badge-scoped.json')
const MODEL = process.env.ESPLUS_EVAL_MODEL || 'claude-opus-5'
const TARGET_ACCURACY = Number(process.env.ESPLUS_EVAL_TARGET || '0.95')

// Every model id the server actually answered with, across the whole run.
// A relay/gateway can silently route a requested id to a different backend
// (e.g. PPIO maps `pa/claude-opus-4-8` → its internal `pa/venus-marble-4-8`),
// so we record what REALLY served the eval instead of trusting the id we asked
// for — otherwise the committed accuracy number could be attributed to a model
// that never ran. Populated in callModel from each response's `model` field.
const SERVED_MODELS = new Set()

// 与 few-shot 示例（shared/src/ai-nl-to-config-prompt.ts 的 NL_TO_CONFIG_FEWSHOT）同源/近变体的用例。
// 在这些用例上打分，测得的是"模型是否复述了它刚在 system prompt 里看到的 few-shot"，而非"泛化到未见场景"，
// 会系统性抬高准确率数字。因此单独报告为 few-shot recall，把 >=95% 的门禁落在留出集（heldout）上。
// 登记表已抽到 ./eval/fewshot-derived.mjs（含逐条语义裁定与守卫下界说明，F8）。

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
  if (res.model) SERVED_MODELS.add(res.model)
  return textOf(res)
}

/**
 * 在给定对话上跑「调模型 → 取 JSON → Zod 校验」并带 <=2 次自修复重试，返回通过 Zod 的 config。
 * 会把每次尝试（含成功那次的 assistant 轮）追加进 `messages`——这样 B3 多轮精修可以**延续同一段对话**
 * 继续喂纠正，而不是另起炉灶。抽成独立函数即为复用这条自修复环。
 */
async function driveToValidConfig(client, system, messages) {
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
    // 把模型这轮产出记入对话（无论成败）——成功时保留它，后续纠正才有上下文。
    messages.push({ role: 'assistant', content: JSON.stringify(candidate) })
    if (parsed.success) return parsed.data
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) => `- [${i.path.join('.') || '(root)'}] ${i.message}`)
      .join('\n')
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
  // ANTHROPIC_BASE_URL lets this point at an Anthropic-Messages-compatible
  // gateway (self-host / proxy / third-party relay) instead of api.anthropic.com.
  // The SDK already reads this env var on its own; we pass it explicitly only to
  // LOG the effective endpoint, so a misconfigured relay is obvious in CI output
  // rather than silently hitting the wrong host. Requires a gateway that speaks
  // the native /v1/messages protocol (x-api-key auth) — an OpenAI-only endpoint
  // will NOT work with this SDK.
  const baseURL = process.env.ANTHROPIC_BASE_URL
  const client = new Anthropic(baseURL ? { baseURL } : {})
  console.log(`[eval:llm] endpoint: ${baseURL || 'https://api.anthropic.com (default)'} · model: ${MODEL}`)
  const system = buildNlToConfigSystemPrompt()

  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  if (!files.length) skip(`no golden cases in ${CASES_DIR}`)

  const rows = []
  // 非-crud 场景（片段语料，Wave 1.1 起与 CRUD 同目录）本轮**不评分**：scorer 全是
  // CRUD 形状的（pageSchema/query/table/tableBtns），片段产物量不出有意义的分数，
  // 硬造只会产出恒真的伪信号。跳过必须**响亮**并计入 record —— 否则「没测」会在
  // 报告里伪装成「测了且为 0」，正是 §1.1「没有数字必须长得和数字是 0 不一样」的同一条。
  const skippedScenes = []
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
    if (!isCrudCase(raw)) {
      skippedScenes.push({ file, scene: sceneOf(raw) })
      continue
    }
    const gold = StructuredCrudConfigSchema.parse(raw.config)
    // B2 规格掩码：pinnedDims = NL 真正锁定的维度/字段（scoped 口径只记它们）；
    // fixedFields = NL/契约明确给定的字段 prop（喂给模型）。两者均可选、可增量标注。
    const mask = { pinnedDims: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [] }
    const fixedFields = Array.isArray(raw.fixedFields) ? raw.fixedFields : undefined
    // B3 精修语料：refinements = 按轮次排列的 NL 纠正（只在中文门禁语言上跑）；convergesBy = 该 case
    // 自称的收敛轮数上界（只记录、不门禁）。头条 zero-edit/scoped 口径恒取 turn 0，精修不污染它。
    const refinements = Array.isArray(raw.refinements) && raw.refinements.length ? raw.refinements : null
    const convergesBy = Number.isInteger(raw.convergesBy) ? raw.convergesBy : null
    // 双语：中文（raw.nl）始终跑并作门禁语言；英文（raw.nlEn）有则跑、只观测。
    const langs = [{ lang: 'zh', nl: raw.nl }]
    if (typeof raw.nlEn === 'string' && raw.nlEn.trim()) langs.push({ lang: 'en', nl: raw.nlEn })
    for (const { lang, nl } of langs) {
      process.stdout.write(`[eval:llm] ${file} [${lang}] … `)
      try {
        // turn 0：初稿。头条分（zero-edit/scoped/propF1/…）恒为此轮，精修轮不回写 s。
        // F9：target/mode 是宿主输入（生产里由 detect_project_target + 宿主选 mode 决定，
        // 见 prompt.mjs 头注），故与 fixedFields 一样作「给定」喂入，不再让模型猜。
        // 取自 gold（Zod 已应用默认值，恒有值）——即「按契约应得的宿主上下文」。
        const messages = buildInitialMessages(nl, fixedFields, { target: gold.target, mode: gold.mode })
        const pred = await driveToValidConfig(client, system, messages)
        let compiles = true
        try {
          generateFromConfig(pred)
        } catch {
          compiles = false
        }
        const s = scoreAll(gold, pred, mask)

        // B3：中文语言 + 标了 refinements 时，延续同一段对话逐条喂纠正，记录每轮 scoped 命中，
        // 直到收敛或喂完。初稿已 scoped 命中则 0 次纠正即收敛（zero-edit），不再调用模型。
        let convergence
        if (lang === 'zh' && refinements) {
          const scopedSeq = [s.exactIntentScoped]
          for (const ref of refinements) {
            if (scopedSeq[scopedSeq.length - 1]) break
            messages.push({ role: 'user', content: ref.correction })
            const rPred = await driveToValidConfig(client, system, messages)
            scopedSeq.push(scoreAll(gold, rPred, mask).exactIntentScoped)
          }
          const firstTurn = firstConvergedTurn(scopedSeq.map((v) => ({ exactIntentScoped: v })))
          convergence = { firstTurn, attempts: scopedSeq.length - 1, convergesBy }
        }

        rows.push({ file, lang, ...s, compiles, error: null, fewshotDerived: FEWSHOT_DERIVED.has(file), convergence })
        console.log(
          `intent=${s.exactIntentCore ? 'EXACT' : 'diff'} scoped=${s.exactIntentScoped ? 'ok' : 'X'}${s.exactIntentFull ? '' : s.exactIntentCore ? ' (full:diff)' : ''} propF1=${s.propF1.f1.toFixed(2)} attr=${s.attrAcc.toFixed(2)} actF1=${s.actionsF1.f1.toFixed(2)} btns=${s.tableBtnsMatch ? 'ok' : 'X'} compiles=${compiles ? 'yes' : 'NO'}`
        )
        if (convergence) {
          const ft = convergence.firstTurn
          const label = ft === null ? '未收敛' : ft === 0 ? 'zero-edit' : `第 ${ft} 轮收敛`
          console.log(`           convergence: ${label}（${convergence.attempts} 次纠正尝试${convergesBy ? `，自称 ≤${convergesBy}` : ''}）`)
        }
        if (s.attrMisses.length) console.log(`           attr misses: ${s.attrMisses.join('; ')}`)
        const dimMisses = Object.entries(s.byCapability)
          .filter(([, v]) => v.applicable && !v.pass)
          .map(([k]) => k)
        if (dimMisses.length) {
          console.log(`           dim misses: ${dimMisses.join(', ')}`)
          // 结构化维度（tableBtns/operationColumn/dialogs）逐例展开「期望 vs 实得」——
          // 其余维度的差异 attrMisses/propF1 已覆盖，这里只补 scorer 原本只报维度名的三者。
          for (const dim of dimMisses) {
            const d = describeDimMiss(dim, gold, pred)
            if (d) console.log(`             ${dim}: want ${d.want} | got ${d.got}`)
          }
        }
      } catch (err) {
        rows.push({ file, lang, exactIntentCore: false, exactIntentFull: false, exactIntentScoped: false, byCapability: {}, compiles: false, error: err.message, fewshotDerived: FEWSHOT_DERIVED.has(file) })
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
  // scoped 口径（B2）：只对 NL 锁定维度记分。本 PR 只观测、不门禁（门禁仍落 core，决策 A1'-a）。
  const exactScoped = meanAll((r) => (r.exactIntentScoped ? 1 : 0))
  const exactScopedHeldout = heldout.length ? meanHeldout((r) => (r.exactIntentScoped ? 1 : 0)) : null
  const compileRate = meanAll((r) => (r.compiles ? 1 : 0))
  const propF1 = meanAll((r) => r.propF1?.f1 ?? 0)
  const attrAcc = meanAll((r) => r.attrAcc ?? 0)
  const actF1 = meanAll((r) => r.actionsF1?.f1 ?? 0)

  // B3 收敛（只观测、不门禁）：收敛语料 = 标了 refinements 的中文行；heldout 优先、空则退全量。
  // firstTurn=0 即 zero-edit 收敛（0 次纠正）；null = 喂完所有纠正仍未 scoped 命中。
  const CONVERGE_K = 3
  const convZhRows = zhRows.filter((r) => r.convergence)
  const convHeldout = convZhRows.filter((r) => !r.fewshotDerived)
  const convSource = convHeldout.length ? convHeldout : convZhRows
  const convStats = summarizeConvergence(
    convSource.map((r) => ({ firstTurn: r.convergence.firstTurn })),
    CONVERGE_K
  )

  // 「95% 定义」统一数（只观测、不门禁）：scoped zero-edit ∨ ≤K 轮收敛，按 per-row OR 聚合。
  // 这把 scoped 第一条腿与 convergence 第二条腿合成一个真实数字——此前两条腿分开报、无人算 OR。
  // heldout 优先（门禁总体），空则退全量以避免除零。
  const def95Rows = heldout.length ? heldout : zhRows
  const def95 = summarize95(def95Rows, CONVERGE_K)

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

  // ── 健康门：区分「跑完但什么都没测到」与「模型确实得 0 分」─────────────────────
  // scorers.mjs 里 propSet/formtype/membership/actions 恒 `applicable: () => true`，
  // 因此任何**成功打分**的行都会给 applicable 累加 ≥4。故「所有维度 applicable 全零」
  // ⟺ 没有任何 gold 走到打分器 ⟺ 本次测量根本没发生（典型成因：中继鉴权/额度失败 ——
  // 401 key 错，或 403 not enough member budget 额度耗尽；2026-10-13/14 两夜是后者）。
  // 判别法：servedModel 为空 ⟹ 模型一次都没应答过 ⟹ 传输/鉴权层故障，而非生成器/打分器。
  // 此前这种运行会照常算出门禁 0、写 0.0% 红徽章，并由 workflow 的 always() commit-back
  // 提交回 master —— 把一次**基础设施故障**公开发布成「模型得 0 分」。这条假信号既误导，
  // 又天然不可察觉（看起来就像真实的灾难性回归）。故在此显式拦下，绝不发布百分比。
  const scoredRows = rows.filter((r) => !r.error)
  const applicableTotal = Object.values(byCapability).reduce((a, c) => a + c.applicable, 0)
  if (applicableTotal === 0) {
    const errSample = rows.find((r) => r.error)?.error?.split('\n')[0] ?? '(无 case 产出预测)'
    console.error(
      `\n[eval:llm] MEASUREMENT FAILED — ${rows.length} 行中仅 ${scoredRows.length} 行走到了打分器，` +
        `所有维度 applicable 合计为 0。本次没有测到任何东西，拒绝把它发布成 0% 成绩。\n` +
        `  首个错误：${errSample}`
    )
    // 灰度占位（AI-04 设计的 pending 态）——「没测到」必须长得和「测到 0 分」不一样。
    // 并把**去重后的真实错误**写进产物：此前错误只打到 Actions 日志、不进产物，
    // 于是提交回仓库的那份东西只剩一个 0.0%，事后无法诊断（2026-10-13/14 两夜即如此）。
    const reasons = [...new Set(rows.filter((r) => r.error).map((r) => r.error.split('\n')[0]))].slice(0, 5)
    const failedRecord = {
      measuredAt: new Date().toISOString(),
      model: MODEL,
      servedModel: SERVED_MODELS.size ? [...SERVED_MODELS].join(',') : MODEL,
      measurement: 'failed',
      reason: 'no case reached the scorer (all rows errored) — infrastructure failure, not a 0% score',
      cases: n,
      rows: rows.length,
      erroredRows: rows.length - scoredRows.length,
      sampleErrors: reasons,
      target: TARGET_ACCURACY,
      passed: false,
    }
    const grey = (label) => ({ schemaVersion: 1, label, message: 'measurement failed', color: 'lightgrey' })
    try {
      writeFileSync(ACCURACY_FILE, JSON.stringify(failedRecord, null, 2) + '\n')
      writeFileSync(BADGE_FILE, JSON.stringify(grey('heldout accuracy'), null, 2) + '\n')
      writeFileSync(BADGE_SCOPED_FILE, JSON.stringify(grey('scoped accuracy'), null, 2) + '\n')
      console.error('  (已写入失败记录 + 灰度徽章；数值留待下一次真正测量)')
    } catch (err) {
      console.warn(`  (could not write failure record: ${err.message})`)
    }
    process.exit(1)
  }

  // 按语言汇总 exactIntentCore（留出集优先、空则退回全量）。zh 作门禁、en 只观测。
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
  if (skippedScenes.length) {
    // 响亮报出「未评分」的场景，并给出它去哪了 —— 否则报告读起来像「片段场景答对了 0 条」。
    const byScene = SCENES.filter((s) => s !== 'crud')
      .map((s) => `${s} ${skippedScenes.filter((x) => x.scene === s).length}`)
      .join(' / ')
    console.log(
      `  NOT SCORED:            ${skippedScenes.length} case(s) outside the crud scene (${byScene})` +
        ` — no fragment scorer yet (Wave 1.1); their compile+coverage gate is check:scene-coverage`
    )
  }
  console.log(`  in-schema intent zero-edit (ALL):      ${(exact * 100).toFixed(1)}%`)
  if (exactHeldout !== null) {
    console.log(`  in-schema intent zero-edit (HELDOUT):  ${(exactHeldout * 100).toFixed(1)}%   (target >= ${(TARGET_ACCURACY * 100).toFixed(0)}%, GATED)`)
  }
  // scoped：只记 NL 锁定维度的良定义口径。与 core 并列展示——core 是硬诚实数字（惩罚欠定），
  // scoped 是公平口径（不惩罚 NL 没锁的维度）。本 PR scoped 只观测，门禁仍落 core。
  console.log(`  in-schema intent SCOPED (ALL, observed): ${(exactScoped * 100).toFixed(1)}%   (only NL-pinned dims; decision A1'-a)`)
  if (exactScopedHeldout !== null) {
    console.log(`  in-schema intent SCOPED (HELDOUT):     ${(exactScopedHeldout * 100).toFixed(1)}%   (not gated yet — ratchet target)`)
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
  // B3 收敛（只观测）：≤K 轮内收敛率 + 平均收敛轮数。「95% = scoped zero-edit ∨ ≤K 轮收敛」
  // 的第二条腿。converged/total 旁证——语料小、未收敛会把均值拉偏，必须一起看。
  if (convStats.total) {
    const src = convHeldout.length ? 'HELDOUT' : 'ALL'
    const mean = convStats.meanTurnsToConverge === null ? 'n/a' : convStats.meanTurnsToConverge.toFixed(2)
    console.log(
      `  convergence@${CONVERGE_K} (${src}, observed): ${(convStats.rateAtK * 100).toFixed(0)}%  ` +
        `(${convStats.converged}/${convStats.total} converged; mean turns ${mean})`
    )
  }
  // 「95% 定义」统一数：scoped zero-edit ∨ ≤K 轮收敛（per-case OR）。这才是定义里那个「95」。
  if (def95.rate !== null) {
    const src = heldout.length ? 'HELDOUT' : 'ALL'
    console.log(
      `  95%-definition (${src}, observed): ${(def95.rate * 100).toFixed(1)}%  ` +
        `(scoped zero-edit ∨ ≤${CONVERGE_K}-turn converge; ${def95.pass}/${def95.total})`
    )
  }
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
  // What actually answered. If the server routed our requested id to a
  // different backend, surface it loudly: a committed accuracy number must be
  // attributable to a known model, not a silent substitution.
  const served = [...SERVED_MODELS]
  const servedModel = served.length ? served.join(',') : MODEL
  if (served.length && !served.includes(MODEL)) {
    console.warn(
      `[eval:llm] NOTE: requested model '${MODEL}' but the endpoint served '${servedModel}' ` +
        `(relay alias/routing). Accuracy below is attributed to the SERVED model.`
    )
  }

  const record = {
    measuredAt: new Date().toISOString(),
    model: MODEL,
    servedModel,
    cases: n,
    heldoutCases: heldout.length,
    fewshotDerivedCases: fewshotRows.length,
    target: TARGET_ACCURACY,
    // F9：本次跑批把哪些顶层输入作「宿主给定」喂给了模型。非空 ⟹ 精确命中率的口径是
    // 「给定目标平台/产出形态下」的准确率（与生产一致），**不是**「模型从 NL 猜出 target/mode」。
    // 旧产物无此字段 = 未修 F9 的口径（definition95 上限 67.8%）。见 eval/prompt.mjs 头注。
    givenInputs: ['target', 'mode'],
    // 非-crud 场景的语料条数（Wave 1.1 起与 CRUD 同目录，但无 scorer，故不进任何分母）。
    // 显式落在产物里，使「本次测量不覆盖这几条」事后可诊断，而不是让人以为它们得 0 分。
    notScored: skippedScenes.map((x) => ({ file: x.file, scene: x.scene })),
    inSchemaIntentZeroEdit: Number(gateExact.toFixed(4)),
    inSchemaIntentZeroEditAll: Number(exact.toFixed(4)),
    // scoped 口径（B2，只记 NL 锁定维度；本 PR 观测、未门禁）。heldout 优先，空则退全量。
    inSchemaIntentScoped: Number((exactScopedHeldout ?? exactScoped).toFixed(4)),
    inSchemaIntentScopedAll: Number(exactScoped.toFixed(4)),
    exactIntentFull: Number((exactFullHeldout ?? exactFull).toFixed(4)),
    exactIntentFullAll: Number(exactFull.toFixed(4)),
    propSetF1: Number(propF1.toFixed(4)),
    attributeAccuracy: Number(attrAcc.toFixed(4)),
    actionsF1: Number(actF1.toFixed(4)),
    compileRate: Number(compileRate.toFixed(4)),
    // B3 收敛（只观测、不门禁）。收敛语料为空时整块为 null，表明本次没跑精修语料。
    convergence: convStats.total
      ? {
          k: CONVERGE_K,
          source: convHeldout.length ? 'heldout' : 'all',
          rateAtK: convStats.rateAtK === null ? null : Number(convStats.rateAtK.toFixed(4)),
          meanTurnsToConverge:
            convStats.meanTurnsToConverge === null ? null : Number(convStats.meanTurnsToConverge.toFixed(2)),
          converged: convStats.converged,
          total: convStats.total,
        }
      : null,
    // 「95% 定义」统一数（只观测、不门禁）：scoped zero-edit ∨ ≤K 轮收敛的 per-case OR。
    definition95: def95.rate === null
      ? null
      : {
          k: CONVERGE_K,
          source: heldout.length ? 'heldout' : 'all',
          rate: Number(def95.rate.toFixed(4)),
          pass: def95.pass,
          total: def95.total,
        },
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

  // Second, PARALLEL badge for the scoped metric (B2). The core badge above stays
  // the gated/honest number; this one shows the well-defined "only NL-pinned dims"
  // figure. Written alongside so the plumbing exists; the public README badge is
  // deferred until a real nightly first populates this file (else it 404s).
  const scopedGate = exactScopedHeldout ?? exactScoped
  const spct = scopedGate * 100
  const scopedBadge = {
    schemaVersion: 1,
    label: 'scoped accuracy',
    message: `${spct.toFixed(1)}%`,
    color: spct >= 95 ? 'brightgreen' : spct >= 90 ? 'green' : spct >= 80 ? 'yellow' : 'red',
  }
  try {
    writeFileSync(BADGE_SCOPED_FILE, JSON.stringify(scopedBadge, null, 2) + '\n')
    console.log(`  (scoped badge written to ${BADGE_SCOPED_FILE})`)
  } catch (err) {
    console.warn(`  (could not write scoped badge: ${err.message})`)
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
