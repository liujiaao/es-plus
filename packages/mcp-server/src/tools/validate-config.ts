import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateConfig,
  listAvailableSchemas,
  validateAndRepair,
  zodIssuesToResult,
  collectUnknownKeys,
  formatUnknownKey,
  type ValidationResult,
} from "@es-plus/shared";
import { tableShape } from "./generate-table.js";
import { formShape } from "./generate-form.js";
import { dialogShape } from "./generate-dialog.js";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

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
 * 独立组件场景的三种配置类型（Wave 4）。
 *
 * 与 `STRUCTURED_CRUD_TYPE` 同一模式：它们不是 `packages/shared/schemas/` 下的 JSON
 * Schema，而是**片段工具的 Zod 入参形状**（`generate-table/form/dialog.ts` 的
 * `xxxShape`）。这里直接复用那份形状 —— 同一份判据，不再抄第三份字段清单：
 * 工具收什么，`validate_config` 就判什么。
 */
export const ES_TABLE_TYPE = "es-table-config";
export const ES_FORM_TYPE = "es-form-config";
export const ES_DIALOG_TYPE = "es-dialog-config";

const FRAGMENT_CONFIG_TYPES = [ES_TABLE_TYPE, ES_FORM_TYPE, ES_DIALOG_TYPE] as const;
type FragmentConfigType = (typeof FRAGMENT_CONFIG_TYPES)[number];

/**
 * 片段配置的 Zod 判据（zod3）。惰性构建，避免模块加载顺序带来的副作用。
 *
 * 注意 zod3 与 zod4 的 issue 词汇差异：zod3 的枚举错误码是 `invalid_enum_value`
 * 且合法值是 `options`，而 shared 的 `zodIssuesToResult` 按 zod4 的
 * `invalid_value`/`values` 渲染建议 —— 这里做一次归一化，保证两种分支给宿主的
 * 错误/建议串形态一致（Ajv 分支用 `/path: message`，这里也一样）。
 *
 * AN-08：片段入参**本就应当精确**（没有「宿主扩展键」的承诺），故 `.strict()`：
 * 未知键从「解析成功、键被静默剥掉」变成一条 issue。注意 MCP SDK 的 `server.tool()`
 * 只接受 `ZodRawShape`，协议层无法替工具加 strict —— 这条判据因此落在
 * `validate_config`（同一份形状的权威判据）上，工具自身那一层维持原样。
 */
function fragmentSchemaFor(type: FragmentConfigType) {
  switch (type) {
    case ES_TABLE_TYPE:
      return z.object(tableShape).strict();
    case ES_FORM_TYPE:
      return z.object(formShape).strict();
    case ES_DIALOG_TYPE:
      return z.object(dialogShape).strict();
  }
}

function validateFragmentConfig(config: unknown, type: FragmentConfigType): ValidationResult {
  const schema = fragmentSchemaFor(type);
  // 未知键的判据不能只靠根对象上的 `.strict()`：嵌套对象（`tableOptions.rowKey`、
  // `options.widht`）在 zod 里默认 **strip**，根对象解析成功时那些键已经无声消失，
  // 宿主只会看到「✓ 合法」。故无论解析成败都先做一次只读收集；成功但存在未知键
  // 同样判红 —— 与 `validateAndRepair`（structured-crud-config）同一口径。
  const unknownKeys = collectUnknownKeys(schema, config);
  const unknownErrors = unknownKeys.map(formatUnknownKey);
  const unknownSuggestions = unknownKeys
    .map((f) => (f.suggestion ? formatUnknownKey(f) : ""))
    .filter(Boolean);

  const result = schema.safeParse(config);
  if (result.success) {
    if (unknownKeys.length === 0) return { valid: true, errors: [], suggestions: [], unknownKeys };
    // 根 `.strict()` 未触发 ⇒ 未知键在**嵌套**层；它们才是本条要堵的静默丢弃。
    return { valid: false, errors: unknownErrors, suggestions: unknownSuggestions, unknownKeys };
  }

  const issues = result.error.issues.map((issue) => {
    const raw = issue as unknown as {
      code?: string;
      options?: unknown[];
      values?: unknown[];
      expected?: string;
      minimum?: number;
      maximum?: number;
    };
    return {
      path: issue.path,
      message: issue.message,
      // zod3 → zod4 词汇归一（见上方注释）
      code: raw.code === "invalid_enum_value" ? "invalid_value" : raw.code,
      expected: raw.expected,
      values: raw.values ?? raw.options,
      minimum: raw.minimum,
      maximum: raw.maximum,
    };
  });
  const rendered = zodIssuesToResult(issues);
  return {
    valid: false,
    errors: rendered.errors,
    suggestions: [...rendered.suggestions, ...unknownSuggestions],
    unknownKeys,
  };
}

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
  if (type !== undefined && (FRAGMENT_CONFIG_TYPES as readonly string[]).includes(type)) {
    return validateFragmentConfig(config, type as FragmentConfigType);
  }
  return validateConfig(config, type);
}

export function registerValidateConfig(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  // AN-26：`front-door` 档下高级路径不注册，但结构化校验在这里**仍然可用** —— 宿主可能
  // 手工写配置（或摄取层产出的草稿）。所以只换「这份配置从哪来」的说法，不删这个类型。
  const structuredHint =
    profile === "front-door"
      ? `${STRUCTURED_CRUD_TYPE} (the structured CRUD config the front door composes for you; validate a hand-authored one here)`
      : `${STRUCTURED_CRUD_TYPE} (the input of generate_crud_from_config)`;
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
            `${structuredHint}, ` +
            `${ES_TABLE_TYPE} / ${ES_FORM_TYPE} / ${ES_DIALOG_TYPE} (the inputs of generate_table / generate_form / generate_dialog). ` +
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
          // 「配置非法」是一次**失败**的工具调用：宿主若按 `result.isError` 分支
          // （MCP 客户端普遍如此）决定「要不要修了重发」，缺了它就会把红字正文
          // 当成成功结果直接采用。与上面 JSON 解析失败、下方异常两支保持同一口径。
          isError: true,
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
