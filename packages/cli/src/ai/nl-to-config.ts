import {
  StructuredCrudConfigSchema,
  buildNlToConfigSystemPrompt,
  type StructuredCrudConfig,
} from '@es-plus/shared'

/**
 * CLI opt-in headless LLM path: natural language → StructuredCrudConfig.
 *
 * This mirrors the MCP host-LLM constrained path in a programmatic loop:
 *   NL ──(Anthropic, few-shot system prompt)──▶ config
 *      ──(Zod validate + self-repair, <=2 retries feeding the error back)──▶ valid config
 * The caller then feeds the config to the deterministic generateFromConfig, so the
 * output is compile-guaranteed exactly like --from-config.
 *
 * @anthropic-ai/sdk is an OPTIONAL, lazily-imported dependency — non-AI usage of the
 * CLI never needs it installed. When it's absent or ANTHROPIC_API_KEY is unset, the
 * caller degrades to the existing regex generators.
 */

export type AiUnavailableReason = 'sdk-missing' | 'no-key'

export class AiUnavailableError extends Error {
  constructor(public readonly reason: AiUnavailableReason) {
    super(reason === 'sdk-missing'
      ? '@anthropic-ai/sdk is not installed (run: npm i -D @anthropic-ai/sdk)'
      : 'ANTHROPIC_API_KEY is not set')
    this.name = 'AiUnavailableError'
  }
}

export interface NlToConfigOptions {
  model?: string
  /** Applied to the resulting config when the model did not set it. */
  target?: 'vue3' | 'vue2' | 'antdv'
  mode?: 'schema' | 'sfc'
}

export interface NlToConfigResult {
  config: StructuredCrudConfig
  attempts: number
}

/** Whether the AI path can run right now (SDK importable AND key present). */
export async function aiAvailable(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false
  return (await loadAnthropic()) !== null
}

async function loadAnthropic(): Promise<any | null> {
  try {
    // Non-literal specifier so tsc does not statically resolve this optional dep.
    const spec = '@anthropic-ai/sdk'
    const mod: any = await import(spec)
    return mod.default || mod.Anthropic || mod
  } catch {
    return null
  }
}

function textOf(message: any): string {
  return (message?.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
}

/**
 * 从模型输出中抽取首个 JSON 对象（容忍 ```json 围栏与前后噪声文本）。
 * 导出以便单测覆盖围栏/裸对象/无对象抛错三种路径。
 */
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object found in model output')
  return JSON.parse(body.slice(start, end + 1))
}

/**
 * 把模型的这一轮回灌进对话（**就地** push），且**永不留空 content**。
 *
 * ## 为什么必须有这个函数（2026-10-16 实测）
 *
 * `thinking: {type:'adaptive'}` 下模型**可能产出只有 thinking 块、没有 text 块**的一轮，
 * 此时 `textOf` 返回空串。若把空串原样推回，下一次请求就带一个**空的 text block**：
 * 宽松实现默默放行，严格的实现（实测京东云网关）直接
 * `400 messages: text content blocks must be non-empty` —— 用户看到的是一句无从下手的 400。
 *
 * 这是**我们这边的假设漏洞**（「模型一定有 text」从未被检验），所以修在我们这边：
 * 用显式标记代替空串，既不假装模型说了话，也不留非法块。
 */
function pushAssistant(messages: Array<{ role: 'user' | 'assistant'; content: string }>, text: string): void {
  messages.push({
    role: 'assistant',
    content: text.trim() ? text : '(no text block produced — the previous turn contained only reasoning)',
  })
}

/** 同理：纠正轮也不许留空串（`err.message` 理论上可能为空）。 */
function pushUserCorrection(messages: Array<{ role: 'user' | 'assistant'; content: string }>, text: string): void {
  messages.push({ role: 'user', content: text.trim() ? text : '(empty correction)' })
}

/** 空轮原地重发上限（独立于修复机会，见 nlToConfig 内注释）。 */
const MAX_EMPTY_RETRIES = 3

export async function nlToConfig(nl: string, opts: NlToConfigOptions = {}): Promise<NlToConfigResult> {
  const Anthropic = await loadAnthropic()
  if (!Anthropic) throw new AiUnavailableError('sdk-missing')
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError('no-key')

  const client = new Anthropic()
  const model = opts.model || process.env.ESPLUS_AI_MODEL || 'claude-opus-5'
  const system = buildNlToConfigSystemPrompt()
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: nl },
  ]

  let lastRaw = ''
  let calls = 0
  let emptyRetries = 0
  const trail: string[] = []
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await client.messages.create({
      model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system,
      messages,
    })
    calls++
    const raw = textOf(res)
    lastRaw = raw

    // ── 空轮 ────────────────────────────────────────────────────────────
    // 空轮**不是**模型答错，是这一轮**没产出内容**。既然什么都没产出，对话状态就没变，
    // 重发同一请求就是**纯重试**，故不吃三次修复机会（否则空轮会让真正的能力性重试被白白
    // 吃掉，用户看到的是「模型三次都答不对」，而实际是「一次没答 + 两次答不对」）。
    // 上限必有：若中继系统性返回空轮，重发无界会把 CLI 挂死。
    if (!raw.trim()) {
      if (emptyRetries < MAX_EMPTY_RETRIES) {
        emptyRetries++
        trail.push(`#${attempt} 空轮（无 text 块，原地重发 ${emptyRetries}/${MAX_EMPTY_RETRIES}）`)
        attempt-- // 不消耗修复机会
        continue
      }
      trail.push(`#${attempt} 空轮（无 text 块，重发已用尽）`)
      continue
    }

    let candidate: any
    try {
      candidate = extractJson(raw)
    } catch (err: any) {
      trail.push(`#${attempt} 非 JSON（${err.message}）`)
      pushAssistant(messages, raw)
      pushUserCorrection(messages, `That was not valid JSON (${err.message}). Respond with ONLY the JSON object.`)
      continue
    }

    const parsed = StructuredCrudConfigSchema.safeParse(candidate)
    if (parsed.success) {
      const config = parsed.data as StructuredCrudConfig
      // Honor CLI target/mode when the model left them at defaults / unset.
      if (opts.target && candidate.target === undefined) config.target = opts.target
      if (opts.mode && candidate.mode === undefined) config.mode = opts.mode
      return { config, attempts: calls }
    }

    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) => `- [${i.path.join('.') || '(root)'}] ${i.message}`)
      .join('\n')
    trail.push(`#${attempt} schema 不过（${parsed.error.issues.length} 处）`)
    pushAssistant(messages, JSON.stringify(candidate))
    pushUserCorrection(
      messages,
      `The config failed schema validation:\n${issues}\nFix these and respond with ONLY the corrected JSON object.`
    )
  }

  // 诊断链必须**分得清三种病因**：空轮（换中继/换模型）／非 JSON（改 prompt）／schema 不过
  // （模型真的答错了）。否则用户只拿到一句「三次都失败」，无从下手。
  throw new Error(
    `LLM did not produce a schema-valid config after ${calls} call(s) [${trail.join(' · ')}]. ` +
      `Last output (${lastRaw.length} chars):\n${lastRaw.slice(0, 400)}`
  )
}
