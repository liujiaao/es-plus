import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildScaffoldPreflight, formatPreflight, generateScaffold } from "@es-plus/shared";

/**
 * AN-15②：脚手架与生成物**共用** `buildPreflight`（经 `buildScaffoldPreflight`）。
 *
 * 此前这里是手写的一段入口样板 + 一句「缺一则对应能力失效」的散文。散文没法被断言，
 * 而清单可以：同一个 builder 同时喂给 `generate_crud` / `generate_crud_from_config`，
 * 两处一旦分叉，其中一处就开始说谎。若要检查宿主**已有**入口，用 `doctor_page`。
 */
export function registerScaffoldPage(server: McpServer) {
  server.tool(
    "scaffold_page",
    "Generate a minimal es-plus page scaffold (.vue SFC) — plus the SAME `preflight` checklist that generated CRUD pages emit (httpRequest / permission / t / JSX plugin / UI library), with a copy-once app-entry boilerplate (vue3: `app.use(ESPlus, { permission, t, httpRequest })`, vue2: `Vue.use`). Supports vue3 (default) / vue2 / antdv targets. Use this when you need a blank starting template; use `doctor_page` to check an entry the host already has.",
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
        const featureList = features || ["query", "table"];
        const code = generateScaffold(name, featureList, tgt);
        const preflight = buildScaffoldPreflight({ target: tgt, features: featureList });
        return {
          content: [
            {
              type: "text",
              text:
                `Generated scaffold for "${name}" (target=${tgt}) with features: ${featureList.join(", ")}\n\n` +
                `${code}\n\n` +
                formatPreflight(preflight),
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
