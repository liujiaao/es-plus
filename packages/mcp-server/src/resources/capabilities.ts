import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capabilityLedger } from "@es-plus/shared";

/**
 * P9 —— `esplus://capabilities`：场景能力台账。
 *
 * 宿主在**生成之前**就能读到三件事，不必靠试错发现缺口：
 *   1. 四场景各自认哪些意图键（`accepted` / `required`）—— MCP 前门会对未知键
 *      结构化拒绝，但直接调 `emitScene*` 的消费者（CLI / eval / 自有接线）没有这层
 *      闸门；这份清单是生成前自查「我的键会不会被忽略」的依据；
 *   2. CRUD 顶层配置键在 schema / sfc 下的落位（`downgrade` 行带原因）——
 *      与 `render-plan.ts` 同一份数据，不另写文案；
 *   3. target × 键能力矩阵（AN-09）—— 哪些键在 vue2 / antdv 上不生效。
 *
 * 内容由 shared 的 `capabilityLedger()` 现算，保证与源码同步；守卫
 * `check:capability-ledger` 对同一份数据做机器核对。
 */
export function registerCapabilitiesResource(server: McpServer) {
  const uri = "esplus://capabilities";
  server.resource(
    "capabilities",
    uri,
    {
      description:
        "Scene capability ledger — accepted/required intent keys per scene (crud/table/form/dialog), CRUD key dispositions per mode (emit/derive/meta/downgrade + reason), and the target × key capability matrix. Read this before composing an intent to know which keys actually land in the artifact.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(capabilityLedger(), null, 2),
        },
      ],
    })
  );
}
