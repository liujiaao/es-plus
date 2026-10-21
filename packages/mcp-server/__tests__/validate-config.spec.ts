import { describe, it, expect } from "vitest";
import {
  validatePayload,
  validateStructuredConfig,
  registerValidateConfig,
  STRUCTURED_CRUD_TYPE,
  ES_TABLE_TYPE,
  ES_FORM_TYPE,
  ES_DIALOG_TYPE,
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

// Wave 4：独立组件场景的三种配置类型。判据直接复用工具的 Zod 形状（同一份真源），
// 因此这里断言的是「工具收什么，validate_config 就判什么」——而不是另有一套字段清单。
const tableField = { prop: "orderNo", label: "订单号", formtype: "Input" };
const formField = { prop: "userName", label: "用户名", formtype: "Input" };
const dialogField = { prop: "userName", label: "用户名", formtype: "Input" };

describe("validate_config — es-table-config（Wave 4）", () => {
  it("合法的独立表格配置（含 26 键 tableOptions 与分页播种）判为合法", () => {
    const r = validatePayload(
      {
        fields: [tableField],
        apiUrl: "/api/orders",
        tableOptions: {
          border: true,
          stripe: false,
          rowkey: "id",
          height: 400,
          size: "small",
          showHeader: false,
          emptyText: "暂无数据",
          defaultSort: { prop: "orderNo", order: "descending" },
          editConfig: { trigger: "click", mode: "cell" },
        },
        pagination: { pageSize: 20, pageSizes: [10, 20, 50] },
      },
      ES_TABLE_TYPE,
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("tableOptions.size 非法 → 路径 /tableOptions/size + 列出合法取值（zod3 options → values 归一）", () => {
    const r = validatePayload(
      { fields: [tableField], tableOptions: { size: "huge" } },
      ES_TABLE_TYPE,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/tableOptions/size: "))).toBe(true);
    const hint = r.suggestions.find((s) => s.startsWith("Valid values for /tableOptions/size:"));
    expect(hint).toBeDefined();
    expect(hint).toContain("small");
    expect(hint).toContain("large");
  });

  it("缺 fields → /fields 必填错误", () => {
    const r = validatePayload({ apiUrl: "/api/orders" }, ES_TABLE_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/fields: "))).toBe(true);
  });
});

describe("validate_config — es-form-config（Wave 4）", () => {
  it("合法：formLayout（labelWidth/minFoldRows）与 buttons 罐头都被接受", () => {
    const r = validatePayload(
      { fields: [formField], buttons: "query", formLayout: { labelWidth: "96px", minFoldRows: 2 } },
      ES_FORM_TYPE,
    );
    expect(r.valid).toBe(true);
  });

  it("buttons 非法 → 枚举建议列出 none/query/submit", () => {
    const r = validatePayload({ fields: [formField], buttons: "save" }, ES_FORM_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/buttons: "))).toBe(true);
    const hint = r.suggestions.find((s) => s.startsWith("Valid values for /buttons:"));
    expect(hint).toBeDefined();
    for (const v of ["none", "query", "submit"]) expect(hint).toContain(v);
  });

  it("fields 为空数组 → 下限错误（与工具 .min(1) 同判据）", () => {
    const r = validatePayload({ fields: [] }, ES_FORM_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/fields: "))).toBe(true);
  });
});

describe("validate_config — es-dialog-config（Wave 4）", () => {
  it("合法：composable/component 两形态与 options 底座都可校验", () => {
    const r = validatePayload(
      {
        fields: [dialogField],
        apiUrl: "/api/users",
        mode: "component",
        options: { width: 640, fullscreen: false },
      },
      ES_DIALOG_TYPE,
    );
    expect(r.valid).toBe(true);
  });

  it("mode 非法 → 枚举建议列出 composable/component", () => {
    const r = validatePayload({ fields: [dialogField], mode: "jsx" }, ES_DIALOG_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.startsWith("/mode: "))).toBe(true);
    const hint = r.suggestions.find((s) => s.startsWith("Valid values for /mode:"));
    expect(hint).toBeDefined();
    expect(hint).toContain("composable");
    expect(hint).toContain("component");
  });

  it("三种片段类型都不会回落到 Ajv（不再出现 Schema not found）", () => {
    for (const t of [ES_TABLE_TYPE, ES_FORM_TYPE, ES_DIALOG_TYPE]) {
      const r = validatePayload({ fields: [dialogField] }, t);
      expect(r.errors.join("\n")).not.toContain("Schema not found");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AN-08：未知键
// ─────────────────────────────────────────────────────────────────────────────

describe("AN-08 未知键 — 结构化配置（error）", () => {
  it("tableOptions.rowKey → 不合法，且给出 did you mean rowkey", () => {
    const r = validatePayload({ ...validConfig(), tableOptions: { rowKey: "id" } }, STRUCTURED_CRUD_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.join("\n")).toContain('未知键 "rowKey"');
    expect(r.errors.join("\n")).toContain('did you mean "rowkey"');
    expect(r.unknownKeys?.[0]).toMatchObject({ path: ["tableOptions"], key: "rowKey", suggestion: "rowkey" });
  });

  it("x-* 扩展键不拦（合法）", () => {
    const r = validatePayload({ ...validConfig(), "x-owner": "team-a" }, STRUCTURED_CRUD_TYPE);
    expect(r.valid).toBe(true);
    expect(r.unknownKeys).toEqual([]);
  });

  it("嵌套/数组元素里的未知键也报（fields[0].widht）", () => {
    const r = validatePayload(
      {
        ...validConfig(),
        fields: [{ prop: "userName", label: "用户名", formtype: "Input", widht: 100 }],
      },
      STRUCTURED_CRUD_TYPE,
    );
    expect(r.valid).toBe(false);
    expect(r.unknownKeys?.[0]).toMatchObject({ path: ["fields", 0], key: "widht", suggestion: "width" });
  });
});

describe("AN-08 未知键 — 片段配置（.strict()）", () => {
  const tableConfig = () => ({ fields: [{ prop: "name", label: "名称", formtype: "Input" }] });

  it("合法片段仍然合法（strict 不误杀已知可选键）", () => {
    const r = validatePayload({ ...tableConfig(), apiUrl: "/api/x", pagination: { pageSize: 20 } }, ES_TABLE_TYPE);
    expect(r.valid).toBe(true);
    expect(r.unknownKeys).toEqual([]);
  });

  it("片段里的未知键被拒（修前被静默剥掉）", () => {
    const r = validatePayload({ ...tableConfig(), widht: 100 }, ES_TABLE_TYPE);
    expect(r.valid).toBe(false);
    expect(r.errors.join("\n")).toContain("widht");
    expect(r.unknownKeys.map((f) => f.key)).toEqual(["widht"]);
  });

  it("已知键的拼写错误给出建议", () => {
    const r = validatePayload({ ...tableConfig(), apiUr: "/api/x" }, ES_TABLE_TYPE);
    expect(r.valid).toBe(false);
    expect(r.suggestions.join("\n")).toContain('did you mean "apiUrl"');
  });

  it("嵌套对象的未知键也要判红（根 .strict() 看不见它）", () => {
    // 修前：只有根对象 `.strict()`，`tableOptions.widht` 被 zod 默认 strip ⇒ 解析成功、
    // 宿主看到「✓ Configuration is valid!」，而那个键从未生效。
    const r = validatePayload(
      { ...tableConfig(), tableOptions: { rowkey: "id", widht: 100 } },
      ES_TABLE_TYPE,
    );
    expect(r.valid).toBe(false);
    const paths = r.unknownKeys.map((f) => `${f.path.join("/")}/${f.key}`);
    expect(paths).toContain("tableOptions/widht");
    expect(r.errors.join("\n")).toContain("widht");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MCP 失败语义：配置非法必须 isError（宿主按它决定「要不要修了重发」）
// ─────────────────────────────────────────────────────────────────────────────

describe("validate_config — 工具返回的 isError", () => {
  /** 捕获 server.tool 注册出来的真实 handler（不启 MCP 传输层）。 */
  function handler() {
    let captured: { handler: (args: any) => any } | undefined;
    const server = {
      tool(_name: string, _desc: string, _shape: any, h: (args: any) => any) {
        captured = { handler: h };
      },
    } as any;
    registerValidateConfig(server);
    expect(captured).toBeDefined();
    return captured!.handler;
  }

  it("非法配置 → isError: true（且正文仍给出逐条错误）", async () => {
    const res = await handler()({
      config: JSON.stringify({ ...validConfig(), tableOptions: { rowKey: "id" } }),
      type: STRUCTURED_CRUD_TYPE,
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Configuration has errors");
    expect(res.content[0].text).toContain("rowKey");
  });

  it("合法配置 → 不带 isError", async () => {
    const res = await handler()({ config: JSON.stringify(validConfig()), type: STRUCTURED_CRUD_TYPE });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("valid");
  });

  it("坏 JSON → isError: true", async () => {
    const res = await handler()({ config: "{ nope", type: STRUCTURED_CRUD_TYPE });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Invalid JSON");
  });
});
