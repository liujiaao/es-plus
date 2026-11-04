import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  collectUnknownKeys,
  emitScene,
  formatUnknownKey,
  isScene,
  DEFAULT_SCENE,
  SCENE_IDS,
  type SceneId,
  type ScenePlan,
} from "@es-plus/shared";
import { crudShape } from "./generate-crud.js";
import { tableShape } from "./generate-table.js";
import { formShape } from "./generate-form.js";
import { dialogShape } from "./generate-dialog.js";

/**
 * SCENE ROUTER —— 按「场景」而不是按「入口」定义的第一入口（FRONT DOOR）。
 *
 * 与 `generate_crud` 的分工（P2 起并存，标签口径在 P7 收敛）：
 *   - `generate_scene` 收 `{ scene, intent }`：`scene` 是用户要建什么，
 *     `intent` 是该场景的意图表。路由是**确定性**的（见 shared `emitScene`）。
 *   - `generate_crud` 是**兼容入口（adapter）**：参数形状就是 `scene:'crud'` 的
 *     意图表；两者调用**同一个** `emitScene`，故产物逐字节相同。它不再是标签
 *     意义上的前门 —— registry 的 canonical entry 才是唯一真源。
 *   - 片段场景复用 `generate_table` / `generate_form` / `generate_dialog` 的形状，
 *     同样落到同一发射器；不是第二份生成逻辑。
 *   - 多个片段要装进**同一张页面**时用 `generate_composition`（P6b），不是本工具。
 *
 * 为什么需要外层 `intent` 而不是把所有键平铺：四个场景的 `mode` / `tableOptions`
 * 语义不同（CRUD 的 mode = schema/sfc；dialog 的 mode = composable/component），
 * 平铺会造出一个「哪个键属于哪个场景」隐式规则。分开后，每个场景的校验器就是它
 * 自己工具的那一份，未知键也能按场景给 did-you-mean。
 */
const sceneShape = {
  scene: z
    .enum([...SCENE_IDS] as [SceneId, ...SceneId[]])
    .default(DEFAULT_SCENE)
    .describe(
      "Which artifact the user wants: 'crud' (a full page with a table — the composite case), 'table' (one standalone es-table), 'form' (one standalone es-form), 'dialog' (one reusable add/edit dialog). Pick by WHAT is being built, not by which tool name you remember.",
    ),
  intent: z
    .record(z.string(), z.any())
    .describe(
      "The scene's intent table. scene='crud': the same keys as the generate_crud compat entry (name/apiUrl/surfaces/…). scene='table'|'form'|'dialog': the same keys as generate_table/generate_form/generate_dialog (fields/…). Fill only the keys for the chosen scene; unknown keys are rejected with a did-you-mean.",
    ),
} as const;

/**
 * 每个场景的意图校验器 = 对应旧工具的**同一份** Zod 形状。
 *
 * 刻意不另写一份：形状漂移会让 `generate_scene` 与旧工具对同一 JSON 解析出不同值，
 * 字节等价的验收随即失效（`scripts/check-scene-parity.mjs` 会红）。
 */
export const SCENE_INTENT_SCHEMAS: Record<SceneId, z.ZodTypeAny> = {
  crud: z.object(crudShape).passthrough(),
  table: z.object(tableShape).passthrough(),
  form: z.object(formShape).passthrough(),
  dialog: z.object(dialogShape).passthrough(),
};

function unknownKeysError(unknown: ReturnType<typeof collectUnknownKeys>): string {
  return [
    "✗ Unknown argument(s) for generate_scene — nothing was generated.",
    "",
    ...unknown.map((f) => `  - ${formatUnknownKey(f)}`),
    "",
    "The offending key(s) were NOT used (zod would otherwise have stripped them silently).",
    "Fix the spelling/placement (or the `scene` you selected) and call the tool again.",
  ].join("\n");
}

function invalidIntentError(scene: SceneId, issues: z.ZodIssue[]): string {
  return [
    `✗ intent failed schema validation for scene "${scene}" — nothing was generated:`,
    "",
    ...issues.map((i) => `  - ${i.path.length ? "/" + i.path.join("/") : "(root)"}: ${i.message}`),
    "",
    "Fix these and call the tool again.",
  ].join("\n");
}

export function registerGenerateScene(server: McpServer) {
  server.tool(
    "generate_scene",
    "FRONT DOOR — SCENE ROUTER: the scene-first way to generate es-plus code. Call with `scene` = what the user is building ('crud' page / standalone 'table' / standalone 'form' / 'dialog') and `intent` = that scene's intent table. For scene='crud' the intent is exactly the generate_crud argument object (name, apiUrl, surfaces — your one reasoning step is still filling `surfaces`); for the fragment scenes it is exactly the generate_table / generate_form / generate_dialog argument object. Routing and emission are deterministic, and the output is byte-identical to the corresponding legacy tool. Use generate_composition when several of these pieces must live TOGETHER in one page; `generate_crud` remains available as the compatibility entry for a plain list/table page and produces the same bytes as scene='crud'.",
    sceneShape,
    async (args: any) => {
      const scene: SceneId = isScene(args.scene) ? args.scene : DEFAULT_SCENE;
      const schema = SCENE_INTENT_SCHEMAS[scene];
      const intent = args.intent ?? {};

      // 未知键在 zod strip 之前点名（与 `_arg-guard` 同一判据、同一文案形态）。
      // 外层 `intent` 是 record（键不可枚举），故这里按**所选场景**的 schema 判，
      // 不会把「另一个场景的合法键」误报成未知键。
      const unknown = collectUnknownKeys(schema, intent);
      if (unknown.length > 0) {
        return { content: [{ type: "text", text: unknownKeysError(unknown) }], isError: true };
      }

      const parsed = schema.safeParse(intent);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: invalidIntentError(scene, parsed.error.issues) }],
          isError: true,
        };
      }

      const result = emitScene({ scene, intent: parsed.data } as ScenePlan);
      return result.isError
        ? { content: [{ type: "text", text: result.text }], isError: true }
        : { content: [{ type: "text", text: result.text }] };
    }
  );
}
