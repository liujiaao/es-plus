import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateCrudPage, generateCrudSchema, generateFromConfig, StructuredCrudConfigSchema, PRESET_EXAMPLES } from '@es-plus/shared';
import { nlToConfig, AiUnavailableError } from '../ai/nl-to-config.js';
import { toPascalCase, toKebabCase, normalizeTarget, esPlusPkgFor, isValidTarget, isSafePathSegment, isPathInside, CLI_TARGETS } from '../utils/strings.js';
import { confirmOverwrite, writeGeneratedFiles } from '../utils/fs.js';

/**
 * Emit code from a validated StructuredCrudConfig via the deterministic generator.
 * Shared by the --from-config path and the --ai path so both produce identical
 * output layouts (schema.ts + <Pascal>.vue, or a single SFC).
 */
async function emitFromStructuredConfig(config: any, nameArg: string | undefined, output: string | undefined, force: boolean): Promise<void> {
  const pageName = nameArg || toKebabCase(config.name);
  const pascalName = toPascalCase(pageName);

  // 页面名会被用作文件/目录名。config.name 可能来自不可信来源（LLM / 用户配置文件），
  // 若含路径分隔符或 `..` 会把产物写出目标目录（路径穿越）。
  if (!isSafePathSegment(pageName) || !isSafePathSegment(pascalName)) {
    console.log(pc.red(`✗ 非法的页面名：${config.name}（不得包含路径分隔符、"." 或 ".."）`));
    process.exitCode = 1;
    return;
  }

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
    writeGeneratedFiles([{ path: outputPath, content: result.code }], dirname(outputPath));
    console.log(pc.green(`\n✔ 已生成: ${outputPath}`));
  } else {
    const defaultDir = resolve(process.cwd(), `src/views/${pageName}`);
    const outputDir = output ? resolve(process.cwd(), output) : defaultDir;

    const schemaFile = resolve(outputDir, "schema.ts");
    const wrapperFile = resolve(outputDir, `${pascalName}.vue`);
    // 兜底：拼出的路径必须仍在 outputDir 内（任何形式的逃逸都拒绝）
    if (!isPathInside(outputDir, schemaFile) || !isPathInside(outputDir, wrapperFile)) {
      console.log(pc.red(`✗ 输出路径越界：${wrapperFile}`));
      process.exitCode = 1;
      return;
    }
    if (!(await confirmOverwrite([schemaFile, wrapperFile], force))) return;

    // 事务式写入：空 wrapperCode 会抛错（避免 0 字节 .vue 却报成功），
    // 中途失败回滚新建文件（避免只写出 schema.ts 的半生成目录）。
    writeGeneratedFiles(
      [
        { path: schemaFile, content: result.code },
        { path: wrapperFile, content: result.wrapperCode || "" },
      ],
      outputDir
    );

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
  .option("-m, --mode <mode>", "output mode: schema (default) or sfc")
  .option("-c, --from-config <path>", "generate from a structured JSON config file (production mode)")
  .option("--ai", "use an LLM (Anthropic) to reason NL→config; auto-enabled when ANTHROPIC_API_KEY is set. Use --no-ai to force the built-in generator")
  .option("--no-ai", "force the built-in (regex) generator even when ANTHROPIC_API_KEY is set")
  .option("-t, --target <target>", "target framework: vue3 (default, @es-plus/vue3 + Element Plus), vue2 (@es-plus/vue2 + Element UI), or antdv (@es-plus/adapter-antdv + Ant Design Vue)")
  .option("-f, --force", "overwrite existing output files without prompting")
  .description("Generate a CRUD page from natural language description or structured config")
  .action(async (name: string | undefined, options: { output?: string; description?: string; mode?: string; fromConfig?: string; target?: string; ai?: boolean; force?: boolean }) => {
    // 显式未知 target 直接报错退出，避免静默降级为 vue3（丢弃用户明确的不支持请求）。
    if (!isValidTarget(options.target)) {
      console.log(pc.red(`✗ 未知 target: ${options.target}（可选: ${CLI_TARGETS.join(", ")}）`));
      process.exitCode = 1;
      return;
    }
    // 校验 target，默认 vue3；同时允许 config 文件本身的 target 字段覆盖（仅 fromConfig 模式）
    const cliTarget: 'vue3' | 'vue2' | 'antdv' = normalizeTarget(options.target);
    // 「用户是否显式传了 --target」必须与归一后的默认值分开记录：默认值 vue3 不能冒充
    // 用户选择。AI 路径里模型会按 NL 判定 target（few-shot 明写「明确要 Vue2 / Ant
    // Design Vue → target:"vue2"/"antdv"」），若把默认值当显式指令传进去，这个解读会被
    // 一个用户从未传过的标志静默压掉。
    const explicitTarget = options.target !== undefined;
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
    // 同 explicitTarget：--mode 的缺省是 schema，但「没传」不等于「用户要 schema」。
    const explicitMode = options.mode !== undefined;

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
      try {
        // 不先问 `aiAvailable()` 再决定是否进入：那个「探测 + 分支」正是静默降级的来源
        // （key 已设置但 SDK 未安装时探测返回 false，而 --ai 未显式给定时整段跳过、不留
        // 任何提示 —— 用户以为用了 AI，实际拿到的是正则生成器）。直接调用，让
        // `AiUnavailableError` 带着**确切原因**走同一条可见的降级提示。
        console.log(pc.cyan(`\n🤖 正在用 LLM 推理配置 (NL→config)...`));
        const { config, attempts } = await nlToConfig(description!, {
          // 只在用户真的传了标志时下发：否则把决定权留给模型对 NL 的解读。
          target: explicitTarget ? cliTarget : undefined,
          mode: explicitMode ? mode : undefined,
        });
        // 日志必须报告**实际**目标/模式：模型可以按 NL 选它们，打印 CLI 默认值会撒谎。
        console.log(pc.dim(`   LLM 生成配置成功（${attempts} 次尝试，target=${config.target}, mode=${config.mode}）→ 走确定性生成器`));
        await emitFromStructuredConfig(config, name, options.output, !!options.force);
        return;
      } catch (err: any) {
        const unavailable = err instanceof AiUnavailableError;
        const detail = unavailable ? err.message : (err?.message || String(err));
        console.log(
          pc.yellow(`\n⚠️ ${unavailable ? 'AI 路径不可用' : 'LLM 路径失败'}，降级到内置生成器：${detail}`)
        );
      }
    }

    const pascalName = toPascalCase(name);

    // 同 emitFromStructuredConfig：name 会被用作文件/目录名，拒绝路径穿越。
    if (!isSafePathSegment(name) || !isSafePathSegment(pascalName)) {
      console.log(pc.red(`✗ 非法的页面名：${name}（不得包含路径分隔符、"." 或 ".."）`));
      process.exitCode = 1;
      return;
    }

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
      writeGeneratedFiles([{ path: outputPath, content: result.code }], dirname(outputPath));

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

      const esPlusPkg = esPlusPkgFor(cliTarget);
      const schemaContent = [
        `import type { CrudPageSchema } from '${esPlusPkg}'`,
        ``,
        `export const pageSchema: CrudPageSchema = ${schemaJson}`,
        ``,
      ].join("\n");

      writeGeneratedFiles(
        [
          { path: schemaFile, content: schemaContent },
          { path: wrapperFile, content: result.wrapperCode },
        ],
        outputDir
      );

      console.log(pc.green(`\n✔ 已生成:`));
      console.log(pc.green(`   ${schemaFile}`));
      console.log(pc.green(`   ${wrapperFile}`));
      console.log(pc.dim(result.summary));
    }

    console.log("");
  });
