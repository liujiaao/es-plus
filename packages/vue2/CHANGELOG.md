# @es-plus/vue2

## 1.0.0 — First stable release

This release promotes @es-plus/vue2 from beta (0.9.x) to GA. The component
behavior has been frozen against the `es-eui` reference docs site for several
weeks; all components (EsForm / EsTable / EsDialog / EsCrudPage) share their
JSON config schema 1:1 with @es-plus/vue3, so the same `formItemList` /
`columns` / `options` / `CrudPageSchema` definitions work in both targets.

### Changes vs 0.9.0

- **Stable API contract**: the four core components + `useDialog` + the
  install function are considered stable. No breaking changes will land
  without a major bump.
- **Added** unit smoke tests for the install function, the legacy es-eui
  options-shape normalizer, and the export shape — drift between
  `package.json#version` and the runtime default-export version now fails CI.
- **Verified** by the end-to-end harness in the monorepo
  (`__tests__/e2e/scripts/run-e2e.mjs`): for every CRUD generator mode
  (schema / sfc) the produced SFC compiles cleanly in a fresh Vite + Vue 2.7
  + Element UI project against `@es-plus/vue2@1.0.0`.

### Limitations carried forward from 0.9.x

- `tableOptions.virtual: true` is silently ignored (Element UI has no
  `el-table-v2` equivalent). Use server-side pagination for large datasets.
- `scrollToRow` instance method is a no-op on this renderer.
- JSX in `<script setup lang="jsx">` requires the project to set up
  `@vue/babel-preset-jsx` — Vite + `@vitejs/plugin-vue2` handles this
  transparently.

### Upgrading from `es-eui`

`@es-plus/vue2` is the official successor to the `es-eui` demo package. To
migrate:

```diff
-import esEui from 'es-eui'
-Vue.use(esEui, { EsTable: { methods: { $httpRequest: ... } } })
+import ESPlus from '@es-plus/vue2'
+Vue.use(ESPlus, { EsTable: { methods: { $httpRequest: ... } } })
```

The install function preserves the legacy `{ methods: { ... } }` nested
options shape, so no JS changes are required beyond the import.
