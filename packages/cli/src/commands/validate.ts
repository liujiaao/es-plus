import { Command } from "commander";
import pc from "picocolors";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateConfig, listAvailableSchemas, validateAndRepair, type ValidationResult } from '@es-plus/shared';

/**
 * `structured-crud-config` 与 MCP `validate_config` 的 `STRUCTURED_CRUD_TYPE` 是同一个
 * 字符串。它**不在** `listAvailableSchemas()` 里 —— 那份列表来自
 * `packages/shared/schemas/*.schema.json`，而 StructuredCrudConfig 是 Zod 单源。
 * 硬喂给 Ajv 只会得到「Schema not found」，与配置本身对不对毫无关系。
 */
export const STRUCTURED_CRUD_TYPE = "structured-crud-config";

export const validateCommand = new Command("validate")
  .argument("<file>", "JSON config file to validate")
  .option(
    "-s, --schema <type>",
    "schema type: " + [...listAvailableSchemas(), STRUCTURED_CRUD_TYPE].join(", ")
  )
  .description("Validate es-plus config JSON against schema")
  .action((file: string, options: { schema?: string }) => {
    const filePath = resolve(process.cwd(), file);

    if (!existsSync(filePath)) {
      console.log(pc.red(`✗ 文件不存在: ${filePath}`));
      process.exit(1);
    }

    let config: unknown;
    try {
      const raw = readFileSync(filePath, "utf-8");
      config = JSON.parse(raw);
    } catch (e: any) {
      console.log(pc.red(`✗ JSON 解析失败: ${e.message}`));
      process.exit(1);
    }

    const { schemaType, result } = validateFileConfig(config, options.schema);

    if (result.valid) {
      console.log(
        pc.green(`✔ 校验通过 (schema: ${schemaType})`)
      );
    } else {
      console.log(
        pc.red(`✗ 校验失败（${result.errors.length} 个错误）:`)
      );
      for (const err of result.errors) {
        console.log(pc.red(`  ${err}`));
      }
      if (result.suggestions.length) {
        console.log(pc.yellow("\n建议:"));
        for (const s of result.suggestions) {
          console.log(pc.yellow(`  - ${s}`));
        }
      }
      console.log(
        pc.dim(`\n可用 schema: ${[...listAvailableSchemas(), STRUCTURED_CRUD_TYPE].join(", ")}`)
      );
      process.exit(1);
    }
  });

/**
 * 判定用哪条闸并执行校验（纯函数，便于单测）。
 *
 * 结构化 CRUD 配置（`{ name, apiUrl, fields, ... }`）在 Ajv 眼里没有对应 schema，
 * 且它**本身可能带 `columns`** —— 旧检测会把它判成 `table-column`，拿列 schema 去校验
 * 整页配置，回一串与真实问题无关的错误。故结构化配置必须先于其它分支识别，走与 MCP
 * `validate_config` 完全相同的 `validateAndRepair`（只判、不改）。
 */
export function validateFileConfig(
  config: unknown,
  schemaType?: string
): { schemaType: string; result: ValidationResult } {
  const resolved = schemaType || detectSchemaType(config);
  const result = resolved === STRUCTURED_CRUD_TYPE ? validateAndRepair(config) : validateConfig(config, resolved);
  return { schemaType: resolved, result };
}

/**
 * 依据配置对象的独有字段推断 schema 类型（--schema 未显式指定时）。
 * 导出以便单测覆盖分支判定（table-column / table-options / dialog-options / form-item）。
 */
export function detectSchemaType(config: unknown): string {
  if (!config || typeof config !== "object") return "form-item";
  const obj = config as Record<string, unknown>;
  // ① 结构化 CRUD 整页配置：name + apiUrl + fields[] 是它区别于所有片段配置的独有组合
  //    （片段配置没有 `fields` 数组）。必须**先于** columns 判定 —— StructuredCrudConfig
  //    自己也允许 `columns`，否则会被误判成 table-column。
  if (
    typeof obj.name === "string" &&
    typeof obj.apiUrl === "string" &&
    Array.isArray(obj.fields)
  ) {
    return STRUCTURED_CRUD_TYPE;
  }
  if ("columns" in obj || "tableData" in obj) return "table-column";
  // 用 table-options 独有字段判断；apiParams/httpRequest 是 form-item 与 table-options 共享字段，
  // 用它们判断会把带远程下拉的表单项误判为 table-options。
  if ("configTableOut" in obj || "virtual" in obj || "rowkey" in obj || "cachePageSelection" in obj) return "table-options";
  if ("isDraggable" in obj || "maxHeight" in obj || "fullscreen" in obj) return "dialog-options";
  return "form-item";
}
