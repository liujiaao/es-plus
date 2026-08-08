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

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object found in model output')
  return JSON.parse(body.slice(start, end + 1))
}

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
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await client.messages.create({
      model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system,
      messages,
    })
    const raw = textOf(res)
    lastRaw = raw

    let candidate: any
    try {
      candidate = extractJson(raw)
    } catch (err: any) {
      messages.push({ role: 'assistant', content: raw })
      messages.push({ role: 'user', content: `That was not valid JSON (${err.message}). Respond with ONLY the JSON object.` })
      continue
    }

    const parsed = StructuredCrudConfigSchema.safeParse(candidate)
    if (parsed.success) {
      const config = parsed.data as StructuredCrudConfig
      // Honor CLI target/mode when the model left them at defaults / unset.
      if (opts.target && candidate.target === undefined) config.target = opts.target
      if (opts.mode && candidate.mode === undefined) config.mode = opts.mode
      return { config, attempts: attempt }
    }

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

  throw new Error(`LLM did not produce a schema-valid config after repairs. Last output:\n${lastRaw.slice(0, 400)}`)
}
