import { describe, it, expect } from "vitest";
import { buildSemanticWarnings } from "../src/tools/generate-from-config.js";

// Non-blocking semantic invariants surfaced to the host LLM. These never block
// generation (the config is already schema-valid); they flag likely-wrong maps.
describe("buildSemanticWarnings", () => {
  const baseField = { prop: "name", label: "名称", formtype: "Input" };

  it("warns when an add dialog has no formItems (empty modal body)", () => {
    const w = buildSemanticWarnings({
      fields: [baseField],
      actions: ["add"],
      dialogs: { add: { title: "新增" } },
    });
    expect(w.some((m) => m.includes('dialog "add"') && m.includes("no formItems"))).toBe(true);
  });

  it("warns when an edit dialog has an empty formItems array", () => {
    const w = buildSemanticWarnings({
      fields: [baseField],
      actions: ["edit"],
      dialogs: { edit: { title: "编辑", formItems: [] } },
    });
    expect(w.some((m) => m.includes('dialog "edit"') && m.includes("no formItems"))).toBe(true);
  });

  it("does NOT warn when the add/edit dialog carries formItems", () => {
    const w = buildSemanticWarnings({
      fields: [baseField],
      actions: ["add", "edit"],
      dialogs: {
        add: { title: "新增", formItems: [baseField] },
        edit: { title: "编辑", formItems: [baseField] },
      },
    });
    expect(w.some((m) => m.includes("no formItems"))).toBe(false);
  });

  it("does NOT emit the empty-formItems warning for a non add/edit dialog key", () => {
    // A "view"/detail dialog legitimately has no form inputs — only add/edit
    // dialogs should trigger the empty-body warning.
    const w = buildSemanticWarnings({
      fields: [baseField],
      actions: ["view"],
      dialogs: { view: { title: "查看" } },
    });
    expect(w.some((m) => m.includes("no formItems"))).toBe(false);
  });

  it("still flags a dialog formItem prop absent from the top-level fields", () => {
    const w = buildSemanticWarnings({
      fields: [baseField],
      actions: ["edit"],
      dialogs: {
        edit: {
          title: "编辑",
          formItems: [baseField, { prop: "ghost", label: "幽灵", formtype: "Input" }],
        },
      },
    });
    expect(w.some((m) => m.includes('"ghost"') && m.includes("not in the top-level fields"))).toBe(true);
  });
});
