import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";
import { registerGenerateFromConfig } from "../src/tools/generate-from-config.js";
import { registerGenerateForm } from "../src/tools/generate-form.js";
import { registerGenerateTable } from "../src/tools/generate-table.js";
import { registerGenerateDialog } from "../src/tools/generate-dialog.js";
import { registerPrompts } from "../src/prompts/index.js";

// These exercise the deterministic generate_* front door / fragment tools and
// the two MCP prompts end-to-end: capture each register call on a mock server,
// then invoke the real handler. Pure functions underneath are golden-covered;
// here we prove the MCP-facing routing/branching (surfaces → compose vs
// fragments, per-target prompt text) is wired and does not throw.

type Captured = { desc: string; shape: any; handler: (args: any) => any };

function makeMockServer() {
  const tools: Record<string, Captured> = {};
  const prompts: Record<string, Captured> = {};
  const server = {
    tool(name: string, desc: string, shape: any, handler: (args: any) => any) {
      tools[name] = { desc, shape, handler };
    },
    prompt(name: string, desc: string, shape: any, handler: (args: any) => any) {
      prompts[name] = { desc, shape, handler };
    },
  };
  return { server: server as any, tools, prompts };
}

const field = (prop: string, label: string, formtype = "Input", extra: any = {}) => ({
  prop,
  label,
  formtype,
  ...extra,
});

const statusField = field("status", "状态", "Select", {
  dataOptions: [
    { label: "启用", value: 1 },
    { label: "禁用", value: 0 },
  ],
});

function crudHandler() {
  const { server, tools } = makeMockServer();
  registerGenerateCrud(server);
  expect(tools.generate_crud).toBeDefined();
  return tools.generate_crud.handler;
}

const baseCrud = {
  name: "UserManage",
  apiUrl: "/api/users",
  target: "vue3",
  mode: "schema",
  typescript: true,
  i18n: false,
};

describe("generate_crud front door — surface routing", () => {
  it("errors when surfaces is empty", async () => {
    const res = await crudHandler()({ ...baseCrud, surfaces: {} });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("`surfaces` is empty");
  });

  it("table-bearing request routes through the golden generator (schema mode)", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        query: [field("name", "名称")],
        table: [field("name", "名称"), statusField],
        form: [field("name", "名称")],
        dialog: ["add", "edit"],
      },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Schema (schema.ts)");
    expect(res.content[0].text).toContain("## Wrapper SFC (Page.vue)");
  });

  it("table-bearing request in sfc mode emits a single SFC", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      mode: "sfc",
      surfaces: { table: [field("name", "名称"), statusField], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Generated SFC");
  });

  it("query-only (no table) emits a standalone query fragment", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { query: [field("keyword", "关键词")] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("standalone fragment");
    expect(res.content[0].text).toContain("## Query form (QueryForm.vue)");
  });

  it("form + dialog (no table) emits a dialog composable", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("Dialog composable (useFormDialog)");
  });

  it("form-only (no table, no dialog) emits a standalone submit form", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Form (FormBlock.vue)");
  });
});

