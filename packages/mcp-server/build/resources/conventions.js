import { VALID_FORM_TYPES, SPECIAL_BTN_KEYS, BUILT_IN_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, VALID_CRUD_ACTIONS, DEFAULT_CONFIG_TABLE_OUT, CRUD_PAGE_BTN_CLICK_KEYS, } from "@es-plus/shared";
const TARGETS = {
    vue3: {
        esPlusPkg: "@es-plus/vue3",
        elementPkg: "element-plus",
        elementCss: "element-plus/dist/index.css",
        vue: "Vue 3",
    },
    vue2: {
        esPlusPkg: "@es-plus/vue2",
        elementPkg: "element-ui",
        elementCss: "element-ui/lib/theme-chalk/index.css",
        vue: "Vue 2",
    },
    antdv: {
        esPlusPkg: "@es-plus/adapter-antdv",
        elementPkg: "ant-design-vue",
        elementCss: "ant-design-vue/dist/reset.css",
        vue: "Vue 3",
    },
};
function buildVue2Addendum() {
    // Concise vue2-specific differences appended at the end so the AI sees them
    // when it asks for vue2 conventions. We don't duplicate every rule — only
    // call out the syntactic deltas the rest of the doc otherwise glosses over.
    return `
---

# Vue 2 Specifics (@es-plus/vue2)

This package is the Vue 2 + Element UI renderer of es-plus. The JSON schema
(\`formItemList\` / \`columns\` / \`options\` / \`CrudPageSchema\`) is **identical**
to @es-plus/vue3 — only the SFC syntax and underlying Element layer differ.

## Syntax Mapping

| Concept | Vue 3 | Vue 2 |
|---------|-------|-------|
| Reactive setup | \`<script setup>\` | \`defineComponent({ setup() { ... } })\` (Vue 2.7) or Options API |
| v-model on prop | \`v-model:visible="x"\` | \`:visible.sync="x"\` |
| Slot content | \`<template #default="{ row }">\` | \`<template v-slot:default="{ row }">\` (or \`slot-scope\` in <2.6) |
| h function | \`import { h } from 'vue'\` | \`h\` is the first arg of render() — \`render(h, ctx) { ... }\` |
| Teleport | \`<Teleport to="body">\` | Dialog mounts to body via \`appendTo\` prop |
| Native HTML attrs | \`v-bind="$attrs"\` (auto) | Manually set \`inheritAttrs: false\` if needed |

## Imports

\`\`\`typescript
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import ESPlus from '@es-plus/vue2'

Vue.use(ElementUI)
Vue.use(ESPlus)
\`\`\`

## Component Import (Setup style, requires vue@>=2.7)

\`\`\`typescript
import { defineComponent, reactive } from 'vue'
import { EsForm, EsTable, useDialog } from '@es-plus/vue2'

export default defineComponent({
  components: { EsForm, EsTable },
  setup() {
    const form = reactive({ name: '' })
    return { form }
  }
})
\`\`\`

## Element UI Differences vs Element Plus
- Icons: Element UI uses class-based icons (\`<i class="el-icon-edit">\`),
  not the \`@element-plus/icons-vue\` component package
- \`el-pagination\` layout strings are the same
- \`el-table\` API matches except for v-slot syntax
- \`el-table-v2\` does NOT exist in Element UI — virtual scrolling is Vue 3 only;
  for Vue 2 large datasets, use server-side pagination or vxe-table integration

## Limitations on Vue 2
- \`virtual: true\` in TableOptions is ignored (falls back to standard ElTable)
- \`scrollToRow\` instance method is no-op
- JSX requires \`@vue/babel-preset-jsx\` setup; default project may need config

## Migration Path Vue 2 → Vue 3
Because the JSON schema is identical, the migration is mostly syntactic:
1. Swap \`@es-plus/vue2\` → \`@es-plus/vue3\` + \`element-ui\` → \`element-plus\`
2. Replace \`.sync\` modifiers with \`v-model:*\`
3. Replace \`slot-scope\` with \`#name="..."\`
4. Replace icon classes with \`@element-plus/icons-vue\` components
5. Your \`columns\`, \`formItemList\`, and \`options\` definitions transfer 1:1
`;
}
function buildAntdvAddendum() {
    return `
---

## antdv (@es-plus/adapter-antdv) Specifics

Target \`antdv\` = **Vue 3 syntax + Ant Design Vue 4.x** as the UI library. The
JSON schema, component template syntax (\`<script setup>\`, \`v-model:xxx\`,
\`<template #default="{ row }">\`), and es-plus APIs are IDENTICAL to \`vue3\`.
Only the UI-library symbols differ.

## UI-Library Symbol Mapping (vue3 → antdv)

| Concern | Element Plus (vue3) | Ant Design Vue (antdv) |
|---------|---------------------|------------------------|
| Package | \`@es-plus/vue3\` | \`@es-plus/adapter-antdv\` |
| UI lib | \`element-plus\` | \`ant-design-vue\` |
| CSS | \`element-plus/dist/index.css\` | \`ant-design-vue/dist/reset.css\` |
| Toast | \`ElMessage.success('x')\` | \`message.success('x')\` |
| Confirm | \`ElMessageBox.confirm(content, title, { type: 'warning' }).then(async () => {…}).catch(() => {})\` | \`Modal.confirm({ title, content, async onOk() {…} })\` |
| Status tag | \`<el-tag :type="row.x === 1 ? 'success' : 'danger'">\` | \`<a-tag :color="row.x === 1 ? 'green' : 'red'">\` |
| Named imports | \`{ ElMessage, ElMessageBox, ElTag }\` | \`{ message, Modal, Tag }\` |

## App Bootstrap (antdv)
\`\`\`typescript
import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import ESPlus from '@es-plus/adapter-antdv'

const app = createApp(App)
app.use(Antd)
app.use(ESPlus, { /* EsTable.methods.$httpRequest, etc. */ })
\`\`\`

## Confirm-Dialog Shape (IMPORTANT)
Ant Design Vue's \`Modal.confirm\` takes a single options object with an
\`onOk\` callback — it is NOT the Element Plus Promise chain. Put the delete
request inside \`async onOk()\`:
\`\`\`typescript
Modal.confirm({
  title: '提示',
  content: '确定删除该条数据吗？',
  async onOk() {
    await $httpRequest({ url: '/api/xxx/delete', method: 'POST', formParams: { id: row.id } })
    message.success('删除成功')
    tableRef.value?.httpRequestInstance()
  },
})
\`\`\`
`;
}
function buildConventionsContent(target) {
    const v = TARGETS[target];
    const isVue2 = target === "vue2";
    const isAntdv = target === "antdv";
    return `# ${v.esPlusPkg} Code Generation Conventions (target=${target})

## Form Types (formtype)
Valid values: ${VALID_FORM_TYPES.join(", ")}
- All types are PascalCase (DatePicker, TimePicker, ColorPicker, etc.)
- Legacy camelCase "datePicker"/"timePicker" still work but PascalCase is recommended

## Button Keys
Built-in keys: ${BUILT_IN_BTN_KEYS.join(", ")}
- IMPORTANT: Reset button key MUST be "${SPECIAL_BTN_KEYS.RESET}" (NOT "reset")
- Query button key: "${SPECIAL_BTN_KEYS.QUERY}"
- Both query and reset buttons need \`triggerEvent: true\`

## Operation Column
- In SFC mode (EsTable + EsForm): use prop "${OPERATION_COLUMN_PROP_SFC}"
- In CrudPage mode (EsCrudPage): use prop "${OPERATION_COLUMN_PROP_CRUD_PAGE}"

## CRUD Actions
Valid values: ${VALID_CRUD_ACTIONS.join(", ")}
- Default actions when none specified: add, edit, delete

## Table Configuration
configTableOut (API response field mapping):
${Object.entries(DEFAULT_CONFIG_TABLE_OUT)
        .map(([k, v]) => `  - ${k}: "${v}"`)
        .join("\n")}

## Virtual Scrolling (10k+ rows)
${target === "vue3"
        ? `Enable virtual scrolling for large datasets:
\`\`\`typescript
tableOptions: {
  virtual: true,           // Switch to el-table-v2 engine
  rowHeight: 48,           // Fixed row height (default 50)
  height: 500,             // Container height (required for virtual)
  heightType: 'height',    // Use fixed height mode
  rowkey: 'id',            // Required for virtual selection
}
\`\`\`
- All existing column configs work identically in virtual mode
- \`type: 'selection'\` in columns creates checkbox column (preferred over multiSelect)
- Performance: O(1) selection via Set-based tracking, no per-row iteration
- Supports: render, scopedSlots, ellipsis, formatter, btns, fixed, sortable`
        : isAntdv
            ? `The @es-plus/adapter-antdv table is Vue 3 based but built on vxe-table (not
el-table-v2). The \`virtual: true\` el-table-v2 engine does NOT apply here; for
large datasets prefer server-side pagination via \`apiParams\` + \`configTableOut\`,
or rely on vxe-table's built-in virtual scroll where the adapter exposes it.`
            : `Vue 2 + Element UI does NOT support el-table-v2 / virtual scrolling at the
component layer. For large datasets, use server-side pagination with
\`apiParams\` + \`configTableOut\`. The \`virtual: true\` option is silently
ignored on Vue 2.`}

