import { describe, it, expect } from "vitest";
import { StructuredCrudConfigSchema } from "@es-plus/shared";
import { NL_TO_CONFIG_EXAMPLES } from "../src/resources/nl-to-config-examples.js";

// The few-shot examples are the primary steering signal for NL→config. If any
// drifts out of sync with the authoritative schema, we'd be teaching the host
// LLM to emit invalid configs. Fail loudly instead.
describe("nl-to-config few-shot examples", () => {
  it("has a non-trivial set of examples", () => {
    expect(NL_TO_CONFIG_EXAMPLES.length).toBeGreaterThanOrEqual(5);
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
