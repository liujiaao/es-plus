import type { StructuredCrudConfigInput } from './structured-config.schema.js';
/**
 * Shared NL → StructuredCrudConfig steering prompt + few-shot pairs.
 *
 * This is the SINGLE programmatic source for the reasoning we want a host or
 * headless LLM to imitate when turning a natural-language request into a
 * StructuredCrudConfig. It is reused by:
 *   - the CLI opt-in LLM path (`packages/cli/src/ai/nl-to-config.ts`)
 *   - the accuracy eval scorer (`scripts/eval-llm.mjs`)
 *
 * The MCP server exposes the same knowledge as an MCP resource
 * (`esplus://examples/nl-to-config`) for host-LLM constrained decoding; both are
 * validated against the authoritative StructuredCrudConfigSchema so guidance can
 * never rot into invalid configs.
 *
 * Principle: examples + semantic rules REPLACE keyword tables. The model reasons
 * about field MEANING, not keyword hits, and is not bounded by any lookup's
 * coverage.
 */
export interface NlToConfigFewShot {
    /** A natural-language request a user might give. */
    nl: string;
    /** Why the config maps the way it does — the reasoning to imitate. */
    reasoning: string;
    config: StructuredCrudConfigInput;
}
export declare const NL_TO_CONFIG_FEWSHOT: NlToConfigFewShot[];
/**
 * Build the system prompt for an LLM converting a Chinese/English NL CRUD
 * description into a StructuredCrudConfig. The model's output is validated
 * against StructuredCrudConfigSchema by the caller (with a self-repair loop).
 */
export declare function buildNlToConfigSystemPrompt(): string;
//# sourceMappingURL=ai-nl-to-config-prompt.d.ts.map