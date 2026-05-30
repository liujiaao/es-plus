import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PRESET_EXAMPLES, generateCrudPage } from "@es-plus/shared";

type Target = "vue3" | "vue2";

function buildContent(target: Target): string {
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

  const pkg = target === "vue2" ? "@es-plus/vue2" : "@es-plus/vue3";
  const elementLayer = target === "vue2" ? "Element UI" : "Element Plus";

  return [
    `# ${pkg} CRUD Page Examples (target=${target})\n`,
    `These examples are generated from natural language descriptions using the @es-plus/shared CRUD engine — the same engine the \`generate_crud_page\` tool calls.\n`,
    `Output target: **${pkg}** + **${elementLayer}**.\n`,
    target === "vue2"
      ? `> Vue 2 SFCs use \`defineComponent + setup()\` (requires vue@>=2.7) and \`:prop.sync\` v-model syntax. The JSON config shapes are identical to the vue3 versions; only the wrapper SFC syntax differs.\n`
      : `> Vue 3 SFCs use \`<script setup>\` and \`v-model:prop\`. For the equivalent Vue 2 output, fetch \`esplus://examples/vue2\`.\n`,
    ...sections,
  ].join("\n");
}

export function registerExamplesResource(server: McpServer) {
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://examples", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://examples/vue3", target: "vue3", descSuffix: " — @es-plus/vue3 explicit" },
    { uri: "esplus://examples/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 (defineComponent + setup + .sync)" },
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
          { uri, mimeType: "text/plain", text: buildContent(target) },
        ],
      })
    );
  }
}
