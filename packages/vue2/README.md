# @es-plus/vue2

> Vue 2 + Element UI renderer for the **es-plus** ecosystem — sharing the same JSON-schema CRUD configuration as the Vue 3 renderer ([`@es-plus/vue3`](https://www.npmjs.com/package/@es-plus/vue3)).

[![npm version](https://img.shields.io/npm/v/@es-plus/vue2.svg)](https://www.npmjs.com/package/@es-plus/vue2)
[![Vue 2](https://img.shields.io/badge/Vue-2.6%20%7C%202.7-42b883)](https://v2.vuejs.org/)
[![Element UI](https://img.shields.io/badge/Element%20UI-2.15-409EFF)](https://element.eleme.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Why @es-plus/vue2

- **Same config, two frameworks** — a single `columns` / `formItemList` definition powers both Vue 2 and Vue 3 deployments. No rewrites when migrating, no divergence between teams on different stacks.
- **AI-friendly schema-driven CRUD** — built around a stable JSON Schema, ideal for code-gen, MCP tools, and LLM workflows.
- **Element UI parity** — bundles `EsForm`, `EsTable`, `EsDialog`, `EsCrudPage`, `useDialog`, plus the same `httpRequest` / permission / global-config plumbing.

## Compatibility

| Dependency | Supported |
| --- | --- |
| Vue | `^2.6.14` (Vue 2.7's native Composition API is preferred) |
| `@vue/composition-api` | `^1.7.0` (required only on Vue ≤ 2.6) |
| Element UI | `^2.15.0` |
| `@es-plus/core` | `^1.0.0` |

## Install

```bash
# Vue 2.7+ (recommended — no extra plugin needed)
npm install @es-plus/vue2 element-ui vue@^2.7

# Vue 2.6.x (needs @vue/composition-api)
npm install @es-plus/vue2 element-ui @vue/composition-api vue@^2.6
```

## Setup

```js
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// Vue 2.6 only — skip on Vue 2.7+
import VueCompositionAPI from '@vue/composition-api'
Vue.use(VueCompositionAPI)

import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'

import { configureEsPlus } from '@es-plus/core/config'

Vue.use(ElementUI)
Vue.use(EsPlus)

configureEsPlus({
  httpRequest: async ({ url, method, data }) => {
    return fetch(url, { method, body: JSON.stringify(data) }).then(r => r.json())
  },
  configTableOut: (res) => ({ list: res.data.records, total: res.data.total }),
  permission: (code) => store.state.permissions.includes(code),
})
```

## Quick example

```vue
<template>
  <es-table
    :columns="columns"
    :api-params="apiParams"
    :btn-config="btnConfig"
    :form-item-list="searchForm"
  />
</template>

<script>
export default {
  data: () => ({
    apiParams: { url: '/api/users', method: 'GET' },
    columns: [
      { prop: 'name', label: '姓名', width: 120 },
      { prop: 'status', label: '状态', formatter: row => row.status === 1 ? '启用' : '禁用' },
      { label: '操作', btnList: [
        { name: '编辑', click: (row) => this.edit(row) },
        { name: '删除', type: 'danger', click: (row) => this.remove(row) },
      ] },
    ],
    searchForm: [
      { prop: 'keyword', label: '关键词', formtype: 'Input' },
      { prop: 'status', label: '状态', formtype: 'Select', options: [
        { label: '启用', value: 1 }, { label: '禁用', value: 0 },
      ] },
    ],
    btnConfig: [
      { name: '新增', type: 'primary', code: 1, click: () => this.create() },
    ],
  }),
}
</script>
```

The same `columns` / `searchForm` / `btnConfig` arrays work unchanged in `@es-plus/vue3` — only `Vue.use()` and the import path differ.

## Components

| Component | Purpose |
| --- | --- |
| `EsForm` | Configuration-driven form with row/col layout, fold/unfold, validation |
| `EsTable` | Configuration-driven table with toolbar, pagination, search form, cross-page selection |
| `EsDialog` | Programmable dialog used by `useDialog` |
| `EsCrudPage` | Schema-driven CRUD page assembling `EsTable` + `EsForm` + `useDialog` |
| `useDialog` | Imperative dialog API (`open`, `close`, `confirm`) |

## Sharing the same config across Vue 2 and Vue 3

The `columns` / `formItemList` / `btnConfig` / `apiParams` shapes live in [`@es-plus/core`](https://www.npmjs.com/package/@es-plus/core). Use them as the single source of truth for configs that ship to both renderers:

```ts
// shared/employee.config.ts
import type { ColumnConfig, FormItemConfig } from '@es-plus/core/types'

export const employeeColumns: ColumnConfig[] = [/* ... */]
export const employeeForm: FormItemConfig[] = [/* ... */]
```

```ts
// vue3/EmployeePage.vue   AND   vue2/EmployeePage.vue
import { employeeColumns, employeeForm } from '@/shared/employee.config'
```

## Differences vs @es-plus/vue3

| Feature | Vue 3 (`@es-plus/vue3`) | Vue 2 (`@es-plus/vue2`) |
| --- | --- | --- |
| Virtual scrolling (`virtual: true`) | Yes (`el-table-v2`) | **Not supported** — Element UI has no `el-table-v2` |
| `ElConfigProvider` locale/size injection | Yes | Use Element UI's global `Vue.use(ElementUI, { locale, size })` |
| Icons | Element Plus icon components | Element UI class strings (`el-icon-edit`) — converted automatically when needed |
| Default size | `default` (Element Plus) | `mini` — matches Element UI v2 visual density |

`size` values written for Vue 3 (`large` / `default` / `small`) are auto-mapped into Element UI's (`medium` / `small` / `mini`) so configs remain portable.

## Migration from Vue 3

You generally don't migrate — you target both. If you do:

1. Replace `import EsPlus from '@es-plus/vue3'` with `import EsPlus from '@es-plus/vue2'`.
2. Swap `vue@3 + element-plus` for `vue@2 + element-ui` (and `@vue/composition-api` if on 2.6).
3. Drop `virtual: true` on tables (or keep it — it's silently ignored).
4. `<script setup>` and `<el-icon><Delete/></el-icon>` aren't Vue 2 syntax — convert to Options API / template strings as appropriate.

## Repository

Monorepo: [github.com/liujiaao/es-plus](https://github.com/liujiaao/es-plus)

## License

[MIT](./LICENSE) © liujiaao
