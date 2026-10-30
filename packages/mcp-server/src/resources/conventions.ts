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
import { resolveToolProfile, type ToolProfile } from "../profile.js";

type Target = "vue3" | "vue2" | "antdv";

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
  antdv: {
    esPlusPkg: "@es-plus/adapter-antdv",
    elementPkg: "ant-design-vue",
    elementCss: "ant-design-vue/dist/reset.css",
    vue: "Vue 3",
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
- \`el-table-v2\` does NOT exist in Element UI — virtual scrolling is Vue 2's one
  real gap; for Vue 2 large datasets, use server-side pagination or the vxe-table
  engine (\`engine: 'vxe'\`), which is fully supported here

## Limitations on Vue 2
- \`virtual: true\` / \`engine: 'virtual'\` in TableOptions is ignored — the component
  logs a warning and renders a standard el-table (it does not fail)
- \`engine: 'vxe'\` IS supported: @es-plus/vue2 ships its own vxe engine
  (\`engines/vxe-engine.vue\`), so \`engine: 'vxe'\` switches to vxe-table — which
  itself supports Vue 2 — and is this target's recommended large-data path
- \`scrollToRow\` is a no-op on the default el-table engine (Element UI has no
  equivalent API); the vxe engine (\`engine: 'vxe'\`) implements it
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

function buildAntdvAddendum(): string {
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
app.use(ESPlus, { /* EsTable: { httpRequest, configQueryFieldOutput }, etc. */ })
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

// Single httpRequest adapter that works for BOTH request shapes es-plus emits, so
// one global config serves every page pattern (this is what makes the generated
// code run without hand-editing — a mismatched wrapper silently drops payloads):
//   • Method A — bare `apiParams:{url}` auto-fetch (es-table calls $httpRequest directly):
//       { url, formParams:{...fields,pageIndex,pageSize}, headers, method?, pageIndex, pageSize }
//   • Method B — generated `fetchData` + add/edit/delete handlers (axios-native shape):
//       { url, method, params?, data?, headers }
// It prefers Method-B's explicit `params`/`data`, and falls back to Method-A's
// `formParams`. Always unwraps to `res.data` so configTableOut mapping sees the
// business payload. A GET-only / formParams-only wrapper breaks Method B
// (empty PUT bodies, dropped POST/GET payloads); a bare `axios(params)` breaks
// Method A (formParams ignored → empty query). This handles both.
function robustHttpRequest(): string {
  return `(p) => {
        const method = (p.method || 'GET').toUpperCase()
        const isRead = method === 'GET'
        return axios({
          url: p.url,
          method,
          // Method B passes \`params\`/\`data\` directly; Method A only \`formParams\`.
          params: isRead ? (p.params ?? { ...p.formParams, pageIndex: p.pageIndex, pageSize: p.pageSize }) : undefined,
          data: isRead ? undefined : (p.data ?? p.formParams),
          headers: p.headers,
        }).then(res => res.data)
      }`;
}

function buildConventionsContent(target: Target, profile: ToolProfile = "full"): string {
  const v = TARGETS[target];
  const isVue2 = target === "vue2";
  const isAntdv = target === "antdv";
  // AN-26：profile=front-door 时 `generate_crud_from_config` 不注册。下文这一节大部分
  // 讲的是**配置形状本身**（它仍是生成器的输入模型，也是 `validate_config` /
  // `refine_config` 的判据），保留；但标题与「该去调哪个工具」的两行必须换成实际
  // 注册的那个前门，否则宿主照着文档调用会拿到 tool not found。
  const structuredConfigIntro =
    profile === "front-door"
      ? `# Structured Config (the model generate_crud fills for you)

## When to Use
This server runs \`ESPLUS_MCP_PROFILE=front-door\`: \`generate_crud_from_config\`,
\`generate_crud_page\` and \`generate_crud_schema\` are NOT registered.
- \`generate_crud\`: fill its \`surfaces\` intent table (query / table / form / dialog) —
  the routing builds this StructuredCrudConfig for you, deterministically.
- Read this section to understand that emitted config, and to check a
  hand-authored one with \`validate_config({ type: 'structured-crud-config' })\`
  or \`refine_config\` (both stay available in this profile).`
      : `# Structured Config Tool (generate_crud_from_config)

## When to Use
Use \`generate_crud_from_config\` instead of \`generate_crud_page\` when you need production-ready code.
- \`generate_crud_page\`: Quick prototyping from natural language (has TODOs, placeholder data)
- \`generate_crud_from_config\`: Production code from structured JSON (zero TODOs, real API URLs)`;
  return `# ${v.esPlusPkg} Code Generation Conventions (target=${target})

## Form Types (formtype)
Valid values: ${VALID_FORM_TYPES.join(", ")}
- All types are PascalCase (DatePicker, TimePicker, ColorPicker, etc.)
- Legacy camelCase "datePicker"/"timePicker" still work but PascalCase is recommended
${isAntdv ? '- ColorPicker: Ant Design Vue has no ColorPicker component — the renderer degrades it to a native <input type="color"> (no alpha/preset/history, and it does NOT trigger a-form-item validation). Prefer Input if validation matters.' : ""}

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
    ? `Virtual scrolling IS supported — but through Ant Design Vue, not el-table-v2.
\`virtual: true\` (or \`engine: 'virtual'\`) is forwarded to \`<a-table :virtual>\`,
which is ADV 4's own virtual scroll (pair it with \`scroll: { y }\` for the
container height):
\`\`\`typescript
tableOptions: {
  virtual: true,           // → <a-table :virtual="true">
  height: 500,             // → scroll.y, the viewport the virtualizer measures
  rowkey: 'id',
}
\`\`\`
- \`el-table-v2\` itself does NOT exist here — do not expect el-table-v2-specific
  options (\`rowHeight\` / \`estimatedRowHeight\` / \`overscanCount\`) to take effect;
  they are Element Plus renderer internals and are ignored on antdv
- \`engine: 'vxe'\` is the other option: it switches to vxe-table, which brings its
  own virtual scroll and inline editing
- For 10k+ rows prefer server-side pagination via \`apiParams\` + \`configTableOut\`
  unless the user explicitly asks for virtual scrolling`
    : `Vue 2 + Element UI has no virtual scrolling at the component layer (there
is no \`el-table-v2\`). \`virtual: true\` and \`engine: 'virtual'\` are NOT silently
swallowed — the component logs a warning and degrades to a standard
\`el-table\`; \`engine: 'vxe'\` IS available on this target too (vxe-table supports
Vue 2) and is the recommended large-data path here.
For large datasets, use server-side pagination with \`apiParams\` +
\`configTableOut\`.`}

