import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateCrudPage } from "../core/code-generator.js";
import { PRESET_EXAMPLES } from "../core/constants.js";

function toPascalCase(str: string): string {
  return str
    .replace(/(^|[-_])([a-z])/g, (_, __, letter) => letter.toUpperCase())
    .replace(/[-_]/g, "");
}

export const createCommand = new Command("create")
  .argument("<name>", "page name (kebab-case, e.g. user-management)")
  .option("-o, --output <path>", "output file path")
  .option("-d, --description <desc>", "skip interactive prompt, use this description directly")
  .description("Generate a CRUD page from natural language description")
  .action(async (name: string, options: { output?: string; description?: string }) => {
    let description = options.description;

    if (!description) {
      const presetChoices = [
        { title: "自定义描述", value: "__custom__" },
        ...PRESET_EXAMPLES.map((p) => ({ title: p.label, value: p.prompt })),
      ];

      const { source } = await prompts({
        type: "select",
        name: "source",
        message: "选择预设或自定义描述",
        choices: presetChoices,
      });

      if (!source) {
        console.log(pc.yellow("已取消"));
        return;
      }

      if (source === "__custom__") {
        const { desc } = await prompts({
          type: "text",
          name: "desc",
          message: "请描述页面功能（自然语言）",
          validate: (v) => (v.length > 5 ? true : "描述至少 6 个字符"),
        });
        if (!desc) {
          console.log(pc.yellow("已取消"));
          return;
        }
        description = desc;
      } else {
        description = source;
      }
    }

    const defaultOutput = resolve(
      process.cwd(),
      `src/views/${toPascalCase(name)}.vue`
    );
    let outputPath = options.output;

    if (!outputPath) {
      const { path } = await prompts({
        type: "text",
        name: "path",
        message: "输出路径",
        initial: defaultOutput,
      });
      if (!path) {
        console.log(pc.yellow("已取消"));
        return;
      }
      outputPath = path;
    }

    outputPath = resolve(process.cwd(), outputPath!);

    console.log(pc.cyan("\n⏳ 正在生成..."));

    const result = generateCrudPage(description!);

    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, result.code, "utf-8");

    console.log(pc.green(`\n✔ 已生成: ${outputPath}`));
    console.log(pc.dim(result.summary));
    console.log("");
  });
