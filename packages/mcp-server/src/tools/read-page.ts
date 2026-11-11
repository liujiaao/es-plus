import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configToSurfaces, readCompositionSource, readPageSource } from "@es-plus/shared";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

// 回读层(W4)对 MCP 的暴露:从**上一轮生成物**里把出处(`__esPlusSource`)解压回配置。
//
// 为什么必须有一个「读」的工具:
//   上一轮产物落到宿主磁盘后,下一轮「再加一个手机号列」时宿主手里只有源码。若让模型
//   从 pageSchema 反推配置,`formItems` 已按 formtype 展开、可见性被压成「在不在数组里」、
//   schema 模式根本没有 permissions —— 反推出来的配置看起来像真的,却把猜测固化成下一轮
//   生成的输入。生成器把自己的输入原样带进产物,这里只做解压,不做推理。
//
// 两种 profile 都注册:front-door 没有 generate_crud_from_config,而「回读 → 改 → 再生成」
// 正是那一档最需要的闭环。为此除 `config` 外还返回机械投影出的 `surfaces`(可直接喂
// `generate_scene` scene='crud'),并把投影本身的损失写进 `surfacesLossy[]`。

export interface BuildReadPageResultInput {
  /** schema.ts / Page.vue / 裸 pageSchema JSON 的全文。 */
  code: string;
  /** 报错信息里用来指代这份输入的名字(文件名)。 */
  label?: string;
}

export interface BuildReadPageResultResult {
  ok: boolean;
  /** `page` = 整页出处；`composition` = 组合出处（独立契约，不投影 surfaces）。 */
  kind?: "page" | "composition";
  /** ok=false 时的正文。 */
  error?: string;
  hint?: string;
  /** 以下仅在 ok=true 时出现。 */
  contract?: string;
  target?: string;
  mode?: string;
  config?: Record<string, unknown>;
  lossy?: unknown[];
  intent?: Record<string, unknown>;
  surfacesLossy?: unknown[];
  /** 组合产物专用：生成器当时收到的整份 plan（直接回灌 `generate_composition`）。 */
  compositionPlan?: Record<string, unknown>;
}

/**
 * 纯函数:读出处 + 投影 surfaces。独立导出以便单测(与 buildRefineResult 同一范式)。
 *
 * 先认**组合**出处：组合产物里也有 `<script>`，若先走页面读取，会在 pageSchema 上
 * 报「找不到页面出处标记」—— 那不是真话（它带着一份完整 plan），会误导宿主重新发明。
 */
export function buildReadPageResult(input: BuildReadPageResultInput): BuildReadPageResultResult {
  const composed = readCompositionSource(input.code);
  if (composed.kind === "error") {
    return { ok: false, error: composed.error, hint: composed.hint };
  }
  if (composed.kind === "ok") {
    return {
      ok: true,
      kind: "composition",
      contract: composed.source.contract,
      compositionPlan: composed.source.plan,
    };
  }

  const read = readPageSource(input.code, input.label ?? "page");
  if (!read.ok) {
    return { ok: false, error: read.error, hint: read.hint };
  }
  const source = read.source;
  const projected = configToSurfaces(source.config);
  return {
    ok: true,
    kind: "page",
    contract: source.contract,
    target: source.target,
    mode: source.mode,
    config: source.config,
    lossy: source.lossy,
    intent: projected.intent,
    surfacesLossy: projected.lossy,
  };
}

