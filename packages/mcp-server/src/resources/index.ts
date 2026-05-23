import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSchemaResources } from "./schemas.js";
import { registerTypesResource } from "./types.js";
import { registerExamplesResource } from "./examples.js";

export function registerResources(server: McpServer) {
  registerSchemaResources(server);
  registerTypesResource(server);
  registerExamplesResource(server);
}
