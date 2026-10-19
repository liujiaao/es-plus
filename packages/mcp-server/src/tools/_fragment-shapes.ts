import { z } from "zod";
import { VALID_FORM_TYPES, FORM_TYPE_ALIASES } from "@es-plus/shared";

/**
 * zod3 shapes shared by the fragment tools (generate_form / generate_table /
 * generate_dialog) and the front door (generate_crud).
 *
 * This is a hand-maintained zod3 mirror of the shared (zod4) authoritative
 * vocabulary (FieldConfig minus the inQuery/inTable/inForm membership flags —
 * those are derived by composeCrudConfig, not supplied per surface). The two
 * zod versions can't share objects safely; scripts/check-fragment-contract.mjs
 * guards this copy against drift from the shared SurfaceField contract.
 */

const UNSAFE_PROP_SEGMENT = /^(?:__proto__|constructor|prototype)$/;
function isSafeProp(v: string): boolean {
  if (v === "." || v === ".." || /[\\/]/.test(v)) return false;
  const segments = v.split(/\.|\[|\]/).filter((s) => s !== "");
  if (segments.length === 0) return false;
  return !segments.some((s) => UNSAFE_PROP_SEGMENT.test(s));
}

// 教学面与 shared 权威副本同步：宿主 LLM 只看得到 `.describe()`（fragment-prompt
// 直接自省 shape），所以「镜像了键、没镜像文案」等于让片段工具教得比 CRUD 前门少。
const FieldRuleSchema = z.object({
  required: z
    .boolean()
    .optional()
    .describe("Enforce a value with this rule (same effect as field-level `required`; prefer the field-level key for unconditional requirements)."),
  pattern: z
    .string()
    .optional()
    .describe('RegExp SOURCE STRING the value must match (e.g. "^1\\d{10}$"), not a RegExp object.'),
  min: z.number().optional().describe("Minimum length for strings / minimum value for numbers."),
  max: z.number().optional().describe("Maximum length for strings / maximum value for numbers."),
  type: z
    .enum(["string", "number", "email", "url", "integer"])
    .optional()
    .describe("Value type validated by this rule."),
  message: z.string().describe("Message shown when the rule fails — REQUIRED, write it in the user's language."),
  trigger: z
    .enum(["blur", "change"])
    .optional()
    .describe("'blur' validates when the field loses focus; 'change' validates while the value changes."),
});

const DataOptionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    disabled: z.boolean().optional(),
    children: z.array(DataOptionSchema).optional(),
  })
);

/**
 * AI-16 表达式节点的**结构面**：`{ var: path }` 或 `{ <op>: operand | operand[] }`。
 *
 * 刻意只声明成对象（`Record<string, any>`），不镜像递归算子闭集 —— 那是权威 shared
 * Zod 的职责。这里存在的唯一目的是让片段 prompt 的 `reactions` 类型不再是 `any[]`
 * （模型因此把 `fulfill.required` 写成裸 `true`）；结构漂移由
 * check-fragment-contract 第 8 项对照 shared `ReactionSchema` 守着。
 */
const ExprNodeSchema = z
  .record(z.string(), z.any())
  .describe(
    "Expression node (JSONLogic-shaped, plain JSON): { var: '<model path>' } or an operator node such as { '==': [{ var: 'country' }, 'us'] } / { and: [...] }. NEVER a literal, a bare boolean, or the legacy { field, op, value } condition form."
  );

/** 联动 fulfillment 的结构镜像（权威：shared `ReactionFulfillSchema`）。 */
const ReactionFulfillSchema = z.object({
  dataOptions: z
    .array(DataOptionSchema)
    .optional()
    .describe("Literal option array for this field while the rule is active (NOT an expression — branch per case with one rule each)."),
  required: ExprNodeSchema.optional().describe("Expression node evaluating to a boolean: make this field required."),
  disabled: ExprNodeSchema.optional().describe("Expression node evaluating to a boolean: disable this field."),
  value: ExprNodeSchema.optional().describe(
    "Expression node evaluating to this field's new value, written back to the model (requires a non-empty `dependencies`)."
  ),
});

