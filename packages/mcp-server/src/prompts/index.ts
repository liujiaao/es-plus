import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCrudPagePrompt } from "./crud-page.js";
import { registerFormConfigPrompt } from "./form-config.js";
import { registerSpecToSurfacesPrompt } from "./spec-to-surfaces.js";

export function registerPrompts(server: McpServer) {
  registerCrudPagePrompt(server);
  registerFormConfigPrompt(server);
  registerSpecToSurfacesPrompt(server);
}
