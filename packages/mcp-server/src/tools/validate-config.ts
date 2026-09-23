import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateConfig,
  listAvailableSchemas,
  StructuredCrudConfigSchema,
  type ValidationResult,
} from "@es-plus/shared";

/**
 * `generate_crud_from_config` 的入参（StructuredCrudConfig）在 `packages/shared/schemas/`
 * 下**没有**对应的 JSON Schema —— 它是 Zod 单源（`structured-config.schema.ts`）定义的。
 *
 * 于是 Ajv 那条路校验不了 AI 路径的真正产物：文档承诺的「生成 → **校验** → 编译」中间那步
 * 根本跑不了，`validate_config({config, type: "structured-crud-config"})` 只会回一句
 * 「Schema not found. Available: form-item, ...」，而那个名字本来就不在可用列表里。
 *
 * 这里给它一个显式的类型名，并走 Zod —— 与 CLI `--from-config` 是同一条校验路径
 * （`packages/cli/src/commands/create.ts` 同样直接调 `StructuredCrudConfigSchema.safeParse`），
 * 同一个权威 schema，不会再分叉出第三份字段清单。
 *
 * 为什么不复用 `validateConfig`（Ajv）：两者返回形态一致（`ValidationResult`），
 * 差异只在「谁来判」—— JSON 单源由 Ajv 判，Zod 单源由 Zod 判。硬把 Zod 配置喂给 Ajv，
 * 只会得到「no schema with key or ref」这类与配置本身无关的错误。
 */
export const STRUCTURED_CRUD_TYPE = "structured-crud-config";

/** zod issue 的最小形状（只取我们用来生成 errors/suggestions 的字段） */
interface ZodIssueLike {
  path?: (string | number)[];
  message: string;
  code?: string;
  expected?: string;
  values?: unknown[];
  minimum?: number;
  maximum?: number;
}

/**
 * Zod issue 按 Ajv 的 `instancePath: message` 形态渲染。
 *
 * Ajv 的 instancePath 形如 `/page/title`（前导斜杠），这里刻意保持一致：调用方
 * （MCP 客户端 / 宿主 LLM）看到的两种分支的错误串格式应当相同，否则它会以为遇到了两种错误。
 */
function formatZodPath(path: (string | number)[] | undefined): string {
  if (!path || path.length === 0) return "(root)";
  return "/" + path.map((p) => String(p)).join("/");
}

function zodIssuesToResult(issues: ZodIssueLike[]): ValidationResult {
  const errors = issues.map((i) => `${formatZodPath(i.path)}: ${i.message}`);

  const suggestions: string[] = [];
  for (const issue of issues) {
    const path = formatZodPath(issue.path);
    switch (issue.code) {
      case "invalid_type":
        if (issue.expected) suggestions.push(`${path} should be type "${issue.expected}"`);
        break;
      case "invalid_value":
        if (issue.values?.length) {
          const shown = issue.values.slice(0, 12).join(", ");
          const more = issue.values.length > 12 ? ", …" : "";
          suggestions.push(`Valid values for ${path}: ${shown}${more}`);
        }
        break;
      case "too_small":
        if (issue.minimum !== undefined) {
          suggestions.push(`${path} must have at least ${issue.minimum}`);
        }
        break;
      case "too_big":
        if (issue.maximum !== undefined) {
          suggestions.push(`${path} must have at most ${issue.maximum}`);
        }
        break;
      case "invalid_union":
        suggestions.push(`${path} does not match any of the allowed shapes`);
        break;
    }
  }

  return { valid: false, errors, suggestions };
}

/**
 * 用权威 Zod schema 校验结构化配置。
 *
 * zod 跨版本调用是安全的：`safeParse` 用的是 schema **自身**的 zod 实现（shared 的 zod 4），
 * 与调用方的 zod 版本无关 —— 只要不把两边的 schema 互相**组合**（`z.object({...shape})`、
 * 塞进对方的 `.refine()`），就不会踩到版本不兼容。（`generate-from-config.ts` 里内联一份
 * 副本是因为要**组合**，这里只是调用，故直接复用单源。）
 */
export function validateStructuredConfig(config: unknown): ValidationResult {
  const result = StructuredCrudConfigSchema.safeParse(config);
  if (result.success) return { valid: true, errors: [], suggestions: [] };

  // zod 4 用 `issues`；旧版（以及部分被包装过的 error 对象）用 `errors`。两处都读，
  // 与 CLI `--from-config` 的写法一致 —— 拿不到 issue 列表时宁可回一句泛化错误，
  // 也不能因为字段名差异而报「校验通过」。
  const error = result.error as unknown as { issues?: ZodIssueLike[]; errors?: ZodIssueLike[] };
  const issues = error.issues ?? error.errors ?? [];
  if (issues.length === 0) {
    return {
      valid: false,
      errors: ["Configuration failed structured-config validation (no issue details available)"],
      suggestions: ["Check the config against the structured CRUD page schema"],
    };
  }
  return zodIssuesToResult(issues);
}

/**
 * `validate_config` 的校验入口：结构化配置走 Zod，其余走 JSON Schema（Ajv）。
 *
 * 抽成导出的纯函数是为了可测 —— 工具注册函数（registerValidateConfig）需要起一个 MCP
 * server 才能触达，而真正要断言的是「哪条路径判、错误串什么形态」。
 */
export function validatePayload(config: unknown, type?: string): ValidationResult {
  if (type === STRUCTURED_CRUD_TYPE) return validateStructuredConfig(config);
  return validateConfig(config, type);
}

export function registerValidateConfig(server: McpServer) {
  server.tool(
    "validate_config",
    "Validate an es-plus JSON configuration against its schema. Returns validation errors and fix suggestions.",
    {
      config: z
        .string()
        .describe("JSON string of the es-plus configuration to validate"),
      type: z
        .string()
        .optional()
        .describe(
          `Schema type to validate against. Available: ${listAvailableSchemas().join(", ")}, ` +
            `${STRUCTURED_CRUD_TYPE} (the input of generate_crud_from_config). ` +
            `Defaults to "form-item".`
        ),
    },
    async ({ config, type }) => {
      try {
        const parsed = JSON.parse(config);
        const result = validatePayload(parsed, type);

        if (result.valid) {
          return {
            content: [
              {
                type: "text",
                text: "✓ Configuration is valid!",
              },
            ],
          };
        }

        const output = [
          "✗ Configuration has errors:\n",
          ...result.errors.map((e) => `  - ${e}`),
          "",
          result.suggestions.length > 0 ? "Suggestions:" : "",
          ...result.suggestions.map((s) => `  → ${s}`),
        ]
          .filter(Boolean)
          .join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error: any) {
        if (error instanceof SyntaxError) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid JSON: ${error.message}\n\nSuggestion: Check for trailing commas, missing quotes, or unescaped characters.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: `Validation error: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