/** 联动规则的结构镜像（权威：shared `ReactionSchema`）。 */
const ReactionSchema = z.object({
  dependencies: z
    .array(z.string().min(1))
    .optional()
    .describe("Model paths that retrigger this rule. REQUIRED when `fulfill.value` is present."),
  when: ExprNodeSchema.optional().describe("Optional gate expression: the rule applies only while it evaluates truthy."),
  fulfill: ReactionFulfillSchema,
});

/**
 * A single field as described within ONE surface (query / table / form).
 * Deliberately omits inQuery/inTable/inForm — surface membership is implied by
 * which list the field appears in, and composeCrudConfig derives the flags.
 */
export const surfaceFieldSchema = z.object({
  prop: z
    .string()
    .min(1)
    .refine(isSafeProp, {
      message:
        'prop must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype',
    })
    .describe('Field key in the data model (camelCase), e.g. "userName"'),
  label: z.string().min(1).describe('Human-readable column/form label, e.g. "用户名"'),
  labelKey: z
    .string()
    .optional()
    .describe("i18n label key for this field (takes precedence over `label`; only takes effect once the host entry assembles the plugin with a `t` option)."),
  formtype: z
    .enum([...VALID_FORM_TYPES, ...Object.keys(FORM_TYPE_ALIASES)] as unknown as [string, ...string[]])
    .describe(
      "Pick by the field's MEANING, not by keyword: status/type/enum/gender → Select; date/time → DatePicker/TimePicker; image/avatar/file → Upload; long text → Input (attrs.type:'textarea'); on/off → Switch; multi-choice → Checkbox; tree → Cascader; score → Rate. Default Input."
    ),
  querySpan: z
    .number()
    .int()
    .min(1)
    .max(24)
    .optional()
    .describe(
      "Grid width of this field in the query form (1-24; 2 columns = 12 each). Column count is set PER FIELD — there is no layout-level span key."
    ),
  formSpan: z
    .number()
    .int()
    .min(1)
    .max(24)
    .optional()
    .describe(
      "Grid width of this field in the add/edit form (1-24; 2 columns = 12 each). Column count is set PER FIELD — there is no layout-level span key."
    ),
  required: z.boolean().optional(),
  rules: z
    .array(FieldRuleSchema)
    .optional()
    .describe(
      "Validation rules for this field. Use `pattern`/`min`/`max`/`type` for format constraints and `trigger` for when validation runs; `message` is REQUIRED. Emit these rather than dropping a format/range requirement the user stated."
    ),
  attrs: z.record(z.unknown()).optional().describe("Extra component props, e.g. { type: 'textarea', maxlength: 200 }"),
  dataOptions: z
    .array(DataOptionSchema)
    .optional()
    .describe("Static options for Select/Radio/Checkbox/Cascader (fixed enum)."),
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
  fixed: z.union([z.boolean(), z.literal("left"), z.literal("right")]).optional(),
  ellipsis: z.boolean().optional(),
  formatter: z
    .string()
    .optional()
    .describe('Extension point: a JS arrow-function source string for read-only cell formatting, e.g. "(row) => row.amount.toFixed(2)".'),
  render: z
    .string()
    .optional()
    .describe("Extension point: a render-function source string for a fully custom cell/control."),
  // AI-21③：AI-06/07 的运行时底座（core normalizeFormItem 编译谓词）早已存在，
  // 但入口词汇此前不含这两个键 —— 前门/片段一写就被 zod3 形状静默剥掉（「入口 vs schema」缺口）。
  // isHidden 刻意用 `any`：真正的递归 DSL 校验由权威 shared Zod 在受校验路径上完成；
  // 在此逐字镜像那套递归/refine 会造出第三份**无守卫**副本（check-fragment-contract 只比顶层键集）。
  isHidden: z
    .any()
    .optional()
    .describe(
      "Conditional visibility (AI-06): PLAIN JSON data, never a JS function string. Semantics: the field is HIDDEN while the condition HOLDS (`{ field: 'payType', op: 'eq', value: 'cash' }` = hidden while payType is cash). TWO forms, never mixed within one node: " +
        "(1) legacy condition `{ field, op?, value? }` — `op` is ONE of eq | ne | in | nIn | empty | notEmpty | truthy | falsy (default eq); preferred for simple comparisons; " +
        "(2) JSONLogic-shaped expression node for ordering / OR / nesting, e.g. `{ '>': [{ var: 'amount' }, 100] }` or `{ or: [...] }` — expression ops (closed set): var == != > >= < <= in nin empty notEmpty truthy falsy and or not if. " +
        "An expression op such as `>` or `!=` inside a legacy `{field, op, value}` node is INVALID (the runtime warns and treats the field as visible) — use form (2) for those. " +
        "An ARRAY of nodes is AND (hidden only when ALL hold) and may mix both forms. Applies to the query and add/edit forms, NOT the table column."
    ),
  // reactions 与 isHidden 同因保留 `any`？不：模型反复把 `fulfill.required` 写成裸 `true`
  // （`any[]` 的类型面在教「随便什么都行」，再有 prose 也压不住）。这里镜像**结构**
  // （dependencies/when/fulfill 及 fulfill 的四个键），表达式节点仍只声明为对象
  // `Record<string, any>` —— 递归算子校验依旧归权威 shared Zod，不做第三份校验器。
  // 结构漂移由 check-fragment-contract 第 8 项守着。
  reactions: z
    .array(ReactionSchema)
    .optional()
    .describe(
      "Field linkage (AI-07): an array of {dependencies?, when?, fulfill} rules — PLAIN JSON, never JS callbacks. Use when THIS field's options/required/disabled/value depend on ANOTHER field (fulfill: {dataOptions?, required?, disabled?, value?}). `dependencies` lists the model paths that retrigger it (REQUIRED for fulfill.value). `when`, `fulfill.required`, `fulfill.disabled` and `fulfill.value` are JSONLogic EXPRESSION NODES only — e.g. `when: { '==': [{ var: 'country' }, 'us'] }`, `required: { '==': [{ var: 'country' }, 'us'] }` — never the `{ field, op, value }` condition form and never a bare boolean (those are for `isHidden`). `fulfill.dataOptions` is a literal option array, not an expression. One rule per case, LAST WINS. Applies to the query and add/edit forms, NOT the table column."
    ),
  permissionValue: z
    .string()
    .optional()
    .describe(
      "Permission CODE gating this field (RBAC, checked by the host's global permission(code)) — NOT a data-driven condition: use `isHidden` for show/hide by another field's value, `reactions` for options/required/disabled linkage."
    ),
});

