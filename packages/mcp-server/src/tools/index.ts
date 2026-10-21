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

/**
 * AN-26 —— 工具面 profile。
 *
 * `full`（默认）：注册全部工具。**默认值刻意是 full**，与 ARCHITECTURE §9.4 的
 * 弃用流程一致（「先改描述 → 再加 profile 开关（默认关闭）→ 大版本移除」）：
 * 在没有一个 minor 周期的描述过渡前就默认隐藏高级/legacy 工具，会让按现有
 * 文档调用 `generate_crud_from_config` 的宿主忽然找不到工具。
 *
 * `front-door`：只留「前门 + 确定性支撑 + 单面片段」。
 *   · 保留 `generate_crud`（唯一前门）、`generate_form/table/dialog`（单组件显式诉求，
 *     前门描述里明确让宿主在这种场景改用它们）、`validate_config`、`ingest_schema`、
 *     `refine_config`、`list_form_types`、`get_component_api`、`scaffold_page`、
 *     `doctor_page`、`detect_project_target`；
 *   · 隐藏 `generate_crud_from_config`（hand-authored 高级路径）、
 *     `generate_crud_page` / `generate_crud_schema`（regex 解析的 legacy fallback）。
 *
 * 选择读环境变量而不读 CLI flag：MCP 服务器由宿主 launcher 启动，环境变量是
 * 双方都能配置的唯一通道（`ESPLUS_MCP_PROFILE=front-door`）。
 */
export type ToolProfile = "full" | "front-door";

/** 解析 profile；未知值按 `full` 处理并留给调用方决定是否告警（不静默改变工具面）。 */
export function resolveToolProfile(raw = process.env.ESPLUS_MCP_PROFILE): ToolProfile {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "front-door" ? "front-door" : "full";
}

export function registerTools(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  const frontDoorOnly = profile === "front-door";

  registerDetectProjectTarget(server);
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
  registerValidateConfig(server);
  registerListFormTypes(server);
  // 摄取层:把既有 schema 预填成一份草拟 StructuredCrudConfig(需人审修订后再 generate)。
  registerIngestSchema(server);
  // 精修层:对已 pin 的配置做一轮 NL 纠正后,确定性校验新配置并回显本轮 diff。
  registerRefineConfig(server);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
  registerDoctorPage(server);
}
