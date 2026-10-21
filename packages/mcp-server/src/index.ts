#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, resolveToolProfile } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { buildInstructions } from "./instructions.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

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