/**
 * `generate_table` 的字段形状（AI-51）。
 *
 * 表格列**只消费** `buildTableColumn` / `buildTableColumnSFC` 的列属性
 * （prop/label/labelKey/width/minWidth/align/fixed/ellipsis/render/formatter/permissionValue）；
 * `formtype` 在独立 `<es-table>` 片段里零消费者（`buildFormItem`/`inferTsType` 都不在表格
 * 路径上）。共享 `surfaceFieldSchema` 把它设为必填是为了表单/弹窗（控件类型决定渲染），
 * 对表格却是一条**幻影要求**：模型必须填，产物却不读。这里只对它放宽为 optional；
 * 其余键与文案逐字不变（契约守卫仍逐键对照 shared `SurfaceField`）。
 */
export const tableFieldSchema = surfaceFieldSchema.extend({
  formtype: surfaceFieldSchema.shape.formtype.optional(),
});

/** 格式 + 围栏：`result.fence` 优先（AI-28：dialog 有了第二种产物形态），否则用调用方的兜底。 */
export function renderFragmentOutput(
  result: { code: string; summary: string; warnings: string[]; fence?: "vue" | "tsx" },
  fence: "vue" | "tsx",
): { content: Array<{ type: "text"; text: string }> } {
  const effective = result.fence ?? fence;
  const out: string[] = [result.summary];
  if (result.warnings.length > 0) {
    out.push("");
    out.push("⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):");
    for (const w of result.warnings) out.push(`  - ${w}`);
  }
  out.push("", "---", "");
  out.push("```" + effective);
  out.push(result.code);
  out.push("```");
  return { content: [{ type: "text", text: out.join("\n") }] };
}

