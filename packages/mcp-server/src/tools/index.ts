import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateCrudPage } from "./generate-crud-page.js";
import { registerGenerateCrudSchema } from "./generate-crud-schema.js";
import { registerValidateConfig } from "./validate-config.js";
import { registerListFormTypes } from "./list-form-types.js";
import { registerGetComponentApi } from "./get-component-api.js";
import { registerScaffoldPage } from "./scaffold-page.js";
import { registerDoctorPage } from "./doctor-page.js";
import { registerGenerateFromConfig } from "./generate-from-config.js";
import { registerDetectProjectTarget } from "./detect-project-target.js";
import { registerGenerateCrud } from "./generate-crud.js";
import { registerGenerateForm } from "./generate-form.js";
import { registerGenerateTable } from "./generate-table.js";
import { registerGenerateDialog } from "./generate-dialog.js";
import { registerIngestSchema } from "./ingest-schema.js";
import { registerRefineConfig } from "./refine-config.js";
import { resolveToolProfile, type ToolProfile } from "../profile.js";
import { withArgGuard } from "./_arg-guard.js";

/**
 * AN-26 —— 工具面 profile。
 *
 * 定义与解析已下沉到 `src/profile.ts`（见那里的说明）：提示词/资源也要按**同一份**
 * profile 适配，故不能让它们反向依赖这 15 个工具的注册模块。这里 re-export，
 * 既有 `import { resolveToolProfile } from "./tools/index.js"` 不受影响。
 *
 * `front-door`：只留「前门 + 确定性支撑 + 单面片段」。
 *   · 保留 `generate_crud`（唯一前门）、`generate_form/table/dialog`（单组件显式诉求，
 *     前门描述里明确让宿主在这种场景改用它们）、`validate_config`、`ingest_schema`、
 *     `refine_config`、`list_form_types`、`get_component_api`、`scaffold_page`、
 *     `doctor_page`、`detect_project_target`；
 *   · 隐藏 `generate_crud_from_config`（hand-authored 高级路径）、
 *     `generate_crud_page` / `generate_crud_schema`（regex 解析的 legacy fallback）。
 */
export { resolveToolProfile, type ToolProfile };

export function registerTools(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  const frontDoorOnly = profile === "front-door";
  // 入参未知键闸门（见 `_arg-guard.ts`）：SDK 默认 strip，拼错的参数会静默消失。
  // 只在**注册入口**套一次 —— 15 个工具文件保持原样，新增工具自动继承。
  server = withArgGuard(server);

  registerDetectProjectTarget(server, profile);
  // Front door — the preferred entry for any composite / CRUD request.
  registerGenerateCrud(server);
  // Standalone single-surface tools (explicit single-component asks, or embedding
  // a fragment next to native/third-party components).
  registerGenerateForm(server);
  registerGenerateTable(server);
  registerGenerateDialog(server);
  if (!frontDoorOnly) {
    // LEGACY FALLBACK — regex/keyword parsers kept for quick prototypes; the
    // descriptions say so and point at the front door / advanced path.
    registerGenerateCrudPage(server);
    registerGenerateCrudSchema(server);
    // ADVANCED — hand-authored StructuredCrudConfig for hosts that already hold
    // a typed config. Same deterministic generator as the front door.
    registerGenerateFromConfig(server);
  }
  registerValidateConfig(server, profile);
  registerListFormTypes(server);
  // 摄取层:把既有 schema 预填成一份草拟 StructuredCrudConfig(需人审修订后再 generate)。
  registerIngestSchema(server, profile);
  // 精修层:对已 pin 的配置做一轮 NL 纠正后,确定性校验新配置并回显本轮 diff。
  registerRefineConfig(server, profile);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
  registerDoctorPage(server);
}
