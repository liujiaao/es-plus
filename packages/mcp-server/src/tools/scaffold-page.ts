import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateScaffold, generateAppEntry } from "@es-plus/shared";

export function registerScaffoldPage(server: McpServer) {
  server.tool(
    "scaffold_page",
    "Generate a minimal es-plus page scaffold (.vue SFC) — plus the app-entry assembly boilerplate (`app.use(ESPlus, { permission, t, httpRequest })`, vue2: `Vue.use`) that makes permissionValue / i18n labelKey / remote apiParams actually work. Supports vue3 (default) / vue2 / antdv targets. Use this when you need a blank starting template.",
    {
      name: z
        .string()
        .describe("Page name in kebab-case, e.g. 'user-management'"),
      features: z
        .array(z.enum(["query", "table", "dialog"]))
        .optional()
        .describe(
          "Features to include. Defaults to ['query', 'table']. Options: query, table, dialog"
        ),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe(
          "Target framework: 'vue3' (default, <script setup> + @es-plus/vue3), 'vue2' (defineComponent + setup() + @es-plus/vue2), or 'antdv' (<script setup> + @es-plus/adapter-antdv + Ant Design Vue)"
        ),
    },
    async ({ name, features, target }) => {
      try {
        const tgt = (target || "vue3") as "vue3" | "vue2" | "antdv";
        const code = generateScaffold(name, features, tgt);
        const entry = generateAppEntry(tgt);
        const entryFile = tgt === "vue2" ? "src/main.js" : "src/main.ts";
        const featureList = features || ["query", "table"];
        return {
          content: [
            {
              type: "text",
              text:
                `Generated scaffold for "${name}" (target=${tgt}) with features: ${featureList.join(", ")}\n\n` +
                `${code}\n\n` +
                `// ───── ${entryFile}（应用入口装配样板，复制一次；permission / t / httpRequest 缺一则对应能力失效）─────\n` +
                `${entry}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating scaffold: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
