import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateFromConfig, validateAndRepair, type ValidationResult, VALID_FORM_TYPES, VALID_CRUD_ACTIONS, FORM_TYPE_ALIASES } from "@es-plus/shared";

const FieldRuleSchema = z.object({
  required: z.boolean().optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  type: z.enum(["string", "number", "email", "url", "integer"]).optional(),
  message: z.string(),
  trigger: z.enum(["blur", "change"]).optional(),
});

const DataOptionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    disabled: z.boolean().optional(),
    children: z.array(DataOptionSchema).optional(),
  })
);

// Mirrors the shared authoritative schema's prop guard — see
// packages/shared/src/structured-config.schema.ts for the rationale. Only
// unambiguously-broken forms are rejected; kebab-case props still work in
// schema mode, so they must NOT be rejected here.
const UNSAFE_PROP_SEGMENT = /^(?:__proto__|constructor|prototype)$/;
function isSafeProp(v: string): boolean {
  if (v === "." || v === ".." || /[\\/]/.test(v)) return false;
  const segments = v.split(/\.|\[|\]/).filter((s) => s !== "");
  if (segments.length === 0) return false;
  return !segments.some((s) => UNSAFE_PROP_SEGMENT.test(s));
}

/**
 * Declarative conditional-visibility conditions — mirrors the shared
 * authoritative schema (packages/shared/src/structured-config.schema.ts).
 *
 * MUST be declared here too: this inline Zod copy is what the MCP tool parses
 * the host LLM's config with, and Zod strips unknown keys by default. Without
 * `isHidden` here, a config that declares a visibility condition would parse
 * "successfully" with the condition silently DROPPED — the field would render
 * unconditionally, with no error. `check-schema-contract.mjs` guards the
 * field-level contract so the two copies can't drift again.
 */
const HIDDEN_OPS = ["eq", "ne", "in", "nIn", "empty", "notEmpty", "truthy", "falsy"] as const;

const HiddenConditionSchema = z.object({
  field: z
    .string()
    .min(1)
    .refine(isSafeProp, {
      message:
        'field must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype',
    })
    .describe('Model field path to test, e.g. "status" or "user.type"'),
  op: z
    .enum(HIDDEN_OPS)
    .default("eq")
    .describe(
      "Comparison operator. eq/ne = equal/not-equal (eq is the default; number↔string is tolerated, e.g. 1 matches '1'); in/nIn = value is/is-not in the given array; empty/notEmpty = ''/null/undefined/[] check; truthy/falsy = JS truthiness (!!v). The field is HIDDEN while this expression holds."
    ),
  value: z
    .unknown()
    .optional()
    .describe(
      "Right-hand side of the comparison. REQUIRED for eq/ne (scalar) and in/nIn (array). IGNORED by empty/notEmpty/truthy/falsy."
    ),
});

/** A single condition, or an array of conditions (all must hold = AND, then hidden). */
const HiddenConditionListSchema = z.union([HiddenConditionSchema, z.array(HiddenConditionSchema).min(1)]);

