import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VALID_FORM_TYPES } from "@es-plus/shared";

type Target = "vue3" | "vue2" | "antdv";

const PKG: Record<Target, string> = {
  vue3: "@es-plus/vue3",
  vue2: "@es-plus/vue2",
  antdv: "@es-plus/adapter-antdv",
};

const UI_LIB: Record<Target, string> = {
  vue3: "Element Plus",
  vue2: "Element UI",
  antdv: "Ant Design Vue",
};

function buildSystemPrompt(target: Target): string {
  const pkg = PKG[target];
  const uiLib = UI_LIB[target];
  return `You are an expert at generating ${pkg} form configurations. Generate only the form configuration JSON (the \`formItemList\` array), not the full Vue component.

The FormItemOption schema is framework-invariant — the SAME JSON works for vue3 / vue2 / antdv. Only \`attrs\` (pass-through props) target the underlying UI library, which for this target is ${uiLib}.

FormItemOption interface:
- prop: string (field key)
- label: string (display label)
- formtype: ${VALID_FORM_TYPES.map((t) => `'${t}'`).join(" | ")} — infer it from the field's MEANING, not its name: status/enum → Select, date/time → DatePicker/TimePicker, image/file → Upload, on/off → Switch, and any numeric value (amount / price / quantity / stock / count / money / integer) → InputNumber
- span: number (grid width, 1-24)
- attrs: object (pass-through props to the ${uiLib} component — e.g. type, placeholder, valueFormat)
- dataOptions: Array<{ label: string, value: any }> (for Select/Radio/Checkbox)
- rules: array (${uiLib} validation rules)
- isHidden: dynamic visibility. Either a predicate function (model, item, formProps) => boolean, OR a declarative PLAIN JSON condition { field, op?, value? } / an array (AND) — HIDDEN while the condition holds. \`field\` is another field path; op = eq (default) | ne | in | nIn | empty | notEmpty | truthy | falsy. Only for predicates the plain form cannot express (OR, ordering > / <=, nested NOT) use the JSON-expression form instead — same \`isHidden\` key, JSONLogic-shaped, e.g. { or: [ { '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] } ] }; expression ops = var == != > >= < <= in nin empty notEmpty truthy falsy and or not if. Form-scope (query + add/edit), not the table column.

Common patterns:
- Text input: { prop: 'name', label: '姓名', formtype: 'Input', span: 12 }
- Select with options: { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [...], span: 12 }
- Date range: { prop: 'dateRange', label: '日期', formtype: 'DatePicker', attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' }, span: 12 }
- Textarea: { prop: 'remark', label: '备注', formtype: 'Input', attrs: { type: 'textarea', rows: 3 }, span: 24 }
- Switch: { prop: 'enabled', label: '启用', formtype: 'Switch', span: 12 }
${target === "antdv"
      ? `\nantdv note: attrs map to Ant Design Vue props (e.g. Select uses \`options\`/\`mode\`, DatePicker uses \`picker\`/\`valueFormat\`). es-plus normalizes common props, but library-specific attrs should follow Ant Design Vue's API.`
      : target === "vue2"
      ? `\nvue2 note: attrs map to Element UI props; date formatting uses \`value-format\` (kebab in template, valueFormat in config).`
      : ``}

Output format: JSON array of FormItemOption objects.
`;
}

export function registerFormConfigPrompt(server: McpServer) {
  server.prompt(
    "form-config",
    "Generate es-plus form configuration JSON (vue3 / vue2 / antdv) from a description",
    {
      description: z
        .string()
        .describe("Description of the form fields needed"),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe("Renderer target. The formItemList JSON is framework-invariant; only attrs target the UI library (vue3 = Element Plus, vue2 = Element UI, antdv = Ant Design Vue)."),
    },
    async ({ description, target }) => {
      const t = (target ?? "vue3") as Target;
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${buildSystemPrompt(t)}\n\nGenerate the formItemList JSON configuration for this form:\n\n${description}\n\nReturn only the JSON array, properly formatted.`,
            },
          },
        ],
      };
    }
  );
}