## Global Config Pattern
${!isVue2
        ? `When using app.use(ESPlus), configure globally:
\`\`\`typescript
import ESPlus from '${v.esPlusPkg}'
app.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: (params) => axios(params),
      configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
    }
  }
})
\`\`\``
        : `When using Vue.use(ESPlus), configure globally:
\`\`\`typescript
import Vue from 'vue'
import ESPlus from '${v.esPlusPkg}'
Vue.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: (params) => axios(params),
      configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
    }
  }
})
\`\`\``}
With global config, use \`apiParams: { url: '/api/xxx' }\` instead of inline httpRequest.

## EsCrudPage btn-click Event Keys
- Add confirm: "${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}"
- Edit confirm: "${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}"

## Import Requirements
${target === "vue3"
        ? `- When using status render with ElTag: \`import { ElTag } from '${v.elementPkg}'\`
- When using delete confirmation: \`import { ElMessageBox, ElMessage } from '${v.elementPkg}'\``
        : isAntdv
            ? `- Ant Design Vue named exports (no 'El' prefix, no auto-registration for these):
  \`import { message, Modal, Tag } from '${v.elementPkg}'\`
- Status render uses \`<a-tag :color="...">\` (colors: 'green'/'red'/'blue'/…) instead of \`<el-tag :type>\`
- Toasts use \`message.success('...')\` / \`message.error('...')\` instead of \`ElMessage.*\`
- Delete confirmation uses \`Modal.confirm({ title, content, async onOk() { ... } })\` — an options object with an \`onOk\` callback, NOT the Element Plus \`ElMessageBox.confirm(...).then().catch()\` Promise chain`
            : `- ElTag / ElMessage / ElMessageBox come from Element UI:
  \`import { Tag, Message, MessageBox } from '${v.elementPkg}'\` (note: no 'El' prefix in Element UI named exports)
  Or use globally-registered \`<el-tag>\` / \`this.$message\` / \`this.$confirm\``}
