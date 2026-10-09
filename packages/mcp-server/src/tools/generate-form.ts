import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateFormBlock } from "@es-plus/shared";
import { surfaceFieldSchema, renderFragmentOutput } from "./_fragment-shapes.js";

const formShape = {
  fields: z.array(surfaceFieldSchema).min(1).describe("Form fields — one per input the user described"),
  target: z
    .enum(["vue3", "vue2", "antdv"])
    .default("vue3")
    .describe("Target renderer: vue3 (Element Plus), vue2 (Element UI), antdv (Ant Design Vue)"),
  typescript: z.boolean().default(true),
  i18n: z.boolean().default(false).describe("Use labelKey for i18n"),
  context: z
    .enum(["query", "form"])
    .default("form")
    .describe("span sizing: 'query' = narrow filter fields (6/8), 'form' = full-width (24)"),
  buttons: z
    .enum(["none", "query", "submit"])
    .default("none")
    .describe("Footer buttons: 'none' (hide button row), 'query' (查询+重置), 'submit' (保存+重置)"),
} as const;

export function registerGenerateForm(server: McpServer) {
  server.tool(
    "generate_form",
    "Generate a STANDALONE <es-form> component — a self-contained .vue SFC (own reactive model + formItemList) that drops next to native/third-party components with zero scope collision. Use this ONLY when the user explicitly wants a single form on its own (a search filter, a settings form, a form embedded in a custom layout). For a full CRUD page (query + table + add/edit/delete) use generate_crud instead — do NOT hand-assemble a CRUD page from separate fragment tools. The field vocabulary is identical to generate_crud; map meaning → formtype the same way.",
    formShape,
    async (args: any) => {
      try {
        return renderFragmentOutput(generateFormBlock(args), "vue");
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error generating form: ${error.message}` }], isError: true };
      }
    }
  );
}
