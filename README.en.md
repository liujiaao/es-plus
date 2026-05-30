# ES-Plus

Config-driven CRUD component library for Vue 3 + Element Plus — forms, tables, and dialogs with zero boilerplate.

[中文](./README.md) | English

[![npm version](https://img.shields.io/npm/v/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![npm downloads](https://img.shields.io/npm/dm/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![license](https://img.shields.io/npm/l/es-plus-ui.svg)](https://www.npmjs.com/package/es-plus-ui)
[![GitHub stars](https://img.shields.io/github/stars/liujiaao/es-plus?style=social)](https://github.com/liujiaao/es-plus)

**[Documentation](https://liujiaao.github.io/es-plus/)** · **[Playground](https://liujiaao.github.io/es-plus/#/playground)** · **[AI CRUD Generator](https://liujiaao.github.io/es-plus/#/ai-crud)** · **[Changelog](https://github.com/liujiaao/es-plus/releases)**

---

## Why ES-Plus

Enterprise back-office apps are 80% CRUD pages — the same form-table-dialog pattern over and over. With raw Element Plus each page needs 200+ lines of template. With ES-Plus the same page takes **30 lines of config**.

| Traditional Element Plus | ES-Plus |
|--------------------------|---------|
| 5-8 lines per field: `<el-form-item>` + `<el-input>` | One config: `{ prop, label, formtype }` |
| Manual `v-model` for every field | Auto-bound to `model` |
| Manual `@click` query + `resetFields()` | `triggerEvent: true` — fully automatic |
| Template `<el-dialog v-model="visible">` | Function call `dialog({ title, render })` |
| Manual pagination event handlers | Pagination auto-triggers request |

**70% less code. Zero event-handling boilerplate.**

---

## Features

- **Config-driven** — JSON config generates forms, tables, and dialogs
- **Auto linkage** — EsForm inside EsTable: query, reset, pagination work automatically
- **Programmatic dialogs** — `useDialog()` with JSX render, form validation, nested dialogs
- **13 input types** — Input, Select, datePicker, timePicker, Cascader, Radio, Checkbox, Switch, Slider, Rate, ColorPicker, Transfer, Upload
- **Adaptive height** — ResizeObserver auto-recalculates table height
- **Cross-page selection** — `cachePageSelection` preserves checkbox state across pages
- **Backend-agnostic** — `configTableOut` maps any API response structure
- **Permission control** — `permissionValue` on buttons, no `v-if` needed
- **i18n** — `labelKey` + custom translate function, works with any i18n library
- **TypeScript** — Full type definitions, 11 core interfaces exported
- **AI-native** — Official MCP Server and CLI for natural-language page generation

---

## Quick Start

### Install

```bash
npm install es-plus-ui element-plus @element-plus/icons-vue
```

Peer dependencies: `vue ^3.2.0`, `element-plus ^2.2.0`, `@element-plus/icons-vue ^2.1.0`

### Register (Full Import)

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

### Auto-Import (Recommended)

When using `unplugin-vue-components`, add `EsPlusResolver` to ensure Element Plus styles used internally by es-plus are injected:

```typescript
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { EsPlusResolver } from 'es-plus-ui/resolver'

export default defineConfig({
  plugins: [
    Components({
      resolvers: [ElementPlusResolver(), EsPlusResolver()]
    })
  ]
})
```

### First CRUD Page

```vue
<template>
  <es-table
    ref="tableRef"
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  >
    <es-form :model="form" :form-item-list="formItems" :config-btn="btns" />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ name: '', status: '' })
const tableData = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: 'Status', formtype: 'Select', span: 6,
    dataOptions: [{ label: 'Active', value: 1 }, { label: 'Disabled', value: 0 }] }
]

const btns = [
  { name: 'Search', type: 'primary', key: 'query', triggerEvent: true },
  { name: 'Reset', key: 'rest', triggerEvent: true }
]

const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'status', label: 'Status' },
  { prop: 'operate', label: 'Actions',
    btns: [
      { name: 'Edit', type: 'primary', clickEvent: (row) => edit(row) },
      { name: 'Delete', type: 'danger', clickEvent: (row) => del(row) }
    ] }
]

const options = {
  border: true,
  stripe: true,
  httpRequest: async (params) => {
    const res = await fetch('/api/list', { method: 'POST', body: JSON.stringify(params.formParams) })
    return res.json()
  },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
</script>
```

> EsForm nested inside EsTable — query, reset, and pagination are fully automatic. **Zero event handlers.**

---

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

EsForm in EsTable's default slot auto-discovers the table via Vue's provide/inject. Buttons with `triggerEvent: true` auto-call the table's data fetch method. No manual wiring.

---

## Components

| Component | Description | Use Case |
|-----------|-------------|----------|
| **EsForm** | Config-driven form | Query forms, edit dialogs, filters |
| **EsTable** | Config-driven table | Data lists, cross-page selection, grouped headers |
| **useDialog** | Programmatic dialog | Add/edit dialogs, detail views, nested dialogs |
| **EsDialog** | Enhanced dialog component | Draggable, fullscreen toggle, custom header/footer |
| **EsCrudPage** | CRUD page component | Pass a schema, get a complete CRUD page |
| **SvgIcon** | SVG icon component | Icon display |

---

## EsForm Config

```typescript
const formItems = [
  // Text input
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6 },
  // Select with static options
  { prop: 'status', label: 'Status', formtype: 'Select', span: 6,
    dataOptions: [{ label: 'Active', value: 1 }, { label: 'Disabled', value: 0 }] },
  // Date range
  { prop: 'date', label: 'Date', formtype: 'datePicker', span: 8,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
  // Remote data loading
  { prop: 'category', label: 'Category', formtype: 'Select', span: 6,
    apiParams: { url: '/api/categories' },
    callOptionListFormat: (data) => data.map(i => ({ label: i.name, value: i.id })) },
  // Conditional visibility
  { prop: 'remark', label: 'Remark', formtype: 'Input', span: 12,
    attrs: { type: 'textarea' },
    isHidden: (model) => model.status !== 1 }
]
```

### Key Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `prop` | `string` | Field name (required) |
| `label` | `string` | Label text (required) |
| `formtype` | `string` | Input component type (13 types) |
| `span` | `number` | Grid column span (1-24) |
| `attrs` | `object` | Pass-through to Element Plus component |
| `dataOptions` | `array` | Options for Select/Radio/Checkbox |
| `isHidden` | `(model) => boolean` | Conditional visibility |
| `render` | `(h, model) => VNode` | Custom render function |
| `apiParams` | `object` | Remote data loading |
| `labelKey` | `string` | i18n translation key |

---

## EsTable Config

```typescript
const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'amount', label: 'Amount', formatter: (row) => `$${row.amount.toFixed(2)}` },
  // Custom render
  { prop: 'status', label: 'Status',
    render: (_, { row }) => h(ElTag,
      { type: row.status === 1 ? 'success' : 'danger' },
      () => row.status === 1 ? 'Active' : 'Disabled') },
  // Action buttons (prop MUST be 'operate')
  { prop: 'operate', label: 'Actions',
    btns: [
      { name: 'Edit', type: 'primary', clickEvent: (row) => openForm('Edit', row) },
      { name: 'Delete', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ] }
]

const options = {
  border: true,
  stripe: true,
  highlightCurrentRow: true,
  httpRequest: fetchList,
  configTableOut: { total: 'total', tableData: 'records', pageSize: 'size', current: 'page' },
  rowkey: 'id',
  cachePageSelection: true
}
```

### Backend Response Mapping

Your backend returns `{ result: { items: [...], count: 50 } }`? Just configure:

```typescript
configTableOut: { total: 'count', tableData: 'items', pageSize: 'pageSize', current: 'pageIndex' }
```

The library uses recursive key lookup — no dot-path notation needed. It finds `count` anywhere in the nested response.

### Request/Response Pipeline

```typescript
options: {
  listenToCallBack: {
    brcb: (params) => ({ ...params, token: getToken() }),  // Before Request Callback
    qrcb: (response) => transformResponse(response)         // Query Result Callback
  }
}
```

---

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
        try {
          await getRefs('form')?.validate()
          await api.updateUser(formData)
          close()
        } catch { /* validation failed */ }
      }}
    ]
  })
}
```

---

## Permission Control

Configure a permission function at install time — buttons auto-hide based on permissions:

```typescript
app.use(EsPlus, {
  permission: (value) => userPermissions.includes(value)
})
```

```typescript
const btns = [
  { name: 'Add', type: 'primary', permissionValue: 'user:add', click: () => add() },
  { name: 'Delete', type: 'danger', permissionValue: 'user:delete', click: (row) => del(row) }
]
// Without 'user:delete' permission, the Delete button is auto-hidden — no v-if needed
```

---

## i18n

Configure a translate function at install time — works with any i18n library:

```typescript
app.use(EsPlus, {
  t: (key) => i18n.global.t(key)
})
```

```typescript
const formItems = [
  { prop: 'name', label: 'Name', labelKey: 'form.name', formtype: 'Input' }
]
// When labelKey + t function exist, uses t(labelKey); otherwise falls back to label
```

---

## TypeScript

```typescript
import type {
  FormItemOption,    // Form item config
  BtnConfig,         // Button config
  LayoutFormProps,   // Form layout config
  TableColumn,       // Table column config
  TableOptions,      // Table options
  PaginationConfig,  // Pagination config
  DialogOptions,     // Dialog options
  ApiParams,         // API parameters
  EsFormInstance,    // Form instance methods
  EsTableInstance,   // Table instance methods
  EsPlusOptions      // Global config
} from 'es-plus-ui'
```

---

## AI Toolchain

ES-Plus is designed for AI-assisted development. Two official tools:

### @es-plus/mcp-server — AI Coding Tool Integration

Let Claude Code, Cursor, and other AI tools generate CRUD pages directly:

```bash
# Claude Code — one-line setup
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

