import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { diffConfig, summarizeDiff, type ConfigDiff, type StructuredCrudConfig } from "@es-plus/shared";
import { validateStructuredConfig } from "./validate-config.js";

// 精修层(B3)对 MCP 的暴露:给定上一轮的 pin(previous)与宿主 LLM 按本轮 NL 纠正**已改写好**的
// revised,确定性地 (1) 用权威 Zod 校验 revised、(2) diff(previous, revised) 回显这一轮改了什么。
//
// 刻意**不**在工具内调模型——与设计 §5-b 字面「喂给模型产出新 config」偏离(已评审拍板):
// es-plus 的 MCP 工具一律确定性,LLM 推理只活在宿主/CLI/eval。本工具与 validate_config 同范式,
// 只是在校验之外多给一份「相对上一版的差异」,让多轮精修里每一轮的改动对调用方可见、可审。

export interface BuildRefineResultInput {
  /** 上一轮的配置(pin;调用方自持的那份 JSON)。可缺省——缺省时 revised 的字段全算新增。 */
  previous?: unknown;
  /** 宿主按本轮纠正改写好的新配置,待校验。 */
  revised: unknown;
}

export interface BuildRefineResultResult {
  /** revised 是否通过权威 StructuredCrudConfig 校验。 */
  valid: boolean;
  /** revised 的 Zod 校验错误(valid=true 时为空)。 */
  errors: string[];
  suggestions: string[];
  /** previous → revised 的结构化差异(仅在 revised 合法时给出)。 */
  diff?: ConfigDiff;
  /** diff 的逐行可读渲染(valid=false 时为空)。 */
  summary: string[];
}

/**
 * 纯函数:校验 revised + 计算 diff。独立导出以便直接单测(与 validate-config 的
 * validateStructuredConfig、ingest-schema 的 buildIngestDraft 同一范式——测逻辑,不起传输层)。
 */
export function buildRefineResult(input: BuildRefineResultInput): BuildRefineResultResult {
  const v = validateStructuredConfig(input.revised);
  if (!v.valid) {
    // revised 不合法 → 不出 diff(拿一份非法配置做差异只会误导),把 Zod 错误原样回给宿主修。
    return { valid: false, errors: v.errors, suggestions: v.suggestions, summary: [] };
  }
  // diffConfig 对松散形态(previous 缺省、成员布尔缺省)都成立,不需要先 parse。
  const diff = diffConfig(
    (input.previous ?? null) as StructuredCrudConfig | null,
    input.revised as StructuredCrudConfig,
  );
  return { valid: true, errors: [], suggestions: [], diff, summary: summarizeDiff(diff) };
}

export function registerRefineConfig(server: McpServer) {
  server.tool(
    "refine_config",
    "Apply ONE round of refinement to a pinned CRUD config. The pin is just the StructuredCrudConfig JSON you (the host) already hold — there is no server-side session. YOU apply the user's natural-language correction to produce the `revised` config, then call this tool with the `previous` (last-pinned) and `revised` JSON. It deterministically (1) validates `revised` against the authoritative schema and (2) returns a structured DIFF of what this round changed (fields added/removed, formtype/membership/layout changes, actions). If `revised` is invalid, you get the schema errors instead of a diff — fix and retry. Pass `revised` to generate_crud_from_config once you're happy. This tool does NOT call a model; the reasoning is yours.",
    {
      previous: z
        .string()
        .optional()
        .describe("JSON string of the previously pinned config (omit for the first round)."),
      revised: z
        .string()
        .describe("JSON string of the config after you applied the user's correction."),
    },
    async ({ previous, revised }) => {
      let revisedParsed: unknown;
      try {
        revisedParsed = JSON.parse(revised);
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Invalid JSON in \`revised\`: ${err.message}` }],
          isError: true,
        };
      }
      let previousParsed: unknown;
      if (previous !== undefined) {
        try {
          previousParsed = JSON.parse(previous);
        } catch (err: any) {
          return {
            content: [{ type: "text", text: `Invalid JSON in \`previous\`: ${err.message}` }],
            isError: true,
          };
        }
      }

      const { valid, errors, suggestions, summary } = buildRefineResult({
        previous: previousParsed,
        revised: revisedParsed,
      });

      if (!valid) {
        const out = [
          "✗ 修订后的配置未通过校验(未产出 diff):",
          ...errors.map((e) => `  - ${e}`),
          suggestions.length ? "\nSuggestions:" : "",
          ...suggestions.map((s) => `  → ${s}`),
        ].filter(Boolean);
        return { content: [{ type: "text", text: out.join("\n") }], isError: true };
      }

      const out = ["✓ 修订后的配置合法。本轮改动:", ...summary.map((l) => `  ${l}`)];
      return { content: [{ type: "text", text: out.join("\n") }] };
    }
  );
}
