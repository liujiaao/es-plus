import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateFromConfig, formatPreflight, validateAndRepair, normalizeTableBtn, repairConfig, type ValidationResult, VALID_FORM_TYPES, VALID_CRUD_ACTIONS, FORM_TYPE_ALIASES } from "@es-plus/shared";

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

/**
 * Expression operators (closed set) — mirrors core's `EXPR_OPS` and the shared
 * authoritative schema verbatim (see packages/core/src/expr.ts). A JSON
 * expression (JSONLogic-shaped / CEL-semantics subset) is the escape hatch for
 * predicates the legacy `{field, op, value}` form cannot express — OR, AND-OR
 * mixes, ordering, nested NOT. It is plain JSON data so it can be inlined into
 * a schema-mode pageSchema (a JS string cannot).
 */
const EXPR_OPS = [
  "var",
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "in",
  "nin",
  "empty",
  "notEmpty",
  "truthy",
  "falsy",
  "and",
  "or",
  "not",
  "if",
] as const;

/** Operators that form a **single-key operator node** (`var` excluded: its operand is a string path). */
const EXPR_NODE_OP_SET: ReadonlySet<string> = new Set(EXPR_OPS.filter((op) => op !== "var"));

/** `var` node: read a model path (shares the same `isSafeProp` guard as field/prop). */
const HiddenExprVarSchema = z.strictObject({
  var: z
    .string()
    .min(1)
    .refine(isSafeProp, {
      message:
        'var must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype',
    })
    .describe('Model field path to read, e.g. "status" or "user.type"'),
});

/**
 * Operator node: exactly ONE key ∈ EXPR_OPS (excluding var), value an operand array.
 * Closed by whitelist (sandbox), arity checked at runtime by core's evaluator.
 */
const hiddenExprOpNode = (operand: z.ZodTypeAny) =>
  z.record(z.string(), z.array(operand)).refine(
    (o) => {
      const keys = Object.keys(o);
      return keys.length === 1 && EXPR_NODE_OP_SET.has(keys[0]);
    },
    { message: "expression operator node must have exactly one key ∈ EXPR_OPS (excluding var)" }
  );

/** Expression node: `{ var }` or an operator node (top-level: bare literals rejected). */
const HiddenExprNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([HiddenExprVarSchema, hiddenExprOpNode(HiddenExprOperandSchema)])
);

/** Expression operand: literal / operand array / node (recursive). */
const HiddenExprOperandSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(HiddenExprOperandSchema),
    HiddenExprVarSchema,
    hiddenExprOpNode(HiddenExprOperandSchema),
  ])
);

/**
 * A single condition, a single expression node, or an array (all must hold = AND, then hidden).
 * Legacy condition first (first-match preserves old behavior); the two branches are disjoint
 * (a legacy condition always has a string `field`; an expression node never does).
 */
const HiddenConditionListSchema = z.union([
  HiddenConditionSchema,
  HiddenExprNodeSchema,
  z.array(z.union([HiddenConditionSchema, HiddenExprNodeSchema])).min(1),
]);

/**
 * Field-level linkage (AI-07) fulfillment — plain JSON, NEVER a JS callback.
 * `dataOptions` is a LITERAL option array (the DSL forbids object literals, so branch by
 * declaring one rule per case with its own `when`); `required`/`disabled`/`value` are
 * expression nodes (`value` requires a non-empty `dependencies`).
 */
const ReactionFulfillSchema = z.object({
  dataOptions: z
    .array(DataOptionSchema)
    .optional()
    .describe(
      "Literal option array for this field while the rule is active (NOT an expression — the DSL forbids object literals, so branch by declaring one rule per case with its own `when`)."
    ),
  required: HiddenExprNodeSchema.optional().describe("Expression node evaluating to a boolean: make this field required."),
  disabled: HiddenExprNodeSchema.optional().describe("Expression node evaluating to a boolean: disable this field."),
  value: HiddenExprNodeSchema.optional().describe(
    "Expression node evaluating to this field's new value, written back to the model (requires a non-empty `dependencies`)."
  ),
});

