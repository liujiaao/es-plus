import { describe, it, expect } from "vitest";
import { z } from "zod";
import { emitScene } from "@es-plus/shared";
import { registerGenerateScene, SCENE_INTENT_SCHEMAS } from "../src/tools/generate-scene.js";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";
import { registerGenerateComposition } from "../src/tools/generate-composition.js";

/**
 * P8 —— 产物信封通过 MCP `structuredContent` 透出。
 *
 * 钉住四件事：
 *   ① 三个生成入口都在返回值里挂 `structuredContent`，内容就是 shared 的信封
 *      （不是工具层另拼的一份）；
 *   ② `content.text` 仍与 `emitScene` 逐字节相同 —— 信封是附加视图，不改入口字节；
 *   ③ 信封可 JSON 往返（MCP 传输层要求纯 JSON 数据）；
 *   ④ 失败分支不挂信封（没有产物就没有身份）。
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

const crudIntent = {
  name: "UserManage",
  apiUrl: "/api/users",
  target: "vue3",
  surfaces: {
    table: [{ prop: "name", label: "姓名", formtype: "Input" }],
    form: [{ prop: "name", label: "姓名", formtype: "Input" }],
    dialog: ["add"],
  },
};

const tableIntent = {
  apiUrl: "/api/logs",
  target: "vue3",
  fields: [{ prop: "ip", label: "IP", formtype: "Input" }],
};

describe("structuredContent — 产物信封", () => {
  const scene = capture(registerGenerateScene, "generate_scene");
  const crud = capture(registerGenerateCrud, "generate_crud");
  const composition = capture(registerGenerateComposition, "generate_composition");

  it("generate_scene(scene='crud')：信封身份正确且文本不变", async () => {
    const res = await scene.handler({ scene: "crud", intent: crudIntent });
    expect(res.isError, res.content[0].text).toBeFalsy();

    const env = res.structuredContent;
    expect(env.contract).toBe("es-plus.artifact@1");
    expect(env.scene).toBe("crud");
    expect(env.artifact).toBe("crud-page");
    expect(env.target).toBe("vue3");
    expect(env.mode).toBe("schema");
    expect(env.files.map((f: any) => f.path)).toContain("Page.vue");
    expect(env.fingerprint).toMatch(/^[0-9a-f]{16}$/);

    // 文本仍是 shared 的同一条路径产出的字节
    const direct = emitScene({
      scene: "crud",
      intent: SCENE_INTENT_SCHEMAS.crud.parse(crudIntent),
    } as any);
    expect(res.content[0].text).toBe(direct.text);

    // MCP 传输要求纯 JSON：往返不丢字段
    expect(JSON.parse(JSON.stringify(res))).toEqual(res);
  });

  it("generate_scene(scene='table')：片段信封的 artifact/file 名正确", async () => {
    const res = await scene.handler({ scene: "table", intent: tableIntent });
    expect(res.isError, res.content[0].text).toBeFalsy();
    const env = res.structuredContent;
    expect(env.contract).toBe("es-plus.artifact@1");
    expect(env.scene).toBe("table");
    expect(env.artifact).toBe("table");
    expect(env.files).toHaveLength(1);
    expect(env.files[0].path).toBe("TableBlock.vue");
    expect(env.files[0].language).toBe("vue");
  });

  it("generate_crud（兼容入口）：同样挂信封，身份与 scene='crud' 一致", async () => {
    const res = await crud.handler(crudIntent);
    expect(res.isError, res.content[0].text).toBeFalsy();
    const env = res.structuredContent;
    expect(env.contract).toBe("es-plus.artifact@1");
    expect(env.scene).toBe("crud");
    expect(env.artifact).toBe("crud-page");
    expect(env.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.parse(JSON.stringify(res))).toEqual(res);
  });

  it("generate_composition：挂组合信封（nodes/wires/faces/page）", async () => {
    const res = await composition.handler({
      name: "用户页",
      target: "vue3",
      nodes: [
        {
          id: "users",
          scene: "table",
          intent: {
            fields: [{ prop: "name", label: "姓名", formtype: "Input" }],
            rowButtons: [{ key: "edit", name: "编辑" }],
            target: "vue3",
          },
        },
        {
          id: "edit",
          scene: "dialog",
          intent: {
            fields: [{ prop: "name", label: "姓名", formtype: "Input" }],
            mode: "component",
            defaultTitle: "编辑用户",
            target: "vue3",
          },
        },
      ],
    });
    expect(res.isError, res.content[0].text).toBeFalsy();
    const env = res.structuredContent;
    expect(env.contract).toBe("es-plus.composition@2");
    expect(env.page.path).toBe("Page.vue");
    expect(env.nodes).toHaveLength(2);
    expect(env.wires.length).toBeGreaterThan(0);
    expect(env.faces.expose).toContain("refresh");
    expect(env.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.parse(JSON.stringify(res))).toEqual(res);
  });

  it("失败分支不挂信封（没有产物就没有身份）", async () => {
    const res = await scene.handler({ scene: "table", intent: {} });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
    expect(res.content[0].text).toContain("failed schema validation");
  });

  it("P9：信封带 capability 台账；未知键仍由前门结构化拒绝", async () => {
    const ok = await scene.handler({ scene: "table", intent: tableIntent });
    expect(ok.isError, ok.content[0].text).toBeFalsy();
    expect(ok.structuredContent.capability.contract).toBe("es-plus.capabilities@1");
    expect(ok.structuredContent.capability.declared).toContainEqual(
      expect.objectContaining({ key: "fields", verdict: "accepted" }),
    );

    // 前门对未知键是结构化拒绝（collectUnknownKeys，先于 capability 判定）——
    // 台账是同一判据的第二道网，服务直接调 emitScene* 的消费者（CLI/eval/自有接线）。
    const wrong = await scene.handler({
      scene: "table",
      intent: { ...tableIntent, columns: [{ prop: "x", label: "X" }] },
    });
    expect(wrong.isError).toBe(true);
    expect(wrong.structuredContent).toBeUndefined();
    expect(wrong.content[0].text).toContain("columns");
  });
});