describe("standalone fragment tools", () => {
  it("generate_form emits a .vue fragment", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateForm(server);
    expect(tools.generate_form).toBeDefined();
    const res = await tools.generate_form.handler({
      fields: [field("name", "名称"), statusField],
      target: "vue3",
      typescript: true,
      i18n: false,
      context: "form",
      buttons: "submit",
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```vue");
  });

  it("generate_table emits a .vue fragment", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateTable(server);
    expect(tools.generate_table).toBeDefined();
    const res = await tools.generate_table.handler({
      fields: [field("name", "名称"), statusField],
      apiUrl: "/api/users",
      target: "vue3",
      typescript: true,
      i18n: false,
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```vue");
  });

  it("generate_dialog emits a .tsx composable", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateDialog(server);
    expect(tools.generate_dialog).toBeDefined();
    const res = await tools.generate_dialog.handler({
      fields: [field("name", "名称")],
      apiUrl: "/api/users",
      target: "vue3",
      typescript: true,
      i18n: false,
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```tsx");
  });
});

describe("front door — deterministic validate gate (C2·A3)", () => {
  function fromConfigHandler() {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    expect(tools.generate_crud_from_config).toBeDefined();
    return tools.generate_crud_from_config.handler;
  }

  const validFromConfig = {
    name: "UserManage",
    apiUrl: "/api/users",
    fields: [field("userName", "用户名")],
    actions: ["add", "edit"],
  };

  it("illegal config is rejected at the front door — nothing generated, structured errors returned", async () => {
    const res = await fromConfigHandler()({
      ...validFromConfig,
      fields: [field("u", "U", "Nope")], // formtype not in the schema enum
    });
    expect(res.isError).toBe(true);
    const text = res.content[0].text;
    expect(text).toContain("nothing was generated");
    expect(text).toContain("/fields/0/formtype");
    expect(text).toContain("Valid values for /fields/0/formtype");
    // the deterministic gate must NOT have emitted any code
    expect(text).not.toContain("```");
    // and NOT the old flattened throw string
    expect(text).not.toContain("Error generating code:");
  });

  it("valid config still generates (gate does not break the happy path)", async () => {
    const res = await fromConfigHandler()(validFromConfig);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```");
  });

  // AI-06：MCP 参数 schema（configShape）必须声明 isHidden —— 否则 Zod 默认 strip，
  // 走 MCP 路径的配置里声明式显隐条件会被**静默剥掉**（字段永远可见）。这里通过
  // z.object(shape) 真解析一遍，把「源码里有没有声明」升级为「解析后还在不在」。
  it("MCP 参数 schema 保留字段级 isHidden（单条件 + 数组 AND + op 缺省）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    const shape = tools.generate_crud_from_config.shape;

    const parsed = z.object(shape).parse({
      ...validFromConfig,
      fields: [
        field("payType", "支付方式"),
        field("cashRemark", "现金备注", "Input", {
          isHidden: { field: "payType", op: "eq", value: "cash" },
        }),
      ],
    });
    expect(parsed.fields[1].isHidden).toEqual({ field: "payType", op: "eq", value: "cash" });

    const parsedAnd = z.object(shape).parse({
      ...validFromConfig,
      fields: [
        field("note", "说明", "Input", {
          isHidden: [{ field: "a", op: "eq", value: 1 }, { field: "b", op: "truthy" }],
        }),
      ],
    });
    expect(parsedAnd.fields[0].isHidden).toEqual([
      { field: "a", op: "eq", value: 1 },
      { field: "b", op: "truthy" },
    ]);

    // op 缺省 → 填 'eq'
    const parsedDefault = z.object(shape).parse({
      ...validFromConfig,
      fields: [field("remark", "备注", "Input", { isHidden: { field: "payType" } })],
    });
    expect(parsedDefault.fields[0].isHidden).toEqual({ field: "payType", op: "eq" });
  });

  it("MCP 参数 schema 保留显式 columns（含递归 groups 与非字段列）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    const shape = tools.generate_crud_from_config.shape;

    const parsed = z.object(shape).parse({
      ...validFromConfig,
      columns: [
        { type: "selection" },
        { prop: "name", label: "姓名" },
        { label: "联系方式", groups: [{ prop: "phone", label: "手机号" }] },
      ],
    });
    // 整个数组必须存活（Zod 未知键 strip 会把它整段吞掉）
    expect(parsed.columns).toHaveLength(3);
    expect(parsed.columns![0]).toEqual({ type: "selection" });
    expect(parsed.columns![2]).toEqual({ label: "联系方式", groups: [{ prop: "phone", label: "手机号" }] });
  });

  it("MCP 参数 schema 保留顶层 expandConfig（声明式行展开内容）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    const shape = tools.generate_crud_from_config.shape;

    const parsed = z.object(shape).parse({
      ...validFromConfig,
      expandConfig: {
        title: "收货信息",
        fields: [
          { prop: "receiver", label: "收货人" },
          { prop: "phone", labelKey: "field.phone" },
        ],
      },
    });
    // 整个对象必须存活（Zod 未知键 strip 会把它整段吞掉）
    expect(parsed.expandConfig?.title).toBe("收货信息");
    expect(parsed.expandConfig?.fields).toHaveLength(2);
    expect(parsed.expandConfig?.fields[1]).toEqual({ prop: "phone", labelKey: "field.phone" });
  });

  it("MCP 参数 schema 保留顶层 treeConfig（声明式树表）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    const shape = tools.generate_crud_from_config.shape;

    const parsed = z.object(shape).parse({
      ...validFromConfig,
      treeConfig: { childrenField: "subItems", expandAll: true },
    });
    // 整个对象必须存活（Zod 未知键 strip 会把它整段吞掉）
    expect(parsed.treeConfig).toEqual({ childrenField: "subItems", expandAll: true });
  });

  it("MCP 参数 schema 保留 tableOptions.editConfig + 列 editRender（vxe 行内编辑）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    const shape = tools.generate_crud_from_config.shape;

    const parsed = z.object(shape).parse({
      ...validFromConfig,
      tableOptions: { engine: "vxe", editConfig: { trigger: "click", mode: "cell" } },
      columns: [{ prop: "name", label: "姓名", editRender: { name: "$input" } }],
    });
    // 两处都必须存活（Zod 未知键 strip 会分别吞掉 editConfig 与列级 editRender）
    expect(parsed.tableOptions?.editConfig).toEqual({ trigger: "click", mode: "cell" });
    expect(parsed.columns?.[0]?.editRender).toEqual({ name: "$input" });
  });
});

describe("prompts — registration + per-target rendering", () => {
  function promptHandlers() {
    const { server, prompts } = makeMockServer();
    registerPrompts(server);
    expect(prompts["crud-page"]).toBeDefined();
    expect(prompts["form-config"]).toBeDefined();
    return prompts;
  }

  it("crud-page renders target-specific notes for every target", async () => {
    const prompts = promptHandlers();
    const markers: Record<string, string> = {
      vue3: "Element Plus",
      vue2: "Element UI",
      antdv: "Ant Design Vue",
    };
    for (const [target, marker] of Object.entries(markers)) {
      const res = await prompts["crud-page"].handler({
        description: "用户管理页",
        target,
        mode: "schema",
      });
      const text = res.messages[0].content.text;
      expect(text).toContain(marker);
      expect(text).toContain("CrudPageSchema JSON");
    }
  });

  it("crud-page sfc mode switches the output instruction", async () => {
    const prompts = promptHandlers();
    const res = await prompts["crud-page"].handler({
      description: "用户管理页",
      target: "vue3",
      mode: "sfc",
    });
    expect(res.messages[0].content.text).toContain("complete Vue SFC");
  });

  it("crud-page defaults to vue3 when target is omitted", async () => {
    const prompts = promptHandlers();
    const res = await prompts["crud-page"].handler({
      description: "用户管理页",
      mode: "schema",
    });
    expect(res.messages[0].content.text).toContain("@es-plus/vue3");
  });

  it("form-config renders per-target UI-library notes", async () => {
    const prompts = promptHandlers();
    const markers: Record<string, string> = {
      vue3: "Element Plus",
      vue2: "Element UI",
      antdv: "Ant Design Vue",
    };
    for (const [target, marker] of Object.entries(markers)) {
      const res = await prompts["form-config"].handler({ description: "一个表单", target });
      expect(res.messages[0].content.text).toContain(marker);
    }
  });

  it("form-config defaults to vue3 when target is omitted", async () => {
    const prompts = promptHandlers();
    const res = await prompts["form-config"].handler({ description: "一个表单" });
    expect(res.messages[0].content.text).toContain("@es-plus/vue3");
  });
});
