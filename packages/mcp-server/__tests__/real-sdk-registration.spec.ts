import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { emitSceneArtifact } from "@es-plus/shared";
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

  it("产物信封工具在 tools/list 里声明 outputSchema，且真实信封能通过（P8 复核）", () => {
    const server = registerAll("full") as unknown as {
      _registeredTools: Record<
        string,
        { outputSchema?: { safeParse?: (v: unknown) => { success: boolean } } }
      >;
    };
    for (const name of ["generate_scene", "generate_crud", "generate_composition"]) {
      expect(server._registeredTools[name]?.outputSchema, `${name} 缺少 outputSchema`).toBeTruthy();
    }
    // 不挂信封的生成入口不得声明 —— 否则 SDK 在成功分支没有 structuredContent 时会抛
    // InvalidParams（工具从「返回文本」变成「协议错误」）。
    for (const name of ["generate_form", "generate_table", "generate_dialog", "generate_crud_from_config"]) {
      expect(server._registeredTools[name]?.outputSchema, `${name} 不应声明 outputSchema`).toBeFalsy();
    }

    const { envelope } = emitSceneArtifact({
      scene: "table",
      intent: { fields: [{ prop: "name", label: "姓名", formtype: "Input" }] },
    } as any);
    expect(envelope).toBeTruthy();
    const schema = server._registeredTools["generate_scene"]!.outputSchema!;
    expect(schema.safeParse!(envelope).success).toBe(true);
  });

  /**
   * zod 4 → JSON Schema 的真实转换只是一次往返才能证明的事：`registerTool` 里存的
   * 是 ZodObject，`tools/list` 时才由 SDK 的 `zod-to-json-schema` 把它转成宿主看到的
   * JSON Schema。上面那些断言都停在「注册没抛」，这一条真的发 `tools/list` 并读回
   * `inputSchema` —— 换 zod 大版本时，转换器不认识的构造（refine / transform / lazy）
   * 会在这里暴露，而不是等宿主拿到一个空 schema、模型照着空表填字段。
   */
  it("tools/list 往返：19 个工具的入参 JSON Schema 都带 properties（zod → JSON Schema 转换可用）", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server, "full");
    registerResources(server, "full");
    registerPrompts(server, "full");

    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(clientT);

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(19);
    for (const tool of tools) {
      expect(tool.inputSchema.type, `${tool.name} 的 inputSchema 不是 object`).toBe("object");
    }
    // 生成入口都带参数：属性表必须非空（`list_form_types` 是无参工具，0 个属性是正常的）。
    for (const tool of tools.filter((t) => t.name.startsWith("generate_"))) {
      const props = (tool.inputSchema as { properties?: Record<string, unknown> }).properties;
      expect(props && Object.keys(props).length, `${tool.name} 的 inputSchema 没有 properties`).toBeGreaterThan(0);
    }
    // 前门工具是最大的那份形状：顶层键必须一个不少地出现在宿主可见的 schema 里。
    const cfg = tools.find((t) => t.name === "generate_crud_from_config")!;
    const keys = Object.keys((cfg.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
    for (const key of ["name", "apiUrl", "fields", "tableOptions", "tableBtns"]) {
      expect(keys, `generate_crud_from_config 的 inputSchema 缺 ${key}`).toContain(key);
    }

    await client.close();
    await server.close();
  });
});
