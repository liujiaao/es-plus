# Why ES-Plus — A Config-Driven Answer for Admin CRUD in the AI Coding Era

> One-liner: **ES-Plus abstracts the most repetitive admin-panel chain — form, table, dialog — into a single JSON Schema. A hand-written 200-line template collapses to 30 lines of config. AI-generated code passes `vite build` in CI on the first try. And the exact same config runs unchanged on both the Vue 3 + Element Plus renderer and the Vue 2 + Element UI renderer.**

---

## Table of Contents

1. [The Real Cost of Admin Development: The Hidden Bills Nobody Wants to Total Up](#1-the-real-cost-of-admin-development)
2. [The Hidden Tax of Complex Interactions: Linkage, Cross-Page, Auto-Fit, Permissions, i18n](#2-the-hidden-tax-of-complex-interactions)
3. [New Pain in the AI Coding Era: Why AI Keeps Breaking on Component Libraries](#3-new-pain-in-the-ai-coding-era)
4. [How ES-Plus Solves It: Config-Driven + Dual Renderer + AI-Native](#4-how-es-plus-solves-it)
5. [Deep Dive: Core Capabilities](#5-deep-dive-core-capabilities)
6. [Compared to Other Tools: What's Different and Why](#6-compared-to-other-tools)
7. [The Killer Feature for the AI Era: MCP Server + CLI + E2E Matrix](#7-the-killer-feature-for-the-ai-era)
8. [ROI, Quantified](#8-roi-quantified)
9. [When to Pick ES-Plus, When to Skip It](#9-when-to-pick-es-plus-when-to-skip-it)
10. [Get Started in 3 Steps](#10-get-started-in-3-steps)

---

## 1. The Real Cost of Admin Development

Walk into any SaaS shop, internal tools team, or data platform group, grab any frontend engineer, and ask "what does the page you shipped last week look like?" Eight times out of ten you'll get some flavor of this:

- **Top-left**: a row of query filters — name, status, date range, department, etc.
- **Center / bottom-left**: a paginated table with a fixed actions column (edit, delete, details)
- **Bottom-right / modal**: an edit dialog containing another form and cancel/confirm buttons
- **Top-right**: export / bulk actions / new

That's the **admin CRUD mantra**: query → list → dialog → submit. **About 80% of admin pages look exactly like this.** The reason this is so painful is that it's **repetitive but not mechanical** — every page has different fields, different APIs, different state machines, different validation, different button permissions. **Copy-paste means changing 30 things every single time.**

### 1.1 How One Real Page Bloats

Take a "User Management" page — **8 query fields + 6 table columns + edit dialog** — the kind of page nearly every admin app has:

| Module | Vanilla Element Plus | Lines |
|------|----------------------|------|
| Query form (8 fields) | `<el-form>` + 8 × `<el-form-item>` + 8 × `<el-input>/<el-select>/<el-date-picker>` + 2 buttons | **~70** |
| Table (6 cols + actions + pagination) | `<el-table>` + 7 × `<el-table-column>` + scope slot + `<el-pagination>` | **~60** |
| Edit dialog | `<el-dialog>` + nested `<el-form>` + cancel/confirm + `validate()` | **~45** |
| Event handlers | `handleQuery` / `handleReset` / `handlePageChange` / `handleSizeChange` / `handleEdit` / `handleDelete` / `handleSubmit` | **~50** |
| State | `formRef` / `tableLoading` / `dialogVisible` / `editingRow` / `currentPage` / `pageSize` / `total` / `selectedRows` | **~25** |
| **Total** | | **~250** |

**ES-Plus takes the same page down to ~30 lines of config + ~10 lines of setup**, a savings of **~210 lines**.

The bigger point: of those 250 lines, at least **180 are dead code** — they look identical on every CRUD page; only the field names change. On a project with 20 CRUD pages, that's **3,600 lines that could just evaporate**.

### 1.2 The Hidden Costs of That Dead Code

The countable parts:

- **Write**: 3,600 lines × 1 min/line = 60 hours
- **Review**: 3,600 lines × 0.5 min/line = 30 hours
- **Test**: one pass + edge cases per page × 20 pages × 30 min = 10 hours

The uncountable parts (**the ones that actually kill you**):

- **Change**: PM wants 50/100 added to the page-size selector → 20 pages
- **Change**: backend renames `data` to `records` → 20 pages
- **Change**: UX wants loading state on every query button → 20 pages
- **Change**: compliance requires a confirm dialog on every delete → 20 pages
- **Change**: i18n phase 1 ships → 20 pages
- **Change**: permissions tighten from page-level to button-level → **you give up and rewrite everything**

Every one of those "horizontal" requirements costs the team 1–2 weeks of overtime. **That's the real cost of admin work** — not writing new code slowly, but the cost of changing the old code.

### 1.3 Template Code vs. Config: From "Writing Code" to "Writing Rules"

```vue
<!-- Traditional: 5–8 lines of template per field -->
<el-form-item label="Name" prop="name">
  <el-input v-model="form.name" placeholder="Enter name" clearable />
</el-form-item>
<el-form-item label="Status" prop="status">
  <el-select v-model="form.status" placeholder="Select" clearable>
    <el-option label="Enabled" :value="1" />
    <el-option label="Disabled" :value="0" />
  </el-select>
</el-form-item>
```

```typescript
// ES-Plus: one line per field, fully typed
const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6, attrs: { clearable: true } },
  { prop: 'status', label: 'Status', formtype: 'Select', span: 6,
    dataOptions: [{ label: 'Enabled', value: 1 }, { label: 'Disabled', value: 0 }] },
]
```

The win isn't "fewer lines." The win is that **this config is data** — it can be serialized, versioned, served by the backend, generated by AI, validated by CI. Template is a structured string. Config is a structured object. **Structured objects can be processed by tools; strings can only be processed by humans.** That's the foundation everything else is built on.

---

## 2. The Hidden Tax of Complex Interactions

The actual complexity of a CRUD page is never "render a form plus a table" — it's the **linkage between them** and the **cross-cutting concerns** that touch every page. Most component libraries pretend these problems don't exist, leaving teams to roll their own.

### 2.1 Form–Table Linkage: Hand-Wired vs. Automatic

| Behavior | Traditional | ES-Plus |
|------|---------|---------|
| Click Query | Write `handleQuery` → read form → build params → call API → setLoading → setData → setTotal | `triggerEvent: true` |
| Click Reset | Write `handleReset` → `formRef.resetFields()` → call query again | `triggerEvent: true` + `key: 'rest'` |
| Change page / pageSize | Write `handleCurrentChange` / `handleSizeChange` → grab current form values (**gotcha: you need the latest values**) → call API | **Zero code** — pagination automatically requests with current form values |
| Keep selection across pages | Maintain a `selectedMap`, diff and merge on every page change, write back to `<el-table>`'s selection | `cachePageSelection: true` |

ES-Plus uses `provide / inject` so that **dropping an EsForm into the default slot of an EsTable automatically wires them together** (see `inject('EsTableContext')` around [packages/vue3/src/components/es-form/src/es-form.vue:648](../packages/vue3/src/components/es-form/src/es-form.vue)). Setting `triggerEvent: true` on a button calls the table's `httpRequest` directly. **Zero glue code in the entire data loop.**

### 2.2 Cross-Page Selection: Wildly Underrated

"Bulk-approve 50 tickets spread across 3 pages" — this requirement shows up in 100% of approval / ticketing / reconciliation admin apps. Vanilla `<el-table>` loses selection on page change, and the common workaround is to hand-roll a `Map<rowKey, row>` and diff-merge it every time the page changes.

ES-Plus turns this into one line of config:

```typescript
options: {
  rowkey: 'id',
  cachePageSelection: true,  // keep selection across pages; footer toolbar shows count
}
```

The implementation lives in [packages/core/src/table-selection.ts](../packages/core/src/table-selection.ts) — the **same** algorithm is shared by both the Vue 3 and Vue 2 renderers, which means selection behavior is **byte-identical** regardless of which Vue version your project runs on.

### 2.3 Auto-Sizing Table Height: `100vh - 360px` Is Technical Debt

"Fill the remaining viewport space" is one of the most common requests for admin tables. The community usually picks one of these:

| Approach | Problem |
|------|------|
| `height: calc(100vh - 360px)` | Breaks the moment the header or toolbar height changes, doesn't keep up with responsive breakpoints |
| Manually compute `offsetHeight` in `mounted` | Stops working on route change or when the parent resizes |
| `<el-table :max-height>` | That's a max, not a fill; with lots of data and a small viewport, it overflows awkwardly |

ES-Plus ships a built-in `ResizeObserver` that watches the parent container and recomputes automatically (see the `useTableHeight` logic around line 826 of [packages/vue3/src/components/es-table/src/component.vue](../packages/vue3/src/components/es-table/src/component.vue)). **Drag the browser, collapse the sidebar, switch routes — the table tracks all of it.**

### 2.4 Any Backend: `configTableOut` as an API Adapter Layer

The most common argument on any admin frontend team:

- Backend A: `{ code: 0, data: { list: [...], total: 100 } }`
- Backend B: `{ result: { items: [...], count: 100, pageNum: 1, pageSize: 10 } }`
- Backend C: `{ records: [...], pagingInfo: { totalCount: 100 } }`

Community solutions either force the frontend to write an axios interceptor that normalizes everything, or force the backend to change its protocol. **ES-Plus makes field mapping a first-class part of table config**:

```typescript
options: {
  configTableOut: {
    total: 'count',           // use backend's `count` as total
    tableData: 'items',       // use backend's `items` as the row data
    pageSize: 'pageSize',
    current: 'pageIndex',
  }
}
```

And the lookup is **recursive** — your `count` nested inside `result.pagingInfo.count` is found automatically, no dot-path syntax required.

What this means in practice: **no adapter layer needed to integrate with legacy systems**. An admin app that talks to 5 different BFFs, each with a different protocol, used to require 5 separate axios interceptors. Now it's 4 lines of config per table.

### 2.5 Permissions: Declarative vs. Imperative

Most admin apps wire button permissions like this:

```vue
<el-button v-if="hasPermission('user:delete')" @click="del(row)">Delete</el-button>
```

`v-if` is scattered across every template. The moment a permission key gets renamed (`user:delete` → `iam.user.delete`), it's a project-wide search-and-replace, and **missing one is an incident**.

ES-Plus funnels permissions through a single global config plus a button attribute:

```typescript
// main.ts — register once
app.use(ESPlus, { permission: (v) => userPermissions.includes(v) })

// any button — declare the permission, the component handles the check
{ name: 'Delete', type: 'danger', permissionValue: 'user:delete', click: del }
```

Permission strategy changes? Edit the `permission` function in one place. Permission key renamed? Edit the button config's `permissionValue` — and because config is data, you can run a script to batch-rename, validate every permission key in CI, or even **let the backend serve the permission config and drive your frontend buttons directly**.

### 2.6 i18n: `labelKey` + Injected Function

ES-Plus doesn't bind to any specific i18n library. Pass a `t` function at install time and add a `labelKey` in your config:

```typescript
app.use(ESPlus, { t: (key) => i18n.global.t(key) })

const formItems = [
  { prop: 'name', label: 'Name', labelKey: 'form.user.name', formtype: 'Input' }
]
// labelKey + t → use translation; otherwise fall back to label
```

Works with `vue-i18n`, `@intlify/core`, or any in-house solution. **Shipping i18n phase 1 doesn't mean rewriting every `label` as `$t(...)`** — just add `labelKey`. Zero breaking change.

---

## 3. New Pain in the AI Coding Era

In the past two years (2024–2026), tools like Claude Code, Cursor, Continue, and Cline have changed everything. Anyone who's used them knows the experience: **getting an AI to write a CRUD page** is dramatically harder than getting it to write an algorithm.

Why? Algorithms are closed and verifiable — the AI writes one, runs the tests, and knows whether it works. Component libraries are open and full of implicit conventions — the AI writes code that **looks** fine but is **full of landmines** at runtime.

### 3.1 Four Standard Ways AI Breaks on Component Libraries

#### Case 1: API Version Salad

```vue
<!-- AI has seen Element 1.x, 2.x, 3.x, early Plus, current Plus, and Element UI (Vue 2) — and mixes them -->
<el-table :data="data" border>
  <el-table-column type="selection" :selectable="row => row.status === 1" />  <!-- ❌ v3 syntax -->
  <el-table-column prop="name" label="Name" align="center" />
  <el-table-column slot-scope="scope">  <!-- ❌ Vue 2 syntax -->
    <el-button @click="$emit('on-click', scope.row)" />  <!-- ❌ Element 1.x style -->
  </el-table-column>
</el-table>
```

The code looks plausible. **It just doesn't run.**

#### Case 2: Reactivity Trap

```typescript
// AI's take on a "user list"
const tableData = ref([])
const total = ref(0)

async function loadData() {
  const res = await fetch('/api/users')
  tableData.value = res.data  // ❌ the response isn't an array
  // actual: res = { code: 0, data: { list: [...], total: 100 } }
}
```

AI has no idea what your backend's response shape looks like, so it guesses the most common one. **It guesses wrong 80% of the time.**

#### Case 3: Hard-Coded Linkage

```typescript
// AI doesn't know about provide/inject, so it writes an event bus
function handleQuery() {
  emitter.emit('user-list:query', form.value)
}
// then in EsTable's mounted, emitter.on(...)
// — and on hot reload the listener registers twice, memory leaks, no obvious place to unsubscribe
```

AI defaults to whatever pattern it's seen most often (event bus, Pinia store, prop drilling), **not the pattern the library's author recommends**.

#### Case 4: Looks Right, Won't Compile

The most insidious one. AI emits an SFC like this:

```vue
<script setup>
import { useDialog } from 'es-plus-ui'
// ...
dialog({ render: (h) => <EsForm .../> })  // ❌ JSX not enabled
</script>
```

The logic is fine. **But `<script setup>` isn't marked `lang="jsx"`, and vite rejects it.** AI can't catch this kind of bug on its own — its training data is full of working code, not the meta-knowledge of "which combinations cause compile failures."

### 3.2 Why This Happens: AI Doesn't Know What Your Component Library Looks Like

The context an AI tool has access to is:

- The code already in your project (if any)
- npm package names (at best, the `dependencies` in `package.json`)
- Your natural-language description

**It can't see the component library's schema. It doesn't know which props are valid, which combinations fail to compile, what your backend's protocol is, or whether your project is on Vue 2 or Vue 3.**

The community has three common workarounds, and **none of them work well enough**:

1. **Stuff API docs into a giant prompt** — poor UX, expensive in tokens, blows up the AI's context window
2. **Hand-maintained `.cursorrules` / `CLAUDE.md`** — high team maintenance cost, drifts out of sync with the code
3. **Just let the AI guess** — 50%+ failure rate

### 3.3 The Real Answer: Let AI Pull the Schema Over a Protocol

This is exactly what **MCP (Model Context Protocol)** was designed for — the AI doesn't have to learn your component library; **the library tells the AI what it has**.

ES-Plus is one of the **very few** admin component libraries that actually delivers on this. Next section.

---

## 4. How ES-Plus Solves It

### 4.1 Three Pillars

```
                ┌─────────────────────────────────────────┐
                │  JSON Schema (@es-plus/shared)          │
                │  ─────────────────────────────────────  │
                │  StructuredCrudConfig                   │
                │  TableColumn / FormItemOption / ...     │
                │  zod validation / type generation /     │
                │  protocol contract                      │
                └────────────────┬────────────────────────┘
                                 │ same Schema
        ┌────────────────────────┼─────────────────────────────┐
        ▼                        ▼                             ▼
  ┌──────────────┐       ┌──────────────┐         ┌────────────────────┐
  │@es-plus/vue3 │       │@es-plus/vue2 │         │@es-plus/mcp-server │
  │ Vue 3        │       │ Vue 2.7      │         │ Claude/Cursor/...  │
  │ Element Plus │       │ Element UI   │         │ generate / validate│
  └──────────────┘       └──────────────┘         │ list_form_types... │
                                                  │ detect_project_... │
                                                  └────────────────────┘
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │ @es-plus/cli        │
                       │ batch CLI scaffold  │
                       └─────────────────────┘
```

### 4.2 Config-Driven = Pages Become Data

ES-Plus isn't "yet another component library." It's **a declarative DSL layer on top of one**. The output of that DSL is `FormItemOption[]` / `TableColumn[]` / `DialogOptions` — **plain serializable data**.

| Pages-as-data means | What you get |
|---------------------|---------|
| Config can be versioned | `git diff users.config.ts` shows the actual field change |
| Config can be served by the backend | The backend changes a field without a frontend deploy (great for enterprise low-code) |
| Config can be AI-generated | The MCP server emits valid config ([Section 7](#7-the-killer-feature-for-the-ai-era)) |
| Config can be schema-validated | Run `validate_config` in CI and catch errors before runtime |
| Config can be shared across frameworks | The same `columns` runs on both the Vue 3 and Vue 2 renderers |

### 4.3 Dual Renderer, Single Schema: Answering "Can Vue 2 Projects Use This?"

A lot of admin projects are still on Vue 2 + Element UI (**roughly 35–45% of the China market, as of 2026**). Nobody can afford the cost of migrating them to Vue 3.

ES-Plus's solution is to split out **`@es-plus/core` + two renderers**:

```
@es-plus/core        ← framework-agnostic: types, config validation,
                       table-selection algorithm, request layer, form-layout
@es-plus/vue3        ← Vue 3 render layer + Element Plus adapter
@es-plus/vue2        ← Vue 2.7 render layer + Element UI adapter
```

**The same `columns`, the same `formItemList`, the same `dialog options`** — change one import path and the same code moves from a Vue 3 project to a Vue 2 project (or back).

Going further: **the MCP server's generated config takes a `target: 'vue3' | 'vue2'`** — the AI picks the renderer and emits the matching SFC syntax.

### 4.4 AI-Native = Standardization at the Protocol Level

Most component libraries' "AI friendliness" is just talk — "our API names are semantic, AI can pick them up easily." ES-Plus turns AI-friendliness into a **verifiable engineering contract**:

1. **The MCP server** exposes 8 tools and 4 resource categories; the AI reads them over the protocol
2. **Configs are constrained by zod schemas**; AI-generated output is validated immediately and the AI retries on failure
3. **The CI matrix** runs vue3 × vue2 × schema mode × sfc mode on every push, executing `vite build` to prove AI-generated code **actually compiles**

That last one is the real guarantee. Other "AI-friendly" component libraries don't have a single e2e test — so what does "AI can write it" even mean?

---

## 5. Deep Dive: Core Capabilities

### 5.1 EsForm — 13 Control Types × 4 Data Sources × Conditional Visibility

```typescript
const formItems = [
  // 1. Text input
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6 },

  // 2. Static select
  { prop: 'status', label: 'Status', formtype: 'Select', span: 6,
    dataOptions: [{ label: 'Enabled', value: 1 }, { label: 'Disabled', value: 0 }] },

  // 3. Date range (attrs pass straight through to Element Plus)
  { prop: 'date', label: 'Date', formtype: 'datePicker', span: 8,
    attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },

  // 4. Remote-loaded select (apiParams + format callback)
  { prop: 'category', label: 'Category', formtype: 'Select', span: 6,
    apiParams: { url: '/api/categories' },
    callOptionListFormat: (data) => data.map(i => ({ label: i.name, value: i.id })) },

  // 5. Conditional visibility (reactive)
  { prop: 'remark', label: 'Remark', formtype: 'Input', span: 12,
    attrs: { type: 'textarea' },
    isHidden: (model) => model.status !== 1 },

  // 6. Fully custom render (escape hatch)
  { prop: 'custom', label: 'Custom', formtype: 'render', span: 12,
    render: (h, model) => h(MyComponent, { value: model.custom }) },
]
```

Supported controls: Input / Select / datePicker / timePicker / Switch / Rate / Cascader / Radio / Checkbox / Upload / Slider / ColorPicker / Transfer — plus the `render` escape hatch.

**The `render` field is the key** — unlike many libraries that lock you into their config DSL, leaving you to fork the source the moment you hit something special, ES-Plus exposes `render: (h, ctx) => VNode` on every form item and every table column. It means "this field is mine, I'll render it myself." Config-driven plus an escape hatch: the speed of the 90% case without getting trapped in the remaining 10%.

### 5.2 EsTable — Multi-Level Headers, Virtual Scrolling, Action Columns, Cross-Page Selection

`EsTable` is actually **three render engines** under one unified shell:

| Engine | When | File | Use case |
|------|---------|------|---------|
| Standard | Default | [packages/vue3/src/components/es-table/src/component.vue](../packages/vue3/src/components/es-table/src/component.vue) | Tens to a few thousand rows |
| Virtual | `options.virtual: true` | [packages/vue3/src/components/es-table/src/engines/virtual-engine.vue](../packages/vue3/src/components/es-table/src/engines/virtual-engine.vue) | Tens of thousands of rows, performance-sensitive |
| Tree | `lazy: true` + tree props | (inside component.vue) | Tree / hierarchical data |

The virtual engine wraps `el-table-v2` and patches a particularly subtle upstream issue: **`el-table-v2`'s `fixed` prop actually controls `bodyWidth = max(columnsTotalWidth, viewport)`** — without `fixed`, no matter how wide your columns are, the table never scrolls horizontally, and right-fixed columns "detach from the table body" on small screens. ES-Plus v1.4.1 enables `fixed` by default and exposes `scrollbar-always-on`, so **users don't have to configure anything — horizontal scrolling just works**.

Details in [packages/vue3/CHANGELOG.md](../packages/vue3/CHANGELOG.md#141--virtual-table-horizontal-scroll-fix).

### 5.3 useDialog — Imperative + Form Validation Integration + Nested Dialogs

The pain of template-based dialogs:

```vue
<!-- You have to declare it in the template, but you only know whether to open it in setup -->
<el-dialog v-model="visible" title="Edit">
  <UserForm ref="formRef" :data="editingRow" />
  <template #footer>
    <el-button @click="visible = false">Cancel</el-button>
    <el-button type="primary" @click="handleSave">Save</el-button>
  </template>
</el-dialog>

<script setup>
const visible = ref(false)
const editingRow = ref(null)
const formRef = ref()

function openEdit(row) {
  editingRow.value = row
  visible.value = true
}
function handleSave() {
  formRef.value.validate().then(() => { /* ... */ })
}
</script>
```

`useDialog` makes the whole thing imperative:

```typescript
const dialog = useDialog()

function openEdit(row) {
  const formData = reactive({ ...row })
  dialog({
    title: 'Edit User',
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm ref={el => el && registerRef('form', el)}
              model={formData}
              formItemList={[...]} />
    ),
    configBtn: [
      { name: 'Cancel', click: (_, { close }) => close() },
      { name: 'Save', type: 'primary', click: async (_, { close, getRefs }) => {
        await getRefs('form').validate()
        await api.update(formData)
        close()
      }},
    ],
  })
}
```

**Key capabilities**:

- `registerRef` / `getRefs` — refs work in imperative dialogs too (for form validation and child-component method calls)
- `configBtn` array configures buttons with built-in loading, confirm-step, and permission support
- Nested dialogs — call `dialog(...)` from inside another dialog's click handler; z-index stacks automatically
- JSX rendering with full type inference

### 5.4 EsCrudPage — A Single Schema Renders the Whole Page

If your page is the standard "query + table + dialog" CRUD template, you can skip even the EsForm + EsTable + useDialog combo and **pass a Schema directly**:

```typescript
const schema: CrudPageSchema = {
  api: { list: '/api/users', create: '/api/users', update: '/api/users/:id', delete: '/api/users/:id' },
  fields: [
    { prop: 'name', label: 'Name', formtype: 'Input', tableColumn: true, queryField: true },
    { prop: 'status', label: 'Status', formtype: 'Select', dataOptions: [...], tableColumn: true, queryField: true },
    // ...
  ],
  actions: ['create', 'edit', 'delete'],
  dialog: { width: '600px' },
}
```

```vue
<es-crud-page :schema="schema" />
```

Best for cases where **you just want the page on screen and don't care about deep customization** (data platforms, internal tools, prototype demos). For complex cases, drop back to the EsForm + EsTable + useDialog combo for finer-grained control.

### 5.5 Type System: 11 Core Interfaces + Cross-Framework Reuse

```typescript
import type {
  FormItemOption,     // form item
  BtnConfig,          // button
  LayoutFormProps,    // form layout
  TableColumn,        // table column
  TableOptions,       // table options
  PaginationConfig,   // pagination
  DialogOptions,      // dialog
  ApiParams,          // request params
  EsFormInstance,     // form instance methods
  EsTableInstance,    // table instance methods
  EsPlusOptions,      // global options
} from '@es-plus/vue3'
```

**Types shared across Vue 2 / Vue 3**: import the same interface names from `@es-plus/core/types` and the same `columns` array runs in both projects. **Portability at the type level** is something the community rarely achieves.

---

## 6. Compared to Other Tools

### 6.1 vs. Vanilla Element Plus / Element UI

**Element gives you parts; ES-Plus gives you patterns.** Element ships bricks. ES-Plus ships a floorplan.

| Dimension | Vanilla Element | ES-Plus |
|------|------------|---------|
| Learning curve | Low, well-documented | Medium — you need to internalize the config-driven mindset |
| Lines per page | ~250 | ~30 |
| Cross-cutting change | Edit N pages | Edit 1 config or 1 global default |
| Customization headroom | 100% | 95% (the extreme 5% uses the `render` escape hatch) |
| Best for | Landing pages, marketing, a small number of admin pages | Admin panels, internal tools, CRUD-heavy apps |

**Rule of thumb**: under 5 CRUD pages, just use Element directly. **Past 10 pages, ES-Plus's ROI dominates everything else.**

### 6.2 vs. Form Generators (@form-create, vue-form-create, FormMaking)

These tools focus on **pure forms** and usually ship a visual drag-and-drop editor.

| Aspect | Form Generator | ES-Plus |
|--------|---------------|---------|
| Forms | Strong | Strong |
| Tables | Not in scope | First-class |
| Dialogs | Not in scope | `useDialog` |
| Linkage | Within-form field linkage | **Form ↔ Table ↔ Dialog** end-to-end |
| Visual editor | Usually yes | No (ES-Plus is code- and config-driven; no drag tooling) |
| AI toolchain | No | MCP + CLI |

**Verdict**: if you only need forms plus a visual editor, Form Generator tools are a fit. If you need **whole-page CRUD**, ES-Plus is the complete answer.

### 6.3 vs. Vue Element Admin / vue-pure-admin / vue-element-plus-admin

These are **project templates** (Admin Templates) — you clone a full admin project including routing, login, permissions, menu scaffolding, and so on.

| Aspect | Admin Template | ES-Plus |
|--------|---------------|---------|
| What it is | Project scaffold | Component library |
| What you get | Full skeleton + example pages + router + permissions + theming | Form, table, and dialog components |
| How you use it | clone & modify | npm install & use |
| Upgrades | Hard (you've forked the source) | Easy (npm upgrade) |
| Compatibility | — | **Zero conflict — drop ES-Plus into any Admin Template project** |

**They're complementary.** A common combo: use vue-pure-admin for the project skeleton and use ES-Plus for every CRUD page inside it.

### 6.4 vs. Avue / vxe-table

Avue is a long-running config-driven admin library from the China community; vxe-table is a high-performance table component.

| Aspect | Avue | vxe-table | ES-Plus |
|--------|------|-----------|---------|
| Config-driven forms | Yes | No | Yes |
| Config-driven tables | Yes | Yes (more capable in code) | Yes |
| Dialog management | Yes | No | Yes (`useDialog`) |
| Vue 3 support | Yes | Yes | Yes |
| Vue 2 support | Yes | Yes | Yes (**same Schema**) |
| Cross-framework Schema | No | No | Yes |
| AI / MCP integration | No | No | Yes (**MCP server + CLI + E2E CI**) |
| Type coverage | Medium | High | High (11 interfaces fully exported) |
| Docs site | Yes | Yes | Yes + AI CRUD demo + StackBlitz Playground |

ES-Plus's unique differentiators: **shared Schema across Vue 2/Vue 3, an AI-native toolchain, and a CI safety net**. As of today no other component library — in China or abroad — ships all three.

### 6.5 vs. Naive UI / Ant Design Vue / Other General-Purpose UI Libraries

These target **all Vue apps**, going head-to-head with Element. They're in a different category — they answer "what does a button look like?" while ES-Plus answers "how do you build a CRUD page?"

In real projects: **base UI = Element / Naive / AntDV → middle layer = ES-Plus**. They stack.

### 6.6 vs. Building Your Own

The classic large-company arc: hand-write everything early, hit the pain wall, then stand up a team to build a "generic form engine / table engine."

| Aspect | In-house | ES-Plus |
|--------|------|---------|
| Startup cost | 6–12 person-months | 0 |
| Maintenance | 1–2 frontend engineers, ongoing | 0 |
| Docs / types | Depends on team investment | Complete |
| AI integration | 0 → you have to build it yourself again | Out of the box |
| Bus-factor risk | The single maintainer leaves and you're done | Open source community + multi-channel support |
| Customization headroom | 100% (your own code) | 95% (`render` escape hatch) |

**Building your own only makes sense in one scenario**: you have unusually specific requirements (financial risk-control tables, medical DICOM tables) where the last 5% of a generic solution can't be reached. Outside of that, **the ROI on in-house basically goes negative.**

---

## 7. The Killer Feature for the AI Era

This section is what sets ES-Plus apart from **every other** admin component library.

### 7.1 The 8 MCP Server Tools

See [packages/mcp-server/src/tools/index.ts](../packages/mcp-server/src/tools/index.ts):

| Tool | What it does | Pain it solves |
|------|------|----------|
| `detect_project_target` | Reads package.json, infers vue2/vue3 | AI no longer guesses which Vue version you're on |
| `generate_crud_page` | Natural language → full .vue file | One sentence yields a runnable page |
| `generate_crud_schema` | Natural language → structured Schema | Gives the AI a valid config as context |
| `generate_from_config` | Schema → SFC code | The codegen step in a Schema-first flow |
| `validate_config` | zod-validates a config | Bad AI output is caught and retried instantly |
| `list_form_types` | Returns the 13 formtypes + descriptions | AI no longer guesses which control names are valid |
| `get_component_api` | Returns a component's props / events / slots | What the AI sees is protocol-level API docs |
| `scaffold_page` | Multi-page scaffold | Creates a related group of pages at once |

**All tools are implemented in `@es-plus/shared`**, which means:
- The [AI CRUD demo page](https://liujiaao.github.io/es-plus/#/ai-crud) in your browser calls the same code (no backend required)
- One test pass simultaneously covers the MCP server, the CLI, and the browser demo
- Zero behavioral drift between the three callers

### 7.2 Wire It into Claude Code in One Line

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

After that, in any project just say to Claude:

> "Add a user management page to this project. Query: name, phone, status. Table columns: name, phone, email, status, created-at. Support create, edit, and delete."

Claude's workflow:

1. Call `detect_project_target` → read your package.json → discovers you're on Vue 3 + Element Plus
2. Call `list_form_types` → fetch the list of 13 valid controls
3. Call `generate_crud_schema(target='vue3')` → generate the Schema
4. Call `validate_config` → validation passes
5. Call `generate_from_config` → emit the full .vue file
6. Write it into your project and register the route

**At no point does the AI guess the component library's API, because the MCP protocol hands it the authoritative schema.**

### 7.3 CLI: CI-Friendly, Script-Friendly, Offline-Friendly

```bash
# Interactive
npx @es-plus/cli create user-management

# Non-interactive (for CI / scripts)
npx @es-plus/cli create user-management \
  --target vue3 --mode sfc \
  -d "User management. Query by name, phone, and status. Table shows name, phone, email, status, and created-at. Supports create/edit/delete."

# Validate a config (CI step)
npx @es-plus/cli validate ./config.json --schema form-item
```

The CLI doesn't depend on any AI service — it parses the natural-language description with local rules to produce a Schema. **Fully offline**, suitable for intranet deployments and projects with confidentiality requirements.

### 7.4 E2E Matrix: Proving AI-Generated Code Actually Compiles

Plenty of component libraries claim "AI-friendly" — **none of them prove it with e2e tests**. ES-Plus's CI runs this matrix ([.github/workflows/e2e.yml](../.github/workflows/e2e.yml)):

```
matrix:
  target: [vue3, vue2]      ← two renderers
  mode:   [schema, sfc]     ← two generation modes
```

Every push and PR runs **4 combinations**, each with this pipeline:

1. `npm pack @es-plus/{shared, vue3|vue2, cli}` → generate tarballs
2. Copy a fresh fixture ([__tests__/e2e/fixtures/vue3-fresh](../__tests__/e2e/fixtures/vue3-fresh) / [vue2-fresh](../__tests__/e2e/fixtures/vue2-fresh)) into a sandbox
3. `npm install` to pick up the freshly packed tarballs
4. `npx es-plus create App --target X --mode Y` to let the CLI generate code
5. `npm run build` runs `vite build` — any compile error = CI failure = the PR is blocked

**The first time we ran this CI, vue2 sfc mode failed immediately** — surfacing a bug in the import-extraction logic. We fixed it and it's been green ever since.

The point of this matrix is a **contract-level guarantee**: **any code ES-Plus emits will compile**. That's an engineering bar the community rarely clears.

### 7.5 The AI CRUD Demo in the Browser

Open [https://liujiaao.github.io/es-plus/#/ai-crud](https://liujiaao.github.io/es-plus/#/ai-crud) and you'll see:

- Left: 6 presets (user management / order dialog / virtual scrolling / multi-step form / cross-page approval / cascading filters)
- Right: a Trace timeline that visualizes every MCP tool call, AI request, zod validation, and codegen step
- Preview / Code / JSON tabs: see the generated result directly

That page is **living documentation of the "AI + es-plus + MCP" workflow** — visitors don't have to read the docs; one look and they get it. It's the only admin component library demo in the community with **protocol-level visualization**.

---

## 8. ROI, Quantified

Assume a **30-page CRUD admin project** with a 3-person frontend team and a 6-month timeline.

### 8.1 Direct Code Savings

| Item | Vanilla Element | ES-Plus | Savings |
|---|------------|---------|-----|
| 30-page total lines | 30 × 250 = 7,500 | 30 × 30 = 900 | **6,600 lines** |
| Hours to write 30 pages | 7,500 ÷ 30 lines/hr = 250 hr | 900 ÷ 30 = 30 hr | **220 hr** |
| Hours to code-review | 7,500 ÷ 100 lines/hr = 75 hr | 900 ÷ 100 = 9 hr | **66 hr** |

**Direct savings: ~286 hours ≈ 7 working weeks (about a month and a half of one frontend engineer's work).**

### 8.2 Savings on Cross-Cutting Requirements

Assume 5 horizontal requirements within the project cycle (page-size selector additions / global loading / delete confirmation / permission tightening / i18n launch):

| Item | Vanilla Element | ES-Plus |
|---|------------|---------|
| One cross-cutting change | 30 pages × 0.5 hr = 15 hr | 1–2 config or global function edits = 0.5 hr |
| 5 changes total | 75 hr | 2.5 hr |

**Cross-cutting savings: ~72 hours ≈ 1.8 working weeks.**

### 8.3 AI-Collaboration Gains (Exclusive to v1.4+)

Assume the team uses Claude Code, and 50% of new pages are AI-generated (the rest being complex business pages):

| Item | Without MCP | With MCP |
|---|---------|--------|
| Usable rate of AI-generated code | ~40% (often guesses APIs wrong) | ~95% (schema constraint + zod validation) |
| AI generation + manual cleanup per page | 30 min | 8 min |
| 15 AI-generated pages | 15 × 30 = 450 min | 15 × 8 = 120 min |

**AI-collaboration savings: ~5.5 hours.** (The absolute number is small, but **with MCP, AI-generated code becomes dramatically more readable and consistent** — a long-term maintenance benefit that's hard to quantify.)

### 8.4 Maintenance-Phase Gains (After Launch)

Post-launch is the real cost center. For an admin app with a **5-year lifespan**:

| Item | Vanilla Element | ES-Plus |
|---|------------|---------|
| Adapt to a new backend's field shape | Edit axios interceptors + edit affected pages | Edit `configTableOut` in one place |
| Add a new field to 30 pages | Edit 30 templates | Edit 30 configs (one order of magnitude fewer lines) |
| Migrate Vue 2 → Vue 3 (if needed) | Rewrite the whole project | **Keep the schema, change one import** — incremental migration |

**That last item is potentially a project-saver** — once Vue 2 hits EOL, whether you can upgrade to Vue 3 cheaply will decide whether the project survives. ES-Plus's dual-renderer design **drives that upgrade cost close to zero.**

---

## 9. When to Pick ES-Plus, When to Skip It

### 9.1 Strongly Recommend ES-Plus When

- Admin panels / management systems / data platforms / internal tools — this is its home turf
- 10+ CRUD pages — the ROI inflection point
- Vue 2 projects that want modern config-driven development — no alternative exists
- You maintain Vue 2 and Vue 3 projects in parallel — share one Schema
- Team size of 3+ that needs a consistent coding style — config-driven naturally enforces it
- You use Claude Code / Cursor / Cline — MCP integration pays off immediately
- Diverse backend protocols and inconsistent field shapes — `configTableOut` + `listenToCallBack` intercept everything
- You need complex table interactions (cross-page selection, virtual scrolling, auto-fit height, fixed columns) — one line of config each

### 9.2 Skip ES-Plus When

- Marketing sites / landing pages — use Element / Vuetify / Naive or another general UI library
- Highly bespoke visuals (the designer forbids any Element styling) — customization cost will outweigh savings
- Fewer than 5 CRUD pages — the learning cost of config-driven thinking exceeds the savings
- You don't use the Element ecosystem at all — ES-Plus depends heavily on Element Plus / Element UI
- A visual drag-and-drop editor is a core requirement — use a Form Generator tool

### 9.3 Mixed Cases (Depends)

- Interaction-heavy specialty pages (approval-flow editors, kanban designers, data dashboards) — ES-Plus isn't built for these, but your CRUD pages can still use it
- A large pile of in-house Element utilities already exists — evaluate migration cost; you can adopt ES-Plus **incrementally, only in new pages**

---

## 10. Get Started in 3 Steps

### Step 1: Install

**Vue 3**:

```bash
npm install @es-plus/vue3 element-plus @element-plus/icons-vue
```

**Vue 2.7**:

```bash
npm install @es-plus/vue2 element-ui
```

### Step 2: Register the Plugin

```typescript
// main.ts (Vue 3)
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'

createApp(App)
  .use(ElementPlus)
  .use(ESPlus, {
    permission: (v) => userPermissions.includes(v),  // optional
    t: (key) => i18n.global.t(key),                  // optional
  })
  .mount('#app')
```

### Step 3: Write Your First CRUD Page

```vue
<template>
  <es-table v-model:data-source="data" v-model:pagination="pagination"
            :columns="columns" :options="options">
    <es-form :model="form" :form-item-list="formItems" :config-btn="btns" />
  </es-table>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ name: '', status: '' })
const data = ref([])
const pagination = ref({ current: 1, pageSize: 10, total: 0 })

const formItems = [
  { prop: 'name', label: 'Name', formtype: 'Input', span: 6 },
  { prop: 'status', label: 'Status', formtype: 'Select', span: 6,
    dataOptions: [{ label: 'Enabled', value: 1 }, { label: 'Disabled', value: 0 }] },
]

const btns = [
  { name: 'Query', type: 'primary', key: 'query', triggerEvent: true },
  { name: 'Reset', key: 'rest', triggerEvent: true },
]

const columns = [
  { prop: 'name', label: 'Name' },
  { prop: 'status', label: 'Status' },
  { prop: 'operate', label: 'Actions', btns: [
    { name: 'Edit', type: 'primary', clickEvent: (row) => edit(row) },
    { name: 'Delete', type: 'danger', clickEvent: (row) => del(row) },
  ]},
]

const options = {
  border: true,
  httpRequest: (params) => fetch('/api/users', { method: 'POST', body: JSON.stringify(params.formParams) }).then(r => r.json()),
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
}
</script>
```

**That's it.** 30 lines of config and you have a complete admin page with query, list, pagination, and actions.

### Want It Faster? Let AI Write It

```bash
claude mcp add es-plus -- npx -y @es-plus/mcp-server
```

```
> Add a user management page. Query by name and status. Show name, email, status, and created-at in the table. Support create, edit, and delete.
```

AI pulls the ES-Plus Schema through the MCP protocol, generates the code, writes the file, registers the route. **All you have to do is review it.**

---

## Resources

- **Docs**: <https://liujiaao.github.io/es-plus/>
- **Playground (StackBlitz sandbox)**: <https://liujiaao.github.io/es-plus/#/playground>
- **AI CRUD generator (live MCP demo)**: <https://liujiaao.github.io/es-plus/#/ai-crud>
- **npm packages**:
  - [@es-plus/vue3](https://www.npmjs.com/package/@es-plus/vue3)
  - [@es-plus/vue2](https://www.npmjs.com/package/@es-plus/vue2)
  - [@es-plus/core](https://www.npmjs.com/package/@es-plus/core)
  - [@es-plus/mcp-server](https://www.npmjs.com/package/@es-plus/mcp-server)
  - [@es-plus/cli](https://www.npmjs.com/package/@es-plus/cli)
- **GitHub**: <https://github.com/liujiaao/es-plus>
- **Releases**: <https://github.com/liujiaao/es-plus/releases>
- **v1.4 migration guide**: [docs/migrate-v1.4.md](./migrate-v1.4.md)

---

## The Next Decade of Component Libraries

In 2014, Element 1.x shipped and gave the Vue ecosystem its first industrial-grade UI library.
In 2020, Element Plus launched and gave Vue 3 admin development a standard answer.
In 2024, the MCP protocol was born and gave AI the ability to actually "read" a codebase.

In the next decade, the competition between component libraries **won't be about how many props you have or how pretty your styles look** — it'll be about **whether AI can write code that actually runs, whether one Schema can be reused across frameworks, and whether your team's cross-cutting requirements can be funneled into a single configuration layer.**

ES-Plus is the first admin component library to deliver all three.

**Star, Try, Feedback**: <https://github.com/liujiaao/es-plus>

---

<small>This document corresponds to ES-Plus v1.4.1 / Vue3 1.4.1 / Vue2 1.0.0 / Shared 1.1.0 / CLI 1.2.0 / MCP-Server 1.2.0 (May 2026). All linked source files point to the current master branch of the repository.</small>
