import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ingestSchema,
  composeCrudConfig,
  type SchemaKind,
  type StructuredCrudConfigInput,
} from "@es-plus/shared";

// 摄取层对 MCP 的暴露:把一份结构化 schema(OpenAPI / JSON Schema / 样例 JSON)确定性地
// 翻成一份**草拟好的** StructuredCrudConfig,供宿主 LLM 微调后再调 generate_crud_from_config。
// 刻意不直接出代码——摄取只能定「类型→formtype」这条轴,查询面取舍、按钮、弹窗等仍由
// LLM 按原始需求补全。保持工具可组合:ingest(预填) → 人改 → generate(落地)。

const INGEST_KINDS = [
  "openapi",
  "jsonSchema",
  "sample-json",
  "ts-interface",
  "sql-ddl",
] as const satisfies readonly SchemaKind[];

export interface BuildIngestDraftInput {
  text: string;
  kind: SchemaKind;
  name?: string;
  apiUrl?: string;
}

export interface BuildIngestDraftResult {
  /** 草拟配置;字段数为 0 时(解析失败 / 不支持的 kind)不产出,仅回告警。 */
  config?: StructuredCrudConfigInput;
  /** 摄取 + 组合两段的告警合并。 */
  warnings: string[];
}

/**
 * 纯函数:摄取 → 组合草拟配置。独立导出以便直接单测(与 generate-from-config 的
 * buildSemanticWarnings 同一范式——测试打工具的逻辑,不起 MCP 传输层)。
 */
export function buildIngestDraft(input: BuildIngestDraftInput): BuildIngestDraftResult {
  const ingested = ingestSchema(input.text, input.kind);
  const warnings = [...ingested.warnings];

  if (ingested.fields.length === 0) {
    warnings.push("未能从该 schema 抽取任何字段 —— 请检查输入,或改用 generate_crud_from_config 手工填写字段。");
    return { warnings };
  }

  const name = input.name ?? ingested.name;
  const resolvedName = name ?? "IngestedPage";
  if (!name) {
    warnings.push('未提供 name 且无法从 schema 推断 —— 已占位 "IngestedPage",请改成真实页面名(PascalCase)。');
  }
  const apiUrl = input.apiUrl ?? "/api/REPLACE_ME";
  if (!input.apiUrl) {
    warnings.push('未提供 apiUrl —— 已占位 "/api/REPLACE_ME",请改成真实 REST 端点。');
  }

  // 摄取只给扁平字段表:默认每个属性既是列、也是表单项(inTable/inForm),查询面留空
  // 由调用方按需收窄——composeCrudConfig 据此推导三成员布尔。
  const { config, warnings: composeWarnings } = composeCrudConfig({
    name: resolvedName,
    apiUrl,
    table: ingested.fields,
    form: ingested.fields,
  });
  warnings.push(...composeWarnings);

  return { config, warnings };
}

export function registerIngestSchema(server: McpServer) {
  server.tool(
    "ingest_schema",
    "Pre-fill a structured CRUD config from an existing schema (OpenAPI JSON, JSON Schema, or a sample JSON object). Deterministic, no LLM: it maps each property's DATA TYPE to a formtype (integer→InputNumber, boolean→Switch, string+format:date→DatePicker, string+enum→Select, array+enum→Checkbox, else Input). Use this as a HEAD START, then review & edit the draft (narrow the query fields, add buttons/dialogs/permissions the schema can't express) and pass it to generate_crud_from_config. OpenAPI YAML is not supported in this version — convert to JSON first. 'ts-interface' and 'sql-ddl' are not yet supported.",
    {
      text: z.string().min(1).describe("The schema source text (JSON for openapi/jsonSchema; a JSON object or array for sample-json)."),
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

      output.push(`已从 ${kind} 摄取 ${config.fields.length} 个字段,草拟如下配置(请审阅、修订后再调 generate_crud_from_config):`);
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
