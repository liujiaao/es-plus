import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateCrudPage, generateCrudSchema } from "@es-plus/shared";

export function registerGenerateCrudPage(server: McpServer) {
  server.tool(
    "generate_crud_page",
    "Generate a CRUD page from a natural language description. Supports two modes: 'schema' (default, recommended) outputs CrudPageSchema JSON + wrapper SFC; 'sfc' outputs a full Vue 3 SFC.",
    {
      description: z
        .string()
        .describe(
          "Natural language description of the CRUD page to generate. Example: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'"
        ),
      mode: z
        .enum(["schema", "sfc"])
        .default("schema")
        .describe(
          "Output mode: 'schema' (default) for CrudPageSchema JSON + minimal wrapper using <es-crud-page>; 'sfc' for complete Vue 3 SFC with EsTable + EsForm"
        ),
    },
    async ({ description, mode }) => {
      try {
        if (mode === "sfc") {
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
      } catch (error: any) {
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
    }
  );
}
