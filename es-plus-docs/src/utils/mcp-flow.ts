// AI CRUD page orchestration — runs the SAME tool implementations the MCP
// server uses, but inside the browser, so the docs visitor can see the protocol
// flow that Claude Code / Cursor / Continue would otherwise hide. There's no
// real MCP transport here (stdio doesn't reach the browser); we surface each
// step as a TraceEntry so the page's Trace tab mirrors what an MCP-aware
// client logs in its IDE.
//
// Two paths, both backed by @es-plus/shared:
//
//  - **Offline (no AI key / AI unavailable)** — calls `generateCrudSchema`
//    (NL → CrudPageSchema + wrapper SFC). This is the SAME function the CLI's
//    built-in generator and the MCP `generate_crud_schema` tool call, so the
//    fallback is literally "what you get without a model".
//
//  - **AI (with API key)** — asks the LLM to produce a `StructuredCrudConfig`
//    (validated against the zod schema MCP server uses), then calls
//    `generateFromConfig` for the final SFC. Validation failure triggers one
//    retry with errors fed back to the AI; second failure falls through to the
//    offline path so the user still sees output — but the UI is told, so it
//    never presents rule-engine output as AI output.
//
//  - **AI, single scene** — the model may instead answer with a tool envelope
//    (`{"tool":"generate_table"|"generate_form"|"generate_dialog","args":{…}}`).
//    That routes to the SAME fragment generators the MCP server exposes
//    (`generateTableBlock` / `generateFormBlock` / `generateDialogBlock`), so a
//    request like「只做一个筛选表单」no longer gets squeezed through the CRUD
//    page adapter. Envelope handling exists **only here** (site prompt); the
//    eval prompt in shared stays untouched. Offline has no fragment fallback —
//    the rule engine is CRUD-only, and the UI says so instead of pretending.

import {
  generateCrudSchema,
  generateFromConfig,
  generateTableBlock,
  generateFormBlock,
  generateDialogBlock,
  describeUnrenderedFeatures,
  StructuredCrudConfigSchema,
  FORM_TYPES,
  VALID_FORM_TYPES,
  FORM_TYPE_ALIASES,
  buildNlToConfigSystemPrompt,
  type CrudSchemaResult,
  type FragmentResult,
  type StructuredCrudConfig,
  type TargetFramework,
} from '@es-plus/shared'

// ─── public types ─────────────────────────────────────────────────────────

export type TraceKind =
  | 'user_message'
  | 'mcp_resource_fetch'
  | 'ai_request'
  | 'ai_response'
  | 'mcp_tool_call'
  | 'mcp_validation'
  | 'config_diff'
  | 'render'

export type TraceStatus = 'success' | 'error' | 'retry' | 'cached'

export interface TraceEntry {
  id: string
  ts: number
  kind: TraceKind
  toolName?: string
  resourceUri?: string
  title: string
  summary: string
  input?: unknown
  output?: unknown
  durationMs: number
  status: TraceStatus
  error?: string
  diff?: { added: string[]; removed: string[]; modified: string[] }
  messageId?: string
}

export interface ChatMessage {
  id: string
  ts: number
  role: 'user' | 'assistant'
  content: string
  /** Set when AI mode produced a StructuredCrudConfig — used to seed next turn */
  configSnapshot?: StructuredCrudConfig
  /**
   * 片段轮次的上下文快照。回灌给模型时用的就是**协议原本的形状**
   * （`{"tool":…,"args":…}`），因此「再加一列」这类追问看到的是上一轮信封，
   * 而不是一段自然语言摘要。
   */
  fragmentSnapshot?: { tool: string; args: Record<string, unknown> }
  traceIds?: string[]
  fieldsCount?: number
  columnsCount?: number
}

export interface AiCredentials {
  apiKey: string
  baseUrl: string
  model: string
}

export interface FlowOptions {
  ai?: AiCredentials
  onTrace: (entry: TraceEntry) => void
  signal?: AbortSignal
  /** Last AI-produced config (only meaningful in AI mode for multi-turn) */
  currentConfig?: StructuredCrudConfig
  /**
   * 目标渲染端：'vue3' | 'vue2' | 'antdv'。
   *
   * 这是 es-plus 的核心卖点（同一份配置 → 三端），所以它必须是**用户可选的**，
   * 而不是让模型猜：
   *  - 离线路径把它直接传给 generateCrudSchema(description, target)；
   *  - AI 路径在 schema 校验通过后把它落到 config.target 上（generateFromConfig
   *    通过 readTarget(config) 读它），因此模型自己写了什么都会被这里的显式选择覆盖。
   */
  target?: TargetFramework
}

