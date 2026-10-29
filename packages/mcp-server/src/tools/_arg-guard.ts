import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectUnknownKeys, formatUnknownKey } from "@es-plus/shared";

/**
 * AN-26（续）—— 工具入参的**未知键**闸门。
 *
 * MCP SDK 的 `server.tool(name, desc, shape, cb)` 只接受 `ZodRawShape`，内部统一
 * `z3rt.object(shape)`（zod 默认 **strip**）：模型把 `surfaces.formFields` 写成
 * 近义键、或把 `tableOptions` 的键写到顶层时，那些键在**到达 handler 之前**就已
 * 无声消失 —— handler 无从发现，生成器照常产出（例如只读页），宿主看到的是成功。
 * 这与 `collectUnknownKeys` 要解决的是同一类失败，只是发生得更早。
 *
 * SDK 的 `getZodSchemaObject` 允许传入**完整 ZodObject 实例**（不走 raw-shape
 * 分支），且 `validateToolInput` 用的是它自己的 `safeParse` —— 于是两条路都可行：
 *
 *   · `.passthrough()`：未知键活到 handler，由本模块判红并回结构化错误。选它而不是
 *     `.strict()`：strict 会让 SDK 抛协议级 `InvalidParams`，错误串是 zod 的
 *     `unrecognized_keys` 原文，既没有 did-you-mean，也不会把「本次**没有**生成任何
 *     东西」讲清楚；回到工具结果里报，则与 `validate_config` 的 `isError` 同一种
 *     语义 —— 宿主/模型都能读到可修的正文。
 *
 * 判据复用 shared 的 `collectUnknownKeys`（与 `validate_config` 同一份实现），因此
 * 嵌套层（`surfaces.dialog[].formFields`）同样能被点名，并带近似键建议。
 *
 * **前提：嵌套形状自己也必须 `.passthrough()`。** SDK 传进 handler 的是 `safeParse`
 * 的**结果**（`validateToolInput`），而 zod 的 `z.object()` 默认可把嵌套未知键剥掉 ——
 * 只给顶层 passthrough 时，`collectUnknownKeys` 拿到的值里已经没有那个拼写了，闸门
 * 静默失效。故 `_fragment-shapes.ts` 与本文件覆盖到的所有嵌套对象都显式 passthrough。
 *
 * 一次性套在 `registerTools` 的入口，而不是改 15 个工具文件：新增工具自动继承，
 * 不会再出现「第 16 个工具忘了加」这种结构性遗漏。
 */
export function withArgGuard(server: McpServer): McpServer {
  // 用原型委托而不是改原对象：调用方传进来的 server 保持原样（测试里的假 server
  // 仍可自行捕获），`guarded.tool` 覆写为带闸门的版本，其余成员原样透传。
  const guarded = Object.create(server) as McpServer;

  (guarded as unknown as { tool: unknown }).tool = function (
    name: string,
    description: string,
    shape: Record<string, z.ZodTypeAny>,
    handler: (args: any, extra?: any) => unknown,
  ) {
    const schema = z.object(shape);
    const wrapped = async (args: any, extra?: any) => {
      const unknown = collectUnknownKeys(schema, args);
      if (unknown.length > 0) {
        const lines = [
          `✗ Unknown argument(s) for ${name} — nothing was generated.`,
          "",
          ...unknown.map((f) => `  - ${formatUnknownKey(f)}`),
          "",
          "The offending key(s) were NOT used (zod would otherwise have stripped them silently).",
          "Fix the spelling/placement and call the tool again.",
        ];
        return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
      }
      return handler(args, extra);
    };

    // 走 `registerTool(name, config, cb)`，**不要**走旧式 `tool(name, desc, schema, cb)`。
    //
    // 旧式重载没有类型层可用的判据，SDK 只能靠「第二个参数里的值是不是对象」猜它是
    // ToolAnnotations 还是 Zod schema（见 sdk/dist/esm/server/mcp.js 的 `tool()`）：
    //
    //     else if (typeof firstArg === 'object' && firstArg !== null) {
    //       if (Object.values(firstArg).some(v => typeof v === 'object' && v !== null))
    //         throw new Error(`Tool ${name} expected a Zod schema or ToolAnnotations, ...`)
    //     }
    //
    // ZodObject 的 `_def` 恰好是**可枚举的**对象属性 ⟹ 传完整 ZodObject 必然命中这条
    // 分支并抛错。抛点在**注册阶段**（index.ts 顶层 `registerTools`），于是整个进程
    // 启动即崩：`mcp-server-es-plus` 一个工具都注册不上，宿主看到的是连接超时。
    // 340 条测试全绿也拦不住 —— 它们对着自己写的假 server（只实现旧签名），
    // 唯一会红的判定在 `__tests__/real-sdk-registration.spec.ts`（真 McpServer）。
    //
    // `registerTool` 把入参放进 `config.inputSchema`，直接交给 `getZodSchemaObject`，
    // 完整 ZodObject 是它明确接受的形态。`registerTool` 是 SDK 后期版本才有的 API，
    // 老版本（package.json 允许 ^1.0.0）退回旧签名 —— 那里只能传 raw shape（旧 SDK
    // 内部再 `z.object(shape)`），闸门因此退化成「只看得见声明过的键」，是有意的降级。
    const modern = (server as unknown as { registerTool?: unknown }).registerTool;
    if (typeof modern === "function") {
      return (modern as Function).call(
        server,
        name,
        { description, inputSchema: schema.passthrough() },
        wrapped,
      );
    }
    return (server.tool as any)(name, description, shape, wrapped);
  };

  return guarded;
}
