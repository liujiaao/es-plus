#!/usr/bin/env node
/**
 * AI 案例的**夜间漂移观测**（plan §4.8.4）—— 非门禁、不入库、不发布。
 *
 * ## 它回答的问题
 *
 * 案例页展示的冻结产物（`docs/cases/generated/*.json`）是「某次模型写过这版配置」，不是
 * 「模型必然写出这版」。模型升级 / 中继换服之后，那句话还成不成立？本脚本用**当前模型**
 * 重跑同一段 NL，把新配置与冻结配置做结构距离，报告里逐案列出：
 *
 *   · membership  字段集合（prop）的集合 F1 与两侧独有项
 *   · actions     动作集合（add/edit/view…）
 *   · dialogKeys  弹窗注册键集合
 *   · knobs       formtype / inQuery / inTable / inForm 四项在**交集字段**上的逐项一致率
 *   · exact       四个集合全等且四项旋钮全一致（= 漂移为 0）
 *
 * ## 为什么不做门禁
 *
 * 模型与中继都会抖（见 `docs/internal/ai-showcase-matrix-plan.md` §4.8 与 B8）：漂移成红
 * 只会教会大家忽略红色。报告写进 `--out`（默认 `drift-report/ai-case-drift.json`，已
 * gitignore），由 CI 上传 artifact —— **不提交、不发布**，与 accuracy 产物同一条纪律。
 *
 * 退出码：0 = 报告已写出（**含「模型答错」的行**，那些是成绩不是故障）；
 *         1 = 报告写不出来 / 用法错误；无 key 时与 eval:llm 相同：SKIP 且退出 0
 *         （`--require-key` 时改为 1，供夜间 workflow 用）。
 *
 * 用法：
 *   npm run drift:ai-cases -- --limit 1            # 探针（验收口径：能跑通 --limit 1）
 *   npm run drift:ai-cases                         # 全部可漂移案例
 *   npm run drift:ai-cases -- --only employee-roster --out drift-report/x.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { StructuredCrudConfigSchema, repairConfig, buildNlToConfigSystemPrompt, normalizeFormType } from '@es-plus/shared'
import { buildInitialMessages, pushAssistant, pushUserCorrection } from './prompt.mjs'
import { driveToValidConfig, createResilientTransport } from './repair-loop.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MANIFEST = join(ROOT, 'docs', 'cases', 'ai-cases.json')

const MODEL = process.env.ESPLUS_EVAL_MODEL || 'claude-opus-5'
const MAX_TOKENS = Number(process.env.ESPLUS_EVAL_MAX_TOKENS) || 8000
const MAX_TOKEN_CAP = Math.min(MAX_TOKENS * 4, 64000)

/** 三个成员布尔字段的 schema 默认值是 **true**（`inQuery` 尤其反直觉）—— 比较前必须归一。 */
const MEMBER_DEFAULTS = { inQuery: true, inTable: true, inForm: true }
const KNOBS = ['formtype', ...Object.keys(MEMBER_DEFAULTS)]

/** 字段旋钮（缺省按 schema 默认值补齐；否则「省略 = true」会被误算成「false ≠ true」）。 */
export function knobOf(field) {
  return {
    // formtype 先过别名归一：`datePicker` / `timePicker` 是 schema 承认、三端运行时都认的写法
    // （shared 的 `normalizeFormType`），原样比较会把一次**词形选择**报成结构漂移。
    formtype: field?.formtype ? normalizeFormType(field.formtype) : null,
    inQuery: field?.inQuery ?? MEMBER_DEFAULTS.inQuery,
    inTable: field?.inTable ?? MEMBER_DEFAULTS.inTable,
    inForm: field?.inForm ?? MEMBER_DEFAULTS.inForm,
  }
}

/** 集合比对：F1 用「交集 / 两侧规模」算，空集 vs 空集记 1（两个都没写 = 没漂移）。 */
export function setDiff(frozenValues, candidateValues) {
  const frozen = [...new Set(frozenValues)].filter((v) => v != null).sort()
  const candidate = [...new Set(candidateValues)].filter((v) => v != null).sort()
  const fs = new Set(frozen)
  const cs = new Set(candidate)
  const inter = frozen.filter((v) => cs.has(v))
  const union = frozen.length + candidate.length - inter.length
  return {
    same: union === inter.length,
    f1: union === 0 ? 1 : Math.round((2 * inter.length * 1000) / (frozen.length + candidate.length)) / 1000,
    onlyInFrozen: frozen.filter((v) => !cs.has(v)),
    onlyInCandidate: candidate.filter((v) => !fs.has(v)),
  }
}

/**
 * 结构距离 —— 纯函数，无 SDK、无文件 IO（单测见 `ai-case-drift.test.mjs`）。
 *
 * 缺省补齐放在**两侧**：冻结配置与候选配置用同一套归一，否则「显式写 true」与「省略（默认 true）」
 * 会被判成不一致 —— 这正是 golden 语料里踩过的 inQuery 默认值陷阱。
 */
