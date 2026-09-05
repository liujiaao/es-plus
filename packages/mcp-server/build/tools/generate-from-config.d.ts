import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Cheap post-parse semantic invariants. These never block generation (the
 * config is already schema-valid); they surface as non-blocking warnings so
 * the host LLM can self-correct on the next turn if the mapping looks off.
 */
export declare function buildSemanticWarnings(config: any): string[];
export declare function registerGenerateFromConfig(server: McpServer): void;
//# sourceMappingURL=generate-from-config.d.ts.map