/**
 * Uniform preview-ready result the page renders. Both paths populate the same
 * `formItems` / `columns` / `code` so the existing preview pipeline doesn't
 * need to branch on which path generated them.
 */
export interface FlowResult {
  message: ChatMessage
  formItems: unknown[]
  columns: unknown[]
  toolbarBtns: unknown[]
  code: string
  /** What to display in the JSON tab — shape depends on path */
  jsonView: unknown
  /** Set only on AI path success — passed back next turn as `currentConfig` */
  structuredConfig?: StructuredCrudConfig
  traceIds: string[]
  /**
   * Human-readable notes about features the prompt asked for but the preview
   * can't fully render (multi-tab dialog, multi-step form, etc.). UI shows
   * these above the preview as an info alert so users don't think the
   * generator silently dropped the feature.
   */
  featureHints: string[]
  /**
   * 生成过程中被降级/剥离的诉求（例如 schema 无法内联的 render）。
   * 与 featureHints 的区别：featureHints 是「识别到了但预览画不出来」，
   * warnings 是「这条路径表达不了，产物里已经不存在」。
   */
  warnings: string[]
  /**
   * 实时预览要渲染的 **CrudPageSchema 对象** —— 与「生成代码」里 `pageSchema`
   * 同一份数据，交给真正的 `<es-crud-page>` 渲染。
   *
   * 存在的理由：此前预览在浏览器里另写了一套字段白名单（只取 prop/label/…），
   * 于是弹窗、操作按钮、批量选择、树表、行内编辑这些**产物里有的东西**在预览里
   * 全部消失。预览必须渲染生成物，而不是生成物的一个子集。
   */
  previewSchema?: Record<string, unknown>
  /** 本次实际走通的引擎 —— UI 的标签必须跟随事实，不能只看「有没有填 key」 */
  engine: 'ai' | 'rule' | 'rule-fallback'
  /** engine === 'rule-fallback' 时说明为什么（OpenAI 报错 / 两次校验失败 / 中断） */
  fallbackReason?: string
  /** 本次生成实际使用的渲染端（供 UI 显示，避免用户以为切了没生效） */
  target: TargetFramework
  /**
   * 产物形态：`crud` = 整页（两条路径都能出）；`fragment` = 单场景片段
   * （仅 AI 路径 —— 离线规则引擎没有片段入口，见 shared `generateTableBlock` 等）。
   * 预览按 `kind` 分支渲染，而不是把片段硬塞进 `<es-crud-page>`。
   */
  kind: 'crud' | 'fragment'
  /** kind === 'fragment' 时的载荷（归一化后的工具入参 + 产物源码） */
  fragment?: {
    kind: 'table' | 'form' | 'dialog'
    /** 已归一化的工具 args，可直接交给预览渲染器 */
    config: Record<string, unknown>
    code: string
    summary: string
  }
}

