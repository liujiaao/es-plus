import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  VALID_FORM_TYPES,
  SPECIAL_BTN_KEYS,
  BUILT_IN_BTN_KEYS,
  OPERATION_COLUMN_PROP_SFC,
  OPERATION_COLUMN_PROP_CRUD_PAGE,
  VALID_CRUD_ACTIONS,
  DEFAULT_CONFIG_TABLE_OUT,
  CRUD_PAGE_BTN_CLICK_KEYS,
} from "@es-plus/shared";

type Target = "vue3" | "vue2";

interface TargetVars {
  esPlusPkg: string;
  elementPkg: string;
  elementCss: string;
  vue: string;
}

const TARGETS: Record<Target, TargetVars> = {
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
};

function buildVue2Addendum(): string {
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

function buildConventionsContent(target: Target): string {
  const v = TARGETS[target];

  return `# ${v.esPlusPkg} Code Generation Conventions (target=${target})

## Form Types (formtype)
Valid values: ${VALID_FORM_TYPES.join(", ")}
- Note: "datePicker" and "timePicker" are camelCase (not PascalCase)
- All other types are PascalCase

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
  tabHeight: 500,          // Container height (required for virtual)
  heightType: 'height',    // Use fixed height mode
  rowkey: 'id',            // Required for virtual selection
}
\`\`\`
- All existing column configs work identically in virtual mode
- \`type: 'selection'\` in columns creates checkbox column (preferred over multiSelect)
- Performance: O(1) selection via Set-based tracking, no per-row iteration
- Supports: render, scopedSlots, ellipsis, formatter, btns, fixed, sortable`
    : `Vue 2 + Element UI does NOT support el-table-v2 / virtual scrolling at the
component layer. For large datasets, use server-side pagination with
\`apiParams\` + \`configTableOut\`. The \`virtual: true\` option is silently
ignored on Vue 2.`}

## Global Config Pattern
${target === "vue3"
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
    tabHeight?: number | string
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
  target?: 'vue3' | 'vue2'   // Code generation target (default: vue3)
}
\`\`\`

## httpRequest Integration (Production Pattern)

\`\`\`typescript
${target === "vue3"
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
2. formtype casing: "datePicker", "timePicker" (camelCase) — all others PascalCase
3. Table operation column prop: "operate" in SFC mode, "action" in CrudPage schema mode
4. \`triggerEvent: true\` is REQUIRED on query/reset buttons for table auto-refresh
5. In schema mode, \`render\` expressions are NOT evaluated — use wrapper SFC slots
6. \`apiParams.url\` in tableOptions triggers auto-fetch on mount; omit for manual control
7. \`configTableOut\` must match your backend response structure exactly
8. When using \`datePicker\` with type "daterange", the model field stores an array of 2 strings
9. \`rowkey\` (note: lowercase 'k') is required for cross-page selection to work
10. Dialog form validation: always call \`getRefs('form')?.validate()\` before submitting
11. \`dialogKey\` on buttons auto-opens the named dialog — no manual click handler needed
12. \`operationColumn: false\` explicitly hides the action column (read-only tables)
${target === "vue2" ? "13. Vue 2: use `:visible.sync` not `v-model:visible`; use `defineComponent + setup()` for Composition API (needs vue@>=2.7)\n14. Vue 2: `virtual: true` in TableOptions is silently ignored — use server-side pagination for large datasets" : ""}
${target === "vue2" ? buildVue2Addendum() : ""}`;
}

export function registerConventionsResource(server: McpServer) {
  // Three URIs:
  //   esplus://conventions       — vue3 (backward-compat default)
  //   esplus://conventions/vue3  — explicit vue3
  //   esplus://conventions/vue2  — vue2 variant with addendum on syntax deltas
  //
  // Pattern repeats across other resources (types, examples, crud-page-schema)
  // so AI clients can pull the right context for whichever target they're
  // generating against.
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://conventions", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://conventions/vue3", target: "vue3", descSuffix: " — @es-plus/vue3 explicit" },
    { uri: "esplus://conventions/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 + Element UI variant" },
  ];

  for (const { uri, target, descSuffix } of targets) {
    server.resource(
      uri === "esplus://conventions" ? "conventions" : `conventions-${target}`,
      uri,
      {
        description: `Code generation conventions and rules${descSuffix} (button keys, formtypes, import requirements, syntax deltas)`,
        mimeType: "text/plain",
      },
      async () => ({
        contents: [
          { uri, mimeType: "text/plain", text: buildConventionsContent(target) },
        ],
      })
    );
  }
}
