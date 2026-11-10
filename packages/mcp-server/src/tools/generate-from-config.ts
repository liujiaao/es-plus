import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateFromConfig, formatPreflight, validateAndRepair, normalizeTableBtn, repairConfig, buildSemanticWarnings, formatValidationError, StructuredCrudConfigSchema } from "@es-plus/shared";

// 这两个纯反馈函数已下沉到 shared（`config-feedback.ts`）：场景路由器
// `generate_scene` 与 `generate_crud` 必须对同一份 config 输出逐字节相同的文案。
// 这里 re-export 保持既有导入路径（测试/`generate-crud.ts`）不变。
export { buildSemanticWarnings, formatValidationError };

// W2：字段词汇表（FieldRule / DataOption / HiddenExpr / Reaction / FieldConfig）**不再
// 在此维护**。`generate_crud_from_config` 的入参形状直接复用 shared 的
// `StructuredCrudConfigSchema`（见下方 configShape），而片段工具（generate-table /
// generate-crud）需要的独立形状只剩 `ColumnSchema` / `TableBtnSchema` /
// `ToolbarBtnSchema` —— 它们不是 configShape 的一部分，故留在本文件。

// Mirrors the shared authoritative schema's prop guard — see
// packages/shared/src/structured-config.schema.ts for the rationale. Only
// unambiguously-broken forms are rejected; kebab-case props still work in
// schema mode, so they must NOT be rejected here. Still needed by ColumnSchema.
const UNSAFE_PROP_SEGMENT = /^(?:__proto__|constructor|prototype)$/;
function isSafeProp(v: string): boolean {
  if (v === "." || v === ".." || /[\\/]/.test(v)) return false;
  const segments = v.split(/\.|\[|\]/).filter((s) => s !== "");
  if (segments.length === 0) return false;
  return !segments.some((s) => UNSAFE_PROP_SEGMENT.test(s));
}

/**
 * Explicit table column (element of the `columns` escape array) — mirrors the
 * component contract `TableColumn`. This inline Zod copy MUST declare it too:
 * Zod strips unknown keys, so without it a config that supplies `columns` would
 * parse "successfully" with the whole array silently DROPPED (the table would
 * fall back to the derived columns) and no error. `check-schema-contract.mjs`
 * guards the `columns` contract so the two copies can't drift.
 *
 * Recursive via z.lazy (`groups` nests column arrays — multi-level headers).
 * Deliberately does NOT accept `render`/`formatter` source strings: those are
 * field-level extension points; this is the structured column path.
 */
