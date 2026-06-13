# @es-plus/vue2

## 1.1.4 — Fix infinite update loop on tree/lazy tables + lazyLoad unmapped

### Fixed

- **Tree / lazy tree tables triggered "[Vue warn]: You may have an infinite update
  loop in a component render function."** The `watch(() => props.columns, ...,
  { deep: true })` detected mutations that `filteredColumns` made to the parent's
  column objects (setting `el.formatter`, `el.render`, `el.minWidth` during
  render). In Vue 2, props come from the parent's deeply observed data, so each
  property mutation fired the deep watcher → `columnRowList` reassign →
  `filteredColumns` recompute → repeat. Removed `deep: true` from the columns
  watcher: it now only reacts to array reference replacement (as intended).
  Vue 3 already avoids this because its props are shallow-reactive by default.
- **`lazyLoad` option was never mapped to Element UI's `load` prop.** el-table
  expects the lazy-load callback on the `load` prop; our public API calls it
  `lazyLoad`. The mapping is now applied in `tableAttrs` so `lazy: true +
  lazyLoad(fn)` works correctly: clicking expand triggers `loadOrToggle →
  loadData → user-provided callback → resolve(children)`.

No API or peer-dep changes. Pure bugfix release.

## 1.1.3 — EsTable height/refs fixes (last row clipped, exposed methods, pagination jitter)

### Fixed

- **`setRefs()` was not syncing `tbBtnRef` and `tableRef` from
  `proxy.$refs`.** Two consequences:
  1. `useTableResize` reads the toolbar height via `tbBtnRef.value.$el.offsetHeight`.
     Without the sync, `tbBtnHeight` was always `0`, so `tableHeight`
     overshot by ~one toolbar (~40px) and `el-table` rendered taller than
     the container's content area. With the also-new `overflow: hidden`
     on `.tableContainer` (see below), the last row was clipped.
  2. `expose({ clearSelection, refresh, scrollToRow, toggleSelection, ... })`
     all delegate to `tableRef.value`. With the ref left at `null`, every
     exposed table-instance method was a no-op.
- **Pagination bar jittered when an `EsForm` above the table expanded.**
  The flex item `.tableContainer` defaulted to `min-height: auto` (=
  `min-content`), so during the 1–2 frames between the form's height
  changing and the table's `height` prop catching up, the old (oversized)
  table content forced `.tableContainer` to grow, pushing the pagination
  bar out of the viewport before snapping back. Adding `min-height: 0`
  + `overflow: hidden` makes the flex child obey its allocated size
  strictly; the table is briefly clipped instead of shoving the
  pagination row.
- **`useTableResize` over-counted parent height by padding + border.**
  Was reading `element.parentElement.offsetHeight`, which includes the
  parent's padding, border, and scrollbar — so the table's `height` prop
  was set to a value that pushed `es-table` outside the parent's content
  box (visible as the table peeking under the parent's bottom padding /
  border). Replaced with a `getParentContentHeight()` helper that
  subtracts computed `paddingTop` + `paddingBottom` from `clientHeight`,
  matching what flex actually allocates.

No API or peer-dep changes. Pure bugfix release.

## 1.1.2 — Externalize @vue/composition-api + forward `<el-table>` native events

### Fixed

- **`[vue-composition-api] No vue dependency found.` in Vue 2.6 projects that
  also import from `@vue/composition-api` directly.** 1.1.1 inlined the
  polyfill into `dist/es-plus-vue2.js`, which produced **two separate JS
  module instances** at runtime: one inside our bundle, one in the consumer's
  `node_modules/@vue/composition-api` (the one the user's own `setup()`
  components import). Each instance keeps its registered Vue (`$e`) as a
  module-private variable, and `Vue.use(EsPlus)` could only initialize one of
  them — leaving the other to throw `No vue dependency found.` when the user's
  components called `reactive()` / `ref()` from their own import. The polyfill
  is now back to being an external rollup dep, so the consumer and our library
  share a single instance and a single `Vue.use()` call covers both.
- **`<es-table>` did not forward Element UI's native `Table` events**
  (`row-click`, `cell-click`, `select`, `header-click`, `row-dblclick`,
  `row-contextmenu`, etc.). The inner `<el-table>` was missing
  `v-on="$listeners"`, so listeners written on `<es-table>` only landed in the
  component's `$listeners` map and never propagated to the underlying
  `<el-table>`. Vue 2's `_g` (bindObjectListeners) merges `v-on="$listeners"`
  with the component's existing explicit `@sort-change` /
  `@selection-change` handlers into an array, so internal handling is
  preserved while user listeners now fire too.

### ⚠️ Breaking note for Vue 2.7+ users

`@vue/composition-api` is now a required `peerDependency` for **all** users
(the `peerDependenciesMeta.optional: true` flag is removed). Vue 2.6 users
already had to install it; Vue 2.7+ users who relied on the 1.1.1 promise
("no need to install the polyfill") must now add it:

```bash
npm i @vue/composition-api
```

The package's postinstall script redirects the polyfill to Vue 2.7's native
Composition API, so runtime behavior is unchanged. The trade-off is the only
way to fix the dual-instance bug without forking the polyfill.

### Bundle size impact

Reverses the 1.1.1 increase:

- `dist/es-plus-vue2.js` 33.61 KB gzip → **22.82 KB gzip** (−32%)
- `dist/es-plus-vue2.umd.cjs` 27.53 KB gzip → **18.16 KB gzip** (−34%)

## 1.1.1 — Inline @vue/composition-api into dist (fix UNRESOLVED_IMPORT in fresh Vue 2.7 projects)

### Fixed

- **Vue 2.7 fresh projects could not bundle the package.** In 1.1.0,
  `dist/es-plus-vue2.js` contained a static `import * as ... from '@vue/composition-api'`
  (because the polyfill was listed under `peerDependencies` and marked external in
  rollup output). When a Vue 2.7 user followed the README and skipped installing
  `@vue/composition-api`, vite/rollup raised `UNRESOLVED_IMPORT` at build time.
  This contradicted the 1.1.0 promise that "Vue 2.7+ users do not need to install
  the polyfill."
- The package now **inlines the polyfill into its dist** (rollup `external` no
  longer lists `@vue/composition-api`). Vue 2.7 users can install just `vue` +
  `element-ui` and the bundle will resolve. The runtime `vue-compat` switch is
  unchanged: Vue 2.7 still uses native Composition API; the inlined polyfill code
  is dead-but-resident in that branch.
- The peer dep is now declared `optional` via `peerDependenciesMeta`, so npm /
  pnpm no longer warn Vue 2.7 users about missing polyfill.

### Bundle size impact

- `dist/es-plus-vue2.js` 22.80 KB gzip → **33.61 KB gzip** (+47%)
- `dist/es-plus-vue2.umd.cjs` 18.15 KB gzip → **27.53 KB gzip** (+52%)

The increase is the cost of the universal-Vue-2.x compatibility guarantee. Future
major releases that drop Vue 2.6 support will be able to remove the polyfill
import entirely and reclaim the size.

### Validation

This release was gated on the e2e matrix:

- `(vue2, schema)` — passes (was failing in 1.1.0)
- `(vue2, sfc)` — passes (was failing in 1.1.0)
- `(vue3, schema)` / `(vue3, sfc)` — pass (no regression, vue3 package unchanged)
- `vue2` unit tests 20/20

## 1.1.0 — Vue 2.6 / 2.7 auto-compat + pagination text props

### Added

- **Runtime Vue version detection** in `vue-compat`: at module load the
  package now reads `Vue.version` and routes Composition API calls to
  either Vue 2.7's native exports or the `@vue/composition-api` polyfill.
  Eliminates the long-standing breakage where, in a Vue 2.7 project, the
  polyfill's `data()` wrapper and the native `setup()` would both run,
  producing `"setup binding ... already declared"` and
  `"inject() can only be used inside setup()"` warnings.
- **Auto-managed polyfill in `install()`**: on Vue 2.6 the install function
  now calls `Vue.use(VueCompositionAPI)` for you if it hasn't been installed
  yet. On Vue 2.7+ it detects an already-installed polyfill and logs a
  `console.warn` recommending its removal (no auto-uninstall — Vue has no
  reverse API for that).
- **`paginationLayout.prevText` / `paginationLayout.nextText`** in EsTable's
  global options: the strings are now forwarded to `<el-pagination>` as
  `:prev-text` / `:next-text`. Omit or set to empty string to keep the
  default `‹` / `›` arrow icons.

### Changed

- `peerDependencies.vue` widened from `^2.6.14` to `^2.6.14 || ^2.7.0` to
  match the install-time check above. No behavior change for existing
  Vue 2.6 / Vue 2.7 users; just a cleaner npm install signal.
- README "Setup" section rewritten: users no longer manually
  `Vue.use(VueCompositionAPI)`. Existing projects with that line should
  remove it on upgrade (the warning above will fire until they do).

### Migration

For projects coming from 1.0.x:

```diff
- import VueCompositionAPI from '@vue/composition-api'
- Vue.use(VueCompositionAPI)
  import EsPlus from '@es-plus/vue2'
  Vue.use(EsPlus, { /* options */ })
```

`@vue/composition-api` must remain in your `package.json` (it's still a
required peer dep — the dist contains a static `import * as ... from
'@vue/composition-api'` used as the Vue 2.6 fallback branch), but you
should no longer activate it as a plugin.

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
