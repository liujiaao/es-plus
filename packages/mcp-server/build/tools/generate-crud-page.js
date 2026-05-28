import { z } from "zod";
import { generateCrudPage, generateCrudSchema } from "@es-plus/shared";
export function registerGenerateCrudPage(server) {
    server.tool("generate_crud_page", "Generate a CRUD page from a natural language description. Supports two modes (schema/sfc) and two targets (vue3/vue2). schema mode outputs CrudPageSchema JSON + wrapper SFC; sfc mode outputs a full SFC.", {
        description: z
            .string()
            .describe("Natural language description of the CRUD page to generate. Example: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'"),
        mode: z
            .enum(["schema", "sfc"])
            .default("schema")
            .describe("Output mode: 'schema' (default) for CrudPageSchema JSON + minimal wrapper using <es-crud-page>; 'sfc' for complete SFC with EsTable + EsForm"),
        target: z
            .enum(["vue3", "vue2"])
            .default("vue3")
            .describe("Target framework: 'vue3' (default) outputs Vue 3 + Element Plus + es-plus-ui; 'vue2' outputs Vue 2 + Element UI + @es-plus/vue2 (defineComponent + setup() + :sync)"),
    }, async ({ description, mode, target }) => {
        try {
            const tgt = (target || "vue3");
            const esPlusPkg = tgt === "vue2" ? "@es-plus/vue2" : "es-plus-ui";
            if (mode === "sfc") {
                const result = generateCrudPage(description, tgt);
                return {
                    content: [
                        {
                            type: "text",
                            text: `${result.summary}\n\n---\n\n${result.code}`,
                        },
                    ],
                };
            }
            const result = generateCrudSchema(description, tgt);
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
                            `import type { CrudPageSchema } from '${esPlusPkg}'`,
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
                        text: `Error generating CRUD page: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=generate-crud-page.js.map