export const ColumnSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    prop: z
      .string()
      .min(1)
      .refine(isSafeProp, {
        message:
          'prop must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype',
      })
      .optional()
      .describe('Data key for this column, e.g. "userName". Omit for non-field columns (type: index/selection/expand).'),
    label: z.string().optional().describe('Column header text. Omit for non-field columns.'),
    labelKey: z.string().optional().describe('i18n key alternative to label (used when i18n is on)'),
    type: z
      .enum(["index", "selection", "expand"])
      .optional()
      .describe(
        "Non-field column kind: 'index' = row number, 'selection' = checkbox column, 'expand' = row expander (needs an expandConfig/slot). Omit for a normal data column."
      ),
    width: z.union([z.number(), z.string()]).optional(),
    minWidth: z.union([z.number(), z.string()]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    fixed: z.union([z.boolean(), z.literal("left"), z.literal("right")]).optional(),
    sortable: z.boolean().optional(),
    ellipsis: z.boolean().optional(),
    showOverflowTooltip: z.boolean().optional(),
    // W3-2 column filters — mirrors the shared authoritative ColumnSchema.
    // Must be declared here too: Zod strips unknown keys, and THIS copy is what
    // validates tool arguments (a stripped key = filters silently never render).
    filters: z
      .array(
        z.object({
          text: z.string().describe("Option text shown in the filter dropdown."),
          value: z
            .union([z.string(), z.number(), z.boolean()])
            .describe('Row value matched by this option (loose primitive compare: 1 matches "1").'),
        })
      )
      .optional()
      .describe(
        "Declarative column filter options (PLAIN JSON — never a JS function). Rendered by the default engines and engine:'vxe'; the virtual engine (vue3 engine:'virtual') has NO filter UI. Filtering is LOCAL (the wrapper filters rows in the browser), so do not combine it with server-side paging/proxy contracts for the same column."
      ),
    filterMultiple: z
      .boolean()
      .optional()
      .describe("Allow selecting several filter options at once (default true)."),
    filterMode: z
      .enum(["equals", "includes"])
      .optional()
      .describe(
        "Local comparison for `filters` (default 'equals'): 'equals' = value equality (booleans/numbers compare loosely against strings), 'includes' = the cell text CONTAINS the selected option value (text search)."
      ),
    autoFilters: z
      .boolean()
      .optional()
      .describe(
        "Derive `filters` from this column's `dataOptions` (P2-3). When true and `filters` is omitted, each `dataOptions` entry's label/value becomes a filter option ({text, value}). Explicit `filters` always wins; no-op when dataOptions is empty or the engine is vue3 virtual (no filter UI)."
      ),
    permissionValue: z.string().optional().describe('Permission code; the column is not rendered without it'),
    groups: z
      .array(ColumnSchema)
      .optional()
      .describe(
        'Nested child columns for a GROUP HEADER (multi-level). Recursive. Cross-renderer safe up to 2 levels (antdv supports N; vue3/vue2 default tables flatten beyond 1).'
      ),
    btns: z.array(z.record(z.string(), z.unknown())).optional().describe('In-cell action buttons (operation column)'),
    editRender: z
      .object({
        name: z.string().optional().describe("Inline-edit renderer name, e.g. '$input' | '$select' | '$textarea' | '$date' (vxe engine only)."),
        type: z.enum(["default", "visible"]).optional().describe("'default' = enter edit on trigger; 'visible' = editor always shown."),
        options: z
          .array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }))
          .optional()
          .describe("Option list for a '$select' editor (label/value pairs)."),
        props: z.record(z.string(), z.unknown()).optional().describe("Props forwarded to the editor component."),
        autofocus: z.union([z.string(), z.boolean()]).optional(),
        defaultValue: z.unknown().optional(),
      })
      .optional()
      .describe("Column-level inline editor (AI-09 子项④). vxe engine only — requires tableOptions.editConfig AND tableOptions.engine:'vxe'. Function-valued fields (events) and custom-registered renderers are out of scope (Tier-3)."),
    // Column-level `expandConfig` — mirrors the shared authoritative ColumnSchema.
    // Must be declared here too: Zod strips unknown keys, and the generator's column
    // contract allowlist is derived from the shared ColumnSchema while THIS copy is
    // what validates tool arguments (a stripped key = empty expander, no warning).
    expandConfig: z
      .object({
        title: z.string().optional().describe("Optional title shown at the top of the expanded row."),
        fields: z
          .array(
            z.object({
              prop: z.string().min(1).describe("Row field to display (value = `row[prop]`)."),
              label: z.string().optional().describe("Label text for this field."),
              labelKey: z.string().optional().describe("i18n label key (used with a global t() function; takes precedence over `label`)."),
            })
          )
          .min(1)
          .describe("Read-only fields rendered inside the expanded row, one per line as `label: value`."),
      })
      .optional()
      .describe(
        "Row-expand content declared ON the `type:'expand'` column (AI-09 子项②). Same shape/semantics as the top-level `expandConfig`; use it when the expander is not the leading column or when `columns` is the source of truth. If BOTH are set, the top-level one wins on the expand column. Distinct from `tableOptions.expandConfig` (the vxe `{accordion}` switch)."
      ),
  })
    // 列契约的两条描述（`x-*` 保留、未知名丢弃并告警）只有在键能活到生成器时才成立：
    // 裸 `z.object` 会在 SDK 解析阶段把 `x-note` 和拼错的 `widht` 一起剥掉，
    // 生成器的 `strippedColumnKeys` 扫描永远看不到它们。passthrough 后由
    // `_arg-guard` 对非 `x-` 键给 did-you-mean，`x-*` 原样进入产物。
    .passthrough()
);

