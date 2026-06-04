import { z } from "zod";
const SYSTEM_PROMPT = `You are an expert at generating @es-plus/vue3 form configurations. Generate only the form configuration JSON, not the full Vue component.

FormItemOption interface:
- prop: string (field key)
- label: string (display label)
- formtype: 'Input' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
- span: number (grid width, 1-24)
- attrs: object (pass-through props to Element Plus component)
- dataOptions: Array<{ label: string, value: any }> (for Select/Radio/Checkbox)
- rules: array (Element Plus validation rules)
- isHidden: function (dynamic visibility)

Common patterns:
- Text input: { prop: 'name', label: '姓名', formtype: 'Input', span: 12 }
- Select with options: { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [...], span: 12 }
- Date range: { prop: 'dateRange', label: '日期', formtype: 'DatePicker', attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' }, span: 12 }
- Textarea: { prop: 'remark', label: '备注', formtype: 'Input', attrs: { type: 'textarea', rows: 3 }, span: 24 }
- Switch: { prop: 'enabled', label: '启用', formtype: 'Switch', span: 12 }

Output format: JSON array of FormItemOption objects.
`;
export function registerFormConfigPrompt(server) {
    server.prompt("form-config", "Generate @es-plus/vue3 form configuration JSON from a description", {
        description: z
            .string()
            .describe("Description of the form fields needed"),
    }, async ({ description }) => {
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `${SYSTEM_PROMPT}\n\nGenerate the formItemList JSON configuration for this form:\n\n${description}\n\nReturn only the JSON array, properly formatted.`,
                    },
                },
            ],
        };
    });
}
//# sourceMappingURL=form-config.js.map