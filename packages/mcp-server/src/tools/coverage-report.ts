import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  COVERAGE_LEVEL_MEANING,
  SCENE_IDS,
  classifyCoverage,
  type CoverageReport,
  type SceneId,
} from "@es-plus/shared";

/**
 * `coverage_report` —— 一份规格清单的**逐页覆盖分级**（P13）。
 *
 * 回答的是「这套中后台能不能用 es-plus 声明式覆盖」：每页给出 L1 / L2 / L3，
 * 判据只来自 P9 能力台账（`assessIntent`）与宿主自己的声明，不靠人写 prose。
 *
 * 输入必须是**结构化清单**（不是自然语言）：宿主先把每页打算交给生成器的
 * `scene` + `intent` 整理出来（通常就是 `spec-to-surfaces` / `validate_intent` 的产物），
 * 再一起提交。同一份清单重跑必得同一结果 —— 这是「人工抽检一致」验收的前提。
 *
 * 分工：本工具**不校验结构**（缺 formtype、类型不符由 `validate_intent` 判），
 * 只按「已声明的意图能被发射到什么程度」分级。L3 不是工具失败：它是「这一页需要宿主
 * 自己写代码」的合法结论，因此不设 `isError`；只有清单本身畸形才返回错误。
 */

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

const partShape = z.object({
  scene: z.enum([...SCENE_IDS] as [SceneId, ...SceneId[]]).describe("crud / table / form / dialog"),
  intent: z.record(z.string(), z.any()).describe("That scene's intent table (same shape validate_intent checks)."),
});

const pageShape = z
  .object({
    name: z.string().optional().describe("Page name for the report (defaults to page-<n>)."),
    scene: z
      .enum([...SCENE_IDS] as [SceneId, ...SceneId[]])
      .optional()
      .describe("Single-part shorthand: use scene + intent instead of parts[]."),
    intent: z.record(z.string(), z.any()).optional().describe("Single-part shorthand's intent table."),
    parts: z
      .array(partShape)
      .optional()
      .describe(
        "When the page is assembled from several generated pieces (multi-table master-detail, form + dialog, …), list them here — they will be composed with generate_composition.",
      ),
    extensionPoints: z
      .array(z.record(z.string(), z.any()))
      .optional()
      .describe(
        "Host-declared extension points on an otherwise generated page (e.g. a toolbar slot or a custom cell). Any entry makes the page L2.",
      ),
    hostCode: z
      .array(z.record(z.string(), z.any()))
      .optional()
      .describe(
        "Host-code items the declarative path cannot emit (charts, bespoke business widgets, custom routing…). Any entry makes the page L3.",
      ),
  })
  .describe("One page of the structured inventory.");

function renderCoverage(report: CoverageReport): string {
  const { pages, summary, inventoryErrors } = report;
  const lines: string[] = [
    `Coverage report (${report.contract}) — ${pages.length} page(s): ` +
      `L1 ${summary.L1} / L2 ${summary.L2} / L3 ${summary.L3}`,
  ];

  if (inventoryErrors.length) {
    lines.push("", "Inventory errors:", ...inventoryErrors.map((e) => `  - ${e}`));
  }

  for (const page of pages) {
    lines.push("", `[${page.level}] ${page.name} — ${COVERAGE_LEVEL_MEANING[page.level]}`);
    for (const reason of page.reasons) lines.push(`  · ${reason}`);
    const partSummary = page.parts
      .map((part, index) => `${index}:${part.scene ?? "(invalid)"}${part.ok ? "" : "!"}`)
      .join(", ");
    if (partSummary) lines.push(`  parts: ${partSummary} (! = not directly emittable)`);
  }

  return lines.join("\n");
}

export function registerCoverageReport(server: McpServer) {
  server.tool(
    "coverage_report",
    "READ-ONLY per-page coverage classification for a structured spec inventory: L1 = generate_scene emits the page faithfully with no post-edit; L2 = it emits, but a key is degraded, the page composes several fragments, or the host declares extension points; L3 = an intent key is unsupported / required keys are missing / the host declares code of its own. The verdict comes from the es-plus.capabilities@1 ledger (assessIntent), not from prose, so the same inventory always yields the same levels. Run validate_intent first to rule out structural mistakes.",
    {
      pages: z.array(pageShape).describe("The structured page inventory (one entry per page of the spec)."),
    },
    async ({ pages }) => {
      const report = classifyCoverage({ pages });
      const result: ToolResult = {
        content: [{ type: "text", text: renderCoverage(report) }],
        structuredContent: report as unknown as Record<string, unknown>,
      };
      if (report.inventoryErrors.length) result.isError = true;
      return result;
    },
  );
}
