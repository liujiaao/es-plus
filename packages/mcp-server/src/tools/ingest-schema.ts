import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { INGEST_KINDS, buildIngestDraft } from "@es-plus/shared";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

// 摄取层对 MCP 的暴露:把一份结构化 schema(OpenAPI / JSON Schema / 样例 JSON /
// TypeScript interface / SQL DDL)确定性地翻成一份**草拟好的** StructuredCrudConfig,
// 供宿主 LLM 微调后再落地成代码(`full` 档交给 generate_crud_from_config;`front-door`
// 档该工具不注册,改为按三面填 `generate_crud` 的 `surfaces`)。
// 刻意不直接出代码——摄取只能定「类型→formtype」这条轴,查询面取舍、按钮、弹窗等仍由
// LLM 按原始需求补全。保持工具可组合:ingest(预填) → 人改 → generate(落地)。
//
// 2026-10-29:`buildIngestDraft` / `INGEST_KINDS` 已下沉到 `@es-plus/shared`
// (`src/ingest-draft.ts`),因为 CLI 的 `es-plus ingest` 消费同一条草稿路径 —— 两份实现
// 会让占位符与告警文案漂成两种口径。此处转出以保持既有 import 不变。

export {
  buildIngestDraft,
  type BuildIngestDraftInput,
  type BuildIngestDraftResult,
} from "@es-plus/shared";

export function registerIngestSchema(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  // AN-26：描述与产物里的「下一步」都点名落地工具。`front-door` 档下高级路径不在工具表里，
  // 继续教宿主「交给 generate_crud_from_config」只会换来 tool not found —— 按档位换指代。
  const nextStep =
    profile === "front-door"
      ? "use the draft as the reference when filling `generate_crud`'s `surfaces` (map each field into query / table / form), and pass it to `validate_config` with type 'structured-crud-config' to check your edits"
      : "pass it to generate_crud_from_config";
  server.tool(
    "ingest_schema",
    "Pre-fill a structured CRUD config from an existing schema (OpenAPI JSON, JSON Schema, a sample JSON object, a TypeScript interface/type literal, or SQL CREATE TABLE DDL). Deterministic, no LLM: it maps each property's DATA TYPE to a formtype (integer→InputNumber, boolean→Switch, string+date→DatePicker, string+enum→Select, array+enum→Checkbox, else Input). For ts-interface, JSDoc becomes the label and non-optional members become required; for sql-ddl, COMMENT becomes the label and NOT NULL/PRIMARY KEY become required. Use this as a HEAD START, then review & edit the draft (narrow the query fields, add buttons/dialogs/permissions the schema can't express) and " +
      nextStep +
      ". OpenAPI YAML is not supported in this version — convert to JSON first.",
    {
      text: z.string().min(1).describe("The schema source text (JSON for openapi/jsonSchema; a JSON object or array for sample-json; TypeScript interface/type source for ts-interface; CREATE TABLE DDL for sql-ddl)."),
      kind: z.enum(INGEST_KINDS).describe("Which kind of schema `text` is."),
      name: z.string().optional().describe("Override the page name (PascalCase). Defaults to the schema title, else a placeholder."),
      apiUrl: z.string().optional().describe("Override the REST base URL, e.g. \"/api/users\". Defaults to a placeholder you must replace."),
    },
    async ({ text, kind, name, apiUrl }) => {
      const { config, warnings } = buildIngestDraft({ text, kind, name, apiUrl });

      const output: string[] = [];
      if (!config) {
        output.push("⚠️ 无法生成草拟配置:");
        for (const w of warnings) output.push(`  - ${w}`);
        return { content: [{ type: "text", text: output.join("\n") }], isError: true };
      }

      output.push(`已从 ${kind} 摄取 ${config.fields.length} 个字段,草拟如下配置(请审阅并修订,然后 ${nextStep}):`);
      if (warnings.length > 0) {
        output.push("");
        output.push("⚠️ Warnings(非阻断——逐条核对,占位值务必替换):");
        for (const w of warnings) output.push(`  - ${w}`);
      }
      output.push("");
      output.push("```json");
      output.push(JSON.stringify(config, null, 2));
      output.push("```");

      return { content: [{ type: "text", text: output.join("\n") }] };
    }
  );
}
