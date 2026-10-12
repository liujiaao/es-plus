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
import { registerIngestSchema } from "./ingest-schema.js";
import { registerRefineConfig } from "./refine-config.js";

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
  // 摄取层:把既有 schema 预填成一份草拟 StructuredCrudConfig(需人审修订后再 generate)。
  registerIngestSchema(server);
  // 精修层:对已 pin 的配置做一轮 NL 纠正后,确定性校验新配置并回显本轮 diff。
  registerRefineConfig(server);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
}
