# Vue 2 Guide

ES-Plus ships a Vue 2 + Element UI render target that consumes the **same JSON config** as the Vue 3 build. Migrate your stack at your own pace — your `columns`, `formItemList`, and `options` are portable.

## When to Pick `@es-plus/vue2`

- Existing Vue 2 codebase with no near-term Vue 3 migration plan
- Mixed monorepo where some apps are still Vue 2
- You want to author CRUD pages once and run them on either renderer

If you're starting fresh, use [`@es-plus/vue3`](/guide/getting-started) — it gets new features first.

## Install

```bash
npm install @es-plus/vue2 element-ui vue@^2.7
```

`element-ui` is a peer dep. `vue@^2.7` is required (Composition API support).

## Register

```javascript
import Vue from 'vue'
import ElementUI from 'element-ui'
import ESPlus from '@es-plus/vue2'
import 'element-ui/lib/theme-chalk/index.css'
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(ESPlus)
```

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
