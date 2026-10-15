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

/** Format a FragmentResult (code + summary + warnings) into MCP text output. */
export function renderFragmentOutput(
  result: { code: string; summary: string; warnings: string[] },
  fence: "vue" | "tsx",
): { content: Array<{ type: "text"; text: string }> } {
  const out: string[] = [result.summary];
  if (result.warnings.length > 0) {
    out.push("");
    out.push("⚠️ Warnings (non-blocking — review and re-generate if any indicate a mapping mistake):");
    for (const w of result.warnings) out.push(`  - ${w}`);
  }
  out.push("", "---", "");
  out.push("```" + fence);
  out.push(result.code);
  out.push("```");
  return { content: [{ type: "text", text: out.join("\n") }] };
}
