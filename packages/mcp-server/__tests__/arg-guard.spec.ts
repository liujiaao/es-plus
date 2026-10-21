import { describe, it, expect } from "vitest";
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
  const fake = {
    tool(name: string, _desc: string, schema: any, handler: (args: any, extra?: any) => any) {
      tools[name] = { schema, handler };
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
    // zod3 对象：`_def.unknownKeys` 是 strip/strict/passthrough
    expect(schema._def.unknownKeys).toBe("passthrough");
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

  it("闸门覆盖全部工具（15 个注册项全部走同一入口）", () => {
    expect(Object.keys(tools)).toHaveLength(15);
    for (const [, tool] of Object.entries(tools)) {
      expect(tool.schema._def.unknownKeys).toBe("passthrough");
    }
  });
});
