import { describe, it, expect } from "vitest";
import { buildRefineResult } from "../src/tools/refine-config.js";

// refine_config 的逻辑都在 buildRefineResult 里(server.tool 只是薄包装 + JSON 解析)。
// 直接测这个纯函数——与 validate-config.spec / ingest-schema.spec 同一范式。

const pinned = {
  name: "OrderManage",
  apiUrl: "/api/orders",
  fields: [
    { prop: "orderNo", label: "订单号", formtype: "Input" },
    { prop: "amount", label: "金额", formtype: "Input" },
  ],
  actions: ["add", "edit", "delete"],
};

describe("buildRefineResult — 校验 revised + 回显本轮 diff", () => {
  it("金额改数值右对齐 → 合法 + diff 捕获 formtype/align 变更", () => {
    const revised = JSON.parse(JSON.stringify(pinned));
    revised.fields[1].formtype = "InputNumber";
    revised.fields[1].align = "right";

    const r = buildRefineResult({ previous: pinned, revised });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.diff!.fieldsChanged).toHaveLength(1);
    const fc = r.diff!.fieldsChanged[0];
    expect(fc.prop).toBe("amount");
    const attrs = fc.changes.map((c) => c.attr).sort();
    expect(attrs).toEqual(["align", "formtype"]);
    expect(r.summary.join("\n")).toContain("~ 字段 amount");
  });

  it("revised 不合法(formtype 不在枚举) → valid=false + 错误,无 diff", () => {
    const revised = JSON.parse(JSON.stringify(pinned));
    revised.fields[1].formtype = "NotAType";

    const r = buildRefineResult({ previous: pinned, revised });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.diff).toBeUndefined();
    expect(r.summary).toEqual([]);
  });

  it("无改动 → 合法 + 空差异提示", () => {
    const r = buildRefineResult({ previous: pinned, revised: JSON.parse(JSON.stringify(pinned)) });
    expect(r.valid).toBe(true);
    expect(r.diff!.isEmpty).toBe(true);
    expect(r.summary.join("")).toContain("无差异");
  });

  it("首轮(无 previous) → revised 字段全算新增", () => {
    const r = buildRefineResult({ revised: pinned });
    expect(r.valid).toBe(true);
    expect(r.diff!.fieldsAdded).toEqual(["orderNo", "amount"]);
  });
});
