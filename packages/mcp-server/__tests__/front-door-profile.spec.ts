import { describe, it, expect } from "vitest";
import { registerPrompts } from "../src/prompts/index.js";
import { registerResources } from "../src/resources/index.js";
import { registerTools, resolveToolProfile } from "../src/tools/index.js";
import { buildInstructions } from "../src/instructions.js";

/**
 * AN-26 —— profile 与「提示词/资源」同源。
 *
 * `ESPLUS_MCP_PROFILE=front-door` 下 `generate_crud_from_config` /
 * `generate_crud_page` / `generate_crud_schema` 不注册。若 prompts/resources 仍写
 * 「去调那个工具」，宿主照着执行只会拿到 tool not found —— 工具面与引导面互相打脸，
 * 且**没有任何运行时错误**提示这是一处契约分叉。本文件钉住两条腿：
 *   1. front-door 引导里不得再出现「调用被隐藏工具」的指令；
 *   2. full 引导必须保持原样（默认 profile 的行为不得被这次适配改动）。
 */

type PromptCaptured = { desc: string; handler: (args: any) => any };
type ResourceCaptured = { meta: any; handler: (uri: URL) => any };

function capturePrompts(profile: "full" | "front-door") {
  const prompts: Record<string, PromptCaptured> = {};
  const server = {
    prompt(name: string, desc: string, _shape: any, handler: (args: any) => any) {
      prompts[name] = { desc, handler };
    },
  };
  registerPrompts(server as any, profile);
  return prompts;
}

function captureResources(profile: "full" | "front-door") {
  const resources: Record<string, ResourceCaptured> = {};
  const server = {
    resource(_name: string, uri: string, meta: any, handler: (uri: URL) => any) {
      resources[uri] = { meta, handler };
    },
  };
  registerResources(server as any, profile);
  return resources;
}

async function promptText(profile: "full" | "front-door"): Promise<string> {
  const prompts = capturePrompts(profile);
  expect(prompts["crud-page"]).toBeDefined();
  const res = await prompts["crud-page"].handler({
    description: "用户管理：查询 + 表格 + 新增/编辑",
    target: "vue3",
    mode: "schema",
  });
  return res.messages[0].content.text as string;
}

async function resourceText(profile: "full" | "front-door", uri: string): Promise<string> {
  const resources = captureResources(profile);
  expect(resources[uri], `未注册资源 ${uri}`).toBeDefined();
  const res = await resources[uri].handler(new URL(uri));
  return res.contents[0].text as string;
}

const HIDDEN = ["generate_crud_from_config", "generate_crud_page", "generate_crud_schema"];

describe("crud-page 提示词", () => {
  it("full：保持原引导（DRAFT config → generate_crud_from_config）", async () => {
    const text = await promptText("full");
    expect(text).toContain("call the\n`generate_crud_from_config` tool");
    expect(text).not.toContain("ESPLUS_MCP_PROFILE=front-door");
  });

  it("front-door：改指 generate_crud 的 surfaces，并点名被隐藏的工具", async () => {
    const text = await promptText("front-door");
    expect(text).toContain("`generate_crud`");
    expect(text).toContain("surfaces");
    expect(text).toContain("ESPLUS_MCP_PROFILE=front-door");
    expect(text).toContain("NOT registered");
    // 关键：不得留下「去调隐藏工具」的祈使句（工具名只允许出现在 NOT registered 那句里）
    expect(text).not.toContain("call the\n`generate_crud_from_config` tool");
    expect(text).not.toContain("Preferred path: for most requests, DRAFT a StructuredCrudConfig");
    for (const hidden of HIDDEN) expect(text).toContain(hidden); // 同句点名，便于宿主自查
  });
});

describe("conventions 资源", () => {
  it("full：Structured-Config 一节的标题仍是 generate_crud_from_config", async () => {
    const text = await resourceText("full", "esplus://conventions");
    expect(text).toContain("# Structured Config Tool (generate_crud_from_config)");
    expect(text).toContain("Use `generate_crud_from_config` instead of `generate_crud_page`");
  });

  it("front-door：标题/去处改为 generate_crud，并说明校验工具仍可用", async () => {
    for (const uri of ["esplus://conventions", "esplus://conventions/vue3", "esplus://conventions/vue2", "esplus://conventions/antdv"]) {
      const text = await resourceText("front-door", uri);
      expect(text, uri).not.toContain("# Structured Config Tool (generate_crud_from_config)");
      expect(text, uri).not.toContain("Use `generate_crud_from_config` instead of");
      expect(text, uri).toContain("# Structured Config (the model generate_crud fills for you)");
      expect(text, uri).toContain("NOT registered");
      // 配置形状本身仍是权威参考：校验/精修工具在 front-door 下保留
      expect(text, uri).toContain("validate_config({ type: 'structured-crud-config' })");
      expect(text, uri).toContain("refine_config");
    }
  });
});

describe("examples 资源", () => {
  it("full：engine 说明指向 generate_crud_page", async () => {
    const text = await resourceText("full", "esplus://examples");
    expect(text).toContain("the same engine the `generate_crud_page` tool calls");
  });

  it("front-door：engine 说明指向 generate_crud（schema mode）", async () => {
    const text = await resourceText("front-door", "esplus://examples");
    expect(text).toContain("`generate_crud` (schema mode)");
    expect(text).not.toContain("the `generate_crud_page` tool calls");
  });
});

