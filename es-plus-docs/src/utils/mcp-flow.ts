// AI CRUD page orchestration — runs the SAME tool implementations the MCP
// server uses, but inside the browser, so the docs visitor can see the protocol
// flow that Claude Code / Cursor / Continue would otherwise hide. There's no
// real MCP transport here (stdio doesn't reach the browser); we surface each
// step as a TraceEntry so the page's Trace tab mirrors what an MCP-aware
// client logs in its IDE.
//
// Two paths, both backed by @es-plus/shared:
//
//  - **Offline (no AI key)** — calls `generateCrudConfig` (NL → GeneratedConfig)
//    + `generateCode` (GeneratedConfig → SFC string). Pure deterministic
//    rule-based logic; no validation step needed.
//
//  - **AI (with API key)** — asks the LLM to produce a `StructuredCrudConfig`
//    (validated against the zod schema MCP server uses), then calls
//    `generateFromConfig` for the final SFC. Validation failure triggers one
//    retry with errors fed back to the AI; second failure falls through to the
//    offline path so the user still sees output.

import {
  generateCrudConfig,
  generateCode,
  generateFromConfig,
  StructuredCrudConfigSchema,
  FORM_TYPES,
  type GeneratedConfig,
  type StructuredCrudConfig,
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

const STRUCTURED_CONFIG_SKETCH = `interface StructuredCrudConfig {
  name: string                              // Component file name (camelCase)
  apiUrl?: string                           // Optional list endpoint
  fields: Array<{
    prop: string                            // camelCase
    label: string
    formtype: ${FORM_TYPES.join(' | ')}
    inQuery?: boolean                       // default true — show in search form
    inTable?: boolean                       // default true — show as table column
    inForm?: boolean                        // default true — show in add/edit dialog
    querySpan?: number                      // 1..24, query form grid
    formSpan?: number                       // 1..24, dialog form grid
    required?: boolean
    dataOptions?: { label: string; value: string|number|boolean }[]
    width?: number | string
    align?: 'left' | 'center' | 'right'
    formatter?: string                      // expression string for display
  }>
  actions?: ('add'|'edit'|'delete'|'view'|'export')[]
  toolbarBtns?: { name: string; key: string; type?: string; triggerEvent?: boolean }[]
  pagination?: { pageSize?: number; pageSizes?: number[] }
  tableOptions?: { border?: boolean; stripe?: boolean; virtual?: boolean }
  mode?: 'schema' | 'sfc'                   // default 'schema'
  target?: 'vue3' | 'vue2'                  // default 'vue3'
}`

function buildSystemPrompt(currentConfig: StructuredCrudConfig | undefined): string {
  const ctx = currentConfig
    ? `Existing config (refine/extend, don't replace from scratch):\n\`\`\`json\n${JSON.stringify(currentConfig, null, 2)}\n\`\`\``
    : 'Existing config: (none — first turn)'
  return `You are an es-plus CRUD page configurator. You produce structured JSON configs that @es-plus/vue3 uses to render forms + tables + dialogs.

# Available MCP tools (the server runs these on your behalf)
- generate_crud_from_config(config: StructuredCrudConfig) → produces SFC + schema
- validate_config(config) → zod-validates against StructuredCrudConfigSchema

# Output schema (must match exactly — use the field names below verbatim)
\`\`\`ts
${STRUCTURED_CONFIG_SKETCH}
\`\`\`

${ctx}

# Rules
- camelCase prop names; \`name\` should be PascalCase like \`UserManagement\`
- Use Chinese labels for Chinese input, English for English input
- For status/category fields use formtype:'Select' with dataOptions
- For date ranges use formtype:'datePicker' with attrs:{ type:'daterange', valueFormat:'YYYY-MM-DD' }
- Always include the \`name\` and \`fields\` keys at the top level
- If user mentions edit/delete actions, set actions:['add','edit','delete'] etc.
- Respond ONLY with the JSON object, no commentary, no markdown fences.`
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

function structuredToPreview(config: StructuredCrudConfig): {
  formItems: unknown[]
  columns: unknown[]
  toolbarBtns: unknown[]
} {
  const rawFormItems = config.fields
    .filter((f) => f.inQuery !== false)
    .map((f) => ({
      prop: f.prop,
      label: f.label,
      formtype: f.formtype,
      attrs: f.attrs,
      dataOptions: f.dataOptions,
    }))
  const formItems = withPreviewPolish(rawFormItems)
  const columns = config.fields
    .filter((f) => f.inTable !== false)
    .map((f) => ({
      prop: f.prop,
      label: f.label,
      width: f.width,
      align: f.align,
    }))
  const toolbarBtns =
    config.toolbarBtns?.length
      ? config.toolbarBtns
      : [
          { name: 'Search', type: 'primary', key: 'query', triggerEvent: true },
          { name: 'Reset', key: 'rest', triggerEvent: true },
        ]
  return { formItems, columns, toolbarBtns }
}

function generatedToPreview(config: GeneratedConfig): {
  formItems: unknown[]
  columns: unknown[]
  toolbarBtns: unknown[]
} {
  // Offline engine already applies placeholder + spans, but we re-run polish
  // to keep both paths producing identical preview shape (defense in depth —
  // if engine output ever loses the polish, preview stays correct).
  return {
    formItems: withPreviewPolish(config.formItems ?? []),
    columns: config.columns ?? [],
    toolbarBtns: config.queryBtns ?? [],
  }
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
      { role: 'system', content: buildSystemPrompt(opts.currentConfig) },
    ]
    for (const m of history.slice(-6)) {
      if (m.role === 'user') messages.push({ role: 'user', content: m.content })
      else if (m.configSnapshot) {
        messages.push({ role: 'assistant', content: JSON.stringify(m.configSnapshot) })
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
      const outcome = validateConfig(parsedJson)
      pushTrace(opts, traceIds, {
        startedAt: valStart,
        kind: 'mcp_validation',
        toolName: 'validate_config',
        title: 'validate_config',
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
  }

  // ── AI path final codegen ─────────────────────────────────────────────
  if (validatedConfig) {
    checkAborted(opts.signal)
    const genStart = Date.now()
    const generated = generateFromConfig(validatedConfig)
    pushTrace(opts, traceIds, {
      startedAt: genStart,
      kind: 'mcp_tool_call',
      toolName: 'generate_crud_from_config',
      title: 'generate_crud_from_config',
      summary: `${generated.code.length} chars of code · ${generated.warnings.length} warnings`,
      input: { fields: validatedConfig.fields.length, mode: validatedConfig.mode ?? 'schema' },
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

    const preview = structuredToPreview(validatedConfig)
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
      toolbarBtns: preview.toolbarBtns,
      code: generated.code,
      jsonView: validatedConfig,
      structuredConfig: validatedConfig,
      traceIds,
      // AI path doesn't currently surface feature hints (the LLM is expected
      // to handle nuance directly in the config); keep empty so UI just hides
      // the alert.
      featureHints: [],
    }
  }

  // ── Offline / fallback path (no AI key, AI errored, or AI failed twice) ──
  const tcStart = Date.now()
  let legacyConfig: GeneratedConfig | undefined
  let legacyErr: Error | undefined
  try {
    legacyConfig = generateCrudConfig(prompt)
  } catch (e) {
    legacyErr = e instanceof Error ? e : new Error(String(e))
  }
  pushTrace(opts, traceIds, {
    startedAt: tcStart,
    kind: 'mcp_tool_call',
    toolName: 'generate_crud_config',
    title: 'generate_crud_config',
    summary: legacyConfig
      ? `${legacyConfig.formItems.length} form items · ${legacyConfig.columns.length} columns`
      : (legacyErr?.message ?? 'failed'),
    input: { description: prompt },
    output: legacyConfig
      ? {
          formItems: legacyConfig.formItems.length,
          columns: legacyConfig.columns.length,
          actions: legacyConfig.actions,
        }
      : undefined,
    status: legacyConfig ? (opts.ai?.apiKey ? 'cached' : 'success') : 'error',
    error: legacyErr?.message,
  })
  if (!legacyConfig) throw legacyErr ?? new Error('Failed to generate CRUD config')

  const codeStart = Date.now()
  const code = generateCode(legacyConfig)
  pushTrace(opts, traceIds, {
    startedAt: codeStart,
    kind: 'mcp_tool_call',
    toolName: 'generate_code',
    title: 'generate_code',
    summary: `${code.length} chars of SFC`,
    input: { fields: legacyConfig.formItems.length },
    output: { codePreview: code.slice(0, 400) },
    status: 'success',
  })

  pushTrace(opts, traceIds, {
    startedAt: Date.now(),
    kind: 'render',
    title: 'render: preview / code / json',
    summary: 'tabs updated',
    status: 'success',
  })

  const preview = generatedToPreview(legacyConfig)
  const summary = `Generated CRUD page: ${legacyConfig.formItems.length} query fields, ${legacyConfig.columns.length} columns${legacyConfig.actions.length ? `, actions: ${legacyConfig.actions.join('/')}` : ''}.`

  return {
    message: {
      id: newId(),
      ts: Date.now(),
      role: 'assistant',
      content: summary,
      traceIds,
      fieldsCount: legacyConfig.formItems.length,
      columnsCount: legacyConfig.columns.length,
    },
    formItems: preview.formItems,
    columns: preview.columns,
    toolbarBtns: preview.toolbarBtns,
    code,
    jsonView: legacyConfig,
    structuredConfig: undefined, // offline path doesn't produce a StructuredCrudConfig
    traceIds,
    featureHints: legacyConfig.featureHints ?? [],
  }
}
