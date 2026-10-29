import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../src/tools/index.js";
import { registerResources } from "../src/resources/index.js";
import { registerPrompts } from "../src/prompts/index.js";

/**
 * 用**真** `McpServer` 注册一遍工具面。
 *
 * 为什么要有这条：其余 340 条测试全都对着手写的假 server（只实现
 * `tool(name, desc, shape, cb)` 这一种签名），于是「闸门把完整 ZodObject 塞给
 * SDK 的旧式 `tool()` 重载」这件事从未被真实 SDK 检验过。SDK 1.29 的旧式重载用
 * 「值的类型」猜第二/第三个参数是 Zod schema 还是 annotations：ZodObject 的 `_def`
 * 是可枚举对象属性，被判成 annotations，直接抛
 * `Tool xxx expected a Zod schema or ToolAnnotations` —— 进程在**启动注册阶段**就崩，
 * `mcp-server-es-plus` 一个工具都注册不上，宿主的连接必然超时。
 *
 * 这条测试因此不是「多测一遍」，它是唯一一条会红的：假 server 永远绿。
 */
describe("真实 McpServer 注册（SDK 版本兼容）", () => {
  function registerAll(profile: "full" | "front-door") {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() => {
      registerTools(server, profile);
      registerResources(server, profile);
      registerPrompts(server, profile);
    }).not.toThrow();
    return server;
  }

  it("full 档注册不抛（旧式 tool() 重载会把 ZodObject 误判成 annotations）", () => {
    const server = registerAll("full") as unknown as {
      _registeredTools: Record<string, { inputSchema?: { safeParse: (v: unknown) => { success: boolean } } }>;
    };
    expect(Object.keys(server._registeredTools).length).toBeGreaterThan(0);
  });

  it("front-door 档注册不抛", () => {
    registerAll("front-door");
  });

  it("注册后的入参 schema 放行未知键（透传到 handler，供闸门判红）", () => {
    const server = registerAll("full") as unknown as {
      _registeredTools: Record<string, { inputSchema?: { safeParse: (v: unknown) => { success: boolean } } }>;
    };
    const detect = server._registeredTools["detect_project_target"];
    expect(detect?.inputSchema).toBeTruthy();
    // passthrough 的判据：带一个 schema 里没有的键仍然 parse 成功。
    // 若这里失败，说明闸门看到的 args 已被 zod 剥过键，`collectUnknownKeys` 恒空。
    expect(detect!.inputSchema!.safeParse({ packageJson: "{}", bogusKey: 1 }).success).toBe(true);
  });
});
