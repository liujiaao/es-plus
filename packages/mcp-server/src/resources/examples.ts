import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { emitSceneArtifact } from "@es-plus/shared";
import { resolveToolProfile, type ToolProfile } from "../profile.js";
import { SURFACES_EXAMPLES } from "./surfaces-examples.js";

type Target = "vue3" | "vue2" | "antdv";

/**
 * 四个 `esplus://examples*` 资源 —— W6 起重写为**结构化生成器**的产物。
 *
 * 之前这里用 `PRESET_EXAMPLES.map(p => generateCrudPage(p.prompt, target))`，即
 * legacy 正则引擎（关键词匹配 → 拼一页 SFC）。那带来两个问题：
 *   1. 文案失实：资源自称「the same engine the generate_crud_page tool calls」，
 *      而前门 `generate_scene` 早已走结构化生成器；两种产物形状不同，宿主照着
 *      few-shot 学，学到的却是另一条管线。
 *   2. 它是 `generateCrudPage` 的最后一个非测试消费者 —— 不搬走就退役不了引擎。
 *
 * 现在每个示例来自 `SURFACES_EXAMPLES`（与前门同一份 `composeCrudConfig →
 * generateFromConfig` 链路），因此资源里的代码与宿主真正会拿到的产物同形；
 * 无表格的片段类示例不在此资源内（它们由 `esplus://examples/surfaces` 与
 * `generate_scene` 的 scene='form'|'table'|'dialog' 覆盖）。
 */
const COMPOSE_EXAMPLES = SURFACES_EXAMPLES.filter((ex) => ex.route === "compose→generateFromConfig");

/** 每个 target 的内容只生成一次（资源可能被宿主反复读）。 */
const cache = new Map<Target, string>();

function buildContent(target: Target, _profile: ToolProfile = "full"): string {
  const cached = cache.get(target);
  if (cached) return cached;

  const sections = COMPOSE_EXAMPLES.map((ex) => {
    // 走**前门同一条**发射链路（`emitSceneArtifact`），而不是自己调
    // composeCrudConfig/generateFromConfig：示例一旦落后于前门的弹窗映射、
    // 默认值或包名，宿主学到的就是一条已经不存在的管线。
    const result = emitSceneArtifact({ scene: "crud", intent: { ...ex.input, target } } as any);
    if (result.isError || !result.envelope) {
      // 一个坏示例必须在资源里显式可见，而不是静默变成一段空代码块。
      return [`## ${ex.label}`, "", `> ⚠️ example failed to emit: ${result.text.split("\n")[0]}`, ""].join("\n");
    }
    const blocks = [`## ${ex.label}`, "", `**Request:** ${ex.nl}`, ""];
    for (const file of result.envelope.files) {
      const lang = file.language === "typescript" ? "typescript" : file.language === "javascript" ? "javascript" : "vue";
      blocks.push(`**\`${file.path}\`**`, "", "```" + lang, file.code, "```", "");
    }
    return blocks.join("\n");
  });

  const pkg = target === "vue2" ? "@es-plus/vue2" : target === "antdv" ? "@es-plus/adapter-antdv" : "@es-plus/vue3";
  const elementLayer = target === "vue2" ? "Element UI" : target === "antdv" ? "Ant Design Vue" : "Element Plus";

  const text = [
    `# ${pkg} CRUD Page Examples (target=${target})\n`,
    "These examples are produced by the **structured generator** — the same `composeCrudConfig → generateFromConfig` chain the front door's `generate_scene` (scene='crud') uses. Each block is `schema.ts` followed by its wrapper SFC, exactly as `generate_scene` returns them. For the intent shape that produces them, read `esplus://examples/surfaces`.\n",
    `Output target: **${pkg}** + **${elementLayer}**.\n`,
    target === "vue2"
      ? `> Vue 2 wrapper SFCs use \`defineComponent + setup()\` (requires vue@>=2.7) and \`:prop.sync\` v-model syntax. The JSON schema shapes are identical to the vue3 versions; only the wrapper SFC syntax differs.\n`
      : target === "antdv"
      ? `> antdv wrapper SFCs use Vue 3 \`<script setup>\` + \`v-model:prop\` (identical syntax to vue3); only the UI-library symbols differ (\`message\`/\`Modal\`/\`Tag\` from ant-design-vue, \`<a-tag :color>\`). The JSON schema shapes are identical across all targets.\n`
      : `> Vue 3 wrapper SFCs use \`<script setup>\` and \`v-model:prop\`. For the equivalent Vue 2 output, fetch \`esplus://examples/vue2\`.\n`,
    ...sections,
  ].join("\n");

  cache.set(target, text);
  return text;
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
        description: `Structured-generator CRUD page examples (schema + wrapper SFC) with the natural-language request that yields them${descSuffix}`,
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