/**
 * `generate_table` 的容器级选项（Wave 4）—— shared `TableBlockOptions` 的 zod3 镜像，
 * 键集与权威 AI 侧 `StructuredCrudConfigSchema.tableOptions` **逐键相同**
 * （它本身已是 core `TableOptions` 里 JSON 可承载的声明式子集）。
 *
 * 手工双份同源（shared zod4 的 schema 不能跨包复用）：`scripts/check-fragment-contract.mjs`
 * 断本对象 ≡ shared `TableBlockOptions` ≡ 权威 `tableOptions` 键集，且每个键都在发射枚举里
 * —— `z.object` 无 passthrough，跑偏了就是静默 strip。
 */
// 文案逐条镜像自 shared 权威 `StructuredCrudConfigSchema.tableOptions`：片段 prompt
// 只自省 `.describe()`，少一条文案 = 宿主 LLM 少一条教学（键在、语义不在）。
export const tableBlockOptionsSchema = z.object({
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
  virtual: z
    .boolean()
    .optional()
    .describe(
      "Enable virtual scrolling for large datasets. The engine is target-specific: vue3 renders the el-table-v2 engine; antdv forwards `virtual` to <a-table> (Ant Design Vue 4 has native virtual scroll); vue2 + Element UI has no equivalent and degrades to a plain el-table with a console warning — the vue2 large-data path is `engine: 'vxe'` instead. Safe to set on any target — only the rendering engine differs."
    ),
  engine: z
    .enum(["default", "virtual", "vxe"])
    .optional()
    .describe(
      "Table rendering engine, an alternative to `virtual: true`. 'default' = the target's plain table, 'virtual' = the target's virtual engine (vue3 el-table-v2; antdv <a-table :virtual>; vue2 has no equivalent and degrades with a warning), 'vxe' = vxe-table, available on ALL THREE targets — 'vxe' is the large-data path for vue2."
    ),
  rowHeight: z
    .number()
    .optional()
    .describe("Row height in px for virtual mode (vue3 / el-table-v2 only; default 50)"),
  estimatedRowHeight: z
    .number()
    .optional()
    .describe("Estimated row height for dynamic-height virtual scrolling (vue3 / el-table-v2 only)"),
  overscanCount: z
    .number()
    .int()
    .optional()
    .describe("Buffer rows outside the visible area (vue3 / el-table-v2 only; default 2)"),
  rowClassName: z.string().optional().describe("Custom row CSS class name"),
  size: z
    .enum(["large", "default", "small"])
    .optional()
    .describe("Table density. Default 'small' at runtime; all three targets accept these."),
  showHeader: z.boolean().optional().describe("Show the table header (default true). Set false to hide it."),
  emptyText: z.string().optional().describe("Text shown when there are no rows (default '暂无数据')."),
  snIndex: z.boolean().optional().describe("Render a leading row-index (serial number) column."),
  leftText: z.string().optional().describe("Text shown on the left side of the table toolbar."),
  cachePageSelection: z
    .boolean()
    .optional()
    .describe(
      "Persist the checkbox selection across page changes (needs a stable rowkey). Default true at runtime; set false to reset selection on page change."
    ),
  refetchKeepPage: z
    .boolean()
    .optional()
    .describe("Keep the current page when re-fetching (default false). Query/reset still return to page 1."),
  localPagination: z
    .boolean()
    .optional()
    .describe("Paginate already-fetched data client-side instead of requesting each page from the API."),
  defaultSort: z
    .object({ prop: z.string(), order: z.enum(["ascending", "descending"]) })
    .optional()
    .describe("Default sort applied on first render."),
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
    .optional(),
  configTableOut: z
    .object({
      total: z.string().optional(),
      tableData: z.string().optional(),
      pageSize: z.string().optional(),
      current: z.string().optional(),
    })
    .optional()
    .describe(
      'Map the LIST API response onto table semantics when the backend does not use the default flat shape. Default mapping is { total: "records", tableData: "rows", pageSize: "pageSize", current: "pageNo" }. Each value is the FLAT response key (no deep paths — the component only reads top-level keys). e.g. a backend returning { list: [...], count: N } → { tableData: "list", total: "count" }. Only the keys you set are remapped; omit a key to keep its default.'
    ),
});

