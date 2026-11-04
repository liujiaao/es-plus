import { describe, it, expect } from "vitest";
import { z } from "zod";
import { emitComposition } from "@es-plus/shared";
import { registerGenerateComposition } from "../src/tools/generate-composition.js";
import { SCENE_INTENT_SCHEMAS } from "../src/tools/generate-scene.js";

/**
 * P7 — 组合页入口（`generate_composition`）。
 *
 * 钉住四件事：
 *   ① 每个节点的 intent 用**所属场景的同一份** Zod 形状校验（未知键在生成前点名，
 *      不会产出半成品页面）；
 *   ② 节点成功时文本与直接调 `emitComposition` 完全一致（工具层不二次加工产物，
 *      也不另写一份意图解析）；
 *   ③ `planComposition` 的结构化拒绝原样透出（两个 form 节点 / 非法接线）；
 *   ④ 入口形状本身拒绝空节点与 `crud` 节点（后者在 handler 里还有一层防御文案）；
 *   ⑤ `@3` 的三个新旋钮（role / behavior / wires）只是**透传**，语义与校验全在
 *      `planComposition` 一处实现 —— 工具层不复制第二份规则。
 */

type Captured = { shape: any; handler: (args: any) => any };

function capture() {
  const tools: Record<string, Captured> = {};
  registerGenerateComposition({
    tool(n: string, _d: string, shape: any, handler: (args: any) => any) {
      tools[n] = { shape, handler };
    },
  });
  const tool = tools["generate_composition"];
  if (!tool) throw new Error("not registered: generate_composition");
  return tool;
}

function call(tool: Captured, args: any) {
  return tool.handler(z.object(tool.shape).passthrough().parse(args));
}

const field = (prop: string, label: string, formtype = "Input") => ({ prop, label, formtype });

const tableIntent = {
  fields: [field("name", "姓名"), field("status", "状态", "Select")],
  rowButtons: [{ key: "edit", name: "编辑" }, { key: "view", name: "查看" }],
  target: "vue3",
};
const formIntent = {
  fields: [field("keyword", "关键字")],
  context: "query",
  buttons: "query",
  target: "vue3",
};
const dialogIntent = {
  fields: [field("name", "姓名")],
  mode: "component",
  defaultTitle: "编辑用户",
  target: "vue3",
};