/**
 * Table toolbar button — mirrors the shared authoritative TableBtnSchema.
 *
 * Accepts `name`/`actionType` and their **legacy aliases** `label`/`action`
 * (AN-07/AN-21): the shipped few-shot and older hosts write `{ label, action }`.
 * Before this, Zod's default unknown-key stripping turned such a button into a
 * nameless, action-less shell with no error — exactly the tableBtns dimension
 * bug that cost 2/10. `normalizeTableBtn` is imported from shared (not copied)
 * so the two copies cannot drift; `check-schema-contract.mjs` follows the import
 * and asserts its position→code priority.
 *
 * Accepts both `position` (recommended by the renderer contract) and `code`
 * (legacy alias), and normalizes them so the emitted `code` always agrees with
 * `position`. Without the transform, Zod's unknown-key stripping would turn
 * `position: "right"` into `code: 1` (left) silently.
 */
export const TableBtnSchema = z
  .object({
    name: z.string().min(1).optional(),
    label: z.string().optional().describe("Alias of `name` (legacy example shape: label/action)"),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    position: z.enum(["left", "right"]).optional().describe("left | right (recommended positioning field)"),
    code: z.union([z.literal(1), z.literal(2)]).optional().describe("1=left, 2=right (legacy alias of position; normalized automatically)"),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    action: z.string().optional().describe("Alias of `actionType` (legacy example shape: label/action)"),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
  })
  .superRefine((b, ctx) => {
    if (!b.name && !b.label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tableBtns[] 缺少 name（别名 label 也未给）—— 按钮必须有显示名",
      });
    }
  })
  .transform((b) => normalizeTableBtn(b));

/**
 * Form-area toolbar button — mirrors the shared authoritative ToolbarBtnSchema.
 *
 * Same two-field contract as TableBtnSchema (`position` recommended, `code`
 * legacy alias), but with the **opposite fallback**: an EsForm toolbar button
 * with no position renders on the RIGHT (core's splitButtonsByDirection —
 * "默认（不配 direction）视为右侧"), whereas a table button defaults to the
 * left. Copying TableBtnSchema's `b.code ?? 1` here would silently move every
 * unpositioned form button from right to left.
 *
 * `direction` is declared here for the same reason as `position`: core's
 * `resolveButtonSide(btn, 'form')` chains `direction → position → code → right`,
 * so `direction` is the **highest**-priority form-side field. Omitting it from
 * this schema (as it was omitted from the shared one) means Zod strips it, and a
 * config that writes `direction: "left"` silently renders right.
 */
export const ToolbarBtnSchema = z
  .object({
    name: z.string().min(1),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    direction: z.enum(["left", "right"]).optional().describe("Form-button direction (legacy form-side field; wins over 'position')"),
    position: z.enum(["left", "right"]).optional().describe("left | right (recommended positioning field; defaults to right)"),
    code: z.union([z.literal(1), z.literal(2)]).optional().describe("1=left, 2=right (legacy alias of position; normalized automatically)"),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
    triggerEvent: z.boolean().optional(),
  })
  // Short-circuit priority (direction → position → code), NOT a left-OR/right-OR
  // merge: when the two conflict, e.g. { direction: 'right', position: 'left' },
  // an OR-merge yields code:1 (left) while core's resolveButtonSide reads
  // `direction ?? position` = right — the normalized code would contradict the
  // runtime side. Keep the ?? chain byte-for-byte aligned with the shared schema.
  .transform((b) => {
    const side = b.direction ?? b.position;
    if (side) return { ...b, code: (side === "left" ? 1 : 2) as 1 | 2 };
    return { ...b, code: (b.code ?? 2) as 1 | 2 };
  });

// ── Structured config raw shape (the tool's input schema) ──────────────
// Exposing the FULL structured shape as the tool's input — rather than a
// single opaque `config` JSON string — turns MCP tool-use into constrained
// decoding: the host LLM fills typed fields (with the .describe() guidance
// and enum value lists baked into the JSON schema) instead of free-forming a
// JSON blob. This is the single biggest lever on one-shot accuracy.
//
// W2：**直接复用 shared 的权威形状**，不再维护第二份手写副本。
//
// 此前这里是 330 行的 `configShape` 字面量 + 约 300 行的字段词汇表副本；两者都随
// `StructuredCrudConfigSchema` 漂移，靠 `check-schema-contract` 按源码正则逐项对账。
// 副本存在的理由（两包钉在不同 zod 大版本、对象不能混用）早已消失：workspace 现在
// 只有一份 zod 4（`scripts/check-deps.mjs`）。高级路径收的本来就是「已持有的类型化
// 配置」，默认值与 strip 语义都应当与判据完全一致 —— 所以这里就是同一份 shape，
// 一处定义、两处使用。
//
// 有意差异：无。前门旋钮（`_front-door-knobs.ts`）才需要剥默认值 + 递归 strict；
// 那是**受约束解码**的口径，与本工具的「校验后直通」不同。
const configShape = StructuredCrudConfigSchema.shape;

