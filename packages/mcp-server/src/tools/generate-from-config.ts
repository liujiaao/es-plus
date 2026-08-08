import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateFromConfig, VALID_FORM_TYPES, VALID_CRUD_ACTIONS } from "@es-plus/shared";

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

const FieldConfigSchema = z.object({
  prop: z.string().min(1).describe("Field key in the data model (camelCase), e.g. \"userName\""),
  label: z.string().min(1).describe("Human-readable column/form label, e.g. \"用户名\""),
  formtype: z
    .enum(VALID_FORM_TYPES as unknown as [string, ...string[]])
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
// virtual contract fields; tableBtns must use `code`, never `position`).
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
  toolbarBtns: z
    .array(
      z.object({
        name: z.string().min(1),
        key: z.string().optional(),
        type: z.string().optional(),
        icon: z.string().optional(),
        dialogKey: z.string().optional(),
        actionType: z.string().optional(),
        confirm: z.union([z.string(), z.boolean()]).optional(),
        permissionValue: z.string().optional(),
      })
    )
    .optional(),
  // NOTE: canonical positioning field is `code` (1=left, 2=right), the
  // single field all three renderers read. Kept in exact lockstep with
  // the authoritative shared schema (structured-config.schema.ts) — do
  // NOT re-introduce a `position` field here: vue3/antdv accept it as a
  // runtime override but vue2 ignores it, so emitting `position` breaks
  // 多端同构. check-schema-contract.mjs guards this.
  tableBtns: z.array(z.object({
    name: z.string().min(1),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    code: z.union([z.literal(1), z.literal(2)]).default(1).describe("1=left, 2=right"),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
  })).optional(),
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
    // host LLM either supplies formItems or drops the dialog.
    const isMutatingDialog = dialogId === "add" || dialogId === "edit";
    const formItems = Array.isArray(dlg?.formItems) ? dlg.formItems : [];
    if (isMutatingDialog && formItems.length === 0) {
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

export function registerGenerateFromConfig(server: McpServer) {
  server.tool(
    "generate_crud_from_config",
    "Generate a production-ready CRUD page from a STRUCTURED config (typed fields — not a JSON blob). This is the PRIMARY generation path: prefer it over generate_crud_page (which uses regex-based NL parsing and is a no-LLM fallback). You (the AI client) do the reasoning — read the natural-language request, then FILL these typed fields directly: name (PascalCase), apiUrl (real endpoint), fields[] (prop/label/formtype + inQuery/inTable/inForm), actions[]. The field descriptions tell you how to map meaning → formtype. For requirements the schema can't express, emit a marked extension point (formatter/render string) rather than dropping them. Supports target:'vue3'|'vue2'|'antdv' (default vue3). Read esplus://conventions, esplus://examples/nl-to-config and esplus://types first; after drafting, self-review against the original request before calling.",
    configShape,
    async (config: any) => {
      try {
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
