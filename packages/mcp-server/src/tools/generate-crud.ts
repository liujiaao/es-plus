import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  composeCrudConfig,
  generateFromConfig,
  generateFormBlock,
  generateDialogBlock,
} from "@es-plus/shared";
import { surfaceFieldSchema } from "./_fragment-shapes.js";
import { buildSemanticWarnings } from "./generate-from-config.js";

/**
 * FRONT DOOR. The host LLM's one reasoning step is to fill `surfaces` — which of
 * query / table / form / dialog the request implies, and the fields in each.
 * Everything after that is deterministic code routing:
 *   - any table present  → composeCrudConfig → generateFromConfig (the golden-
 *     covered single landing path; one-shot compile inherited)
 *   - no table           → standalone fragment blocks (self-contained, embeddable
 *     next to native/third-party components)
 *
 * This collapses "pick the right tool(s)" (a multi-decision, accuracy-sapping
 * choice) into "fill one typed intent table" (constrained decoding). The three
 * standalone tools remain for explicit single-surface asks; this front door and
 * those tools call the SAME shared pure functions, so output is byte-identical.
 */

const DIALOG_TITLES: Record<string, string> = { add: "新增", edit: "编辑", view: "查看" };

const surfacesShape = z
  .object({
    query: z.array(surfaceFieldSchema).optional().describe("Filter fields shown above the table"),
    table: z.array(surfaceFieldSchema).optional().describe("Visible table columns"),
    form: z.array(surfaceFieldSchema).optional().describe("Add/edit form fields (the mutable subset)"),
    dialog: z
      .array(z.enum(["add", "edit", "view"]))
      .optional()
      .describe("Which dialogs the request needs (add/edit/view)"),
  })
  .describe("The intent table — set only the surfaces the request implies. Any subset is valid.");

const crudShape = {
  name: z.string().min(1).describe('Page/component name in PascalCase, e.g. "UserManage"'),
  apiUrl: z.string().min(1).describe('REST base URL for this resource, e.g. "/api/users"'),
  surfaces: surfacesShape,
  target: z
    .enum(["vue3", "vue2", "antdv"])
    .default("vue3")
    .describe("Target renderer: vue3 (Element Plus), vue2 (Element UI), antdv (Ant Design Vue)"),
  mode: z
    .enum(["schema", "sfc"])
    .default("schema")
    .describe("Output mode for table-bearing results: 'schema' (schema.ts + wrapper SFC) or 'sfc' (single SFC)"),
  typescript: z.boolean().default(true),
  i18n: z.boolean().default(false),
  actions: z
    .array(z.enum(["add", "edit", "delete", "view", "export", "import"]))
    .optional()
    .describe("Explicit CRUD actions. If omitted, derived from surfaces.dialog / form presence."),
  permissions: z.record(z.string()).optional().describe("Permission codes keyed by action"),
  pagination: z
    .object({ pageSize: z.number().int().default(10), pageSizes: z.array(z.number().int()).optional() })
    .optional(),
  rowkey: z.string().optional().describe("Primary key for dialog PUT url / delete (default 'id')"),
} as const;

function titleFor(key: string): string {
  return DIALOG_TITLES[key] ?? key;
}

