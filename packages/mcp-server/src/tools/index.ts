import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateCrudPage } from "./generate-crud-page.js";
import { registerValidateConfig } from "./validate-config.js";
import { registerListFormTypes } from "./list-form-types.js";
import { registerGetComponentApi } from "./get-component-api.js";
import { registerScaffoldPage } from "./scaffold-page.js";

export function registerTools(server: McpServer) {
  registerGenerateCrudPage(server);
  registerValidateConfig(server);
  registerListFormTypes(server);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
}