export function registerGenerateFromConfig(server: McpServer) {
  server.tool(
    "generate_crud_from_config",
    "ADVANCED path — hand-authored StructuredCrudConfig (typed fields, not a JSON blob). For a natural-language request, use generate_scene (scene='crud', the front door) instead: it asks you for `surfaces` and routes deterministically, so you do not have to fill the whole config. Use this tool when you ALREADY hold a typed config (e.g. one you persist, diff, or edited via refine_config) or need direct access to config keys the front door does not expose. It runs the same deterministic generator and schema gate as the front door, and it REPAIRS before judging: key aliases, relocated/nested keys, null placeholders, 'false'-style string booleans and dialog shorthands (dialogs:[\"add\"]) are normalized first and each repair is reported as a warning (validate_config does NOT repair — it is the read-only diagnostic). You (the AI client) do the reasoning — read the natural-language request, then FILL these typed fields directly: name (PascalCase), apiUrl (real endpoint), fields[] (prop/label/formtype + inQuery/inTable/inForm), actions[]. The field descriptions tell you how to map meaning → formtype. For requirements the schema can't express, emit a marked extension point (formatter/render string) rather than dropping them. Supports target:'vue3'|'vue2'|'antdv' (default vue3). Read esplus://conventions, esplus://examples/nl-to-config and esplus://types first; after drafting, self-review against the original request before calling.",
    configShape,
    async (config: any) => {
      try {
        // AN-24：先跑确定性修复环（别名/搬迁/null/成员布尔/弹窗简写），再校验。
        // 这样常见格式错误不会在「校验 → 让模型重写 → 再校验」里白白消耗一轮。
        // `validate_config` 工具**不**走这里，仍是只判不改的诊断面。
        const prepared = repairConfig(config);
        const repaired = prepared.config as any;

        // 前门确定性校验(C2·A3):非法 config 在这里就回结构化错误 + 建议,不进生成、不产半成品。
        const check = validateAndRepair(repaired);
        if (!check.valid) {
          return {
            content: [{ type: "text", text: formatValidationError(check) }],
            isError: true,
          };
        }

        const result = generateFromConfig(repaired);

        const semanticWarnings = buildSemanticWarnings(repaired);
        const repairWarnings = [
          ...prepared.renames.map((r) => `自动归一：${r.from} → ${r.to}（${r.note}）`),
          ...prepared.repairs.map((r) => `自动修复：${r.path}（${r.note}）`),
        ];
        const allWarnings = [...repairWarnings, ...result.warnings, ...semanticWarnings];


        const output: string[] = [result.summary];

        if (allWarnings.length > 0) {
          output.push("");
          output.push("⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):");
          for (const w of allWarnings) {
            output.push(`  - ${w}`);
          }
        }

        // AN-15：宿主入口前置清单。放在代码之前 —— 它回答的是「这段代码要跑起来还缺什么」，
        // 与 warnings（配置本身的映射问题）是两件事，故两段分开、不混进 warnings 列表。
        if (result.preflight) {
          output.push("");
          output.push(formatPreflight(result.preflight));
        }

        output.push("");
        output.push("---");
        output.push("");

        if (result.wrapperCode) {
          output.push("## Schema (schema.ts)");
          output.push("");
          output.push("```typescript");
          output.push(result.code);
          output.push("```");
          output.push("");
          output.push("---");
          output.push("");
          output.push("## Wrapper SFC (Page.vue)");
          output.push("");
          output.push("```vue");
          output.push(result.wrapperCode);
          output.push("```");
        } else {
          output.push("## Generated SFC");
          output.push("");
          output.push("```vue");
          output.push(result.code);
          output.push("```");
        }

        return {
          content: [{ type: "text", text: output.join("\n") }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating code: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