const FieldConfigSchema = z.object({
  prop: z
    .string()
    .min(1)
    .refine(isSafeProp, {
      message:
        'prop must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype',
    })
    .describe("Field key in the data model (camelCase), e.g. \"userName\""),
  label: z.string().min(1).describe("Human-readable column/form label, e.g. \"用户名\""),
  formtype: z
    // 与 shared 的 StructuredCrudConfigSchema 同一口径：规范写法 ∪ 运行时承认的旧别名
    // （camelCase datePicker/timePicker 由 normalizeFormType 归一化）。
    // 只列 VALID_FORM_TYPES 会让 MCP 把合法旧配置判成非法，与运行时行为不一致。
    .enum([...VALID_FORM_TYPES, ...Object.keys(FORM_TYPE_ALIASES)] as unknown as [string, ...string[]])
    .describe(
      "Pick by the field's MEANING, not by keyword matching: status/type/enum/gender → Select; date/time → DatePicker/TimePicker; image/avatar/attachment/file → Upload; long text/remark/description → Input (attrs.type:'textarea'); boolean on/off → Switch; single-choice small set → Radio; multi-choice → Checkbox; region/category tree → Cascader; score → Rate. Default to Input for plain text."
    ),
  inQuery: z.boolean().default(true).describe("Show as a query/filter field above the table"),
  inTable: z.boolean().default(true).describe("Show as a table column"),
  inForm: z.boolean().default(true).describe("Show in the add/edit form"),
  querySpan: z.number().int().min(1).max(24).optional(),
  formSpan: z.number().int().min(1).max(24).optional(),
  required: z.boolean().optional(),
  rules: z.array(FieldRuleSchema).optional(),
  attrs: z.record(z.unknown()).optional().describe("Extra component props, e.g. { type: 'textarea', maxlength: 200 }"),
  dataOptions: z
    .array(DataOptionSchema)
    .optional()
    .describe("Static options for Select/Radio/Checkbox/Cascader. Use this for known fixed enums."),
  apiParams: z
    .object({
      url: z.string(),
      method: z.enum(["GET", "POST"]).optional(),
      labelField: z.string().optional(),
      valueField: z.string().optional(),
    })
    .optional()
    .describe("Remote options source for Select/Cascader — use instead of dataOptions when options come from an API."),
  width: z.union([z.number(), z.string()]).optional(),
  minWidth: z.union([z.number(), z.string()]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  fixed: z
    .union([z.boolean(), z.literal("left"), z.literal("right")])
    .optional(),
  ellipsis: z.boolean().optional(),
  formatter: z
    .string()
    .optional()
    .describe(
      "Extension point: a JS arrow-function source string for read-only cell formatting, e.g. \"(row) => row.amount.toFixed(2)\". Use this to express display logic the schema can't otherwise capture."
    ),
  render: z
    .string()
    .optional()
    .describe(
      "Extension point: a render-function source string for a fully custom cell/form control. Emit this (rather than dropping the requirement) when business logic exceeds the declarative schema."
    ),
  permissionValue: z.string().optional(),
  isHidden: HiddenConditionListSchema.optional().describe(
    'Conditional visibility: the field is HIDDEN while the condition holds. PLAIN JSON DATA (never a JS source string). A single { field, op?, value? } or an array of them (array = AND). Applies to the query/filter form and the add/edit dialog forms, NOT the table column. Distinct from permissionValue (a permission code): use isHidden when visibility depends on another field\'s value.'
  ),
});

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
const ColumnSchema: z.ZodType<any> = z.lazy(() =>
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
    permissionValue: z.string().optional().describe('Permission code; the column is not rendered without it'),
    groups: z
      .array(ColumnSchema)
      .optional()
      .describe(
        'Nested child columns for a GROUP HEADER (multi-level). Recursive. Cross-renderer safe up to 2 levels (antdv supports N; vue3/vue2 default tables flatten beyond 1).'
      ),
    btns: z.array(z.record(z.unknown())).optional().describe('In-cell action buttons (operation column)'),
  })
);

/**
 * Table toolbar button — mirrors the shared authoritative TableBtnSchema.
 *
 * Accepts both `position` (recommended by the renderer contract) and `code`
 * (legacy alias), and normalizes them so the emitted `code` always agrees with
 * `position`. Without the transform, Zod's unknown-key stripping would turn
 * `position: "right"` into `code: 1` (left) silently.
 */
