import { describe, it, expect } from "vitest";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";
import { registerGenerateForm } from "../src/tools/generate-form.js";
import { registerGenerateTable } from "../src/tools/generate-table.js";
import { registerGenerateDialog } from "../src/tools/generate-dialog.js";
import { registerPrompts } from "../src/prompts/index.js";

// These exercise the deterministic generate_* front door / fragment tools and
// the two MCP prompts end-to-end: capture each register call on a mock server,
// then invoke the real handler. Pure functions underneath are golden-covered;
// here we prove the MCP-facing routing/branching (surfaces → compose vs
// fragments, per-target prompt text) is wired and does not throw.

type Captured = { desc: string; shape: any; handler: (args: any) => any };

function makeMockServer() {
  const tools: Record<string, Captured> = {};
  const prompts: Record<string, Captured> = {};
  const server = {
    tool(name: string, desc: string, shape: any, handler: (args: any) => any) {
      tools[name] = { desc, shape, handler };
    },
    prompt(name: string, desc: string, shape: any, handler: (args: any) => any) {
      prompts[name] = { desc, shape, handler };
    },
  };
  return { server: server as any, tools, prompts };
}

const field = (prop: string, label: string, formtype = "Input", extra: any = {}) => ({
  prop,
  label,
  formtype,
  ...extra,
});

const statusField = field("status", "状态", "Select", {
  dataOptions: [
    { label: "启用", value: 1 },
    { label: "禁用", value: 0 },
  ],
});

function crudHandler() {
  const { server, tools } = makeMockServer();
  registerGenerateCrud(server);
  expect(tools.generate_crud).toBeDefined();
  return tools.generate_crud.handler;
}

const baseCrud = {
  name: "UserManage",
  apiUrl: "/api/users",
  target: "vue3",
  mode: "schema",
  typescript: true,
  i18n: false,
};

describe("generate_crud front door — surface routing", () => {
  it("errors when surfaces is empty", async () => {
    const res = await crudHandler()({ ...baseCrud, surfaces: {} });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("`surfaces` is empty");
  });

  it("table-bearing request routes through the golden generator (schema mode)", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: {
        query: [field("name", "名称")],
        table: [field("name", "名称"), statusField],
        form: [field("name", "名称")],
        dialog: ["add", "edit"],
      },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Schema (schema.ts)");
    expect(res.content[0].text).toContain("## Wrapper SFC (Page.vue)");
  });

  it("table-bearing request in sfc mode emits a single SFC", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      mode: "sfc",
      surfaces: { table: [field("name", "名称"), statusField], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Generated SFC");
  });

  it("query-only (no table) emits a standalone query fragment", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { query: [field("keyword", "关键词")] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("standalone fragment");
    expect(res.content[0].text).toContain("## Query form (QueryForm.vue)");
  });

  it("form + dialog (no table) emits a dialog composable", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")], dialog: ["add"] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("Dialog composable (useFormDialog)");
  });

  it("form-only (no table, no dialog) emits a standalone submit form", async () => {
    const res = await crudHandler()({
      ...baseCrud,
      surfaces: { form: [field("name", "名称")] },
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("## Form (FormBlock.vue)");
  });
});

describe("standalone fragment tools", () => {
  it("generate_form emits a .vue fragment", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateForm(server);
    expect(tools.generate_form).toBeDefined();
    const res = await tools.generate_form.handler({
      fields: [field("name", "名称"), statusField],
      target: "vue3",
      typescript: true,
      i18n: false,
      context: "form",
      buttons: "submit",
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```vue");
  });

  it("generate_table emits a .vue fragment", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateTable(server);
    expect(tools.generate_table).toBeDefined();
    const res = await tools.generate_table.handler({
      fields: [field("name", "名称"), statusField],
      apiUrl: "/api/users",
      target: "vue3",
      typescript: true,
      i18n: false,
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```vue");
  });

  it("generate_dialog emits a .tsx composable", async () => {
    const { server, tools } = makeMockServer();
    registerGenerateDialog(server);
    expect(tools.generate_dialog).toBeDefined();
    const res = await tools.generate_dialog.handler({
      fields: [field("name", "名称")],
      apiUrl: "/api/users",
      target: "vue3",
      typescript: true,
      i18n: false,
    });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("```tsx");
  });
});

describe("prompts — registration + per-target rendering", () => {
  function promptHandlers() {
    const { server, prompts } = makeMockServer();
    registerPrompts(server);
    expect(prompts["crud-page"]).toBeDefined();
    expect(prompts["form-config"]).toBeDefined();
    return prompts;
  }

  it("crud-page renders target-specific notes for every target", async () => {
    const prompts = promptHandlers();
    const markers: Record<string, string> = {
      vue3: "Element Plus",
      vue2: "Element UI",
      antdv: "Ant Design Vue",
    };
    for (const [target, marker] of Object.entries(markers)) {
      const res = await prompts["crud-page"].handler({
        description: "用户管理页",
        target,
        mode: "schema",
      });
      const text = res.messages[0].content.text;
      expect(text).toContain(marker);
      expect(text).toContain("CrudPageSchema JSON");
    }
  });

  it("crud-page sfc mode switches the output instruction", async () => {
    const prompts = promptHandlers();
    const res = await prompts["crud-page"].handler({
      description: "用户管理页",
      target: "vue3",
      mode: "sfc",
    });
    expect(res.messages[0].content.text).toContain("complete Vue SFC");
  });

  it("crud-page defaults to vue3 when target is omitted", async () => {
    const prompts = promptHandlers();
    const res = await prompts["crud-page"].handler({
      description: "用户管理页",
      mode: "schema",
    });
    expect(res.messages[0].content.text).toContain("@es-plus/vue3");
  });

  it("form-config renders per-target UI-library notes", async () => {
    const prompts = promptHandlers();
    const markers: Record<string, string> = {
      vue3: "Element Plus",
      vue2: "Element UI",
      antdv: "Ant Design Vue",
    };
    for (const [target, marker] of Object.entries(markers)) {
      const res = await prompts["form-config"].handler({ description: "一个表单", target });
      expect(res.messages[0].content.text).toContain(marker);
    }
  });

  it("form-config defaults to vue3 when target is omitted", async () => {
    const prompts = promptHandlers();
    const res = await prompts["form-config"].handler({ description: "一个表单" });
    expect(res.messages[0].content.text).toContain("@es-plus/vue3");
  });
});
