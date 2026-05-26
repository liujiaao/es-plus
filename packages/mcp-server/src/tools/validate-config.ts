import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateConfig, listAvailableSchemas } from "@es-plus/shared";

export function registerValidateConfig(server: McpServer) {
  server.tool(
    "validate_config",
    "Validate an es-plus-ui JSON configuration against its schema. Returns validation errors and fix suggestions.",
    {
      config: z
        .string()
        .describe("JSON string of the es-plus configuration to validate"),
      type: z
        .string()
        .optional()
        .describe(
          `Schema type to validate against. Available: ${listAvailableSchemas().join(", ")}. Defaults to "form-item".`
        ),
    },
    async ({ config, type }) => {
      try {
        const parsed = JSON.parse(config);
        const result = validateConfig(parsed, type);

        if (result.valid) {
          return {
            content: [
              {
                type: "text",
                text: "✓ Configuration is valid!",
              },
            ],
          };
        }

        const output = [
          "✗ Configuration has errors:\n",
          ...result.errors.map((e) => `  - ${e}`),
          "",
          result.suggestions.length > 0 ? "Suggestions:" : "",
          ...result.suggestions.map((s) => `  → ${s}`),
        ]
          .filter(Boolean)
          .join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error: any) {
        if (error instanceof SyntaxError) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid JSON: ${error.message}\n\nSuggestion: Check for trailing commas, missing quotes, or unescaped characters.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: `Validation error: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
