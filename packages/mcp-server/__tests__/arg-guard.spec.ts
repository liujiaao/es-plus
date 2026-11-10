import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerTools } from "../src/tools/index.js";

/**
 * AN-26（续）—— 工具入参未知键闸门。
 *
 * MCP SDK 内部把工具形状包成 `z3rt.object(shape)`（默认 **strip**），拼错/放错层的
 * 参数在路由到 handler 之前就消失：`surfaces.dialog[].formFields` →
 * 弹窗拿不到自己的字段表，生成一个「只读」对话框，宿主看到的是成功。
 *
 * 闸门在 `registerTools` 入口套一次（见 `src/tools/_arg-guard.ts`），这里钉住三件事：
 *   ① 完整 ZodObject（passthrough）确实交给了 SDK —— 未知键能活到 handler；
 *   ② 未知键 → isError + 点名路径 + did-you-mean，**不生成任何东西**；
 *   ③ 合法入参不受影响（不误杀）。
 */

type Captured = { schema: any; handler: (args: any, extra?: any) => any };

function captureAll(): Record<string, Captured> {
  const tools: Record<string, Captured> = {};
  // 假 server 必须按**真实 SDK** 的现代签名建模（`registerTool(name, config, cb)`）：
  // 闸门现在走这条，`config.inputSchema` 才是真正交给 SDK 的形状。手写假 server 只实现
  // 旧式 `tool()` 时，闸门会静默退到降级分支 —— 那样这里的断言测的就不是生产路径了。
  const fake = {
    tool() {
      throw new Error("arg-guard 应走 registerTool（旧式 tool() 会把 ZodObject 误判成 annotations）");
    },
    registerTool(name: string, config: { inputSchema: any }, handler: (args: any, extra?: any) => any) {
      tools[name] = { schema: config.inputSchema, handler };
    },
  };
  registerTools(fake as any, "full");
  return tools;
}

const field = { prop: "name", label: "名称", formtype: "Input" };

const baseCrud = {
  name: "UserManage",
  apiUrl: "/api/users",
  surfaces: { form: [field] },
};