export function registerGenerateCrud(server: McpServer) {
  server.tool(
    "generate_crud",
    "FRONT DOOR for es-plus generation — use this for ANY request that involves a list/table, CRUD, search + results, or multiple es-plus pieces working together. Your ONE job is to fill `surfaces`: set query/table/form field lists and the dialog list to match what the request implies (any subset is valid — table-only, query+table, table+add/edit, full CRUD, etc.). Routing is then deterministic: table-bearing requests compile through the golden-covered single generator; no-table subsets emit self-contained fragments. Do NOT manually orchestrate generate_form/generate_table/generate_dialog for a composite page — fill surfaces here and let the routing compose them. Use the standalone tools only for an explicit single-component ask or to embed a fragment next to non-es-plus components.",
    crudShape,
    async (args: any) => {
      try {
        const s = args.surfaces ?? {};
        const query: any[] = Array.isArray(s.query) ? s.query : [];
        const table: any[] = Array.isArray(s.table) ? s.table : [];
        const form: any[] = Array.isArray(s.form) ? s.form : [];
        const dialogKeys: string[] = Array.isArray(s.dialog) ? s.dialog : [];
        const hasTable = table.length > 0;
        const hasQuery = query.length > 0;
        const hasForm = form.length > 0;
        const hasDialog = dialogKeys.length > 0;

        if (!hasTable && !hasQuery && !hasForm && !hasDialog) {
          return {
            content: [{ type: "text", text: "Error: `surfaces` is empty — set at least one of query / table / form / dialog." }],
            isError: true,
          };
        }

        // ── Table-bearing: compose → generateFromConfig (golden-covered path) ──
        if (hasTable) {
          const dialogBody = hasForm ? form : table;
          const dialogs = hasDialog
            ? Object.fromEntries(dialogKeys.map((k) => [k, { title: titleFor(k), formItems: dialogBody }]))
            : undefined;

          const { config, warnings: composeWarnings } = composeCrudConfig({
            name: args.name,
            apiUrl: args.apiUrl,
            target: args.target,
            mode: args.mode,
            typescript: args.typescript,
            i18n: args.i18n,
            query,
            table,
            form,
            actions: args.actions,
            permissions: args.permissions,
            pagination: args.pagination,
            dialogs: dialogs as any,
          });

          const result = generateFromConfig(config as any);
          const allWarnings = [...composeWarnings, ...result.warnings, ...buildSemanticWarnings(config)];

          const out: string[] = [result.summary];
          if (allWarnings.length > 0) {
            out.push("", "⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):");
            for (const w of allWarnings) out.push(`  - ${w}`);
          }
          out.push("", "---", "");
          if (result.wrapperCode) {
            out.push("## Schema (schema.ts)", "", "```typescript", result.code, "```", "", "---", "");
            out.push("## Wrapper SFC (Page.vue)", "", "```vue", result.wrapperCode, "```");
          } else {
            out.push("## Generated SFC", "", "```vue", result.code, "```");
          }
          return { content: [{ type: "text", text: out.join("\n") }] };
        }

        // ── No table: emit standalone fragment(s) for the present surfaces ──
        const sections: string[] = [];
        const allWarnings: string[] = [];

        if (hasQuery) {
          const r = generateFormBlock({
            fields: query,
            context: "query",
            buttons: "query",
            target: args.target,
            typescript: args.typescript,
            i18n: args.i18n,
          });
          allWarnings.push(...r.warnings);
          sections.push(["## Query form (QueryForm.vue)", "", r.summary, "", "```vue", r.code, "```"].join("\n"));
        }

        if (hasDialog) {
          // dialog body = form fields (fallback to query); emit one composable
          const r = generateDialogBlock({
            fields: hasForm ? form : query,
            apiUrl: args.apiUrl,
            rowkey: args.rowkey,
            target: args.target,
            typescript: args.typescript,
            i18n: args.i18n,
          });
          allWarnings.push(...r.warnings);
          sections.push(["## Dialog composable (useFormDialog)", "", r.summary, "", "```tsx", r.code, "```"].join("\n"));
        } else if (hasForm) {
          // form without a dialog → a standalone submit form
          const r = generateFormBlock({
            fields: form,
            context: "form",
            buttons: "submit",
            target: args.target,
            typescript: args.typescript,
            i18n: args.i18n,
          });
          allWarnings.push(...r.warnings);
          sections.push(["## Form (FormBlock.vue)", "", r.summary, "", "```vue", r.code, "```"].join("\n"));
        }

        const header: string[] = [
          `Generated ${sections.length} standalone fragment(s) (no table surface — not routed through the CRUD generator).`,
        ];
        if (allWarnings.length > 0) {
          header.push("", "⚠️ Warnings:");
          for (const w of allWarnings) header.push(`  - ${w}`);
        }
        header.push("", "---", "");
        return { content: [{ type: "text", text: header.join("\n") + "\n" + sections.join("\n\n---\n\n") }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error generating CRUD: ${error.message}` }], isError: true };
      }
    }
  );
}