const TableBtnSchema = z
  .object({
    name: z.string().min(1),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    position: z.enum(["left", "right"]).optional().describe("left | right (recommended positioning field)"),
    code: z.union([z.literal(1), z.literal(2)]).optional().describe("1=left, 2=right (legacy alias of position; normalized automatically)"),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
  })
  .transform((b) => ({
    ...b,
    code: (b.position === "right" ? 2 : b.position === "left" ? 1 : (b.code ?? 1)) as 1 | 2,
  }));

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
const ToolbarBtnSchema = z
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
// NOTE: this is a hand-maintained zod3 copy of the shared (zod4) authoritative
// StructuredCrudConfigSchema — the two zod versions can't share objects safely.
// scripts/check-schema-contract.mjs guards the two copies against drift
// (target enum must cover vue3/vue2/antdv; tableOptions must carry the height/
// virtual contract fields; tableBtns AND toolbarBtns must accept `position` and
// normalize it into `code` via .transform()).
// That guard locates each field by a regex on its zod expression, so keep the
// target/tableOptions/tableBtns declarations below in their existing textual
// form (do not inline placeholder samples of those expressions in comments —
// the guard would match the sample instead of the real field).
const configShape = {
  name: z.string().min(1).describe("Page/component name in PascalCase, e.g. \"UserManage\""),
  apiUrl: z.string().min(1).describe("Real REST base URL for this resource, e.g. \"/api/users\""),
  fields: z.array(FieldConfigSchema).min(1).describe("Field definitions — one per data attribute the user described"),
  actions: z
    .array(z.enum(VALID_CRUD_ACTIONS as unknown as [string, ...string[]]))
    .min(1)
    .describe("Enabled CRUD actions inferred from the request: add/edit/delete/view/export/import"),
  tableOptions: z
    .object({
      border: z.boolean().default(true),
      stripe: z.boolean().default(true),
      rowkey: z.string().default("id"),
      heightType: z.enum(["height", "auto", "maxHeight"]).optional(),
      tabHeight: z.union([z.number(), z.string()]).optional(),
      height: z.union([z.number(), z.string()]).optional(),
      multiSelect: z.boolean().optional(),
      highlightCurrentRow: z.boolean().default(true),
      headerCellStyle: z.record(z.string()).optional(),
      virtual: z.boolean().optional(),
      // 与 structured-config.schema.ts 的同名字段保持一致 —— 两边都是 z.object
      // （没有 passthrough），少一个键就等于把该配置静默剥掉。
      engine: z.enum(["default", "virtual", "vxe"]).optional(),
      rowHeight: z.number().optional(),
      estimatedRowHeight: z.number().optional(),
      overscanCount: z.number().int().optional(),
      rowClassName: z.string().optional(),
    })
    .optional(),
  pagination: z
    .object({
      pageSize: z.number().int().default(10),
      pageSizes: z.array(z.number().int()).optional(),
    })
    .optional(),
  mode: z.enum(["schema", "sfc"]).default("schema").describe("Output mode: 'schema' (schema.ts + wrapper SFC) or 'sfc' (single self-contained SFC)"),
  target: z.enum(["vue3", "vue2", "antdv"]).default("vue3").describe("Target renderer: vue3 (Element Plus), vue2 (Element UI), antdv (Ant Design Vue)"),
  typescript: z.boolean().default(true),
  permissions: z.record(z.string()).optional(),
  i18n: z.boolean().default(false),
  formLayout: z
    .object({
      span: z.number().optional(),
      labelWidth: z.union([z.string(), z.number()]).optional(),
      minFoldRows: z.number().int().optional(),
    })
    .optional(),
  toolbarBtns: z.array(ToolbarBtnSchema).optional(),
  // NOTE: both `position` and `code` are accepted. `position` is the field the
  // renderer contract recommends (@es-plus/* BtnConfig marks `code` deprecated
  // and core's getButtonPosition reads `position` first); `code` is the legacy
  // alias kept for lockstep with the shared authoritative schema.
  //
  // They are reconciled inside TableBtnSchema's .transform(), which always emits
  // a `code` consistent with `position`. That normalization is what makes the
  // two-field contract safe: without it, Zod's default unknown-key stripping
  // would silently rewrite `position: "right"` into `code: 1` (LEFT) with no
  // error at all. Do NOT drop the .transform() — check-schema-contract.mjs
  // guards it.
  tableBtns: z.array(TableBtnSchema).optional(),
  operationColumn: z
    .union([
      z.literal(false),
      z.object({
        label: z.string().optional(),
        width: z.union([z.number(), z.string()]).optional(),
        fixed: z.union([z.boolean(), z.literal("left"), z.literal("right")]).optional(),
        btns: z
          .array(
            z.object({
              name: z.string().min(1),
              key: z.string().optional(),
              type: z.string().optional(),
              icon: z.string().optional(),
              dialogKey: z.string().optional(),
              confirm: z.union([z.string(), z.boolean()]).optional(),
              permissionValue: z.string().optional(),
            })
          )
          .min(1),
      }),
    ])
    .optional(),
  dialogs: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        width: z.union([z.string(), z.number()]).optional(),
        formItems: z.array(FieldConfigSchema).optional(),
        formLayout: z
          .object({
            span: z.number().optional(),
            labelWidth: z.union([z.string(), z.number()]).optional(),
            minFoldRows: z.number().int().optional(),
          })
          .optional(),
        hasCustomRender: z.boolean().optional(),
        isDraggable: z.boolean().optional(),
        maxHeight: z.union([z.string(), z.number()]).optional(),
        fullscreen: z.boolean().optional(),
        isHiddenFooter: z.boolean().optional(),
      })
    )
    .optional(),
  columns: z
    .array(ColumnSchema)
    .optional()
    .describe(
      "Explicit table columns (escape hatch over the `fields`-derived columns). When present it REPLACES the derived data columns (override, not merge) — `fields` still drives the query/add/edit forms. Use it for multi-level group headers (`groups`), and non-field columns (`type`: index/selection/expand). The operation column is STILL appended from `actions`/`operationColumn` (set `operationColumn:false` to manage it yourself). Omit to keep the derived one-field-one-column behavior."
    ),
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
      "Row-expand content (AI-09 子项②). When set, the table gets ONE row-expander whose expanded content is a read-only field list. If `columns` already declares a `{type:'expand'}` column it is used as-is (position preserved) and the content attaches to it; otherwise the generator prepends a leading expand column. Distinct from `tableOptions.expandConfig` (the vxe `{accordion}` switch)."
    ),
} as const;

/**
 * Cheap post-parse semantic invariants. These never block generation (the
 * config is already schema-valid); they surface as non-blocking warnings so
 * the host LLM can self-correct on the next turn if the mapping looks off.
 */
