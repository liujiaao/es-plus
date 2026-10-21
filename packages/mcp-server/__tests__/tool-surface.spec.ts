import { describe, it, expect } from "vitest";
import { registerTools, resolveToolProfile, type ToolProfile } from "../src/tools/index.js";

/**
 * AN-26 —— 工具面 profile。
 *
 * 守卫脚本（`check:tool-surface`）从源码打包后验证同一件事；这里钉住**注册层**，
 * 这样 `npm test` 不依赖 esbuild 也能发现「profile 藏错工具 / 多了第二个 FRONT DOOR」。
 */

const FULL_TOOLS = [
  "detect_project_target",
  "generate_crud",
  "generate_form",
  "generate_table",
  "generate_dialog",
  "generate_crud_page",
  "generate_crud_schema",
  "generate_crud_from_config",
  "validate_config",
  "list_form_types",
  "ingest_schema",
  "refine_config",
  "get_component_api",
  "scaffold_page",
  "doctor_page",
];

function capture(profile: ToolProfile) {
  const tools: Array<{ name: string; description: string }> = [];
  const fake = {
    tool: (name: string, description: string) => {
      tools.push({ name, description });
    },
  };
  registerTools(fake as any, profile);
  return tools;
}

describe("registerTools — full profile", () => {
  const tools = capture("full");
  const names = tools.map((t) => t.name);

  it("注册全部 15 个工具且无重复", () => {
    expect(names).toEqual(FULL_TOOLS);
    expect(new Set(names).size).toBe(names.length);
  });

  it("只有 generate_crud 带 FRONT DOOR 标签", () => {
    const labelled = tools.filter((t) => /FRONT DOOR/.test(t.description));
    expect(labelled.map((t) => t.name)).toEqual(["generate_crud"]);
  });

  it("高级/legacy 工具的描述带层级标签", () => {
    const byName = new Map(tools.map((t) => [t.name, t.description]));
    expect(byName.get("generate_crud_from_config")).toMatch(/^ADVANCED\b/);
    expect(byName.get("generate_crud_page")).toMatch(/^LEGACY FALLBACK\b/);
    expect(byName.get("generate_crud_schema")).toMatch(/^LEGACY FALLBACK\b/);
  });
});

describe("registerTools — front-door profile", () => {
  const tools = capture("front-door");
  const names = tools.map((t) => t.name);

  it("隐藏 1 个高级 + 2 个 legacy 工具", () => {
    for (const hidden of [
      "generate_crud_from_config",
      "generate_crud_page",
      "generate_crud_schema",
    ]) {
      expect(names).not.toContain(hidden);
    }
  });

  it("前门、单面片段与支撑工具一个不少", () => {
    for (const kept of FULL_TOOLS.filter(
      (n) => !["generate_crud_from_config", "generate_crud_page", "generate_crud_schema"].includes(n),
    )) {
      expect(names).toContain(kept);
    }
  });
});

describe("resolveToolProfile", () => {
  it("未设置 / 未知值回落 full（不静默改变工具面）", () => {
    expect(resolveToolProfile(undefined)).toBe("full");
    expect(resolveToolProfile("")).toBe("full");
    expect(resolveToolProfile("full")).toBe("full");
    expect(resolveToolProfile("bogus")).toBe("full");
  });

  it("front-door 大小写与空白不敏感", () => {
    expect(resolveToolProfile("front-door")).toBe("front-door");
    expect(resolveToolProfile("  FRONT-DOOR  ")).toBe("front-door");
  });
});
