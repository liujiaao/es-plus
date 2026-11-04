import { describe, it, expect } from "vitest";
import {
  INTENT_VALIDATION_CONTRACT_VERSION,
  MEMBERSHIP_FLAGS,
  SURFACE_NAMES,
  validateIntentPlan,
} from "../src/scene/intent-validation.js";

/**
 * P13 —— 宿主意图的生成前校验。
 *
 * 这些断言都对应一个**真实会发生的宿主抽取错误**（design-extraction §5 的 N1–N7）：
 * Zod 结构上合法、生成器不报错，但页面语义是错的。工具的价值就是把这些错误在生成前
 * 变成逐条 issue，因此这里逐条钉住「哪条错误 → 哪个 path / code」。
 */

const field = (prop: string, label: string, formtype?: string) => ({
  prop,
  label,
  ...(formtype === undefined ? {} : { formtype }),
});

const validCrud = () => ({
  name: "UserManage",
  apiUrl: "/api/users",
  surfaces: {
    query: [field("userName", "用户名", "Input")],
    table: [field("userName", "用户名", "Input"), field("status", "状态", "Select")],
    form: [field("userName", "用户名", "Input")],
    dialog: ["add", "edit"],
  },
});

const codes = (report: ReturnType<typeof validateIntentPlan>) => report.errors.map((e) => e.code);
const paths = (report: ReturnType<typeof validateIntentPlan>) => report.errors.map((e) => e.path);
const warnCodes = (report: ReturnType<typeof validateIntentPlan>) => report.warnings.map((w) => w.code);

describe("validateIntentPlan — 能力报告（P9 台账）", () => {
  it("合法全量 CRUD 意图：ok，无错误/警告，能力全部 accepted", () => {
    const report = validateIntentPlan({ scene: "crud", intent: validCrud() });
    expect(report.contract).toBe(INTENT_VALIDATION_CONTRACT_VERSION);
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.capability.unsupported).toEqual([]);
    expect(report.capability.missing).toEqual([]);
    expect(report.stats.surfaces).toEqual({ query: 1, table: 2, form: 1, dialog: 2 });
    expect(report.stats.fields).toBe(4);
  });

  it("未知顶层键 → unsupported-key（会被生成器静默忽略）", () => {
    const report = validateIntentPlan({
      scene: "crud",
      intent: { ...validCrud(), permissionss: {} },
    });
    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/permissionss", code: "unsupported-key" }),
    );
  });

  it("缺必填键 → missing-required，逐键给出", () => {
    const report = validateIntentPlan({ scene: "crud", intent: { surfaces: { table: [field("a", "A", "Input")] } } });
    expect(codes(report)).toEqual(expect.arrayContaining(["missing-required", "missing-required"]));
    expect(paths(report)).toEqual(expect.arrayContaining(["/name", "/apiUrl"]));
  });

  it("降级键只是警告（能生成但不保真），不阻断 ok", () => {
    const report = validateIntentPlan({
      scene: "crud",
      intent: { ...validCrud(), mode: "sfc" },
    });
    expect(report.ok).toBe(true);
    expect(report.capability.degraded).toContain("surfaces");
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ path: "/surfaces", code: "degraded-key" }),
    );
  });

  it("intent 不是对象 → intent-not-object", () => {
    const report = validateIntentPlan({ scene: "crud", intent: "not-json" });
    expect(report.ok).toBe(false);
    expect(codes(report)).toContain("intent-not-object");
  });
});

describe("validateIntentPlan — 面归属", () => {
  it("未知面名 → unknown-surface，并列出合法面", () => {
    const intent = validCrud();
    (intent.surfaces as any).filter = [field("x", "X", "Input")];
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.ok).toBe(false);
    const e = report.errors.find((x) => x.code === "unknown-surface");
    expect(e?.path).toBe("/surfaces/filter");
    expect(e?.message).toContain(SURFACE_NAMES.join(" / "));
  });

  it("surfaces 不是对象 → surfaces-not-object", () => {
    const report = validateIntentPlan({ scene: "crud", intent: { ...validCrud(), surfaces: [] } });
    expect(codes(report)).toContain("surfaces-not-object");
  });

  it("空面只是警告：空列表是省略，不是提示", () => {
    const intent = validCrud();
    intent.surfaces.query = [];
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.ok).toBe(true);
    expect(warnCodes(report)).toContain("empty-surface");
  });

  it("同一个面里重复 prop → duplicate-prop（会渲染两个绑定同一键的控件）", () => {
    const intent = validCrud();
    intent.surfaces.table.push(field("userName", "用户名", "Input"));
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/table/2/prop", code: "duplicate-prop" }),
    );
  });

  it("把 inQuery/inTable/inForm 抄进意图 → membership-flag（N3）", () => {
    const intent = validCrud();
    const entry = intent.surfaces.query[0] as any;
    for (const flag of MEMBERSHIP_FLAGS) entry[flag] = true;
    const report = validateIntentPlan({ scene: "crud", intent });
    for (const flag of MEMBERSHIP_FLAGS) {
      expect(report.errors).toContainEqual(
        expect.objectContaining({ path: `/surfaces/query/0/${flag}`, code: "membership-flag" }),
      );
    }
  });
});

