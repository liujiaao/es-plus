export { generateCrudConfig, generateCode, type GeneratedConfig } from './crud-engine.js'
export { generateCrudPage, generateScaffold, type GenerateResult } from './code-generator.js'
export { generateCrudSchema, type CrudSchemaResult } from './schema-generator.js'
export { FORM_TYPES, PRESET_EXAMPLES, COMPONENT_LIST, type ComponentName } from './constants.js'
export { createSchemaValidator, validateConfig, listAvailableSchemas, type ValidationResult } from './schema-validator.js'
export { generateFromConfig, type StructuredCrudConfig, type StructuredGenerateResult } from './structured-generator.js'
export { StructuredCrudConfigSchema, type StructuredCrudConfigInput } from './structured-config.schema.js'
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
export * from './contract.js'
