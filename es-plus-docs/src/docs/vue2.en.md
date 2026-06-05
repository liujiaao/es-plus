# Vue 2 Guide

ES-Plus ships a Vue 2 + Element UI render target that consumes the **same JSON config** as the Vue 3 build. Migrate your stack at your own pace — your `columns`, `formItemList`, and `options` are portable.

## When to Pick `@es-plus/vue2`

- Existing Vue 2 codebase with no near-term Vue 3 migration plan
- Mixed monorepo where some apps are still Vue 2
- You want to author CRUD pages once and run them on either renderer

If you're starting fresh, use [`@es-plus/vue3`](/guide/getting-started) — it gets new features first.

## Install

| Dep | Version |
|---|---|
| Vue | `^2.6.14 \|\| ^2.7.0` (1.1.0+ supports both) |
| Element UI | `^2.15.0` |
| `@vue/composition-api` | **No need to install** (inlined into dist since 1.1.1) |

```bash
# Vue 2.7+ (recommended)
npm install @es-plus/vue2 element-ui vue@^2.7

# Vue 2.6 — same install command; the polyfill is bundled into our dist
npm install @es-plus/vue2 element-ui vue@^2.6
```

::: tip Auto-compat since 1.1.x
- **1.1.0**: at module load `vue-compat` reads `Vue.version` and routes Composition API calls to either Vue 2.7's native exports or the `@vue/composition-api` polyfill. On Vue 2.6, `install()` calls `Vue.use(VueCompositionAPI)` for you automatically.
- **1.1.1**: `@vue/composition-api` is now **inlined into the dist**. Vue 2.7 users no longer need it in `package.json`, and bundlers won't raise `UNRESOLVED_IMPORT`.

**You should NOT call `Vue.use(VueCompositionAPI)` in your `main.js`** — regardless of Vue version. If you do on Vue 2.7, the native `setup()` and the polyfill's `data()` wrapper both run, producing "setup binding ... already declared" warnings; `install()` will log a console warning telling you to remove it.
:::

## Register

```javascript
import Vue from 'vue'
import ElementUI from 'element-ui'
import ESPlus from '@es-plus/vue2'
import 'element-ui/lib/theme-chalk/index.css'
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(ESPlus)
// No Vue.use(VueCompositionAPI) needed — managed automatically by ESPlus.install()
```

::: warning Upgrading from before 1.1.0
If your old `main.js` had:

```javascript
import VueCompositionAPI from '@vue/composition-api'
Vue.use(VueCompositionAPI)
```

**Remove both lines when upgrading to 1.1.0+.** Keeping them on Vue 2.7 will trigger `setup()` to run twice.
:::

## Same Schema, Different Renderer

A page that worked in Vue 3:

```javascript
const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 12 },
  { prop: 'status', label: 'Status', formtype: 'Select', span: 12,
    dataOptions: [
      { label: 'Enabled', value: 1 },
      { label: 'Disabled', value: 0 }
    ] }
]

const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'age', label: 'Age' }
]
```

…runs unchanged on Vue 2. Same prop names, same option semantics, same `httpRequest` callback signature.

## What's Different

| Aspect | Vue 3 | Vue 2 |
|--------|-------|-------|
| Render target | Element Plus | Element UI |
| Component import | `import { EsForm } from '@es-plus/vue3'` | `import { EsForm } from '@es-plus/vue2'` |
| Style | `@es-plus/vue3/dist/style.css` | `@es-plus/vue2/dist/style.css` |
| Vue version | `vue@^3.4` | `vue@^2.7` |
| Slots | `<template #header>` | `<template slot="header">` |
| `v-model` on data-source | `v-model:data-source` | `:data-source.sync` |
| `useDialog` | Composition API | Available via `Vue.use(ESPlus)` injection |

The render target — Element Plus vs Element UI — is the only thing that changes inside the components. All ES-Plus configuration fields are identical.

## Caveats

- **Element UI prop differences**: a small number of native Element UI props differ from Element Plus (e.g. `el-table-column type="selection"` is the same, but `el-pagination` layout strings differ). ES-Plus normalizes the most common cases; for edge cases, pass through via `attrs`.
- **No Teleport in Vue 2.7**: `useDialog` falls back to `body` mounting via Vue 2 `$mount` instead of Vue 3 Teleport.
- **TypeScript**: types ship for both packages but Vue 2 templates aren't fully type-checked even with vue-tsc 2.x. Prefer `<script lang="ts" setup>` (supported in Vue 2.7) for type safety.

## Migrating Vue 2 → Vue 3

Because the schema is portable, the migration boils down to:

1. Swap `@es-plus/vue2` for `@es-plus/vue3`
2. Swap `element-ui` for `element-plus` + `@element-plus/icons-vue`
3. Update Vue itself
4. Adjust `.sync` modifiers to `v-model:` and slot syntax to `#name`

Your `columns`, `formItemList`, and `options` definitions transfer 1:1.

## Next Steps

- [Getting Started](/guide/getting-started) — same flow, Vue 3 examples
- [Migration](/guide/migration) — full migration from `es-plus-ui`
- [EsForm Docs](/components/es-form) — schema reference (renderer-agnostic)
- [EsTable Docs](/components/es-table) — schema reference (renderer-agnostic)