## Global Config Pattern
${!isVue2
    ? `When using app.use(ESPlus), configure globally:
\`\`\`typescript
import axios from 'axios'
import ESPlus from '${v.esPlusPkg}'
app.use(ESPlus, {
  permission: (code) => userStore.permissions.includes(code), // permissionValue (RBAC) prerequisite
  t: (key) => i18n.global.t(key),                             // labelKey (i18n) prerequisite
  httpRequest: (params) => axios(params),                     // remote apiParams prerequisite (core top-level field)
  EsTable: {
    httpRequest: ${robustHttpRequest()},
    configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
  }
})
\`\`\``
    : `When using Vue.use(ESPlus), configure globally:
\`\`\`typescript
import Vue from 'vue'
import axios from 'axios'
import ESPlus from '${v.esPlusPkg}'
Vue.use(ESPlus, {
  permission: (code) => userStore.permissions.includes(code), // permissionValue (RBAC) prerequisite
  t: (key) => i18n.t(key),                                    // labelKey (i18n) prerequisite
  httpRequest: (params) => axios(params),                     // remote apiParams prerequisite (core top-level field)
  EsTable: {
    httpRequest: ${robustHttpRequest()},
    configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
  }
})
\`\`\``}
With global config, use \`apiParams: { url: '/api/xxx' }\` instead of inline httpRequest.
\`permissionValue\` (field/column/button RBAC) and i18n \`labelKey\` are INERT until the
entry assembles \`permission\` / \`t\` here — otherwise the gate silently passes and labels
fall back to \`label\`. The canonical key is the flat \`EsTable.httpRequest\` / \`EsTable.configQueryFieldOutput\`;
the legacy nested \`EsTable.methods.$httpRequest\` shape is still accepted (normalized at write time).

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

## Extension Points (business logic the schema can't express)
The declarative config covers structure (fields, actions, dialogs, layout) and
**form-scope conditional visibility** (\`isHidden\`, below). Some requirements —
computed cells, permission gates, custom controls — cannot be expressed as pure
JSON. The contract is **mark, never drop**:

- **\`isHidden\`** (FieldConfig — **not** an extension point: it's PLAIN JSON DATA,
  not a code string): a declarative visibility condition \`{ field, op?, value? }\`
  or an array of them (AND), where the field is HIDDEN while the condition holds.
  \`field\` is another field path in the same form; \`op\` ∈ eq (default) / ne / in /
  nIn / empty / notEmpty / truthy / falsy. When the predicate needs OR / AND-OR
  mixes / ordering (>, <=) / a nested NOT — which the plain form cannot express —
  use a JSON expression (JSONLogic-shaped, same \`isHidden\` key): \`{ or: [ { "==":
  [{ var: "status" }, "pending"] }, { ">": [{ var: "amount" }, 100] } ] }\`, ops =
  var == != > >= < <= in nin empty notEmpty truthy falsy and or not if; prefer the
  plain form for simple cases. Use this for "show field X only when Y
  is Z" — it applies to the query/add/edit forms, NOT the table column. Do NOT
  reach for \`formatter\`/\`render\` for visibility.
- **\`reactions\`** (FieldConfig — **not** an extension point: PLAIN JSON DATA,
  never a JS callback): field-level **linkage / computed** rules — this field's
  OPTIONS / required / disabled / own VALUE depend on OTHER fields. An array of
  rules, each \`{ dependencies?, when?, fulfill }\`:
  - \`dependencies\`: model paths whose change re-evaluates the rule. **REQUIRED**
    when \`fulfill.value\` is present.
  - \`when\`: optional gate expression — the rule applies only while it is truthy.
  - \`fulfill\`: \`{ dataOptions?, required?, disabled?, value? }\`:
    - \`dataOptions\` → a **LITERAL** option array (\`[{label,value}]\`) — NOT an
      expression (the DSL forbids object literals, so branch by writing one rule
      per case, each with its own \`when\`).
    - \`required\` / \`disabled\` / \`value\` → **AI-16 expression nodes** returning a
      boolean (required/disabled) or the field's new value (\`value\`, written back
      to the model).
  Ops = the same expression DSL as \`isHidden\` (var == != > >= < <= in nin empty
  notEmpty truthy falsy and or not if). Example — \`city\` options follow
  \`province\` (浙江→杭州/宁波, 江苏→南京): two rules, each
  \`when: { "==": [{ var: "province" }, "zj" | "js"] }\` with its own
  \`fulfill.dataOptions\`; and a value mirrorer \`region\` auto-equals \`province\`
  (\`dependencies:["province"], fulfill:{ value:{ var:"province" },
  disabled:{ truthy:[{ var:"province" }] } }\`). Applies to the query/filter form
  and the add/edit dialog forms — **NOT** the table column. DISTINCT from
  \`isHidden\`: use \`isHidden\` when the field merely appears/disappears, and
  \`reactions\` when its options / required / disabled / value must change.
- **\`columns\`** (top-level — **not** an extension point: it's PLAIN JSON DATA): the
  explicit table-column array, an escape hatch over the \`fields\`-derived columns for
  things the flat field list can't express — **multi-level group headers** (\`{ label,
  groups: [ …child columns… ] }\`, cross-renderer safe to 2 levels) and **non-field
  columns** (\`{ type: 'index' | 'selection' | 'expand' }\`). When present it REPLACES
  the derived table columns (override, not merge), so every table-visible field must
  appear inside it; \`fields\` still drives the query/add/edit forms. The operation
  column is auto-appended from \`actions\`/\`operationColumn\` — do NOT add it to \`columns\`.
- **\`expandConfig\`** (top-level — **not** an extension point: PLAIN JSON DATA): the
  declarative **row-expand content** — \`{ title?, fields: [ { prop, label? } ] }\`
  (fields non-empty). Its presence makes the table render exactly ONE row-expander
  whose content is a read-only \`label: value\` list read from \`row[prop]\`; the listed
  props are typically detail-only fields (mark them \`inTable:false\`). If \`columns\`
  already declares a \`{ type: 'expand' }\` column the content attaches there (position
  kept), otherwise the generator prepends one — you do NOT write the expander column
  yourself. Use this for "每行可展开查看…". DISTINCT from \`tableOptions.expandConfig\`
  (the vxe \`{ accordion }\` switch) — never use that for row-expand content.
- **\`treeConfig\`** (top-level — **not** an extension point: PLAIN JSON DATA): the
  declarative **tree table** — \`{ childrenField?, expandAll? }\` — STATIC trees only.
  Its presence makes the table render parent/child levels from the nested child array
  in each row; \`row-key\` is emitted automatically (the default \`rowkey\` covers it).
  Set \`childrenField\` only when the API nests children under a key other than
  \`children\` (e.g. \`subItems\`); set \`expandAll: true\` to expand every node by default.
  Not for lazy/async loading. Use this for "树形 / 部门树 / 分类树 / 父子层级". DISTINCT
  from \`tableOptions.treeConfig\` (the vxe-only \`VxeTreeConfig\`) — always use the
  TOP-LEVEL key.
- **\`tableOptions.editConfig\`** + **\`columns[].editRender\`** (vxe inline editing —
  **requires \`tableOptions.engine: 'vxe'\`**): \`editConfig\` is the table-level switch
  (\`{ trigger?: 'click' | 'dblclick' | 'manual', mode?: 'cell' | 'row', showStatus?,
  showUpdateStatus?, showInsertStatus?, autoClear?, enabled? }\`, defaults trigger:'click'
  / mode:'cell'); \`editRender\` marks ONE column editable and picks its editor
  (\`{ name: '$input' | '$select' | '$textarea' | '$date', type?: 'default' | 'visible',
  options?: [{label,value}], props?, autofocus?, defaultValue? }\` — \`$select\` wants
  \`options\`). ALL THREE are required together: a column WITHOUT \`editRender\` is never
  editable (so \`editConfig\` alone is a no-op), and both are silently IGNORED unless the
  engine is vxe (the generator warns). Declare the editable columns via the top-level
  \`columns\` array — it REPLACES the derived columns, so every table-visible field must
  appear inside it (the operation column is still auto-appended from \`actions\`). An edit
  writes STRAIGHT into the row object of \`data-source\` (the table holds the same row
  references, so the host also gets \`update:dataSource\`); \`keepSource\` is auto-enabled only
  to keep a snapshot for \`revertData()\` — it is NOT a private copy. To learn WHICH cell
  changed and its previous value, listen to the \`cell-edit\` event —
  \`{ row, prop, value, oldValue }\` — emitted on blur / row switch, never for an unchanged
  cell. Function-valued
  \`editRender.events\` and custom-registered renderers are OUT OF SCOPE. Use this for
  "表格行内编辑 / 双击单元格改数量 / 点单元格直接改".
- **\`mergeConfig\`** (top-level — **not** an extension point: PLAIN JSON DATA): the
  declarative **row merge** — \`{ rowsBy: ['dept', 'team'] }\` (non-empty). Each named
  column is grouped by **adjacent-equal** values: the first row of a run keeps the cell
  with \`rowspan\` = run length and the rest are merged away. \`rowsBy\` order is itself the
  render contract (it is the grouping axis), so keep the columns in the order the request
  names them. Cross-renderer (el-table \`span-method\` / a-table column \`customCell\` /
  vxe \`mergeMethod\`) — the generator consumes it; you do NOT write a span method. Use this
  for "合并单元格 / 相同的部门只显示一次 / 分组表". DISTINCT from the FUNCTIONAL
  \`tableOptions.spanMethod\` (an arbitrary JS closure, Tier-3 escape hatch, **not**
  cross-renderer — a-table has no span-method channel): if both are set the explicit
  \`spanMethod\` wins and the generator warns.
- **\`formatter\`** (FieldConfig): a JS arrow-function source string for read-only
  cell formatting, e.g. \`"(row) => \\\`¥\\\${row.amount.toFixed(2)}\\\`"\`. Emitted
  inline in SFC mode; carried through in schema mode.
- **\`render\`** (FieldConfig): a render-function source for a fully custom cell.
  In **schema mode** it cannot be inlined, so the generator emits a marked
  wrapper slot instead:
  \`\`\`html
  <template #column-<prop>="{ row }">
    <!-- TODO(es-plus): custom render for "<label>" — replace this default stub with your markup. -->
    <!-- requested render: <your original render source> -->
    <!-- a compilable default status-tag stub renders here -->
  </template>
  \`\`\`
  The requirement is preserved as a \`TODO(es-plus)\` marker + echoed source, and
  a matching \`warnings\` entry is returned — the code still compiles, and the gap
  is visible rather than silently swallowed.
- **\`permissionValue\`** (button configs): RBAC gate code, e.g.
  \`permissionValue: 'employee:delete'\` — express "only admins can X" here, don't
  drop the button.
- **\`hasCustomRender\`** (DialogConfig): flags a dialog whose body needs a hand-written
  render function; the wrapper emits a placeholder comment + a \`warnings\` entry.
  This is the supported escape for a custom dialog body: a render **function** has no
  JSON transport, so it is declared (not passed) and implemented in the host wrapper.
- **dialog base keys** (\`showClose\` / \`destroyOnClose\` / \`modal\` / \`closeOnClickModal\` /
  \`closeOnPressEscape\` / \`hiddenFullBtn\` / \`appendTo\` / \`cacheKey\`): plain booleans/strings
  forwarded verbatim to the underlying dialog. When the user asks "no closing X", "don't close
  on mask click", "destroy the form each time it opens", "mount it inside #app-dialogs" — write
  these keys on \`dialogs[k]\`; do not drop the requirement.
- **\`configBtn\`** (DialogConfig): the footer buttons as JSON data —
  \`{ name, type, action: 'confirm'|'cancel'|'custom', permissionValue }\`. The runtime attaches the
  click handler from \`action\` (\`confirm\` validates the form then submits), so a function is
  never needed. Omit it to get the generated cancel+confirm pair.

**Not in the schema — do not emit.** The keys below exist at RUNTIME (they are
declared on \`FormItemOption\` / \`TableOptions\` and really are consumed there), but
they are **absent from the AI config schemas**, and those schemas are CLOSED: an
unknown key is stripped with no error and no warning, so emitting one **silently
loses the requirement**. Say it declaratively instead, or leave it to the host:

- **\`on\`** (form item): the control's event bag (\`{ change: fn, input: fn }\`),
  forwarded as \`onChange\`/\`onInput\` to the underlying control. Function values, so
  it cannot travel through JSON. Map the intent: "options / required / disabled /
  value follow another field" → \`reactions\`; "the field only shows when …" →
  \`isHidden\`. A genuinely imperative handler is the host's code, added after
  generation.
- **\`httpRequest\`** / **\`listenToCallBack\`** (table level): a custom fetch function
  and an external "reload me" subscription. Remote data is declared with
  \`apiParams\` + a global \`httpRequest\` in the app entry; an imperative reload is
  \`tableRef.value.httpRequestInstance()\` in host code.
- **\`isInitRun\`** (table and form item) and **\`entryQuery\`** (table): "skip the
  first auto-request" and "params injected on first load" — host orchestration
  (e.g. read them from the route), not something a natural-language request defines.

Every generation returns a \`warnings: string[]\`. Each entry flags an extension
point that was emitted as a stub OR a likely mapping mistake — read them and
resolve each one before shipping.

---

${structuredConfigIntro}

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
    heightType?: 'height' | 'auto' | 'maxHeight' // 'height' = fixed, 'maxHeight' = capped, 'auto' = unconstrained
    tabHeight?: number | string // table height consumed for EVERY heightType (overrides height; maxHeight = cap)
    height?: number | string // container height; used ONLY when heightType === 'height'
    multiSelect?: boolean
    highlightCurrentRow?: boolean
    headerCellStyle?: Record<string, string>
    virtual?: boolean           // vue3 → el-table-v2; antdv → <a-table virtual>; vue2 → ignored (warns)
    engine?: 'default' | 'virtual' | 'vxe'  // 'vxe' works on all three targets
    rowHeight?: number
    estimatedRowHeight?: number
    overscanCount?: number
    rowClassName?: string
    editConfig?: {             // vxe inline editing — requires engine:'vxe' (see below); a cell is editable only if its column also declares editRender
      trigger?: 'click' | 'dblclick' | 'manual'
      mode?: 'cell' | 'row'
      showStatus?: boolean
      showUpdateStatus?: boolean
      showInsertStatus?: boolean
      autoClear?: boolean
      enabled?: boolean
    }
  }
  pagination?: { pageSize?: number; pageSizes?: number[] }
  mode?: 'schema' | 'sfc'
  typescript?: boolean
  permissions?: Record<string, string>
  i18n?: boolean
  target?: 'vue3' | 'vue2' | 'antdv'   // Code generation target (default: vue3)

  // ── Query-form layout ──
  formLayout?: {
    labelWidth?: string | number
    minFoldRows?: number         // query form collapses when rows exceed this
    // NOTE (AI-31③): there is deliberately NO 'span' here. Column count is a
    // PER-FIELD decision ('querySpan' / 'formSpan'); a layout-level 'span' was
    // never read by any renderer, so it was removed rather than left as a key
    // the contract would accept and silently strip.
  }

  // ── Advanced multi-dialog / toolbar mode ──
  // Providing ANY of toolbarBtns / tableBtns / operationColumn / dialogs
  // switches the GENERATOR into the "new" schema wrapper (buildSchemaWrapperNew).
  // NOTE (AI-35): that choice is only about which wrapper scaffold the generator
  // emits — it is NOT the runtime's button-derivation gate. At runtime the toolbar
  // and the row-action column keep being derived from \`actions\`; the button surface
  // is handed over ONLY by declaring \`toolbarBtns\` and/or \`operationColumn\`. So
  // \`dialogs: { add }\` (with \`add\` in \`actions\`) still gets its 「新增」 button.
  toolbarBtns?: ToolbarBtn[]     // buttons in the EsForm button area (legacy slot)
  tableBtns?: TableBtn[]         // toolbar buttons above the table
  operationColumn?: false | {    // row action column (false = hidden)
    label?: string
    width?: number | string
    fixed?: boolean | 'left' | 'right'
    btns: RowBtn[]               // at least one
  }
  dialogs?: Record<string, DialogConfig>  // keyed by dialog id
}

interface ToolbarBtn {          // rendered in EsForm button area
  name: string; key?: string; type?: string; icon?: string
  direction?: 'left' | 'right'  // Form-side direction. HIGHEST priority in core's
                                // resolveButtonSide(btn,'form') chain:
                                // direction → position → code → 'right'.
                                // Only form buttons have it; table buttons do not.
  position?: 'left' | 'right'   // 'left' | 'right'. Default when omitted: 'right'
                                // (the documented EsForm default — NOT the table
                                // default). Resolved by core's resolveButtonSide.
  code?: 1 | 2                  // Legacy alias: 1 = left, 2 = right (default). Still
                                // accepted; keep it consistent with \`position\`.
  dialogKey?: string; actionType?: string
  confirm?: string | boolean; permissionValue?: string
  triggerEvent?: boolean
}

interface TableBtn {            // toolbar button above the table
  name: string; key?: string; type?: string; icon?: string
  position?: 'left' | 'right'   // RECOMMENDED positioning field. All three
                                // renderers read it (core's getButtonPosition
                                // prefers \`position\`), and the renderer type
                                // declarations mark \`code\` as deprecated.
  code?: 1 | 2                  // Legacy alias: 1 = left (default), 2 = right.
                                // Still accepted; keep \`position\` and \`code\`
                                // consistent when you set both.
  dialogKey?: string; actionType?: string
  confirm?: string | boolean; permissionValue?: string
}

interface RowBtn {              // per-row action button
  name: string; key?: string; type?: string; icon?: string
  dialogKey?: string; confirm?: string | boolean; permissionValue?: string
}

interface DialogConfig {
  title?: string
  width?: string | number
  formItems?: FieldConfig[]
  formLayout?: { labelWidth?: string | number; minFoldRows?: number }
  hasCustomRender?: boolean     // declare a hand-written body in the wrapper SFC (no JSON transport for a render fn)
  isDraggable?: boolean
  maxHeight?: string | number
  fullscreen?: boolean
  isHiddenFooter?: boolean
  // Base data keys — forwarded verbatim to the underlying dialog (el-dialog / a-modal)
  // by each renderer's openDialog. Declare them instead of hand-editing the wrapper.
  showClose?: boolean           // hide the close (X) entry; default true
  destroyOnClose?: boolean      // reset internal state on each open
  modal?: boolean               // render the mask; default true
  closeOnClickModal?: boolean   // close when the mask is clicked; default true
  closeOnPressEscape?: boolean  // close on Escape; default true
  hiddenFullBtn?: boolean       // hide the built-in fullscreen toggle
  appendTo?: string             // CSS selector of the mount node (a DOM element can't travel in JSON)
  cacheKey?: string             // reuse one instance across calls (all three renderers; 10-min TTL after close)
  configBtn?: DialogBtn[]       // declarative footer buttons; omit for the generated cancel+confirm pair
}

interface DialogBtn {           // declarative subset — the click handler is attached by the runtime from 'action'
  name: string
  type?: string
  action?: 'confirm' | 'cancel' | 'custom'
  permissionValue?: string
}
\`\`\`

## httpRequest Integration (Production Pattern)

\`\`\`typescript
${!isVue2
    ? `// main.ts — configure once for the entire application
