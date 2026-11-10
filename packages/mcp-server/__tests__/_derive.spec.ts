import { describe, it, expect } from "vitest";
import { z } from "zod";
import { deriveSchema, deriveShape, hasDefaults } from "../src/tools/_derive.js";
import {
  tableOptionsSchema,
  formLayoutSchema,
  operationColumnSchema,
  expandConfigSchema,
  treeConfigSchema,
  mergeConfigSchema,
} from "../src/tools/_front-door-knobs.js";
import { StructuredCrudConfigSchema } from "@es-plus/shared";

/**
 * W2 —— 派生层（`_derive.ts`）的契约。
 *
 * 这三件事只要有一件悄悄失效，宿主侧不会报错，只会「行为变了」：
 *   1. `.default()` 被重新注入 → `withRowkey` 把默认 `id` 当成显式配置；
 *   2. 省略语义丢了（剥默认值时顺手把「可缺省」也剥掉）→ 合法配置被判红；
 *   3. 嵌套层没 `.strict()` → 拼错的键在 handler 之前被 strip。
 */

/**
 * 结构指纹：去掉文案与**未知键策略**后逐键比较。
 *
 * `additionalProperties` 必须归一 —— 派生**故意**比 shared 严（shared 默认 strip，
 * 工具入口必须报错），这条差异由 `deriveSchema —— 未知键策略` 单独断言，不能让它
 * 淹没「键集/类型/枚举/minItems 是否同源」这组真正要看的等价关系。
 * `default` 同理：剥默认值就是派生的存在理由，由 `hasDefaults` 单独断言。
 */
function fingerprint(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(fingerprint);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(
          ([k]) =>
            k !== "description" && k !== "$schema" && k !== "additionalProperties" && k !== "default",
        )
        .map(([k, v]) => [k, fingerprint(v)]),
    );
  }
  return node;
}

const jsonSchema = (schema: z.ZodType) =>
  fingerprint(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }));

describe("deriveSchema —— 默认值与省略语义", () => {
  it("剥掉 .default()，但保留「输入可省略」", () => {
    const shared = z.object({
      formtype: z.string().default("Input"),
      mixed: z.number().default(3).optional(),
    });
    const derived = deriveSchema(shared);
    expect(hasDefaults(derived)).toBe(false);
    // 关键：只给空对象也必须合法 —— `.default()` 的另一半语义是「可缺省」。
    expect(derived.safeParse({}).success).toBe(true);
    // 但不能再注入默认值（显式 vs 缺省必须可分）。
    expect(derived.parse({})).toEqual({});
  });

  it("对 shared 的全部前门旋钮都不注入默认值", () => {
    const derived = deriveSchema(StructuredCrudConfigSchema);
    expect(hasDefaults(derived)).toBe(false);
  });
});

describe("deriveSchema —— 未知键策略", () => {
  const shared = z.object({
    top: z.string().optional(),
    nested: z
      .object({ inner: z.string().optional() })
      .optional(),
  });

  it("strict：每一层都拒绝未知键（拼错不再静默消失）", () => {
    const derived = deriveSchema(shared, { extras: "strict" }) as z.ZodObject<any>;
    expect(derived.safeParse({ bogus: 1 }).success).toBe(false);
    expect(derived.safeParse({ nested: { bogus: 1 } }).success).toBe(false);
    expect(derived.safeParse({ nested: { inner: "ok" } }).success).toBe(true);
  });

  it("passthrough：未知键活到 handler（did-you-mean 闸门需要它）", () => {
    const derived = deriveSchema(shared, { extras: "passthrough" });
    expect(derived.parse({ nested: { bogus: 1 } })).toEqual({ nested: { bogus: 1 } });
  });

  it("inherit：保持 shared 的 strip（validate_config 那条路）", () => {
    const derived = deriveSchema(shared, { extras: "inherit" });
    expect(derived.parse({ nested: { inner: "a", bogus: 1 } })).toEqual({ nested: { inner: "a" } });
  });
});

describe("deriveSchema —— 保留叶子检查与描述", () => {
  it("min/regex/refine 与 .describe() 都还在", () => {
    const shared = z.object({
      prop: z
        .string()
        .min(2)
        .regex(/^[a-z]+$/)
        .describe("camelCase key"),
      list: z.array(z.string()).min(1),
    });
    const derived = deriveSchema(shared, { extras: "strict" }) as z.ZodObject<any>;
    expect(derived.shape.prop.description).toBe("camelCase key");
    expect(derived.safeParse({ prop: "a", list: ["x"] }).success).toBe(false); // min(2)
    expect(derived.safeParse({ prop: "AB", list: ["x"] }).success).toBe(false); // regex
    expect(derived.safeParse({ prop: "ab", list: [] }).success).toBe(false); // minItems
    expect(derived.safeParse({ prop: "ab", list: ["x"] }).success).toBe(true);
  });

  it("union / record / lazy 都能重建", () => {
    const node: z.ZodType = z.lazy(() =>
      z.object({
        label: z.string().describe("node label"),
        children: z.array(node).optional(),
      }),
    );
    const derived = deriveSchema(node);
    // lazy 根不是对象：叶子描述从解析后的 JSON Schema 里核对。
    const schema = z.toJSONSchema(derived, { io: "input", unrepresentable: "any" }) as any;
    expect(schema.properties.label.description).toBe("node label");
    expect(derived.safeParse({ label: "a", children: [{ label: "b" }] }).success).toBe(true);
    // 自指也要 strict：子节点里的未知键同样不能静默消失。
    expect(derived.safeParse({ label: "a", children: [{ bogus: 1 }] }).success).toBe(false);
    expect(derived.safeParse({ label: "a", children: [{ label: "b", bogus: 1 }] }).success).toBe(false);
  });
});

describe("前门旋钮 = shared 降一档默认值后的同一形状", () => {
  const pairs: Array<[string, z.ZodType, z.ZodType]> = [
    ["tableOptions", tableOptionsSchema, StructuredCrudConfigSchema.shape.tableOptions],
    ["formLayout", formLayoutSchema, StructuredCrudConfigSchema.shape.formLayout],
    ["operationColumn", operationColumnSchema, StructuredCrudConfigSchema.shape.operationColumn],
    ["expandConfig", expandConfigSchema, StructuredCrudConfigSchema.shape.expandConfig],
    ["treeConfig", treeConfigSchema, StructuredCrudConfigSchema.shape.treeConfig],
    ["mergeConfig", mergeConfigSchema, StructuredCrudConfigSchema.shape.mergeConfig],
  ];

  it.each(pairs)("%s：结构指纹与 shared 一致（除 strict 与默认值）", (_name, mirror, shared) => {
    expect(jsonSchema(mirror)).toEqual(jsonSchema(shared));
  });

  it("每个旋钮都不含默认值", () => {
    for (const [, mirror] of pairs) expect(hasDefaults(mirror)).toBe(false);
  });
});

describe("deriveShape —— MCP SDK 只要形状", () => {
  it("返回键集与 shared 顶层一致", () => {
    const shape = deriveShape(
      z.object({ a: z.string().default("x"), b: z.number().optional() }),
    );
    expect(Object.keys(shape)).toEqual(["a", "b"]);
  });
});
