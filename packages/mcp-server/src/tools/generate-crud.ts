import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  composeCrudConfig,
  generateFromConfig,
  generateFormBlock,
  generateDialogBlock,
  formatPreflight,
  validateAndRepair,
} from "@es-plus/shared";
import { surfaceFieldSchema } from "./_fragment-shapes.js";
import { buildSemanticWarnings, formatValidationError, TableBtnSchema, ToolbarBtnSchema } from "./generate-from-config.js";
import {
  tableOptionsSchema,
  formLayoutSchema,
  operationColumnSchema,
  expandConfigSchema,
  treeConfigSchema,
  mergeConfigSchema,
} from "./_front-door-knobs.js";

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
        .describe(
          "This dialog's own field list. When omitted: the `form` surface if present, else the `table` surface (table-bearing) or the `query` surface (no table).",
        ),
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
    .describe("Toolbar buttons rendered in the EsForm button area (position:left|right; defaults right). Unknown keys are rejected."),
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

function titleFor(key: string): string {
  return DIALOG_TITLES[key] ?? key;
}

/**
 * AN-06③：顶层 `rowkey` 此前只喂给独立的 dialog 块，**没有**进入组合配置。
 *
 * 后果：`rowkey: "orderNo"` 的页面，独立弹窗块按 `orderNo` 拼 URL，而已组合的
 * `pageSchema.tableOptions.rowkey` 仍是默认 `id` —— 于是 wrapper 里弹窗 PUT 和行删除
 * 都按 `id` 拼 URL（`/api/orders/undefined`，或更糟：改到错误的行）。
 * 生成器读的就是 `tableOptions.rowkey`，所以顶层值必须并进去。
 *
 * 冲突时取**顶层**（它是本工具的显式参数，且独立 dialog 块用的也是它）并告警，
 * 不静默二选一。
 */
function withRowkey(
  tableOptions: Record<string, unknown> | undefined,
  rowkey: string | undefined,
): { tableOptions: Record<string, unknown> | undefined; warning?: string } {
  if (!rowkey) return { tableOptions };
  const prev = tableOptions?.rowkey;
  return {
    tableOptions: { ...(tableOptions ?? {}), rowkey },
    warning:
      prev !== undefined && prev !== rowkey
        ? `rowkey 冲突：tableOptions.rowkey="${String(prev)}" vs 顶层 rowkey="${rowkey}" —— 取顶层（弹窗 PUT / 删除 URL 与独立 dialog 块必须用同一个键）。`
        : undefined,
  };
}

/**
 * 从弹窗 key 派生 composable 名（AI-36）。
 * 前门可能一次给多个弹窗 —— 全部叫 `useFormDialog` 会产出重复的导出（后一个覆盖前一个），
 * 故按 key 派生：`add` → `useAddDialog`、`order-detail` → `useOrderDetailDialog`。
 * 非标识符字符一律切段；纯非 ASCII key（如中文）退回 `useFormDialog`。
 * 重名时追加序号并**告警**（绝不静默覆盖）。
 */
function composableNameFor(key: string, used: Set<string>, warnings: string[]): string {
  const pascal = key
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const base = `use${pascal || "Form"}Dialog`;
  let name = base;
  let n = 1;
  while (used.has(name)) name = `${base}${++n}`;
  if (name !== base) {
    warnings.push(
      `surfaces.dialog 有多个弹窗 key 推导出同一个 composable 名 ${base} —— 本个改用 ${name}（同名导出会互相覆盖）；建议给这些弹窗取不同的 key。`,
    );
  }
  used.add(name);
  return name;
}

