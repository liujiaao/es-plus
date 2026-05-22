# ES-Plus

> Config-driven CRUD component library for Vue 3 + Element Plus — the UI layer that AI was born to write.

[![npm version](https://img.shields.io/npm/v/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![npm downloads](https://img.shields.io/npm/dm/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![license](https://img.shields.io/npm/l/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![github stars](https://img.shields.io/github/stars/liujiaao/es-plus?style=social)](https://github.com/liujiaao/es-plus)

**[Documentation](https://liujiaao.github.io/es-plus/)** · **[Playground](https://liujiaao.github.io/es-plus/#/playground)** · **[Changelog](https://github.com/liujiaao/es-plus/releases)**

[中文](./README.md) | English

## Why es-plus-ui?

Enterprise back-office apps are 80% CRUD pages. The same form → table → dialog pattern, over and over. With raw Element Plus, each page takes ~200 lines of boilerplate. With es-plus-ui, the same page takes ~20 lines of config.

**In the AI coding era, config-driven beats template-driven:**
- AI generates JSON config 4x faster than Vue templates
- Zero typo risk — structured objects vs string-based templates
- Zero glue code — form↔table↔dialog communicate automatically

## Core Features

- **Config-driven** — JSON objects generate forms, tables, and dialogs. No repetitive templates.
- **Auto form↔table linkage** — Place `EsForm` inside `EsTable` slot, query/reset/pagination works automatically with zero event code.
- **Programmatic dialog** — `useDialog()` hook with JSX rendering, nested dialogs, ref forwarding.
- **Adaptive height** — `ResizeObserver` auto-recalculates table height on form expand/collapse.
- **Cross-page selection** — Persists checkbox selections across pagination via `rowkey` + page cache.
- **Backend-agnostic** — `configTableOut` + `qrcb` callback pipeline adapts to any API response format.
- **TypeScript** — Full type definitions for all configs.

## Installation

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
```

Peer dependencies: `vue ^3.2.0`, `element-plus ^2.2.0`, `@element-plus/icons-vue ^2.1.0`

## Quick Start

```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import EsPlus from 'es-plus-ui'
import 'es-plus-ui/dist/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(EsPlus)
app.mount('#app')
```

## Minimal Example

```vue
<template>
  <es-table
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form :model="query" :form-item-list="formItems" :config-btn="btns" />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const query = reactive({ keyword: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'keyword', label: 'Keyword', formtype: 'Input', span: 6 }
]
const btns = [
  { name: 'Search', type: 'primary', key: 'query', triggerEvent: true },
  { name: 'Reset', key: 'reset', triggerEvent: true }
]
const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'status', label: 'Status' }
]
const options = {
  border: true,
  httpRequest: async (params) => {
    // Call your API here
    return { data: [], total: 0, pageSize: 10, pageIndex: 1 }
  },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
</script>
```

> The form is nested inside the table slot. Query, reset, and pagination are fully automatic — zero event handlers needed.

## How It Works

```
┌─────────────────────────────────────────────────┐
│  EsTable (provides table instance via inject)   │
│  ┌───────────────────────────────────────────┐  │
│  │  EsForm (auto-discovers parent EsTable)   │  │
│  │  [Search] → triggers table.httpRequest()  │  │
│  │  [Reset]  → resets form + re-queries      │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Table rows (auto-paginated)              │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Pagination (auto-triggers httpRequest)   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

The magic: `EsForm` placed in `EsTable`'s default slot auto-discovers the table via Vue's `provide/inject`. Buttons with `triggerEvent: true` auto-call the table's data fetch method. No manual wiring.

## Components

| Component | Description |
|-----------|-------------|
| **EsForm** | Config-driven form — 13 input types, conditional visibility, async data loading, fold/expand |
| **EsTable** | Config-driven table — remote data, cross-page selection, adaptive height, grouped headers |
| **useDialog** | Programmatic dialog — JSX render, form validation integration, nested dialogs |
| **EsDialog** | Enhanced dialog — draggable, fullscreen toggle, custom render |
| **SvgIcon** | SVG icon component |

## EsForm Config

```typescript
const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6 },
  { prop: 'status', label: 'Status', formtype: 'Select', span: 6,
    dataOptions: [{ label: 'Active', value: 1 }, { label: 'Disabled', value: 0 }] },
  { prop: 'date', label: 'Date', formtype: 'datePicker', span: 8,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
  { prop: 'category', label: 'Category', formtype: 'Select', span: 6,
    apiParams: { url: '/api/categories' },
    callOptionListFormat: (data) => data.map(i => ({ label: i.name, value: i.id })) }
]
```

### Supported Input Types

`Input` · `Select` · `datePicker` · `timePicker` · `Cascader` · `Radio` · `Checkbox` · `Switch` · `Slider` · `Rate` · `ColorPicker` · `Transfer` · `Upload`

### Key FormItem Fields

| Field | Type | Description |
|-------|------|-------------|
| `prop` | `string` | Field name (required) |
| `label` | `string` | Label text (required) |
| `formtype` | `string` | Input component type |
| `span` | `number` | Grid column span (1-24) |
| `attrs` | `object` | Pass-through to Element Plus component |
| `dataOptions` | `array` | Options for Select/Radio/Checkbox |
| `isHidden` | `(model) => boolean` | Conditional visibility |
| `render` | `(h, model) => VNode` | Custom render function |
| `apiParams` | `object` | Load options from API |

## EsTable Config

```typescript
const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'amount', label: 'Amount', formatter: (row) => `$${row.amount.toFixed(2)}` },
  { prop: 'status', label: 'Status',
    render: (_, { row }) => <ElTag type={row.status ? 'success' : 'danger'}>{row.status ? 'Active' : 'Disabled'}</ElTag> },
  { prop: 'action', label: 'Actions', btns: [
    { name: 'Edit', type: 'primary', clickEvent: (row) => edit(row) },
    { name: 'Delete', type: 'danger', clickEvent: (row) => del(row) }
  ]}
]

const options = {
  border: true,
  httpRequest: fetchUsers,
  configTableOut: { total: 'total', tableData: 'records', pageSize: 'size', current: 'page' },
  rowkey: 'id',
  cachePageSelection: true,
  heightType: 'height'
}
```

### Backend Response Mapping

Your backend returns `{ result: { items: [...], count: 50 } }`? Just configure:

```typescript
configTableOut: { total: 'count', tableData: 'items', pageSize: 'pageSize', current: 'pageIndex' }
```

The library uses recursive key lookup — no need for dot-path notation. It finds `count` anywhere in the nested response.

### Request/Response Pipeline

```typescript
options: {
  listenToCallBack: {
    brcb: (params) => ({ ...params, token: getToken() }),  // Before Request
    qrcb: (response) => transformResponse(response)         // Query Result
  }
}
```

## useDialog

```tsx
import { useDialog } from 'es-plus-ui'

const dialog = useDialog()

function openEditForm(row) {
  const formData = reactive({ ...row })
  dialog({
    title: 'Edit User',
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={el => el && registerRef('form', el)}
        model={formData}
        formItemList={[
          { prop: 'name', label: 'Name', formtype: 'Input', span: 24 },
          { prop: 'email', label: 'Email', formtype: 'Input', span: 24 }
        ]}
      />
    ),
    configBtn: [
      { name: 'Cancel', click: (_, { close }) => close() },
      { name: 'Save', type: 'primary', click: async (_, { close, getRefs }) => {
        await getRefs('form')?.validate()
        await api.updateUser(formData)
        close()
      }}
    ]
  })
}
```

## Global Configuration

Configure once, apply everywhere:

```typescript
app.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest: async (params) => axios(params).then(r => r.data),
      configQueryFieldOutput: () => ({
        total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex'
      }),
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100]
      })
    }
  }
})
```

## AI-Friendly Design

es-plus-ui is designed to be the execution layer for AI coding assistants:

| Traditional | es-plus-ui | Why AI prefers config |
|-------------|-----------|---------------------|
| 120 lines template | 30 lines config | 4x fewer tokens |
| String-based `v-model` | Typed `{ prop }` object | Zero typo risk |
| Manual event wiring | `triggerEvent: true` | Zero missed bindings |
| Scattered state mgmt | Auto provide/inject | Zero glue code |

**Prompt example for AI:**

> "Create a user management page with search (name, phone, status), a data table with edit/delete actions, and an add/edit dialog."

With es-plus-ui in context, any AI assistant can generate a complete working page in one shot.

## TypeScript Support

```typescript
import type {
  FormItemOption,
  BtnConfig,
  TableColumn,
  TableOptions,
  DialogOptions,
  PaginationConfig
} from 'es-plus-ui'
```

## Project Structure

```
es-plus/
├── packages/es-plus/     # Component library source (npm: es-plus-ui)
├── es-plus-docs/         # Documentation site (Vite + Vue 3)
└── es-eui/               # Vue 2 + Element UI version (legacy)
```

## Development

```bash
# Build the library
cd packages/es-plus && npm install && npm run build

# Run docs site
cd es-plus-docs && npm install && npm run dev
```

## Comparison with Alternatives

| Feature | es-plus-ui | Raw Element Plus | vxe-table | Avue |
|---------|-----------|-----------------|-----------|------|
| Config-driven form+table | Yes | No | Partial | Yes |
| Zero-event form↔table linkage | Yes | No | No | Partial |
| Programmatic dialog with JSX | Yes | No | No | No |
| Cross-page selection | Yes | No | Yes | No |
| Backend response mapping | Yes | No | No | Yes |
| Bundle size (gzipped) | ~15KB | - | ~100KB | ~80KB |

## Contributing

Contributions welcome! Please read the contributing guide.

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

## License

[MIT](LICENSE)
