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

export {
  StructuredCrudConfigSchema,
} from '../../../packages/shared/src/structured-config.schema'

export {
  type TargetFramework,
  DEFAULT_TARGET,
  getEsPlusPackageName,
  getElementPackageName,
} from '../../../packages/shared/src/target'