// ─── internals ────────────────────────────────────────────────────────────

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`

interface PushTraceArg extends Omit<TraceEntry, 'id' | 'ts' | 'durationMs'> {
  startedAt: number
}

function pushTrace(opts: FlowOptions, ids: string[], arg: PushTraceArg): TraceEntry {
  const { startedAt, ...rest } = arg
  const entry: TraceEntry = {
    id: newId(),
    ts: Date.now(),
    durationMs: Date.now() - startedAt,
    ...rest,
  }
  ids.push(entry.id)
  opts.onTrace(entry)
  return entry
}

function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const e = new Error('aborted')
    ;(e as Error & { name: string }).name = 'AbortError'
    throw e
  }
}

// ─── system prompt / AI call ──────────────────────────────────────────────

/**
 * system prompt —— 直接使用 @es-plus/shared 的单一真源 `buildNlToConfigSystemPrompt()`，
 * 只在末尾追加本页特有的两段上下文（MCP 工具说明、多轮「现有配置」）。
 *
 * 此前本文件手写了一份 prompt 与一份 `STRUCTURED_CONFIG_SKETCH`，从不 import shared，
 * 结果是**与 CLI / MCP / eval 三处的 steering 完全脱钩**：它教的是已废弃的
 * `formtype:'datePicker'` 拼写，`target` 也漏了 `antdv`，且示例强度弱于官方 few-shot。
 * shared 侧任何 prompt 改进都到不了这个对外演示页 —— 而它正是外部用户的第一触点。
 *
 * 保留 shared 的语义规则 + 6 个 few-shot，不再是「关键词表」式指引。
 */
function buildSystemPrompt(
  currentConfig: StructuredCrudConfig | undefined,
  target: TargetFramework,
): string {
  const ctx = currentConfig
    ? `Existing config (refine/extend it — do not replace from scratch):\n\`\`\`json\n${JSON.stringify(currentConfig, null, 2)}\n\`\`\``
    : 'Existing config: (none — this is the first turn)'
  // 目标渲染端由界面决定。告诉模型是为了让它按对应框架组织语义；
  // 即便它写错，返回前也会被显式覆盖（见 override target 那处 trace）。
  const targetLine = `Target renderer: "${target}" (chosen by the user in the UI — always emit target: "${target}").`
  const tools = [
    '# Available MCP tools (the server runs these on your behalf)',
    '- generate_crud_from_config(config) → produces the SFC + page schema',
    '- validate_config(config) → zod-validates against StructuredCrudConfigSchema',
    '- generate_table(args) / generate_form(args) / generate_dialog(args) → single-scene fragments',
    '',
    '# When to answer with a tool envelope instead of a config',
    'If the request is ONE surface only (just a filter form, just a data table, just a dialog), do NOT emit a whole CRUD page — emit exactly one tool envelope:',
    '{"tool":"generate_form","args":{"fields":[{"prop":"keyword","label":"关键词","formtype":"Input"}]}}',
    'Allowed envelopes: generate_table | generate_form | generate_dialog. `args.fields` uses the SAME field vocabulary as the config above (prop/label/formtype/width/align/dataOptions/required/attrs…).',
    '- generate_table also accepts: apiUrl, tableOptions, pagination, rowButtons ([{name,type,key}])',
    '- generate_form also accepts: buttons ("none"|"query"|"submit"), context ("query"|"form"), formLayout {labelWidth,minFoldRows}',
    '- generate_dialog also accepts: defaultTitle, mode ("composable"|"component"), options {width,…}, apiUrl, rowkey',
    'If the request spans query + table + create/edit/delete (a full page), ignore the envelopes and emit a StructuredCrudConfig as usual.',
  ].join('\n')

  return [buildNlToConfigSystemPrompt(), '', tools, '', targetLine, '', ctx].join('\n')
}

