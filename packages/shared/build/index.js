export { generateCrudConfig, generateCode } from './crud-engine.js';
export { generateCrudPage, generateScaffold } from './code-generator.js';
export { generateCrudSchema } from './schema-generator.js';
export { FORM_TYPES, PRESET_EXAMPLES, COMPONENT_LIST } from './constants.js';
export { createSchemaValidator, validateConfig, listAvailableSchemas } from './schema-validator.js';
export { generateFromConfig } from './structured-generator.js';
export { StructuredCrudConfigSchema } from './structured-config.schema.js';
// 目标框架定义 + Vue 2/Vue 3 代码改写工具（供 CLI / MCP / 外部集成消费）
export { DEFAULT_TARGET, getEsPlusPackageName, getElementPackageName, buildElementImport, mapElementNameToV2, rewriteElementUsage, rewriteVModelSync, transformScriptSetupToOptions, } from './target.js';
export * from './contract.js';
//# sourceMappingURL=index.js.map