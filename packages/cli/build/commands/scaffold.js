import { Command } from "commander";
import pc from "picocolors";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateScaffold } from '@es-plus/shared';
function toPascalCase(str) {
    return str
        .replace(/(^|[-_])([a-z])/g, (_, __, letter) => letter.toUpperCase())
        .replace(/[-_]/g, "");
}
export const scaffoldCommand = new Command("scaffold")
    .argument("<name>", "page name (kebab-case)")
    .option("-f, --features <list>", "comma-separated features: query,table,dialog", "query,table")
    .option("-o, --output <path>", "output file path")
    .description("Generate a minimal es-plus page scaffold")
    .action((name, options) => {
    const features = options.features.split(",").map((f) => f.trim());
    const outputPath = resolve(process.cwd(), options.output || `src/views/${toPascalCase(name)}.vue`);
    const code = generateScaffold(name, features);
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputPath, code, "utf-8");
    console.log(pc.green(`✔ 已生成: ${outputPath}`));
    console.log(pc.dim(`  features: ${features.join(", ")}`));
    console.log("");
});
//# sourceMappingURL=scaffold.js.map