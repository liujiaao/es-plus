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
  generateCrudSchema,
  generateFromConfig,
  StructuredCrudConfigSchema,
  FORM_TYPES,
  buildNlToConfigSystemPrompt,
  type CrudSchemaResult,
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
  /** 本次生成实际使用的渲染端（供 UI 显示，避免用户以为切了没生效） */
  target: TargetFramework
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

/**
 * 预览用的默认查询按钮。
 *
 * 两条路径共用一份：此前 AI 路径的兜底是英文 'Search' / 'Reset'，而页面正文与
 * 预设全是中文，预览里冒出两个英文按钮。这里统一为中文，两条路径不再各写一份。
 * （真正的国际化应走 i18n，但本文件是纯逻辑 util，不持有 locale；这属于遗留小项。）
 */
const DEFAULT_QUERY_BTNS = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]

/**
 * 离线路径的预览映射：输入是 generateCrudSchema 产出的 CrudPageSchema JSON
 * （`{ formItems, columns, tableOptions, actions }`）。
 *
 * 注意 generateCrudSchema 的 columns 已经剔除了 `operate`（操作列由 EsTable 的
 * tableBtns 提供），所以这里按 actions 补回一个操作列 —— 否则预览里看不到
 * 「编辑/删除」按钮，用户会以为生成器漏了增删改。
 */
function schemaToPreview(schema: {
  formItems?: unknown[]
  columns?: unknown[]
  actions?: string[]
}): {
  formItems: unknown[]
  columns: unknown[]
  toolbarBtns: unknown[]
} {
  const actions = schema.actions ?? []
  const cols: unknown[] = [...(schema.columns ?? [])]
  if (actions.some((a) => ['edit', 'delete', 'view'].includes(a))) {
    cols.push({ prop: 'operate', label: '操作', width: 150, fixed: 'right' })
  }
  return {
    formItems: withPreviewPolish(schema.formItems ?? []),
    columns: cols,
    toolbarBtns: schema.formItems?.length ? DEFAULT_QUERY_BTNS : [],
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
      { role: 'system', content: buildSystemPrompt(opts.currentConfig, opts.target ?? 'vue3') },
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
      target,
      // AI path doesn't currently surface feature hints (the LLM is expected
      // to handle nuance directly in the config); keep empty so UI just hides
      // the alert.
      featureHints: [],
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
    status: legacy ? (opts.ai?.apiKey ? 'cached' : 'success') : 'error',
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

  const preview = schemaToPreview(legacySchema ?? {})
  const summary = `Generated CRUD page: ${preview.formItems.length} query fields, ${preview.columns.length} columns${
    legacySchema?.actions?.length ? `, actions: ${legacySchema.actions.join('/')}` : ''
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
    toolbarBtns: preview.toolbarBtns,
    code: legacy.wrapperCode,
    jsonView: legacy.schema,
    structuredConfig: undefined, // offline path doesn't produce a StructuredCrudConfig
    traceIds,
    featureHints: [],
    target: legacy.target,
  }
}