async function callOpenAI(
  ai: AiCredentials,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  signal: AbortSignal | undefined,
): Promise<string> {
  const res = await fetch(`${ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model: ai.model,
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('OpenAI returned no content')
  return content
}

// ─── validation + diff ────────────────────────────────────────────────────

interface ValidationOutcome {
  ok: boolean
  config?: StructuredCrudConfig
  errors: string[]
}

function validateConfig(raw: unknown): ValidationOutcome {
  const parsed = StructuredCrudConfigSchema.safeParse(raw)
  if (parsed.success) return { ok: true, config: parsed.data, errors: [] }
  const errors = parsed.error.issues.map(
    (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
  )
  return { ok: false, errors }
}

export function diffConfigs(
  prev: StructuredCrudConfig | undefined,
  next: StructuredCrudConfig,
): { added: string[]; removed: string[]; modified: string[] } {
  if (!prev) return { added: next.fields.map((f) => f.prop), removed: [], modified: [] }
  const prevByProp = new Map(prev.fields.map((f) => [f.prop, f]))
  const nextByProp = new Map(next.fields.map((f) => [f.prop, f]))
  const added: string[] = []
  const removed: string[] = []
  const modified: string[] = []
  for (const prop of nextByProp.keys()) {
    if (!prevByProp.has(prop)) added.push(prop)
    else if (JSON.stringify(prevByProp.get(prop)) !== JSON.stringify(nextByProp.get(prop))) {
      modified.push(prop)
    }
  }
  for (const prop of prevByProp.keys()) {
    if (!nextByProp.has(prop)) removed.push(prop)
  }
  return { added, removed, modified }
}

// ─── shape adapters ───────────────────────────────────────────────────────

/**
 * Default placeholder per formtype — mirrors the offline engine. Without this
 * the AI path's preview renders empty input boxes (Element Plus's el-input
 * has no built-in placeholder, only el-select / el-date-picker do), which
 * looks broken next to the documented offline-path behavior.
 */
function defaultPlaceholder(label: string, formtype: string): string {
  switch (formtype) {
    case 'Select':
    case 'Cascader':
    case 'Radio':
    case 'Checkbox':
    case 'Transfer':
    case 'datePicker':
    case 'timePicker':
      return `请选择${label}`
    case 'Upload':
      return `请上传${label}`
    case 'Switch':
    case 'Rate':
    case 'Slider':
    case 'ColorPicker':
      return label
    default:
      return `请输入${label}`
  }
}

/**
 * Pick spans so every row totals exactly 24. Keeps the form grid aligned
 * regardless of how the AI mixed datePicker (typically 8) with Input (6).
 */
function pickSpans(formItems: any[]): void {
  if (formItems.length === 0) return
  const wantsWide = formItems.some(
    (f) => f.formtype === 'datePicker' || f.formtype === 'timePicker' || f.formtype === 'Cascader',
  )
  const baseSpan = wantsWide ? 8 : 6
  const perRow = 24 / baseSpan
  formItems.forEach((f, i) => {
    const positionInRow = i % perRow
    const isLastInRow = positionInRow === perRow - 1
    const isLastOverall = i === formItems.length - 1
    if (isLastOverall && !isLastInRow) {
      f.span = 24 - positionInRow * baseSpan
    } else {
      f.span = baseSpan
    }
  })
}

function withPreviewPolish(items: any[]): any[] {
  const out = items.map((it) => ({
    ...it,
    attrs: {
      clearable: it.formtype !== 'Switch' && it.formtype !== 'Rate' && it.formtype !== 'Slider',
      placeholder: it.attrs?.placeholder || defaultPlaceholder(it.label || it.prop, it.formtype),
      ...(it.attrs ?? {}),
    },
  }))
  pickSpans(out)
  return out
}

/**
 * 预览映射：只从 **CrudPageSchema 本身**取值，交给 `<es-crud-page>` 渲染。
 *
 * 此前这里有两套手写白名单（AI 路径一套、离线路径一套），都只挑
 * `prop/label/formtype/width/align` —— 于是配置里的 `dialogs`、`toolbarBtns`、
 * `tableOptions.multiSelect/virtual`、`editRender`、`expandConfig` 在预览里
 * 全部消失，而「生成代码」里明明有。预览与产物必须是同一份 schema 的两种视图。
 *
 * 操作列不在这里补：`es-crud-page` 按 `actions`/`operationColumn` 在运行时追加
 * （core `resolveCrudActions` 是唯一判据）。
 */
function previewFromSchema(schema: {
  formItems?: unknown[]
  columns?: unknown[]
}): {
  formItems: unknown[]
  columns: unknown[]
} {
  return {
    formItems: withPreviewPolish((schema.formItems ?? []) as any[]),
    columns: schema.columns ?? [],
  }
}

// ─── single-scene fragments ───────────────────────────────────────────────

type FragmentKind = 'table' | 'form' | 'dialog'

const FRAGMENT_TOOLS: Record<string, FragmentKind> = {
  generate_table: 'table',
  generate_form: 'form',
  generate_dialog: 'dialog',
}

const VALID_FORM_TYPE_SET: ReadonlySet<string> = new Set(VALID_FORM_TYPES)

interface FragmentRun {
  kind: FragmentKind
  /** 归一化后的工具入参 —— 预览直接按它渲染 */
  config: Record<string, unknown>
  result: FragmentResult
}

/**
 * 片段工具入参的归一化。
 *
 * 模型给的是 JSON，而 `SurfaceField` 要求 `prop` / `label` 非空、`formtype` 属于
 * 协议枚举（规范写法 ∪ 旧别名）。这里只做**确定性修补**：缺 label 用 prop 顶上、
 * 缺/错 formtype 落 Input，并把每一处修补写进 warnings —— 与站点其它路径同一条
 * 规矩：能修就修，修了必须说。
 */
function normalizeFragmentFields(
  raw: unknown,
): { fields: Record<string, unknown>[]; warnings: string[] } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const fields: Record<string, unknown>[] = []
  const warnings: string[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const src = item as Record<string, unknown>
    const prop = typeof src.prop === 'string' ? src.prop.trim() : ''
    if (!prop) continue
    let label = typeof src.label === 'string' ? src.label.trim() : ''
    if (!label) {
      label = prop
      warnings.push(`字段 ${prop} 缺少 label，已用 prop 顶替`)
    }
    const rawType = typeof src.formtype === 'string' ? src.formtype : ''
    const formtype = FORM_TYPE_ALIASES[rawType] ?? (rawType || 'Input')
    if (!VALID_FORM_TYPE_SET.has(formtype)) {
      warnings.push(
        `字段 ${prop} 的 formtype "${rawType || '(缺失)'}" 不在协议枚举内，已按 Input 处理`,
      )
      fields.push({ ...src, prop, label, formtype: 'Input' })
      continue
    }
    fields.push({ ...src, prop, label, formtype })
  }
  if (fields.length === 0) return null
  return { fields, warnings }
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
}

function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) && v.length > 0 ? v : undefined
}

/**
 * 识别 `{"tool":…,"args":…}` 工具信封并跑**上线那条片段生成器**。
 *
 * 返回 `null` = 这不是信封（交给 StructuredCrudConfigSchema 照常校验）；
 * 返回 `{ error }` = 是信封但入参不可用（走一次修复重试，而不是静默当配置校验，
 * 那会给模型一堆 prop/label 缺失的无关报错）。
 */
function routeFragmentEnvelope(
  raw: unknown,
  target: TargetFramework,
): FragmentRun | { error: string } | null {
  const envelope = asObject(raw)
  if (!envelope || typeof envelope.tool !== 'string') return null
  const kind = FRAGMENT_TOOLS[envelope.tool]
  if (!kind) return null

  const args = asObject(envelope.args)
  if (!args) return { error: `工具 ${envelope.tool} 缺少 args 对象` }
  const normalized = normalizeFragmentFields(args.fields)
  if (!normalized) {
    return {
      error: `工具 ${envelope.tool} 的 args.fields 必须是至少一个 {prop,label} 字段的数组`,
    }
  }
  const { fields, warnings } = normalized

  if (kind === 'table') {
    const tableOptions = asObject(args.tableOptions)
    const pagination = asObject(args.pagination)
    const rowButtons = asArray(args.rowButtons)
    const apiUrl = typeof args.apiUrl === 'string' ? args.apiUrl : undefined
    const result = generateTableBlock({
      fields: fields as never,
      apiUrl,
      tableOptions: tableOptions as never,
      pagination: pagination as never,
      rowButtons: rowButtons as never,
      target,
    })
    return {
      kind,
      config: { fields, apiUrl, tableOptions, pagination, rowButtons },
      result: { ...result, warnings: [...warnings, ...result.warnings] },
    }
  }

  if (kind === 'form') {
    const formLayout = asObject(args.formLayout)
    const buttons = args.buttons === 'query' || args.buttons === 'submit' ? args.buttons : 'none'
    const context = args.context === 'query' ? 'query' : 'form'
    const result = generateFormBlock({
      fields: fields as never,
      buttons,
      context,
      formLayout: formLayout as never,
      target,
    })
    return {
      kind,
      config: { fields, buttons, context, formLayout },
      result: { ...result, warnings: [...warnings, ...result.warnings] },
    }
  }

  const mode = args.mode === 'component' ? 'component' : 'composable'
  const options = asObject(args.options)
  const defaultTitle = typeof args.defaultTitle === 'string' ? args.defaultTitle : undefined
  const rowkey = typeof args.rowkey === 'string' ? args.rowkey : undefined
  const apiUrl = typeof args.apiUrl === 'string' ? args.apiUrl : undefined
  const result = generateDialogBlock({
    fields: fields as never,
    mode,
    options: options as never,
    defaultTitle,
    rowkey,
    apiUrl,
    target,
  })
  return {
    kind,
    // dialog 的产物是 composable（.tsx）或 SFC，预览侧只需要 fields + 标题/宽度。
    config: { fields, mode, options, defaultTitle, rowkey, apiUrl },
    result: { ...result, warnings: [...warnings, ...result.warnings] },
  }
}

/** 信封里声明的工具名（仅用于 trace 标题；非信封时回落通用校验器名） */
function envelopeToolName(raw: unknown): string {
  const env = asObject(raw)
  return typeof env?.tool === 'string' ? env.tool : 'validate_config'
}

// ─── main flow ────────────────────────────────────────────────────────────
export async function mcpFlow(
  prompt: string,
  history: ChatMessage[],
  opts: FlowOptions,
): Promise<FlowResult> {
  const traceIds: string[] = []
  const flowStart = Date.now()

  // 1. user_message — always
  pushTrace(opts, traceIds, {
    startedAt: flowStart,
    kind: 'user_message',
    title: prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt,
    summary: `${prompt.length} chars`,
    output: { prompt },
    status: 'success',
  })

  let validatedConfig: StructuredCrudConfig | undefined
  /**
   * 单场景片段的产物（AI 路径特有）。与 validatedConfig 互斥：
   * 同一次回答要么是整页配置，要么是一个片段工具信封。
   */
  let fragmentRun: FragmentRun | undefined
  /**
   * 为什么最后没用上 AI 产物。非空且走到离线分支时，UI 必须显示
   * 「规则引擎（AI 失败回退）」—— 否则「填了 key 就显示 AI 引擎」会让
   * 一次失败的调用看起来像一次成功的 AI 生成。
   */
  let aiFailure: string | undefined

  // ── AI path ────────────────────────────────────────────────────────────
  if (opts.ai?.apiKey) {
    const tStart = Date.now()
    pushTrace(opts, traceIds, {
      startedAt: tStart,
      kind: 'mcp_resource_fetch',
      resourceUri: 'esplus://types',
      title: 'esplus://types',
      summary: `${FORM_TYPES.length} form types loaded`,
      output: { formTypes: FORM_TYPES },
      status: 'cached',
    })

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: buildSystemPrompt(opts.currentConfig, opts.target ?? 'vue3') },
    ]
    for (const m of history.slice(-6)) {
      if (m.role === 'user') messages.push({ role: 'user', content: m.content })
      else if (m.configSnapshot) {
        messages.push({ role: 'assistant', content: JSON.stringify(m.configSnapshot) })
      } else if (m.fragmentSnapshot) {
        messages.push({ role: 'assistant', content: JSON.stringify(m.fragmentSnapshot) })
      }
    }
    messages.push({ role: 'user', content: prompt })

    let attempt = 0
    let lastRaw = ''
    while (attempt <= 1 && !validatedConfig) {
      checkAborted(opts.signal)
      const reqStart = Date.now()
      pushTrace(opts, traceIds, {
        startedAt: reqStart,
        kind: 'ai_request',
        title: attempt === 0 ? 'OpenAI chat/completions' : 'OpenAI chat/completions (retry)',
        summary: `${messages.length} messages · model=${opts.ai.model}`,
        input: { model: opts.ai.model, messageCount: messages.length },
        status: attempt === 0 ? 'success' : 'retry',
      })

      try {
        lastRaw = await callOpenAI(opts.ai, messages, opts.signal)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        aiFailure = `OpenAI 调用失败：${msg}`
        pushTrace(opts, traceIds, {
          startedAt: reqStart,
          kind: 'ai_response',
          title: 'OpenAI error',
          summary: msg,
          status: 'error',
          error: msg,
        })
        break
      }

      pushTrace(opts, traceIds, {
        startedAt: reqStart,
        kind: 'ai_response',
        title: 'OpenAI response',
        summary: `${lastRaw.length} chars`,
        output: lastRaw.slice(0, 800),
        status: 'success',
      })

      const valStart = Date.now()
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(lastRaw)
      } catch {
        parsedJson = null
      }

      // 单场景片段：模型按站点 prompt 的信封协议回答时，走片段生成器，而不是
      // 把「只做一个筛选表单」硬掰成一整页 CRUD。
      const routed = routeFragmentEnvelope(parsedJson, opts.target ?? 'vue3')
      if (routed && !('error' in routed)) {        fragmentRun = routed
        pushTrace(opts, traceIds, {
          startedAt: valStart,
          kind: 'mcp_tool_call',
          toolName: `generate_${routed.kind}`,
          title: `generate_${routed.kind}`,
          summary: routed.result.summary,
          input: { fields: (routed.config.fields as unknown[]).length },
          output: {
            warnings: routed.result.warnings,
            codePreview: routed.result.code.slice(0, 400),
          },
          status: 'success',
        })
        break
      }

      const outcome: ValidationOutcome =
        routed && 'error' in routed
          ? { ok: false, errors: [routed.error] }
          : validateConfig(parsedJson)
      // 片段信封失败时的回退原因必须说「片段入参不可用」，而不是
      // 「未通过 StructuredCrudConfigSchema 校验」—— 它压根没走那个 schema。
      if (routed && 'error' in routed) {
        aiFailure = `片段工具入参不可用：${routed.error}`
      }
      pushTrace(opts, traceIds, {
        startedAt: valStart,
        kind: 'mcp_validation',
        toolName: routed ? envelopeToolName(parsedJson) : 'validate_config',
        title: routed ? envelopeToolName(parsedJson) : 'validate_config',
        summary: outcome.ok
          ? 'StructuredCrudConfigSchema ✓'
          : `${outcome.errors.length} validation errors`,
        input: parsedJson,
        output: outcome.ok ? { valid: true, errors: [] } : { valid: false, errors: outcome.errors },
        status: outcome.ok ? 'success' : 'error',
        error: outcome.ok ? undefined : outcome.errors.slice(0, 3).join('; '),
      })

      if (outcome.ok && outcome.config) {
        validatedConfig = outcome.config
        break
      }

      attempt += 1
      if (attempt <= 1) {
        messages.push({ role: 'assistant', content: lastRaw })
        messages.push({
          role: 'user',
          content: `Your last response failed validation:\n${outcome.errors.map((e) => `- ${e}`).join('\n')}\n\nPlease respond with the full corrected JSON.`,
        })
      }
    }
    if (!validatedConfig && !fragmentRun) {
      aiFailure ??= '模型两次输出都未通过 StructuredCrudConfigSchema 校验'
    }
  }

  // ── AI path: single-scene fragment ────────────────────────────────────
  if (fragmentRun) {
    const { kind, config, result } = fragmentRun
    const target = opts.target ?? 'vue3'
    pushTrace(opts, traceIds, {
      startedAt: Date.now(),
      kind: 'render',
      title: 'render: preview / code / json',
      summary: `tabs updated (fragment=${kind}, target=${target})`,
      status: 'success',
    })
    const fields = config.fields as { prop: string; label: string }[]
    return {
      message: {
        id: newId(),
        ts: Date.now(),
        role: 'assistant',
        content: result.summary,
        fragmentSnapshot: { tool: `generate_${kind}`, args: config },
        traceIds,
        fieldsCount: fields.length,
        // 片段没有「列数」概念 —— 表格片段的列就是字段，其余场景为 0。
        columnsCount: kind === 'table' ? fields.length : 0,
      },
      formItems: [],
      columns: [],
      toolbarBtns: [],
      code: result.code,
      jsonView: config,
      structuredConfig: undefined,
      previewSchema: undefined,
      traceIds,
      featureHints: [],
      warnings: result.warnings,
      engine: 'ai',
      target,
      kind: 'fragment',
      fragment: { kind, config, code: result.code, summary: result.summary },
    }
  }

  // ── AI path final codegen ─────────────────────────────────────────────
  if (validatedConfig) {
    checkAborted(opts.signal)
    // 渲染端由界面决定，不由模型决定：模型可能在 config 里写了自己的 target（甚至
    // 没写而落到 schema 默认值 vue3）。这里显式覆盖，保证「用户选了 vue2 就真的出 vue2」，
    // 否则三端选择器会是个摆设。generateFromConfig 内部通过 readTarget(config) 读它。
    const target = opts.target ?? validatedConfig.target ?? 'vue3'
    if (validatedConfig.target !== target) {
      pushTrace(opts, traceIds, {
        startedAt: Date.now(),
        kind: 'mcp_validation',
        toolName: 'override_target',
        title: 'override target',
        summary: `模型给出 ${validatedConfig.target ?? '(未指定)'} → 按界面选择覆盖为 ${target}`,
        input: { modelTarget: validatedConfig.target, uiTarget: target },
        output: { target },
        status: 'success',
      })
      validatedConfig.target = target
    }
    const genStart = Date.now()
    const generated = generateFromConfig(validatedConfig)
    pushTrace(opts, traceIds, {
      startedAt: genStart,
      kind: 'mcp_tool_call',
      toolName: 'generate_crud_from_config',
      title: 'generate_crud_from_config',
      summary: `${generated.code.length} chars of code · ${generated.warnings.length} warnings · target=${target}`,
      input: {
        fields: validatedConfig.fields.length,
        mode: validatedConfig.mode ?? 'schema',
        target,
      },
      output: {
        summary: generated.summary,
        warnings: generated.warnings,
        codePreview: generated.code.slice(0, 400),
      },
      status: 'success',
    })

    if (opts.currentConfig) {
      const diff = diffConfigs(opts.currentConfig, validatedConfig)
      pushTrace(opts, traceIds, {
        startedAt: Date.now(),
        kind: 'config_diff',
        title: 'config diff',
        summary: `+${diff.added.length} -${diff.removed.length} ~${diff.modified.length}`,
        diff,
        status: 'success',
      })
    }

    pushTrace(opts, traceIds, {
      startedAt: Date.now(),
      kind: 'render',
      title: 'render: preview / code / json',
      summary: 'tabs updated',
      status: 'success',
    })

    // 预览渲染的是**生成物本身**：schema 模式直接复用 generated.schema；sfc 模式
    // 没有 schema 视图，就用同一份配置再生成一次 schema 视图（只是视图，不改产物）。
    // 此前预览另写一套字段白名单，弹窗/操作按钮/批量选择/行内编辑在预览里全部消失。
    const previewSchema =
      generated.schema ??
      generateFromConfig({ ...validatedConfig, mode: 'schema' }).schema ??
      {}
    const preview = previewFromSchema(previewSchema)
    return {
      message: {
        id: newId(),
        ts: Date.now(),
        role: 'assistant',
        content: generated.summary,
        configSnapshot: validatedConfig,
        traceIds,
        fieldsCount: validatedConfig.fields.length,
        columnsCount: validatedConfig.fields.filter((f) => f.inTable !== false).length,
      },
      formItems: preview.formItems,
      columns: preview.columns,
      toolbarBtns: [],
      code: generated.code,
      jsonView: validatedConfig,
      structuredConfig: validatedConfig,
      previewSchema,
      traceIds,
      target,
      // 这里只报「配置里有、预览画不出来」的事实（见 shared/preview-hints）；
      // 不再硬编码空数组 —— 那会让 UI 的提示条永远不出现。
      featureHints: describeUnrenderedFeatures(validatedConfig),
      warnings: generated.warnings,
      engine: 'ai',
      kind: 'crud',
    }
  }

  // ── Offline / fallback path (no AI key, AI errored, or AI failed twice) ──
  //
  // 这里调用的是 **MCP server / CLI 用的同一个函数** generateCrudSchema(desc, target)
  // （packages/shared/src/schema-generator.ts）。此前这里用的是另一套旧生成器
  // generateCrudConfig + generateCode —— 那套只产 Vue 3 + Element Plus，
  // 于是页面顶部那句「IDE 里 Claude Code 调 MCP server 跑的就是这套逻辑」对离线路径
  // 并不成立：两条路径当时是两套不同实现。换成同一个函数后，这句话才名副其实，
  // 而且**三端 target 支持随之免费获得**（wrapperCode 按 target 生成 vue3/vue2/antdv）。
  const target = opts.target ?? 'vue3'
  const tcStart = Date.now()
  let legacy: CrudSchemaResult | undefined
  let legacyErr: Error | undefined
  try {
    legacy = generateCrudSchema(prompt, target)
  } catch (e) {
    legacyErr = e instanceof Error ? e : new Error(String(e))
  }
  const legacySchema = legacy?.schema as {
    formItems?: unknown[]
    columns?: unknown[]
    actions?: string[]
  } | undefined
  pushTrace(opts, traceIds, {
    startedAt: tcStart,
    kind: 'mcp_tool_call',
    toolName: 'generate_crud_schema',
    title: 'generate_crud_schema',
    summary: legacy
      ? `${legacySchema?.formItems?.length ?? 0} form items · ${legacySchema?.columns?.length ?? 0} columns · target=${target}`
      : (legacyErr?.message ?? 'failed'),
    input: { description: prompt, target },
    output: legacy
      ? {
          formItems: legacySchema?.formItems?.length ?? 0,
          columns: legacySchema?.columns?.length ?? 0,
          actions: legacySchema?.actions,
          target: legacy.target,
          wrapperCode: legacy.wrapperCode.slice(0, 400),
        }
      : undefined,
    status: legacy ? 'success' : 'error',
    error: legacyErr?.message,
  })
  if (!legacy) throw legacyErr ?? new Error('Failed to generate CRUD schema')

  pushTrace(opts, traceIds, {
    startedAt: Date.now(),
    kind: 'render',
    title: 'render: preview / code / json',
    summary: `tabs updated (target=${legacy.target})`,
    status: 'success',
  })

  const preview = previewFromSchema(legacy.schema as { formItems?: unknown[]; columns?: unknown[] })
  const summary = `Generated CRUD page: ${preview.formItems.length} query fields, ${preview.columns.length} columns${
    (legacy.schema.actions as string[] | undefined)?.length
      ? `, actions: ${(legacy.schema.actions as string[]).join('/')}`
      : ''
  } · target=${legacy.target}.`

  return {
    message: {
      id: newId(),
      ts: Date.now(),
      role: 'assistant',
      content: summary,
      traceIds,
      fieldsCount: preview.formItems.length,
      columnsCount: preview.columns.length,
    },
    formItems: preview.formItems,
    columns: preview.columns,
    toolbarBtns: [],
    code: legacy.wrapperCode,
    jsonView: legacy.schema,
    structuredConfig: undefined, // offline path doesn't produce a StructuredCrudConfig
    previewSchema: legacy.schema,
    traceIds,
    // 规则引擎的识别结果（多 tab 弹窗 / 多步表单 / 虚拟滚动 …）必须原样展示：
    // 它们不是「已生成」，而是「已识别、需要手工实现」—— 用户有权知道。
    featureHints: legacy.featureHints ?? [],
    warnings: legacy.warnings ?? [],
    engine: opts.ai?.apiKey ? 'rule-fallback' : 'rule',
    fallbackReason: opts.ai?.apiKey
      ? (aiFailure ?? 'AI 路径未产出可用配置，已回退到规则引擎')
      : undefined,
    target: legacy.target,
    // 离线兜底 = CLI 那条规则引擎：它只产 CRUD 整页，没有片段入口。
    // 这一点必须在 UI 里说出来，而不是让「只做一个表单」的诉求悄悄变形成一整页。
    kind: 'crud',
  }
}
