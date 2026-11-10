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
import { registerGenerateScene } from "./generate-scene.js";
import { registerGenerateComposition } from "./generate-composition.js";
import { registerGenerateForm } from "./generate-form.js";
import { registerGenerateTable } from "./generate-table.js";
import { registerGenerateDialog } from "./generate-dialog.js";
import { registerIngestSchema } from "./ingest-schema.js";
import { registerRefineConfig } from "./refine-config.js";
import { registerValidateIntent } from "./validate-intent.js";
import { registerCoverageReport } from "./coverage-report.js";
import { resolveToolProfile, type ToolProfile } from "../profile.js";
import { withArgGuard } from "./_arg-guard.js";

/**
 * AN-26 —— 工具面 profile。
 *
 * 定义与解析已下沉到 `src/profile.ts`（见那里的说明）：提示词/资源也要按**同一份**
 * profile 适配，故不能让它们反向依赖这一层的工具注册模块。这里 re-export，
 * 既有 `import { resolveToolProfile } from "./tools/index.js"` 不受影响。
 *
 * `front-door`：只留「场景路由器 + 组合页 + 确定性支撑」。
 *   · 保留 `generate_scene`（唯一生成入口，四个 scene 全覆盖）、
 *     `generate_composition`（片段装页）、`validate_config`、`ingest_schema`、
 *     `refine_config`、`list_form_types`、`get_component_api`、`scaffold_page`、
 *     `doctor_page`、`detect_project_target`、`validate_intent`、`coverage_report`；
 *   · 隐藏 7 个：`generate_crud`（兼容 adapter —— `generate_scene` 的 scene='crud'
 *     逐字节相同）、`generate_form` / `generate_table` / `generate_dialog`
 *     （单面片段 —— `generate_scene` 的 scene='form'|'table'|'dialog' 逐字节相同，
 *     由 `check-scene-parity` 证明）、`generate_crud_from_config`（hand-authored
 *     高级路径）、`generate_crud_page` / `generate_crud_schema`（regex legacy）。
 *
 * 为什么连兼容入口与片段工具一起藏：它们各自编码了一整套 JSON Schema
 * （2026-11-10 实测 `generate_crud` 80.9 KB、片段三件 68.9 KB），宿主每轮都要读；
 * 而 `generate_scene` 的 intent 是一个不展开的 record（1.9 KB）。同一个发射器、
 * 同一份形状（`SCENE_INTENT_SCHEMAS` 直接复用 `crudShape` / `*Shape`），产物逐字节
 * 相同，所以「少 4 个入口」不损失任何能力。full 档保留它们做兼容，默认档不受影响。
 */
export { resolveToolProfile, type ToolProfile };

export function registerTools(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  const frontDoorOnly = profile === "front-door";
  // 入参未知键闸门（见 `_arg-guard.ts`）：SDK 默认 strip，拼错的参数会静默消失。
  // 只在**注册入口**套一次 —— 各工具文件保持原样，新增工具自动继承。
  server = withArgGuard(server);

  registerDetectProjectTarget(server, profile);
  // Scene router — the scene-first entry and, under front-door, the ONLY generator.
  // Full keeps the flat entries below for compatibility; both paths share the same
  // emitters (`SCENE_INTENT_SCHEMAS` reuses the flat shapes verbatim).
  registerGenerateScene(server, profile);
  // Page composer — assembles standalone fragments into one page (P6b).
  registerGenerateComposition(server);
  if (!frontDoorOnly) {
    // Front door adapter — byte-identical to scene='crud'.
    registerGenerateCrud(server);
    // Standalone single-surface tools (explicit single-component asks, or embedding
    // a fragment next to native/third-party components). front-door reaches the
    // same artifacts through scene='form' / 'table' / 'dialog'.
    registerGenerateForm(server);
    registerGenerateTable(server);
    registerGenerateDialog(server);
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
  // 宿主抽取契约（P13）：意图生成前校验 + 逐页覆盖分级。都只判不改、不生成代码。
  registerValidateIntent(server);
  registerCoverageReport(server);
  registerGetComponentApi(server);
  registerScaffoldPage(server);
  registerDoctorPage(server);
}
