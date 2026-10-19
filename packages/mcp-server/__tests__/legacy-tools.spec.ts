import { describe, it, expect } from "vitest";
import { FORM_TYPES } from "@es-plus/shared";
import { registerListFormTypes } from "../src/tools/list-form-types.js";
import { registerGenerateCrudPage } from "../src/tools/generate-crud-page.js";
import { registerGenerateCrudSchema } from "../src/tools/generate-crud-schema.js";

// Wave 6: these three tools had ZERO test coverage — they were registered MCP
// surfaces with no proof that their handlers route correctly or even run. The
// deterministic generators underneath are golden-covered, but the MCP-facing
// wiring (per-target package name, mode branching, doc output) was unguarded.
//
// "delete or cover" — we cover: they are referenced from the server
// instructions and the conventions resource, so removing them would be a
// surface change, not a cleanup.

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

describe("generate_crud_page", () => {
  it("schema 模式：输出 CrudPageSchema 段 + Wrapper SFC，且 schema 可解析", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudPage(server);
    const out = textOf(await tools.generate_crud_page.handler({ description: NL, mode: "schema", target: "vue3" }));

    expect(out).toContain("## CrudPageSchema (schema.ts)");
    expect(out).toContain("import type { CrudPageSchema } from '@es-plus/vue3'");
    expect(out).toContain("## Wrapper SFC (Page.vue)");
    const schema = schemaJsonFrom(out);
    // The NL parser falls back to a placeholder URL when it cannot infer one; the
    // contract worth pinning is that the fetch config lands under tableOptions.
    expect(schema.tableOptions.apiParams.url).toBeTruthy();
    expect(Array.isArray(schema.columns)).toBe(true);
  });

  it("目标决定 import 包名（vue2 / antdv），schema 本身与目标无关", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudPage(server);

    const v3 = textOf(await tools.generate_crud_page.handler({ description: NL, mode: "schema", target: "vue3" }));
    const v2 = textOf(await tools.generate_crud_page.handler({ description: NL, mode: "schema", target: "vue2" }));
    const adv = textOf(await tools.generate_crud_page.handler({ description: NL, mode: "schema", target: "antdv" }));

    expect(v2).toContain("from '@es-plus/vue2'");
    expect(adv).toContain("from '@es-plus/adapter-antdv'");
    // schema 是宿主 LLM 交给 <es-crud-page> 的同一份 JSON —— 换端不该改它
    expect(schemaJsonFrom(v2)).toEqual(schemaJsonFrom(v3));
    expect(schemaJsonFrom(adv)).toEqual(schemaJsonFrom(v3));
  });

  it("sfc 模式：不走 schema 包装段，直接产出 SFC", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudPage(server);
    const out = textOf(await tools.generate_crud_page.handler({ description: NL, mode: "sfc", target: "vue3" }));
    expect(out).not.toContain("## CrudPageSchema (schema.ts)");
    expect(out).toContain("<template>");
    expect(out).toContain("</template>");
  });

  it("vue2 SFC 不发 :data-source.sync（F7：组件从不 emit update:dataSource）", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrudPage(server);
    const out = textOf(await tools.generate_crud_page.handler({ description: NL, mode: "sfc", target: "vue2" }));
    expect(out).toContain(":data-source=");
    expect(out).not.toContain(":data-source.sync");
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
});