describe("工具入参闸门 — 未知键不再静默消失", () => {
  const tools = captureAll();

  it("交给 SDK 的是 passthrough 形状（未知键能活到 handler）", () => {
    const schema = tools.generate_crud.schema;
    // 行为断言，不读 `_def`：zod3 用 `_def.unknownKeys === 'passthrough'`，zod4 把它
    // 编译成 `catchall: z.unknown()`，两种内部词汇不同但「未知键活下来」是同一个契约。
    const parsed = schema.parse({ ...baseCrud, typoKey: 1 });
    expect(parsed.typoKey).toBe(1);
  });

  it("顶层未知键 → isError，点名键并说明没有生成任何东西", async () => {
    const res = await tools.generate_crud.handler({ ...baseCrud, apiUr: "/api/x" });
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("nothing was generated");
    expect(text).toContain('"apiUr"');
    expect(text).toContain('did you mean "apiUrl"');
  });

  it("嵌套未知键（surfaces.dialog[].formItems 拼错）→ 点名完整路径 + 建议", async () => {
    const res = await tools.generate_crud.handler({
      ...baseCrud,
      surfaces: { form: [field], dialog: [{ key: "add", formItmes: [field] }] },
    });
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/surfaces/dialog/0/formItmes");
    expect(text).toContain('did you mean "formItems"');
  });

  it("近义键（formFields）即便不产生建议，也照样判红（静默丢弃才是问题）", async () => {
    const res = await tools.generate_crud.handler({
      ...baseCrud,
      surfaces: { form: [field], dialog: [{ key: "add", formFields: [field] }] },
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("/surfaces/dialog/0/formFields");
  });

  it("经 SDK 同款 safeParse 后，嵌套拼写仍活到闸门（回归：嵌套也被 strip）", async () => {
    // SDK 的 validateToolInput 传进 handler 的是 safeParse 的结果。若嵌套形状是
    // zod 默认 strip，拼写在这里就已消失，闸门看到的是「合法入参」。
    const parsed = tools.generate_crud.schema.parse({
      ...baseCrud,
      surfaces: { form: [field], dialog: [{ key: "add", formItmes: [field] }] },
    });
    expect(parsed.surfaces.dialog[0].formItmes).toBeDefined();
    const res = await tools.generate_crud.handler(parsed);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("/surfaces/dialog/0/formItmes");
    expect(res.content[0].text).toContain('did you mean "formItems"');
  });

  it("字段级拼写（formType → formtype）同样点名 + 建议", async () => {
    const parsed = tools.generate_crud.schema.parse({
      ...baseCrud,
      surfaces: { form: [{ ...field, formType: "Select" }] },
    });
    const res = await tools.generate_crud.handler(parsed);
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/surfaces/form/0/formType");
    expect(text).toContain('did you mean "formtype"');
  });

  it("合法入参照常生成（不误杀）", async () => {
    const res = await tools.generate_crud.handler({ ...baseCrud });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("Form (FormBlock.vue)");
  });

  it("闸门覆盖全部工具（19 个注册项全部走同一入口）", () => {
    expect(Object.keys(tools)).toHaveLength(19);
    for (const [name, tool] of Object.entries(tools)) {
      // 用宿主真正看到的那份 JSON Schema 断言：loose 对象的 `additionalProperties`
      // 是 `{}`（任意键放行），strip 对象根本没有该字段。这比读 `_def` 更接近契约，
      // 且 zod3/zod4 都成立（zod4 的 `.passthrough()` 在 `_def` 上已与 catchall 同形）。
      const json = z.toJSONSchema(tool.schema, { io: "input", unrepresentable: "any" }) as {
        additionalProperties?: unknown;
      };
      expect(json.additionalProperties, `${name} 的工具形状会把未知键剥掉`).toEqual({});
    }
  });
});

/**
 * P8 复核续 —— **嵌套**形状的 passthrough。
 *
 * 顶层 passthrough 只保住顶层键。`apiParams` / 组合节点 / 覆盖清单页 / 行按钮 /
 * 列对象此前都是裸 `z.object`：它们的未知键在 SDK 解析阶段就被剥掉，闸门拿到的已是
 * 「干净」输入。后果不是报错，而是**成功但语义变了**（远程下拉用默认取值列、
 * `roles` 拼错退化成无主表、需要宿主写代码的页面被判 L1、行按钮丢样式、`x-*` 契约失效）。
 * 这里逐个钉住「解析后仍在 → 闸门点名 + 建议」。
 */
describe("工具入参闸门 — 嵌套形状的未知键不再被提前剥掉", () => {
  const tools = captureAll();

  it("generate_form: apiParams.labelFeild → 点名 + did-you-mean", async () => {
    const parsed = tools.generate_form.schema.parse({
      fields: [
        { prop: "city", label: "城市", formtype: "Select", apiParams: { url: "/api/cities", labelFeild: "name" } },
      ],
    });
    expect(parsed.fields[0].apiParams.labelFeild).toBe("name");
    const res = await tools.generate_form.handler(parsed);
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/fields/0/apiParams/labelFeild");
    expect(text).toContain('did you mean "labelField"');
  });

  it("generate_composition: 节点层 roles 拼错 → 点名，而不是静默退化为无主表", async () => {
    const parsed = tools.generate_composition.schema.parse({
      nodes: [
        { id: "orders", roles: "master", scene: "table", intent: { apiUrl: "/api/orders", fields: [field] } },
        { id: "items", scene: "table", intent: { apiUrl: "/api/items", fields: [field] } },
      ],
    });
    expect(parsed.nodes[0].roles).toBe("master");
    const res = await tools.generate_composition.handler(parsed);
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/nodes/0/roles");
    expect(text).toContain('did you mean "role"');
  });

  it("coverage_report: 页级 extensionPoint 拼错 → 点名，而不是被判成 L1", async () => {
    const parsed = tools.coverage_report.schema.parse({
      pages: [
        {
          name: "users",
          scene: "table",
          intent: { apiUrl: "/api/users", fields: [field] },
          extensionPoint: [{ slot: "toolbar" }],
        },
      ],
    });
    expect(parsed.pages[0].extensionPoint).toBeDefined();
    const res = await tools.coverage_report.handler(parsed);
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/pages/0/extensionPoint");
    expect(text).toContain('did you mean "extensionPoints"');
  });

  it("generate_table: rowButtons[].typee → 点名，而不是按钮静默丢样式", async () => {
    const parsed = tools.generate_table.schema.parse({
      fields: [field],
      rowButtons: [{ name: "导出", key: "export", typee: "primary" }],
    });
    expect(parsed.rowButtons[0].typee).toBe("primary");
    const res = await tools.generate_table.handler(parsed);
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/rowButtons/0/typee");
    expect(text).toContain('did you mean "type"');
  });

  it("generate_table: 列上的 x-* 保留（扩展键不是拼写错误），拼错的列键仍判红", async () => {
    const ok = tools.generate_table.schema.parse({
      fields: [field],
      columns: [{ prop: "name", label: "名称", "x-note": "audit" }],
    });
    expect(ok.columns[0]["x-note"]).toBe("audit");
    expect((await tools.generate_table.handler(ok)).isError).toBeFalsy();

    const bad = tools.generate_table.schema.parse({
      fields: [field],
      columns: [{ prop: "name", label: "名称", widht: 120 }],
    });
    const res = await tools.generate_table.handler(bad);
    expect(res.isError).toBe(true);
    const text = res.content[0].text as string;
    expect(text).toContain("/columns/0/widht");
    expect(text).toContain('did you mean "width"');
  });
});
