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
const DataOptionSchema = z.lazy(() => z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    disabled: z.boolean().optional(),
    children: z.array(DataOptionSchema).optional(),
}));
const FieldConfigSchema = z.object({
    prop: z.string().min(1),
    label: z.string().min(1),
    formtype: z.enum(VALID_FORM_TYPES),
    inQuery: z.boolean().default(true),
    inTable: z.boolean().default(true),
    inForm: z.boolean().default(true),
    querySpan: z.number().int().min(1).max(24).optional(),
    formSpan: z.number().int().min(1).max(24).optional(),
    required: z.boolean().optional(),
    rules: z.array(FieldRuleSchema).optional(),
    attrs: z.record(z.unknown()).optional(),
    dataOptions: z.array(DataOptionSchema).optional(),
    apiParams: z
        .object({
        url: z.string(),
        method: z.enum(["GET", "POST"]).optional(),
        labelField: z.string().optional(),
        valueField: z.string().optional(),
    })
        .optional(),
    width: z.union([z.number(), z.string()]).optional(),
    minWidth: z.union([z.number(), z.string()]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    fixed: z
        .union([z.boolean(), z.literal("left"), z.literal("right")])
        .optional(),
    ellipsis: z.boolean().optional(),
    formatter: z.string().optional(),
    render: z.string().optional(),
    permissionValue: z.string().optional(),
});
export function registerGenerateFromConfig(server) {
    server.tool("generate_crud_from_config", "Generate a production-ready CRUD page from a structured JSON config. Unlike generate_crud_page (which uses regex-based NL parsing), this tool accepts precise field definitions, real API URLs, data options, and validation rules — producing zero-TODO code ready for production. Supports `target: 'vue3' | 'vue2'` field in config (default 'vue3'); when target='vue2', emits Vue 2 + Element UI + @es-plus/vue2 compatible code (defineComponent + setup(), :sync). The AI client should read esplus://conventions and esplus://types resources first, then construct the config JSON from the user's requirements.", {
        config: z
            .string()
            .describe("JSON string of StructuredCrudConfig. Must include: name (PascalCase), apiUrl (real endpoint), fields (array with prop/label/formtype), actions (array of CRUD operations). See esplus://conventions resource for the full schema and examples."),
    }, async ({ config: configStr }) => {
        try {
            const parsed = JSON.parse(configStr);
            const configSchema = z.object({
                name: z.string().min(1),
                apiUrl: z.string().min(1),
                fields: z.array(FieldConfigSchema).min(1),
                actions: z
                    .array(z.enum(VALID_CRUD_ACTIONS))
                    .min(1),
                tableOptions: z
                    .object({
                    border: z.boolean().default(true),
                    stripe: z.boolean().default(true),
                    rowkey: z.string().default("id"),
                    heightType: z
                        .enum(["height", "auto", "maxHeight"])
                        .optional(),
                    tabHeight: z.union([z.number(), z.string()]).optional(),
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
                mode: z.enum(["schema", "sfc"]).default("schema"),
                target: z.enum(["vue3", "vue2"]).default("vue3"),
                typescript: z.boolean().default(true),
                permissions: z.record(z.string()).optional(),
                i18n: z.boolean().default(false),
                formLayout: z.object({
                    span: z.number().optional(),
                    labelWidth: z.union([z.string(), z.number()]).optional(),
                    minFoldRows: z.number().int().optional(),
                }).optional(),
                toolbarBtns: z.array(z.object({
                    name: z.string().min(1),
                    key: z.string().optional(),
                    type: z.string().optional(),
                    icon: z.string().optional(),
                    dialogKey: z.string().optional(),
                    actionType: z.string().optional(),
                    confirm: z.union([z.string(), z.boolean()]).optional(),
                    permissionValue: z.string().optional(),
                })).optional(),
                tableBtns: z.array(z.object({
                    name: z.string().min(1),
                    key: z.string().optional(),
                    type: z.string().optional(),
                    icon: z.string().optional(),
                    code: z.union([z.literal(1), z.literal(2)]).default(1),
                    dialogKey: z.string().optional(),
                    actionType: z.string().optional(),
                    confirm: z.union([z.string(), z.boolean()]).optional(),
                    permissionValue: z.string().optional(),
                })).optional(),
                operationColumn: z.union([
                    z.literal(false),
                    z.object({
                        label: z.string().optional(),
                        width: z.union([z.number(), z.string()]).optional(),
                        fixed: z.union([z.boolean(), z.literal("left"), z.literal("right")]).optional(),
                        btns: z.array(z.object({
                            name: z.string().min(1),
                            key: z.string().optional(),
                            type: z.string().optional(),
                            icon: z.string().optional(),
                            dialogKey: z.string().optional(),
                            confirm: z.union([z.string(), z.boolean()]).optional(),
                            permissionValue: z.string().optional(),
                        })).min(1),
                    })
                ]).optional(),
                dialogs: z.record(z.string(), z.object({
                    title: z.string().optional(),
                    width: z.union([z.string(), z.number()]).optional(),
                    formItems: z.array(FieldConfigSchema).optional(),
                    formLayout: z.object({
                        span: z.number().optional(),
                        labelWidth: z.union([z.string(), z.number()]).optional(),
                        minFoldRows: z.number().int().optional(),
                    }).optional(),
                    hasCustomRender: z.boolean().optional(),
                    isDraggable: z.boolean().optional(),
                    maxHeight: z.union([z.string(), z.number()]).optional(),
                    fullscreen: z.boolean().optional(),
                    isHiddenFooter: z.boolean().optional(),
                })).optional(),
            });
            const validationResult = configSchema.safeParse(parsed);
            if (!validationResult.success) {
                const errors = validationResult.error.errors
                    .map((e) => `  ${e.path.join(".")}: ${e.message}`)
                    .join("\n");
                return {
                    content: [
                        {
                            type: "text",
                            text: `Config validation failed:\n${errors}\n\nPlease fix the config and retry. Read esplus://conventions for the expected schema.`,
                        },
                    ],
                    isError: true,
                };
            }
            const result = generateFromConfig(validationResult.data);
            const output = [result.summary];
            if (result.warnings.length > 0) {
                output.push("");
                output.push("⚠️ Warnings:");
                for (const w of result.warnings) {
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
            }
            else {
                output.push("## Generated SFC");
                output.push("");
                output.push("```vue");
                output.push(result.code);
                output.push("```");
            }
            return {
                content: [{ type: "text", text: output.join("\n") }],
            };
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Invalid JSON: ${error.message}\n\nThe config parameter must be a valid JSON string.`,
                        },
                    ],
                    isError: true,
                };
            }
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
    });
}
//# sourceMappingURL=generate-from-config.js.map