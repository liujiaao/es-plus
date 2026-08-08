import { StructuredCrudConfigSchema, buildNlToConfigSystemPrompt, } from '@es-plus/shared';
export class AiUnavailableError extends Error {
    reason;
    constructor(reason) {
        super(reason === 'sdk-missing'
            ? '@anthropic-ai/sdk is not installed (run: npm i -D @anthropic-ai/sdk)'
            : 'ANTHROPIC_API_KEY is not set');
        this.reason = reason;
        this.name = 'AiUnavailableError';
    }
}
/** Whether the AI path can run right now (SDK importable AND key present). */
export async function aiAvailable() {
    if (!process.env.ANTHROPIC_API_KEY)
        return false;
    return (await loadAnthropic()) !== null;
}
async function loadAnthropic() {
    try {
        // Non-literal specifier so tsc does not statically resolve this optional dep.
        const spec = '@anthropic-ai/sdk';
        const mod = await import(spec);
        return mod.default || mod.Anthropic || mod;
    }
    catch {
        return null;
    }
}
function textOf(message) {
    return (message?.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
}
function extractJson(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : text;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1)
        throw new Error('no JSON object found in model output');
    return JSON.parse(body.slice(start, end + 1));
}
export async function nlToConfig(nl, opts = {}) {
    const Anthropic = await loadAnthropic();
    if (!Anthropic)
        throw new AiUnavailableError('sdk-missing');
    if (!process.env.ANTHROPIC_API_KEY)
        throw new AiUnavailableError('no-key');
    const client = new Anthropic();
    const model = opts.model || process.env.ESPLUS_AI_MODEL || 'claude-opus-5';
    const system = buildNlToConfigSystemPrompt();
    const messages = [
        { role: 'user', content: nl },
    ];
    let lastRaw = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await client.messages.create({
            model,
            max_tokens: 8000,
            thinking: { type: 'adaptive' },
            system,
            messages,
        });
        const raw = textOf(res);
        lastRaw = raw;
        let candidate;
        try {
            candidate = extractJson(raw);
        }
        catch (err) {
            messages.push({ role: 'assistant', content: raw });
            messages.push({ role: 'user', content: `That was not valid JSON (${err.message}). Respond with ONLY the JSON object.` });
            continue;
        }
        const parsed = StructuredCrudConfigSchema.safeParse(candidate);
        if (parsed.success) {
            const config = parsed.data;
            // Honor CLI target/mode when the model left them at defaults / unset.
            if (opts.target && candidate.target === undefined)
                config.target = opts.target;
            if (opts.mode && candidate.mode === undefined)
                config.mode = opts.mode;
            return { config, attempts: attempt };
        }
        const issues = parsed.error.issues
            .slice(0, 8)
            .map((i) => `- [${i.path.join('.') || '(root)'}] ${i.message}`)
            .join('\n');
        messages.push({ role: 'assistant', content: JSON.stringify(candidate) });
        messages.push({
            role: 'user',
            content: `The config failed schema validation:\n${issues}\nFix these and respond with ONLY the corrected JSON object.`,
        });
    }
    throw new Error(`LLM did not produce a schema-valid config after repairs. Last output:\n${lastRaw.slice(0, 400)}`);
}
//# sourceMappingURL=nl-to-config.js.map