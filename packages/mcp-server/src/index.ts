#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const server = new McpServer({
  name: "es-plus-mcp-server",
  version: pkg.version,
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
