export { generateCrudConfig, generateCode, type GeneratedConfig } from './crud-engine.js'
export { generateCrudPage, generateScaffold, generateAppEntry, type GenerateResult } from './code-generator.js'
export { generateCrudSchema, type CrudSchemaResult } from './schema-generator.js'
export { FORM_TYPES, PRESET_EXAMPLES, COMPONENT_LIST, type ComponentName } from './constants.js'
export { createSchemaValidator, validateConfig, listAvailableSchemas, type ValidationResult } from './schema-validator.js'
export { generateFromConfig, type StructuredCrudConfig, type StructuredGenerateResult } from './structured-generator.js'
// AN-22:顶层键 × mode 的发射账本（生成器消费；check:render-plan 对账）
export {
  buildRenderPlan,
  RENDER_PLAN_CONTRACT,
  type RenderDisposition,
  type RenderMode,
  type RenderPlan,
  type RenderPlanEntry,
  type RenderPlanKey,
} from './render-plan.js'
// AN-15:宿主前置清单（httpRequest / permission / t / JSX / UI 库）—— 生成物与 scaffold_page 共用
export {
  buildPreflight,
  buildScaffoldPreflight,
  checkPreflightShape,
  formatPreflight,
  type PreflightId,
  type PreflightCarrier,
  type PreflightInput,
  type PreflightItem,
  type PreflightReport,
  type PreflightShapeIssue,
} from './preflight.js'
// AN-15③:宿主入口静态检查（doctor_page）—— 字面量扫描，三态 ok/missing/unverified
export {
  doctorPage,
  formatDoctor,
  type DoctorFinding,
  type DoctorInput,
  type DoctorReport,
  type DoctorStatus,
} from './doctor.js'
export {
  StructuredCrudConfigSchema,
  normalizeTableBtn,
  type StructuredCrudConfigInput,
} from './structured-config.schema.js'
// AN-08:未知键判定(沿 Zod 形状只读收集)+ 宽松入口归一(有据可查的别名/搬迁)
export {
  collectUnknownKeys,
  suggestKey,
  levenshtein,
  formatUnknownKey,
  isExtensionKey,
  type UnknownKeyFinding,
} from './unknown-keys.js'
export { normalizeConfig, type ConfigRename, type NormalizeConfigResult } from './normalize-config.js'
// AN-24：确定性修复环（schema 驱动、只做有据可查的修复；与 validate 分离）
export {
  repairConfig,
  type ConfigRepair,
  type ConfigRepairKind,
  type RepairConfigResult,
} from './repair-config.js'
// 组合层:三面字段表 → 一份合法 StructuredCrudConfig（含表格的子集走 generateFromConfig）
export {
  composeCrudConfig,
  type ComposeCrudInput,
  type ComposeResult,
  type SurfaceField,
} from './compose-crud-config.js'
// 摄取层:结构化 schema(OpenAPI / JSON Schema / 样例 JSON)→ 字段表 → composeCrudConfig
export {
  ingestSchema,
  defaultFormtypeForType,
  INGEST_FORM_TYPES,
  type SchemaKind,
  type IngestResult,
  type TypeDescriptor,
} from './schema-ingest.js'
// 精修层(B3):两份 StructuredCrudConfig 的结构化差异 —— refine_config 工具 + eval 收敛判定旁证
export {
  diffConfig,
  summarizeDiff,
  type ConfigDiff,
  type FieldChange,
  type FieldAttrChange,
} from './config-diff.js'
// 生产安全网(C2·A3):确定性前门校验 —— 权威 Zod 判定 + 结构化错误/建议(只判不改、无模型)
export {
  validateAndRepair,
  formatIssuePath,
  zodIssuesToResult,
  type ZodIssueLike,
} from './validate-and-repair.js'
// 片段发射层:独立 es-form / es-table / useDialog（不含表格的子集 + 与原生/第三方混排）
export {
  generateFormBlock,
  generateTableBlock,
  generateDialogBlock,
  type FragmentResult,
  type FormBlockInput,
  type TableBlockInput,
  type TableRowButton,
  type DialogBlockInput,
  // Wave 4：独立场景的完整配置类型 + 容器级数据子集
  type EsTableConfig,
  type EsFormConfig,
  type EsDialogConfig,
  type TableBlockOptions,
  type EsTablePagination,
  type EsFormLayout,
} from './fragment-generator.js'
export {
  buildNlToConfigSystemPrompt,
  NL_TO_CONFIG_FEWSHOT,
  type NlToConfigFewShot,
} from './ai-nl-to-config-prompt.js'
// 目标框架定义 + Vue 2/Vue 3 代码改写工具（供 CLI / MCP / 外部集成消费）
export {
  type TargetFramework,
  type CodegenContext,
  DEFAULT_TARGET,
  getEsPlusPackageName,
  getElementPackageName,
  buildElementImport,
  mapElementNameToV2,
  rewriteElementUsage,
  rewriteVModelSync,
  transformScriptSetupToOptions,
} from './target.js'
// 能力矩阵（AN-09）：key × target × 支持级别，生成器据此发 target 级告警
export {
  type CapabilityTarget,
  type CapabilityLevel,
  type CapabilityCell,
  type CapabilityEntry,
  CAPABILITY_TARGETS,
  CAPABILITIES,
  capabilityOf,
  capabilityLevel,
  capabilityWarnings,
} from './capability.js'
export * from './contract.js'
