import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export type Target = "vue3" | "vue2";
export interface DetectResult {
    target: Target;
    confidence: "high" | "medium" | "low";
    reasoning: string;
    signals: Record<string, string>;
}
export declare function detect(pkgJsonText: string): DetectResult;
export declare function registerDetectProjectTarget(server: McpServer): void;
//# sourceMappingURL=detect-project-target.d.ts.map