/** Field linkage rule (AI-07) — mirrors the shared schema's ReactionSchema. */
const ReactionSchema = z
  .object({
    dependencies: z
      .array(
        z
          .string()
          .min(1)
          .refine(isSafeProp, {
            message:
              'dependencies item must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype',
          })
      )
      .optional()
      .describe("Model paths that retrigger this rule. REQUIRED when `fulfill.value` is present."),
    when: HiddenExprNodeSchema.optional().describe(
      'Optional gate expression: the rule applies only while it evaluates truthy. Must be a JSONLogic EXPRESSION NODE (e.g. { "==": [{ var: "country" }, "us"] }) — never the { field, op, value } legacy condition form (that belongs to isHidden), never a bare boolean. Plain JSON data, never a JS source string.'
    ),
    fulfill: ReactionFulfillSchema,
  })
  .refine((r) => r.fulfill.value === undefined || (r.dependencies?.length ?? 0) > 0, {
    message: "reactions.fulfill.value requires a non-empty dependencies (otherwise every model change would overwrite the user's manual edit)",
  });

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
  labelKey: z
    .string()
    .optional()
    .describe(
      "i18n label key for this field's column/form label (used with a global t() function; takes precedence over `label`). When omitted, i18n mode derives one as `field.<prop>`. Only takes effect once the host entry assembles the plugin with a `t` option."
    ),
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
  querySpan: z.number().int().min(1).max(24).optional().describe('Grid width of this field in the query form (1-24; 2 columns = 12 each). Column count is set PER FIELD — `formLayout` has no span key.'),
  formSpan: z.number().int().min(1).max(24).optional().describe('Grid width of this field in the add/edit form (1-24; 2 columns = 12 each). Column count is set PER FIELD — `formLayout` has no span key.'),
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
      "Extension point: a render-function source string for a custom TABLE CELL, e.g. \"(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.statusLabel)\" — honored on the table face (wired to a scoped slot in the wrapper SFC). A FORM-control render cannot be inlined (form items are serialized as JSON data in both modes), so it is preserved as a marked TODO(es-plus) marker in the generated SFC — NOT silently delivered; prefer the declarative form capabilities (formItemOptions/attrs/dataOptions/reactions) when a field needs custom FORM behaviour. Emit this (rather than dropping the requirement) when business logic exceeds the declarative schema."
    ),
  permissionValue: z.string().optional(),
  isHidden: HiddenConditionListSchema.optional().describe(
    'Conditional visibility: the field is HIDDEN while the condition holds. PLAIN JSON DATA (never a JS source string). A single { field, op?, value? }, a single JSON expression, or an array of them (array = AND, may mix both forms). TWO forms, never mixed within one node: (1) legacy condition { field, op, value } whose op is one of eq | ne | in | nIn | empty | notEmpty | truthy | falsy (default eq) — preferred for simple cases; (2) a JSON expression (JSONLogic-shaped), needed when a plain condition cannot express the predicate — OR, ordering (>, <=), or nested NOT: e.g. { or: [ { "==": [{ var: "status" }, "pending"] }, { ">": [{ var: "amount" }, 100] } ] }; expression ops = var == != > >= < <= in nin empty notEmpty truthy falsy and or not if. An expression op inside a legacy {field, op, value} node is INVALID (runtime warns and treats the field as visible) — use form (2) for those. Applies to the query/filter form and the add/edit dialog forms, NOT the table column. Distinct from permissionValue (a permission code): use isHidden when visibility depends on another field\'s value.'
  ),
  reactions: z
    .array(ReactionSchema)
    .optional()
    .describe(
      "Field-level linkage / computed rules (AI-07) — PLAIN JSON, never JS callbacks. Use when THIS field's options/required/disabled/value depend on ANOTHER field. Each rule `{ dependencies?, when?, fulfill }`: `dependencies` lists the model paths that retrigger it (REQUIRED for fulfill.value); `when` gates the rule; `fulfill` supplies `dataOptions` (literal array), `required`/`disabled` (boolean expressions) and/or `value` (this field's new value, written back). `when`/`required`/`disabled`/`value` are JSONLogic EXPRESSION NODES only (e.g. `{ '==': [{ var: 'country' }, 'us'] }`) — never the `{ field, op, value }` legacy condition form and never a bare boolean. Example: `city` options follow `province` → one rule per province with `when: { '==': [{ var: 'province' }, 'zj'] }` and `fulfill.dataOptions: [{label:'杭州',value:'hz'}]`. Applies to the query/filter form and add/edit dialog forms — NOT the table column."
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
    editRender: z
      .object({
        name: z.string().optional().describe("Inline-edit renderer name, e.g. '$input' | '$select' | '$textarea' | '$date' (vxe engine only)."),
        type: z.enum(["default", "visible"]).optional().describe("'default' = enter edit on trigger; 'visible' = editor always shown."),
        options: z
          .array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }))
          .optional()
          .describe("Option list for a '$select' editor (label/value pairs)."),
        props: z.record(z.unknown()).optional().describe("Props forwarded to the editor component."),
        autofocus: z.union([z.string(), z.boolean()]).optional(),
        defaultValue: z.unknown().optional(),
      })
      .optional()
      .describe("Column-level inline editor (AI-09 子项④). vxe engine only — requires tableOptions.editConfig AND tableOptions.engine:'vxe'. Function-valued fields (events) and custom-registered renderers are out of scope (Tier-3)."),
  })
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

