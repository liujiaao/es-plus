import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateDialogBlock } from "@es-plus/shared";
import { surfaceFieldSchema, renderFragmentOutput } from "./_fragment-shapes.js";

const dialogShape = {
  fields: z.array(surfaceFieldSchema).min(1).describe("Form fields shown inside the dialog"),
  apiUrl: z
    .string()
    .optional()
    .describe("Submit endpoint. If set, the 确定 button POSTs (新增) / PUTs (otherwise); if omitted, it only validates and calls onSuccess(formData)."),
  rowkey: z.string().optional().describe("Primary key used to build the PUT url `${apiUrl}/${formData[rowkey]}` (default 'id')"),
  target: z
    .enum(["vue3", "vue2", "antdv"])
    .default("vue3")
    .describe("Target renderer: vue3 (Element Plus), vue2 (Element UI), antdv (Ant Design Vue)"),
  typescript: z.boolean().default(true),
  i18n: z.boolean().default(false).describe("Use labelKey for i18n"),
  composableName: z.string().optional().describe("Exported composable name (default 'useFormDialog')"),
} as const;

export function registerGenerateDialog(server: McpServer) {
  server.tool(
    "generate_dialog",
    "Generate a STANDALONE dialog as a useXxxDialog() composable (a .tsx/.jsx module, NOT an SFC) — the dialog body is an EsForm (JSX render). Its open(title, row?, onSuccess?) is the integration contract: after a successful submit it calls onSuccess, where the host refreshes its OWN table. Use this ONLY when the user explicitly wants a reusable add/edit dialog on its own, or to pair with a separately-generated table / native component. For a full CRUD page use generate_crud instead. NOTE: JSX render requires @vitejs/plugin-vue-jsx (vue3/antdv) or @vue/babel-preset-jsx (vue2).",
    dialogShape,
    async (args: any) => {
      try {
        return renderFragmentOutput(generateDialogBlock(args), "tsx");
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error generating dialog: ${error.message}` }], isError: true };
      }
    }
  );
}
