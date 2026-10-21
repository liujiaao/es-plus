import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { doctorPage, formatDoctor, type PreflightInput } from "@es-plus/shared";

/**
 * AN-15③：检查宿主**已有**的入口装配。
 *
 * 与 `scaffold_page` 的关系：scaffold 给的是「该长什么样」的样板，doctor 回答「你现在这份
 * 缺了什么」。两者共用 `buildPreflight` 的 required 判定 —— doctor 只负责在文本里找证据。
 *
 * 静态扫描的边界写在 `packages/shared/src/doctor.ts` 头注里：只认字面量对象、先剥注释。
 * 结果三态（ok / missing / unverified），`unverified` 不是通过 —— 报告会明确说出来。
 */
export function registerDoctorPage(server: McpServer) {
  server.tool(
    "doctor_page",
    "Static-check a host app entry against the es-plus preflight checklist (UI library, ESPlus plugin registration, httpRequest, permission, t, JSX transform). Pass the entry source and optionally the config the page was generated from (so only the capabilities that page actually needs are required) plus vite.config source (for UI auto-import / JSX plugin). Literal scan only: results are ok / missing / unverified — unverified means the item may be satisfied elsewhere and must be checked by hand.",
    {
      entry: z
        .string()
        .min(1)
        .describe("Source of the app entry, e.g. src/main.ts (or src/main.js for vue2)."),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe("Target framework the entry is for."),
      config: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          "Optional: the StructuredCrudConfig the page was generated from. When given, permission / t / httpRequest / JSX are required only if that config actually uses them."
        ),
      viteConfig: z
        .string()
        .optional()
        .describe(
          "Optional: vite.config.* source. Needed to verify UI-library auto-import and the JSX plugin."
        ),
    },
    async ({ entry, target, config, viteConfig }) => {
      try {
        const report = doctorPage({
          entry,
          target: (target || "vue3") as "vue3" | "vue2" | "antdv",
          config: config as PreflightInput | undefined,
          viteConfig,
        });
        return { content: [{ type: "text", text: formatDoctor(report) }] };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error running doctor: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
