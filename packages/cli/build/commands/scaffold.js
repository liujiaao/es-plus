import { Command } from "commander";
import pc from "picocolors";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { generateScaffold } from '@es-plus/shared';
import { toPascalCase, normalizeTarget, isValidTarget, CLI_TARGETS } from '../utils/strings.js';
import { confirmOverwrite, writeGeneratedFiles } from '../utils/fs.js';
export const scaffoldCommand = new Command("scaffold")
    .argument("<name>", "page name (kebab-case)")
    .option("-f, --features <list>", "comma-separated features: query,table,dialog", "query,table")
    .option("-o, --output <path>", "output file path")
    .option("-t, --target <target>", "target framework: vue3 (default), vue2, or antdv", "vue3")
    .option("--force", "overwrite existing output file without prompting")
    .description("Generate a minimal es-plus page scaffold")
    .action(async (name, options) => {
    if (!isValidTarget(options.target)) {
        console.log(pc.red(`✗ 未知 target: ${options.target}（可选: ${CLI_TARGETS.join(", ")}）`));
        process.exitCode = 1;
        return;
    }
    const features = options.features.split(",").map((f) => f.trim());
    const target = normalizeTarget(options.target);
    const outputPath = resolve(process.cwd(), options.output || `src/views/${toPascalCase(name)}.vue`);
    // 覆盖保护：scaffold 此前无条件写入，会静默 clobber 用户已编辑的同名 .vue。
    if (!(await confirmOverwrite([outputPath], !!options.force)))
        return;
    const code = generateScaffold(name, features, target);
    try {
        writeGeneratedFiles([{ path: outputPath, content: code }], dirname(outputPath));
    }
    catch (err) {
        console.log(pc.red(`✗ 写入失败: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
        return;
    }
    console.log(pc.green(`✔ 已生成: ${outputPath}`));
    console.log(pc.dim(`  features: ${features.join(", ")}, target: ${target}`));
    console.log("");
});
//# sourceMappingURL=scaffold.js.map