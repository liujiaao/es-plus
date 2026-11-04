import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerCoverageReport } from "../src/tools/coverage-report.js";

/**
 * P13 —— `coverage_report` 工具层。
 *
 * shared 的分类判据已有逐条断言；这里钉「报告形状」：文本里逐页给等级、
 * structuredContent 带 summary，L3 是合法结论（不设 isError），只有清单畸形才报错。
 */

type Captured = { shape: any; handler: (args: any) => any };

function capture(): Captured {
  const tools: Record<string, Captured> = {};
  registerCoverageReport({
    tool(n: string, _d: string, shape: any, handler: (args: any) => any) {
      tools[n] = { shape, handler };
    },
  } as any);
  const tool = tools.coverage_report;
  if (!tool) throw new Error("coverage_report not registered");
  return tool;
}

const call = (tool: Captured, args: any) =>
  tool.handler(z.object(tool.shape).passthrough().parse(args));

const field = (prop: string, label: string) => ({ prop, label, formtype: "Input" });
const intent = () => ({
  name: "UserManage",
  apiUrl: "/api/users",
  surfaces: { table: [field("userName", "用户名")] },
});

describe("coverage_report — 工具层", () => {
  const tool = capture();

  it("L1/L2/L3 逐页输出，summary 一致，L3 不设 isError", async () => {
    const res = await call(tool, {
      pages: [
        { name: "Users", scene: "crud", intent: intent() },
        { name: "Orders", scene: "crud", intent: { ...intent(), mode: "sfc", surfaces: { table: [field("id", "ID")], dialog: ["add"] } } },
        { name: "Audit", scene: "crud", intent: { ...intent(), workflow: {} } },
      ],
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.contract).toBe("es-plus.coverage@1");
    expect(res.structuredContent.summary).toEqual({ L1: 1, L2: 1, L3: 1 });
    const text = res.content[0].text as string;
    expect(text).toContain("[L1] Users");
    expect(text).toContain("[L2] Orders");
    expect(text).toContain("[L3] Audit");
    expect(text).toContain("unsupported key");
  });

  it("多部分页面 → L2，并提示 generate_composition", async () => {
    const res = await call(tool, {
      pages: [
        {
          name: "MasterDetail",
          parts: [
            { scene: "table", intent: { fields: [field("id", "ID")] } },
            { scene: "form", intent: { fields: [field("name", "名称")] } },
          ],
        },
      ],
    });
    expect(res.structuredContent.pages[0].level).toBe("L2");
    expect(res.content[0].text).toContain("generate_composition");
  });

  it("形状不合法（surfaces.table 不是数组）→ L3，而不是误报成 L2 直出", async () => {
    const res = await call(tool, {
      pages: [
        {
          name: "Broken",
          scene: "crud",
          intent: { name: "Broken", apiUrl: "/api/x", surfaces: { table: "oops" } },
        },
      ],
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.pages[0].level).toBe("L3");
    expect(res.content[0].text).toContain("invalid intent shape");
  });

  it("无表元数据降级（name/apiUrl/mode）仍是 L1，part 里保留降级键", async () => {
    const res = await call(tool, {
      pages: [
        {
          name: "Search",
          scene: "crud",
          intent: { name: "Search", apiUrl: "/api/x", surfaces: { query: [field("a", "A")] } },
        },
      ],
    });
    expect(res.structuredContent.pages[0].level).toBe("L1");
    expect(res.structuredContent.pages[0].parts[0].degraded).toEqual(
      expect.arrayContaining(["name", "apiUrl"]),
    );
  });

  it("清单畸形（pages 不是数组）→ isError 且列出 inventoryErrors", async () => {
    // 绕过 Zod：判的是 handler 对畸形清单的兜底，而不是形状校验本身。
    const res = await tool.handler({ pages: "nope" });
    expect(res.isError).toBe(true);
    expect(res.structuredContent.inventoryErrors[0]).toContain("inventory.pages");
  });
});
