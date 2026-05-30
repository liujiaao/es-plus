import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Detect which es-plus target (vue3 vs vue2) the user's project should use,
// based on the contents of its package.json. MCP-aware clients (Claude Code,
// Cursor) can read the file from the workspace; the AI then passes the JSON
// content here as a string and gets back a canonical target + reasoning.
//
// We don't try to read files from the server filesystem because the MCP
// server runs as a child process of the IDE — its CWD has nothing to do with
// the user's project. The client is the only thing that knows where the
// user's code is.

export type Target = "vue3" | "vue2";

export interface DetectResult {
  target: Target;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  signals: Record<string, string>;
}

function parseSemverMajor(spec: string | undefined): number | null {
  if (!spec) return null;
  // Strip range prefixes (^, ~, >=, etc.) and pre-release suffixes
  const cleaned = spec.replace(/^[\^~>=<]+\s*/, "").trim();
  const match = cleaned.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function detect(pkgJsonText: string): DetectResult {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgJsonText);
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
  if (deps["es-plus-ui"]) signals["es-plus-ui (legacy → vue3)"] = deps["es-plus-ui"];
  if (deps.vue) signals["vue"] = deps.vue;
  if (deps["element-plus"]) signals["element-plus"] = deps["element-plus"];
  if (deps["element-ui"]) signals["element-ui"] = deps["element-ui"];

  // Tier 1 — explicit es-plus package present is the strongest signal.
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
      reasoning: "Project already depends on @es-plus/vue2.",
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
  const vueMajor = parseSemverMajor(deps.vue);
  const hasElementPlus = !!deps["element-plus"];
  const hasElementUI = !!deps["element-ui"];

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

export function registerDetectProjectTarget(server: McpServer) {
  server.tool(
    "detect_project_target",
    "Detect which es-plus target (vue3 vs vue2) matches the user's project, given the project's package.json content. The MCP client (e.g. Claude Code) reads the file from the workspace and passes it here. Use this BEFORE calling generate_crud_page / generate_crud_schema / get_component_api so you pick the right target instead of defaulting to vue3.",
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
        `Next step: pass target='${result.target}' to generate_crud_page / generate_crud_schema / get_component_api / etc.`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text", text: summary }],
      };
    }
  );
}
