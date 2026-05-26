import { z } from "zod";
import { generateCrudSchema } from "@es-plus/shared";
export function registerGenerateCrudSchema(server) {
    server.tool("generate_crud_schema", "Generate CrudPageSchema JSON + minimal wrapper SFC from a natural language description. Recommended over full SFC mode — produces simpler, more maintainable output using <es-crud-page> component.", {
        description: z
            .string()
            .describe("Natural language description of the CRUD page. Example: '用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态，支持新增编辑删除'"),
    }, async ({ description }) => {
        try {
            const result = generateCrudSchema(description);
            const schemaJson = JSON.stringify(result.schema, null, 2);
            return {
                content: [
                    {
                        type: "text",
                        text: [
                            result.summary,
                            "",
                            "---",
                            "",
                            "## CrudPageSchema (schema.ts)",
                            "",
                            "```typescript",
                            `import type { CrudPageSchema } from 'es-plus-ui'`,
                            "",
                            `export const pageSchema: CrudPageSchema = ${schemaJson}`,
                            "```",
                            "",
                            "---",
                            "",
                            "## Wrapper SFC (Page.vue)",
                            "",
                            "```vue",
                            result.wrapperCode,
                            "```",
                        ].join("\n"),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error generating CrudPageSchema: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=generate-crud-schema.js.map