export function registerGenerateCrud(server: McpServer) {
  server.tool(
    "generate_crud",
    "FRONT DOOR for es-plus generation — use this for ANY request that involves a list/table, CRUD, search + results, or multiple es-plus pieces working together. Your ONE job is to fill `surfaces`: set query/table/form field lists and the dialog list to match what the request implies (any subset is valid — table-only, query+table, table+add/edit, full CRUD, etc.). A `surfaces.dialog` entry is either a canned key ('add'/'edit'/'view') or a full object `{ key, title?, width?, fullscreen?, formItems? }` when the request names a custom dialog id/title/width or a per-dialog field list. Routing is then deterministic: table-bearing requests compile through the golden-covered single generator; no-table subsets emit self-contained fragments. Do NOT manually orchestrate generate_form/generate_table/generate_dialog for a composite page — fill surfaces here and let the routing compose them. Use the standalone tools only for an explicit single-component ask or to embed a fragment next to non-es-plus components. Optional config knobs — tableOptions / formLayout / operationColumn / tableBtns / toolbarBtns / expandConfig / treeConfig / mergeConfig — may be set alongside `surfaces`; each is forwarded verbatim into the composed config, so fill them only when the request names those specifics. A no-table request whose only surface is `dialog` emits one JSX composable PER dialog entry (named use<Key>Dialog): each entry's `formItems` overrides the shared form/query body, its `title` becomes open()'s default title, and its `width`/`fullscreen` are applied. Because the dialog body is a JSX render, that path needs a JSX plugin; if the host wants a self-contained dialog with NO JSX dependency, call generate_dialog with mode:'component' instead.",
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
          // 重复 key 会被 Object.fromEntries 静默覆盖 —— 显式告警（与无表支 AI-36 同一条原则）。
          const duplicateDialogKeys: string[] = [];
          const dialogs = hasDialog
            ? (() => {
                const seen = new Set<string>();
                const entries: Array<[string, any]> = [];
                for (const d of dialogEntries) {
                  const key = typeof d === "string" ? d : String(d.key);
                  if (seen.has(key)) duplicateDialogKeys.push(key);
                  seen.add(key);
                  // 罐头键：字符串 → 默认标题 + 共用弹窗体。
                  if (typeof d === "string") {
                    entries.push([key, { title: titleFor(key), formItems: dialogBody }]);
                    continue;
                  }
                  // 全参对象：自定义 id/标题/宽度/全屏/逐弹窗字段表（AI-21④）。
                  entries.push([
                    key,
                    {
                      title: d.title !== undefined ? d.title : titleFor(key),
                      ...(d.width !== undefined ? { width: d.width } : {}),
                      ...(d.fullscreen !== undefined ? { fullscreen: d.fullscreen } : {}),
                      formItems: d.formItems !== undefined ? d.formItems : dialogBody,
                    },
                  ]);
                }
                return Object.fromEntries(entries);
              })()
            : undefined;

          const rowkeyOpt = withRowkey(args.tableOptions, args.rowkey);
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
            tableOptions: rowkeyOpt.tableOptions,
            formLayout: args.formLayout,
            operationColumn: args.operationColumn,
            tableBtns: args.tableBtns,
            toolbarBtns: args.toolbarBtns,
            dialogs: dialogs as any,
            expandConfig: args.expandConfig,
            treeConfig: args.treeConfig,
            mergeConfig: args.mergeConfig,
          });
          if (rowkeyOpt.warning) composeWarnings.unshift(rowkeyOpt.warning);

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
          for (const key of new Set(duplicateDialogKeys)) {
            allWarnings.push(
              `surfaces.dialog 里 '${key}' 出现了多次 —— 同一 key 只能有一个弹窗，后面的定义覆盖了前面的（仅最后一个生效）；请合并字段或改用不同的 key。`,
            );
          }
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
          // AN-15：与 generate_crud_from_config 同一份前置清单（同一个 formatPreflight）。
          if (result.preflight) {
            out.push("", formatPreflight(result.preflight));
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
            // Wave 4：表外分支此前把顶层 formLayout 静默丢掉（crudShape 收了、片段不接）。
            // 查询表单正是 formLayout 的原生消费面（labelWidth / minFoldRows 折叠）。
            ...(args.formLayout ? { formLayout: args.formLayout } : {}),
          });
          allWarnings.push(...r.warnings);
          sections.push(["## Query form (QueryForm.vue)", "", r.summary, "", "```vue", r.code, "```"].join("\n"));
        }

        if (hasDialog) {
          // ── 每个 dialog entry 各发射一段（AI-36）────────────────────────────
          // 旧实现只发一段、且忽略 entry 的 formItems/title/width/fullscreen ——
          // 多弹窗、逐弹窗字段表、自定义标题/宽度全部被静默丢弃。这里逐条落地：
          //   fields   = entry.formItems ?? (form 面 ?? query 面)   ← 与有表支同优先级
          //   title    = entry.title ?? 新增/编辑/查看（按 key）
          //   width/fullscreen → generate_dialog 的 AI-28 `options` 通道
          //   name     = 由 key 派生（多弹窗不得共用 useFormDialog）
          const dialogBody = hasForm ? form : query;
          const usedNames = new Set<string>();
          const dialogSections: string[] = [];

          for (const d of dialogEntries) {
            const canned = typeof d === "string";
            const key = String(canned ? d : d.key);
            const title = canned ? titleFor(key) : d.title !== undefined ? String(d.title) : titleFor(key);
            const fields = canned ? dialogBody : d.formItems !== undefined ? d.formItems : dialogBody;

            const options: Record<string, unknown> = {};
            if (!canned && d.width !== undefined) options.width = d.width;
            if (!canned && d.fullscreen !== undefined) options.fullscreen = d.fullscreen;

            const composableName = composableNameFor(key, usedNames, allWarnings);

            if (fields.length === 0) {
              allWarnings.push(
                `surfaces.dialog['${key}'] 没有任何可发射的字段（未给该弹窗的 formItems，也没有 form / query 面）—— ` +
                  `产物里的 formItems 为空，弹窗打开后只会是一个空壳；请补 form 面或该弹窗的 formItems。`,
              );
            }
            // 提交方法 / 只读语义按**标题字面量**判别（生成器既有契约：'新增'→POST，其余 PUT；
            // '查看'→只出关闭按钮）。自定义标题会让这两条启发式失准 —— 显式告警，不静默。
            if (args.apiUrl && key === "add" && title !== DIALOG_TITLES.add) {
              allWarnings.push(
                `surfaces.dialog['add'].title='${title}'：composable 按标题判别提交方法（'新增'→POST，其余→PUT），` +
                  `该弹窗将以 PUT 提交。不想要这个语义就省略 title，或在 open() 时显式传 '新增'。`,
              );
            }
            if (key === "view" && title !== DIALOG_TITLES.view) {
              allWarnings.push(
                `surfaces.dialog['view'].title='${title}'：只读形态按标题 '查看' 判别（只出「关闭」按钮），` +
                  `该弹窗会按可编辑形态发射。不想要这个语义就省略 title，或在 open() 时显式传 '查看'。`,
              );
            }

            const r = generateDialogBlock({
              fields,
              apiUrl: args.apiUrl,
              rowkey: args.rowkey,
              target: args.target,
              typescript: args.typescript,
              i18n: args.i18n,
              composableName,
              defaultTitle: title,
              ...(Object.keys(options).length > 0 ? { options: options as any } : {}),
            });
            allWarnings.push(...r.warnings);
            // 围栏由产物自己声明（AI-28：dialog 有 composable(.tsx) / component(.vue) 两种形态）。
            dialogSections.push(
              [
                `## Dialog composable (${composableName})`,
                "",
                r.summary,
                "",
                "```" + (r.fence ?? "tsx"),
                r.code,
                "```",
              ].join("\n"),
            );
          }

          // AI-28：这条支恒发 composable（弹窗体是 JSX render ⇒ 需 JSX 插件）。另一种形态
          // 不在前门的形状里（前门的 dialog 是 `surfaces.dialog`，不是 generate_dialog 的参），
          // 故此处**显式指路**而不是让它成为静默的能力缺口。只挂一次（多弹窗时挂在末段）。
          dialogSections[dialogSections.length - 1] +=
            "\n\n> 需要**不依赖 JSX 插件**的自包含 `<es-dialog>` SFC？调用 `generate_dialog` 并传 `mode: 'component'` —— 同一 `open(title, row?, onSuccess?)` 契约。";
          sections.push(...dialogSections);
        } else if (hasForm) {
          // form without a dialog → a standalone submit form
          const r = generateFormBlock({
            fields: form,
            context: "form",
            buttons: "submit",
            target: args.target,
            typescript: args.typescript,
            i18n: args.i18n,
            // 顶层 formLayout 的原生消费面就是表单：查询分支早已转发（见上），
            // 纯表单分支此前漏了 —— 工具描述承诺旋钮「forwarded verbatim」，
            // 实际 labelWidth / minFoldRows 在无表、无弹窗的请求里静默消失。
            ...(args.formLayout ? { formLayout: args.formLayout } : {}),
          });
          allWarnings.push(...r.warnings);
          sections.push(["## Form (FormBlock.vue)", "", r.summary, "", "```vue", r.code, "```"].join("\n"));
        }

        // 多弹窗时同一条提示（如 JSX 插件前提）会按弹窗重复 —— 去重保持告警可读。
        const uniqueWarnings = Array.from(new Set(allWarnings));
        const header: string[] = [
          `Generated ${sections.length} standalone fragment(s) (no table surface — not routed through the CRUD generator).`,
        ];
        if (uniqueWarnings.length > 0) {
          header.push("", "⚠️ Warnings:");
          for (const w of uniqueWarnings) header.push(`  - ${w}`);
        }
        header.push("", "---", "");
        return { content: [{ type: "text", text: header.join("\n") + "\n" + sections.join("\n\n---\n\n") }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error generating CRUD: ${error.message}` }], isError: true };
      }
    }
  );
}
