import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  DEFAULT_SCENE,
  INTENT_VALIDATION_CONTRACT_VERSION,
  SCENE_IDS,
  collectUnknownKeys,
  validateIntentPlan,
  type IntentIssue,
  type SceneId,
} from "@es-plus/shared";
import { SCENE_INTENT_SCHEMAS } from "./generate-scene.js";

/**
 * `validate_intent` —— 宿主抽取的**生成前校验**（P13）。
 *
 * 分工与 `validate_config` 一致：只判、不改、不生成。差别在于判据的层次：
 *   - `validate_config` 判一份已经组装好的配置（Zod / Ajv）；
 *   - 本工具判**意图表**，也就是宿主从 PRD / 原型里抽出来的那一层。结构级问题复用
 *     `generate_scene` 的**同一份** Zod 形状（未知键 + safeParse），语义级问题由 shared
 *     的 `validateIntentPlan` 补判（重复 prop、面归属、成员键残留、label 不在规格里、
 *     系统字段进表单、能力降级）。两侧合起来 = 「这份意图生成出来会是什么样」。
 *
 * 为什么值得一个独立工具：意图是整条链路里**唯一由模型推理产出**的环节。生成是确定性
 * 的，所以错误几乎都发生在这一步；让宿主在调用 `generate_scene` 之前先拿到逐条
 * issue，比「生成一份不报错但不对的页面再人工比对」便宜得多。
 *
 * 不调模型、不写库、不修复：报告返回后由宿主自己改，再重新校验或直接生成。
 */

interface ToolResult {
  // MCP handler 的返回类型带索引签名（与 `_artifact-content.ts` 同因）。
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

const formatIssue = (item: IntentIssue): string => `  - ${item.path || "/"}: ${item.message}`;

function renderReport(
  scene: SceneId,
  target: string,
  mode: string | null,
  report: ReturnType<typeof validateIntentPlan>,
  errors: readonly IntentIssue[],
): string {
  const lines: string[] = [];
  const fields = report.stats.fields;

  if (errors.length === 0) {
    lines.push(
      `✓ intent is valid for scene "${scene}" (target ${target}${mode ? `, mode ${mode}` : ""}): ` +
        `${fields} field entr${fields === 1 ? "y" : "ies"}.`,
    );
  } else {
    lines.push(
      `✗ intent has ${errors.length} error(s) for scene "${scene}" (target ${target}${mode ? `, mode ${mode}` : ""}). ` +
        "Nothing was generated — this tool only judges.",
    );
    lines.push("", "Errors:", ...errors.map(formatIssue));
  }

  if (report.warnings.length) {
    lines.push("", "Warnings (legal but suspicious):", ...report.warnings.map(formatIssue));
  }

  lines.push(
    "",
    `Capability (${report.capability.contract}): ` +
      `accepted ${report.capability.declared.filter((d) => d.verdict === "accepted").length} / ` +
      `degraded ${report.capability.degraded.length} / ` +
      `unsupported ${report.capability.unsupported.length} / ` +
      `missing ${report.capability.missing.length}`,
  );
  if (report.capability.degraded.length) {
    lines.push(
      ...report.capability.declared
        .filter((d) => d.verdict === "degraded")
        .map((d) => `  - degraded: ${d.key} — ${d.reason ?? ""}`),
    );
  }
  if (errors.length) {
    lines.push(
      "",
      "Fix these and call validate_intent again (or generate_scene if the intent is already valid).",
    );
  }

  return lines.join("\n");
}

export function registerValidateIntent(server: McpServer) {
  server.tool(
    "validate_intent",
    "READ-ONLY pre-flight for a generate_scene intent table: returns the scene capability report (es-plus.capabilities@1 — which keys are accepted / degraded / unsupported / missing) plus deterministic per-field issues (unknown surfaces, duplicate props, missing formtype, membership flags such as inQuery, labels absent from the spec, system fields inside an editable form, malformed dialog entries). It judges and never repairs or generates. Call it after extracting surfaces from a PRD / wireframe and before generating; fix the errors and re-run.",
    {
      scene: z
        .enum([...SCENE_IDS] as [SceneId, ...SceneId[]])
        .default(DEFAULT_SCENE)
        .describe("The scene the intent is for — same value you would pass to generate_scene."),
      intent: z
        .record(z.string(), z.any())
        .describe(
          "The scene intent table (scene='crud': name/apiUrl/surfaces…; fragments: fields…). The same object you would pass as generate_scene's `intent`.",
        ),
      spec: z
        .string()
        .optional()
        .describe(
          "Optional spec text (PRD / wireframe transcription). When present, every field label must appear verbatim in it — the check catches labels the host paraphrased instead of copying.",
        ),
    },
    async ({ scene, intent, spec }) => {
      const report = validateIntentPlan({ scene, intent, spec });
      const schema = SCENE_INTENT_SCHEMAS[scene];

      // 结构级判据与生成入口同源：未知键 + 同一份 Zod shape。shared 的语义判据先入；
      // 同 path 的 Zod issue 不再新增一条，但**不能丢信息**：把 schema 的类型细节附到
      // 已有消息上（例如 shared 只说 missing formtype，Zod 能说明收到的是 number）。
      const errors: IntentIssue[] = report.errors.map((e) => ({ ...e }));
      const seen = new Set(errors.map((e) => e.path));
      const byPath = new Map(errors.map((e) => [e.path, e]));

      for (const finding of collectUnknownKeys(schema, intent)) {
        const path = `/${[...finding.path.map(String), finding.key].join("/")}`;
        if (seen.has(path)) continue;
        seen.add(path);
        errors.push({
          path,
          code: "unknown-key",
          message: finding.suggestion
            ? `unknown key "${finding.key}" — did you mean "${finding.suggestion}"?`
            : `unknown key "${finding.key}" — no similar known key; check the spelling or the nesting level.`,
        });
      }

      const parsed = schema.safeParse(intent);
      if (!parsed.success) {
        for (const item of parsed.error.issues) {
          const path = item.path.length ? `/${item.path.map(String).join("/")}` : "/";
          const existing = byPath.get(path);
          if (existing) {
            if (!existing.message.includes(item.message)) {
              existing.message = `${existing.message} (schema: ${item.message})`;
            }
            continue;
          }
          seen.add(path);
          const entry: IntentIssue = { path, code: "schema", message: item.message };
          errors.push(entry);
          byPath.set(path, entry);
        }
      }

      const ok = errors.length === 0;
      const payload = {
        contract: INTENT_VALIDATION_CONTRACT_VERSION,
        scene,
        target: report.capability.target,
        mode: report.capability.mode,
        ok,
        capability: report.capability,
        errors,
        warnings: report.warnings,
        stats: report.stats,
      };

      const result: ToolResult = {
        content: [
          {
            type: "text",
            text: renderReport(scene, report.capability.target, report.capability.mode, report, errors),
          },
        ],
        structuredContent: payload as unknown as Record<string, unknown>,
      };
      if (!ok) result.isError = true;
      return result;
    },
  );
}
