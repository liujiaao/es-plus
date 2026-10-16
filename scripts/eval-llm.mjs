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
import { buildInitialMessages, pushAssistant, pushUserCorrection } from './eval/prompt.mjs'
import {
  driveToValidConfig as driveToValidConfigPure,
  isNotMeasured,
  OUTCOME,
} from './eval/repair-loop.mjs'
import { FEWSHOT_DERIVED } from './eval/fewshot-derived.mjs'
import { isCrudCase, sceneOf, SCENES } from './eval/scenes.mjs'
import {
  combine,
  evaluateFloor,
  checkCorpusSize,
  compareToBaseline,
  guardAntiDelete,
  applicableCountsFromCases,
  evaluateHealth,
  orderPlanGatedFirst,
} from './eval/ratchet.mjs'

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
/**
 * `--limit N` = **探针模式**：只跑前 N 条用例，**不写任何产物、不参与门禁**。
 *
 * ## 为什么必须有它（2026-10-15 的教训）
 *
 * 这个脚本花的是真钱、跑一次几十分钟，而它唯一的「配置对不对」的验证手段**就是**
 * 跑完整一轮 —— 于是一次中继换配置/换模型（或额度耗尽）要用一整次跑才发现，
 * 产物还长得像个成绩。探针把这个反馈环从「几十分钟 + 一次污染产物」压到「几分钟 + 零副作用」。
 *
 * 语义上必须**严格**如此，否则它就变成了「跑一部分然后当成成绩」的后门：
 *   · 不写 last-accuracy.json / 徽章（一发即污染 master，而 workflow 的 always() 会提交它）；
 *   · 不做健康门/棘轮/地板（它们的判据都建立在**全量**语料上，小样本无意义）；
 *   · 但**逐条**断言：任何一行打不开、或没编译过，都必须红 —— 探针的全部意义就是
 *     「这套中继能不能跑真实负载」。
 */
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  if (i === -1) return null
  const n = Number(process.argv[i + 1])
  return Number.isInteger(n) && n > 0 ? n : null
})()
const PROBE = LIMIT !== null

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

function textOf(message) {
  return (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/**
 * 降级调用（关掉 thinking）的计数。它不是噪音：一行若**必须**靠降级才答得出，说明中继在
 * 「剥掉 thinking 正文」这条通路上是坏的 —— 数字仍然有效（模型确实答了），但读的人有权知道
 * 有多少行是在**与被测系统略有不同的条件**下测出来的。见 eval/repair-loop.mjs 的 MAX_DEGRADED_ATTEMPTS。
 */
let DEGRADED_CALLS = 0

async function callModel(client, system, messages, opts = {}) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    // 降级调用**整个省掉** `thinking` 字段（而不是传 `{type:'disabled'}`）：省略 =
    // 不带扩展思考，这是各家兼容实现都认得的最小公共面；`disabled` 字面量则是较新的取值，
    // 严格校验的中继可能直接 400 —— 而这条路径存在的全部意义就是「别再把这一轮变成空轮」。
    ...(opts.degraded ? {} : { thinking: { type: 'adaptive' } }),
    system,
    messages,
  })
  if (opts.degraded) DEGRADED_CALLS++
  if (res.model) SERVED_MODELS.add(res.model)
  // stopReason 必须带出来：它决定这一行最终是「模型答错了」（记 0 分，是成绩）还是
  // 「被我们的 8000 token 预算截断」（没测到，不得记 0）。见 eval/repair-loop.mjs 头注。
  return { text: textOf(res), stopReason: res.stop_reason ?? null }
}

