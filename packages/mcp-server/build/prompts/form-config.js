import { z } from "zod";
const PKG = {
    vue3: "@es-plus/vue3",
    vue2: "@es-plus/vue2",
    antdv: "@es-plus/adapter-antdv",
};
const UI_LIB = {
    vue3: "Element Plus",
    vue2: "Element UI",
    antdv: "Ant Design Vue",
};
function buildSystemPrompt(target) {
    const pkg = PKG[target];
    const uiLib = UI_LIB[target];
    return `You are an expert at generating ${pkg} form configurations. Generate only the form configuration JSON (the \`formItemList\` array), not the full Vue component.

The FormItemOption schema is framework-invariant — the SAME JSON works for vue3 / vue2 / antdv. Only \`attrs\` (pass-through props) target the underlying UI library, which for this target is ${uiLib}.

FormItemOption interface:
- prop: string (field key)
- label: string (display label)
- formtype: 'Input' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
- span: number (grid width, 1-24)
- attrs: object (pass-through props to the ${uiLib} component — e.g. type, placeholder, valueFormat)
- dataOptions: Array<{ label: string, value: any }> (for Select/Radio/Checkbox)
- rules: array (${uiLib} validation rules)
- isHidden: function (dynamic visibility)

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
export function registerFormConfigPrompt(server) {
    server.prompt("form-config", "Generate es-plus form configuration JSON (vue3 / vue2 / antdv) from a description", {
        description: z
            .string()
            .describe("Description of the form fields needed"),
        target: z
            .enum(["vue3", "vue2", "antdv"])
            .default("vue3")
            .describe("Renderer target. The formItemList JSON is framework-invariant; only attrs target the UI library (vue3 = Element Plus, vue2 = Element UI, antdv = Ant Design Vue)."),
    }, async ({ description, target }) => {
        const t = (target ?? "vue3");
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
    });
}
//# sourceMappingURL=form-config.js.map