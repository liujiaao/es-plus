import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateTableBlock } from "@es-plus/shared";
import { tableFieldSchema, renderFragmentOutput, tableBlockOptionsSchema, tablePaginationSchema } from "./_fragment-shapes.js";
import { expandConfigSchema, treeConfigSchema, mergeConfigSchema } from "./_front-door-knobs.js";
import { ColumnSchema } from "./generate-from-config.js";

/**
 * 入参形状（导出供 `validate_config({type:'es-table-config'})` 复用 —— 工具的 Zod
 * 形状就是该配置类型的**唯一真源**，不另写第三份字段清单）。
 */
export const tableShape = {
  fields: z.array(tableFieldSchema).min(1).describe("Table columns — one per column the user described"),
  apiUrl: z
    .string()
    .optional()
    .describe("REST endpoint for the list. If set, the table auto-fetches via apiParams; if omitted, wire tableData manually."),
  target: z
    .enum(["vue3", "vue2", "antdv"])
    .default("vue3")
    .describe("Target renderer: vue3 (Element Plus), vue2 (Element UI), antdv (Ant Design Vue)"),
  typescript: z.boolean().default(true),
  i18n: z.boolean().default(false).describe("Use labelKey for i18n"),
  tableOptions: tableBlockOptionsSchema
    .optional()
    .describe(
      "Container options — the SAME declarative subset as generate_crud's tableOptions (core TableOptions minus function values): appearance (border/stripe/size/showHeader/emptyText/leftText), height (heightType/tabHeight/height), columns (multiSelect/snIndex), state (cachePageSelection), row (rowkey/rowClassName/defaultSort), request (refetchKeepPage/localPagination/configTableOut), engine (virtual/engine/rowHeight/estimatedRowHeight/overscanCount), tree (treeConfig — vxe rich tree), row expand (expandConfig — vxe switch), inline edit (editConfig — requires engine:'vxe').",
    ),
  pagination: tablePaginationSchema
    .optional()
    .describe("Pagination seed ({pageSize, pageSizes}); current/total are managed by the component."),
  rowButtons: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().optional(),
        key: z.string().optional(),
      })
    )
    .optional()
    .describe("Optional operation-column buttons. Emitted with triggerEvent:true (events only) — the host listens and handles them; no inline handler bodies are generated."),
  columns: z
    .array(ColumnSchema)
    .optional()
    .describe(
      "Explicit table columns — the SAME vocabulary as generate_crud's `columns` (override, not merge): multi-level group headers via `groups`, and non-field columns via `type` (index/selection/expand). When present it REPLACES the field-derived data columns (`fields` stays required and still documents the row shape). Contract keys are sanitized exactly like the CRUD page (unknown keys dropped, `x-*` kept)."
    ),
  treeConfig: treeConfigSchema
    .optional()
    .describe(
      "Declarative tree table — the SAME cross-renderer narrow subset as generate_crud's top-level `treeConfig` ({childrenField?, expandAll?}). Merged with tableOptions.treeConfig (this top-level key wins on conflicts). Distinct from the vxe-only `tableOptions.treeConfig`."
    ),
  expandConfig: expandConfigSchema
    .optional()
    .describe(
      "Declarative row-expand content — the SAME shape as generate_crud's top-level `expandConfig` ({title?, fields[]}). Prepends one expand column showing a read-only field list; if `columns` already has a {type:'expand'} column, the content attaches to it. Distinct from the vxe-only `tableOptions.expandConfig`."
    ),
  mergeConfig: mergeConfigSchema
    .optional()
    .describe(
      "Declarative row-merge ({rowsBy: ['dept','team']}) — the SAME cross-renderer narrow subset as generate_crud's top-level `mergeConfig`. Emitted as `options.mergeConfig`; el-table / a-table / vxe all honor it."
    ),
  rowkey: z
    .string()
    .optional()
    .describe("Primary key. Same as tableOptions.rowkey; when both are set this top-level key wins (with a warning)."),
} as const;

export function registerGenerateTable(server: McpServer) {
  server.tool(
    "generate_table",
    "Generate a STANDALONE <es-table> component — a self-contained .vue SFC (columns + options + data-source/pagination refs) that drops next to native/third-party components. Give apiUrl for auto-fetch via es-table's apiParams. Use this ONLY when the user explicitly wants a single table on its own. For a full CRUD page (query + table + add/edit/delete) use generate_scene (scene='crud') instead. Operation-column buttons are emitted as triggerEvent events (no inline handlers) so the fragment always compiles in isolation. This entry accepts the same table vocabulary as the CRUD front door: explicit `columns` (multi-level group headers / index-selection-expand columns), top-level `treeConfig` (cross-renderer nested tree), top-level `expandConfig` (declarative expanded content), `mergeConfig` (adjacent-row merge) and `rowkey` — all emitted with the same contract as the CRUD page. `tableOptions.treeConfig` / `tableOptions.expandConfig` remain the vxe-only rich variants. The only table-surface key NOT accepted here is `tableBtns` (toolbar buttons with code:1/2 positioning live in the CRUD page schema) — use generate_scene with scene='crud' for it.",
    tableShape,
    async (args: any) => {
      try {
        return renderFragmentOutput(generateTableBlock(args), "vue");
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error generating table: ${error.message}` }], isError: true };
      }
    }
  );
}
