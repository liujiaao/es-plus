import { Command } from "commander";
import pc from "picocolors";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateConfig, listAvailableSchemas } from '@es-plus/shared';

export const validateCommand = new Command("validate")
  .argument("<file>", "JSON config file to validate")
  .option(
    "-s, --schema <type>",
    "schema type: " + listAvailableSchemas().join(", ")
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

    const schemaType = options.schema || detectSchemaType(config);
    const result = validateConfig(config, schemaType);

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
        pc.dim(`\n可用 schema: ${listAvailableSchemas().join(", ")}`)
      );
      process.exit(1);
    }
  });

function detectSchemaType(config: unknown): string {
  if (!config || typeof config !== "object") return "form-item";
  const obj = config as Record<string, unknown>;
  if ("columns" in obj || "tableData" in obj) return "table-column";
  if ("httpRequest" in obj || "configTableOut" in obj || "apiParams" in obj || "virtual" in obj) return "table-options";
  if ("render" in obj || "configBtn" in obj || "isDraggable" in obj) return "dialog-options";
  return "form-item";
}
