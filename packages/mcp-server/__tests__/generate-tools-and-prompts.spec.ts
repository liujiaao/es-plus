import { describe, it, expect } from "vitest";
import { z } from "zod";
import { StructuredCrudConfigSchema, generateAppEntry } from "@es-plus/shared";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";
import { registerGenerateFromConfig } from "../src/tools/generate-from-config.js";
import { registerGenerateForm } from "../src/tools/generate-form.js";
import { registerGenerateTable } from "../src/tools/generate-table.js";
import { registerGenerateDialog } from "../src/tools/generate-dialog.js";
import { registerScaffoldPage } from "../src/tools/scaffold-page.js";
import { registerDoctorPage } from "../src/tools/doctor-page.js";
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
    // AN-15：前置清单随产物输出（与 generate_crud_from_config 同一份 formatPreflight）
    expect(res.content[0].text).toContain("## Preflight — host prerequisites");
    expect(res.content[0].text).toContain("**[required]** **UI library — Element Plus");
    expect(res.content[0].text).toContain("**[required]** **Global httpRequest**");
  });

  it("table-bearing request in sfc mode emits a single SFC", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      mode: "sfc",
      surfaces: { table: [field("name", "名称"), statusField], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Generated SFC");
    // sfc + dialog ⟹ 弹窗 render 是 JSX，前置清单必须点出 JSX 转换
    expect(res.content[0].text).toContain("**[required]** **JSX transform");
  });

  it("query-only (no table) emits a standalone query fragment", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { query: [field("keyword", "关键词")] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("standalone fragment");
    expect(res.content[0].text).toContain("## Query form (QueryForm.vue)");
    // AN-15：无表片段同样带前置清单（与整页共用 buildPreflight）——
    // 此前这条支只给代码，宿主要配哪些全局项只能靠猜。
    expect(res.content[0].text).toContain("## Preflight — host prerequisites");
  });

  it("no-table 的 formLayout 必须透传给查询表单（Wave 4：修前顶层 formLayout 被静默丢弃）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { query: [field("keyword", "关键词")] },
      formLayout: { labelWidth: "110px", minFoldRows: 2 },
    });
    expect(res.isError).toBeFalsy();
    // 若前门只收不传，这段产物里不会出现 layoutFormProps（生成器只在给了 formLayout 时才发）。
    expect(res.content[0].text).toContain('const layoutFormProps = { formLayProps: {"labelWidth":"110px","minFoldRows":2} }');
    expect(res.content[0].text).toContain(':layout-form-props="layoutFormProps"');
  });

  it("form + dialog (no table) emits a dialog composable", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    // 名字由 key 派生（AI-36）：多弹窗不得共用 useFormDialog。
    expect(res.content[0].text).toContain("Dialog composable (useAddDialog)");
    // 罐头键的标题落到 open() 的缺省参数，而不是只写在说明文字里。
    expect(res.content[0].text).toContain("function open(title: string = '新增'");
  });

  it("no-table 全参 dialog：formItems / title / width / fullscreen 逐条落地（AI-36）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        dialog: [
          {
            key: "detail",
            title: "订单编辑",
            width: 720,
            fullscreen: false,
            formItems: [field("orderNo", "订单号"), field("customer", "客户")],
          },
        ],
      },
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    // 逐弹窗字段表优先于共用的 form/query 面（这里两者都为空，仍须发射这两列）。
    expect(text).toContain('"prop": "orderNo"');
    expect(text).toContain('"prop": "customer"');
    // 标题 → open() 缺省参数；宽度/全屏 → 弹窗选项。
    expect(text).toContain("function open(title: string = '订单编辑'");
    expect(text).toContain("width: 720");
    expect(text).toContain("fullscreen: false");
    // key 派生名字，且不再出现共用的 useFormDialog。
    expect(text).toContain("Dialog composable (useDetailDialog)");
    expect(text).not.toContain("export function useFormDialog(");
  });

  it("no-table 多弹窗：每个 entry 各发一段、名字互不覆盖（AI-36）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        form: [field("name", "名称")],
        dialog: ["add", { key: "detail", title: "详情", formItems: [field("orderNo", "订单号")] }],
      },
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain("Dialog composable (useAddDialog)");
    expect(text).toContain("Dialog composable (useDetailDialog)");
    expect(text.match(/^## Dialog composable/gm)?.length).toBe(2);
    // 共用体（form 面）进 add；detail 用自己那列。
    expect(text).toContain('"prop": "orderNo"');
  });

  it("no-table 弹窗零字段：显式告警而不是静默发空壳（AI-36）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("surfaces.dialog['add'] 没有任何可发射的字段");
  });

  it("no-table 自定义标题会改变提交方法/只读判别时，显式告警（AI-36）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        form: [field("name", "名称")],
        dialog: [{ key: "add", title: "新建用户" }, { key: "view", title: "详情" }],
      },
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain("该弹窗将以 PUT 提交");
    expect(text).toContain("只读形态按标题 '查看' 判别");
  });

  it("no-table dialog 支显式指路零-JSX 的 mode='component'（AI-28 能力缺口不得静默）", async () => {
    // 前门的 dialog 词汇是 `surfaces.dialog`，刻意不再开一条 `mode` 轴（见 generate-crud.ts
    // 的说明）。所以「不依赖 JSX 插件的自包含弹窗」这条能力，前门唯一的传达方式就是产物里
    // 这句指路 —— 它一旦被删，能力缺口就变回静默。此断言即该句的守卫。
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")], dialog: ["add"] },
    });
    const text = res.content[0].text;
    expect(text).toContain("```tsx"); // 前门这支恒发 composable
    expect(text).toContain("generate_dialog");
    expect(text).toContain("mode: 'component'");
  });

  it("form-only (no table, no dialog) emits a standalone submit form", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Form (FormBlock.vue)");
  });

  it("form-only 的 formLayout 也必须透传（与查询分支同一口径）", async () => {
    // 修前只有查询分支转发 formLayout，纯表单分支静默丢弃 —— 而工具描述承诺旋钮
    // 「forwarded verbatim」，宿主按描述填写却拿不到 labelWidth / minFoldRows。
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")] },
      formLayout: { labelWidth: "120px", minFoldRows: 3 },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('const layoutFormProps = { formLayProps: {"labelWidth":"120px","minFoldRows":3} }');
    expect(res.content[0].text).toContain(':layout-form-props="layoutFormProps"');
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
      operationColumn: { label: "操作", width: 160, btns: [{ name: "编辑", dialogKey: "edit" }] },
      tableBtns: [{ name: "导出", actionType: "export" }],
      toolbarBtns: [{ name: "批量删除", actionType: "delete" }],
    });

    // 五键逐一原样存活（若形状声明为嵌套 z.object，未声明的子键会被吞掉）
    expect(parsed.tableOptions).toEqual({ border: false, emptyText: "暂无数据", heightType: "auto", size: "small" });
    expect(parsed.formLayout).toEqual({ labelWidth: "100px", minFoldRows: 2 });
    expect(parsed.operationColumn).toEqual({ label: "操作", width: 160, btns: [{ name: "编辑", dialogKey: "edit" }] });
    expect(parsed.tableBtns).toEqual([{ name: "导出", actionType: "export", code: 1 }]);
    expect(parsed.toolbarBtns).toEqual([{ name: "批量删除", actionType: "delete", code: 2 }]);
  });

  // ── AN-21：旋钮显式形状 + .strict() ──────────────────────────────────────
  // 形状化的目的不只是「JSON Schema 里有键」，更是**拼错的键立刻报错**。此前
  // z.record(z.any()) / z.any() 会把任何拼写错误静默放行，AI 以为改了表格行为，
  // 生成物里其实什么都没变。这里逐旋钮证明「未知键 → 解析失败」。
  it("未知旋钮/子键在工具层报错（AN-21：不留静默 strip）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const shape = tools.generate_crud.shape;
    const probes: Array<Record<string, unknown>> = [
      { tableOptions: { bogusKnob: 1 } },
      { tableOptions: { editConfig: { bogusNested: 1 } } },
      { formLayout: { span: 12 } }, // span 是字段级 querySpan/formSpan，formLayout 没有该键
      { operationColumn: { bogusKnob: 1 } },
      { expandConfig: { bogusKnob: 1 } },
      { treeConfig: { bogusKnob: 1 } },
      { mergeConfig: { bogusKnob: 1 } },
    ];
    for (const probe of probes) {
      const r = z.object(shape).safeParse({
        ...baseCrud,
        surfaces: { table: [field("name", "名称")] },
        ...probe,
      });
      expect(r.success, `未知键未报错：${JSON.stringify(probe)}`).toBe(false);
    }
  });

  // ── AN-07：工具描述里的示例必须「照抄即可用」─────────────────────────
  // 此前 tableBtns 的 describe 写的是 `[{ label: "导出", action: "export" }]`，
  // 而 schema 只认 `{ name, actionType }`：照抄示例 = Zod 静默 strip 两个键 =
  // 解析成功却没有名字/动作的空壳（tableBtns 维度实测 2/10）。本断言把「示例」
  // 本身也变成被测对象：description 里的那段 JSON 必须能过权威 schema。
  it("工具描述里的 tableBtns 示例照抄必须通过权威 schema（AN-07）", () => {
    const { server, tools } = makeMockServer();
    registerGenerateCrud(server);
    const desc: string = tools.generate_crud.shape.tableBtns.description;
    const example = desc.match(/\[\{[\s\S]*?\}\]/)?.[0];
    expect(example, `tableBtns 描述里没有可解析的数组示例：${desc}`).toBeTruthy();
    // 描述里的示例是 JS 对象字面量（键不带引号）—— 补引号后按 JSON 解析，
    // 避免用 eval/new Function 把「被测文本」当代码执行。
    const literal = example!.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
    const buttons = JSON.parse(literal);
    const r = StructuredCrudConfigSchema.safeParse({
      name: "Page",
      apiUrl: "/api/x",
      fields: [field("name", "名称")],
      actions: ["add"],
      tableBtns: buttons,
    });
    expect(r.success, JSON.stringify((r as any).error?.issues)).toBe(true);
    const btn = (r as any).data.tableBtns[0];
    expect(btn.name).toBe("导出");
    expect(btn.actionType).toBe("export");
    expect(btn.code).toBe(1); // position:'left' 归一化
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

  it("surfaces.dialog 重复 key 显式告警（不被 Object.fromEntries 静默覆盖）", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        table: [field("name", "名称")],
        form: [field("name", "名称")],
        dialog: ["add", { key: "add", title: "另一个新增" }],
      },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("surfaces.dialog 里 'add' 出现了多次");
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

  it("generate_dialog mode=component emits an SFC (```vue) with the options injected", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateDialog(server);
    const res = await tools.generate_dialog.handler({
      fields: [field("name", "名称")],
      apiUrl: "/api/users",
      target: "vue3",
      mode: "component",
      options: { width: 720, showClose: false, maxHeight: "70vh" },
      typescript: true,
      i18n: false,
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    // 围栏必须跟着形态走（AI-28 前 dialog 恒发 ```tsx）
    expect(text).toContain("```vue");
    expect(text).not.toContain("```tsx");
    expect(text).toContain("<es-dialog");
    // options 真的穿过 zod3 形状落进模板（若镜像漏键，zod 会静默 strip → 这里红）
    expect(text).toContain(':width="720"');
    expect(text).toContain(':show-close="false"');
    expect(text).toContain('max-height="70vh"');
  });

  it("generate_dialog 的 options 键被 zod3 形状认下（不静默 strip）", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateDialog(server);
    // 铺满 dialogOptionsSchema 的全部 13 键；任一键被 strip 都会让对应 attr/键缺席。
    const res = await tools.generate_dialog.handler({
      fields: [field("name", "名称")],
      mode: "component",
      options: {
        width: 720,
        maxHeight: "70vh",
        isDraggable: true,
        fullscreen: true,
        isHiddenFooter: true,
        showClose: false,
        destroyOnClose: true,
        modal: false,
        closeOnClickModal: false,
        closeOnPressEscape: false,
        hiddenFullBtn: true,
        appendTo: "#app",
        cacheKey: "k1",
      },
      typescript: false,
      i18n: false,
    });
    const text = res.content[0].text;
    for (const attr of [
      ':width="720"',
      'max-height="70vh"',
      ':is-draggable="true"',
      ':fullscreen="true"',
      ':is-hidden-footer="true"',
      ':show-close="false"',
      ':destroy-on-close="true"',
      ':modal="false"',
      ':close-on-click-modal="false"',
      ':close-on-press-escape="false"',
      ':hidden-full-btn="true"',
      'append-to="#app"',
    ]) {
      expect(text, `选项属性 ${attr} 未发射（形状可能把它 strip 了）`).toContain(attr);
    }
    // cacheKey 在 component 模式下告警而非发射
    expect(text).not.toContain('cache-key');
    expect(text).toContain("cacheKey");
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

  // AN-24：确定性修复环在**校验之前**跑。常见格式错误（null = 未声明、成员布尔字面量）
  // 不应把宿主推进「生成失败 → 让模型重写 → 再失败」的循环。
  it("repairable format errors are fixed before the gate (AN-24)", async () => {
    const res = await fromConfigHandler()({
      ...validFromConfig,
      formLayout: null,
      fields: [field("userName", "用户名", "Input", { inQuery: "false" })],
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text;
    expect(text).toContain("自动修复：/formLayout");
    expect(text).toContain("自动修复：/fields/0/inQuery");
    expect(text).toContain("```");
  });

  it("repair does not launder a genuinely invalid config", async () => {
    const res = await fromConfigHandler()({
      ...validFromConfig,
      formLayout: null,
      fields: [field("u", "U", "Nope")],
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("/fields/0/formtype");
  });

  // AN-15：生成物必须携带前置清单；不需要的项要明确写「不需要」，而不是让宿主猜。
  it("emits the preflight checklist (permission correctly marked not-needed)", async () => {
    const text = (await fromConfigHandler()(validFromConfig)).content[0].text;
    expect(text).toContain("## Preflight — host prerequisites");
    expect(text).toContain("**[required]** **Global httpRequest**");
    // 该 config 没有任何 permissionValue/permissions ⟹ 明确标 [not needed]
    expect(text).toContain("[not needed] **Global permission()**");
    expect(text).toContain("### App entry — src/main.ts (copy once)");
    expect(text).toContain("app.use(ESPlus, {");
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
    // AN-15②：scaffold 与生成物共用同一份前置清单（含 required 判定与入口样板）
    expect(text).toContain("## Preflight — host prerequisites");
    expect(text).toContain("### App entry — src/main.ts (copy once)");
    expect(text).toContain("**[required]** **Global httpRequest**");
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

// AN-15③：doctor_page 只做字面量静态扫描；这里钉住它对**完整入口**判绿、
// 对 `app.use(ESPlus)` 判红（httpRequest 缺失），以及 config 让 [not needed] 项不误报。
function doctorHandler() {
  const { server, tools } = makeMockServer();
  registerDoctorPage(server);
  expect(tools.doctor_page).toBeDefined();
  return tools.doctor_page.handler;
}

describe("doctor_page — 宿主入口静态检查", () => {
  const configNeedingGates = {
    target: "vue3",
    mode: "schema",
    actions: ["add"],
    fields: [{ prop: "name", label: "名称", formtype: "Input", permissionValue: "user:add" }],
  };

  it("a complete entry satisfies the checklist", async () => {
    const res = await doctorHandler()({
      entry: generateAppEntry("vue3"),
      target: "vue3",
      config: configNeedingGates,
      viteConfig: "export default { plugins: [vue(), vueJsx()] }",
    });
    const text = res.content[0].text;
    expect(text).toContain("## Doctor");
    expect(text).toContain("✅");
    expect(text).not.toContain("❌");
    expect(text).toContain("All required prerequisites");
  });

  it("bare app.use(ESPlus) ⇒ httpRequest missing", async () => {
    const res = await doctorHandler()({
      entry: "import ESPlus from '@es-plus/vue3'\napp.use(ESPlus)",
      target: "vue3",
      config: configNeedingGates,
    });
    const text = res.content[0].text;
    expect(text).toContain("❌ **Global httpRequest** — missing");
    expect(text).toContain("MISSING");
  });

  it("no config ⇒ every capability is checked (permission/t no longer [not needed])", async () => {
    const res = await doctorHandler()({
      entry: "import ESPlus from '@es-plus/vue3'\napp.use(ESPlus, { httpRequest: (p) => axios(p) })",
      target: "vue3",
    });
    const text = res.content[0].text;
    expect(text).toContain("❌ **Global permission()** — missing");
    expect(text).toContain("❌ **Global t() (i18n)** — missing");
  });
});