/**
 * Declarative subset of a dialog footer button (AI-27).
 *
 * The runtime `DialogBtnConfig extends BtnConfig`, but `click` is attached by
 * `EsCrudPage`'s `resolveDialogBtns` from `action` — so the AI face only accepts
 * `{ name, type, action, permissionValue }`: pure JSON, every key with a real
 * runtime consumer. Function values (`click`) and toolbar-only positioning keys
 * (`position`/`code`/`direction`) do not travel in JSON / mean nothing in a
 * dialog footer. Keep byte-aligned with the shared `DialogBtnSchema`.
 */
const DialogBtnSchema = z.object({
  name: z.string().min(1).describe("Button label text."),
  type: z.string().optional().describe("Button type, e.g. 'primary' | 'danger' | 'default'."),
  action: z
    .enum(["confirm", "cancel", "custom"])
    .optional()
    .describe("'confirm' = validate the dialog form then run the submit path; 'cancel' = close + emit dialog-cancel; 'custom' (or omitted) = plain button the host wrapper must wire."),
  permissionValue: z.string().optional().describe("Permission code; filtered out unless the global permission function grants it."),
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
      heightType: z
        .enum(["height", "auto", "maxHeight"])
        .optional()
        .describe(
          "How the container height is applied: 'height' = fixed height (value from `height`, or `tabHeight` if set); 'maxHeight' = capped at `tabHeight` (a `height` value is IGNORED); 'auto' = no container height constraint. Default 'auto'."
        ),
      tabHeight: z
        .union([z.number(), z.string()])
        .optional()
        .describe(
          "Table height consumed for EVERY heightType: under 'height' it overrides `height`; under 'maxHeight' it is the cap. number → px, string → raw CSS value (e.g. '60vh'). Prefer it over `height` whenever a concrete height is needed — it is the only height key that applies when heightType is 'maxHeight'."
        ),
      height: z
        .union([z.number(), z.string()])
        .optional()
        .describe(
          "Container height used ONLY when heightType is 'height' (ignored for 'auto' / 'maxHeight' — use tabHeight there). Takes precedence over nothing: an explicit tabHeight always wins."
        ),
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
      // ── AI-22：闭合 strip-hazard（与 structured-config.schema.ts 同步）。这些键在
      //    core `TableOptions`/JSON 单源已有、三端运行时已消费，唯独两处 AI Zod 零声明
      //    —— 经 AI 入口传入会被静默剥掉。补齐并纳入 STRUCTURED_TABLE_CONTRACT 守卫。
      size: z.enum(["large", "default", "small"]).optional(),
      showHeader: z.boolean().optional(),
      emptyText: z.string().optional(),
      snIndex: z.boolean().optional(),
      leftText: z.string().optional(),
      cachePageSelection: z.boolean().optional(),
      refetchKeepPage: z.boolean().optional(),
      localPagination: z.boolean().optional(),
      // defaultSort 是本块唯一带嵌套 .object().optional() 的键，须放末尾（见 shared 同处注释）。
      defaultSort: z
        .object({ prop: z.string(), order: z.enum(["ascending", "descending"]) })
        .optional(),
      editConfig: z
        .object({
          trigger: z.enum(["click", "dblclick", "manual"]).optional().describe("How editing is entered (default 'click')."),
          mode: z.enum(["cell", "row"]).optional().describe("'cell' = single cell; 'row' = whole row."),
          showStatus: z.boolean().optional(),
          showUpdateStatus: z.boolean().optional(),
          showInsertStatus: z.boolean().optional(),
          autoClear: z.boolean().optional(),
          enabled: z.boolean().optional(),
        })
        .optional()
        .describe(
          "Enable vxe inline editing (AI-09 子项④). vxe engine only — MUST be paired with tableOptions.engine:'vxe'. A cell is only editable when its column also declares `editRender`. `keepSource` is auto-enabled at runtime."
        ),
      configTableOut: z
        .object({
          total: z.string().optional(),
          tableData: z.string().optional(),
          pageSize: z.string().optional(),
          current: z.string().optional(),
        })
        .optional()
        .describe(
          "Map the LIST API response onto table semantics when the backend does not use the default flat shape { records, rows, pageSize, pageNo }. Each value is the FLAT response key (no deep paths). e.g. { list, count } → { tableData: 'list', total: 'count' }. Only the keys you set are remapped."
        ),
      // AN-08：与 shared 权威 schema 逐键对齐（守卫断两份镜像键集相同）。
      // vxe 的具名键，JSON 可承载子集；函数型 loadMethod/toggleMethod 不进 AI 契约。
      treeConfig: z
        .object({
          transform: z.boolean().optional().describe("Build the tree client-side from FLAT rows (needs rowField + parentField). vxe only."),
          rowField: z.string().optional().describe("Row id field for transform mode (default 'id')."),
          parentField: z.string().optional().describe("Parent id field for transform mode (default 'parentId')."),
          childrenField: z.string().optional().describe("Child array field (default 'children')."),
          children: z.string().optional().describe("@deprecated vxe v4 alias of childrenField; normalized at runtime."),
          mapChildren: z.string().optional().describe("Field that caches original children in transform mode (default '_X_ROW_CHILD')."),
          expandAll: z.boolean().optional().describe("Start with every node expanded."),
          lazy: z.boolean().optional().describe("Lazy-load children (vxe only; the loader function itself is a Tier-3 extension point)."),
        })
        .optional()
        .describe(
          "vxe-only rich tree config (the SAME-NAME top-level `treeConfig` is the cross-renderer narrow subset; when both are set the generator merges them into tableOptions.treeConfig with the top-level key winning)."
        ),
      expandConfig: z
        .object({
          expandAll: z.boolean().optional().describe("Expand every row by default."),
          accordion: z.boolean().optional().describe("Accordion mode: at most one row expanded at a time."),
          lazy: z.boolean().optional().describe("Lazy-load expand content (vxe only; the loader function itself is a Tier-3 extension point)."),
        })
        .optional()
        .describe(
          "vxe-only row-expand switch (paired with `expand: true` / an expand column). Distinct from the top-level `expandConfig` (declarative read-only field list honored by all three renderers)."
        ),
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
            labelWidth: z.union([z.string(), z.number()]).optional(),
            minFoldRows: z.number().int().optional(),
          })
          .optional(),
        hasCustomRender: z
          .boolean()
          .optional()
          .describe("Declares the dialog body is hand-implemented in the wrapper SFC (a render function cannot travel in JSON). Relaxes the 'a mutating dialog needs formItems' check and emits a TODO(es-plus) marker; NOT forwarded to the dialog component."),
        isDraggable: z.boolean().optional().describe("Make the dialog draggable by its header."),
        maxHeight: z.union([z.string(), z.number()]).optional().describe("Max height of the dialog body (scrolls beyond it)."),
        fullscreen: z.boolean().optional().describe("Open the dialog fullscreen."),
        isHiddenFooter: z.boolean().optional().describe("Hide the whole footer (overrides configBtn)."),
        // Base data keys (AI-27): named core `DialogOptions` keys that all three
        // es-dialog implementations really consume. Undeclared here they were
        // silently stripped from `.dialogs[k]` by this z.object. Keep byte-aligned
        // with the shared DialogConfigSchema (guarded).
        showClose: z.boolean().optional().describe("Show the built-in close (X) entry; default true."),
        destroyOnClose: z.boolean().optional().describe("Destroy the dialog content on close (resets internal state each open)."),
        modal: z.boolean().optional().describe("Render the mask/overlay; default true."),
        closeOnClickModal: z.boolean().optional().describe("Close when the mask is clicked; default true."),
        closeOnPressEscape: z.boolean().optional().describe("Close when Escape is pressed; default true."),
        hiddenFullBtn: z.boolean().optional().describe("Hide the built-in fullscreen toggle button."),
        appendTo: z
          .string()
          .optional()
          .describe("CSS selector of the mount node (a DOM element cannot travel in JSON); the runtime resolves it with querySelector and falls back to document.body."),
        cacheKey: z
          .string()
          .optional()
          .describe("Instance cache key: repeat calls with the same key reuse one dialog instance (state survives close/reopen, recycled 10 min after close). Implemented by the vue3/vue2 runtimes; inert in the ant-design-vue adapter (registered deviation)."),
        configBtn: z
          .array(DialogBtnSchema)
          .min(1)
          .optional()
          .describe("Declarative footer buttons. Omit to get the generated cancel+confirm pair. Each entry is JSON data — the click handler is attached by the runtime from `action`."),
      })
    )
    .optional()
    .describe(
      "Per-dialog configs keyed by dialog ID (add/edit/view/…). Declaring `dialogs` gives a dialog its own base keys (appearance/close behaviour, `configBtn`, `formItems`) and does NOT suppress button derivation — the toolbar and row-action buttons are still derived from `actions` unless `toolbarBtns`/`operationColumn` are declared explicitly (those two, never `dialogs`, hand the button surface over)."
    ),
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
  treeConfig: z
    .object({
      childrenField: z
        .string()
        .optional()
        .describe("Key name that holds a row's nested child nodes (default 'children'). Set only when the API nests children under a different key."),
      expandAll: z.boolean().optional().describe("Whether all nodes start expanded (default false)."),
    })
    .optional()
    .describe(
      "Declarative tree table (AI-09 子项③). When set, the table renders parent/child levels from the nested child array in each row (row-key is emitted automatically). Static trees only — lazy/async loading is out of scope for this key. SAME NAME but DIFFERENT LAYER from `tableOptions.treeConfig` (the vxe-only VxeTreeConfig): this top-level key is the cross-renderer narrow subset, honored by el-table / a-table as well as vxe."
    ),
  mergeConfig: z
    .object({
      rowsBy: z
        .array(z.string().min(1))
        .min(1)
        .describe("Column props to merge. Each is grouped by ADJACENT-EQUAL values: the first row of a run keeps the cell with rowspan = run length, the rest are merged away."),
    })
    .optional()
    .describe(
      "Declarative row-merge (AI-23). `rowsBy: ['dept','team']` merges those columns across consecutive rows with equal values (the standard 'grouped rows' table). Cross-renderer narrow subset: el-table (span-method), a-table (per-column customCell) and vxe (mergeMethod) all honor it. The FUNCTIONAL escape hatch `tableOptions.spanMethod` remains Tier-3 and is NOT cross-renderer (a-table has no span-method channel) — if both are set, the explicit `spanMethod` wins."
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
    "ADVANCED path — hand-authored StructuredCrudConfig (typed fields, not a JSON blob). For a natural-language request, use generate_crud (the front door) instead: it asks you for `surfaces` and routes deterministically, so you do not have to fill the whole config. Use this tool when you ALREADY hold a typed config (e.g. one you persist, diff, or edited via refine_config) or need direct access to config keys the front door does not expose. It runs the same deterministic generator and schema gate as the front door. You (the AI client) do the reasoning — read the natural-language request, then FILL these typed fields directly: name (PascalCase), apiUrl (real endpoint), fields[] (prop/label/formtype + inQuery/inTable/inForm), actions[]. The field descriptions tell you how to map meaning → formtype. For requirements the schema can't express, emit a marked extension point (formatter/render string) rather than dropping them. Supports target:'vue3'|'vue2'|'antdv' (default vue3). Read esplus://conventions, esplus://examples/nl-to-config and esplus://types first; after drafting, self-review against the original request before calling.",
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
