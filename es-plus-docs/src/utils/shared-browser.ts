// Browser-safe facade over @es-plus/shared.
// The shared package's `index.ts` re-exports `schema-validator.ts` which does
// top-level `import 'node:fs'` — that pulls Node built-ins into the browser
// bundle and blows up Vite. We import only the submodules that are actually
// pure (no fs / path / process / url) and re-export them under the same names
// the docs project uses.
//
// Vite alias `'@es-plus/shared'` points to THIS file (see vite.config.ts).
// All other consumers should keep importing the canonical name.

export {
  generateCrudConfig,
  generateCode,
  type GeneratedConfig,
} from '../../../packages/shared/src/crud-engine'

export {
  generateCrudPage,
  generateScaffold,
  type GenerateResult,
} from '../../../packages/shared/src/code-generator'

export {
  generateCrudSchema,
  type CrudSchemaResult,
} from '../../../packages/shared/src/schema-generator'

export {
  FORM_TYPES,
  PRESET_EXAMPLES,
  COMPONENT_LIST,
  type ComponentName,
} from '../../../packages/shared/src/constants'

export {
  generateFromConfig,
  type StructuredCrudConfig,
  type StructuredGenerateResult,
} from '../../../packages/shared/src/structured-generator'

// 片段预览的「字段 → 组件 props」映射。**同一份**映射被 SFC/schema 两条产物路径使用，
// 预览不得另写一套（否则预览与产物再次分叉）。
export {
  buildFormItem,
  buildTableColumn,
  getDefaultValue,
} from '../../../packages/shared/src/structured-generator'

// 独立片段（AI 原生全场景）：`generate_table` / `generate_form` / `generate_dialog`
// 的目标产物。站点演示用同一实现，不另写一套「差不多」的生成器。
export {
  generateFormBlock,
  generateTableBlock,
  generateDialogBlock,
  type FragmentResult,
} from '../../../packages/shared/src/fragment-generator'

// formtype 的合法取值（规范 ∪ 旧别名）—— 与 zod 校验、运行时 normalize 同源。
export {
  VALID_FORM_TYPES,
  FORM_TYPE_ALIASES,
} from '../../../packages/shared/src/contract'

// 预览边界（配置里有、预览画不出来）的**唯一**判据，与 MCP 工具摘要共用。
export {
  describeUnrenderedFeatures,
} from '../../../packages/shared/src/preview-hints'

export {
  StructuredCrudConfigSchema,
} from '../../../packages/shared/src/structured-config.schema'

// NL→配置的 system prompt 单一真源（CLI / MCP / eval 用的是同一份）。
// 本模块是纯字符串拼接 + 类型导入，无 node 依赖，可在浏览器中使用。
export {
  buildNlToConfigSystemPrompt,
} from '../../../packages/shared/src/ai-nl-to-config-prompt'

export {
  type TargetFramework,
  DEFAULT_TARGET,
  getEsPlusPackageName,
  getElementPackageName,
} from '../../../packages/shared/src/target'
