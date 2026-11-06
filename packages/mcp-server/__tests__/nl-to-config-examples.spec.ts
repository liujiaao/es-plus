import { describe, it, expect } from "vitest";
import { StructuredCrudConfigSchema } from "@es-plus/shared";
import {
  NL_TO_CONFIG_EXAMPLES,
  registerNlToConfigExamplesResource,
} from "../src/resources/nl-to-config-examples.js";

/** 读资源正文（few-shot 的「硬规则」在 buildContent 里，不在示例对象上）。 */
async function resourceText(): Promise<string> {
  let handler: (() => Promise<any>) | null = null;
  const server = {
    resource(_name: string, _uri: string, _meta: any, h: () => Promise<any>) {
      handler = h;
    },
  } as any;
  registerNlToConfigExamplesResource(server);
  expect(handler).not.toBeNull();
  const res = await handler!();
  return res.contents[0].text as string;
}

// The few-shot examples are the primary steering signal for NL→config. If any
// drifts out of sync with the authoritative schema, we'd be teaching the host
// LLM to emit invalid configs. Fail loudly instead.
describe("nl-to-config few-shot examples", () => {
  it("has a non-trivial set of examples", () => {
    expect(NL_TO_CONFIG_EXAMPLES.length).toBeGreaterThanOrEqual(5);
  });

  it("资源正文写明 render / formatter 是代码（无沙箱）", async () => {
    const text = await resourceText();
    // 2026-11-05 拍板：注入面按信任边界处理，文档必须明示。
    expect(text).toContain("are CODE");
    expect(text).toContain("no sandbox");
  });

  for (const ex of NL_TO_CONFIG_EXAMPLES) {
    it(`"${ex.label}" is valid against StructuredCrudConfigSchema`, () => {
      const result = StructuredCrudConfigSchema.safeParse(ex.config);
      if (!result.success) {
        throw new Error(
          `Invalid example config:\n${JSON.stringify(result.error.issues, null, 2)}`
        );
      }
      expect(result.success).toBe(true);
    });

    it(`"${ex.label}" has an NL prompt and reasoning`, () => {
      expect(ex.nl.trim().length).toBeGreaterThan(0);
      expect(ex.reasoning.trim().length).toBeGreaterThan(0);
    });
  }
});
