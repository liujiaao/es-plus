import { Command } from "commander";
import pc from "picocolors";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { INGEST_KINDS, buildIngestDraft, type SchemaKind } from "@es-plus/shared";
import { confirmOverwrite, writeGeneratedFiles } from "../utils/fs.js";

/**
 * `es-plus ingest` —— 从既有 schema 确定性地草拟一份 StructuredCrudConfig。
 *
 * 与 MCP `ingest_schema` 共用 `@es-plus/shared` 的 `buildIngestDraft`：同一份占位符、
 * 同一组告警，不另写一份。
 *
 * **stdout 只放草稿 JSON**，所有人类可读的话（告警、下一步提示）走 stderr ——
 * 这样 `es-plus ingest api.json > config.json` 与 `-o` 两种用法产出完全相同的字节，
 * 而管道里不会混进 `✔ 已生成` 之类的装饰。摄取只定「类型 → formtype」这条轴，
 * 查询面取舍、按钮、弹窗仍须人补 —— 草稿不是成品。
 */

/** 参数校验：--kind 只接受受支持值（拼错时明确报错，不静默回落）。 */
export function isIngestKind(v: string): v is SchemaKind {
  return (INGEST_KINDS as readonly string[]).includes(v);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * 推断输入形态（未显式 --kind 时）。
 *
 * 先看扩展名（.sql / .ts 这类强信号不会被内容嗅探推翻），再看 JSON 顶层特征。
 * 返回 `reason` 是为了让 CLI 能说出来「我按什么把它当成 openapi」—— 猜错时用户
 * 一眼能看出该补 --kind，而不是对着「抽取到 0 个字段」猜。
 *
 * 注意：`.yaml/.yml` 判成 openapi 是**有意为之**（OpenAPI 最常见的载体就是 YAML），
 * 而本版摄取层不支持 YAML —— `ingestSchema` 会给出「请转成 JSON」的解析告警。
 * 静默当成 sample-json 只会得到更远的误判。
 */
export function detectIngestKind(
  filePath: string,
  text: string
): { kind: SchemaKind; reason: string } {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".sql") return { kind: "sql-ddl", reason: "扩展名 .sql" };
  if (ext === ".ts" || ext === ".tsx") return { kind: "ts-interface", reason: "扩展名 .ts/.tsx" };
  if (ext === ".yaml" || ext === ".yml") {
    return {
      kind: "openapi",
      reason: "扩展名 .yaml/.yml（OpenAPI 常见形态；本版不解析 YAML，会给出告警）",
    };
  }

  const doc = tryParseJson(text);
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    const obj = doc as Record<string, unknown>;
    if ("openapi" in obj || "swagger" in obj) {
      return { kind: "openapi", reason: "JSON 顶层有 openapi/swagger 字段" };
    }
    if ("$schema" in obj) return { kind: "jsonSchema", reason: "JSON 顶层有 $schema 字段" };
    // 样例数据是「字段 → 值」，JSON Schema 是「字段 → 类型声明」；`type:"object"` + `properties`
    // 只出现在后者。单看 `properties` 会误判业务对象里恰好叫 properties 的字段。
    if (obj.type === "object" && ("properties" in obj || "definitions" in obj || "$defs" in obj)) {
      return { kind: "jsonSchema", reason: 'JSON 顶层是 type:"object" + properties' };
    }
    return { kind: "sample-json", reason: "顶层是普通 JSON 对象，按样例数据推断" };
  }

  // 无扩展名线索且不是 JSON：内容像 DDL 才认，否则交给 sample-json 由摄取层报解析错。
  if (/\bcreate\s+table\b/i.test(text)) {
    return { kind: "sql-ddl", reason: "内容含 CREATE TABLE" };
  }
  return { kind: "sample-json", reason: "无法判定形态，按样例 JSON 处理（用 -k 显式指定更稳）" };
}

export const ingestCommand = createIngestCommand();

