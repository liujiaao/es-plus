# @es-plus/shared

## 1.1.0 — Codegen lang="jsx" + Vue 2 import extraction

This release fixes two long-standing code-generator bugs that produced
syntactically incorrect output. Both surfaced when the new e2e harness
attempted to run `vite build` on generator output for the first time.

### Fixed

- **`crud-engine.ts` now emits `<script setup lang="jsx">`** instead of
  `<script setup>` for SFCs that include JSX inside dialog `render`
  functions. Previously the JSX would be routed through esbuild's plain-JS
  loader and reject syntax like `<EsForm>` at build time. Affects every
  prompt producing a CRUD page with add/edit actions in vue3 sfc mode.
- **`transformScriptSetupBlock` in `code-generator.ts` now extracts
  top-level `import` statements** from the setup body and emits them at the
  top of the rewritten `<script>` block, where they belong. The previous
  behavior moved imports inside the `setup()` function body, producing JS
  that throws `Unexpected "{"` at parse time. Affects every prompt in
  vue2 sfc mode.
- The regex matching `<script setup>` blocks now accepts `lang="jsx"` and
  `lang="tsx"` in addition to `lang="ts"`, so the Vue 2 rewrite path
  preserves the lang attribute correctly.

### Tests

- New `__tests__/code-generator-vue2.spec.ts` (48 cases): snapshot every
  PRESET_EXAMPLE for vue2 target + contract assertions that Vue 2 output
  uses `defineComponent` not `<script setup>`, `@es-plus/vue2` not vue3,
  and never emits `v-model:*`.
- New `__tests__/structured-config-schema.spec.ts` (9 cases): snapshot the
  zod schema shape so accidental field renames or required-ness changes
  break tests before they hit production consumers.
- Refreshed existing snapshots that drifted during the
  `es-plus-ui` → `@es-plus/vue3` rename and the JSX lang attribute addition.

### Notes

The exported function signatures are unchanged. Consumers (`@es-plus/cli`,
`@es-plus/mcp-server`, the docs site AiCrud page) get the bug fixes
automatically by upgrading.

## 1.0.x

(See git history for earlier releases.)
