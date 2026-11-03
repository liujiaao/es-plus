import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";
import { registerGenerateScene } from "../src/tools/generate-scene.js";
import { registerGenerateForm } from "../src/tools/generate-form.js";
import { registerGenerateTable } from "../src/tools/generate-table.js";
import { registerGenerateDialog } from "../src/tools/generate-dialog.js";

/**
 * P2 — 场景路由器。
 *
 * 这里钉住「入口 → 同一发射器」的接线；**全语料**的逐字节等价由
 * `scripts/check-scene-parity.mjs` 守着（279 例）。本 spec 只需要证明：
 *   ① `scene:'crud'` 与 `generate_crud` 对同一入参产出同一文本；
 *   ② 三个片段场景与对应旧工具产出同一文本；
 *   ③ 未知键/非法意图在生成前就被拒（不会产出半成品）；
 *   ④ `scene` 缺省为 crud（与注册表 DEFAULT_SCENE 一致）。
 */

type Captured = { shape: any; handler: (args: any) => any };

function capture(register: (server: any) => void, name: string): Captured {
  const tools: Record<string, Captured> = {};
  register({
    tool(n: string, _d: string, shape: any, handler: (args: any) => any) {
      tools[n] = { shape, handler };
    },
  });
  const tool = tools[name];
  if (!tool) throw new Error(`not registered: ${name}`);
  return tool;
}

/** 与 MCP SDK（`_arg-guard` 的 `.passthrough()` 解析）同一道校验。 */
function call(tool: Captured, args: any) {
  return tool.handler(z.object(tool.shape).passthrough().parse(args));
}

const field = (prop: string, label: string, formtype = "Input") => ({ prop, label, formtype });

const crudArgs = {
  name: "UserManage",
  apiUrl: "/api/users",
  target: "vue3",
  mode: "schema",
  surfaces: {
    query: [field("userName", "用户名")],
    table: [field("userName", "用户名"), field("status", "状态", "Select")],
    form: [field("userName", "用户名")],
    dialog: ["add", "edit"],
  },
};

const tableArgs = { fields: [field("userName", "用户名")], apiUrl: "/api/users", target: "vue3" };
const formArgs = { fields: [field("userName", "用户名")], target: "vue3", context: "query", buttons: "query" };
const dialogArgs = { fields: [field("userName", "用户名")], apiUrl: "/api/users", target: "vue3" };

describe("generate_scene — 场景路由器", () => {
  const crud = capture(registerGenerateCrud, "generate_crud");
  const scene = capture(registerGenerateScene, "generate_scene");
  const table = capture(registerGenerateTable, "generate_table");
  const form = capture(registerGenerateForm, "generate_form");
  const dialog = capture(registerGenerateDialog, "generate_dialog");

  it("scene:'crud' 与 generate_crud 逐字节相同", async () => {
    const oldRes = await call(crud, crudArgs);
    const newRes = await call(scene, { scene: "crud", intent: crudArgs });
    expect(oldRes.isError).toBeFalsy();
    expect(newRes.isError).toBeFalsy();
    expect(newRes.content[0].text).toBe(oldRes.content[0].text);
  });

  it.each([
    ["table", tableArgs, table],
    ["form", formArgs, form],
    ["dialog", dialogArgs, dialog],
  ] as const)("scene:'%s' 与对应单面工具逐字节相同", async (sceneId, args, oldTool) => {
    const oldRes = await call(oldTool, args);
    const newRes = await call(scene, { scene: sceneId, intent: args });
    expect(oldRes.isError).toBeFalsy();
    expect(newRes.isError).toBeFalsy();
    expect(newRes.content[0].text).toBe(oldRes.content[0].text);
  });

  it("scene 缺省为 crud（与注册表 DEFAULT_SCENE 一致）", () => {
    const parsed = z.object(scene.shape).passthrough().parse({ intent: crudArgs });
    expect(parsed.scene).toBe("crud");
  });

  it("未知键在生成前被拒，并给 did-you-mean", async () => {
    const res = await scene.handler({ scene: "table", intent: { fields: [field("a", "A")], fieldz: [] } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Unknown argument(s)");
    expect(res.content[0].text).toContain('did you mean "fields"');
  });

  it("非法意图在生成前被拒（结构化错误点名场景）", async () => {
    const res = await scene.handler({ scene: "table", intent: { fields: [] } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('scene "table"');
    expect(res.content[0].text).toContain("nothing was generated");
  });
});