export function structuralDistance(frozen, candidate) {
  const ff = Array.isArray(frozen?.fields) ? frozen.fields : []
  const cf = Array.isArray(candidate?.fields) ? candidate.fields : []
  const props = setDiff(ff.map((f) => f.prop), cf.map((f) => f.prop))
  const actions = setDiff(frozen?.actions ?? [], candidate?.actions ?? [])
  const dialogKeys = setDiff(Object.keys(frozen?.dialogs ?? {}), Object.keys(candidate?.dialogs ?? {}))

  const byProp = new Map(cf.map((f) => [f.prop, knobOf(f)]))
  const shared = ff.filter((f) => byProp.has(f.prop))
  const knobs = {}
  const mismatches = {}
  for (const key of KNOBS) {
    let matched = 0
    const diff = []
    for (const f of shared) {
      const want = knobOf(f)[key]
      const got = byProp.get(f.prop)[key]
      if (want === got) matched += 1
      else diff.push({ prop: f.prop, frozen: want, candidate: got })
    }
    knobs[key] = shared.length === 0 ? 1 : Math.round((matched * 1000) / shared.length) / 1000
    if (diff.length) mismatches[key] = diff.slice(0, 12)
  }

  return {
    props,
    actions,
    dialogKeys,
    knobs,
    knobMismatches: mismatches,
    sharedFields: shared.length,
    exact:
      props.same && actions.same && dialogKeys.same && KNOBS.every((k) => knobs[k] === 1),
  }
}

/**
 * 哪些案例可以漂移观测：有 NL **且**有冻结配置。
 *
 * 只有 NL 没有冻结配置（`replay.kind: unavailable`）就没有「原地」可比，硬比只会把
 * 「历史产物没保存」混进「模型漂移」；手工案例同理。跳过原因逐条写进报告，不静默。
 */
export function selectDriftCases(manifest, { limit = null, only = null } = {}) {
  const cases = []
  const skipped = []
  for (const c of manifest?.cases ?? []) {
    const configPath = c?.artifacts?.config
    if (!configPath) {
      skipped.push({ id: c.id, reason: `没有冻结配置（replay: ${c?.replay?.kind ?? 'unknown'}）` })
      continue
    }
    if (!c?.provenance?.nl) {
      skipped.push({ id: c.id, reason: '没有 NL（不是模型生成的案例）' })
      continue
    }
    cases.push({
      id: c.id,
      nl: c.provenance.nl,
      frozenModel: c.provenance.model ?? null,
      frozenAt: c.provenance.generatedAt ?? null,
      target: Array.isArray(c.targets) && c.targets.length ? c.targets[0] : 'vue3',
      mode: c.mode ?? 'schema',
      configPath,
    })
  }
  const filtered = only ? cases.filter((c) => c.id === only) : cases
  return { cases: limit != null ? filtered.slice(0, limit) : filtered, skipped }
}

function argValue(flag) {
  // 两种写法都认：`--limit 1` 与 `--limit=1`。只认空格写法会让 `--limit=1` 被静默当成
  // 「没传」—— 一次本该只花 1 次模型调用的探针会跑全量（案例变多后就是真金白银）。
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  if (inline != null) {
    const v = inline.slice(flag.length + 1)
    if (!v) {
      console.error(`✗ ${flag}= 需要一个值`)
      process.exit(2)
    }
    return v
  }
  const i = process.argv.indexOf(flag)
  if (i === -1) return null
  const v = process.argv[i + 1]
  if (!v || v.startsWith('--')) {
    console.error(`✗ ${flag} 需要一个值`)
    process.exit(2)
  }
  return v
}

const LIMIT = (() => {
  const raw = argValue('--limit')
  if (raw == null) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`✗ --limit 需要正整数（实得 ${raw}）`)
    process.exit(2)
  }
  return n
})()
const ONLY = argValue('--only')
const OUT = resolve(ROOT, argValue('--out') || 'drift-report/ai-case-drift.json')
const REQUIRE_KEY = process.argv.includes('--require-key')