- When using EsCrudPage: the component is globally registered via ESPlus plugin

## CrudPageSchema Mode (Recommended)
Prefer generating CrudPageSchema JSON + wrapper SFC over full SFC mode:
- Simpler output (~30 lines wrapper vs ~200 lines full SFC)
- Runtime handles query/reset buttons, operation column, dialog lifecycle
- Schema is pure JSON (no render functions) — easy to validate and store

---

# Structured Config Tool (generate_crud_from_config)

## When to Use
Use \`generate_crud_from_config\` instead of \`generate_crud_page\` when you need production-ready code.
- \`generate_crud_page\`: Quick prototyping from natural language (has TODOs, placeholder data)
- \`generate_crud_from_config\`: Production code from structured JSON (zero TODOs, real API URLs)

## Production Readiness Checklist
Before constructing a StructuredCrudConfig, AI clients MUST verify:
1. Every field has a real \`prop\` name matching the backend model (not generic "field1")
2. \`apiUrl\` is a real endpoint (not "/api/xxx" placeholder)
3. Select/Radio/Checkbox fields have \`dataOptions\` OR \`apiParams\` (never empty options)
4. Required fields are marked with \`required: true\`
5. Date fields have proper \`attrs.type\` ('date', 'daterange', 'datetime', 'datetimerange')
6. Date fields have \`attrs.valueFormat\` matching the backend format (e.g. 'YYYY-MM-DD')
7. Status/enum fields have a \`render\` expression for visual display in table columns
8. The \`name\` is PascalCase and matches the route/page naming convention
9. Permissions are provided when the project uses RBAC (check for permissionValue usage)
10. **\`target\`** matches the user's project: \`target: '${target}'\`

## StructuredCrudConfig Schema

\`\`\`typescript
interface StructuredCrudConfig {
  name: string         // PascalCase component name, e.g. "UserManage"
  apiUrl: string       // Real API endpoint, e.g. "/api/users"
  fields: FieldConfig[]
  actions: ('add' | 'edit' | 'delete' | 'view' | 'export' | 'import')[]
  tableOptions?: {
    border?: boolean
    stripe?: boolean
    rowkey?: string
    heightType?: 'height' | 'auto' | 'maxHeight'
    height?: number | string
    multiSelect?: boolean
    highlightCurrentRow?: boolean
    headerCellStyle?: Record<string, string>
    virtual?: boolean           // Vue 3 only — ignored on Vue 2
    rowHeight?: number
    estimatedRowHeight?: number
    overscanCount?: number
    rowClassName?: string
  }
  pagination?: { pageSize?: number }
  mode?: 'schema' | 'sfc'
  typescript?: boolean
  permissions?: Record<string, string>
  i18n?: boolean
  target?: 'vue3' | 'vue2' | 'antdv'   // Code generation target (default: vue3)
}
\`\`\`

## httpRequest Integration (Production Pattern)

\`\`\`typescript
${!isVue2
        ? `// main.ts — configure once for the entire application
