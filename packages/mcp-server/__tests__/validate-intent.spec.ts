import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerValidateIntent } from "../src/tools/validate-intent.js";

/**
 * P13 —— `validate_intent` 工具层。
 *
 * shared 的 `validateIntentPlan` 已有逐条断言；这里只钉**合并后的形状**：
 *   ① 结构级判据确实复用了 generate_scene 的那份 Zod 形状（未知键 / safeParse）；
 *   ② 同一 path 只报一次（shared 语义判据优先，Zod 不重复）；
 *   ③ 报告通过 structuredContent 返回，错误时 isError；
 *   ④ spec 的 label 检查只是警告，不影响 ok。
 */

type Captured = { shape: any; handler: (args: any) => any };

function capture(): Captured {
  const tools: Record<string, Captured> = {};
  registerValidateIntent({
    tool(n: string, _d: string, shape: any, handler: (args: any) => any) {
      tools[n] = { shape, handler };
    },
  } as any);
  const tool = tools.validate_intent;
  if (!tool) throw new Error("validate_intent not registered");
  return tool;
}

const call = (tool: Captured, args: any) =>
  tool.handler(z.object(tool.shape).passthrough().parse(args));

const field = (prop: string, label: string, formtype = "Input") => ({ prop, label, formtype });

const validIntent = () => ({
  name: "UserManage",
  apiUrl: "/api/users",
  surfaces: {
    query: [field("userName", "用户名")],
    table: [field("userName", "用户名")],
    form: [field("userName", "用户名")],
    dialog: ["add", "edit"],
  },
});

describe("validate_intent — 工具层", () => {
  const tool = capture();

  it("合法意图：ok，返回能力报告，不设 isError", async () => {
    const res = await call(tool, { scene: "crud", intent: validIntent() });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('✓ intent is valid for scene "crud"');
    expect(res.structuredContent.ok).toBe(true);
    expect(res.structuredContent.contract).toBe("es-plus.intent-validation@1");
    expect(res.structuredContent.capability.contract).toBe("es-plus.capabilities@1");
    expect(res.structuredContent.errors).toEqual([]);
  });

  it("未知嵌套键（formtpe）被生成入口的同一份形状抓到", async () => {
    const intent = validIntent();
    delete (intent.surfaces.query[0] as any).formtype;
    (intent.surfaces.query[0] as any).formtpe = "Input";
    const res = await call(tool, { scene: "crud", intent });
    expect(res.isError).toBe(true);
    expect(res.structuredContent.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/query/0/formtpe", code: "unknown-key" }),
    );
    // missing formtype 与未知键是两条不同信息，都应出现
    expect(res.structuredContent.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/query/0/formtype" }),
    );
  });

  it("同一 path 只报一次：缺 name 时 shared 与 Zod 不重复", async () => {
    const intent = validIntent() as any;
    delete intent.name;
    const res = await call(tool, { scene: "crud", intent });
    const atName = res.structuredContent.errors.filter((e: any) => e.path === "/name");
    expect(atName).toHaveLength(1);
    expect(atName[0].code).toBe("missing-required");
  });

  it("语义错误（重复 prop）来自 shared 判据", async () => {
    const intent = validIntent();
    intent.surfaces.table.push(field("userName", "用户名"));
    const res = await call(tool, { scene: "crud", intent });
    expect(res.structuredContent.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/table/1/prop", code: "duplicate-prop" }),
    );
  });

  it("spec 的 label 检查只产生警告，不影响 ok", async () => {
    const res = await call(tool, {
      scene: "crud",
      intent: validIntent(),
      spec: "用户管理：按手机号筛选。",
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.ok).toBe(true);
    expect(res.structuredContent.warnings).toContainEqual(
      expect.objectContaining({ code: "label-not-in-spec" }),
    );
    expect(res.content[0].text).toContain("Warnings");
  });

  it("片段场景缺 fields → missing-required，isError", async () => {
    const res = await call(tool, { scene: "table", intent: {} });
    expect(res.isError).toBe(true);
    expect(res.structuredContent.errors).toContainEqual(
      expect.objectContaining({ path: "/fields", code: "missing-required" }),
    );
  });
});
