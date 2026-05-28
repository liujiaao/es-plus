import { z } from "zod";
import { generateScaffold } from "@es-plus/shared";
export function registerScaffoldPage(server) {
    server.tool("scaffold_page", "Generate a minimal es-plus page scaffold (.vue SFC) with the basic structure for query form, table, and optional dialog. Supports vue3 (default) / vue2 targets. Use this when you need a blank starting template.", {
        name: z
            .string()
            .describe("Page name in kebab-case, e.g. 'user-management'"),
        features: z
            .array(z.enum(["query", "table", "dialog"]))
            .optional()
            .describe("Features to include. Defaults to ['query', 'table']. Options: query, table, dialog"),
        target: z
            .enum(["vue3", "vue2"])
            .default("vue3")
            .describe("Target framework: 'vue3' (default, <script setup> + es-plus-ui) or 'vue2' (defineComponent + setup() + @es-plus/vue2)"),
    }, async ({ name, features, target }) => {
        try {
            const tgt = (target || "vue3");
            const code = generateScaffold(name, features, tgt);
            const featureList = features || ["query", "table"];
            return {
                content: [
                    {
                        type: "text",
                        text: `Generated scaffold for "${name}" (target=${tgt}) with features: ${featureList.join(", ")}\n\n${code}`,
                    },
                ],
            };
        }
        catch (error) {
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
    });
}
//# sourceMappingURL=scaffold-page.js.map