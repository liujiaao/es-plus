export { generateCrudConfig, generateCode, type GeneratedConfig } from './crud-engine.js'
export { generateCrudPage, generateScaffold, type GenerateResult } from './code-generator.js'
export { generateCrudSchema, type CrudSchemaResult } from './schema-generator.js'
export { FORM_TYPES, PRESET_EXAMPLES, COMPONENT_LIST, type ComponentName } from './constants.js'
export { createSchemaValidator, validateConfig, listAvailableSchemas, type ValidationResult } from './schema-validator.js'
export { generateFromConfig, type StructuredCrudConfig, type StructuredGenerateResult } from './structured-generator.js'
export { StructuredCrudConfigSchema, type StructuredCrudConfigInput } from './structured-config.schema.js'
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