export function buildSemanticWarnings(config: any): string[] {
  const warnings: string[] = [];
  const fields: any[] = Array.isArray(config.fields) ? config.fields : [];
  const topProps = new Set(fields.map((f) => f.prop));

  // Add/edit requested but no field is form-visible → the form would be empty.
  const mutating = (config.actions ?? []).some((a: string) => a === "add" || a === "edit");
  if (mutating && fields.length > 0 && fields.every((f) => f.inForm === false)) {
    warnings.push(
      "actions include add/edit but every field has inForm:false — the add/edit form will be empty. Set inForm:true on the fields users should fill."
    );
  }

  // dialogs.formItems referencing props absent from the top-level field set.
  const dialogs = config.dialogs ?? {};
  for (const [dialogId, dlg] of Object.entries<any>(dialogs)) {
    // An add/edit dialog with no form items renders an empty modal body — the
    // generator silently emits a dialog with nothing to fill (see the
    // `if (dlg.formItems)` guard in structured-generator). Surface it so the
    // host LLM either supplies formItems or drops the dialog. Skip when
    // hasCustomRender:true — the modal body is a bespoke render, not an empty
    // form, so "no formItems" is expected and the warning would be noise.
    const isMutatingDialog = dialogId === "add" || dialogId === "edit";
    const formItems = Array.isArray(dlg?.formItems) ? dlg.formItems : [];
    if (isMutatingDialog && formItems.length === 0 && !dlg?.hasCustomRender) {
      warnings.push(
        `dialog "${dialogId}" is an add/edit dialog but has no formItems — the modal body will be empty. Add formItems (usually the mutable subset of fields) so users have inputs to fill.`
      );
    }
    for (const fi of formItems) {
      if (fi?.prop && !topProps.has(fi.prop)) {
        warnings.push(
          `dialog "${dialogId}" form item "${fi.prop}" is not in the top-level fields — confirm this is intentional (it won't map to a table column).`
        );
      }
    }
  }

  // Select/Cascader with neither static nor remote options.
  for (const f of fields) {
    const needsOptions = f.formtype === "Select" || f.formtype === "Cascader";
    const hasOptions =
      (Array.isArray(f.dataOptions) && f.dataOptions.length > 0) || !!f.apiParams;
    if (needsOptions && !hasOptions) {
      warnings.push(
        `field "${f.prop}" is a ${f.formtype} but has no dataOptions or apiParams — it will render an empty dropdown. Provide dataOptions (fixed enum) or apiParams (remote source).`
      );
    }
  }

  return warnings;
}

/**
 * 把一次校验失败渲染成前门的结构化错误正文（C2·A3）。
 *
 * 与 `validate_config` 工具的错误块同形（`  - {error}` + `Suggestions:` + `  → {s}`），
 * 让宿主 LLM 两条路径看到的失败格式一致。关键点：**什么都没生成** —— 非法 config 到不了
 * 用户面前，而不是像过去那样被 `assertValidConfig` 抛成一句泛化 `Error generating code: …`。
 */
export function formatValidationError(result: ValidationResult): string {
  return [
    "✗ Config failed structured-config validation — nothing was generated:\n",
    ...result.errors.map((e) => `  - ${e}`),
    "",
    result.suggestions.length > 0 ? "Suggestions:" : "",
    ...result.suggestions.map((s) => `  → ${s}`),
    "",
    "Fix these and call again.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function registerGenerateFromConfig(server: McpServer) {
  server.tool(
    "generate_crud_from_config",
    "Generate a production-ready CRUD page from a STRUCTURED config (typed fields — not a JSON blob). This is the PRIMARY generation path: prefer it over generate_crud_page (which uses regex-based NL parsing and is a no-LLM fallback). You (the AI client) do the reasoning — read the natural-language request, then FILL these typed fields directly: name (PascalCase), apiUrl (real endpoint), fields[] (prop/label/formtype + inQuery/inTable/inForm), actions[]. The field descriptions tell you how to map meaning → formtype. For requirements the schema can't express, emit a marked extension point (formatter/render string) rather than dropping them. Supports target:'vue3'|'vue2'|'antdv' (default vue3). Read esplus://conventions, esplus://examples/nl-to-config and esplus://types first; after drafting, self-review against the original request before calling.",
    configShape,
    async (config: any) => {
      try {
        // 前门确定性校验(C2·A3):非法 config 在这里就回结构化错误 + 建议,不进生成、不产半成品。
        const check = validateAndRepair(config);
        if (!check.valid) {
          return {
            content: [{ type: "text", text: formatValidationError(check) }],
            isError: true,
          };
        }

        const result = generateFromConfig(config);

        const semanticWarnings = buildSemanticWarnings(config);
        const allWarnings = [...result.warnings, ...semanticWarnings];


        const output: string[] = [result.summary];

        if (allWarnings.length > 0) {
          output.push("");
          output.push("⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):");
          for (const w of allWarnings) {
            output.push(`  - ${w}`);
          }
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