export function registerReadPage(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  server.tool(
    "read_page",
    "Recover the generator input from a page es-plus produced. Pages carry their own provenance (`__esPlusSource` inside pageSchema, or a `// __esPlusSource:` comment in sfc mode), so this unzips the recorded input instead of re-inferring a config from the rendered output. It is NOT a claim that artifact and input are identical: every place they differ (dropped unknown keys, keys the mode ignores, non-JSON values, deterministic repairs) is listed in `lossy[]`. Pass the full source of `schema.ts` / `Page.vue` / a bare pageSchema JSON. Returns `config` (exactly what the generator was given, after normalization), `lossy[]`, and `intent` (a mechanical `surfaces` projection you can pass straight to `generate_scene` scene='crud', plus `surfacesLossy[]` for anything the projection itself cannot express, e.g. explicit `columns`). Edit the returned config for the next round, then regenerate. Pages generated before this feature (or hand-written ones) have no provenance: this tool errors with a hint instead of guessing. Composition pages (`generate_composition`) carry a different contract (`// __esPlusCompositionSource:`): for those this returns `kind:'composition'` and the full `plan` to replay verbatim — it does NOT project them to `surfaces`, because role/wire details would be lost.",
    {
      code: z
        .string()
        .min(1)
        .describe("Full source text of the generated page: schema.ts, Page.vue (sfc mode), or a bare pageSchema JSON."),
      label: z
        .string()
        .optional()
        .describe("Name used in error messages (e.g. the file name). Defaults to \"page\"."),
    },
    async ({ code, label }) => {
      const result = buildReadPageResult({ code, label });
      if (!result.ok) {
        return {
          content: [{ type: "text", text: `${result.error}\n${result.hint ?? ""}`.trim() }],
          isError: true,
        };
      }

      const out: string[] = [];
      if (result.kind === "composition") {
        out.push(`✓ 读回组合出处（${result.contract}）。`);
        out.push("");
        out.push("这是一张 `generate_composition` 产出的组合页：它的输入不是一份 CRUD 配置，");
        out.push("而是下面这份 plan（节点 intent + 接线）。它**不能**投影成 `surfaces` ——");
        out.push("`role` / `wires.model` / `when` 都表达不了，硬投影会得到一张不同的页面。");
        out.push("");
        out.push("要修改：改这份 plan，然后原样传给 `generate_composition`（重放逐字节相同）。");
        out.push("");
        out.push("```json");
        out.push(JSON.stringify(result.compositionPlan, null, 2));
        out.push("```");
        return { content: [{ type: "text", text: out.join("\n") }] };
      }

      out.push(
        `✓ 读回出处（${result.contract}）：target=${result.target}，mode=${result.mode}，` +
          `${Object.keys(result.config ?? {}).length} 个顶层键。`,
      );
      if (result.lossy && result.lossy.length) {
        out.push("");
        out.push(`⚠️ 输入与产物不一致 ${result.lossy.length} 处（lossy[]，逐条已核对）:`);
        for (const entry of result.lossy as Array<{ path: string; kind: string; detail: string }>) {
          out.push(`  - [${entry.kind}] ${entry.path} — ${entry.detail}`);
        }
      } else {
        out.push("✓ 逐键无损：输入与产物一致。");
      }
      out.push("");
      out.push("config（生成器当时的输入，可直接改）:");
      out.push("```json");
      out.push(JSON.stringify(result.config, null, 2));
      out.push("```");
      if (result.surfacesLossy && result.surfacesLossy.length) {
        out.push("");
        out.push(
          profile === "front-door"
            ? "⚠️ surfaces 投影丢掉了以下键。本档没有能直收完整 config 的生成入口（`generate_crud_from_config` 未注册）：这些键在 front-door 下无法保留，需要用 full 档或宿主直接调用库生成:"
            : "⚠️ surfaces 投影丢掉了以下键（要保留它们就用上面的 config 走 `generate_crud_from_config`）:",
        );
        for (const entry of result.surfacesLossy as Array<{ path: string; detail: string }>) {
          out.push(`  - ${entry.path} — ${entry.detail}`);
        }
      }
      out.push("");
      out.push("intent（机械投影，可直接传给 generate_scene scene='crud'）:");
      out.push("```json");
      out.push(JSON.stringify(result.intent, null, 2));
      out.push("```");

      return { content: [{ type: "text", text: out.join("\n") }] };
    },
  );
}
