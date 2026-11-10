import { describe, it, expect } from "vitest";
import { generateFromConfig, type StructuredCrudConfig } from "@es-plus/shared";
import { buildReadPageResult } from "../src/tools/read-page.js";

/**
 * W4 —— `read_page` 工具层。
 *
 * shared 的往返（读回 → 再生成逐字节相同）已有断言；这里只钉工具层两件事：
 *   1. 返回形状与正文：config / lossy / intent / surfacesLossy 都在；
 *   2. 无出处的输入 → isError 语义（纯函数结果 ok=false + hint），不反推。
 */

const config: StructuredCrudConfig = {
  name: "UserManage",
  apiUrl: "/api/users",
  target: "vue3",
  mode: "schema",
  fields: [
    { prop: "name", label: "姓名", formtype: "Input" },
    { prop: "status", label: "状态", formtype: "Select", inForm: false },
  ],
  actions: ["add", "edit", "delete"],
} as StructuredCrudConfig;

describe("buildReadPageResult", () => {
  it("schema 产物：config + surfaces 投影 + 空 lossy", () => {
    const { code } = generateFromConfig(config);
    const result = buildReadPageResult({ code, label: "schema.ts" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract).toBe("es-plus.page-source@1");
    expect(result.mode).toBe("schema");
    expect(result.target).toBe("vue3");
    expect(result.config).toMatchObject({ name: "UserManage", apiUrl: "/api/users" });
    expect(result.lossy).toEqual([]);
    expect(result.intent?.surfaces).toBeTruthy();
    expect(result.surfacesLossy).toEqual([]);
  });

  it("sfc 产物：从 <script> 注释读回，mode 与 config 都对", () => {
    const { code } = generateFromConfig({ ...config, mode: "sfc" } as StructuredCrudConfig);
    const result = buildReadPageResult({ code, label: "Page.vue" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("sfc");
    expect((result.config as any).fields).toHaveLength(2);
  });

  it("无出处 → ok=false + error/hint（不反推手写页面）", () => {
    const result = buildReadPageResult({
      code: "export const pageSchema = { columns: [] }\n",
      label: "Page.vue",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("找不到页面出处标记");
    expect(result.hint).toContain("ingest_schema");
  });

  it("显式 columns 投影不进 surfaces → surfacesLossy 点名", () => {
    const { code } = generateFromConfig({
      ...config,
      columns: [{ prop: "name", label: "姓名" }],
    } as StructuredCrudConfig);
    const result = buildReadPageResult({ code });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.surfacesLossy?.some((l: any) => l.path === "columns")).toBe(true);
    // config 仍是无损的那份 —— 要保留 columns 的宿主走高级路径
    expect((result.config as any).columns).toEqual([{ prop: "name", label: "姓名" }]);
  });
});
