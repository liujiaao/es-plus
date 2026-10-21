import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

// Detect which es-plus target (vue3 / vue2 / antdv) the user's project should use,
// based on the contents of its package.json. MCP-aware clients (Claude Code,
// Cursor) can read the file from the workspace; the AI then passes the JSON
// content here as a string and gets back a canonical target + reasoning.
//
// We don't try to read files from the server filesystem because the MCP
// server runs as a child process of the IDE — its CWD has nothing to do with
// the user's project. The client is the only thing that knows where the
// user's code is.

export type Target = "vue3" | "vue2" | "antdv";

export interface DetectResult {
  target: Target;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  signals: Record<string, string>;
}

function parseSemverMajor(spec: string | undefined): number | null {
  if (typeof spec !== "string" || !spec) return null;
  // Strip range prefixes (^, ~, >=, etc.) and pre-release suffixes
  const cleaned = spec.replace(/^[\^~>=<]+\s*/, "").trim();
  const match = cleaned.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function detect(pkgJsonText: string): DetectResult {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgJsonText);
    // JSON.parse("null") / "[]" / "42" 返回非对象，后续 .dependencies 会抛 TypeError
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
      return {
        target: "vue3",
        confidence: "low",
        reasoning:
          "package.json content is not a JSON object — falling back to vue3 default.",
        signals: {},
      };
    }
  } catch (err) {
    return {
      target: "vue3",
      confidence: "low",
      reasoning:
        "Could not parse the provided package.json — falling back to vue3 default. " +
        `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      signals: {},
    };
  }

  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
    ...(pkg.peerDependencies as Record<string, string> | undefined),
  };

  const signals: Record<string, string> = {};
  if (deps["@es-plus/vue3"]) signals["@es-plus/vue3"] = deps["@es-plus/vue3"];
  if (deps["@es-plus/vue2"]) signals["@es-plus/vue2"] = deps["@es-plus/vue2"];
  if (deps["@es-plus/adapter-antdv"]) signals["@es-plus/adapter-antdv"] = deps["@es-plus/adapter-antdv"];
  if (deps["es-plus-ui"]) signals["es-plus-ui (legacy → vue3)"] = deps["es-plus-ui"];
  if (deps.vue) signals["vue"] = deps.vue;
  if (deps["element-plus"]) signals["element-plus"] = deps["element-plus"];
  if (deps["element-ui"]) signals["element-ui"] = deps["element-ui"];
  if (deps["ant-design-vue"]) signals["ant-design-vue"] = deps["ant-design-vue"];

  // Tier 1 — explicit es-plus package present is the strongest signal.
  // 但 `@es-plus/adapter-antdv` 要求 **Vue 3** 运行时：一个明确是 Vue 2（`vue@2`）
  // 且装了 `@es-plus/vue2` 的项目里，残留的 antdv 依赖不是新代码的渲染端 ——
  // 否则会把 Vue 2 工程判成 antdv（high），生成的代码整份跑不起来。
  const vueMajor = parseSemverMajor(deps.vue);
  const antdvOverriddenByVue2 = vueMajor === 2 && !!deps["@es-plus/vue2"];
  if (deps["@es-plus/adapter-antdv"] && !antdvOverriddenByVue2) {
    return {
      target: "antdv",
      confidence: "high",
      reasoning: "Project already depends on @es-plus/adapter-antdv (Vue 3 + Ant Design Vue).",
      signals,
    };
  }
  if (deps["@es-plus/vue3"] && !deps["@es-plus/vue2"]) {
    return {
      target: "vue3",
      confidence: "high",
      reasoning: "Project already depends on @es-plus/vue3.",
      signals,
    };
  }
  if (deps["@es-plus/vue2"] && !deps["@es-plus/vue3"]) {
    return {
      target: "vue2",
      confidence: "high",
      reasoning:
        "Project already depends on @es-plus/vue2." +
        (antdvOverriddenByVue2
          ? " @es-plus/adapter-antdv is ignored: it requires a Vue 3 runtime, but this project pins vue@2."
          : ""),
      signals,
    };
  }
  if (deps["@es-plus/vue2"] && deps["@es-plus/vue3"]) {
    return {
      target: "vue3",
      confidence: "low",
      reasoning:
        "Both @es-plus/vue2 and @es-plus/vue3 declared — ambiguous. " +
        "Defaulting to vue3 (the actively developed target). Ask the user which they want for new code.",
      signals,
    };
  }
  if (deps["es-plus-ui"]) {
    return {
      target: "vue3",
      confidence: "high",
      reasoning:
        "Project depends on es-plus-ui — the legacy name for what is now @es-plus/vue3. " +
        "Consider migrating the dep (see /guide/migration).",
      signals,
    };
  }

  // Tier 2 — infer from Vue major version + Element layer.
  const hasElementPlus = !!deps["element-plus"];
  const hasElementUI = !!deps["element-ui"];
  const hasAntdv = !!deps["ant-design-vue"];

  if (vueMajor === 2 || hasElementUI) {
    return {
      target: "vue2",
      confidence: vueMajor === 2 && hasElementUI ? "high" : "medium",
      reasoning:
        `Detected ${vueMajor === 2 ? `vue@${vueMajor}` : ""}${vueMajor === 2 && hasElementUI ? " + " : ""}${hasElementUI ? "element-ui" : ""} — ` +
        "compatible with @es-plus/vue2. No es-plus package is installed yet; suggest adding @es-plus/vue2.",
      signals,
    };
  }
  // Ant Design Vue (Vue 3) → antdv, but only when Element Plus isn't also present.
  if (hasAntdv && !hasElementPlus) {
    return {
      target: "antdv",
      confidence: (vueMajor === 3 || vueMajor === null) ? "high" : "medium",
      reasoning:
        `Detected ${vueMajor === 3 ? `vue@${vueMajor} + ` : ""}ant-design-vue — ` +
        "compatible with @es-plus/adapter-antdv. No es-plus package is installed yet; suggest adding @es-plus/adapter-antdv.",
      signals,
    };
  }
  if (vueMajor === 3 || hasElementPlus) {
    return {
      target: "vue3",
      confidence: vueMajor === 3 && hasElementPlus ? "high" : "medium",
      reasoning:
        `Detected ${vueMajor === 3 ? `vue@${vueMajor}` : ""}${vueMajor === 3 && hasElementPlus ? " + " : ""}${hasElementPlus ? "element-plus" : ""} — ` +
        "compatible with @es-plus/vue3. No es-plus package is installed yet; suggest adding @es-plus/vue3.",
      signals,
    };
  }

  return {
    target: "vue3",
    confidence: "low",
    reasoning:
      "Could not find vue / element-plus / element-ui / @es-plus/* in dependencies — " +
      "falling back to vue3 default. If the project IS Vue 2, explicitly pass target: 'vue2' to other tools.",
    signals,
  };
}

export function registerDetectProjectTarget(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  // AN-26：`front-door` 档下 `generate_crud_page` / `generate_crud_schema` 不注册。
  // 这条工具是「先探目标再生成」链路的第一环，若它点名的是不存在的工具，整条链在
  // 第一步之后就断了（宿主拿到 tool not found，或干脆跳过探目标去默认 vue3）。
  const generators =
    profile === "front-door"
      ? "generate_crud / generate_form / generate_table / generate_dialog / get_component_api"
      : "generate_crud_page / generate_crud_schema / get_component_api";
  server.tool(
    "detect_project_target",
    `Detect which es-plus target (vue3 / vue2 / antdv) matches the user's project, given the project's package.json content. The MCP client (e.g. Claude Code) reads the file from the workspace and passes it here. Use this BEFORE calling ${generators} so you pick the right target instead of defaulting to vue3.`,
    {
      packageJson: z
        .string()
        .describe(
          "Raw string content of the user project's package.json. Read it with your file-read tool (e.g. read_file) and pass the full JSON text here."
        ),
    },
    async ({ packageJson }) => {
      const result = detect(packageJson);
      const summary = [
        `Detected target: ${result.target} (confidence: ${result.confidence})`,
        "",
        `Reasoning: ${result.reasoning}`,
        "",
        "Signals found in dependencies:",
        ...Object.entries(result.signals).map(([k, v]) => `  - ${k}: ${v}`),
        Object.keys(result.signals).length === 0 ? "  (none)" : "",
        "",
        `Next step: pass target='${result.target}' to ${generators} / etc.`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text", text: summary }],
      };
    }
  );
}
