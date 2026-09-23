import { describe, it, expect } from "vitest";
import {
  validatePayload,
  validateStructuredConfig,
  STRUCTURED_CRUD_TYPE,
} from "../src/tools/validate-config.js";
import { listAvailableSchemas } from "@es-plus/shared";

// validate_config 有两条校验路径：JSON 单源（Ajv）与 Zod 单源（StructuredCrudConfig）。
// 后者是本次补上的 —— `generate_crud_from_config` 的入参在 packages/shared/schemas/ 下
// 没有 JSON Schema，Ajv 那条路对它只会回「Schema not found」，于是文档承诺的
// 「生成 → 校验 → 编译」中间那步跑不了。

const validConfig = () => ({
  name: "UserManage",
  apiUrl: "/api/users",
  fields: [{ prop: "userName", label: "用户名", formtype: "Input" }],
  actions: ["add", "edit"],
});

describe("validate_config — 结构化配置走 Zod", () => {
  it("合法配置判为合法", () => {
    const r = validatePayload(validConfig(), STRUCTURED_CRUD_TYPE);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("未知的 type 不再把结构化配置丢给 Ajv（修前会回 Schema not found）", () => {
    // 这是本缺陷的原始症状：修前结构化配置根本没有可路由的路径。
    const r = validatePayload({ name: "X" }, STRUCTURED_CRUD_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.join("\n")).not.toContain("Schema not found");
    expect(r.errors.join("\n")).not.toContain("no schema with key or ref");
  });

  it("STRUCTURED_CRUD_TYPE 是独立分支，不是注册进 Ajv 的 JSON Schema", () => {
    // 若哪天有人把它当成第 N 个 JSON schema 加进 schemas/，这里会提醒：
    // 两条路径的判据不同（Ajv 无此单源），不该混进同一个列表。
    expect(listAvailableSchemas()).not.toContain(STRUCTURED_CRUD_TYPE);
  });

  it("缺必填字段 → 错误串按 Ajv 的 /path: message 形态给出", () => {
    const { apiUrl: _omitted, ...rest } = validConfig();
    const r = validateStructuredConfig(rest);
    expect(r.valid).toBe(false);
    expect(r.errors).toContainEqual(expect.stringMatching(/^\/apiUrl: /));
    expect(r.suggestions).toContain('/apiUrl should be type "string"');
  });

  it("类型不符 → 建议里点出期望类型", () => {
    const r = validateStructuredConfig({ ...validConfig(), apiUrl: 123 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/apiUrl: "))).toBe(true);
    expect(r.suggestions).toContain('/apiUrl should be type "string"');
  });

  it("嵌套路径用 / 连接（fields.0.formtype）", () => {
    const r = validateStructuredConfig({
      ...validConfig(),
      fields: [{ prop: "u", label: "U", formtype: "Nope" }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/fields/0/formtype: "))).toBe(true);
  });

  it("枚举不符 → 建议列出合法取值", () => {
    const r = validateStructuredConfig({
      ...validConfig(),
      fields: [{ prop: "u", label: "U", formtype: "Nope" }],
    });
    const hint = r.suggestions.find((s) => s.startsWith("Valid values for /fields/0/formtype:"));
    expect(hint).toBeDefined();
    expect(hint).toContain("Select");
    expect(hint).toContain("DatePicker");
  });

  it("数组过短 → 建议给出下限", () => {
    const r = validateStructuredConfig({ ...validConfig(), fields: [] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/fields: "))).toBe(true);
    expect(r.suggestions).toContain("/fields must have at least 1");
  });

  it("union 全不匹配 → 建议说明没有任何一种形状匹配", () => {
    const r = validateStructuredConfig({
      ...validConfig(),
      fields: [{ prop: "u", label: "U", formtype: "Input", fixed: 123 }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/fields/0/fixed: "))).toBe(true);
    expect(r.suggestions).toContain("/fields/0/fixed does not match any of the allowed shapes");
  });

  it("根部错误（非对象入参）落到 (root) 而不是空串", () => {
    const r = validateStructuredConfig("not an object");
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("(root): "))).toBe(true);
  });

  it("不传 type 时仍走 Ajv（默认 form-item），行为不变", () => {
    const r = validatePayload({});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
