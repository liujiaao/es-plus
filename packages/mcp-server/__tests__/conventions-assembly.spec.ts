// AI-19: conventions 资源此前只演示 `EsTable.methods.$httpRequest`（兼容键位），
// 从不提顶层 `permission` / `t` / `httpRequest`（core 权威字段），且 `t` 全文件零出现
// —— 模型据此生成的页面里权限门控 / i18n「静默失效」。本文件钉住三端 conventions
// 的 Global-Config / httpRequest 段都写明了装配前提，防止缺口回退。

import { describe, it, expect } from "vitest";
import { capabilityOf } from "@es-plus/shared";
import { registerConventionsResource } from "../src/resources/conventions.js";

type Captured = { handler: (uri: URL) => any };

function makeResourceServer() {
  const resources: Record<string, Captured> = {};
  const server = {
    resource(name: string, uri: string, _meta: any, handler: (uri: URL) => any) {
      resources[uri] = { handler };
    },
  };
  return { server: server as any, resources };
}

async function conventionsText(uri: string): Promise<string> {
  const { server, resources } = makeResourceServer();
  registerConventionsResource(server);
  expect(resources[uri], `未注册资源 ${uri}`).toBeDefined();
  const res = await resources[uri].handler(new URL(uri));
  return res.contents[0].text as string;
}

const URIS = [
  "esplus://conventions",
  "esplus://conventions/vue3",
  "esplus://conventions/vue2",
  "esplus://conventions/antdv",
];

describe("conventions — 全局装配前提", () => {
  for (const uri of URIS) {
    it(`${uri}：Global Config / httpRequest 段写明 permission / t / httpRequest`, async () => {
      const text = await conventionsText(uri);
      expect(text).toContain("permission:");
      expect(text).toContain("t:");
      expect(text).toContain("httpRequest");
    });

    it(`${uri}：说明 permissionValue / labelKey 需入口装配才生效`, async () => {
      const text = await conventionsText(uri);
      expect(text).toContain("permissionValue");
      expect(text).toContain("labelKey");
      expect(text).toContain("INERT");
    });

    it(`${uri}：configureEsPlus 例里补了 t`, async () => {
      const text = await conventionsText(uri);
      // configureEsPlus 段落必须出现 t:
      const idx = text.indexOf("configureEsPlus({");
      expect(idx).toBeGreaterThan(-1);
      const block = text.slice(idx, idx + 400);
      expect(block).toContain("t:");
    });

    it(`${uri}：render / formatter 标为信任边界（源码即代码，无沙箱）`, async () => {
      const text = await conventionsText(uri);
      // 2026-11-05 拍板：不做 AST 白名单/沙箱，改为文档明示。
      // 三条断言钉住「明示」这件事：没有它们，模型会把 render 当普通 JSON 字段转发。
      expect(text).toContain("Trust boundary");
      expect(text).toContain("executed by the host application");
      expect(text).toContain("does **not** sandbox");
    });
  }
});

// Vue 2 虚拟滚动的说法一度是四处硬编码的英文散文（addendum / Virtual Scrolling 段 /
// TableOptions 类型注释 / FAQ）。运行时语义或台账一改，说明书就会静默分叉。
// 这里用台账现值反推文档必须包含的措辞 —— 有人改回硬编码、或台账变了文档没跟，都会红。
describe("conventions — Vue 2 虚拟滚动说法派生自能力台账", () => {
  it("vue2 资源的四处说法与 tableOptions.virtual 台账一致", async () => {
    const text = await conventionsText("esplus://conventions/vue2");
    const cell = capabilityOf("tableOptions.virtual", "vue2");
    expect(cell, "CAPABILITIES 里必须有 tableOptions.virtual 的 vue2 单元格").toBeDefined();
    const supported = cell!.level === "full" || cell!.level === "partial";
    const warns = /告警|warn/i.test(cell!.note);

    // 派生自 level：Virtual Scrolling 段两种分支都会写出来
    expect(text).toContain(`capability level: ${cell!.level}`);

    if (supported) {
      expect(text).not.toContain("has no virtual scrolling");
    } else {
      expect(text).toContain("has no virtual scrolling");
      if (warns) {
        // 类型注释里的一句 + FAQ 的「NOT silent」+ 降级告警
        expect(text).toContain("ignored (warns)");
        expect(text).toContain("NOT silent");
        expect(text).toContain("logs a warning");
      } else {
        expect(text).toContain("ignored silently");
        expect(text).not.toContain("logs a warning");
      }
    }
  });
});