function skip(msg) {
  if (REQUIRE_KEY) {
    console.error(`[drift] FAIL (--require-key) — ${msg}`)
    process.exit(1)
  }
  console.log(`[drift] SKIP — ${msg}`)
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

const textOf = (message) =>
  (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const { cases, skipped } = selectDriftCases(manifest, { limit: LIMIT, only: ONLY })
  if (!cases.length) {
    console.error(`[drift] 没有可漂移观测的案例${ONLY ? `（--only ${ONLY}）` : ''}；清单：${MANIFEST}`)
    process.exit(1)
  }

  const Anthropic = await loadSdk()
  const baseURL = process.env.ANTHROPIC_BASE_URL
  const timeout = Number(process.env.ESPLUS_EVAL_TIMEOUT_MS) || 180000
  const client = new Anthropic({ ...(baseURL ? { baseURL } : {}), maxRetries: 0, timeout })
  // 中继抖动按 eval:llm 同一套处置（冷却等待而非快速失败）—— 见 repair-loop.mjs 头注。
  const transport = createResilientTransport({
    onRetry: (err, n) => console.warn(`[drift] 传输重试 ${n} 次：${String(err?.message ?? err).split('\n')[0]}`),
    onWait: ({ cooldownMs }) => console.warn(`[drift] 中继不可用，冷却 ${Math.round(cooldownMs / 1000)}s 后重试`),
  })
  const callModel = async (messages, opts = {}) => {
    const res = await transport.run(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? MAX_TOKENS,
        ...(opts.degraded ? {} : { thinking: { type: 'adaptive' } }),
        system: buildNlToConfigSystemPrompt(),
        messages,
      }),
    )
    return { text: textOf(res), stopReason: res.stop_reason ?? null }
  }

  console.log(
    `[drift] endpoint: ${baseURL || 'https://api.anthropic.com (default)'} · model: ${MODEL}` +
      ` · 案例 ${cases.length} 个（跳过 ${skipped.length}）`,
  )

  const rows = []
  for (const spec of cases) {
    const frozenPath = join(ROOT, spec.configPath)
    if (!existsSync(frozenPath)) {
      rows.push({ ...spec, outcome: 'missing-frozen', error: `冻结配置不存在：${spec.configPath}` })
      console.warn(`[drift] ${spec.id} — 冻结配置不存在：${spec.configPath}`)
      continue
    }
    const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'))
    const messages = buildInitialMessages(spec.nl, undefined, { target: spec.target, mode: spec.mode })
    process.stdout.write(`[drift] ${spec.id} … `)
    try {
      const candidate = await driveToValidConfig({
        call: callModel,
        messages,
        validate: (c) => {
          const prepared = repairConfig(c)
          const parsed = StructuredCrudConfigSchema.safeParse(prepared.config)
          return parsed.success ? { success: true, data: parsed.data } : { success: false, issues: parsed.error.issues }
        },
        pushAssistant,
        pushUserCorrection,
        maxTokens: MAX_TOKENS,
        maxTokenCap: MAX_TOKEN_CAP,
      })
      const distance = structuralDistance(frozen, candidate)
      rows.push({
        id: spec.id,
        outcome: 'measured',
        frozenConfig: spec.configPath,
        frozenModel: spec.frozenModel,
        frozenAt: spec.frozenAt,
        target: spec.target,
        mode: spec.mode,
        distance,
      })
      console.log(distance.exact ? '无漂移' : `漂移（props F1 ${distance.props.f1}）`)
    } catch (err) {
      // 「模型答错」也是一次合法观测（模型变了），如实记录；但**没测到**（空轮/截断/超时）
      // 要单独标出来，否则报告会把它读成「漂移很大」。
      rows.push({
        id: spec.id,
        outcome: err?.kind && String(err.kind).includes('model') ? 'model-failure' : 'not-measured',
        errorKind: err?.kind ?? null,
        error: String(err?.message ?? err).split('\n')[0].slice(0, 600),
        frozenConfig: spec.configPath,
        frozenModel: spec.frozenModel,
        frozenAt: spec.frozenAt,
        target: spec.target,
        mode: spec.mode,
      })
      console.log(`未拿到合法配置（${err?.kind ?? 'error'}）`)
    }
  }

  const measured = rows.filter((r) => r.outcome === 'measured')
  const report = {
    $comment:
      'AI 案例漂移观测（scripts/eval/ai-case-drift.mjs）。非门禁、不入库、不发布：只作 CI artifact。' +
      'distance 的含义见脚本头注；exact=true 表示与冻结配置结构完全一致。',
    generatedAt: new Date().toISOString(),
    model: MODEL,
    endpoint: baseURL || 'https://api.anthropic.com',
    limit: LIMIT,
    only: ONLY,
    summary: {
      selected: cases.length,
      measured: measured.length,
      exact: measured.filter((r) => r.distance.exact).length,
      modelFailure: rows.filter((r) => r.outcome === 'model-failure').length,
      notMeasured: rows.filter((r) => r.outcome !== 'measured' && r.outcome !== 'model-failure').length,
      skipped: skipped.length,
    },
    rows,
    skipped,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    `[drift] 报告 → ${OUT}（测量 ${measured.length}/${cases.length}，无漂移 ${report.summary.exact}，` +
      `未测到 ${report.summary.notMeasured}，跳过 ${skipped.length}）`,
  )
}

// 只在直接运行时跑模型：被 import（单测）时不得触发网络调用。
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`[drift] FAIL — ${err?.stack ?? err}`)
    process.exit(1)
  })
}
