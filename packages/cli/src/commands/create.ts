import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateCrudPage, generateCrudSchema, generateFromConfig, StructuredCrudConfigSchema, PRESET_EXAMPLES } from '@es-plus/shared';
import { nlToConfig, aiAvailable, AiUnavailableError } from '../ai/nl-to-config.js';

function toPascalCase(str: string): string {
  return str
    .replace(/(^|[-_])([a-z])/g, (_, __, letter) => letter.toUpperCase())
    .replace(/[-_]/g, "");
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 覆盖保护：写入前检查目标文件是否已存在。
 * - 无同名文件，或显式 --force → 直接放行。
 * - 存在同名文件且未 --force：
 *     · 交互式终端 → 提示用户确认覆盖；拒绝则返回 false（调用方按取消处理，退出码 0）。
 *     · 非交互环境（无 TTY，如 CI/脚本）→ 拒绝覆盖并置 exitCode=1，避免静默破坏用户已编辑的文件。
 * 对齐「覆盖前先查看目标」的安全约束，防止 `es-plus create` 无声 clobber 现有 schema.ts / *.vue。
 */
async function confirmOverwrite(targets: string[], force: boolean): Promise<boolean> {
  const existing = targets.filter((f) => existsSync(f));
  if (existing.length === 0 || force) return true;

  console.log(pc.yellow("\n⚠️ 以下文件已存在，将被覆盖："));
  for (const f of existing) console.log(pc.yellow(`   ${f}`));

  if (!process.stdout.isTTY) {
    console.log(pc.red("检测到非交互环境，已中止以避免覆盖。请使用 --force 显式覆盖，或更换 --output 路径。"));
    process.exitCode = 1;
    return false;
  }

  const { ok } = await prompts({
    type: "confirm",
    name: "ok",
    message: "覆盖以上已存在文件？",
    initial: false,
  });
  if (!ok) {
    console.log(pc.yellow("已取消"));
    return false;
  }
  return true;
}

/**
 * Emit code from a validated StructuredCrudConfig via the deterministic generator.
 * Shared by the --from-config path and the --ai path so both produce identical
 * output layouts (schema.ts + <Pascal>.vue, or a single SFC).
 */
async function emitFromStructuredConfig(config: any, nameArg: string | undefined, output: string | undefined, force: boolean): Promise<void> {
  const pageName = nameArg || toKebabCase(config.name);
  const pascalName = toPascalCase(pageName);

  const result = generateFromConfig(config);

  if (result.warnings.length > 0) {
    console.log(pc.yellow("\n⚠️ Warnings:"));
    for (const w of result.warnings) {
      console.log(pc.yellow(`  - ${w}`));
    }
  }

  const mode = config.mode || "schema";

  if (mode === "sfc") {
    const defaultOutput = resolve(process.cwd(), `src/views/${pascalName}.vue`);
    const outputPath = output ? resolve(process.cwd(), output) : defaultOutput;
    if (!(await confirmOverwrite([outputPath], force))) return;
    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(outputPath, result.code, "utf-8");
    console.log(pc.green(`\n✔ 已生成: ${outputPath}`));
  } else {
    const defaultDir = resolve(process.cwd(), `src/views/${pageName}`);
    const outputDir = output ? resolve(process.cwd(), output) : defaultDir;

    const schemaFile = resolve(outputDir, "schema.ts");
    const wrapperFile = resolve(outputDir, `${pascalName}.vue`);
    if (!(await confirmOverwrite([schemaFile, wrapperFile], force))) return;
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    writeFileSync(schemaFile, result.code, "utf-8");
    writeFileSync(wrapperFile, result.wrapperCode || "", "utf-8");

    console.log(pc.green(`\n✔ 已生成:`));
    console.log(pc.green(`   ${schemaFile}`));
    console.log(pc.green(`   ${wrapperFile}`));
  }

  console.log(pc.dim(result.summary));
  console.log("");
}

export const createCommand = new Command("create")
  .argument("[name]", "page name (kebab-case, e.g. user-management)")
  .option("-o, --output <path>", "output file path")
  .option("-d, --description <desc>", "skip interactive prompt, use this description directly")
  .option("-m, --mode <mode>", "output mode: schema (default) or sfc", "schema")
  .option("-c, --from-config <path>", "generate from a structured JSON config file (production mode)")
  .option("--ai", "use an LLM (Anthropic) to reason NL→config; auto-enabled when ANTHROPIC_API_KEY is set. Use --no-ai to force the built-in generator")
  .option("--no-ai", "force the built-in (regex) generator even when ANTHROPIC_API_KEY is set")
  .option("-t, --target <target>", "target framework: vue3 (default, @es-plus/vue3 + Element Plus), vue2 (@es-plus/vue2 + Element UI), or antdv (@es-plus/adapter-antdv + Ant Design Vue)", "vue3")
  .option("-f, --force", "overwrite existing output files without prompting")
  .description("Generate a CRUD page from natural language description or structured config")
  .action(async (name: string | undefined, options: { output?: string; description?: string; mode?: string; fromConfig?: string; target?: string; ai?: boolean; force?: boolean }) => {
    // 校验 target，默认 vue3；同时允许 config 文件本身的 target 字段覆盖（仅 fromConfig 模式）
    const cliTarget: 'vue3' | 'vue2' | 'antdv' =
      options.target === 'vue2' ? 'vue2' : options.target === 'antdv' ? 'antdv' : 'vue3';
    // Structured config mode — production-ready generation
    if (options.fromConfig) {
      const configPath = resolve(process.cwd(), options.fromConfig);
      if (!existsSync(configPath)) {
        console.log(pc.red(`Config file not found: ${configPath}`));
        process.exitCode = 1;
        return;
      }

      let raw: string;
      try {
        raw = readFileSync(configPath, "utf-8");
      } catch (err: any) {
        console.log(pc.red(`Failed to read config: ${err.message}`));
        process.exitCode = 1;
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (err: any) {
        console.log(pc.red(`Invalid JSON: ${err.message}`));
        process.exitCode = 1;
        return;
      }

      const validation = StructuredCrudConfigSchema.safeParse(parsed);
      if (!validation.success) {
        console.log(pc.red("Config validation failed:"));
        for (const err of (validation.error as any).issues || (validation.error as any).errors || []) {
          console.log(pc.red(`  ${(err.path || []).join(".")}: ${err.message}`));
        }
        process.exitCode = 1;
        return;
      }

      const config = validation.data as any;
      // 目标框架优先级：配置文件显式 target > CLI --target > 默认 vue3
      // 注意：schema 对 target 施加了 .default('vue3')，safeParse 后 config.target 恒有值，
      // 无法区分「配置显式写 vue3」与「配置省略」。故改用原始 parsed.target 判定显式性，
      // 仅当配置未显式给出 target 时才回落到 CLI --target（cliTarget 已含 vue3 兜底）。
      if (parsed == null || (parsed as any).target === undefined) {
        config.target = cliTarget;
      }
      const pageName = name || toKebabCase(config.name);

      console.log(pc.cyan(`\n⏳ 正在从结构化配置生成 (${config.mode || 'schema'} 模式, target=${config.target})...`));

      await emitFromStructuredConfig(config, pageName, options.output, !!options.force);
      return;
    }

    // Name is required for NL mode
    if (!name) {
      console.log(pc.red("Error: page name is required (or use --from-config)"));
      process.exitCode = 1;
      return;
    }
    let description = options.description;
    const mode = options.mode === "sfc" ? "sfc" : "schema";

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

    // Opt-in LLM path: reason NL→StructuredCrudConfig, then reuse the deterministic
    // generator (compile-guaranteed, identical output to --from-config).
    // Enabled by --ai, or automatically when ANTHROPIC_API_KEY is present; --no-ai forces regex.
    const wantAi = options.ai !== false && (options.ai === true || !!process.env.ANTHROPIC_API_KEY);
    if (wantAi) {
      if (await aiAvailable()) {
        try {
          console.log(pc.cyan(`\n🤖 正在用 LLM 推理配置 (NL→config, target=${cliTarget})...`));
          const { config, attempts } = await nlToConfig(description!, { target: cliTarget, mode });
          console.log(pc.dim(`   LLM 生成配置成功（${attempts} 次尝试）→ 走确定性生成器`));
          await emitFromStructuredConfig(config, name, options.output, !!options.force);
          return;
        } catch (err: any) {
          const detail = err instanceof AiUnavailableError ? err.message : (err?.message || String(err));
          console.log(pc.yellow(`\n⚠️ LLM 路径失败，降级到内置生成器：${detail}`));
        }
      } else if (options.ai === true) {
        console.log(pc.yellow("\n⚠️ 已请求 --ai，但 @anthropic-ai/sdk 未安装或 ANTHROPIC_API_KEY 未设置；降级到内置生成器。"));
      }
    }

    const pascalName = toPascalCase(name);

    if (mode === "sfc") {
      const defaultOutput = resolve(process.cwd(), `src/views/${pascalName}.vue`);
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

      console.log(pc.cyan(`\n⏳ 正在生成 (SFC 模式, target=${cliTarget})...`));

      const result = generateCrudPage(description!, cliTarget);

      if (!(await confirmOverwrite([outputPath], !!options.force))) return;
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(outputPath, result.code, "utf-8");

      console.log(pc.green(`\n✔ 已生成: ${outputPath}`));
      console.log(pc.dim(result.summary));
    } else {
      const defaultDir = resolve(process.cwd(), `src/views/${name}`);
      let outputDir = options.output;

      if (!outputDir) {
        const { path } = await prompts({
          type: "text",
          name: "path",
          message: "输出目录",
          initial: defaultDir,
        });
        if (!path) {
          console.log(pc.yellow("已取消"));
          return;
        }
        outputDir = path;
      }

      outputDir = resolve(process.cwd(), outputDir!);

      console.log(pc.cyan(`\n⏳ 正在生成 (Schema 模式, target=${cliTarget})...`));

      const result = generateCrudSchema(description!, cliTarget);
      const schemaJson = JSON.stringify(result.schema, null, 2);

      const schemaFile = resolve(outputDir, "schema.ts");
      const wrapperFile = resolve(outputDir, `${pascalName}.vue`);

      if (!(await confirmOverwrite([schemaFile, wrapperFile], !!options.force))) return;
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const esPlusPkg =
        cliTarget === 'vue2' ? '@es-plus/vue2' : cliTarget === 'antdv' ? '@es-plus/adapter-antdv' : '@es-plus/vue3';
      const schemaContent = [
        `import type { CrudPageSchema } from '${esPlusPkg}'`,
        ``,
        `export const pageSchema: CrudPageSchema = ${schemaJson}`,
        ``,
      ].join("\n");

      writeFileSync(schemaFile, schemaContent, "utf-8");
      writeFileSync(wrapperFile, result.wrapperCode, "utf-8");

      console.log(pc.green(`\n✔ 已生成:`));
      console.log(pc.green(`   ${schemaFile}`));
      console.log(pc.green(`   ${wrapperFile}`));
      console.log(pc.dim(result.summary));
    }

    console.log("");
  });
