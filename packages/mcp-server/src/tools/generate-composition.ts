import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  collectUnknownKeys,
  emitComposition,
  formatUnknownKey,
  type CompositionPlan,
} from "@es-plus/shared";
import { withEnvelope } from "./_artifact-content.js";
import { SCENE_INTENT_SCHEMAS } from "./generate-scene.js";

/**
 * PAGE COMPOSER —— `emitComposition`（`es-plus.composition@2`）的 MCP 入口。
 *
 * ## 为什么需要独立工具，而不是塞进 `generate_scene`
 *
 * `generate_scene` 的 `scene` 轴是「用户要建什么**产物**」，四场景各产一份片段/整页；
 * 组合是**把多份片段装成一张页面**，它没有自己的 artifact，也不与场景互斥
 * （同一张页面里 table + form + dialog 可以同时在）。硬塞进 scene 枚举会让
 * 「scene=composition」与「scene=table」语义不同层，且破坏 SCENE_IDS 的单一真源。
 *
 * ## 路由是确定性的
 *
 * 本工具只做三件事：①每个节点的 intent 用它所属场景的**同一份** Zod 形状校验
 * （不另写一份，漂移会让两个入口对同一 JSON 解析出不同值）；②调 `emitComposition`；
 * ③返回产物文本，并把组合信封挂到 `structuredContent`（节点信封 / 接线 / 对外两面 /
 * 指纹），文本本身不二次加工。
 *
 * 组合节点只能是 table / form / dialog（crud 是整页，不能被二次装配）；每个场景
 * 最多一个节点；vue2 页面的弹窗只能是 `mode:'component'`。这些约束都由
 * `planComposition` 结构化拒绝，错误正文原样透出。
 */
const COMPOSABLE_SCENES = ["table", "form", "dialog"] as const;

const nodeShape = z.object({
  id: z
    .string()
    .describe(
      "Node id in kebab-case (e.g. 'users', 'query-form', 'edit'). It is the output file name (<id>.vue), the template ref source, and — for a dialog node — the row-button key that opens it ('edit' binds the 编辑 button).",
    ),
  scene: z
    .enum(COMPOSABLE_SCENES as unknown as [string, ...string[]])
    .describe("Which standalone fragment this node is. 'crud' is not composable (it is already a full page)."),
  intent: z
    .record(z.string(), z.any())
    .describe(
      "The node's intent table: exactly the generate_table / generate_form / generate_dialog argument object for this scene. For a dialog, `defaultTitle` is the title used by the composed page's open().",
    ),
});

const compositionShape = {
  name: z
    .string()
    .optional()
    .describe("Display name for the composed page (summary only). The component name is always ComposedPage."),
  target: z
    .enum(["vue3", "vue2", "antdv"])
    .optional()
    .describe("Page target. Defaults to the first node's explicit target, then vue3. All nodes must share one target."),
  nodes: z.array(nodeShape).min(1).describe("The page's nodes, at most one per scene (table / form / dialog)."),
} as const;

function nodeError(id: string, lines: string[]): string {
  return [`✗ Node "${id}" failed validation — nothing was generated:`, "", ...lines, "", "Fix it and call the tool again."].join(
    "\n"
  );
}

export function registerGenerateComposition(server: McpServer) {
  server.tool(
    "generate_composition",
    "PAGE COMPOSER — assemble several standalone fragments into ONE working page (Page.vue + one file per node). Give it 1–3 nodes, each `{ id, scene, intent }` where scene is 'table' / 'form' / 'dialog' and intent is exactly that scene's standalone tool argument. The wiring is derived deterministically from the artifact runtime contract: a row button whose key equals a dialog node id opens that dialog (title from the dialog intent's defaultTitle); the query form reloads the table from page 1; the reset button reloads it with cleared filters; submit becomes a page event 'save'; a successful dialog submit refreshes the table. Use this when the user wants these pieces TOGETHER in one page but the request is not a CRUD page (use generate_scene/generate_crud for 'crud'). The page exposes refresh/reload/open and emits row-action/save (+ query/reset/success when there is no table). When the client supports MCP structured output, the composition envelope (nodes/wires/faces/page/fingerprint) is also returned as `structuredContent`; the text content is unchanged.",
    compositionShape,
    async (args: any) => {
      const nodes = Array.isArray(args.nodes) ? args.nodes : [];
      if (nodes.length === 0) {
        return {
          content: [{ type: "text", text: "✗ generate_composition needs at least one node — nothing was generated." }],
          isError: true,
        };
      }

      const parsedNodes: Array<{ id: string; plan: any }> = [];
      for (const node of nodes) {
        const id = String(node?.id ?? "");
        const scene = node?.scene;
        // 先按**可组合场景**判，再取该场景的校验器：`SCENE_INTENT_SCHEMAS` 含 crud，
        // 若直接查表，crud 节点会落到整页意图表校验上，给出「缺 apiUrl/surfaces」这类
        // 误导性错误，而不是「crud 不能被二次装配」。
        if (!COMPOSABLE_SCENES.includes(scene)) {
          return {
            content: [
              {
                type: "text",
                text: nodeError(id, [
                  `  - scene: must be one of 'table' / 'form' / 'dialog' (got ${JSON.stringify(node?.scene)}).`,
                  "  - 'crud' nodes are full pages and cannot be assembled into another page.",
                ]),
              },
            ],
            isError: true,
          };
        }
        const schema = SCENE_INTENT_SCHEMAS[scene as "table" | "form" | "dialog"];
        const intent = node?.intent ?? {};
        const unknown = collectUnknownKeys(schema, intent);
        if (unknown.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: nodeError(id, [
                  "  - unknown key(s) for this scene (zod would silently strip them):",
                  ...unknown.map((f) => `      ${formatUnknownKey(f)}`),
                ]),
              },
            ],
            isError: true,
          };
        }
        const parsed = schema.safeParse(intent);
        if (!parsed.success) {
          return {
            content: [
              {
                type: "text",
                text: nodeError(
                  id,
                  parsed.error.issues.map(
                    (i) => `  - ${i.path.length ? "/" + i.path.join("/") : "(root)"}: ${i.message}`
                  )
                ),
              },
            ],
            isError: true,
          };
        }
        parsedNodes.push({ id, plan: { scene: node.scene, intent: parsed.data } });
      }

      const plan = {
        ...(args.name !== undefined ? { name: String(args.name) } : {}),
        ...(args.target !== undefined ? { target: args.target } : {}),
        nodes: parsedNodes,
      } as CompositionPlan;
      const result = emitComposition(plan);
      return withEnvelope(result.text, result.envelope, result.isError);
    }
  );
}
