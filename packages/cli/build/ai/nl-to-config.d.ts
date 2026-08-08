import { type StructuredCrudConfig } from '@es-plus/shared';
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
export type AiUnavailableReason = 'sdk-missing' | 'no-key';
export declare class AiUnavailableError extends Error {
    readonly reason: AiUnavailableReason;
    constructor(reason: AiUnavailableReason);
}
export interface NlToConfigOptions {
    model?: string;
    /** Applied to the resulting config when the model did not set it. */
    target?: 'vue3' | 'vue2' | 'antdv';
    mode?: 'schema' | 'sfc';
}
export interface NlToConfigResult {
    config: StructuredCrudConfig;
    attempts: number;
}
/** Whether the AI path can run right now (SDK importable AND key present). */
export declare function aiAvailable(): Promise<boolean>;
export declare function nlToConfig(nl: string, opts?: NlToConfigOptions): Promise<NlToConfigResult>;
//# sourceMappingURL=nl-to-config.d.ts.map