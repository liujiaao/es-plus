// AI-19: conventions 资源此前只演示 `EsTable.methods.$httpRequest`（兼容键位），
// 从不提顶层 `permission` / `t` / `httpRequest`（core 权威字段），且 `t` 全文件零出现
// —— 模型据此生成的页面里权限门控 / i18n「静默失效」。本文件钉住三端 conventions
// 的 Global-Config / httpRequest 段都写明了装配前提，防止缺口回退。

import { describe, it, expect } from "vitest";
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
  }
});
