import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateCrudPage } from "./generate-crud-page.js";
import { registerGenerateCrudSchema } from "./generate-crud-schema.js";
import { registerValidateConfig } from "./validate-config.js";
import { registerListFormTypes } from "./list-form-types.js";
import { registerGetComponentApi } from "./get-component-api.js";
import { registerScaffoldPage } from "./scaffold-page.js";
import { registerGenerateFromConfig } from "./generate-from-config.js";
import { registerDetectProjectTarget } from "./detect-project-target.js";
import { registerGenerateCrud } from "./generate-crud.js";
import { registerGenerateForm } from "./generate-form.js";
import { registerGenerateTable } from "./generate-table.js";
import { registerGenerateDialog } from "./generate-dialog.js";

export function registerTools(server: McpServer) {
  registerDetectProjectTarget(server);
  // Front door — the preferred entry for any composite / CRUD request.
  registerGenerateCrud(server);
  // Standalone single-surface tools (explicit single-component asks, or embedding
  // a fragment next to native/third-party components).
  registerGenerateForm(server);
  registerGenerateTable(server);
  registerGenerateDialog(server);
  registerGenerateCrudPage(server);
  registerGenerateCrudSchema(server);
  registerGenerateFromConfig(server);
  registerValidateConfig(server);
  registerListFormTypes(server);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
}