/**
 * 工厂而非常量单例的**理由**：commander 的 `Command` 会把 `--kind` / `-o` 等选项值存在
 * 自己身上，同一个实例反复 `parseAsync` 时**上一次的选项会留到下一次**（未传即沿用旧值）。
 * 进程里只 parse 一次时这没有影响（`index.ts`），但单测必须每次拿到干净实例 ——
 * 否则「YAML 用例」会带着上一个用例的 `--kind OpenAPI` 跑，测出来的红与代码无关。
 */
export function createIngestCommand(): Command {
    return new Command("ingest")
    .argument("<file>", "schema source: OpenAPI JSON / JSON Schema / sample JSON / .ts interface / .sql DDL")
    .option("-k, --kind <kind>", `schema kind (default: inferred): ${INGEST_KINDS.join(", ")}`)
    .option("-n, --name <name>", "page name override (PascalCase)")
    .option("-a, --api-url <url>", "REST base URL override, e.g. /api/users")
    .option("-o, --output <path>", "write the draft JSON to a file instead of stdout")
    .option("--force", "overwrite existing output file without prompting")
    .description("Draft a StructuredCrudConfig from an existing schema (deterministic, no LLM)")
    .action(
      async (
        file: string,
        options: { kind?: string; name?: string; apiUrl?: string; output?: string; force?: boolean }
      ) => {
        const filePath = resolve(process.cwd(), file);
        if (!existsSync(filePath)) {
          console.error(pc.red(`✗ 文件不存在: ${filePath}`));
          process.exitCode = 1;
          return;
        }

        let text: string;
        try {
          text = readFileSync(filePath, "utf-8");
        } catch (e) {
          console.error(pc.red(`✗ 读取失败: ${e instanceof Error ? e.message : String(e)}`));
          process.exitCode = 1;
          return;
        }

        let kind: SchemaKind;
        if (options.kind !== undefined) {
          if (!isIngestKind(options.kind)) {
            console.error(
              pc.red(`✗ 未知 kind: ${options.kind}（可选: ${INGEST_KINDS.join(", ")}）`)
            );
            process.exitCode = 1;
            return;
          }
          kind = options.kind;
        } else {
          const detected = detectIngestKind(filePath, text);
          kind = detected.kind;
          console.error(pc.dim(`· 按${detected.reason}推断为 ${kind}`));
        }

        const { config, warnings } = buildIngestDraft({
          text,
          kind,
          name: options.name,
          apiUrl: options.apiUrl,
        });

        if (!config) {
          console.error(pc.red("✗ 无法从该 schema 草拟配置："));
          for (const w of warnings) console.error(pc.red(`  - ${w}`));
          console.error(pc.dim(`\n可用 kind: ${INGEST_KINDS.join(", ")}`));
          process.exitCode = 1;
          return;
        }

        if (warnings.length > 0) {
          console.error(pc.yellow("⚠ 告警（非阻断 —— 逐条核对，占位值务必替换）:"));
          for (const w of warnings) console.error(pc.yellow(`  - ${w}`));
        }

        const json = JSON.stringify(config, null, 2) + "\n";

        if (options.output) {
          const outPath = resolve(process.cwd(), options.output);
          if (!(await confirmOverwrite([outPath], !!options.force))) return;
          try {
            writeGeneratedFiles([{ path: outPath, content: json }], dirname(outPath));
          } catch (err) {
            console.error(pc.red(`✗ 写入失败: ${err instanceof Error ? err.message : String(err)}`));
            process.exitCode = 1;
            return;
          }
          console.error(pc.green(`✔ 已生成草稿: ${outPath}（${config.fields.length} 个字段）`));
        } else {
          // stdout 只有 JSON，故这里用 console.log 而非 console.error。
          console.log(json.replace(/\n$/, ""));
        }

        console.error(
          pc.dim(
            "  下一步：审阅草稿（收窄查询字段、补按钮/弹窗/权限），再交给 generateFromConfig 构建页面。"
          )
        );
      }
    );
}
