import { describe, it, expect } from "vitest";
import { registerGenerateCrud } from "../src/tools/generate-crud.js";

/**
 * AN-06 —— `schema.actions` 恒发射 + `view` 只读 + `import` 不再静默无反应。
 *
 * 缺陷形态（修前）：`generateSchema()` 只在 **legacy** 分支发射 `actions`。新模式
 * （`dialogs` / `toolbarBtns` / `tableBtns` / `operationColumn` 任一存在）的产物里没有
 * `actions`，页面端只能走 `props.schema.actions || ['add','edit','delete']` 的硬编码兜底：
 *
 *   · `actions:['view']` 的只读页渲染出「新增/编辑/删除」，点「删除」真的发 DELETE；
 *   · `actions:['export','import']` 的页同样多出三种写操作。
 *
 * 这里钉的是**产物**：四种新模式入口 × 三端，schema 里都必须带着宿主声明的 actions；
 * 且 wrapper 的行为（view 不发写请求 / import 有显式提示）与声明一致。
 */

type Captured = { shape: any; handler: (args: any) => any };

function crudHandler() {
  const tools: Record<string, Captured> = {};
  const server = {
    tool(name: string, _desc: string, shape: any, handler: (args: any) => any) {
      tools[name] = { shape, handler };
    },
    prompt() {},
    resource() {},
  };
  registerGenerateCrud(server as any);
  expect(tools.generate_crud).toBeDefined();
  return tools.generate_crud.handler;
}

const field = (prop: string, label: string, formtype = "Input") => ({ prop, label, formtype });

const BASE = {
  name: "OrderManage",
  apiUrl: "/api/orders",
  mode: "schema" as const,
  typescript: true,
  i18n: false,
};

const SURFACES = {
  table: [field("orderNo", "订单号"), field("customer", "客户")],
  form: [field("orderNo", "订单号"), field("customer", "客户")],
  dialog: ["add", "edit"],
};

/** 从产物里取 `## Schema (schema.ts)` 段的代码。 */
function schemaSection(text: string): string {
  const start = text.indexOf("## Schema (schema.ts)");
  expect(start).toBeGreaterThanOrEqual(0);
  const fence = text.indexOf("```typescript", start);
  const end = text.indexOf("```", fence + "```typescript".length);
  return text.slice(fence + "```typescript".length, end);
}

function wrapperSection(text: string): string {
  const start = text.indexOf("## Wrapper SFC (Page.vue)");
  expect(start).toBeGreaterThanOrEqual(0);
  const fence = text.indexOf("```vue", start);
  const end = text.indexOf("```", fence + "```vue".length);
  return text.slice(fence + "```vue".length, end);
}

/** 读出 schema 里的 `actions` 数组（产物是 JS 对象字面量，该键恒为字符串数组）。 */
function actionsOf(schemaCode: string): string[] {
  const m = schemaCode.match(/"actions": \[([^\]]*)\]/);
  expect(m, `schema 里没有 "actions" 键：\n${schemaCode.slice(0, 400)}`).not.toBeNull();
  return (m![1].match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1));
}

const TARGETS = ["vue3", "vue2", "antdv"] as const;

/**
 * 「新模式」的四种入口 —— 与 `structured-generator.ts` 的 `useNewDialogMode` 判据逐项对应。
 * 修前这四条路径的 schema **都没有** actions；名单本身即是判据，漏掉一条就等于漏掉一种入口。
 */
const NEW_MODE_ENTRIES: Array<{ name: string; extra: Record<string, unknown> }> = [
  { name: "dialogs", extra: {} },
  {
    name: "toolbarBtns",
    extra: { toolbarBtns: [{ name: "新增", key: "add", dialogKey: "add" }] },
  },
  {
    name: "tableBtns",
    extra: { tableBtns: [{ name: "详情", dialogKey: "showDetail" }] },
  },
  {
    name: "operationColumn",
    extra: { operationColumn: { label: "操作", btns: [{ name: "编辑", dialogKey: "edit" }] } },
  },
];

