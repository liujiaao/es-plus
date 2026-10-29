import { describe, it, expect } from "vitest";
import { HELP_TEXT, resolveCliCommand } from "../src/cli-flags.js";

/**
 * 入口参数。
 *
 * 为什么值得单测：`--version` / `--help` 是 docs/mcp-server.md 的 PATH 自检步骤。
 * 入口此前**完全没有参数解析**，`--version` 会被当成无参运行 —— 进程启动 stdio 服务
 * 并等在 stdin 上，终端零输出，用户据此判定「PATH 坏了」。这条测试钉住的是
 * 「参数被识别」，不是文案。
 */
describe("resolveCliCommand", () => {
  it("无参数 → 服务模式", () => {
    expect(resolveCliCommand([])).toEqual({ kind: "serve" });
  });

  it("--version / -v → 版本", () => {
    expect(resolveCliCommand(["--version"])).toEqual({ kind: "version" });
    expect(resolveCliCommand(["-v"])).toEqual({ kind: "version" });
  });

  it("--help / -h → 帮助", () => {
    expect(resolveCliCommand(["--help"])).toEqual({ kind: "help" });
    expect(resolveCliCommand(["-h"])).toEqual({ kind: "help" });
  });

  it("版本优先于帮助（两个都给时先回答「装的是哪一版」）", () => {
    expect(resolveCliCommand(["--help", "--version"])).toEqual({ kind: "version" });
  });

  it("客户端可能塞进来的其它参数不改变服务模式", () => {
    // 部分宿主会把 cwd / --experimental 之类的参数透传给 command，不能因此退出
    expect(resolveCliCommand(["--", "/some/path"])).toEqual({ kind: "serve" });
  });

  it("帮助正文写明 profile 与客户端配置形态", () => {
    expect(HELP_TEXT).toContain("ESPLUS_MCP_PROFILE");
    expect(HELP_TEXT).toContain("mcpServers");
    expect(HELP_TEXT).toContain("--version");
  });
});