import axios from 'axios'
import ESPlus from '${v.esPlusPkg}'

app.use(ESPlus, {
  permission: (code) => userStore.permissions.includes(code), // permissionValue (RBAC) prerequisite
  t: (key) => i18n.global.t(key),                             // labelKey (i18n) prerequisite
  httpRequest: (params) => axios(params),                     // remote apiParams prerequisite (core top-level field)
  EsTable: {
    httpRequest: ${robustHttpRequest()},
    configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
  }
})`
    : `// main.js — configure once for the entire application
import Vue from 'vue'
import axios from 'axios'
import ESPlus from '${v.esPlusPkg}'

Vue.use(ESPlus, {
  permission: (code) => userStore.permissions.includes(code), // permissionValue (RBAC) prerequisite
  t: (key) => i18n.t(key),                                    // labelKey (i18n) prerequisite
  httpRequest: (params) => axios(params),                     // remote apiParams prerequisite (core top-level field)
  EsTable: {
    httpRequest: ${robustHttpRequest()},
    configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
  }
})`}
\`\`\`

With global config in place, pages only need \`apiParams: { url: '/api/xxx' }\` — no inline httpRequest.
\`permissionValue\` (field/column/button RBAC) and i18n \`labelKey\` take effect ONLY after this
entry assembles \`permission\` / \`t\`; without it the permission gate silently passes and labels
fall back to \`label\`. Both \`httpRequest\` and \`configQueryFieldOutput\` are read at component level
as well as top level; the legacy nested \`EsTable.methods.$httpRequest\` shape is still accepted.
${isAntdv ? "\nNOTE (antdv): also register Ant Design Vue itself before ESPlus — `import Antd from 'ant-design-vue'; import 'ant-design-vue/dist/reset.css'; app.use(Antd); app.use(ESPlus, {...})`.\n" : ""}

## configureEsPlus() — Module-Level Config (Auto-Import Mode)
\`\`\`typescript
import { configureEsPlus } from '${v.esPlusPkg}'

configureEsPlus({
  EsTable: { httpRequest: ${robustHttpRequest()} },
  EsForm: { httpRequest: ${robustHttpRequest()} },
  permission: (code) => userStore.permissions.includes(code),
  t: (key) => i18n.t(key),
  httpRequest: (params) => axios(params)
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

export function registerConventionsResource(server: McpServer, profile: ToolProfile = resolveToolProfile()) {
  // Four URIs:
  //   esplus://conventions       — vue3 (backward-compat default)
  //   esplus://conventions/vue3  — explicit vue3
  //   esplus://conventions/vue2  — vue2 variant with addendum on syntax deltas
  //   esplus://conventions/antdv — antdv variant (Vue 3 syntax + Ant Design Vue symbols)
  //
  // Pattern repeats across other resources (types, examples, crud-page-schema)
  // so AI clients can pull the right context for whichever target they're
  // generating against.
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://conventions", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://conventions/vue3", target: "vue3", descSuffix: " — @es-plus/vue3 explicit" },
    { uri: "esplus://conventions/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 + Element UI variant" },
    { uri: "esplus://conventions/antdv", target: "antdv", descSuffix: " — @es-plus/adapter-antdv + Ant Design Vue variant" },
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
          { uri, mimeType: "text/plain", text: buildConventionsContent(target, profile) },
        ],
      })
    );
  }
}
