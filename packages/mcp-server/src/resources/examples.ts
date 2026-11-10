import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PRESET_EXAMPLES, generateCrudPage } from "@es-plus/shared";
import { resolveToolProfile, type ToolProfile } from "../profile.js";

type Target = "vue3" | "vue2" | "antdv";

function buildContent(target: Target, profile: ToolProfile = "full"): string {
  const sections = PRESET_EXAMPLES.map((ex) => {
    const result = generateCrudPage(ex.prompt, target);
    return [
      `## ${ex.label}`,
      `**Prompt:** ${ex.prompt}`,
      "",
      "```vue",
      result.code,
      "```",
      "",
    ].join("\n");
  });

  const pkg = target === "vue2" ? "@es-plus/vue2" : target === "antdv" ? "@es-plus/adapter-antdv" : "@es-plus/vue3";
  const elementLayer = target === "vue2" ? "Element UI" : target === "antdv" ? "Ant Design Vue" : "Element Plus";

  // AN-26：这批 few-shot 的产物来自 legacy regex 引擎（PRESET_EXAMPLES → generateCrudPage）。
  // 前门 `generate_scene`（scene='crud'）走的是 shared 的 structured generator，**不是**
  // 这个引擎 —— 此处只能说「运行时形状参考」，不能声称是前门所用的同一引擎。
  const engineNote =
    profile === "front-door"
      ? `These SFCs come from the legacy regex engine (no LLM) and are kept as runtime-shape references only. The front door \`generate_scene\` (scene='crud') composes through the structured generator, not this engine — fetch \`esplus://examples/surfaces\` for the current intent shapes.\n`
      : `These examples are generated from natural language descriptions using the @es-plus/shared CRUD engine — the same engine the \`generate_crud_page\` tool calls.\n`;

  return [
    `# ${pkg} CRUD Page Examples (target=${target})\n`,
    engineNote,
    `Output target: **${pkg}** + **${elementLayer}**.\n`,
    target === "vue2"
      ? `> Vue 2 SFCs use \`defineComponent + setup()\` (requires vue@>=2.7) and \`:prop.sync\` v-model syntax. The JSON config shapes are identical to the vue3 versions; only the wrapper SFC syntax differs.\n`
      : target === "antdv"
      ? `> antdv SFCs use Vue 3 \`<script setup>\` + \`v-model:prop\` (identical syntax to vue3); only the UI-library symbols differ (\`message\`/\`Modal\`/\`Tag\` from ant-design-vue, \`<a-tag :color>\`). The JSON config shapes are identical across all targets.\n`
      : `> Vue 3 SFCs use \`<script setup>\` and \`v-model:prop\`. For the equivalent Vue 2 output, fetch \`esplus://examples/vue2\`.\n`,
    ...sections,
  ].join("\n");
}

export function registerExamplesResource(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://examples", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://examples/vue3", target: "vue3", descSuffix: " — @es-plus/vue3 explicit" },
    { uri: "esplus://examples/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 (defineComponent + setup + .sync)" },
    { uri: "esplus://examples/antdv", target: "antdv", descSuffix: " — @es-plus/adapter-antdv (Vue 3 syntax + Ant Design Vue)" },
  ];

  for (const { uri, target, descSuffix } of targets) {
    server.resource(
      uri === "esplus://examples" ? "examples" : `examples-${target}`,
      uri,
      {
        description: `Pre-built CRUD page examples with prompts and generated code${descSuffix}`,
        mimeType: "text/plain",
      },
      async () => ({
        contents: [
          { uri, mimeType: "text/plain", text: buildContent(target, profile) },
        ],
      })
    );
  }
}
