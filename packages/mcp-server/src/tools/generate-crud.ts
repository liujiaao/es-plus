import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { emitSceneArtifact, type CrudIntent } from "@es-plus/shared";
import { withEnvelope } from "./_artifact-content.js";
import { surfaceFieldSchema } from "./_fragment-shapes.js";
import { TableBtnSchema, ToolbarBtnSchema } from "./generate-from-config.js";
import {
  tableOptionsSchema,
  formLayoutSchema,
  operationColumnSchema,
  expandConfigSchema,
  treeConfigSchema,
  mergeConfigSchema,
} from "./_front-door-knobs.js";

/**
 * COMPAT ENTRY (adapter) — `generate_scene` with `scene:'crud'` 的同一条路径，
 * 保留旧工具名以免破坏既有宿主；前门标签已归 `generate_scene`（registry 的
 * canonical entry 是唯一真源）。The host LLM's one reasoning step is to fill
 * `surfaces` — which of query / table / form / dialog the request implies, and
 * the fields in each.
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
 *
 * P2: the routing/formatting body now lives in `@es-plus/shared` (`scene/emit.ts`).
 * `generate_scene` calls the same `emitScene`, so byte parity is structural rather
 * than two hand-maintained copies that happen to agree.
 */

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
        .describe(
          "This dialog's own field list. When omitted: the `form` surface if present, else the `table` surface (table-bearing) or the `query` surface (no table).",
        ),
    })
    // AN-26（续）：passthrough 让 `formItmes` 这类拼写活到 handler，由 `_arg-guard`
    // 点名判红；默认 strip 会让它在 SDK 解析阶段就消失（见 `_arg-guard.ts` 头注）。
    .passthrough()
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
  // 同上：`surfaces.formFields` 这类近义键必须活到闸门，而不是被 zod strip 后
  // 生成一个「只读页」并报成功。
  .passthrough()
  .describe("The intent table — set only the surfaces the request implies. Any subset is valid.");

/**
 * The front door's argument shape.
 *
 * Exported because `generate_scene` (the scene-first router) reuses it verbatim for
 * `scene:'crud'` — the two tools must parse the same JSON to the same values or
 * their byte-equality guarantee would not hold on the input side either.
 */
export const crudShape = {
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
  tableOptions: tableOptionsSchema
    .optional()
    .describe(
      // 不点名 `generate_crud_from_config`：`front-door` 档下它不注册，而这里只是拿它当
      // 「键集与语义的参照」。指代同一个结构化配置块，两种 profile 下都成立。
      "Table options, forwarded verbatim into the composed config's `tableOptions` block (border/stripe/rowkey/heightType/tabHeight/height/multiSelect/emptyText/size/defaultSort/leftText/engine/virtual/editConfig/configTableOut/tableOptions.treeConfig/tableOptions.expandConfig/…). The full key set and per-key semantics are the same as `StructuredCrudConfig.tableOptions`; unknown keys are rejected."
    ),
  formLayout: formLayoutSchema
    .optional()
    .describe(
      "Query form layout ({ labelWidth?, minFoldRows? }). Column count is PER FIELD via querySpan — formLayout has no span key; an unknown key is rejected."
    ),
  operationColumn: operationColumnSchema
    .optional()
    .describe("Operation column config (`false` hides it): { label?, width?, fixed?, btns: [{ name, key?, type?, icon?, dialogKey?, confirm?, permissionValue? }] }."),
  tableBtns: z
    .array(TableBtnSchema)
    .optional()
    .describe(
      'Table toolbar buttons rendered above EsTable, e.g. [{ name: "导出", actionType: "export", position: "left" }]. ' +
        'Canonical keys are `name` + `actionType` + `position`; the legacy aliases `label`/`action` are accepted and normalized.'
    ),
  toolbarBtns: z
    .array(ToolbarBtnSchema)
    .optional()
    .describe(
      "Buttons rendered in the QUERY-FORM button area, appended after 查询/重置. No left/right placement here — when the description names a side, use `tableBtns` instead. Unknown keys are rejected."
    ),
  expandConfig: expandConfigSchema
    .optional()
    .describe(
      "Declarative row-expand content ({ title?, fields: [{prop, label?, labelKey?}] }) — the table gets ONE row-expander showing a read-only field list. Distinct from tableOptions.expandConfig (vxe-only switch). Unknown keys are rejected."
    ),
  treeConfig: treeConfigSchema
    .optional()
    .describe(
      "Declarative tree table ({ childrenField?, expandAll? }) — renders parent/child levels from each row's nested child array (row-key emitted automatically). Distinct from tableOptions.treeConfig (vxe-only). Unknown keys are rejected."
    ),
  mergeConfig: mergeConfigSchema
    .optional()
    .describe(
      "Declarative row-merge ({ rowsBy: ['dept','team'] }) — merges those columns across consecutive rows with EQUAL values (the standard 'grouped rows' table). Cross-renderer (el-table / a-table / vxe). Unknown keys are rejected."
    ),
  rowkey: z.string().optional().describe("Primary key for dialog PUT url / delete (default 'id')"),
} as const;

export function registerGenerateCrud(server: McpServer) {
  server.tool(
    "generate_crud",
    "COMPAT ENTRY (adapter) — same product as generate_scene with scene='crud' (byte-identical), kept for hosts that already call this name. Use it for ANY request that involves a list/table, CRUD, search + results, or multiple es-plus pieces working together. Your ONE job is to fill `surfaces`: set query/table/form field lists and the dialog list to match what the request implies (any subset is valid — table-only, query+table, table+add/edit, full CRUD, etc.). A `surfaces.dialog` entry is either a canned key ('add'/'edit'/'view') or a full object `{ key, title?, width?, fullscreen?, formItems? }` when the request names a custom dialog id/title/width or a per-dialog field list. Routing is then deterministic: table-bearing requests compile through the golden-covered single generator; no-table subsets emit self-contained fragments. Do NOT manually orchestrate generate_form/generate_table/generate_dialog for a composite page — fill surfaces here and let the routing compose them. When the user wants several standalone pieces assembled into one page (not a CRUD page), call generate_composition instead. Use the standalone tools only for an explicit single-component ask or to embed a fragment next to non-es-plus components. Optional config knobs — tableOptions / formLayout / operationColumn / tableBtns / toolbarBtns / expandConfig / treeConfig / mergeConfig — may be set alongside `surfaces`; each is forwarded verbatim into the composed config, so fill them only when the request names those specifics. A no-table request whose only surface is `dialog` emits one JSX composable PER dialog entry (named use<Key>Dialog): each entry's `formItems` overrides the shared form/query body, its `title` becomes open()'s default title, and its `width`/`fullscreen` are applied. Because the dialog body is a JSX render, that path needs a JSX plugin; if the host wants a self-contained dialog with NO JSX dependency, call generate_dialog with mode:'component' instead. When the client supports MCP structured output, the artifact envelope is also returned as `structuredContent`; the text content is unchanged.",
    crudShape,
    async (args: any) => {
      const result = emitSceneArtifact({ scene: "crud", intent: args as CrudIntent });
      return withEnvelope(result.text, result.envelope, result.isError);
    }
  );
}
