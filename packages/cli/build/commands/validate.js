import { Command } from "commander";
import pc from "picocolors";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateConfig, listAvailableSchemas } from '@es-plus/shared';
export const validateCommand = new Command("validate")
    .argument("<file>", "JSON config file to validate")
    .option("-s, --schema <type>", "schema type: " + listAvailableSchemas().join(", "))
    .description("Validate es-plus config JSON against schema")
    .action((file, options) => {
    const filePath = resolve(process.cwd(), file);
    if (!existsSync(filePath)) {
        console.log(pc.red(`✗ 文件不存在: ${filePath}`));
        process.exit(1);
    }
    let config;
    try {
        const raw = readFileSync(filePath, "utf-8");
        config = JSON.parse(raw);
    }
    catch (e) {
        console.log(pc.red(`✗ JSON 解析失败: ${e.message}`));
        process.exit(1);
    }
    const schemaType = options.schema || detectSchemaType(config);
    const result = validateConfig(config, schemaType);
    if (result.valid) {
        console.log(pc.green(`✔ 校验通过 (schema: ${schemaType})`));
    }
    else {
        console.log(pc.red(`✗ 校验失败（${result.errors.length} 个错误）:`));
        for (const err of result.errors) {
            console.log(pc.red(`  ${err}`));
        }
        if (result.suggestions.length) {
            console.log(pc.yellow("\n建议:"));
            for (const s of result.suggestions) {
                console.log(pc.yellow(`  - ${s}`));
            }
        }
        console.log(pc.dim(`\n可用 schema: ${listAvailableSchemas().join(", ")}`));
        process.exit(1);
    }
});
/**
 * 依据配置对象的独有字段推断 schema 类型（--schema 未显式指定时）。
 * 导出以便单测覆盖分支判定（table-column / table-options / dialog-options / form-item）。
 */
export function detectSchemaType(config) {
    if (!config || typeof config !== "object")
        return "form-item";
    const obj = config;
    if ("columns" in obj || "tableData" in obj)
        return "table-column";
    // 用 table-options 独有字段判断；apiParams/httpRequest 是 form-item 与 table-options 共享字段，
    // 用它们判断会把带远程下拉的表单项误判为 table-options。
    if ("configTableOut" in obj || "virtual" in obj || "rowkey" in obj || "cachePageSelection" in obj)
        return "table-options";
    if ("isDraggable" in obj || "maxHeight" in obj || "fullscreen" in obj)
        return "dialog-options";
    return "form-item";
}
//# sourceMappingURL=validate.js.map