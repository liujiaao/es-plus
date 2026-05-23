import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateScaffold } from "../core/code-generator.js";

export function registerScaffoldPage(server: McpServer) {
  server.tool(
    "scaffold_page",
    "Generate a minimal es-plus-ui page scaffold (.vue SFC) with the basic structure for query form, table, and optional dialog. Use this when you need a blank starting template.",
    {
      name: z
        .string()
        .describe("Page name in kebab-case, e.g. 'user-management'"),
      features: z
        .array(z.enum(["query", "table", "dialog"]))
        .optional()
        .describe(
          "Features to include. Defaults to ['query', 'table']. Options: query, table, dialog"
        ),
    },
    async ({ name, features }) => {
      try {
        const code = generateScaffold(name, features);
        const featureList = features || ["query", "table"];
        return {
          content: [
            {
              type: "text",
              text: `Generated scaffold for "${name}" with features: ${featureList.join(", ")}\n\n${code}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating scaffold: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
