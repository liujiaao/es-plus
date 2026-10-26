import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateCrudPage, generateCrudSchema, generateFromConfig, PRESET_EXAMPLES, repairConfig, validateAndRepair } from '@es-plus/shared';
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
  .option("-o, --output <path>", "output path — a FILE for --mode sfc, a DIRECTORY for --mode schema (defaults: src/views/<PascalName>.vue / src/views/<name>/)")
  .option("-d, --description <desc>", "skip interactive prompt, use this description directly")
  .option("-m, --mode <mode>", "output mode: schema (default) or sfc")
  .option("-c, --from-config <path>", "generate from a structured JSON config file (production mode)")
  .option("--ai", "use an LLM (Anthropic) to reason NL→config; auto-enabled when ANTHROPIC_API_KEY is set. Use --no-ai to force the built-in generator")
  .option("--no-ai", "force the built-in (regex) generator even when ANTHROPIC_API_KEY is set")
  .option("-t, --target <target>", "target framework: vue3 (default, @es-plus/vue3 + Element Plus), vue2 (@es-plus/vue2 + Element UI), or antdv (@es-plus/adapter-antdv + Ant Design Vue)")
  .option("-f, --force", "overwrite existing output files without prompting")
  .option(
    "--emit-config <path>",
    "AI path only: also write the model-produced StructuredCrudConfig to <path> (the replay input — `generateFromConfig(config)` reproduces the emitted schema byte-for-byte)"
  )
  .description("Generate a CRUD page from natural language description or structured config")
  .action(async (name: string | undefined, options: { output?: string; description?: string; mode?: string; fromConfig?: string; target?: string; ai?: boolean; force?: boolean; emitConfig?: string }) => {
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

      // 与 MCP 前门同一条前门（C2·A3 + AN-24）：先跑确定性修复环（别名 / 搬迁 / null /
      // 成员布尔 / 弹窗简写），再用权威 schema 判定。此前这里直接 `safeParse`，比 MCP 少两步，
      // 后果都是**静默的**：
      //   ① 修复环能救的写法（`dialogs: ["add"]`、`"false"` 布尔、null 占位）在 CLI 被判死，
      //      同一个配置文件走 MCP 能生成、走 CLI 报错；
      //   ② `safeParse().data` 已把未知键剥掉，于是 `generateFromConfig` 里那条「这些键不在
      //      配置 schema 里，生成时会被忽略」的告警**永远看不到**它们 —— 拼错的键（rowKey）
      //      在 CLI 路径是纯静默：产物里没有它，也没有任何提示。
      const prepared = repairConfig(parsed);
      const repaired = prepared.config as any;
      const validation = validateAndRepair(repaired);
      if (!validation.valid) {
        console.log(pc.red("Config validation failed:"));
        for (const err of validation.errors) console.log(pc.red(`  ${err}`));
        if (validation.suggestions.length > 0) {
          console.log(pc.yellow("Suggestions:"));
          for (const s of validation.suggestions) console.log(pc.yellow(`  → ${s}`));
        }
        process.exitCode = 1;
        return;
      }

      const config = repaired;
      // 修复/归一记录必须在这里打：生成器内部的 repairConfig 收到的是**已修复**的配置，
      // 第二轮不会再产生记录 —— 若留给 `generateFromConfig` 的 warnings，CLI 路径就是静默改写。
      if (prepared.renames.length > 0 || prepared.repairs.length > 0) {
        console.log(pc.yellow("\n⚠️ 配置已自动归一/修复（生成前）："));
        for (const r of prepared.renames) console.log(pc.yellow(`  - 自动归一：${r.from} → ${r.to}（${r.note}）`));
        for (const r of prepared.repairs) console.log(pc.yellow(`  - 自动修复：${r.path}（${r.note}）`));
      }
      // 目标框架优先级：配置文件显式 target > CLI --target > 默认 vue3
      // 修复环**不补** schema 默认值，故 `config.target` 就是文件里写的内容；但仍用原始
      // parsed.target 判「显式性」，让这条规则不依赖修复环的实现细节。
      // 仅当配置未显式给出 target 时才回落到 CLI --target（cliTarget 已含 vue3 兜底）。
      if (parsed == null || (parsed as any).target === undefined) {
        config.target = cliTarget;
      }
      const pageName = name || toKebabCase(config.name);

      // README 契约：`--from-config` 与 `--ai` 都默认 TypeScript。`--ai` 路径经
      // StructuredCrudConfigSchema 解析吃到 `typescript: true` 默认值；本路径只做校验、
      // 不 parse（避免其他 `.default()` 改写配置语义），必须在此补同一条默认 —— 否则
      // 同一份配置换条 CLI 路径就产出不同语言（修前这里是 undefined → JS）。
      if ((config as any).typescript === undefined) (config as any).typescript = true;

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
      let aiConfig: any;
      let attempts = 0;
      try {
        // 不先问 `aiAvailable()` 再决定是否进入：那个「探测 + 分支」正是静默降级的来源
        // （key 已设置但 SDK 未安装时探测返回 false，而 --ai 未显式给定时整段跳过、不留
        // 任何提示 —— 用户以为用了 AI，实际拿到的是正则生成器）。直接调用，让
        // `AiUnavailableError` 带着**确切原因**走同一条可见的降级提示。
        console.log(pc.cyan(`\n🤖 正在用 LLM 推理配置 (NL→config)...`));
        const out = await nlToConfig(description!, {
          // 只在用户真的传了标志时下发：否则把决定权留给模型对 NL 的解读。
          target: explicitTarget ? cliTarget : undefined,
          mode: explicitMode ? mode : undefined,
        });
        aiConfig = out.config;
        attempts = out.attempts;
      } catch (err: any) {
        const unavailable = err instanceof AiUnavailableError;
        const detail = unavailable ? err.message : (err?.message || String(err));
        console.log(
          pc.yellow(`\n⚠️ ${unavailable ? 'AI 路径不可用' : 'LLM 路径失败'}，降级到内置生成器：${detail}`)
        );
      }
      // 生成/落盘**不放进**上面的 try：它失败时降级到正则生成器会用同一路径覆盖产物，
      // 且以 0 退出 —— 用户拿到「名为 AI 生成、实为正则」的页面却没有任何错误信号。
      if (aiConfig) {
        // 日志必须报告**实际**目标/模式：模型可以按 NL 选它们，打印 CLI 默认值会撒谎。
        console.log(pc.dim(`   LLM 生成配置成功（${attempts} 次尝试，target=${aiConfig.target}, mode=${aiConfig.mode}）→ 走确定性生成器`));
        // 证明链的第一块砖（docs/internal/ai-showcase-matrix-plan.md §3 G5）：
        // 此前模型产出的配置生成完就被丢弃，站点的 JSON 无法机械证明「= 那次模型输出的
        // 确定性编译结果」。`--emit-config` 把**生成器实际收到的**这份配置原样落盘，
        // 于是「产物 = generateFromConfig(冻结配置)」可以对任意一份产物重放验证。
        if (options.emitConfig) {
          const configPath = resolve(process.cwd(), options.emitConfig);
          if (!(await confirmOverwrite([configPath], !!options.force))) return;
          writeGeneratedFiles(
            [{ path: configPath, content: `${JSON.stringify(aiConfig, null, 2)}\n` }],
            dirname(configPath)
          );
          console.log(pc.green(`✔ 已落盘模型配置（重放凭据）: ${configPath}`));
        }
        try {
          await emitFromStructuredConfig(aiConfig, name, options.output, !!options.force);
        } catch (err: any) {
          console.log(pc.red(`✗ 生成/写盘失败：${err?.message || String(err)}`));
          process.exitCode = 1;
        }
        return;
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