/** 自修复环（含空轮重发 + 降级重试）已抽到 ./eval/repair-loop.mjs —— 纯函数、可脚本化单测，见该文件头注。 */
function driveToValidConfig(client, system, messages) {
  return driveToValidConfigPure({
    call: (msgs, opts) => callModel(client, system, msgs, opts),
    messages,
    validate: (candidate) => {
      const parsed = StructuredCrudConfigSchema.safeParse(candidate)
      return parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues }
    },
    pushAssistant,
    pushUserCorrection,
  })
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

  const allFiles = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  // 探针模式只取前 N 条。**注意**：被切的只有「跑谁」，语料派生的一切（notScored/棘轮
  // 计数）在全量模式下才成立，故探针模式下这些一律不参与判定（见 PROBE 分支）。
  const files = PROBE ? allFiles.slice(0, LIMIT) : allFiles
  const startedAt = Date.now()
  if (!files.length) skip(`no golden cases in ${CASES_DIR}`)

  const rows = []
  // 非-crud 场景（片段语料，Wave 1.1 起与 CRUD 同目录）本轮**不评分**：scorer 全是
  // CRUD 形状的（pageSchema/query/table/tableBtns），片段产物量不出有意义的分数，
  // 硬造只会产出恒真的伪信号。跳过必须**响亮**并计入 record —— 否则「没测」会在
  // 报告里伪装成「测了且为 0」，正是 §1.1「没有数字必须长得和数字是 0 不一样」的同一条。
  const skippedScenes = []
  // ── 先编好「跑批计划」，再按**语言优先**排序执行 ───────────────────────────────
  // 为什么不是「逐文件跑 zh+en」：中继额度是有限的，2026-10-15 那一跑就在 133/186 处
  // 撞上 `403 not enough member budget`。逐文件交错时，额度耗尽会同时砍掉**两种语言**的
  // 同一段语料尾部 —— 于是连**门禁语言 zh** 都只剩一个按语料顺序偏置的半截样本
  // （实测：丢失的正是 46–99 整段、若干完整特性族），既不能出分、也不能当基线。
  // 门禁只读 zh 行（见下方 zhRows），en 纯属观测；故把 zh 全部排在前面：
  // 额度再耗尽，最坏也只是观测腿残缺，而 zh 这一份是**完整且无偏**的 —— 一次基础设施
  // 故障从「抹掉整次测量」降级为「少一列观测」。这也让失败**可诊断**：zh 满、en 缺
  // ⟺ 后段额度耗尽，而不是泛泛的「跑挂了」。
  const plan = []
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
    plan.push({ file, gold, mask, fixedFields, refinements, convergesBy, lang: 'zh', nl: raw.nl })
    if (typeof raw.nlEn === 'string' && raw.nlEn.trim()) {
      plan.push({ file, gold, mask, fixedFields, refinements, convergesBy, lang: 'en', nl: raw.nlEn })
    }
  }
  // 门禁语言 zh 排在前（排序稳定，故语言内部仍保持语料顺序 —— 报告可读、可与历史对齐）。
  const planOrdered = orderPlanGatedFirst(plan)
  {
    for (const { file, gold, mask, fixedFields, refinements, convergesBy, lang, nl } of planOrdered) {
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
            // 精修纠正也走同一守卫：空纠正同样会让下一次请求带着空 text block 被严格网关拒。
            pushUserCorrection(messages, String(ref.correction ?? ''))
            const rPred = await driveToValidConfig(client, system, messages)
            scopedSeq.push(scoreAll(gold, rPred, mask).exactIntentScoped)
          }
          const firstTurn = firstConvergedTurn(scopedSeq.map((v) => ({ exactIntentScoped: v })))
          convergence = { firstTurn, attempts: scopedSeq.length - 1, convergesBy }
        }

        rows.push({ file, lang, ...s, compiles, error: null, fewshotDerived: FEWSHOT_DERIVED.has(file), convergence, gold })
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
        // `errorKind` 是这一行最终归因的全部依据（见 eval/repair-loop.mjs 头注）：
        // `model-failure` = 模型答错了 ⟹ 一次**合法测量**，记 0 分才诚实；
        // 其余（空轮 / 截断 / 未知）⟹ 这一行**没测到**，按 0 分计入成绩会低估且可能被发布。
        // 未知归因（例如 SDK 直接抛的传输异常）走白名单外的默认值 —— 保守方向是「没测到」。
        const errorKind = err?.kind ?? null
        rows.push({ file, lang, exactIntentCore: false, exactIntentFull: false, exactIntentScoped: false, byCapability: {}, compiles: false, error: err.message, errorKind, fewshotDerived: FEWSHOT_DERIVED.has(file) })
        console.log(`ERROR(${errorKind ?? 'unknown'}) — ${err.message.split('\n')[0]}`)
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

  // ── 探针模式在此收尾：跑到了、编译过了、产物零副作用 ────────────────────────────
  // 所有全量判据（健康门/地板/棘轮/防删）在这里**必须**短路：它们的分母是整份语料，
  // 拿前 N 条去比只会得到假红或假绿，两种都会教人不要相信这套门禁。
  if (PROBE) {
    const probeErrored = rows.filter((r) => r.error)
    const probeNotMeasured = rows.filter((r) => r.error && isNotMeasured(r.errorKind))
    const probeModelFail = rows.filter((r) => r.error && !isNotMeasured(r.errorKind))
    const probeNoCompile = rows.filter((r) => !r.error && !r.compiles)
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`\n[probe] 探针模式：${files.length} 条用例 → ${rows.length} 行，用时 ${secs}s` +
      `（${(secs / Math.max(rows.length, 1)).toFixed(1)}s/行）`)
    console.log(`[probe] endpoint ${process.env.ANTHROPIC_BASE_URL || '(default)'} · served ${[...SERVED_MODELS].join(',') || '(无)'}`)
    // 两种失败要分开看：未测到 = 中继/通路问题（换条件、换中继）；答错 = 模型/语料问题。
    // 探针对两者**都**失败（探针的意义就是在烧 4 小时前把问题问出来），但措辞必须指对方向。
    console.log(`[probe] 打不开的行：${probeErrored.length}（未测到 ${probeNotMeasured.length} / 答错 ${probeModelFail.length}）` +
      ` / 未编译过的行：${probeNoCompile.length} / 降级调用 ${DEGRADED_CALLS} 次`)
    for (const r of probeErrored.slice(0, 3)) console.error(`[probe]   ✗ ${r.file} [${r.lang}] (${r.errorKind ?? 'unknown'}) — ${String(r.error).split('\n')[0]}`)
    for (const r of probeNoCompile.slice(0, 3)) console.error(`[probe]   ✗ ${r.file} [${r.lang}] — 生成成功但编译失败`)
    if (!SERVED_MODELS.size) {
      console.error(`[probe] ✗ 模型一次都没应答（served 为空）—— 中继鉴权/路由层没通`)
    }
    console.log('[probe] 未写任何产物（无 last-accuracy.json / 无徽章）、未参与门禁判定 —— 探针不许当成绩。')
    const bad = probeErrored.length > 0 || probeNoCompile.length > 0 || !SERVED_MODELS.size
    if (bad) {
      console.error(
        '\n[probe] FAILED —— 别拿它开全量跑。' +
          (probeNotMeasured.length ? `未测到 ${probeNotMeasured.length} 行：中继/通路没通（换条件或换中继）。` : '') +
          (probeModelFail.length ? `答错 ${probeModelFail.length} 行：模型/语料侧的问题（这会在全量里按 0 分计入成绩）。` : '')
      )
      process.exit(1)
    }
    console.log('\n[probe] OK —— 中继通路、生成、编译三者皆通。可以开全量跑了。✔')
    process.exit(0)
  }

  // ── 健康门：区分「跑完但什么都没测到 / 只测到一部分」与「模型确实得 0 分」─────────
  // 判据与论证集中在 eval/ratchet.mjs 的 evaluateHealth（纯函数，故 CI 上免费可验；
  // 此前只有「全 0」一条判据，2026-10-15 首跑的**部分** 403 直接漏过并被发布成 47.0%）。
  // 判别法：**任何**未测到的行都以 0 计入所有分母 ⟹ 部分失败同样是没测到，而且更危险
  // （低但合理的分数看起来像真实回归）。servedModel 为空 ⟹ 模型一次都没应答过。
  const scoredRows = rows.filter((r) => !r.error)
  const applicableTotal = Object.values(byCapability).reduce((a, c) => a + c.applicable, 0)
  const erroredRows = rows.length - scoredRows.length
  // 「打不开」不再是同一件事（2026-10-16 run 38840019126 后补）：模型**答错**的行是一次
  // 合法测量（正确答案就是 0 分），只有「没测到」的行才让整次运行作废。分类依据是
  // repair-loop 抛出的 `err.kind`，白名单方向见 isNotMeasured。详述见 eval/repair-loop.mjs 头注。
  const notMeasuredRows = rows.filter((r) => r.error && isNotMeasured(r.errorKind))
  const modelFailureRows = rows.filter((r) => r.error && !isNotMeasured(r.errorKind))
  // 按语言分开体检：门禁腿（zh）零容忍；观测腿（en）有错则抑制其数字而非作废整次运行
  // （理由见 evaluateHealth 头注 —— 额度硬约束下「截断即全废」会让门禁永远测不出来）。
  const erroredIn = (rs) => rs.filter((r) => r.error).length
  const notMeasuredIn = (rs) => rs.filter((r) => r.error && isNotMeasured(r.errorKind)).length
  const health = evaluateHealth({
    applicableTotal,
    def95,
    rows: rows.length,
    gated: { lang: 'zh', rows: zhRows.length, errored: notMeasuredIn(zhRows) },
    observed: { lang: 'en', rows: enRows.length, errored: notMeasuredIn(enRows) },
  })
  if (modelFailureRows.length) {
    // 响亮报出「这些是真的答错了」——它们**在成绩里**（各分母按 0 计），不是测量故障。
    const byKind = {}
    for (const r of modelFailureRows) byKind[r.errorKind ?? 'unknown'] = (byKind[r.errorKind ?? 'unknown'] ?? 0) + 1
    console.log(
      `[eval:llm] 模型答错（**在成绩里**，按 0 分计）：${modelFailureRows.length} 行 — ` +
        Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' / ')
    )
  }
  for (const w of health.warnings) console.warn(`[eval:llm] 警告 — ${w}`)
  // 观测腿不完整 ⟹ 其数字一律不发布（置 null + 记原因），否则会带着 0 偏向下沉进产物。
  const enIncomplete = erroredIn(enRows) > 0
  if (!health.ok) {
    // 「首个错误」优先报**未测到**的那一行：模型答错的行是成绩的一部分，把它顶在第一行会让
    // 读者以为故障出在它身上（2026-10-16 那次的首条错误正是这类混淆）。
    const errSample =
      (notMeasuredRows[0] ?? rows.find((r) => r.error))?.error?.split('\n')[0] ?? '(无 case 产出预测)'
    console.error(
      `\n[eval:llm] MEASUREMENT FAILED — 拒绝发布百分比：\n` +
        health.failures.map((f) => `  · ${f}`).join('\n') +
        `\n  首个未测到：${errSample}`
    )
    // 拒绝**发布**不等于拒绝**计算**：先把算出来的数打出来（显式标注「未发布」），否则一次
    // 4h45m 的跑批连一个可诊断的数字都不剩（2026-10-16 run 38840019126 就是这样 —— 事后只能
    // 靠日志重建，而那本该是免成本的事）。徽章与产物在此完全不受影响，见下方 writeFileSync。
    const pctOr = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)
    console.error(
      `\n  未发布的诊断（**仅供参考，未进徽章/产物**；未测到的行以 0 计入所有分母，故这些数系统性偏低）：\n` +
        `    cases ${n} · heldout ${heldout.length} · rows ${rows.length}（未测到 ${notMeasuredRows.length} / 答错 ${modelFailureRows.length}）\n` +
        `    95%-definition ∨  ${pctOr(def95.rate)}  (${def95.pass}/${def95.total})  ← 门禁口径\n` +
        `    core（四维，硬诚实口径）  ${pctOr(exactHeldout ?? exact)}\n` +
        `    scoped  ALL ${pctOr(exactScoped)} / HELDOUT ${pctOr(exactScopedHeldout)}\n` +
        `    full    ALL ${pctOr(exactFull)} / HELDOUT ${pctOr(exactFullHeldout)}\n` +
        `    目标 ${(TARGET_ACCURACY * 100).toFixed(0)}% · 降级调用 ${DEGRADED_CALLS} 次`
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
      reason:
        'measurement did not happen (or only partially happened) — NOT a low score. ' +
        `${notMeasuredRows.length} row(s) unmeasured (no text block / truncated) and ` +
        `${modelFailureRows.length} row(s) where the model genuinely failed (those ARE scored, as 0). ` +
        'Unmeasured rows count as 0 in every denominator, so the surviving subset is selection-biased. ' +
        'See failures[] for the exact criteria that rejected it.',
      failures: health.failures,
      cases: n,
      rows: rows.length,
      scoredRows: scoredRows.length,
      erroredRows,
      notMeasuredRows: notMeasuredRows.length,
      modelFailureRows: modelFailureRows.length,
      degradedCalls: DEGRADED_CALLS,
      sampleErrors: reasons,
      target: TARGET_ACCURACY,
      passed: false,
    }
    const grey = (label) => ({ schemaVersion: 1, label, message: 'measurement failed', color: 'lightgrey' })
    try {
      writeFileSync(ACCURACY_FILE, JSON.stringify(failedRecord, null, 2) + '\n')
      writeFileSync(BADGE_FILE, JSON.stringify(grey('heldout 95%-definition'), null, 2) + '\n')
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
  // 观测腿有错 ⟹ 不发数字（`null`），并把原因显式记在产物里 —— 与 notScored 同一原则：
  // 「没测到」绝不能长得像「测到 0 分」，也绝不能长得像「测到 60 分」。
  const byLanguage = {
    zh: langExact(zhRows),
    en: enRows.length && !enIncomplete ? langExact(enRows) : null,
    ...(enIncomplete ? { enSuppressed: `观测腿 ${erroredIn(enRows)}/${enRows.length} 行打不开（中继故障），数字有偏故不发布；门禁腿 zh 完整` } : {}),
  }

  // 门禁数字 = 用户拍板的「95% 定义」：∨ = scoped zero-edit ∨ ≤K 轮收敛（AI-33②）。
  // core（四维 exactIntentCore）**降为并列诊断**：它是硬诚实口径，但作为门禁会永久红
  // （它惩罚 NL 欠定），而永久红等于红盲 —— 比没有门禁更糟（见 eval/ratchet.mjs 头注）。
  // ∨ ≥ core 恒成立（第二条腿是 OR），故门禁确实变松了；补丁是 ④core 非回归地板 +
  // ⑤逐维棘轮（二者同批落地，见下方「regression guards」），三者合起来才无已知失效模式。
  const coreRate = exactHeldout ?? exact
  const gateRate = def95.rate ?? 0
  const gateMetric = 'definition95'

  console.log('\nLayer-2 LLM accuracy (model=' + MODEL + ')')
  console.log('==========================================')
  console.log(`  cases:                 ${n}  (heldout ${heldout.length} / fewshot-derived ${fewshotRows.length})`)
  if (modelFailureRows.length) {
    console.log(
      `  model failures:        ${modelFailureRows.length} row(s) — the model answered but never produced a valid` +
        ` config; they ARE scored (as 0), not a measurement fault`
    )
  }
  if (DEGRADED_CALLS) {
    console.log(
      `  degraded calls:        ${DEGRADED_CALLS} — answer obtained only after disabling thinking` +
        ` (relay drops thinking bodies); those rows were measured under a slightly different condition`
    )
  }
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
  console.log(`  in-schema intent zero-edit (ALL):      ${(exact * 100).toFixed(1)}%   (diagnostic — not the gate)`)
  if (exactHeldout !== null) {
    console.log(`  in-schema intent zero-edit (HELDOUT):  ${(exactHeldout * 100).toFixed(1)}%   (diagnostic — the gate moved to the 95%-definition ∨, see below)`)
  }
  // scoped：只记 NL 锁定维度的良定义口径。与 core 并列展示——core 是硬诚实数字（惩罚欠定），
  // scoped 是公平口径（不惩罚 NL 没锁的维度）。它是门禁 ∨ 的**第一条腿**，但单独不构成门禁。
  console.log(`  in-schema intent SCOPED (ALL, observed): ${(exactScoped * 100).toFixed(1)}%   (leg-1 of the gate ∨; only NL-pinned dims)`)
  if (exactScopedHeldout !== null) {
    console.log(`  in-schema intent SCOPED (HELDOUT):     ${(exactScopedHeldout * 100).toFixed(1)}%   (leg-1 of the gate ∨)`)
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
  // 「95% 定义」统一数：scoped zero-edit ∨ ≤K 轮收敛（per-case OR）。这就是定义里那个「95」，
  // 也正是 exit code 读的那个数（AI-33②：门禁与定义同源，此前门禁读 core 而定义只观测）。
  if (def95.rate !== null) {
    const src = heldout.length ? 'HELDOUT' : 'ALL'
    console.log(
      `  95%-definition (${src}): ${(def95.rate * 100).toFixed(1)}%   (target >= ${(TARGET_ACCURACY * 100).toFixed(0)}%, GATED)  ` +
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

  // ── 回归防线（AI-33 ④⑤⑦）────────────────────────────────────────────────
  // 门禁迁到 ∨ 后，门禁**变松**（∨ ≥ core 恒成立：第二条腿是 OR）。三种失效模式各需补丁：
  //   · core 当门禁       → 永久红 → 红盲（已改：降为诊断，改由地板守）
  //   · ∨ 单独当门禁      → 加简单语料即可稀释均值（→ 逐维棘轮 + 防删难例）
  //   · 棘轮自己也错       → check:ratchet 用合成变异把纯函数打穿（每次 PR 跑，离线免费）
  // 三者合起来才无已知失效模式。此处读 __tests__/golden/accuracy-baseline.json（只由人/PR 修改）。
  const baselineFile = join(__dirname, '..', '__tests__', 'golden', 'accuracy-baseline.json')
  let baseline = null
  try {
    baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
  } catch (err) {
    console.warn(`  (no baseline at ${baselineFile}: ${err.message} — rate ratchet skipped)`)
  }
  const dimRates = Object.fromEntries(
    CAPABILITY_SCORERS.map(({ key }) => [key, byCapability[key].applicable ? byCapability[key].rate : null])
  )
  // 只用 zh 行：双语 case 会在 rows 里出现两次，按行取 gold 会把语料计数翻倍（baseline 是
  // 按**语料用例**计的）。zh 行恰好一条对一个 crud 用例。
  const corpusCounts = applicableCountsFromCases(zhRows.filter((r) => r.gold).map((r) => r.gold), CAPABILITY_SCORERS)
  const guards = combine(
    evaluateFloor({ coreRate, heldoutCases: heldout.length }),
    checkCorpusSize({ heldoutCases: heldout.length }),
    compareToBaseline({ definition95: def95.rate, coreRate, byDimension: dimRates }, baseline),
    guardAntiDelete(corpusCounts, baseline)
  )
  for (const w of guards.warnings) console.log(`  [guard] note: ${w}`)
  if (guards.failures.length) {
    console.error('\n  [guard] REGRESSION GUARDS FAILED:')
    for (const f of guards.failures) console.error(`    ✗ ${f}`)
  } else {
    console.log(`\n  [guard] core floor / heldout size / rate ratchet / anti-delete: all OK`)
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
    // 健康门的体检结果（AI-34）：**门禁腿**走到打分器的行数 = 全量 ⟺ 这是一次完整测量。
    // 门禁腿有错时本文件根本走不到这里（已在健康门 exit 1）；观测腿有错则到这里，但它的
    // 数字已被抑制（见 byLanguage.enSuppressed）。落在产物里是为了让「这份数字是完整的」
    // **自带证据**，而不是要人去翻 Actions 日志。
    scoredRows: scoredRows.length,
    erroredRows,
    // 归因拆开（2026-10-16）：`erroredRows` 含两类，处置相反 ——
    // 「答错」在成绩里（各分母按 0 计），「没测到」才会让整次运行作废（门禁腿有一条即 exit 1）。
    // 落到产物是为了让读者一眼看出这份成绩里有多少分是「模型真答不出」而非「没测到」。
    notMeasuredRows: notMeasuredRows.length,
    modelFailureRows: modelFailureRows.length,
    // 有多少次调用是靠**关掉 thinking**才拿到答案的（见 repair-loop 的 MAX_DEGRADED_ATTEMPTS）。
    // 非零 ⟹ 部分行是在与被测系统略有不同的条件下测出来的，读数字的人有权知道。
    degradedCalls: DEGRADED_CALLS,
    gatedRows: { lang: 'zh', rows: zhRows.length, errored: erroredIn(zhRows) },
    observedRows: { lang: 'en', rows: enRows.length, errored: erroredIn(enRows) },
    target: TARGET_ACCURACY,
    // F9：本次跑批把哪些顶层输入作「宿主给定」喂给了模型。非空 ⟹ 精确命中率的口径是
    // 「给定目标平台/产出形态下」的准确率（与生产一致），**不是**「模型从 NL 猜出 target/mode」。
    // 旧产物无此字段 = 未修 F9 的口径（definition95 上限 67.8%）。见 eval/prompt.mjs 头注。
    givenInputs: ['target', 'mode'],
    // 非-crud 场景的语料条数（Wave 1.1 起与 CRUD 同目录，但无 scorer，故不进任何分母）。
    // 显式落在产物里，使「本次测量不覆盖这几条」事后可诊断，而不是让人以为它们得 0 分。
    notScored: skippedScenes.map((x) => ({ file: x.file, scene: x.scene })),
    // 门禁数字（AI-33②）：= 95% 定义 ∨ = scoped zero-edit ∨ ≤K 轮收敛，与徽章同源。
    gateMetric,
    inSchemaIntentZeroEdit: Number(gateRate.toFixed(4)),
    // core（四维）降为诊断并列公布 —— 不是门禁，不参与 exit code / badge。
    coreRate: Number(coreRate.toFixed(4)),
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
    passed: gateRate >= TARGET_ACCURACY && guards.ok,
  }
  try {
    writeFileSync(ACCURACY_FILE, JSON.stringify(record, null, 2) + '\n')
    console.log(`  (persisted to ${ACCURACY_FILE})`)
  } catch (err) {
    console.warn(`  (could not persist accuracy: ${err.message})`)
  }

  // Shields endpoint payload. The badge label changed in the SAME commit that moved
  // the gate (AI-33②), so the badge can never diverge from what the gate enforces:
  // both now read `gateRate` = the 95%-definition ∨, not the four-dim core.
  const pct = gateRate * 100
  const color = pct >= 95 ? 'brightgreen' : pct >= 90 ? 'green' : pct >= 80 ? 'yellow' : 'red'
  const badge = {
    schemaVersion: 1,
    label: 'heldout 95%-definition',
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

  if (gateRate < TARGET_ACCURACY || !guards.ok) {
    console.error(
      `\n[eval:llm] gate (${gateMetric}) ${(gateRate * 100).toFixed(1)}% is below target ${(TARGET_ACCURACY * 100).toFixed(0)}%` +
        ` (diagnostic core ${(coreRate * 100).toFixed(1)}%)${guards.ok ? '' : ' — regression guards also failed'}.\n` +
        `  The gate is the user-ratified 95% definition: scoped zero-edit ∨ ≤${CONVERGE_K}-turn converge.`
    )
    process.exit(1)
  }
  console.log(`\n[eval:llm] target met (${gateMetric} ${(gateRate * 100).toFixed(1)}%). ✔`)
}

main().catch((err) => {
  console.error('[eval:llm] fatal:', err)
  process.exit(1)
})