describe("nl-to-config 资源", () => {
  it("full：使用说明指向 generate_crud_from_config", async () => {
    const text = await resourceText("full", "esplus://examples/nl-to-config");
    expect(text).toContain("Use these when constructing the `generate_crud_from_config` input");
  });

  it("front-door：正文与描述都不再让人「拿它去调隐藏工具」", async () => {
    const resources = captureResources("front-door");
    const entry = resources["esplus://examples/nl-to-config"];
    const text = await resourceText("front-door", "esplus://examples/nl-to-config");
    expect(text).not.toContain("Use these when constructing the `generate_crud_from_config` input");
    expect(text).toContain("generate_crud");
    expect(text).toContain("surfaces");
    // 描述（host 在 list 时看到的第一句）同样不得引导到隐藏工具
    expect(entry.meta.description).not.toContain("before calling generate_crud_from_config");
    expect(entry.meta.description).toContain("generate_crud");
  });
});

describe("resolveToolProfile 的单一来源", () => {
  it("工具层导出的解析器仍是同一实现（默认值不变）", () => {
    expect(resolveToolProfile(undefined)).toBe("full");
    expect(resolveToolProfile("front-door")).toBe("front-door");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// instructions 与**工具描述**：同一处契约分叉的另外两面
//
// 提示词/资源改好了，但宿主读到的还有两处：initialize 的 instructions，和
// tools/list 里每个工具自己的 description。只要其中一处仍写「把配置交给
// generate_crud_from_config」，front-door 档下宿主就会走到 tool not found ——
// 而且此前 instructions 正文与追加的档位说明**自相矛盾**（正文说「仍可用」，
// 追加段说「不注册」）。
// ─────────────────────────────────────────────────────────────────────────────

/** 只捕获 `(name, description)` 与入参形状 —— 描述是宿主在 tools/list 里真正读到的文本。 */
function captureToolDescriptions(profile: "full" | "front-door"): Record<string, { desc: string; shape: any }> {
  const tools: Record<string, { desc: string; shape: any }> = {};
  const server = {
    tool(name: string, desc: string, shape: any) {
      tools[name] = { desc, shape };
    },
  };
  registerTools(server as any, profile);
  return tools;
}

/** 某个入参的 `.describe()` 文本（`validate_config` 的指路写在这里，不在工具描述里）。 */
function paramDesc(tool: { shape: any }, key: string): string {
  return (tool.shape?.shape?.[key]?._def?.description as string) ?? "";
}

describe("server instructions", () => {
  it("full：保留「高级路径仍可用」的原话，不追加档位说明（默认档不变）", () => {
    const text = buildInstructions("full");
    expect(text).toContain("`generate_crud_from_config` remains available");
    expect(text).not.toContain("Tool profile (front-door)");
  });

  it("front-door：不再宣称未注册的工具可用（正文与追加段不得互相打脸）", () => {
    const text = buildInstructions("front-door");
    expect(text).not.toContain("remains available");
    expect(text).toContain("is the only code-generation entry in this profile");
    expect(text).toContain("Tool profile (front-door)");
    expect(text).toContain("are NOT registered");
    // 工具清单只列已注册的生成入口
    expect(text).not.toContain("generate_crud_from_config /");
  });
});

describe("工具描述（tools/list 的第一句）", () => {
  const full = captureToolDescriptions("full");
  const frontDoor = captureToolDescriptions("front-door");

  it("front-door：12 个已注册工具的描述都不把宿主指向被隐藏的工具", () => {
    expect(Object.keys(frontDoor)).toHaveLength(12);
    for (const [name, { desc }] of Object.entries(frontDoor)) {
      for (const hidden of HIDDEN) {
        expect(desc, `${name} 的描述里出现了未注册的 ${hidden}`).not.toContain(hidden);
      }
    }
    // 入参描述同属工具面（宿主在 schema 里读得到），同样不得指路到隐藏工具
    expect(paramDesc(frontDoor.validate_config, "type")).not.toContain("generate_crud_from_config");
    expect(paramDesc(frontDoor.validate_config, "type")).toContain("structured-crud-config");
  });

  it("full：支撑工具的指路保持原样（默认档行为不变）", () => {
    expect(full.refine_config.desc).toContain("generate_crud_from_config");
    expect(full.ingest_schema.desc).toContain("generate_crud_from_config");
    expect(full.detect_project_target.desc).toContain("generate_crud_page");
    expect(paramDesc(full.validate_config, "type")).toContain("the input of generate_crud_from_config");
    // 前门自己的描述不再把「高级路径」当作参照（键集语义改指配置块，两种档位同一句）
    expect(full.generate_crud.desc).not.toContain("generate_crud_from_config");
    expect(paramDesc(full.generate_crud, "tableOptions")).toContain("StructuredCrudConfig.tableOptions");
    expect(paramDesc(frontDoor.generate_crud, "tableOptions")).not.toContain("generate_crud_from_config");
  });

  it("refine_config：两种档位都点名「块级差异」，加弹窗/改布局不再算「无差异」", () => {
    for (const { desc } of [full.refine_config, frontDoor.refine_config]) {
      expect(desc).toContain("top-level blocks");
      expect(desc).toContain("dialogs");
      expect(desc).toContain("formLayout");
    }
  });

  it("ingest_schema / detect_project_target：front-door 下改指前门与单面工具", () => {
    expect(frontDoor.ingest_schema.desc).toContain("`generate_crud`'s `surfaces`");
    expect(frontDoor.detect_project_target.desc).toContain("generate_crud / generate_form");
  });
});
