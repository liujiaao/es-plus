import { z } from "zod";
import { generateCrudPage } from "../core/code-generator.js";
export function registerGenerateCrudPage(server) {
    server.tool("generate_crud_page", "Generate a complete Vue 3 CRUD page (.vue SFC) from a natural language description. Supports Chinese and English input. Produces query form, table columns, action buttons, and dialog forms.", {
        description: z
            .string()
            .describe("Natural language description of the CRUD page to generate. Example: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'"),
    }, async ({ description }) => {
        try {
            const result = generateCrudPage(description);
            return {
                content: [
                    {
                        type: "text",
                        text: `${result.summary}\n\n---\n\n${result.code}`,
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