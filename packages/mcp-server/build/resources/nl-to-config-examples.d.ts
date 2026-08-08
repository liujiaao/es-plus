import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StructuredCrudConfigInput } from "@es-plus/shared";
/**
 * Curated few-shot NL → StructuredCrudConfig pairs.
 *
 * These REPLACE keyword tables as the primary steering signal for NL→config.
 * The host LLM reads these examples plus the field-level `.describe()` guidance
 * baked into the generate_crud_from_config input schema, then reasons about the
 * user's request semantically — it is not limited by any keyword's coverage.
 *
 * Each example is a real, schema-valid config; nl-to-config-examples.spec.ts
 * validates every one against the authoritative StructuredCrudConfigSchema so
 * they can never silently rot into invalid guidance.
 */
export interface NlToConfigExample {
    label: string;
    /** The natural-language request a user might give. */
    nl: string;
    /** Why the config maps the way it does — the reasoning we want the LLM to imitate. */
    reasoning: string;
    config: StructuredCrudConfigInput;
}
export declare const NL_TO_CONFIG_EXAMPLES: NlToConfigExample[];
export declare function registerNlToConfigExamplesResource(server: McpServer): void;
//# sourceMappingURL=nl-to-config-examples.d.ts.map