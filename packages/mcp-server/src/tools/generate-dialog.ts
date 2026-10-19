import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateDialogBlock } from "@es-plus/shared";
import { surfaceFieldSchema, renderFragmentOutput, dialogOptionsSchema } from "./_fragment-shapes.js";

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
  composableName: z.string().optional().describe("Exported composable name (default 'useFormDialog'). Ignored when mode='component' (the SFC is a default-exported component)."),
  mode: z
    .enum(["composable", "component"])
    .default("composable")
    .describe(
      "Output shape. 'composable' (default) = a useXxxDialog().tsx/.jsx module whose dialog body is a JSX render — requires @vitejs/plugin-vue-jsx (vue3/antdv) or @vue/babel-preset-jsx (vue2). 'component' = a self-contained <es-dialog> SFC (template + script setup; vue2: defineComponent) with NO JSX dependency. Both expose the same integration contract: open(title, row?, onSuccess?)."
    ),
  defaultTitle: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Default title for open() when the caller passes none. open(title) still overrides it — the first argument remains the single source of truth. Emitted as the parameter default (`title = '新增'`).",
    ),
  options: dialogOptionsSchema
    .optional()
    .describe(
      "Declarative dialog base options (core DialogOptions subset). Omitted keys keep the defaults; `title` is NOT an option — it is open()'s first argument (for a fallback value use `defaultTitle`).",
    ),
} as const;

export function registerGenerateDialog(server: McpServer) {
  server.tool(
    "generate_dialog",
    "Generate a STANDALONE dialog with the integration contract open(title, row?, onSuccess?) — after a successful submit it calls onSuccess, where the host refreshes its OWN table (the same contract in both output shapes). mode='composable' (default) emits a reusable useXxxDialog() composable (a .tsx/.jsx module, dialog body is a JSX render — needs the JSX plugin). mode='component' emits a self-contained <es-dialog> SFC instead (no JSX plugin needed; the host must have registered es-plus globally). Use this ONLY when the user explicitly wants a reusable add/edit dialog on its own, or to pair with a separately-generated table / native component. For a full CRUD page use generate_crud instead (its dialogs are declarative and need no JSX either).",
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