/** `generate_table` 的分页播种（权威 schema 顶层 `pagination` 的数据子集）。 */
export const tablePaginationSchema = z.object({
  pageSize: z.number().int().optional().describe("Rows per page on first render (runtime default 10)."),
  pageSizes: z
    .array(z.number().int())
    .optional()
    .describe("Selectable page-size options shown in the pager, e.g. [10, 20, 50]."),
});

/** `generate_form` 的表单布局（权威 schema 顶层 `formLayout` 的数据子集）。 */
export const formLayoutSchema = z.object({
  labelWidth: z.union([z.string(), z.number()]).optional().describe("Label column width, e.g. '110px' (number → px)."),
  minFoldRows: z.number().int().optional().describe("Form collapses when the number of rows exceeds this value."),
});

/**
 * `generate_dialog` 的弹窗底座选项（AI-28）—— core `DialogOptions` 里**可声明式表达**
 * 的那一子集，与 shared `DialogBlockOptions`（`packages/shared/src/fragment-generator.ts`）
 * **手工双份同源**（zod4 ↔ zod3 不能共用对象）。
 *
 * 刻意不收：`title`（`open(title, …)` 的入参，单一真源）、函数值键
 * （`render`/`renderHeader`/`renderFooter`/`configBtn`/`onClosed`/`beforeClose`）、
 * 端特化键（`alignCenter`/`top`/`modalClass`/`loading` —— `check-type-exports.mjs`
 * 已登记为跨端偏差）。`appendTo` 只收选择器字符串（DOM 元素走不了 JSON）。
 *
 * 这份副本**受守卫咬住**：`scripts/check-fragment-contract.mjs` 断它 ≡ 上面那个
 * shared 接口，且两者都 ⊆ core `DialogOptions` 的具名键 —— 往这里加一个 core 不认的
 * 键（或只改一侧）都会红。`z.object` 无 passthrough：跑偏了就是**静默 strip**。
 */
export const dialogOptionsSchema = z.object({
  width: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Dialog width (default '560px'; a number is emitted as a px width, a string is used verbatim)."),
  maxHeight: z.union([z.string(), z.number()]).optional().describe("Max height of the dialog body (scrolls beyond it)."),
  isDraggable: z.boolean().optional().describe("Make the dialog draggable by its header."),
  fullscreen: z.boolean().optional().describe("Open the dialog fullscreen."),
  isHiddenFooter: z.boolean().optional().describe("Hide the whole footer (the skeleton's buttons go with it — only use this if the body closes itself)."),
  showClose: z.boolean().optional().describe("Show the close (X) entry; default true."),
  destroyOnClose: z.boolean().optional().describe("Destroy the dialog content on close (resets inner state each open)."),
  modal: z.boolean().optional().describe("Render the mask/overlay; default true."),
  closeOnClickModal: z.boolean().optional().describe("Close when the mask is clicked; default true."),
  closeOnPressEscape: z.boolean().optional().describe("Close when Escape is pressed; default true."),
  hiddenFullBtn: z.boolean().optional().describe("Hide the built-in fullscreen toggle."),
  appendTo: z
    .string()
    .optional()
    .describe(
      "CSS selector of the mount node (e.g. 'body'); only the selector form — a DOM element cannot travel in JSON. " +
        "Honoured in both modes on vue3 (el-dialog appendTo) and antdv (a-modal getContainer); on vue2 Element UI's el-dialog only has a boolean append-to-body, " +
        "so a non-'body' selector degrades to body there and the generated product warns explicitly (use mode='composable' for an exact container)."
    ),
  cacheKey: z
    .string()
    .optional()
    .describe("Instance cache key — state survives close/reopen (recycled 10 min after close). Composable mode only: the declarative mode='component' SFC has no such channel and warns+ignores it."),
});