describe("generate_composition — 组合页入口", () => {
  const tool = capture();

  it("产物与 emitComposition 逐字节一致（工具层不改写页面）", async () => {
    const result = await call(tool, {
      name: "用户页",
      target: "vue3",
      nodes: [
        { id: "users", scene: "table", intent: tableIntent },
        { id: "filter", scene: "form", intent: formIntent },
        { id: "edit", scene: "dialog", intent: dialogIntent },
      ],
    });
    expect(result.isError).toBeFalsy();
    const direct = emitComposition({
      name: "用户页",
      target: "vue3",
      nodes: [
        { id: "users", plan: { scene: "table", intent: SCENE_INTENT_SCHEMAS.table.parse(tableIntent) } },
        { id: "filter", plan: { scene: "form", intent: SCENE_INTENT_SCHEMAS.form.parse(formIntent) } },
        { id: "edit", plan: { scene: "dialog", intent: SCENE_INTENT_SCHEMAS.dialog.parse(dialogIntent) } },
      ],
    } as any);
    expect(result.content[0].text).toBe(direct.text);
    // 页面标题取节点声明的 defaultTitle，而不是按 id 派生的兜底标题。
    expect(result.content[0].text).toContain("编辑用户");
  });

  it("未知键在生成前被点名（带节点 id），不产出半成品", async () => {
    const result = await call(tool, {
      nodes: [{ id: "users", scene: "table", intent: { fields: [], rowButtns: [] } }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"users"');
    expect(result.content[0].text).toContain("rowButtns");
  });

  it("场景形状拒绝 'crud' 节点；handler 的防御文案也可达", async () => {
    expect(() =>
      z.object(tool.shape).passthrough().parse({
        nodes: [{ id: "page", scene: "crud", intent: {} }],
      })
    ).toThrow();

    // 绕过形状直接喂 handler（防的是形状以后被放宽时不再静默产页）。
    const result = await tool.handler({ nodes: [{ id: "page", scene: "crud", intent: {} }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("crud");
  });

  it("两个 form 节点由 planComposition 拒绝，错误原样透出", async () => {
    const result = await call(tool, {
      nodes: [
        { id: "a", scene: "form", intent: formIntent },
        { id: "b", scene: "form", intent: formIntent },
      ],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/form 场景出现了 2 个节点/);
  });

  it("@3：role / behavior / wires 原样透传给 planComposition", async () => {
    const result = await call(tool, {
      nodes: [
        { id: "users", role: "master", scene: "table", intent: tableIntent },
        { id: "items", scene: "table", intent: { ...tableIntent, rowButtons: [] } },
        { id: "filter", scene: "form", intent: formIntent },
      ],
      wires: [
        {
          from: { node: "users", channel: "row-action" },
          to: { node: "items", channel: "reload" },
          when: { rowAction: "view" },
        },
      ],
    });
    expect(result.isError, result.content[0].text).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('[role=master]');
    expect(text).toContain("Behavior: data-wiring");
    expect(text).toContain('users.row-action (key=view) → items.reload');
    // 多表暴露面按节点派生，master 另有一对缺省别名。
    expect(text).toContain("exposes refresh/reload/usersRefresh/usersReload/itemsRefresh/itemsReload");
  });

  it("@3：behavior=ui-only 关闭派生数据接线", async () => {
    const result = await call(tool, {
      behavior: "ui-only",
      nodes: [
        { id: "users", scene: "table", intent: tableIntent },
        { id: "filter", scene: "form", intent: formIntent },
      ],
    });
    expect(result.isError, result.content[0].text).toBeFalsy();
    expect(result.content[0].text).toContain("Behavior: ui-only（数据通道升级为页面事件）");
  });

  it("@3：非法接线由 planComposition 结构化拒绝（工具层不重复规则）", async () => {
    const result = await call(tool, {
      nodes: [{ id: "users", scene: "table", intent: tableIntent }],
      wires: [{ from: { node: "users", channel: "row-action" }, to: { page: "emit", event: "x" } }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/必须声明 when\.rowAction/);
  });

  it("P11 复核：to.model / behavior=data-wiring 原样透传，主从只映射声明字段", async () => {
    const result = await call(tool, {
      behavior: "ui-only",
      nodes: [
        { id: "users", role: "master", scene: "table", intent: tableIntent },
        { id: "items", scene: "table", intent: { ...tableIntent, rowButtons: [] } },
      ],
      wires: [
        {
          from: { node: "users", channel: "row-action" },
          to: { node: "items", channel: "reload", model: { userId: "$row.id" } },
          when: { rowAction: "view" },
        },
      ],
    });
    expect(result.isError, result.content[0].text).toBeFalsy();
    expect(result.content[0].text).toContain("itemsRef.value?.reload?.({ 'userId': payload.row?.id })");
    // 默认档位名与 HTTP 请求边界都要如实出现在正文里（不再叫 crud-requests）。
    const plain = await call(tool, {
      nodes: [
        { id: "users", scene: "table", intent: tableIntent },
        { id: "filter", scene: "form", intent: formIntent },
      ],
    });
    expect(plain.content[0].text).toContain("Behavior: data-wiring");
  });

  it("P11 复核：接线目标的『可调用 + 按钮真的存在』由 planComposition 拒绝并原样透出", async () => {
    const base = () => [
      { id: "users", scene: "table", intent: tableIntent },
      { id: "filter", scene: "form", intent: formIntent },
    ];
    const ghost = await call(tool, {
      nodes: base(),
      wires: [
        {
          from: { node: "users", channel: "row-action" },
          to: { node: "filter", channel: "resetFields" },
          when: { rowAction: "nope" },
        },
      ],
    });
    expect(ghost.isError).toBe(true);
    expect(ghost.content[0].text).toMatch(/rowButtons 只有 \[edit\/view\]/);

    const model = await call(tool, {
      nodes: base(),
      wires: [
        {
          from: { node: "users", channel: "row-action" },
          to: { node: "filter", channel: "model" },
          when: { rowAction: "view" },
        },
      ],
    });
    expect(model.isError).toBe(true);
    expect(model.content[0].text).toMatch(/不是可调用通道/);

    // zod 默认 strip 会把 `page` 悄悄削掉；passthrough 让混用形状抵达唯一规则处。
    const mixed = await call(tool, {
      nodes: base(),
      wires: [
        {
          from: { node: "users", channel: "row-action" },
          to: { node: "users", channel: "reload", page: "emit", event: "x" },
          when: { rowAction: "view" },
        },
      ],
    });
    expect(mixed.isError).toBe(true);
    expect(mixed.content[0].text).toMatch(/不能同时给 node 与 page/);
  });

  it("空节点在入口形状就拒绝，handler 另有一层兜底", async () => {
    expect(() => z.object(tool.shape).passthrough().parse({ nodes: [] })).toThrow();

    const result = await tool.handler({ nodes: [] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("at least one node");
  });
});
