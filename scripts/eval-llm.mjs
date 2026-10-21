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
 *      ──(same config → REAL generate_crud handler, incl. forced no-table)──▶ front-door leg (W1.3)
 *      ──(text PRD → REAL generate_crud surfaces, AN-19)──▶ PRD extraction leg (observed)
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
import { z } from 'zod'
import {
  StructuredCrudConfigSchema,
  generateFromConfig,
  repairConfig,
  buildNlToConfigSystemPrompt,
} from '@es-plus/shared'
import { scoreAll, CAPABILITY_SCORERS, firstConvergedTurn, summarizeConvergence, summarize95, meets95Definition, describeDimMiss } from './eval/scorers.mjs'
import { buildInitialMessages, pushAssistant, pushUserCorrection } from './eval/prompt.mjs'
import {
  driveToValidConfig as driveToValidConfigPure,
  isNotMeasured,
  OUTCOME,
} from './eval/repair-loop.mjs'
import { FEWSHOT_DERIVED } from './eval/fewshot-derived.mjs'
import { isCrudCase, sceneOf } from './eval/scenes.mjs'
import { setupFrontDoor, driveFrontDoor, summarizeFrontDoor } from './eval/front-door-leg.mjs'
import { buildFragmentSystemPrompt, buildFragmentInitialMessages } from './eval/fragment-prompt.mjs'
import { scoreFragment, describeFragmentDimMiss } from './eval/fragment-scorers.mjs'
import { compileProduct, compileFragment, summarizeCompile, fmtError } from './eval/compile-leg.mjs'
import { summarizeFragmentLeg } from './eval/fragment-leg.mjs'
import { loadPrdCases, scorePrdSurfaces, summarizePrd, drivePrdSurfaces } from './eval/prd-leg.mjs'
import { buildPrdSystemPrompt, buildPrdInitialMessages } from './eval/prd-prompt.mjs'
import { deriveSurfaces, compileBlocks, fencedBlocks } from './lib/front-door.mjs'
import {
  buildTypecheckCases,
  runTypecheck,
  summarizeTypecheck,
  sampleTypecheckCases,
  missingComponentDists,
} from './eval/typecheck-leg.mjs'
import { setupFragmentTools } from './lib/fragment-shapes.mjs'
import { FRAGMENT_GENERATORS, fragmentInput } from './lib/fragment-cases.mjs'
import {
  combine,
  evaluateFloor,
  checkCorpusSize,
  checkConvergenceSample,
  compareToBaseline,
  guardAntiDelete,
  applicableCountsFromCases,
  evaluateHealth,
  orderPlanGatedFirst,
} from './eval/ratchet.mjs'
import {
  CASES_DIR,
  ACCURACY_FILE,
  BADGE_FILE,
  BADGE_SCOPED_FILE,
  artifactIdentity as artifactIdentityOf,
  corpusFingerprint,
} from './eval/artifact.mjs'

/** 身份块 + 本次跑批的 fixedFields 口径（诊断开关只在探针里，故正常恒为 false）。 */
const artifactIdentity = (extra) => artifactIdentityOf({ ...extra, fixedFieldsUsed: USE_FIXED_FIELDS })

const __dirname = dirname(fileURLToPath(import.meta.url))
// 产物路径与身份/指纹算法一律来自 `eval/artifact.mjs`（AN-03 单一真源）：
// 写产物的人与校验产物的人必须用同一套算法，否则守卫校验的不是产物实际写下的东西。
// Shields.io "endpoint" badge payload (https://shields.io/badges/endpoint-badge)。
// README points its badge at the raw URL of this file; a nightly commit-back keeps
// the published number honest without a server. Gate number drives it (heldout).
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
/**
 * `--fragments` = **片段探针**：只跑片段语料（table / form / dialog；2026-10-19 起 63 条），CRUD 一条不跑。
 *
 * 语义与 `--limit` 相同 —— 它是探针，不是成绩：不写 `last-accuracy.json` / 徽章、
 * 不参与任何门禁。存在理由：片段测的是另一套工具契约与另一套记分卡，想单独看
 * 「调整片段 prompt 之后准确率动没动」时，没必要为 188 条 CRUD 用例付钱。
 */
const FRAGMENT_ONLY = process.argv.includes('--fragments')
/**
 * `--prd` = **PRD 提取腿探针**：只跑 `__tests__/golden/prd/` 的文本 PRD 语料（AN-19），CRUD 与片段一条不跑。
 *
 * 语义与 `--fragments` 相同 —— 探针，不是成绩：不写产物、不参与门禁。
 * 它测的是**第一英里**（规格 → `generate_crud` 的 surfaces 意图表），与 CRUD 的
 * 「NL → 完整 config」是两套输入/两套记分卡；全量跑时这条腿也在同一批模型调用里观测，
 * 但数字绝不进 95% 门禁（用户拍板的定义只针对 CRUD 语料）。
 */
const PRD_ONLY = process.argv.includes('--prd')
/**
 * `--fixed-fields` = **诊断口径**：把语料的 `fixedFields`（prop 名）喂给模型，复现 B2 时代的
 * 「字段给定」口径。默认**不喂**。
 *
 * 为什么默认改成不喂（AN-01）：生产里宿主手里没有这份 prop 清单 —— 它只给 NL/规格，
 * prop 是模型必须推出来的东西。把 prop 给定会让 `propSet` 退化为「抄写保真度」
 * （历史 98%+），而门禁 `definition95` 的多数 pinnedDims 都含 propSet，于是整体数字被
 * 系统性抬高。保留此开关只为**定位**「字段名推断」与「语义推断」各自贡献多少；
 * 它强制探针模式（不写产物），不允许把诊断口径当成绩。
 */
const USE_FIXED_FIELDS = process.argv.includes('--fixed-fields')
const PROBE = LIMIT !== null || FRAGMENT_ONLY || PRD_ONLY || USE_FIXED_FIELDS

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
      // AN-24：确定性修复环先于 schema 校验。null / 成员布尔字面量 / 弹窗表单项简写
      // 这类**无歧义**的格式错误在这里修掉，不再消耗模型的一轮自纠。
      // 修复只接受「issue 数严格下降」的候选（见 shared/src/repair-config.ts），
      // 因此不会把模型答错的内容猜成答案 —— 它只把「写法的噪声」清掉。
      const prepared = repairConfig(candidate)
      const parsed = StructuredCrudConfigSchema.safeParse(prepared.config)
      return parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues }
    },
    pushAssistant,
    pushUserCorrection,
  })
}

/**
 * 片段场景的自修复环：同一套「空轮重发 / 截断归因 / 降级」逻辑，只把校验器换成该工具
 * **真实注册**的 zod3 shape（`z.object(tool.shape)`，与宿主的 `tools/call` 同源）。
 * 不能用 `StructuredCrudConfigSchema`：片段入参没有 query/table/actions 三面，
 * 拿 CRUD schema 校验只会把每一条都判红（正是 Wave 1.1「恒真伪信号」的镜像）。
 */