import axios from 'axios'
import ESPlus from '${v.esPlusPkg}'

app.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: (params) => axios({
        url: params.url,
        method: params.method || 'GET',
        params: params.method === 'GET'
          ? { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }
          : undefined,
        data: params.method === 'POST'
          ? { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }
          : undefined,
        headers: params.headers,
      }).then(res => res.data),
      configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
    }
  }
})`
        : `// main.js — configure once for the entire application
import Vue from 'vue'
import axios from 'axios'
import ESPlus from '${v.esPlusPkg}'

Vue.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: (params) => axios({
        url: params.url,
        method: params.method || 'GET',
        params: params.method === 'GET'
          ? { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }
          : undefined,
        data: params.method === 'POST'
          ? { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }
          : undefined,
        headers: params.headers,
      }).then(res => res.data),
      configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
    }
  }
})`}
\`\`\`

With global config in place, pages only need \`apiParams: { url: '/api/xxx' }\` — no inline httpRequest.
${isAntdv ? "\nNOTE (antdv): also register Ant Design Vue itself before ESPlus — `import Antd from 'ant-design-vue'; import 'ant-design-vue/dist/reset.css'; app.use(Antd); app.use(ESPlus, {...})`.\n" : ""}

## configureEsPlus() — Module-Level Config (Auto-Import Mode)
\`\`\`typescript
import { configureEsPlus } from '${v.esPlusPkg}'

configureEsPlus({
  EsTable: { methods: { $httpRequest: (p) => axios(p).then(r => r.data) } },
  EsForm: { $httpRequest: (p) => axios(p).then(r => r.data) },
  permission: (code) => userStore.permissions.includes(code)
})
\`\`\`
This ensures global config is available even in auto-import mode (unplugin-vue-components).

## Common Gotchas (Full List)

1. Reset button key is "rest" NOT "reset" — this is intentional in ${v.esPlusPkg}
2. formtype casing: all PascalCase (DatePicker, TimePicker). Legacy "datePicker"/"timePicker" still accepted
3. Table operation column prop: "operate" in SFC mode, "action" in CrudPage schema mode
4. \`triggerEvent: true\` is REQUIRED on query/reset buttons for table auto-refresh
5. In schema mode, \`render\` expressions are NOT evaluated — use wrapper SFC slots
6. \`apiParams.url\` in tableOptions triggers auto-fetch on mount; omit for manual control
7. \`configTableOut\` must match your backend response structure exactly
8. When using \`DatePicker\` with type "daterange", the model field stores an array of 2 strings
9. \`rowkey\` (note: lowercase 'k') is required for cross-page selection to work
10. Dialog form validation: always call \`getRefs('form')?.validate()\` before submitting
11. \`dialogKey\` on buttons auto-opens the named dialog — no manual click handler needed
12. \`operationColumn: false\` explicitly hides the action column (read-only tables)
${target === "vue2" ? "13. Vue 2: use `:visible.sync` not `v-model:visible`; use `defineComponent + setup()` for Composition API (needs vue@>=2.7)\n14. Vue 2: `virtual: true` in TableOptions is silently ignored — use server-side pagination for large datasets" : ""}${isAntdv ? "13. antdv: syntax is Vue 3 (`<script setup>`, `v-model:visible`) — same as vue3; ONLY the UI-lib symbols differ\n14. antdv: toasts use `message.success()` (from 'ant-design-vue'), NOT `ElMessage`\n15. antdv: delete confirm is `Modal.confirm({ title, content, async onOk() {} })`, NOT `ElMessageBox.confirm(...).then().catch()`\n16. antdv: status render is `<a-tag :color=\"... ? 'green' : 'red'\">`, NOT `<el-tag :type=\"... ? 'success' : 'danger'\">`" : ""}
${isVue2 ? buildVue2Addendum() : ""}${isAntdv ? buildAntdvAddendum() : ""}`;
}
export function registerConventionsResource(server) {
    // Four URIs:
    //   esplus://conventions       — vue3 (backward-compat default)
    //   esplus://conventions/vue3  — explicit vue3
    //   esplus://conventions/vue2  — vue2 variant with addendum on syntax deltas
    //   esplus://conventions/antdv — antdv variant (Vue 3 syntax + Ant Design Vue symbols)
    //
    // Pattern repeats across other resources (types, examples, crud-page-schema)
    // so AI clients can pull the right context for whichever target they're
    // generating against.
    const targets = [
        { uri: "esplus://conventions", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
        { uri: "esplus://conventions/vue3", target: "vue3", descSuffix: " — @es-plus/vue3 explicit" },
        { uri: "esplus://conventions/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 + Element UI variant" },
        { uri: "esplus://conventions/antdv", target: "antdv", descSuffix: " — @es-plus/adapter-antdv + Ant Design Vue variant" },
    ];
    for (const { uri, target, descSuffix } of targets) {
        server.resource(uri === "esplus://conventions" ? "conventions" : `conventions-${target}`, uri, {
            description: `Code generation conventions and rules${descSuffix} (button keys, formtypes, import requirements, syntax deltas)`,
            mimeType: "text/plain",
        }, async () => ({
            contents: [
                { uri, mimeType: "text/plain", text: buildConventionsContent(target) },
            ],
        }));
    }
}
//# sourceMappingURL=conventions.js.map