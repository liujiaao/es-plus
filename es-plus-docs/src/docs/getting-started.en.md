# Getting Started

ES-Plus is an enterprise-grade component library that cuts CRUD page code by 70% through configuration-driven rendering. Two render targets share the same JSON schema:

- **`@es-plus/vue3`** — Vue 3 + Element Plus (active development)
- **`@es-plus/vue2`** — Vue 2 + Element UI (compatibility build)

Both packages consume the same `columns` / `formItemList` / `options` JSON. This guide focuses on Vue 3; for Vue 2 see the [Vue 2 Guide](/guide/vue2).

:::tip v1.4.0 package rename
Starting in v1.4.0, the original `es-plus-ui` is renamed to **`@es-plus/vue3`**. The legacy package still works via a stub but is `npm deprecate`-flagged. See [Migration](/guide/migration).
:::

## Install

```bash
npm install @es-plus/vue3 element-plus @element-plus/icons-vue
```

## Register

Register ES-Plus in your entry file to make all components globally available:

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'
import 'element-plus/dist/index.css'

import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(ESPlus)
app.mount('#app')
```

## Your First Form

Replace dozens of `<el-form-item>` lines with one JSON block:

```vue
<template>
  <es-form
    :model="form"
    :form-item-list="formItems"
    :config-btn="btns"
    @confirm="handleConfirm"
  />
</template>

<script setup>
import { reactive } from 'vue'

const form = reactive({ name: '', status: '' })

const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 12 },
  { prop: 'status', label: 'Status', formtype: 'Select', span: 12,
    dataOptions: [
      { label: 'Enabled', value: 1 },
      { label: 'Disabled', value: 0 }
    ] }
]

const btns = [
  { name: 'Search', type: 'primary', key: 'query', triggerEvent: true },
  { name: 'Reset', key: 'rest', triggerEvent: true }
]

const handleConfirm = ({ key, model }) => {
  console.log(key, model) // 'query' { name: '...', status: 1 }
}
</script>
```

Compared to vanilla Element Plus, this saves **70%** code:

| Vanilla Element Plus | ES-Plus |
|---|---|
| 5-8 lines of `<el-form-item>` + control per field | One config line `{ prop, label, formtype }` |
| Manual `v-model` per field | Auto-bound via `model` |
| Manual `@click` + `resetFields()` | `triggerEvent: true` handles it |

### Try it live

<demo name="form-basic" />

## Your First Table

Configurable columns + auto pagination + request integration:

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form
      :model="form"
      :form-item-list="formItems"
      :config-btn="btns"
    />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ name: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6 }
]
const btns = [
  { name: 'Search', type: 'primary', key: 'query', triggerEvent: true },
  { name: 'Reset', key: 'rest', triggerEvent: true }
]

const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'age', label: 'Age' }
]

const options = {
  border: true,
  httpRequest: async ({ page }) => {
    const res = await fetch(`/api/list?page=${page.current}&size=${page.pageSize}`)
    return res.json()
  }
}
</script>
```

When `EsForm` is nested inside `EsTable`, search/reset/pagination wire up automatically — no event handlers needed.

### Try it live

<demo name="table-basic" />

## Your First Dialog

Programmatic, not template-declared:

```typescript
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

function openEditDialog(row) {
  dialog({
    title: 'Edit',
    width: '500px',
    render: () => h('p', `Editing user: ${row.name}`),
    configBtn: [
      { name: 'Cancel', click: (_, { close }) => close() },
      { name: 'OK', type: 'primary', click: (_, { close }) => {
        // submit logic
        close()
      } }
    ]
  })
}
```

No `<el-dialog>` template, no `visible` ref to manage.

## Next Steps

- [Installation](/guide/installation) — detailed install and environment requirements
- [Usage](/guide/usage) — global config, on-demand import, TypeScript
- [Vue 2 Guide](/guide/vue2) — Vue 2 + Element UI render target
- [Migration](/guide/migration) — migrate from `es-plus-ui` or vanilla Element Plus
- [EsForm Docs](/components/es-form) — full form API and advanced usage
- [EsTable Docs](/components/es-table) — full table API and data flow
- [useDialog Docs](/advanced/use-dialog) — advanced dialog features
