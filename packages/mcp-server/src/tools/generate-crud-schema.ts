import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateCrudSchema } from "@es-plus/shared";

export function registerGenerateCrudSchema(server: McpServer) {
  server.tool(
    "generate_crud_schema",
    "LEGACY FALLBACK (deprecated): generate CrudPageSchema JSON + minimal wrapper SFC from a natural language description using a REGEX/keyword parser. For natural-language requests use generate_crud (the front-door tool); for a config you already hold use generate_crud_from_config (ADVANCED) — both compile through the same deterministic generator. Keep this only for a quick prototype or a no-LLM host. Produces <es-crud-page> schema output. Supports vue3 (default) / vue2 / antdv targets.",
    {
      description: z
        .string()
        .describe(
          "Natural language description of the CRUD page. Example: '用户管理，查询姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态，支持新增编辑删除'"
        ),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe(
          "Target framework: 'vue3' (default, @es-plus/vue3 + Element Plus), 'vue2' (@es-plus/vue2 + Element UI), or 'antdv' (@es-plus/adapter-antdv + Ant Design Vue). Schema JSON is target-agnostic; only wrapper SFC differs."
        ),
    },
    async ({ description, target }) => {
      try {
        const tgt = (target || "vue3") as "vue3" | "vue2" | "antdv";
        const esPlusPkg = tgt === "vue2" ? "@es-plus/vue2" : tgt === "antdv" ? "@es-plus/adapter-antdv" : "@es-plus/vue3";

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
      } catch (error: any) {
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
    }
  );
}
