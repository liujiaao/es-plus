import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  composeCrudConfig,
  generateFromConfig,
  generateFormBlock,
  generateDialogBlock,
  validateAndRepair,
} from "@es-plus/shared";
import { surfaceFieldSchema } from "./_fragment-shapes.js";
import { buildSemanticWarnings, formatValidationError } from "./generate-from-config.js";

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

const dialogEntrySchema = z.union([
  z.enum(["add", "edit", "view"]),
  z
    .object({
      key: z.string().min(1).describe('Dialog id (e.g. "add" / "edit" / "view" / your own, e.g. "detail").'),
      title: z.string().optional().describe("Dialog title (defaults to 新增/编辑/查看 for add/edit/view, else the key)."),
      width: z.union([z.string(), z.number()]).optional().describe("Dialog width."),
      fullscreen: z.boolean().optional().describe("Render the dialog fullscreen."),
      formItems: z
        .array(surfaceFieldSchema)
        .optional()
        .describe("This dialog's own field list (defaults to the `form` surface, else the `table` surface)."),
    })
    .describe("A full-parameter dialog — use when the request needs a custom id/title/width or a per-dialog field list."),
]);

const surfacesShape = z
  .object({
    query: z.array(surfaceFieldSchema).optional().describe("Filter fields shown above the table"),
    table: z.array(surfaceFieldSchema).optional().describe("Visible table columns"),
    form: z.array(surfaceFieldSchema).optional().describe("Add/edit form fields (the mutable subset)"),
    dialog: z
      .array(dialogEntrySchema)
      .optional()
      .describe(
        'Which dialogs the request needs: a canned key ("add"/"edit"/"view") or a full object { key, title?, width?, fullscreen?, formItems? }.',
      ),
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
  tableOptions: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Table options, forwarded verbatim into the composed config (border/stripe/rowkey/heightType/height/multiSelect/emptyText/size/defaultSort/leftText/engine/…). Full contract: see generate_crud_from_config.",
    ),
  formLayout: z
    .record(z.string(), z.any())
    .optional()
    .describe("Query form layout (span / labelWidth / minFoldRows)."),
  operationColumn: z
    .union([z.literal(false), z.record(z.string(), z.any())])
    .optional()
    .describe("Operation column config (`false` hides it); forwarded verbatim."),
  tableBtns: z
    .array(z.any())
    .optional()
    .describe('Table toolbar buttons rendered above EsTable, e.g. [{ label: "导出", action: "export" }].'),
  toolbarBtns: z
    .array(z.any())
    .optional()
    .describe("Toolbar buttons rendered in the EsForm button area (position:left|right)."),
  expandConfig: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Declarative row-expand content ({ title?, fields: [{prop, label?, labelKey?}] }) — the table gets ONE row-expander showing a read-only field list. Forwarded verbatim; full contract: see generate_crud_from_config.",
    ),
  treeConfig: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Declarative tree table ({ childrenField?, expandAll? }) — renders parent/child levels from each row's nested child array (row-key emitted automatically). Forwarded verbatim; distinct from tableOptions.treeConfig (vxe-only).",
    ),
  mergeConfig: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Declarative row-merge ({ rowsBy: ['dept','team'] }) — merges those columns across consecutive rows with EQUAL values (the standard 'grouped rows' table). Cross-renderer (el-table / a-table / vxe); forwarded verbatim. Full contract: see generate_crud_from_config.",
    ),
  rowkey: z.string().optional().describe("Primary key for dialog PUT url / delete (default 'id')"),
} as const;

function titleFor(key: string): string {
  return DIALOG_TITLES[key] ?? key;
}

export function registerGenerateCrud(server: McpServer) {
  server.tool(
    "generate_crud",
    "FRONT DOOR for es-plus generation — use this for ANY request that involves a list/table, CRUD, search + results, or multiple es-plus pieces working together. Your ONE job is to fill `surfaces`: set query/table/form field lists and the dialog list to match what the request implies (any subset is valid — table-only, query+table, table+add/edit, full CRUD, etc.). A `surfaces.dialog` entry is either a canned key ('add'/'edit'/'view') or a full object `{ key, title?, width?, fullscreen?, formItems? }` when the request names a custom dialog id/title/width or a per-dialog field list. Routing is then deterministic: table-bearing requests compile through the golden-covered single generator; no-table subsets emit self-contained fragments. Do NOT manually orchestrate generate_form/generate_table/generate_dialog for a composite page — fill surfaces here and let the routing compose them. Use the standalone tools only for an explicit single-component ask or to embed a fragment next to non-es-plus components. Optional config knobs — tableOptions / formLayout / operationColumn / tableBtns / toolbarBtns / expandConfig / treeConfig / mergeConfig — may be set alongside `surfaces`; each is forwarded verbatim into the composed config, so fill them only when the request names those specifics.",
    crudShape,
    async (args: any) => {
      try {
        const s = args.surfaces ?? {};
        const query: any[] = Array.isArray(s.query) ? s.query : [];
        const table: any[] = Array.isArray(s.table) ? s.table : [];
        const form: any[] = Array.isArray(s.form) ? s.form : [];
        const dialogEntries: any[] = Array.isArray(s.dialog) ? s.dialog : [];
        const hasTable = table.length > 0;
        const hasQuery = query.length > 0;
        const hasForm = form.length > 0;
        const hasDialog = dialogEntries.length > 0;

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
            ? Object.fromEntries(
                dialogEntries.map((d: any) => {
                  // 罐头键：字符串 → 默认标题 + 共用弹窗体。
                  if (typeof d === "string") return [d, { title: titleFor(d), formItems: dialogBody }];
                  // 全参对象：自定义 id/标题/宽度/全屏/逐弹窗字段表（AI-21④）。
                  const key = String(d.key);
                  return [
                    key,
                    {
                      title: d.title !== undefined ? d.title : titleFor(key),
                      ...(d.width !== undefined ? { width: d.width } : {}),
                      ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
                      formItems: d.formItems !== undefined ? d.formItems : dialogBody,
                    },
                  ];
                }),
              )
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
            tableOptions: args.tableOptions,
            formLayout: args.formLayout,
            operationColumn: args.operationColumn,
            tableBtns: args.tableBtns,
            toolbarBtns: args.toolbarBtns,
            dialogs: dialogs as any,
            expandConfig: args.expandConfig,
            treeConfig: args.treeConfig,
            mergeConfig: args.mergeConfig,
          });

          // 前门确定性校验(C2·A3):组合出的 config 先过权威 Zod 判定,非法则回结构化错误、不生成。
          const check = validateAndRepair(config);
          if (!check.valid) {
            return {
              content: [{ type: "text", text: formatValidationError(check) }],
              isError: true,
            };
          }

          const result = generateFromConfig(config as any);
          const allWarnings = [...composeWarnings, ...result.warnings, ...buildSemanticWarnings(config)];
          if (args.mode === "sfc") {
            allWarnings.push(
              "mode=sfc 是单文件输出，保真度低于默认的 schema 模式：dialogs / tableBtns / toolbarBtns / operationColumn 不会全量发射（schema 模式才全支持）。除非确需单 SFC，建议用 mode=schema。"
            );
          }

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