Then just say in your AI chat:

> "Generate a user management page with search fields: name, phone, status. Table columns: name, email, status, created time. Support add, edit, delete."

The AI auto-calls the MCP Server and generates a complete, runnable `.vue` file.

### @es-plus/cli — Command Line Tool

Generate CRUD pages from the terminal:

```bash
# Interactive
npx @es-plus/cli create user-management

# Non-interactive
npx @es-plus/cli create user-management \
  -d "User management with name, phone, status query, table shows name, email, status, created time, supports add edit delete"

# Validate JSON config
npx @es-plus/cli validate ./config.json --schema form-item

# Generate page scaffold
npx @es-plus/cli scaffold dashboard --features query,table,dialog
```

---

## Global Configuration

```typescript
app.use(EsPlus, {
  // Permission control
  permission: (value) => userPermissions.includes(value),
  // i18n
  t: (key) => i18n.global.t(key),
  // Table global defaults
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

---

## Project Structure

```
es-plus/
├── packages/
│   ├── es-plus/          # Component library (npm: es-plus-ui)
│   ├── mcp-server/       # MCP Server (npm: @es-plus/mcp-server)
│   └── cli/              # CLI tool (npm: @es-plus/cli)
├── es-plus-docs/         # Documentation site (Vite + Vue 3)
└── es-eui/               # Vue 2 + Element UI version (legacy)
```

## Development

```bash
# Build the library
cd packages/vue3 && npm install && npm run build

# Run docs site
cd es-plus-docs && npm install && npm run dev

# Run tests
cd packages/vue3 && npm test
```

## Ecosystem

| Package | Description | Link |
|---------|-------------|------|
| es-plus-ui | Component library | [npm](https://www.npmjs.com/package/es-plus-ui) |
| @es-plus/mcp-server | AI coding tool integration | [npm](https://www.npmjs.com/package/@es-plus/mcp-server) |
| @es-plus/cli | Command line tool | [npm](https://www.npmjs.com/package/@es-plus/cli) |
| Documentation | Full API & examples | [Docs](https://liujiaao.github.io/es-plus/) |

## Contributing

Contributions welcome!

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

## License

[MIT](LICENSE)
