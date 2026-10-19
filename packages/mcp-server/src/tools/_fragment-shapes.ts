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
  querySpan: z.number().int().min(1).max(24).optional(),
  formSpan: z.number().int().min(1).max(24).optional(),
  required: z.boolean().optional(),
  rules: z.array(FieldRuleSchema).optional(),
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
  // 形状刻意用 passthrough：真正的递归 DSL 校验由权威 shared Zod 在受校验路径上完成；
  // 在此逐字镜像那套递归/refine 会造出第三份**无守卫**副本（check-fragment-contract 只比顶层键集）。
  isHidden: z
    .any()
    .optional()
    .describe(
      "Conditional visibility (AI-06): PLAIN JSON data, never a JS function string. A single condition {field, op?, value?} (semantics: the field is HIDDEN WHILE the condition HOLDS), an ARRAY of conditions (AND — hidden only when all hold), or a JSONLogic-shaped expression node for OR/ordering/nesting. Applies to the query and add/edit forms, NOT the table column.",
    ),
  reactions: z
    .array(z.any())
    .optional()
    .describe(
      "Field linkage (AI-07): an array of {dependencies?, when?, fulfill} rules — PLAIN JSON, never JS callbacks. Use when THIS field's options/required/disabled/value depend on another field (fulfill: {dataOptions?, required?, disabled?, value?}). Applies to the query and add/edit forms, NOT the table column.",
    ),
  permissionValue: z.string().optional(),
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
export const tableBlockOptionsSchema = z.object({
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
  engine: z.enum(["default", "virtual", "vxe"]).optional(),
  rowHeight: z.number().optional(),
  estimatedRowHeight: z.number().optional(),
  overscanCount: z.number().int().optional(),
  rowClassName: z.string().optional(),
  size: z.enum(["large", "default", "small"]).optional(),
  showHeader: z.boolean().optional(),
  emptyText: z.string().optional(),
  snIndex: z.boolean().optional(),
  leftText: z.string().optional(),
  cachePageSelection: z.boolean().optional(),
  refetchKeepPage: z.boolean().optional(),
  localPagination: z.boolean().optional(),
  defaultSort: z.object({ prop: z.string(), order: z.enum(["ascending", "descending"]) }).optional(),
  editConfig: z
    .object({
      trigger: z.enum(["click", "dblclick", "manual"]).optional(),
      mode: z.enum(["cell", "row"]).optional(),
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
    .optional(),
});

/** `generate_table` 的分页播种（权威 schema 顶层 `pagination` 的数据子集）。 */
export const tablePaginationSchema = z.object({
  pageSize: z.number().int().optional(),
  pageSizes: z.array(z.number().int()).optional(),
});

/** `generate_form` 的表单布局（权威 schema 顶层 `formLayout` 的数据子集）。 */
export const formLayoutSchema = z.object({
  labelWidth: z.union([z.string(), z.number()]).optional(),
  minFoldRows: z.number().int().optional(),
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
  appendTo: z.string().optional().describe("CSS selector of the mount node (e.g. 'body'); only the selector form — a DOM element cannot travel in JSON."),
  cacheKey: z
    .string()
    .optional()
    .describe("Instance cache key — state survives close/reopen (recycled 10 min after close). Composable mode only: the declarative mode='component' SFC has no such channel and warns+ignores it."),
});

