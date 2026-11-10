import { describe, it, expect } from "vitest";
import { FORM_TYPES } from "@es-plus/shared";
import { registerListFormTypes } from "../src/tools/list-form-types.js";
import { registerGenerateCrudSchema } from "../src/tools/generate-crud-schema.js";

// Wave 6: these tools had ZERO test coverage — they were registered MCP
// surfaces with no proof that their handlers route correctly or even run. The
// deterministic generators underneath are golden-covered, but the MCP-facing
// wiring (per-target package name, mode branching, doc output) was unguarded.
//
// W6 (2026-11-10): `generate_crud_page` and its describe block are gone — the
// tool was deleted together with the legacy regex page engine. `generate_crud_schema`
// stays (the offline schema generator still has a documented legacy surface).

type Captured = { desc: string; shape: any; handler: (args: any) => any };

function makeMockServer() {
  const tools: Record<string, Captured> = {};
  const server = {
    tool(name: string, desc: string, shape: any, handler: (args: any) => any) {
      tools[name] = { desc, shape, handler };
    },
  };
  return { server: server as any, tools };
}

const textOf = (res: any): string => res.content.map((c: any) => c.text).join("\n");

/** Pull the `export const pageSchema: CrudPageSchema = {...}` JSON out of an output block. */
function schemaJsonFrom(output: string): any {
  const m = output.match(/export const pageSchema: CrudPageSchema = ([\s\S]*?)\n```/);
  expect(m, "output must contain a CrudPageSchema code block").toBeTruthy();
  return JSON.parse(m![1]);
}

const NL = "用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除";

describe("list_form_types", () => {
  it("注册成无参工具，输出覆盖 shared 的全部 formtype", async () => {
    const { server, tools } = makeMockServer();
    registerListFormTypes(server);
    expect(tools.list_form_types).toBeDefined();
    expect(tools.list_form_types.shape).toEqual({});

    const out = textOf(await tools.list_form_types.handler({}));
    for (const ft of FORM_TYPES) {
      expect(out, `missing formtype ${ft.type}`).toContain(`**${ft.type}**`);
    }
    // 计数与单源一致（FORM_TYPES 增删时，标题会跟着变，防止文案过期）
    expect(out).toContain(`# es-plus Form Types (formtype)`);
    expect(out).toContain('"formtype": "Select"');
  });

  it("描述不再把 formtype 说成 vue3 专属（三端共用同一枚举）", () => {
    const { server, tools } = makeMockServer();
    registerListFormTypes(server);
    const desc = tools.list_form_types.desc;
    expect(desc).toContain(`${FORM_TYPES.length}`);
    expect(desc).not.toContain("in @es-plus/vue3");
    expect(desc).toContain("vue3");
    expect(desc).toContain("vue2");
    expect(desc).toContain("antdv");
  });
});

describe("generate_crud_schema", () => {
  it("默认 vue3：输出 schema + wrapper，import 指向 @es-plus/vue3", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudSchema(server);
    const out = textOf(await tools.generate_crud_schema.handler({ description: NL, target: "vue3" }));
    expect(out).toContain("import type { CrudPageSchema } from '@es-plus/vue3'");
    expect(out).toContain("## Wrapper SFC (Page.vue)");
    expect(schemaJsonFrom(out).tableOptions.apiParams.url).toBeTruthy();
  });

  it("antdv：import 指向适配器包，schema JSON 与 vue3 逐值相同", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudSchema(server);
    const v3 = textOf(await tools.generate_crud_schema.handler({ description: NL, target: "vue3" }));
    const adv = textOf(await tools.generate_crud_schema.handler({ description: NL, target: "antdv" }));
    expect(adv).toContain("from '@es-plus/adapter-antdv'");
    expect(schemaJsonFrom(adv)).toEqual(schemaJsonFrom(v3));
  });

  it("基础 CRUD 有 render 剥离告警、但没有 Notes 段（不吹牛）", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudSchema(server);
    const out = textOf(await tools.generate_crud_schema.handler({ description: NL, target: "vue3" }));
    expect(out).toContain("⚠️ Warnings");
    expect(out).toMatch(/columns\[\]\.render 内联进 JSON schema（status）/);
    // featureHints 为空时不得凭空出现 Notes 段 —— 「识别到但没实现」必须是事实
    expect(out).not.toContain("## Notes (recognized");
  });

  it("多 tab 需求：Notes 段点名该能力", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudSchema(server);
    const multiTab =
      "订单列表，查询订单号、客户姓名、订单状态。每行有\"详情\"按钮，点击打开弹窗，弹窗内三个 tab：订单信息、收货地址、商品列表。";
    const out = textOf(await tools.generate_crud_schema.handler({ description: multiTab, target: "vue3" }));
    expect(out).toContain("## Notes (recognized");
    expect(out).toContain("多 Tab");
  });
});
