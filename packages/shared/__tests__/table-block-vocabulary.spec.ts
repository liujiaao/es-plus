import { describe, it, expect } from "vitest";
import { generateTableBlock } from "../src/fragment-generator.js";

/**
 * P10 —— 片段表格与 CRUD 页共用同一套表格词汇。
 *
 * 此前 `columns` / 顶层 `treeConfig` / 顶层 `expandConfig` / `mergeConfig` / `rowkey`
 * 只存在于 `generate_scene(scene='crud')`：宿主为了多级表头、树表、展开、合并必须
 * 整套换入口（并因此拿到一份整页产物）。现在片段入口直接收同一套键，且**发射器
 * 复用整页的同一实现**（`sanitizeExplicitColumns` / `resolveTreeOptions` /
 * `pushSfcColumn`），不是第二份代码。
 */

const fields = [
  { prop: "name", label: "姓名", formtype: "Input" },
  { prop: "dept", label: "部门", formtype: "Input" },
];

describe("片段表格（P10 词汇对齐）", () => {
  it("columns：显式列 override 派生列，groups 多级表头递归发射", () => {
    const r = generateTableBlock({
      fields,
      columns: [
        { label: "基本信息", groups: [{ prop: "name", label: "姓名" }, { prop: "dept", label: "部门" }] },
        { type: "selection" },
        // 契约外的键被剥掉（与整页 schema 路径同一份白名单）
        { prop: "age", label: "年龄", bogusKey: true },
      ],
    });
    expect(r.code).toContain("groups: [");
    expect(r.code).toContain("type: 'selection'");
    expect(r.code).not.toContain("bogusKey");
    // 派生列不再出现（override 非 merge）：只有显式列里的两个 name label
    expect(r.code.match(/prop: 'name'/g)?.length).toBe(1);
  });

  it("treeConfig：顶层窄子集覆盖 tableOptions.treeConfig 的同名字键", () => {
    const r = generateTableBlock({
      fields,
      tableOptions: { treeConfig: { childrenField: "children", expandAll: true, transform: true } },
      treeConfig: { childrenField: "nodes", expandAll: false },
    });
    expect(r.code).toContain('"childrenField":"nodes"');
    expect(r.code).toContain('"expandAll":false');
    // vxe 富键保留（合并，不是替换）
    expect(r.code).toContain('"transform":true');
  });

  it("expandConfig：前置展开列；显式 expand 列存在时改为在其上挂内容", () => {
    const prepended = generateTableBlock({
      fields,
      expandConfig: { title: "详情", fields: [{ prop: "dept", label: "部门" }] },
    });
    const idxExpand = prepended.code.indexOf("type: 'expand'");
    const idxData = prepended.code.indexOf("prop: 'name'");
    expect(idxExpand).toBeGreaterThan(-1);
    expect(idxData).toBeGreaterThan(idxExpand);

    const explicit = generateTableBlock({
      fields,
      columns: [{ type: "expand", label: "展开" }, { prop: "name", label: "姓名" }],
      expandConfig: { fields: [{ prop: "dept" }] },
    });
    expect(explicit.code.match(/type: 'expand'/g)?.length).toBe(1);
    expect(explicit.code).toContain("expandConfig:");
  });

  it("mergeConfig：发射到 options.mergeConfig（与整页同名同形）", () => {
    const r = generateTableBlock({ fields, mergeConfig: { rowsBy: ["dept", "team"] } });
    expect(r.code).toContain('mergeConfig: {"rowsBy":["dept","team"]}');
  });

  it("rowkey：顶层与 tableOptions.rowkey 冲突时取顶层并告警", () => {
    const ok = generateTableBlock({ fields, rowkey: "code" });
    expect(ok.code).toContain("rowkey: 'code'");
    expect(ok.warnings.some((w) => w.includes("rowkey 冲突"))).toBe(false);

    const conflict = generateTableBlock({ fields, rowkey: "code", tableOptions: { rowkey: "id" } });
    expect(conflict.code).toContain("rowkey: 'code'");
    expect(conflict.warnings.join("\n")).toContain("rowkey 冲突");
  });

  it("rowButtons 与显式 columns 并存：操作列仍追加在末尾", () => {
    const r = generateTableBlock({
      fields,
      columns: [{ prop: "name", label: "姓名" }],
      rowButtons: [{ name: "编辑", key: "edit" }],
    });
    expect(r.code).toContain("clickEvent: (row) => emit('row-action'");
    expect(r.code.indexOf("clickEvent")).toBeGreaterThan(r.code.indexOf("prop: 'name'"));
  });
});
