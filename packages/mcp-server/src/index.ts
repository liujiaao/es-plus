#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, resolveToolProfile } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { buildInstructions } from "./instructions.js";
import { HELP_TEXT, resolveCliCommand } from "./cli-flags.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

// 自检参数必须在**建 server 之前**处理：`--version` 是文档里的 PATH 自检手段，
// 它要能在一个「注册阶段就会崩」的构建上也回答得出「二进制找得到」。
// 这两个分支走 stdout（终端里被 `$(...)` 读到），stdio 服务模式才归协议管道。
const cli = resolveCliCommand(process.argv.slice(2));
if (cli.kind === "version") {
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}
if (cli.kind === "help") {
  process.stdout.write(HELP_TEXT);
  process.exit(0);
}

// AN-26：`profile` 只解析一次，工具 / 资源 / 提示词 / instructions **共用这同一个值**。
// 任何一处独自读环境变量，都可能让「隐藏了这个工具」与「还在教宿主调它」同时成立。
// instructions 的正文随档位变化（见 `instructions.ts`）：`front-door` 下三个工具不注册，
// 正文不能再写「generate_crud_from_config remains available」。
const profile = resolveToolProfile();

const server = new McpServer(
  {
    name: "es-plus-mcp-server",
    version: pkg.version,
  },
  {
    instructions: buildInstructions(profile),
  }
);

registerTools(server, profile);
registerResources(server, profile);
registerPrompts(server, profile);

const transport = new StdioServerTransport();
await server.connect(transport);