describe("validateIntentPlan — 字段语义", () => {
  it("query/form 缺 formtype 是错误；table 的 formtype 是幻影要求（不报）", () => {
    const intent = validCrud();
    intent.surfaces.query[0] = field("userName", "用户名");
    intent.surfaces.table.push(field("phone", "手机号"));
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/query/0/formtype", code: "missing-formtype" }),
    );
    expect(report.errors.some((e) => e.path.startsWith("/surfaces/table/2/formtype"))).toBe(false);
  });

  it("未知 formtype → unknown-formtype 并列出合法值", () => {
    const intent = validCrud();
    intent.surfaces.form[0] = field("userName", "用户名", "Nope");
    const report = validateIntentPlan({ scene: "crud", intent });
    const e = report.errors.find((x) => x.code === "unknown-formtype");
    expect(e?.path).toBe("/surfaces/form/0/formtype");
    expect(e?.message).toContain("Input");
  });

  it("缺 prop / 不安全 prop → missing-prop / unsafe-prop", () => {
    const intent = validCrud();
    intent.surfaces.table.push({ label: "无键", formtype: "Input" } as any);
    intent.surfaces.table.push(field("a/b", "斜杠", "Input"));
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(paths(report)).toEqual(
      expect.arrayContaining(["/surfaces/table/2/prop", "/surfaces/table/3/prop"]),
    );
    expect(codes(report)).toEqual(expect.arrayContaining(["missing-prop", "unsafe-prop"]));
  });

  it("提供 spec 时，label 必须能在原文里逐字找到（N6）", () => {
    const report = validateIntentPlan({
      scene: "crud",
      intent: validCrud(),
      spec: "用户管理：可按手机号筛选；列表展示手机号。",
    });
    expect(report.ok).toBe(true);
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ path: "/surfaces/query/0/label", code: "label-not-in-spec" }),
    );
  });

  it("query 字段不是表格列 → query-field-not-column（明细字段放错面的确定性近似）", () => {
    const intent = validCrud();
    intent.surfaces.query.push(field("remark", "备注", "Input"));
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.ok).toBe(true);
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ path: "/surfaces/query/1/prop", code: "query-field-not-column" }),
    );
  });

  it("系统字段进可编辑表单 → system-field-in-form（N2），只是警告", () => {
    const intent = validCrud();
    intent.surfaces.form.push(field("createdAt", "创建时间", "DatePicker"));
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.ok).toBe(true);
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ path: "/surfaces/form/1/prop", code: "system-field-in-form" }),
    );
  });
});

describe("validateIntentPlan — 弹窗条目", () => {
  it("自定义 key 用字符串 → unknown-dialog-key（必须用对象形态）", () => {
    const intent = validCrud();
    intent.surfaces.dialog = ["add", "detail"];
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/dialog/1", code: "unknown-dialog-key" }),
    );
  });

  it("重复弹窗 key → duplicate-dialog-key", () => {
    const intent = validCrud();
    intent.surfaces.dialog = ["add", "add"];
    expect(codes(validateIntentPlan({ scene: "crud", intent }))).toContain("duplicate-dialog-key");
  });

  it("对象缺 key → missing-dialog-key；formItems 走同一套字段判据", () => {
    const intent = validCrud();
    intent.surfaces.dialog = [
      { title: "详情" } as any,
      { key: "blacklist", formItems: [{ prop: "reason", label: "拉黑原因" }] } as any,
    ];
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/surfaces/dialog/0/key", code: "missing-dialog-key" }),
    );
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        path: "/surfaces/dialog/1/formItems/0/formtype",
        code: "missing-formtype",
      }),
    );
  });

  it("view 弹窗的 formItems 不判「系统字段进表单」（只读查看是合法用途）", () => {
    const intent = validCrud();
    intent.surfaces.dialog = [
      { key: "view", formItems: [field("createdAt", "创建时间", "DatePicker")] } as any,
    ];
    const report = validateIntentPlan({ scene: "crud", intent });
    expect(report.ok).toBe(true);
    expect(warnCodes(report)).not.toContain("system-field-in-form");
  });
});

describe("validateIntentPlan — 片段场景", () => {
  it("table 片段：fields 缺 formtype 不报（生成器不读）", () => {
    const report = validateIntentPlan({
      scene: "table",
      intent: { fields: [field("userName", "用户名")], apiUrl: "/api/users" },
    });
    expect(report.ok).toBe(true);
    expect(report.stats.surfaces).toBeNull();
    expect(report.stats.fields).toBe(1);
  });

  it("form 片段：缺 formtype 是错误；系统字段进表单是警告", () => {
    const report = validateIntentPlan({
      scene: "form",
      intent: {
        fields: [{ prop: "userName", label: "用户名" }, field("createdAt", "创建时间", "DatePicker")],
      },
    });
    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/fields/0/formtype", code: "missing-formtype" }),
    );
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ path: "/fields/1/prop", code: "system-field-in-form" }),
    );
  });

  it("片段缺 fields → missing-required", () => {
    const report = validateIntentPlan({ scene: "table", intent: {} });
    expect(report.errors).toContainEqual(
      expect.objectContaining({ path: "/fields", code: "missing-required" }),
    );
  });
});
