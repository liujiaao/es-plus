import { describe, it, expect } from "vitest";
import { buildIngestDraft } from "../src/tools/ingest-schema.js";
import { validateStructuredConfig } from "../src/tools/validate-config.js";

// ingest_schema 的逻辑都在 buildIngestDraft 里(server.tool 只是薄包装)。
// 直接测这个纯函数——与 validate-config.spec 测 validateStructuredConfig 同一范式。

const openapi = JSON.stringify({
  openapi: "3.0.0",
  components: {
    schemas: {
      Customer: {
        type: "object",
        title: "customer",
        required: ["name"],
        properties: {
          name: { type: "string", title: "姓名" },
          level: { type: "string", enum: ["gold", "silver"] },
          balance: { type: "number" },
          vip: { type: "boolean" },
          joinedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
});

describe("buildIngestDraft — 摄取 → 草拟配置", () => {
  it("OpenAPI 摄取出可被 Zod 校验通过的结构化配置", () => {
    const { config, warnings } = buildIngestDraft({
      kind: "openapi",
      text: openapi,
      name: "CustomerManage",
      apiUrl: "/api/customers",
    });
    expect(config).toBeDefined();
    expect(config!.name).toBe("CustomerManage");
    expect(config!.apiUrl).toBe("/api/customers");
    // 每个字段默认既在表格又在表单(摄取只给扁平表,查询面由用户收窄)。
    const level = config!.fields.find((f) => f.prop === "level")!;
    expect(level.formtype).toBe("Select");
    expect(level.inTable).toBe(true);
    expect(level.inForm).toBe(true);
    expect(level.inQuery).toBe(false);
    // 没有占位告警(name/apiUrl 都给了)。
    expect(warnings.join("\n")).not.toContain("REPLACE_ME");
    // 产出的草拟配置必须真能过结构化校验(即可直接喂 generate_crud_from_config)。
    const v = validateStructuredConfig(config);
    expect(v.valid).toBe(true);
  });

  it("缺 name/apiUrl → 占位 + 两条告警", () => {
    const { config, warnings } = buildIngestDraft({
      kind: "openapi",
      text: openapi,
    });
    // name 从 schema title 推断得到(customer → Customer),所以不占位 name。
    expect(config!.name).toBe("Customer");
    expect(config!.apiUrl).toBe("/api/REPLACE_ME");
    expect(warnings.join("\n")).toContain("/api/REPLACE_ME");
  });

  it("name 完全推不出时占位 IngestedPage", () => {
    // 样例 JSON 没有 title → 推不出 name。
    const { config, warnings } = buildIngestDraft({
      kind: "sample-json",
      text: JSON.stringify({ id: 1, title: "x" }),
    });
    expect(config!.name).toBe("IngestedPage");
    expect(warnings.join("\n")).toContain("IngestedPage");
  });

  it("摄取不到字段(非法 JSON)→ 无 config + 指引告警", () => {
    const { config, warnings } = buildIngestDraft({ kind: "jsonSchema", text: "{ not json" });
    expect(config).toBeUndefined();
    expect(warnings.join("\n")).toContain("未能从该 schema 抽取任何字段");
  });

  it("ts-interface / sql-ddl 也能草拟出通过 Zod 的配置", () => {
    const sources = [
      {
        kind: "ts-interface" as const,
        text: `interface Ticket {
  id: number
  /** 标题 */
  title: string
  priority: 'high' | 'low'
}`,
        name: "Ticket",
        prop: "priority",
        formtype: "Select",
        label: "标题",
      },
      {
        kind: "sql-ddl" as const,
        text: `CREATE TABLE ticket (
  id INT NOT NULL,
  title VARCHAR(80) NOT NULL COMMENT '标题',
  priority ENUM('high', 'low')
)`,
        name: "Ticket",
        prop: "priority",
        formtype: "Select",
        label: "标题",
      },
    ];

    for (const s of sources) {
      const { config } = buildIngestDraft({ kind: s.kind, text: s.text, apiUrl: "/api/tickets" });
      expect(config).toBeDefined();
      expect(config!.name).toBe(s.name);
      expect(config!.fields.find((f) => f.prop === s.prop)?.formtype).toBe(s.formtype);
      expect(config!.fields.find((f) => f.prop === s.prop)?.dataOptions?.length).toBe(2);
      expect(config!.fields.find((f) => f.prop === "title")?.label).toBe(s.label);
      // 与 generate_crud_from_config 同一份 schema:草稿必须过闸。
      expect(validateStructuredConfig(config).valid).toBe(true);
    }
  });

  it("空 interface → 无 config + 兜底告警", () => {
    const { config, warnings } = buildIngestDraft({ kind: "ts-interface", text: "interface X {}" });
    expect(config).toBeUndefined();
    expect(warnings.join("\n")).toContain("未能从该 schema 抽取任何字段");
  });
});
