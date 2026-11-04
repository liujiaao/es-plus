import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  collectUnknownKeys,
  emitComposition,
  formatUnknownKey,
  type CompositionPlan,
} from "@es-plus/shared";
import { registerArtifactTool, withEnvelope } from "./_artifact-content.js";
import { SCENE_INTENT_SCHEMAS } from "./generate-scene.js";

/**
 * PAGE COMPOSER —— `emitComposition`（`es-plus.composition@3`）的 MCP 入口。
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
 * 组合节点只能是 table / form / dialog（crud 是整页，不能被二次装配）；form 最多一个
 * （多表单的 submit 语义无法确定性区分），table / dialog 可以多个；vue2 页面的弹窗只能
 * 是 `mode:'component'`。这些约束都由 `planComposition` 结构化拒绝，错误正文原样透出。
 *
 * `behavior` / `role` / `wires` 在此只是**透传**：语义、默认值与校验全在
 * `planComposition` 一处实现，工具面不复制一份规则（否则两个入口对同一份计划会
 * 给出不同结果）。
 */
const COMPOSABLE_SCENES = ["table", "form", "dialog"] as const;

const nodeShape = z.object({
  id: z
    .string()
    .describe(
      "Node id in kebab-case (e.g. 'users', 'query-form', 'edit'). It is the output file name (<id>.vue), the template ref source, and — for a dialog node — the row-button key that opens it ('edit' binds the 编辑 button).",
    ),
  role: z
    .string()
    .optional()
    .describe(
      "Optional role label (kebab-case, unique per scene). `master` marks the table that form query/reset and dialog success default to in a multi-table page. Which row button loads a detail table is a product decision — express it in `wires`, not as a role.",
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

/**
 * 接线形状。子对象一律 `.passthrough()`：未知键 / `{node, page}` 混用必须**原样到达**
 * `planComposition`，由那唯一一处规则给出带节点名的结构化错误。若这里用 zod 默认的
 * strip，`to: { node, channel, page: 'emit', event }` 会在入口被悄悄削成节点目标 ——
 * 工具面与直接 API 对同一份计划给出不同结果（P11 复核）。
 */
const wireShape = z.object({
  from: z
    .object({
      node: z.string().describe("Source node id."),
      channel: z
        .string()
        .describe("Source channel declared by ARTIFACT_RUNTIME: row-action / submit / query / reset / onSuccess."),
    })
    .passthrough(),
  to: z.union([
    z
      .object({
        node: z.string().describe("Target node id."),
        channel: z
          .string()
          .describe(
            "Target channel the composed page can CALL (ARTIFACT_RUNTIME.invokable): table refresh/reload, form validate/resetFields, component-dialog open/close. `model` is data, not a method. A composable dialog (mode 'composable') has no template ref — only a row-action may open it. `open` requires a row, so it is only accepted from a row-action source.",
          ),
        model: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Row → reload params mapping, only for a row-action source targeting `reload`. Values are single-level row fields written as '$row.<field>' (e.g. { departmentId: '$row.departmentId' } → reload({ departmentId: row.departmentId })). Omit to pass the whole row (reload(row)).",
          ),
      })
      .passthrough(),
    z
      .object({
        page: z.literal("emit"),
        event: z.string().describe("Page event name to emit (becomes part of the page's emits face)."),
      })
      .passthrough(),
  ]),
  when: z
    .object({ rowAction: z.string() })
    .passthrough()
    .optional()
    .describe(
      "Required for row-action sources: the button key this wire applies to. It must match a rowButtons key declared in the source table's intent — an undeclared key would generate a branch that never fires.",
    ),
}).passthrough();

const compositionShape = {
  name: z
    .string()
    .optional()
    .describe("Display name for the composed page (summary only). The component name is always ComposedPage."),
  target: z
    .enum(["vue3", "vue2", "antdv"])
    .optional()
    .describe("Page target. Defaults to the first node's explicit target, then vue3. All nodes must share one target."),
  behavior: z
    .enum(["data-wiring", "ui-only"])
    .optional()
    .describe(
      "Data-wiring mode (default 'data-wiring'). 'data-wiring' derives query/reset → default table reload and dialog onSuccess → default table refresh; it does NOT generate HTTP requests (fragment intents carry no apiUrl/actions) — use scene 'crud' for built-in add/edit/delete requests. 'ui-only' wires only the UI (row button → dialog open) and turns query/reset/success into page events so the host performs requests itself. Explicit wires apply in both modes.",
    ),
  nodes: z
    .array(nodeShape)
    .min(1)
    .describe(
      "The page's nodes: at most one 'form'; 'table' and 'dialog' may repeat (master-detail, multi-dialog). A row button whose key equals a dialog node id opens that dialog.",
    ),
  wires: z
    .array(wireShape)
    .optional()
    .describe(
      "Explicit wiring, validated against the same runtime contract as derived wiring. An explicit wire overrides the derived wire for the same source (node + channel + rowAction key). Row-action targets receive the clicked row by default (e.g. master row → detail table reload(row)); set `to.model` to pass only chosen fields (e.g. { departmentId: '$row.departmentId' }) instead of the whole row.",
    ),
} as const;

function nodeError(id: string, lines: string[]): string {
  return [`✗ Node "${id}" failed validation — nothing was generated:`, "", ...lines, "", "Fix it and call the tool again."].join(
    "\n"
  );
}

export function registerGenerateComposition(server: McpServer) {
  registerArtifactTool(
    server,
    "generate_composition",
    "PAGE COMPOSER — assemble several standalone fragments into ONE working page (Page.vue + one file per node). Give it 1+ nodes, each `{ id, role?, scene, intent }` where scene is 'table' / 'form' / 'dialog' (at most one form; tables and dialogs may repeat) and intent is exactly that scene's standalone tool argument. The wiring is derived deterministically from the artifact runtime contract: a row button whose key equals a dialog node id opens that dialog (title from the dialog intent's defaultTitle); the query form reloads the default table from page 1; reset reloads it with cleared filters; submit becomes a page event 'save'; a successful dialog submit refreshes the default table. The default table is the node with role 'master', else the only table; in a multi-table page with neither, data channels become page events instead of guessing (and the artifact/envelope warnings name the upgrade and both remedies: `<id>Refresh`/`<id>Reload`, or declare role 'master'). Pass `wires` to declare master-detail style links yourself (e.g. master row-action key 'view' → detail table reload, where the row is passed as the model; use to.model to pass only chosen row fields); an explicit wire overrides the derived one for the same source. Wire targets must be callable by the generated page: table refresh/reload, form validate/resetFields, component-dialog open/close; `open` is only reachable from a row-action (it carries the row), and a row-action key must match a declared rowButtons key. `behavior: 'ui-only'` wires only the UI (row button → dialog open) and turns query/reset/success into page events so the host performs its own requests; the default `data-wiring` only derives table reload/refresh (no HTTP requests — use scene 'crud' for built-in add/edit/delete). Use this when the user wants these pieces TOGETHER in one page but the request is not a CRUD page (use generate_scene/generate_crud for 'crud'). The page exposes refresh/reload/open and emits row-action/save (+ query/reset/success when there is no default table or behavior is ui-only). When the client supports MCP structured output, the composition envelope (nodes/wires/faces/page/fingerprint) is also returned as `structuredContent`; the text content is unchanged.",
    compositionShape,
    async (args: any) => {
      const nodes = Array.isArray(args.nodes) ? args.nodes : [];
      if (nodes.length === 0) {
        return {
          content: [{ type: "text", text: "✗ generate_composition needs at least one node — nothing was generated." }],
          isError: true,
        };
      }

      const parsedNodes: Array<{ id: string; role?: string; plan: any }> = [];
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
        parsedNodes.push({
          id,
          ...(node.role !== undefined ? { role: String(node.role) } : {}),
          plan: { scene: node.scene, intent: parsed.data },
        });
      }

      const plan = {
        ...(args.name !== undefined ? { name: String(args.name) } : {}),
        ...(args.target !== undefined ? { target: args.target } : {}),
        ...(args.behavior !== undefined ? { behavior: args.behavior } : {}),
        ...(Array.isArray(args.wires) ? { wires: args.wires } : {}),
        nodes: parsedNodes,
      } as CompositionPlan;
      const result = emitComposition(plan);
      return withEnvelope(result.text, result.envelope, result.isError);
    }
  );
}
