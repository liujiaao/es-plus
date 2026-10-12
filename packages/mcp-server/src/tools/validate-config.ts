import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateConfig,
  listAvailableSchemas,
  validateAndRepair,
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

/**
 * 用权威 Zod schema 校验结构化配置。
 *
 * 实现已下沉到 shared 的 `validateAndRepair`（C2·A3）：mcp-server 前门、CLI `--from-config`、
 * eval 现在共用同一份判定与同一种 `/path: message` 错误串格式，不再各写一份字段清单。
 * 这里保留 `validateStructuredConfig` 这个名字只为既有调用方（`validatePayload`、`refine_config`）
 * 不受影响；语义与过去完全一致（只判、不改、无模型）。
 */
export function validateStructuredConfig(config: unknown): ValidationResult {
  return validateAndRepair(config);
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
