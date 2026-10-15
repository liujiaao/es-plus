import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";
import { registerGenerateFromConfig } from "../src/tools/generate-from-config.js";
import { registerGenerateForm } from "../src/tools/generate-form.js";
import { registerGenerateTable } from "../src/tools/generate-table.js";
import { registerGenerateDialog } from "../src/tools/generate-dialog.js";
import { registerScaffoldPage } from "../src/tools/scaffold-page.js";
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

  // ── AI-21①：前门 passthrough 键（tableOptions/formLayout/operationColumn/tableBtns/toolbarBtns）──
  // 复用 generate_crud_from_config 那组「MCP 参数 schema 保留 X」的范式：先证明 MCP 工具的
  // zod 形状**不静默剥**这些键（嵌套 z.object 会剥未声明子键），再证明它们经前门一路存活到生成物。
  it("passthrough 键在 MCP 参数 schema 中原样存活（不被 Zod strip）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const shape = tools.generate_crud.shape;

    const parsed = z.object(shape).parse({
      ...baseCrud,
      surfaces: { table: [field("name", "名称")] },
      tableOptions: { border: false, emptyText: "暂无数据", heightType: "auto", size: "small" },
      formLayout: { labelWidth: "100px", minFoldRows: 2 },
      operationColumn: { label: "操作", width: 160, btns: [{ name: "编辑", actionType: "edit" }] },
      tableBtns: [{ name: "导出", actionType: "export" }],
      toolbarBtns: [{ name: "批量删除", actionType: "delete" }],
    });

    // 五键逐一原样存活（若形状声明为嵌套 z.object，未声明的子键会被吞掉）
    expect(parsed.tableOptions).toEqual({ border: false, emptyText: "暂无数据", heightType: "auto", size: "small" });
    expect(parsed.formLayout).toEqual({ labelWidth: "100px", minFoldRows: 2 });
    expect(parsed.operationColumn).toEqual({ label: "操作", width: 160, btns: [{ name: "编辑", actionType: "edit" }] });
    expect(parsed.tableBtns).toEqual([{ name: "导出", actionType: "export" }]);
    expect(parsed.toolbarBtns).toEqual([{ name: "批量删除", actionType: "delete" }]);
  });

  it("passthrough 键经前门转发、落进生成的 pageSchema", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { table: [field("name", "名称"), statusField] },
      tableOptions: { emptyText: "暂无数据", heightType: "auto" },
      formLayout: { labelWidth: "100px" },
      operationColumn: false,
      toolbarBtns: [{ name: "批量删除", actionType: "delete" }],
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).toContain('"emptyText": "暂无数据"');
    expect(text).toContain('"heightType": "auto"');
    expect(text).toContain('"labelWidth": "100px"');
    // operationColumn:false 是有效取值（隐藏操作列），必须落进 schema 而非被当作「未提供」
    expect(text).toContain('"operationColumn": false');
    expect(text).toContain('"name": "批量删除"');
  });

  it("未提供 passthrough 键时组合配置里不出现这些键（零回归）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { table: [field("name", "名称"), statusField] },
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).not.toContain('"operationColumn"');
    expect(text).not.toContain('"toolbarBtns"');
    expect(text).not.toContain('"formLayout"');
  });

  // AI-21③：入口字段词汇提级 —— isHidden / reactions 此前 SurfaceField 与 zod3 镜像都缺，
  // 前门 Zod（z.object 嵌套）会把它们静默剥掉。这里证明三键在 MCP 参数 schema 中原样存活。
  it("面字段的 isHidden / reactions / labelKey 在 MCP 参数 schema 中原样存活（不被 Zod strip）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const shape = tools.generate_crud.shape;

    const parsed = z.object(shape).parse({
      ...baseCrud,
      surfaces: {
        table: [field("refundNo", "退款单号")],
        form: [
          field("refundType", "退款方式", "Select", { dataOptions: [{ label: "部分退款", value: "part" }] }),
          field("refundReason", "退款原因", "Input", { isHidden: { field: "refundType", op: "ne", value: "part" } }),
          field("city", "城市", "Select", {
            reactions: [
              { dependencies: ["province"], when: { "==": [{ var: "province" }, "zj"] }, fulfill: { dataOptions: [{ label: "杭州", value: "hz" }] } },
            ],
          }),
          field("refundNo", "退款单号", "Input", { labelKey: "refund.no" }),
        ],
      },
    });

    // 逐一原样存活（字段级键若未声明，z.object 会静默剥掉 —— 违反「mark, never drop」）
    expect(parsed.surfaces.form[0].dataOptions).toEqual([{ label: "部分退款", value: "part" }]);
    expect(parsed.surfaces.form[1].isHidden).toEqual({ field: "refundType", op: "ne", value: "part" });
    expect(parsed.surfaces.form[2].reactions[0].dependencies).toEqual(["province"]);
    expect(parsed.surfaces.form[2].reactions[0].fulfill.dataOptions).toEqual([{ label: "杭州", value: "hz" }]);
    expect(parsed.surfaces.form[3].labelKey).toBe("refund.no");
  });

  // AI-21③ 端到端：前门路由里弹窗体 = form 面（dialogBody = hasForm ? form : table），
  // 故 form 面上的 isHidden 必须经 compose → generateFromConfig 落入生成物。
  it("面字段的 isHidden 经前门转发、落进生成的 pageSchema", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        table: [field("refundNo", "退款单号")],
        form: [
          field("refundType", "退款方式", "Select", { dataOptions: [{ label: "部分退款", value: "part" }] }),
          field("refundReason", "退款原因", "Input", { isHidden: { field: "refundType", op: "ne", value: "part" } }),
        ],
        dialog: ["add", "edit"],
      },
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).toContain('"isHidden"');
    expect(text).toContain('"refundType"');
  });

  // AI-21②：顶层声明式键 expandConfig / treeConfig 此前 crudShape / 转发都缺（静默不可达）。
  // 这里证明两键在 MCP 参数 schema 中原样存活。
  it("顶层 expandConfig / treeConfig 在 MCP 参数 schema 中原样存活（不被 Zod strip）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const shape = tools.generate_crud.shape;

    const parsed = z.object(shape).parse({
      ...baseCrud,
      surfaces: { table: [field("name", "名称")] },
      expandConfig: { title: "明细", fields: [{ prop: "remark", label: "备注" }] },
      treeConfig: { childrenField: "subItems", expandAll: true },
    });

    expect(parsed.expandConfig).toEqual({ title: "明细", fields: [{ prop: "remark", label: "备注" }] });
    expect(parsed.treeConfig).toEqual({ childrenField: "subItems", expandAll: true });
  });

  // AI-21② 端到端：两键经前门转发 → compose → generateFromConfig 落进生成物。
  it("顶层 expandConfig / treeConfig 经前门转发、落进生成的 pageSchema", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { table: [field("name", "名称"), field("remark", "备注")] },
      expandConfig: { title: "明细", fields: [{ prop: "remark", label: "备注" }] },
      treeConfig: { expandAll: true },
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).toContain('"expandConfig"');
    expect(text).toContain('"treeConfig"');
    expect(text).toContain('"expandAll": true');
  });

  // AI-23：顶层 mergeConfig（声明式合并单元格）直接进前门（crudShape + 转发），
  // 不在 FRONT_DOOR_UNREACHABLE 登记表里。两问：参数 schema 存活 / 经前门落进生成物。
  it("顶层 mergeConfig 在 MCP 参数 schema 中原样存活（不被 Zod strip）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const shape = tools.generate_crud.shape;

    const parsed = z.object(shape).parse({
      ...baseCrud,
      surfaces: { table: [field("name", "名称")] },
      mergeConfig: { rowsBy: ["dept", "team"] },
    });

    expect(parsed.mergeConfig).toEqual({ rowsBy: ["dept", "team"] });
  });

  it("顶层 mergeConfig 经前门转发、落进生成的 pageSchema", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { table: [field("dept", "部门"), field("team", "小组")] },
      mergeConfig: { rowsBy: ["dept"] },
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).toContain('"mergeConfig"');
    expect(text).toContain('"rowsBy"');
  });

  // AI-21④：surfaces.dialog 由「仅 add|edit|view 罐头键」放宽为「罐头键 | 全参对象」。
  // 三问：对象条目在参数 schema 中原样存活 / 经前门落到 schema.dialogs / 罐头键行为零回归。
  it("surfaces.dialog 的全参对象在 MCP 参数 schema 中原样存活（不被 Zod strip）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const shape = tools.generate_crud.shape;

    const parsed = z.object(shape).parse({
      ...baseCrud,
      surfaces: {
        table: [field("name", "名称")],
        dialog: ["add", { key: "detail", title: "订单详情", width: 720, fullscreen: false }],
      },
    });

    expect(parsed.surfaces.dialog[0]).toBe("add");
    expect(parsed.surfaces.dialog[1]).toEqual({ key: "detail", title: "订单详情", width: 720, fullscreen: false });
  });

  it("surfaces.dialog 的全参对象经前门转发、落进生成的 pageSchema", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        table: [field("name", "名称")],
        form: [field("name", "名称")],
        dialog: ["add", { key: "detail", title: "订单详情", width: 720 }],
      },
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).toContain('"detail"');
    expect(text).toContain('"订单详情"');
    expect(text).toContain('"width": 720');
  });

  it("surfaces.dialog 的罐头键仍走默认标题（零回归）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { table: [field("name", "名称")], form: [field("name", "名称")], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    const text: string = res.content[0].text;
    expect(text).toContain('"新增"');
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

  // AI-16：isHidden 的表达式超集也必须**存活**于 mcp 内联 Zod —— 两份 Zod 同改
  // 才有效；只改 shared 会让走 MCP 路径的表达式被静默剥掉（字段永远可见）。
  it("MCP 参数 schema 保留 isHidden 表达式超集（or / 序关系 / 嵌套）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateFromConfig(server);
    const shape = tools.generate_crud_from_config.shape;

    const expr = {
      or: [{ "==": [{ var: "status" }, "pending"] }, { ">": [{ var: "amount" }, 100] }],
    };
    const parsed = z.object(shape).parse({
      ...validFromConfig,
      fields: [
        field("payType", "支付方式"),
        field("rejectReason", "驳回原因", "Input", { isHidden: expr }),
      ],
    });
    expect(parsed.fields[1].isHidden).toEqual(expr);

    // 旧条件与表达式混成数组（AND）
    const mixed = [{ field: "a", op: "eq", value: 1 }, { ">": [{ var: "b" }, 5] }];
    const parsedMixed = z.object(shape).parse({
      ...validFromConfig,
      fields: [field("note", "说明", "Input", { isHidden: mixed })],
    });
    expect(parsedMixed.fields[0].isHidden).toEqual(mixed);

    // 未知算子必须被拒（闭白名单）
    expect(() =>
      z.object(shape).parse({
        ...validFromConfig,
        fields: [field("x", "X", "Input", { isHidden: { zzz: [] } })],
      })
    ).toThrow();
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

// AI-19: scaffold_page 现在把「SFC + 入口装配样板」一并返回。工具层拼接是唯一落地处
// （generateScaffold 仍是纯 SFC），故在此端到端断言返回 text 同时含两者。
function scaffoldHandler() {
  const { server, tools } = makeMockServer();
  registerScaffoldPage(server);
  expect(tools.scaffold_page).toBeDefined();
  return tools.scaffold_page.handler;
}

describe("scaffold_page — SFC + 入口装配样板", () => {
  it("vue3：同时返回 SFC 与 src/main.ts 装配块", async () => {
    const res = await scaffoldHandler()({
      name: "user-manage",
      features: ["query", "table"],
      target: "vue3",
    });
    const text = res.content[0].text;
    expect(text).toContain("<template>"); // SFC 部分仍在
    expect(text).toContain("</script>");
    expect(text).toContain("src/main.ts"); // 入口块标题
    expect(text).toContain("app.use(ESPlus, {");
    expect(text).toContain("permission:");
    expect(text).toContain("t:");
    expect(text).toContain("httpRequest:");
  });

  it("vue2：入口块标题是 src/main.js，装配用 Vue.use(ESPlus", async () => {
    const res = await scaffoldHandler()({
      name: "user-manage",
      features: ["query", "table"],
      target: "vue2",
    });
    const text = res.content[0].text;
    expect(text).toContain("<template>");
    expect(text).toContain("src/main.js");
    expect(text).toContain("Vue.use(ESPlus, {");
    expect(text).not.toContain("app.use(ESPlus");
    expect(text).toContain("permission:");
    expect(text).toContain("t:");
  });
});
