import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateCrudPage } from "./generate-crud-page.js";
import { registerGenerateCrudSchema } from "./generate-crud-schema.js";
import { registerValidateConfig } from "./validate-config.js";
import { registerListFormTypes } from "./list-form-types.js";
import { registerGetComponentApi } from "./get-component-api.js";
import { registerScaffoldPage } from "./scaffold-page.js";
import { registerGenerateFromConfig } from "./generate-from-config.js";
import { registerDetectProjectTarget } from "./detect-project-target.js";

export function registerTools(server: McpServer) {
  registerDetectProjectTarget(server);
  registerGenerateCrudPage(server);
  registerGenerateCrudSchema(server);
  registerGenerateFromConfig(server);
  registerValidateConfig(server);
  registerListFormTypes(server);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
}
