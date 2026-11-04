import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArtifactEnvelope, CompositionEnvelope } from "@es-plus/shared";

/**
 * P8 —— 把产物信封挂到 MCP `structuredContent`。
 *
 * 为什么需要这一层：
 *   - `emitSceneArtifact` / `emitComposition` 早已产出带 `contract` / `files` /
 *     `config` / `warnings` / `fingerprint` 的信封，但 MCP 工具此前只返回纯文本，
 *     宿主（唯一外部消费者）拿不到任何机器可读的身份信息，只能靠正则切代码围栏。
 *   - 文本仍是**唯一的人类/模型可读面**：`content.text` 与旧入口逐字节相同
 *     （`check:scene-parity` / `check:artifact-envelope` 继续守）。
 *   - 信封是**附加视图**：支持 MCP 结构化输出的客户端可以直接消费；不支持的
 *     客户端忽略 `structuredContent`，行为与旧版完全一致。
 *
 * 失败分支不挂信封（与 shared 的纪律一致：没有产物就没有身份）。
 */
interface ToolResult {
  // MCP 的 handler 返回类型带 `[x: string]: unknown` 索引签名；这里必须显式声明，
  // 否则 `server.tool(...)` 的重载匹配失败（TS2769）。
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export function withEnvelope(
  text: string,
  envelope?: ArtifactEnvelope | CompositionEnvelope,
  isError?: true,
): ToolResult {
  const result: ToolResult = { content: [{ type: "text", text }] };
  if (isError) {
    result.isError = true;
    return result;
  }
  if (envelope) {
    // 信封是纯 JSON 数据；断言只用于跨 zod 版本的 Record 索引签名。
    result.structuredContent = envelope as unknown as Record<string, unknown>;
  }
  return result;
}

/**
 * `tools/list` 里的**输出形状**声明（P8 复核）。
 *
 * 之前信封只存在于 `structuredContent`，宿主在 `tools/list` 里看不到它，只能先调一次
 * 再猜字段。`outputSchema` 让「结构化输出」成为可预知的契约。
 *
 * 为什么是宽形状 + `passthrough()`：场景信封（`es-plus.artifact@2`）与组合信封
 * （`es-plus.composition@3`）是两套字段，但都保证 `contract` + `fingerprint`。
 * 这里只钉这两个**所有信封共有**的必填字段，其余原样放行 —— 声明形状不等于
 * 复制一份协议定义；逐字段真源仍在 shared 的 `ArtifactEnvelope` /
 * `CompositionEnvelope`，以及 `check:artifact-envelope` 的运行时断言。
 *
 * 注意 SDK 的语义：声明了 `outputSchema` 的工具，**成功**分支必须带
 * `structuredContent`，否则协议层报 `InvalidParams`。三个工具的成功分支都由
 * `withEnvelope` 保证这一点（失败分支 `isError` 不校验）。
 */
export const ARTIFACT_OUTPUT_SCHEMA = z
  .object({
    contract: z.string().describe("Envelope protocol version: es-plus.artifact@2 or es-plus.composition@3"),
    fingerprint: z.string().describe("Content fingerprint of the artifact / composition"),
  })
  .passthrough();

/**
 * 注册一个带产物信封的工具：等价于 `server.tool(name, description, shape, handler)`，
 * 但把 `ARTIFACT_OUTPUT_SCHEMA` 一并交给 SDK 的 `registerTool`。
 *
 * 为什么要这一层：`server.tool` 的 4 参重载没有 `outputSchema` 的位置，而
 * `_arg-guard` 的门面已经在内部走 `registerTool(name, { ..., inputSchema }, cb)`。
 * 这里用第 5 个参数把 outputSchema 传进去，由门面转交；未知键闸门因此对这三个
 * 工具**不失效**（不另开一条绕过门面的注册路径）。
 *
 * 老 SDK（没有 `registerTool`）会退化成旧签名并忽略 outputSchema —— 与入参闸门
 * 同一条降级策略，宿主仍能消费 `structuredContent`。
 */
export function registerArtifactTool(
  server: McpServer,
  name: string,
  description: string,
  shape: Record<string, z.ZodTypeAny>,
  handler: (args: any, extra?: any) => unknown,
): unknown {
  const register = server.tool as unknown as (
    n: string,
    d: string,
    s: Record<string, z.ZodTypeAny>,
    h: (args: any, extra?: any) => unknown,
    options: { outputSchema: z.ZodTypeAny },
  ) => unknown;
  return register.call(server, name, description, shape, handler, { outputSchema: ARTIFACT_OUTPUT_SCHEMA });
}