describe("AN-06① schema.actions 恒发射（四种新模式入口 × 三端）", () => {
  for (const entry of NEW_MODE_ENTRIES) {
    for (const target of TARGETS) {
      it(`${entry.name} · ${target}：schema 带着宿主声明的 actions`, async () => {
        const res = await crudHandler()({
          ...BASE,
          target,
          surfaces: SURFACES,
          actions: ["add", "view"],
          ...entry.extra,
        });
        expect(res.isError).toBeFalsy();
        const text = res.content[0].text as string;
        expect(actionsOf(schemaSection(text))).toEqual(["add", "view"]);
        // 摘要行也应如实报告动作面（修前新模式摘要里同样没有依据）。
        expect(text).toContain("Actions: add, view");
      });
    }
  }

  it("legacy 模式（无 dialogs/按钮面）仍然发射 actions —— 键序不变，不引入回归", async () => {
    const res = await crudHandler()({
      ...BASE,
      target: "vue3",
      surfaces: { table: [field("name", "名称")], form: [field("name", "名称")] },
      actions: ["add", "edit", "delete"],
    });
    expect(res.isError).toBeFalsy();
    const code = schemaSection(res.content[0].text as string);
    expect(actionsOf(code)).toEqual(["add", "edit", "delete"]);
    // legacy 的旧形态：dialogFormItems 仍在（action 面没有把它挤掉）。
    expect(code).toContain('"dialogFormItems"');
  });
});

describe("AN-06② view 弹窗只读 / import 不再静默", () => {
  it("view 弹窗不产生任何写请求（add/edit 的写分支保留）", async () => {
    const res = await crudHandler()({
      ...BASE,
      target: "vue3",
      surfaces: { ...SURFACES, dialog: ["add", "edit", "view"] },
      actions: ["add", "edit", "view"],
    });
    expect(res.isError).toBeFalsy();
    const wrapper = wrapperSection(res.content[0].text as string);
    expect(wrapper).toContain("if (dialogKey === 'add')");
    expect(wrapper).toContain("if (dialogKey === 'edit')");
    // 修前这里会有 `if (dialogKey === 'view')` 并 PUT 整行 —— 读操作产生写副作用。
    expect(wrapper).not.toContain("if (dialogKey === 'view')");
    expect(wrapper).not.toMatch(/dialogKey === 'view'[\s\S]{0,80}method: 'PUT'/);
  });

  it("actions 含 import：wrapper 有显式「未实现」提示，不是死按钮", async () => {
    const res = await crudHandler()({
      ...BASE,
      target: "vue3",
      surfaces: SURFACES,
      actions: ["view", "import"],
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text as string;
    const wrapper = wrapperSection(text);
    expect(wrapper).toContain("if (key === 'import')");
    expect(wrapper).toContain("导入尚未实现");
    // 生成期也必须说清楚（不能只在运行时靠一次点击才发现）。
    expect(text).toContain('actions 含 "import"');
  });
});

describe("AN-06③ 顶层 rowkey 进入组合配置", () => {
  it("rowkey 落到 schema.tableOptions，且弹窗 PUT 用的是同一个键", async () => {
    const res = await crudHandler()({
      ...BASE,
      target: "vue3",
      surfaces: SURFACES,
      actions: ["add", "edit"],
      rowkey: "orderNo",
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text as string;
    expect(schemaSection(text)).toContain('"rowkey": "orderNo"');
    expect(wrapperSection(text)).toContain("data.orderNo");
  });

  it("tableOptions 与顶层 rowkey 冲突时取顶层并告警（不静默二选一）", async () => {
    const res = await crudHandler()({
      ...BASE,
      target: "vue3",
      surfaces: SURFACES,
      actions: ["edit"],
      rowkey: "orderNo",
      tableOptions: { rowkey: "id" },
    });
    expect(res.isError).toBeFalsy();
    const text = res.content[0].text as string;
    expect(text).toContain("rowkey 冲突");
    expect(schemaSection(text)).toContain('"rowkey": "orderNo"');
  });
});