function driveFragmentConfig(client, system, messages, schema) {
  return driveToValidConfigPure({
    call: (msgs, opts) => callModel(client, system, msgs, opts),
    messages,
    validate: (candidate) => {
      const parsed = schema.safeParse(candidate)
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
  // W1.3：前门腿的打包放在**任何模型调用之前** —— 它失败说明本脚本根本测不到宣称主路径，
  // 此时应当立即红，而不是先烧掉一次跑批再发现。
  const frontDoor = await setupFrontDoor()
  // 片段场景（AI-SCENE-COVERAGE §1.2）：从**真实注册**里捕获工具名 / description / zod3 形状。
  // prompt 由捕获结果自省生成（不手写第二份键清单），校验器即宿主 `tools/call` 用的同一形状。
  // 与 frontDoor 同理，失败要立即红 —— 「形状都没捕获到」意味着片段这一列的测量根本不成立。
  const fragmentTools = await setupFragmentTools()
  const FRAGMENT_TOOL_NAMES = { table: 'generate_table', form: 'generate_form', dialog: 'generate_dialog' }
  const fragmentSchemas = {}
  const fragmentSystems = {}
  for (const [scene, toolName] of Object.entries(FRAGMENT_TOOL_NAMES)) {
    fragmentSchemas[scene] = z.object(fragmentTools[toolName].shape)
    fragmentSystems[scene] = buildFragmentSystemPrompt(scene, fragmentTools[toolName])
  }

  // ── PRD 提取腿（AN-19）：全量跑与 `--prd` 探针都要跑；其余探针跳过 ────────────────
  // 语料/契约在任何模型调用**之前**校验：坏语料或空契约会让这条腿在「测量不成立」的
  // 状态下烧掉整次跑批。与 check:prd 同一份目录、同一份发布契约（打包自资源模块）。
  const RUN_PRD = PRD_ONLY || !PROBE
  let prdCases = []
  if (RUN_PRD) {
    if (typeof frontDoor.extractionContract !== 'string' || !frontDoor.extractionContract.trim()) {
      console.error(
        '[eval:llm] FAIL — 前门打包里没有 `buildDesignExtractionContent()`：PRD 腿会在空契约上测量。' +
          '（资源模块被删/改名？见 packages/mcp-server/src/resources/design-extraction.ts）'
      )
      process.exit(1)
    }
    const prdDir = join(__dirname, '..', '__tests__', 'golden', 'prd')
    const loaded = loadPrdCases(prdDir)
    if (loaded.errors.length) {
      console.error(`[eval:llm] FAIL — PRD 语料解析失败（${prdDir}）：\n  ${loaded.errors.join('\n  ')}`)
      process.exit(1)
    }
    if (!loaded.cases.length) {
      console.error(`[eval:llm] FAIL — PRD 语料为空（${prdDir}）：这条腿无法产生任何数字。`)
      process.exit(1)
    }
    prdCases = loaded.cases
    console.log(
      `[eval:llm] PRD 语料 ${prdCases.length} 条（契约 ${frontDoor.extractionContract.length} 字符，与发布资源同源）`
    )
  }

  const allFiles = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  // `--fragments` 在**读语料前**就把 CRUD 文件剔掉：`--limit` 是按语料顺序切片，
  // 而 CRUD 用例排在片段之前，所以单靠 `--limit` 永远切不到片段。
  const scopedFiles = PRD_ONLY
    ? []
    : FRAGMENT_ONLY
      ? allFiles.filter((f) => !isCrudCase(JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))))
      : allFiles
  // 探针模式只取前 N 条。**注意**：被切的只有「跑谁」，语料派生的一切（notScored/棘轮
  // 计数）在全量模式下才成立，故探针模式下这些一律不参与判定（见 PROBE 分支）。
  const files = LIMIT !== null ? scopedFiles.slice(0, LIMIT) : scopedFiles
  // AN-03：语料指纹取**全量**语料（`allFiles`），不是本次切片 —— 产物标识的是「这份数字
  // 属于哪一版语料」，`--fragments` 只在片段上跑也不该改变这一判断。
  const identity = artifactIdentity({
    corpusHash: corpusFingerprint(allFiles, CASES_DIR),
    corpusFiles: allFiles.length,
  })
  const startedAt = Date.now()
  if (!files.length && !PRD_ONLY) {
    // 显式要片段却一条都没有 ⟹ 不是「没事可做」，是探针链断了（目录/过滤条件错）。
    // 按 `skip()` 静默放行会让一次 CI 里的 `--fragments` 变成永远绿色的空跑。
    if (FRAGMENT_ONLY) {
      console.error(`[eval:llm] FAIL (--fragments) — ${CASES_DIR} 里没有任何片段用例`)
      process.exit(1)
    }
    skip(`no golden cases in ${CASES_DIR}`)
  }

  const rows = []
  // Tier B 类型腿的候选（AN-14）：成功行留下**模型产出**的 config，跑完后按 target 抽样
  // 走 `vue-tsc`。不存进 row（产物会变大且含非序列化值），只在内存里传到腿那一步。
  const tcCandidates = []
  // 非-crud 语料 = 片段场景（table / form / dialog）。它们**有**自己的记分卡
  // （`eval/fragment-scorers.mjs`），但结论只观测：gate / 徽章 / exit code 仍只读 CRUD 行
  // （用户拍板的 95% 定义是 CRUD 语料的 scoped∨收敛）。这里只收集「没有生成器的未知场景」，
  // 它们连编译都无从谈起，必须响亮记为 notScored 而不是静默丢弃。
  const skippedScenes = []
  const fragmentCases = []
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
      const scene = sceneOf(raw)
      if (!FRAGMENT_GENERATORS[scene]) {
        skippedScenes.push({ file, scene })
      } else {
        fragmentCases.push({ file, scene, raw })
      }
      continue
    }
    const gold = StructuredCrudConfigSchema.parse(raw.config)
    // B2 规格掩码：pinnedDims = NL 真正锁定的维度/字段（scoped 口径只记它们）；
    // fixedFields = NL/契约明确给定的字段 prop（喂给模型）。两者均可选、可增量标注。
    const mask = { pinnedDims: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [] }
    // fixedFields 只在 `--fixed-fields` 诊断口径下喂给模型；默认不喂（AN-01，见开关头注）。
    const fixedFields =
      USE_FIXED_FIELDS && Array.isArray(raw.fixedFields) ? raw.fixedFields : undefined
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
        // AN-12：`compiles` = **产物真的编译过**（SFC 脚本 + 模板 / TS·TSX 模块），
        // 不再只是「generateFromConfig 没抛错」—— 后者只证明配置过了 Zod，产物里的
        // 模板从未被 Vue 编译器看过。`noThrow` 单独保留：生成器抛错与编译失败是两类
        // 故障（前者生成器 bug、后者坏产物），报告必须能分开读。
        let noThrow = true
        let compileError = null
        try {
          const product = generateFromConfig(pred)
          const leg = compileProduct(product, {
            filename: `${String(gold.name || 'generated').replace(/[^\w.-]/g, '_')}.ts`,
          })
          if (!leg.ok) compileError = leg.error
        } catch (err) {
          noThrow = false
          compileError = {
            message: err instanceof Error ? err.message : String(err),
            file: null,
            line: null,
            column: null,
          }
        }
        const compiles = noThrow && compileError === null
        const s = scoreAll(gold, pred, mask)
        // W1.3 前门腿：同一条模型产出再喂一次真 `generate_crud`（不额外调模型）。
        const fd = await driveFrontDoor(frontDoor, pred)

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

        rows.push({ file, lang, ...s, compiles, noThrow, compileError, error: null, fewshotDerived: FEWSHOT_DERIVED.has(file), convergence, gold, frontDoor: fd })
        // 类型腿只吃门禁语言（zh）的模型产出：en 腿与 zh 共用同一份 pred 语义但语料不同，
        // 且 en 不参与门禁；把它混进抽样会稀释每端的真实样本。
        if (lang === 'zh') tcCandidates.push({ id: file, target: gold.target, config: pred })
        console.log(
          `intent=${s.exactIntentCore ? 'EXACT' : 'diff'} scoped=${s.exactIntentScoped ? 'ok' : 'X'}${s.exactIntentFull ? '' : s.exactIntentCore ? ' (full:diff)' : ''} propF1=${s.propF1.f1.toFixed(2)} attr=${s.attrAcc === null ? 'n/a' : s.attrAcc.toFixed(2)} actF1=${s.actionsF1.f1.toFixed(2)} btns=${s.tableBtnsMatch ? 'ok' : 'X'} compiles=${compiles ? 'yes' : 'NO'}`
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
        // 模型答错的行**仍在成绩里**（各分母按 0）：维度适用性由 gold 决定，命中一律 false。
        // 旧写法给 `byCapability: {}`，于是这类行从每个维度的分母里消失，把「模型没答对」
        // 洗成「该维不适用」—— 与 core / definition95 按 0 计入的纪律相矛盾（AN-01）。
        const errCaps = {}
        for (const s of CAPABILITY_SCORERS) {
          errCaps[s.key] = s.applicable(gold)
            ? { applicable: true, pass: false }
            : { applicable: false, pass: null }
        }
        rows.push({
          file,
          lang,
          exactIntentCore: false,
          exactIntentFull: false,
          exactIntentScoped: false,
          byCapability: errCaps,
          attrAcc: null,
          compiles: false,
          // 这类行没有产物可编译：`noThrow`/`compileError` 置中性值与成功行同形，
          // 下游读 `compileError` 时不需要再判 `error`。
          noThrow: true,
          compileError: null,
          error: err.message,
          errorKind,
          fewshotDerived: FEWSHOT_DERIVED.has(file),
          frontDoor: null,
          gold,
        })
        console.log(`ERROR(${errorKind ?? 'unknown'}) — ${err.message.split('\n')[0]}`)
      }
    }
  }

  // ── 片段场景（table / form / dialog）：**观测**准确率 ─────────────────────────
  // 每条用例一次「NL → 工具入参」：系统 prompt 按场景取捕获的真实工具描述，
  // 校验器是宿主 `tools/call` 用的同一份 zod3 shape（含默认值填充），
  // 产物再喂真生成器做编译见证。分数只进 `fragments` 块，不参与 gate / 徽章。
  // 调试子集：`ESPLUS_FRAG_ONLY=frag-form-05-vue3,frag-table-03-vue3` 只跑指定用例。
  // 与 `--limit` 同理是**探针**（不写产物、不参与门禁），用于单案例诊断；
  // 打一行显式日志，避免把子集数字误读成全量成绩。
  const fragOnly = (process.env.ESPLUS_FRAG_ONLY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fragOnly.length) {
    const kept = fragmentCases.filter((c) => fragOnly.includes(c.file.replace(/\.json$/, '')))
    if (!kept.length) {
      console.error(`[probe] ESPLUS_FRAG_ONLY 没有匹配到任何用例：${fragOnly.join(', ')}`)
    } else {
      console.log(
        `[probe] 调试子集：只跑 ${kept.length}/${fragmentCases.length} 条（${kept
          .map((c) => c.file.replace(/\.json$/, ''))
          .join(', ')}）—— 数字不代表全量`
      )
      fragmentCases.splice(0, fragmentCases.length, ...kept)
    }
  }
  const fragmentRows = []
  for (const { file, scene, raw } of fragmentCases) {
    process.stdout.write(`[eval:llm] ${file} [frag:${scene}] … `)
    const gold = fragmentInput({ raw })
    const mask = {
      pinnedDims: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [],
      // 「NL/宿主确实说了」的维度。与 pinnedDims 分开：pinned 只收窄 scoped（门禁观测腿），
      // stated 是公平口径（gold 为运行时 fixture 声明、NL 未要求的键不进分母）。
      statedDims: Array.isArray(raw.nlStatedDims) ? raw.nlStatedDims : [],
    }
    try {
      if (typeof raw.nl !== 'string' || !raw.nl.trim()) throw new Error('语料缺 nl —— 无法驱动模型')
      const messages = buildFragmentInitialMessages(
        raw.nl,
        raw.target,
        USE_FIXED_FIELDS ? raw.fixedFields : undefined
      )
      const pred = await driveFragmentConfig(client, fragmentSystems[scene], messages, fragmentSchemas[scene])
      // AN-12：片段腿同一把尺子 —— 按产物自报的 fence 编译（vue → SFC 模板+脚本；
      // tsx → 模块）。`compiles` 不再只是「生成器没抛错」。
      let noThrow = true
      let compileError = null
      try {
        const out = FRAGMENT_GENERATORS[scene](pred)
        const leg = compileFragment(out, {
          typescript: pred.typescript !== false,
          filename: `${scene}-fragment`,
        })
        if (!leg.ok) compileError = leg.error
      } catch (err) {
        noThrow = false
        compileError = {
          message: err instanceof Error ? err.message : String(err),
          file: null,
          line: null,
          column: null,
        }
      }
      const compiles = noThrow && compileError === null
      const s = scoreFragment(scene, gold, pred, mask)
      const dimMisses = Object.entries(s.byDim)
        .filter(([, v]) => v.applicable && !v.pass)
        .map(([k]) => k)
      fragmentRows.push({
        file,
        scene,
        compiles,
        noThrow,
        compileError,
        error: null,
        errorKind: null,
        gold,
        pred,
        score: s,
        dimMisses,
        fewshotDerived: FEWSHOT_DERIVED.has(file),
      })
      console.log(
        `core=${s.exactIntentCore ? 'EXACT' : 'diff'} scoped=${s.exactIntentScoped ? 'ok' : 'X'}` +
          ` stated=${s.exactIntentStated ? 'ok' : 'X'}` +
          ` full=${s.exactIntentFull ? 'ok' : 'diff'} compiles=${compiles ? 'yes' : 'NO'}`
      )
      if (dimMisses.length) {
        console.log(`           dim misses: ${dimMisses.join(', ')}`)
        for (const dim of dimMisses) {
          const d = describeFragmentDimMiss(dim, gold, pred)
          if (d) console.log(`             ${dim}: want ${d.want} | got ${d.got}`)
        }
        // 单案例诊断：`ESPLUS_FRAG_DUMP=1` 打印模型原始 tool 入参（不落盘）。
        if (process.env.ESPLUS_FRAG_DUMP === '1') {
          console.log(`             pred: ${JSON.stringify(pred)}`)
        }
      }
    } catch (err) {
      const errorKind = err?.kind ?? null
      fragmentRows.push({
        file,
        scene,
        compiles: false,
        noThrow: true,
        compileError: null,
        error: err.message,
        errorKind,
        gold,
        pred: null,
        score: null,
        dimMisses: [],
        fewshotDerived: FEWSHOT_DERIVED.has(file),
      })
      console.log(`ERROR(${errorKind ?? 'unknown'}) — ${err.message.split('\n')[0]}`)
    }
  }

  // ── PRD / 设计稿提取（AN-19）：**观测**第一英里 ───────────────────────────────
  // 输入是文本 PRD（截图/线框由宿主视觉理解后转写成文本，server 不接收图片）；
  // 输出是 `generate_crud` 的 surfaces 意图表。评分只看「哪些面存在、每个面有哪些标签字段」，
  // prop / formtype / 校验 / 接口细节由 CRUD 与片段腿另行测量（见 eval/prd-leg.mjs 头注）。
  // 全量跑时跟着跑（22 条，成本可忽略），`--prd` 探针时单独跑；其余探针不跑。
  const prdRows = []
  if (RUN_PRD) {
    const prdSystem = buildPrdSystemPrompt(
      { name: frontDoor.cap.name, description: frontDoor.cap.desc, shape: frontDoor.cap.shape },
      frontDoor.extractionContract
    )
    // `--limit` 同时约束 PRD（`--prd --limit N` 是「先用 N 条探中继/契约」的用法）。
    const plannedPrd = LIMIT !== null ? prdCases.slice(0, LIMIT) : prdCases
    for (const c of plannedPrd) {
      process.stdout.write(`[eval:llm] ${c.file} [prd] … `)
      try {
        const goldConfig = { target: 'vue3', ...c.raw.config }
        const prdGold = deriveSurfaces(goldConfig, frontDoor.project)
        // 宿主给定项（生产里由项目探测/路由表决定）——只测「面与字段」，不测这些常量。
        const messages = buildPrdInitialMessages(c.spec, {
          name: goldConfig.name,
          apiUrl: goldConfig.apiUrl,
          target: goldConfig.target,
          mode: goldConfig.mode ?? 'schema',
        })
        const pred = await driveFragmentConfig(client, prdSystem, messages, frontDoor.shape)
        const score = scorePrdSurfaces(pred?.surfaces ?? {}, prdGold)
        // 前门落地见证：同一份模型产出再过一次真 handler，产物过 Tier A 编译。
        const landing = await drivePrdSurfaces(frontDoor, pred, goldConfig, compileBlocks, fencedBlocks)
        const compileError = landing.produced
          ? landing.compileFailures.length
            ? { message: landing.compileFailures[0], file: null, line: null, column: null }
            : null
          : { message: landing.rejected ?? '前门没有产出任何围栏代码块', file: null, line: null, column: null }
        const compiles = landing.produced && landing.compileFailures.length === 0
        prdRows.push({
          file: c.file,
          id: c.id,
          pred,
          score,
          produced: landing.produced,
          compiles,
          noThrow: true,
          compileError,
          error: null,
          errorKind: null,
          landing,
          fewshotDerived: false,
        })
        const pct = (ok) => (ok ? 'ok' : 'X')
        console.log(
          `exact=${pct(score.exact)} presence=${pct(score.presence.ok)}` +
            ` membership=${score.membership.rate === null ? 'n/a' : score.membership.rate.toFixed(2)}` +
            ` dialogs=${pct(score.dialogs.ok)} compiles=${compiles ? 'yes' : 'NO'}`
        )
        if (!score.membership.ok && score.membership.misses.length) {
          console.log(`           membership misses: ${score.membership.misses.slice(0, 6).join('; ')}`)
        }
      } catch (err) {
        const errorKind = err?.kind ?? null
        prdRows.push({
          file: c.file,
          id: c.id,
          pred: null,
          score: null,
          produced: false,
          compiles: false,
          noThrow: true,
          compileError: null,
          error: err.message,
          errorKind,
          landing: null,
          fewshotDerived: false,
        })
        console.log(`ERROR(${errorKind ?? 'unknown'}) — ${err.message.split('\n')[0]}`)
      }
    }
  }
  const prdSummary = summarizePrd(prdRows)

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
  const propF1 = meanAll((r) => r.propF1?.f1 ?? 0)
  // 属性准确率只在「有共享字段」的行上有定义（scorers 返回 null）。对 null 行取 0 会把
  // 「无可测项」当成「全错」，取 1 又会真空抬高 —— 故只在可测行上取均值并公布分母。
  const attrRows = zhRows.filter((r) => typeof r.attrAcc === 'number')
  const attrAcc = attrRows.length ? attrRows.reduce((a, r) => a + r.attrAcc, 0) / attrRows.length : null
  const actF1 = meanAll((r) => r.actionsF1?.f1 ?? 0)

  // ── 前门腿汇总（W1.3）──────────────────────────────────────────────────────
  // 只有模型**真的产出了配置**的行才有前门观测（error 行为 null，与 compiles 同一分母纪律）。
  // 判红的两条只对确定性代码负责；模型侧拒绝只计数（见 setupFrontDoor 头注）。
  // 判据与聚合都在 ./eval/front-door-leg.mjs（纯函数，可脚本化单测）。
  const frontDoorStats = summarizeFrontDoor(rows)

  // ── 片段场景汇总（AI-SCENE-COVERAGE §1.2；只观测）────────────────────────────
  // 口径纪律与 CRUD 一致：`model-failure` = 模型答错了 ⟹ **在成绩里**（记 0 分）；
  // `no-answer`/`truncated` = 没测到 ⟹ 不进分母，但必须显式报出条数。
  // 这些数字不参与 gate / 徽章 / exit code —— 用户拍板的 95% 定义只针对 CRUD 语料。
  const fragNotMeasuredRows = fragmentRows.filter((r) => r.error && isNotMeasured(r.errorKind))
  const fragMeasured = fragmentRows.filter((r) => !(r.error && isNotMeasured(r.errorKind)))
  // 编译口径与 CRUD 的 Tier A 腿（AN-13）同一把尺子：分母 = **真有产物**的行。
  // 此前 `compileRate` 用 `measured` 当分母，把「模型答错、根本没产出」也算成编译失败 ——
  // 那会把模型语义 miss 误归因成发射器回归，并让 AN-18 的 `compileRate === 1` 门禁恒红。
  // 未测到仍由本文件的片段门禁单独判红（见 `summarizeFragmentLeg`）。
  const fragCompile = summarizeCompile(fragmentRows)
  const fragHit = (r, sel) => (r.score ? (sel(r.score) ? 1 : 0) : 0)
  const fragMean = (rs, sel) => (rs.length ? rs.reduce((a, r) => a + fragHit(r, sel), 0) / rs.length : null)
  const fragmentSummary = {
    cases: fragmentRows.length,
    measured: fragMeasured.length,
    notMeasured: fragNotMeasuredRows.length,
    core: fragMean(fragMeasured, (s) => s.exactIntentCore),
    full: fragMean(fragMeasured, (s) => s.exactIntentFull),
    scoped: fragMean(fragMeasured, (s) => s.exactIntentScoped),
    stated: fragMean(fragMeasured, (s) => s.exactIntentStated),
    compileRate: fragCompile.rate,
    compileMeasured: fragCompile.measured,
    compileCompiled: fragCompile.compiled,
    compileFailure: fragCompile.failure,
    byScene: {},
    byDim: {},
  }
  for (const scene of ['table', 'form', 'dialog']) {
    const rs = fragMeasured.filter((r) => r.scene === scene)
    if (!rs.length) {
      fragmentSummary.byScene[scene] = null
      continue
    }
    const sceneCompile = summarizeCompile(fragmentRows.filter((r) => r.scene === scene))
    fragmentSummary.byScene[scene] = {
      cases: rs.length,
      core: fragMean(rs, (s) => s.exactIntentCore),
      full: fragMean(rs, (s) => s.exactIntentFull),
      scoped: fragMean(rs, (s) => s.exactIntentScoped),
      stated: fragMean(rs, (s) => s.exactIntentStated),
      compileRate: sceneCompile.rate,
    }
  }
  const fragDimAgg = {}
  for (const r of fragMeasured) {
    for (const [dim, v] of Object.entries(r.score?.byDim ?? {})) {
      if (!v.applicable) continue
      const a = (fragDimAgg[dim] ??= { applicable: 0, pass: 0 })
      a.applicable++
      if (v.pass) a.pass++
    }
  }
  for (const [dim, a] of Object.entries(fragDimAgg)) {
    fragmentSummary.byDim[dim] = {
      applicable: a.applicable,
      pass: a.pass,
      rate: Number((a.pass / a.applicable).toFixed(4)),
    }
  }

  // ── 片段腿门禁（AN-18）─────────────────────────────────────────────────────
  // 基线在此处读取（而不是等到下方回归防线才读），因为片段门禁的 scoped 地板来自它。
  // 基线只由人/PR 修改；夜间 workflow **不**回写，否则一次真实退步会被自动记成新基线，
  // 棘轮就退化成装饰（与 `eval/ratchet.mjs` 头部同一原则）。
  const baselineFile = join(__dirname, '..', '__tests__', 'golden', 'accuracy-baseline.json')
  let baseline = null
  try {
    baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
  } catch (err) {
    console.warn(`  (no baseline at ${baselineFile}: ${err.message} — rate ratchet skipped)`)
  }
  // 纯函数判据见 `eval/fragment-leg.mjs` 头注：编译 100%（分母 = 有产物行）∧
  // scoped ≥ 人工基线 ∧ 零未测到。返回的 failures 进 `passed` / exit code。
  const fragmentStats = summarizeFragmentLeg(fragmentRows, fragmentSummary, baseline)

  if (fragNotMeasuredRows.length) {
    console.warn(
      `[eval:llm] 片段腿：${fragNotMeasuredRows.length}/${fragmentRows.length} 行**未测到**（无 text 块 / 截断）` +
        ` —— 已排除在片段分母外；AN-18 起这条腿会因此判红（测量不完整，不是低分）`
    )
  }

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

  // ── Tier A 编译门（AN-13）─────────────────────────────────────────────────
  // 分母 = **真有产物的行**（`error` 为空）。未测到（no-answer/truncated）与模型答错
  // （model-failure）都没有产物：把前者算作编译失败会让一次中继故障污染编译门，把后者
  // 算进去会让 `compileRate === 1` 在 95% 准确率目标下**永远**不可达（永久红 = 红盲）。
  // 未测到的行仍由健康门对门禁腿零容忍判红（`evaluateHealth`），不靠这条口径兜底。
  // 口径与两个失败类别的拆解在 `compile-leg.mjs` 的 `summarizeCompile` 头注。
  const compileStats = summarizeCompile(zhRows, (r) => meets95Definition(r, CONVERGE_K))
  const compileRate = compileStats.rate

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

  // ── Tier B 类型腿（AN-14，只观测）────────────────────────────────────────────
  // 与 Tier A 的分工见 `typecheck-leg.mjs` 头注：Tier A 证明「能编译」，Tier B 用
  // `vue-tsc` 证明「类型对」—— 缺 `import type { CrudPageSchema }`、事件处理器签名错
  // 这类缺陷 Tier A 恒绿。只观测、不进 `passed` / 徽章 / exit code：当前样本是 TS 投影
  // （金标全是 JS，Volar 对 JS 产物不做模板类型检查，见该文件头注），且计划要求
  // 「先观测、看清失败分布再上闸」。
  const TYPECHECK_SAMPLE = 10
  let typecheckReport = null
  if (tcCandidates.length === 0) {
    typecheckReport = { skipped: '没有 zh 行的模型产出（片段-only / 全部未测到）' }
  } else {
    const missing = missingComponentDists(process.cwd())
    if (missing.length) {
      // 缺 dist **不能**静默跳过 —— 那会把「没测」洗成「类型全对」（红盲）。产物里显式记
      // skipped + 原因、日志里报错；但不打断一次已经跑了几小时的全量。
      typecheckReport = { skipped: `组件包未构建：${missing.join(', ')}` }
      console.error(`[eval:llm] Tier B 类型腿未跑：${typecheckReport.skipped}（先 npm run build:components）`)
    } else {
      const sample = sampleTypecheckCases(tcCandidates, { perTarget: TYPECHECK_SAMPLE })
      const cases = buildTypecheckCases(sample)
      try {
        const tcRows = runTypecheck({ cwd: process.cwd(), cases })
        const rowByFile = new Map(zhRows.map((r) => [r.file, r]))
        const stats = summarizeTypecheck(tcRows, (r) => {
          const row = rowByFile.get(r.id)
          return row ? meets95Definition(row, CONVERGE_K) : true
        })
        typecheckReport = {
          samplePerTarget: TYPECHECK_SAMPLE,
          sampled: sample.length,
          measured: stats.measured,
          checked: stats.checked,
          ok: stats.ok,
          rate: stats.rate === null ? null : Number(stats.rate.toFixed(4)),
          failure: stats.failure,
          modelFailureTypecheck: stats.modelFailureTypecheck,
          notRun: stats.notRun,
          failureSamples: stats.failureSamples,
        }
      } catch (err) {
        // 「腿没跑起来」与「产物类型错」必须分开：前者记 error、后者进 failure。
        typecheckReport = {
          skipped: '腿没跑起来',
          error: err instanceof Error ? err.message.split('\n')[0] : String(err),
        }
        console.error(`[eval:llm] Tier B 类型腿失败：${typecheckReport.error}`)
      }
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
    const probeFragErrored = fragmentRows.filter((r) => r.error)
    const probeFragNoCompile = fragmentRows.filter((r) => !r.error && !r.compiles)
    const probePrdErrored = prdRows.filter((r) => r.error)
    const probePrdNoCompile = prdRows.filter((r) => !r.error && !r.compiles)
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1)
    const totalRows = rows.length + fragmentRows.length + prdRows.length
    console.log(`\n[probe] 探针模式：crud ${files.length} 条 / PRD ${(RUN_PRD ? (LIMIT !== null ? Math.min(LIMIT, prdCases.length) : prdCases.length) : 0)} 条` +
      ` → ${totalRows} 行（crud ${rows.length} / 片段 ${fragmentRows.length} / prd ${prdRows.length}），用时 ${secs}s` +
      `（${(secs / Math.max(totalRows, 1)).toFixed(1)}s/行）`)
    console.log(`[probe] endpoint ${process.env.ANTHROPIC_BASE_URL || '(default)'} · served ${[...SERVED_MODELS].join(',') || '(无)'}`)
    // 两种失败要分开看：未测到 = 中继/通路问题（换条件、换中继）；答错 = 模型/语料问题。
    // 探针对两者**都**失败（探针的意义就是在烧 4 小时前把问题问出来），但措辞必须指对方向。
    console.log(`[probe] 打不开的行：${probeErrored.length}（未测到 ${probeNotMeasured.length} / 答错 ${probeModelFail.length}）` +
      ` / 未编译过的行：${probeNoCompile.length} / 降级调用 ${DEGRADED_CALLS} 次`)
    // Tier B 也要在探针里先问出来：类型腿只在**抽样**上跑，全量 4h 后才发现它红是浪费。
    if (typecheckReport?.skipped) {
      console.log(`[probe] 类型腿：skipped — ${typecheckReport.skipped}`)
    } else if (typecheckReport) {
      const pctTc = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`)
      console.log(
        `[probe] 类型腿（观测）：${pctTc(typecheckReport.rate)}（${typecheckReport.ok}/${typecheckReport.checked}，抽样 ${typecheckReport.sampled}）` +
          ` · 类型错 ${typecheckReport.failure}（其中语义已 miss ${typecheckReport.modelFailureTypecheck}）`
      )
      for (const m of typecheckReport.failureSamples) console.error(`[probe]   ✗ 类型错：${m}`)
    }
    // 前门腿同样要在探针里报：探针的意义是「开全量前把问题问出来」，前门是宣称主路径。
    // 但 `--fragments` 下 CRUD 行数为 0 —— 前门的两条判据（no-table 覆盖 / 路由成功）
    // 是**针对 CRUD 模型产出**的，没有可判的样本 ≠ 失败。这里显式标「不适用」，
    // 而不是把空集合当成红色（否则片段探针永远开不了跑）。
    const frontDoorApplicable = frontDoorStats.rows > 0
    if (frontDoorApplicable) {
      console.log(
        `[probe] 前门腿：${frontDoorStats.rows} 行中 routed ${frontDoorStats.routed} / rejected ${frontDoorStats.rejected}（模型侧，仅记录）` +
          ` / 产物编译失败 ${frontDoorStats.compileFailures.length} / no-table 分支覆盖 ${frontDoorStats.noTableExercised}`
      )
    } else {
      console.log('[probe] 前门腿：本次没有 CRUD 行 → 前门判据不适用（--fragments / --prd）')
    }
    for (const r of probeErrored.slice(0, 3)) console.error(`[probe]   ✗ ${r.file} [${r.lang}] (${r.errorKind ?? 'unknown'}) — ${String(r.error).split('\n')[0]}`)
    for (const r of probeNoCompile.slice(0, 3)) console.error(`[probe]   ✗ ${r.file} [${r.lang}] — 产物编译失败：${fmtError(r.compileError)}`)
    // 片段腿：同样是「真实负载」。探针里也要先问出来（否则全量跑完才发现 18 条全 400）。
    if (fragmentRows.length) {
      const pct = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)
      console.log(
        `[probe] 片段腿：${fragmentRows.length} 条（table ${fragmentRows.filter((r) => r.scene === 'table').length}` +
          ` / form ${fragmentRows.filter((r) => r.scene === 'form').length}` +
          ` / dialog ${fragmentRows.filter((r) => r.scene === 'dialog').length}）` +
          ` — 打不开 ${probeFragErrored.length} / 未编译过 ${probeFragNoCompile.length}` +
          ` / 未测到 ${fragmentSummary.notMeasured}`
      )
      console.log(
        `[probe] 片段准确率（观测）：core ${pct(fragmentSummary.core)} · scoped ${pct(fragmentSummary.scoped)}` +
          ` · stated ${pct(fragmentSummary.stated)} · full ${pct(fragmentSummary.full)} · compiles ${pct(fragmentSummary.compileRate)}` +
          `（分母 measured=${fragmentSummary.measured}）`
      )
      for (const r of probeFragErrored.slice(0, 3)) console.error(`[probe]   ✗ ${r.file} [frag:${r.scene}] (${r.errorKind ?? 'unknown'}) — ${String(r.error).split('\n')[0]}`)
      for (const r of probeFragNoCompile.slice(0, 3)) console.error(`[probe]   ✗ ${r.file} [frag:${r.scene}] — 产物编译失败：${fmtError(r.compileError)}`)
    }
    // PRD 腿：这是「第一英里」的真实负载 —— 契约太长/工具形状太深时中继可能拒绝，
    // 探针必须在开全量前问出来。数字只观测，探针的判据是「打不开/编译不过」。
    if (prdRows.length) {
      const pct = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)
      console.log(
        `[probe] PRD 腿：${prdRows.length} 条 — 打不开 ${probePrdErrored.length}` +
          ` / 未编译过 ${probePrdNoCompile.length} / 未测到 ${prdSummary.notMeasured}`
      )
      console.log(
        `[probe] PRD 面提取（观测）：presence ${pct(prdSummary.presenceRate)}` +
          ` · membership ${pct(prdSummary.membershipRate)}（${prdSummary.membershipCorrect}/${prdSummary.membershipTotal}）` +
          ` · dialogs ${pct(prdSummary.dialogRate)} · exact ${pct(prdSummary.exactRate)}` +
          ` · compiles ${pct(prdSummary.compileRate)}（分母 measured=${prdSummary.measured}）`
      )
      for (const r of probePrdErrored.slice(0, 3)) {
        console.error(`[probe]   ✗ ${r.file} [prd] (${r.errorKind ?? 'unknown'}) — ${String(r.error).split('\n')[0]}`)
      }
      for (const r of probePrdNoCompile.slice(0, 3)) {
        console.error(`[probe]   ✗ ${r.file} [prd] — 产物编译失败：${fmtError(r.compileError)}`)
      }
    }
    if (frontDoorApplicable && !frontDoorStats.ok) {
      for (const m of frontDoorStats.compileFailures.slice(0, 3)) console.error(`[probe]   ✗ 前门产物编译失败：${m}`)
      if (frontDoorStats.noTableExercised === 0) console.error('[probe]   ✗ 前门的 no-table 分支一次都没走到（见 check-front-door 头注）')
      if (frontDoorStats.routed === 0) console.error('[probe]   ✗ 前门没有成功路由任何一行模型产出')
    }
    if (!SERVED_MODELS.size) {
      console.error(`[probe] ✗ 模型一次都没应答（served 为空）—— 中继鉴权/路由层没通`)
    }
    console.log('[probe] 未写任何产物（无 last-accuracy.json / 无徽章）、未参与门禁判定 —— 探针不许当成绩。')
    const bad = probeErrored.length > 0 || probeNoCompile.length > 0 || probeFragErrored.length > 0 || probeFragNoCompile.length > 0 || probePrdErrored.length > 0 || probePrdNoCompile.length > 0 || !SERVED_MODELS.size || (frontDoorApplicable && !frontDoorStats.ok)
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
  // 只数**未测到**的行。绝不要退回 `rs.filter(r => r.error).length`（「一切 error」）：
  // 模型真答错的行是一次**合法测量**（按 0 分计入成绩），把它也算成腿残缺，等于把
  // **模型的成绩**当**中继的故障**上报 —— 实测 run 38871648450 的产物就写着
  // 「观测腿 5/186 行打不开（中继故障）」，而日志里那 5 行全是 ERROR(model-failure)。
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
  // 观测腿有**未测到**的行 ⟹ 其数字一律不发布（置 null + 记原因），否则会带着 0 偏向下沉进产物。
  // 判据必须是「未测到」而非「一切 error」：后者会让一次**模型真答不出**的运行被记成中继故障。
  const enNotMeasured = notMeasuredIn(enRows)
  const enIncomplete = enNotMeasured > 0
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
      ...identity,
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
      // 测量失败时**仍**公布编译腿数字：它是确定性代码的性质，不受中继故障影响，
      // 而且正是读者用来区分「产物坏了」与「没测到」的证据（见 summarizeCompile 头注）。
      compileRate: compileRate === null ? null : Number(compileRate.toFixed(4)),
      compileMeasured: compileStats.measured,
      compileCompiled: compileStats.compiled,
      compileFailure: compileStats.failure,
      modelFailureCompile: compileStats.modelFailureCompile,
      // 类型腿与编译腿同理：确定性代码的性质，不受中继故障影响，失败记录里也要带上。
      typecheck: typecheckReport,
      sampleErrors: reasons,
      // 片段腿不受 CRUD 健康门影响（它是另一套语料/另一套记分卡）：把测到的原样带上，
      // 免得一次 CRUD 侧的中继故障把片段唯一的观测也一起抹掉。
      fragments: {
        ...fragmentSummary,
        // AN-18：失败记录也带上门禁判定，事后能分清「片段腿本身红」与「CRUD 腿没测到」。
        scopedMin: fragmentStats.floor,
        gateOk: fragmentStats.ok,
        gateFailures: fragmentStats.failures,
      },
      // AN-19：PRD 提取腿与 CRUD 健康门无关（另一套语料/另一套记分卡）。失败记录也带上，
      // 免得一次 CRUD 侧中继故障把第一英里唯一的观测一起抹掉。**只观测，不是门禁。**
      prd: prdSummary,
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
    ...(enIncomplete ? { enSuppressed: `观测腿 ${enNotMeasured}/${enRows.length} 行**未测到**（无 text 块 / 截断），数字有偏故不发布；门禁腿 zh 完整` } : {}),
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
    // 只剩「没有片段生成器的未知场景」会走到这里；不是片段语料（那些已进 fragmentRows）。
    console.log(
      `  NOT SCORED:            ${skippedScenes.length} case(s) with an unknown scene` +
        ` (${skippedScenes.map((x) => `${x.file}:${x.scene}`).join(', ')})`
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
  console.log(`  attribute acc (avg, ${attrRows.length}/${n} rows measured): ${attrAcc === null ? 'n/a' : `${(attrAcc * 100).toFixed(1)}%`}`)
  console.log(`  actions F1 (avg):      ${(actF1 * 100).toFixed(1)}%`)
  console.log(
    `  compiles (Tier A, GATED): ${compileRate === null ? 'n/a' : `${(compileRate * 100).toFixed(1)}%`}` +
      `  (${compileStats.compiled}/${compileStats.measured} products)`
  )
  if (compileStats.modelFailureCompile) {
    console.log(
      `    model-wrong but compiled: ${compileStats.modelFailureCompile} row(s) — semantic misses` +
        ` (accuracy gate), NOT compile defects`
    )
  }
  for (const m of compileStats.failureSamples) console.error(`    ✗ compile failure: ${m}`)
  // Tier B 类型腿（只观测）：与 Tier A 并列显示，避免读者把「编译过」当成「类型对」。
  if (typecheckReport?.skipped) {
    console.log(`  typechecks (Tier B, observed): skipped — ${typecheckReport.skipped}`)
  } else if (typecheckReport) {
    console.log(
      `  typechecks (Tier B, observed): ${typecheckReport.rate === null ? 'n/a' : `${(typecheckReport.rate * 100).toFixed(1)}%`}` +
        `  (${typecheckReport.ok}/${typecheckReport.checked} products, sampled ${typecheckReport.sampled})`
    )
    for (const m of typecheckReport.failureSamples) console.error(`    ✗ typecheck failure: ${m}`)
  }
  console.log(
    `  front-door (model out): routed ${frontDoorStats.routed}/${frontDoorStats.rows}` +
      ` · rejected ${frontDoorStats.rejected} (model-side, recorded not gated)` +
      ` · compile failures ${frontDoorStats.compileFailures.length} (GATED)` +
      ` · no-table exercised ${frontDoorStats.noTableExercised} (GATED)`
  )
  // B3 收敛（只观测）：≤K 轮内收敛率 + 平均收敛轮数。「95% = scoped zero-edit ∨ ≤K 轮收敛」
  // 的第二条腿。converged/total 旁证——语料小、未收敛会把均值拉偏，必须一起看。
  if (convStats.total) {
    const src = convHeldout.length ? 'HELDOUT' : 'ALL'
    const mean = convStats.meanTurnsToConverge === null ? 'n/a' : convStats.meanTurnsToConverge.toFixed(2)
    console.log(
      `  convergence@${CONVERGE_K} (${src}, observed): ${(convStats.rateAtK * 100).toFixed(0)}%  ` +
        `(${convStats.converged}/${convStats.total} converged; mean turns ${mean})`
    )
    // AN-02 拆腿：把「初稿就对」与「脚本纠正后对」分开报。混在一起时，读者无法判断
    // ≤K 收敛率里有多少是模型泛化、多少是宿主把答案说出来了。
    console.log(
      `    turn-0 (zero-edit): ${convStats.turn0}/${convStats.total} · ` +
        `scripted correction (≤${CONVERGE_K}): ${convStats.scripted}/${convStats.total}`
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

  // 片段场景（AI-SCENE-COVERAGE §1.2）。**准确率仍分腿报告**：95% 定义是用户对 CRUD
  // 语料拍的板，片段塞进 CRUD 分母会把两个回归信号都稀释。但 AN-18 起**片段自己的**
  // 编译门与 scoped 地板进 `passed` / exit code —— 片段腿红了，夜间就红。
  if (fragmentSummary.cases) {
    const fp = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)
    console.log(`\n  fragment scenes (metrics observed; AN-18 gate: compile 100% ∧ scoped ≥ floor):`)
    console.log(
      `    cases ${fragmentSummary.cases} · measured ${fragmentSummary.measured} · not measured ${fragmentSummary.notMeasured}`
    )
    console.log(
      `    core ${fp(fragmentSummary.core)} · scoped(pinnedDims) ${fp(fragmentSummary.scoped)} · full ${fp(fragmentSummary.full)} · compiles ${fp(fragmentSummary.compileRate)}`
    )
    for (const scene of ['table', 'form', 'dialog']) {
      const s = fragmentSummary.byScene[scene]
      if (!s) continue
      console.log(
        `    ${scene.padEnd(6)} core ${fp(s.core)} · scoped ${fp(s.scoped)} · full ${fp(s.full)} · compiles ${fp(s.compileRate)}  (${s.cases})`
      )
    }
    console.log(
      `    gate (AN-18): ${fragmentStats.ok ? 'PASS' : 'RED'} — scoped ${fp(fragmentStats.scoped)}` +
        ` vs floor ${fp(fragmentStats.floor)} · compile ${fragmentStats.compileCompiled}/${fragmentStats.compileMeasured}` +
        ` · ${fragmentStats.measured}/${fragmentStats.cases} measured`
    )
    for (const f of fragmentStats.failures) console.error(`      ✗ ${f}`)
    console.log(`  by fragment dimension (measured rows; n/a = no case exercises it)`)
    console.log('  ------------------------------------------')
    for (const dim of Object.keys(fragmentSummary.byDim).sort()) {
      const c = fragmentSummary.byDim[dim]
      console.log(`    ${dim.padEnd(34)} ${(c.rate * 100).toFixed(0).padStart(3)}%  (${c.pass}/${c.applicable})`)
    }
  }

  // PRD / 设计稿提取（AN-19）。**只观测**：第一英里的输入（文本规格）与输出（surfaces）都
  // 不同于 CRUD 的 NL→config，且用户拍板的 95% 定义只针对 CRUD 语料。分数不参与 gate/徽章/
  // exit code；`membership` 是面-字段决策的微平均（漏字段与多造字段都算错）。
  // 截图/线框由宿主视觉理解后转写成文本：server 不接收图片，故语料全部是文本。
  if (prdSummary.cases) {
    const pp = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`)
    console.log(`\n  PRD extraction (AN-19; observed — first mile, NOT the 95% gate):`)
    console.log(
      `    cases ${prdSummary.cases} · measured ${prdSummary.measured} · not measured ${prdSummary.notMeasured}`
    )
    console.log(
      `    presence ${pp(prdSummary.presenceRate)} · membership ${pp(prdSummary.membershipRate)}` +
        ` (${prdSummary.membershipCorrect}/${prdSummary.membershipTotal}) · dialogs ${pp(prdSummary.dialogRate)}` +
        ` · exact ${pp(prdSummary.exactRate)} · compiles ${pp(prdSummary.compileRate)}`
    )
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
  // 三者合起来才无已知失效模式。基线已在片段腿处读取（AN-18 需要 fragmentScopedMin），
  // 此处直接复用同一个对象 —— 同一份基线不得读两遍（两份快照会让两条腿看到不同的值）。
  const dimRates = Object.fromEntries(
    CAPABILITY_SCORERS.map(({ key }) => [key, byCapability[key].applicable ? byCapability[key].rate : null])
  )
  // 只用 zh 行：双语 case 会在 rows 里出现两次，按行取 gold 会把语料计数翻倍（baseline 是
  // 按**语料用例**计的）。zh 行恰好一条对一个 crud 用例。
  // 语料级计数必须从**跑批计划**（gold 全量）推导，不能从 rows 推导（AN-04）：
  // 模型答错的行走 catch 分支时可能没有 gold/没走到 scorer，用它算分母会让「模型答错」
  // 伪装成「语料被删」——防删守卫于是对着一次模型故障喊「你删了难例」。
  // 计划里每条 gold 恒在，且 zh 一条对一例（en 是同一 gold 的第二语言行，必须去重）。
  const corpusCounts = applicableCountsFromCases(
    plan.filter((p) => p.lang === 'zh').map((p) => p.gold),
    CAPABILITY_SCORERS
  )
  const guards = combine(
    evaluateFloor({ coreRate, heldoutCases: heldout.length }),
    checkCorpusSize({ heldoutCases: heldout.length }),
    checkConvergenceSample(convStats.total),
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
    ...identity,
    measuredAt: new Date().toISOString(),
    model: MODEL,
    servedModel,
    // 「这份数字是被完整测到的」——观测腿有未测到行时仍发布门禁腿，但状态必须写清楚，
    // 免得读者把 `en: null` 当成「en 只有 0 分」或「这次没跑」。
    measurement: enIncomplete ? 'complete-gated-leg-only' : 'complete',
    cases: n,
    heldoutCases: heldout.length,
    fewshotDerivedCases: fewshotRows.length,
    // 健康门的体检结果（AI-34）：**门禁腿**走到打分器的行数 = 全量 ⟺ 这是一次完整测量。
    // 门禁腿有错时本文件根本走不到这里（已在健康门 exit 1）；观测腿有**未测到**的行则到这里，
    // 但它的数字已被抑制（见 byLanguage.enSuppressed）。落在产物里是为了让「这份数字是完整的」
    // **自带证据**，而不是要人去翻 Actions 日志 —— 故这两个 `errored` 必须是**喂给健康门的同一
    // 判据**（`notMeasuredIn`），否则产物与门禁说的不是一回事（run 38871648450 曾如此）。
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
    gatedRows: { lang: 'zh', rows: zhRows.length, errored: notMeasuredIn(zhRows) },
    observedRows: { lang: 'en', rows: enRows.length, errored: notMeasuredIn(enRows) },
    target: TARGET_ACCURACY,
    // F9：本次跑批把哪些顶层输入作「宿主给定」喂给了模型。非空 ⟹ 精确命中率的口径是
    // 「给定目标平台/产出形态下」的准确率（与生产一致），**不是**「模型从 NL 猜出 target/mode」。
    // 旧产物无此字段 = 未修 F9 的口径（definition95 上限 67.8%）。见 eval/prompt.mjs 头注。
    givenInputs: ['target', 'mode'],
    // 真正「没有生成器、连编译都无从谈起」的未知场景（应为空）。片段语料**不再**在这里：
    // 它们有记分卡且会真实跑，见下方 `fragments`。
    notScored: skippedScenes.map((x) => ({ file: x.file, scene: x.scene })),
    // 片段场景（table / form / dialog）的记分。**准确率分腿报告**（core/stated/full 只观测），
    // 但 AN-18 起 `compile*` 与 `scoped` 进 `passed` / exit code —— 判据与阈值都落到产物里，
    // 读者不必回翻代码才知道这次为什么红（`scopedMin` 来自人工维护的基线）。
    // 口径：core = 四维硬诚实；scoped = 只 AND `pinnedDims`（NL 真正锁定的维度）；
    // stated = 只 AND `nlStatedDims`（语料自证「NL/宿主确实说了」的维度 —— 公平口径）；
    // full = gold 声明的全部维度（**诊断**：含运行时 fixture 键，不作为能力结论）。
    // `notMeasured` 行排除在分母外（中继故障 ≠ 模型答错），
    // 而 `errorKind === 'model-failure'` 的行**在**分母里、按 0 计。byDim 让回归能定位到
    // 「formtype 掉了」还是「容器级词汇掉了」。
    // 编译口径（AN-18）分母 = 真有产物的行，与 Tier A `compileMeasured` 同一把尺子。
    fragments: {
      cases: fragmentSummary.cases,
      measured: fragmentSummary.measured,
      notMeasured: fragmentSummary.notMeasured,
      core: fragmentSummary.core === null ? null : Number(fragmentSummary.core.toFixed(4)),
      scoped: fragmentSummary.scoped === null ? null : Number(fragmentSummary.scoped.toFixed(4)),
      scopedMin: fragmentStats.floor,
      scopedGateOk:
        fragmentStats.floor !== null &&
        fragmentSummary.scoped !== null &&
        Number(fragmentSummary.scoped.toFixed(4)) >= fragmentStats.floor,
      stated: fragmentSummary.stated === null ? null : Number(fragmentSummary.stated.toFixed(4)),
      full: fragmentSummary.full === null ? null : Number(fragmentSummary.full.toFixed(4)),
      compileRate: fragmentSummary.compileRate === null ? null : Number(fragmentSummary.compileRate.toFixed(4)),
      compileMeasured: fragmentSummary.compileMeasured,
      compileCompiled: fragmentSummary.compileCompiled,
      compileFailure: fragmentSummary.compileFailure,
      gateOk: fragmentStats.ok,
      gateFailures: fragmentStats.failures,
      byScene: Object.fromEntries(
        Object.entries(fragmentSummary.byScene).map(([scene, s]) => [
          scene,
          s === null
            ? null
            : {
                cases: s.cases,
                core: Number(s.core.toFixed(4)),
                scoped: Number(s.scoped.toFixed(4)),
                stated: Number(s.stated.toFixed(4)),
                full: Number(s.full.toFixed(4)),
                compileRate: s.compileRate === null ? null : Number(s.compileRate.toFixed(4)),
              },
        ])
      ),
      byDim: fragmentSummary.byDim,
    },
    // PRD / 设计稿提取（AN-19，只观测）。第一英里：文本规格 → `generate_crud` surfaces。
    // `membership` 是面-字段决策的微平均（漏字段/多造字段/放错面都算错）；`exact` 要求
    // presence ∧ membership ∧ dialog 键全对。截图与线框由宿主视觉转写，server 不接收图片。
    // 数字**不进** gate / 徽章 / exit code —— 95% 定义只针对 CRUD 语料（用户拍板）。
    prd: {
      cases: prdSummary.cases,
      measured: prdSummary.measured,
      notMeasured: prdSummary.notMeasured,
      presenceRate: prdSummary.presenceRate === null ? null : Number(prdSummary.presenceRate.toFixed(4)),
      membershipRate: prdSummary.membershipRate === null ? null : Number(prdSummary.membershipRate.toFixed(4)),
      membershipCorrect: prdSummary.membershipCorrect,
      membershipTotal: prdSummary.membershipTotal,
      dialogRate: prdSummary.dialogRate === null ? null : Number(prdSummary.dialogRate.toFixed(4)),
      exactRate: prdSummary.exactRate === null ? null : Number(prdSummary.exactRate.toFixed(4)),
      compileRate: prdSummary.compileRate === null ? null : Number(prdSummary.compileRate.toFixed(4)),
      compileMeasured: prdSummary.compileMeasured,
      compileCompiled: prdSummary.compileCompiled,
      compileFailure: prdSummary.compileFailure,
    },
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
    attributeAccuracy: attrAcc === null ? null : Number(attrAcc.toFixed(4)),
    // 属性可测行数：NULL attrAcc 的行（零共享字段）不参与均值，分母必须可见（AN-01）。
    attributeRows: attrRows.length,
    actionsF1: Number(actF1.toFixed(4)),
    // Tier A 编译门（AN-13）：分母是**有产物的行**（未测到 / 模型答错没有产物，见
    // `summarizeCompile` 头注）。`failure` > 0 或 `compileRate < 1` ⟹ 发射器缺陷，产物即红。
    // `modelFailureCompile` 是「产物能编译但没满足 95% 定义」的行数 —— 属于准确率门禁，
    // 与编译失败分开计数，避免把模型语义 miss 误读成发射器回归。
    compileRate: compileRate === null ? null : Number(compileRate.toFixed(4)),
    compileMeasured: compileStats.measured,
    compileCompiled: compileStats.compiled,
    compileFailure: compileStats.failure,
    modelFailureCompile: compileStats.modelFailureCompile,
    compileFailureSamples: compileStats.failureSamples,
    // Tier B 类型腿（AN-14，只观测）：抽样每端 N=10，`rate` 的分母是**有产物且真被检查**的
    // 抽样行；`skipped` 存在时表示腿未跑（缺组件 dist / 没有 zh 产物），不是「全绿」。
    // 首次上闸前先看清真实失败分布（observe first, gate later）。
    typecheck: typecheckReport,
    // W1.3 前门腿：**模型产出**经真 `generate_crud` 的落地情况（不动模型调用，纯确定性代码）。
    // `compileFailures` / `noTableExercised` 是门禁判据（见 setupFrontDoor 头注）；
    // `rejected` 是模型侧拒绝（isError / 过不了 crudShape），只记录不判红。
    frontDoor: {
      rows: frontDoorStats.rows,
      routed: frontDoorStats.routed,
      rejected: frontDoorStats.rejected,
      compileFailures: frontDoorStats.compileFailures.length,
      noTableExercised: frontDoorStats.noTableExercised,
      ok: frontDoorStats.ok,
    },
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
          // AN-02 两条腿拆开：turn0 = 初稿 scoped 命中；scripted = 纠正后 ≤K 才命中。
          // 二者之和 = withinK（后者是 95% 定义里第二条腿的真实贡献）。
          turn0: convStats.turn0,
          scripted: convStats.scripted,
          withinK: convStats.withinK,
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
    passed:
      gateRate >= TARGET_ACCURACY &&
      guards.ok &&
      frontDoorStats.ok &&
      compileRate === 1 &&
      fragmentStats.ok,
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

  if (
    gateRate < TARGET_ACCURACY ||
    !guards.ok ||
    !frontDoorStats.ok ||
    compileRate !== 1 ||
    !fragmentStats.ok
  ) {
    const fdWhy = frontDoorStats.ok
      ? ''
      : `\n  Front-door leg failed (W1.3): compile failures ${frontDoorStats.compileFailures.length}, ` +
        `no-table exercised ${frontDoorStats.noTableExercised}, routed ${frontDoorStats.routed}/${frontDoorStats.rows}.` +
        `\n  This is a defect in the claimed main path, NOT a model-accuracy result.`
    // Tier A 编译门（AN-13）：把「产物编译不过」单列，且**带 file:line:col**。
    // 它不是模型准确率结果 —— 读者不该从一句「gate 56%」里猜发射器是否坏了。
    const compileWhy =
      compileRate === 1
        ? ''
        : `\n  Tier-A compile leg (AN-13): ${compileStats.compiled}/${compileStats.measured} products compiled` +
          (compileStats.failureSamples.length
            ? `\n    ${compileStats.failureSamples.join('\n    ')}`
            : '') +
          `\n  A product that does not compile is an emitter defect, NOT a model-accuracy result.`
    // 片段腿（AN-18）：独立分母，失败原因原样带出（编译 / 未测到 / 零分母 / 基线缺阈值 / scoped 退步）。
    const fragmentWhy = fragmentStats.ok
      ? ''
      : `\n  Fragment leg failed (AN-18): ${fragmentStats.failures.join('\n    ')}`
    const gateWhy =
      gateRate < TARGET_ACCURACY
        ? `\n[eval:llm] gate (${gateMetric}) ${(gateRate * 100).toFixed(1)}% is below target ${(TARGET_ACCURACY * 100).toFixed(0)}%` +
          ` (diagnostic core ${(coreRate * 100).toFixed(1)}%)`
        : `\n[eval:llm] an independent gate failed while accuracy gate ${gateMetric} is ${(gateRate * 100).toFixed(1)}%`
    console.error(
      `${gateWhy}${guards.ok ? '' : ' — regression guards also failed'}.${fdWhy}${compileWhy}${fragmentWhy}\n` +
        `  The accuracy gate is the user-ratified 95% definition: scoped zero-edit ∨ ≤${CONVERGE_K}-turn converge.`
    )
    process.exit(1)
  }
  console.log(`\n[eval:llm] target met (${gateMetric} ${(gateRate * 100).toFixed(1)}%). ✔`)
}

main().catch((err) => {
  console.error('[eval:llm] fatal:', err)
  process.exit(1)
})
