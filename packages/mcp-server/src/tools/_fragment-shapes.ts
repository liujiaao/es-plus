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
