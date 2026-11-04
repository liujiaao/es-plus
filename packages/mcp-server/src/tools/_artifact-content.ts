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
