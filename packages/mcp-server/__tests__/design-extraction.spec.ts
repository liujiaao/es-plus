import { describe, it, expect } from "vitest";
import { registerPrompts } from "../src/prompts/index.js";
import { registerResources } from "../src/resources/index.js";
import {
  DESIGN_EXTRACTION_URI,
  buildDesignExtractionContent,
  registerDesignExtractionResource,
} from "../src/resources/design-extraction.js";

// AN-19: "first mile" contract. Two failure modes are worth pinning:
//   1. the resource is not reachable from the aggregate registry (a client can
//      never read the contract the prompt tells it to read);
//   2. the contract silently loses its load-bearing clauses — image boundary,
//      the "presence = membership" rule, the read-only negative, or the
//      system-field negative. Each of those has a concrete downstream failure
//      (server asked to read images; `inQuery` emitted into the front door;
//      a read-only page getting an edit form), so they are asserted as text.

function makeResourceServer() {
  const resources: Record<string, { meta: any; handler: (uri: URL) => any }> = {};
  const server = {
    resource(name: string, uri: string, meta: any, handler: (uri: URL) => any) {
      resources[uri] = { meta, handler };
    },
  };
  return { server: server as any, resources };
}

async function readResource(uri: string): Promise<string> {
  const { server, resources } = makeResourceServer();
  registerDesignExtractionResource(server);
  expect(resources[uri], `未注册资源 ${uri}`).toBeDefined();
  const res = await resources[uri].handler(new URL(uri));
  return res.contents[0].text as string;
}

describe("esplus://design-extraction", () => {
  it("is registered by the aggregate resources registry", async () => {
    const { server, resources } = makeResourceServer();
    registerResources(server);
    expect(resources[DESIGN_EXTRACTION_URI], "registerResources 漏掉了 design-extraction").toBeDefined();
    const res = await resources[DESIGN_EXTRACTION_URI].handler(new URL(DESIGN_EXTRACTION_URI));
    expect(res.contents[0].text).toBe(buildDesignExtractionContent());
  });

  it("declares text-only input and delegates images to the host", async () => {
    const text = await readResource(DESIGN_EXTRACTION_URI);
    expect(text).toContain("never receives screenshots");
    expect(text).toContain("performs no OCR");
    expect(text).toContain("HOST's vision model");
    expect(text).toContain("does not accept images");
  });

  it("states the membership rule and the forbidden membership flags", async () => {
    const text = await readResource(DESIGN_EXTRACTION_URI);
    expect(text).toContain("Membership is expressed by presence in a list");
    expect(text).toContain("Never emit");
    expect(text).toContain("inQuery");
    expect(text).toContain("inTable");
    expect(text).toContain("inForm");
  });

  it("covers all four surfaces and the dialog object form", async () => {
    const text = await readResource(DESIGN_EXTRACTION_URI);
    for (const key of ["query", "table", "form", "dialog"]) {
      expect(text).toContain(`\`${key}\``);
    }
    expect(text).toContain("formItems");
    expect(text).toContain("canned keys");
  });

  it("keeps the two load-bearing negatives: read-only, system fields", async () => {
    const text = await readResource(DESIGN_EXTRACTION_URI);
    expect(text).toContain("只读");
    expect(text).toContain("创建时间");
    expect(text).toContain("never form");
  });

  it("has positive and negative worked examples plus a checklist", async () => {
    const text = await readResource(DESIGN_EXTRACTION_URI);
    expect(text).toContain("Worked positives");
    expect(text).toContain("Worked negatives");
    expect(text).toContain("Checklist before calling the tool");
    // At least the no-table positive must be present — it is the front door branch
    // that is easiest to "helpfully" complete with an invented table.
    expect(text).toContain("no table, search form only");
  });
});

describe("spec-to-surfaces prompt", () => {
  function promptHandlers() {
    const prompts: Record<string, any> = {};
    const server = {
      prompt(name: string, desc: string, shape: any, handler: (args: any) => any) {
        prompts[name] = { desc, shape, handler };
      },
    };
    registerPrompts(server as any);
    return prompts;
  }

  it("is registered and points at the design-extraction resource", async () => {
    const prompts = promptHandlers();
    expect(prompts["spec-to-surfaces"]).toBeDefined();
    const res = await prompts["spec-to-surfaces"].handler({
      spec: "用户管理：可按用户名筛选；列表展示用户名、状态；支持新增、编辑。",
      target: "vue3",
      mode: "schema",
    });
    const text = res.messages[0].content.text as string;
    expect(text).toContain(DESIGN_EXTRACTION_URI);
    expect(text).toContain("never emit");
    expect(text).toContain("does not accept images");
    expect(text).toContain("用户管理：可按用户名筛选");
    expect(text).toContain('"target": "vue3"');
  });

  it("defaults to vue3/schema and forwards the chosen target", async () => {
    const prompts = promptHandlers();
    const res = await prompts["spec-to-surfaces"].handler({ spec: "订单台账，只读。" });
    const text = res.messages[0].content.text as string;
    expect(text).toContain('"target": "vue3"');
    expect(text).toContain('"mode": "schema"');
    expect(text).toContain("@es-plus/vue3");

    const antdv = await prompts["spec-to-surfaces"].handler({ spec: "订单台账，只读。", target: "antdv" });
    expect(antdv.messages[0].content.text).toContain("@es-plus/adapter-antdv");
  });
});
