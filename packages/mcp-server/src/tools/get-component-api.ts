import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { COMPONENT_LIST, type ComponentName } from "@es-plus/shared";

// Two-axis template: { component, target } → API doc string.
//
// We keep a single set of templates and substitute the import-side bits at
// render time so the docs for EsForm/EsTable/useDialog stay in sync between
// the vue3 and vue2 variants. Only the surfaces that actually differ between
// renderers are parameterized:
//   - es-plus package name (`@es-plus/vue3` vs `@es-plus/vue2`)
//   - Element layer (`element-plus` vs `element-ui`)
//   - SFC style (`<script setup>` vs `defineComponent + setup()`)
//   - v-model syntax (`v-model:visible` vs `:visible.sync`)
//
// Everything else — props, methods, schema interfaces, key features — is
// identical because both renderers share `@es-plus/shared` and the same JSON
// schema. This is the whole point of the dual-renderer architecture.

type Target = "vue3" | "vue2" | "antdv";

interface TargetVars {
  esPlusPkg: string;
  elementPkg: string;
  elementCss: string;
  scriptSetup: string;
  vModelSync: (prop: string) => string;
  /** data-source 的绑定写法：vue2 是单向特例（组件从不 emit update:dataSource）。 */
  vDataSource: string;
  jsxNote: string;
}

const TARGETS: Record<Target, TargetVars> = {
  vue3: {
    esPlusPkg: "@es-plus/vue3",
    elementPkg: "element-plus",
    elementCss: "element-plus/dist/index.css",
    scriptSetup: "<script setup>",
    vModelSync: (prop) => `v-model:${prop}`,
    vDataSource: "v-model:data-source",
    jsxNote: "Use `<script setup lang=\"tsx\">` for JSX.",
  },
  vue2: {
    esPlusPkg: "@es-plus/vue2",
    elementPkg: "element-ui",
    elementCss: "element-ui/lib/theme-chalk/index.css",
    scriptSetup: "<script>\nimport { defineComponent } from 'vue'\nexport default defineComponent({\n  setup() { /* ... */ }\n})",
    vModelSync: (prop) => `:${prop}.sync`,
    // F7：vue2 es-table 从不 emit `update:dataSource` —— `.sync` 会承诺一个永不触发的方向。
    vDataSource: ":data-source (one-way — vue2 never emits update:dataSource)",
    jsxNote: "Vue 2.7's `<script setup>` works but JSX requires the @vue/babel-preset-jsx plugin. defineComponent + setup() is the safer fallback.",
  },
  antdv: {
    esPlusPkg: "@es-plus/adapter-antdv",
    elementPkg: "ant-design-vue",
    elementCss: "ant-design-vue/dist/reset.css",
    scriptSetup: "<script setup>",
    vModelSync: (prop) => `v-model:${prop}`,
    vDataSource: "v-model:data-source",
    jsxNote: "Use `<script setup lang=\"tsx\">` for JSX (Vue 3 syntax, identical to vue3).",
  },
};

function docEsForm(v: TargetVars): string {
  return `# EsForm API (${v.esPlusPkg})

## Props
| Prop | Type | Description |
|------|------|-------------|
| model | \`Record<string, unknown>\` | Form data model (reactive object) |
| formItemList | \`FormItemOption[]\` | Array of form field configurations |
| configBtn | \`BtnConfig[]\` | Button configurations (query, reset, etc.) |
| layoutFormProps | \`LayoutFormProps\` | Layout settings (row/col grid, fold) |

## FormItemOption Interface
\`\`\`typescript
interface FormItemOption {
  prop: string              // Field key in model
  label: string             // Display label
  formtype?: FormType       // Input/Select/DatePicker/TimePicker/Switch/Rate/Upload/...${v.esPlusPkg === '@es-plus/adapter-antdv' ? '\n                            // antdv: ColorPicker degrades to a native <input type="color"> — no alpha/preset/history, and it does NOT trigger a-form-item validation' : ''}
  span?: number             // Grid span (1-24, default 6)
  attrs?: Record<string, unknown>  // Pass-through to ${v.elementPkg} component
  dataOptions?: Array<{ label: string; value: unknown }>  // Options for Select/Radio/Checkbox
  isHidden?: ((model, item, formProps) => boolean)
    | { field: string; op?: 'eq'|'ne'|'in'|'nIn'|'empty'|'notEmpty'|'truthy'|'falsy'; value?: unknown }
    | Array<{ field: string; op?: 'eq'|'ne'|'in'|'nIn'|'empty'|'notEmpty'|'truthy'|'falsy'; value?: unknown }>
                            // Dynamic visibility: a function, OR a declarative
                            // plain-JSON condition (array = AND). HIDDEN while it
                            // holds. Form-scope (query + add/edit), not the table column.
  render?: (h, model, ctx) => VNode    // Custom render function
  apiParams?: ApiParams     // Remote data loading config
  isInitRun?: boolean       // Auto-load API data on mount (default true)
}
\`\`\`

## BtnConfig Interface
\`\`\`typescript
interface BtnConfig {
  name: string              // Button text
  key?: string              // Identifier (query/reset/add/...)
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  icon?: string             // ${v.elementPkg} icon name
  triggerEvent?: boolean    // If true, triggers table refresh via provide/inject
  click?: (model, formRef, httpRequestInstance?) => void
}
\`\`\`

## Instance Methods (via ref)
- \`validate()\` — Trigger form validation
- \`resetFields()\` — Reset to initial values
- \`clearValidate()\` — Clear validation messages

## Import
\`\`\`typescript
import { EsForm } from '${v.esPlusPkg}'
\`\`\`

## Key Features
- Config-driven: define form entirely via JSON
- Auto grid layout with \`span\` property
- Fold/expand for query forms
- Built-in provide/inject linking with EsTable (\`triggerEvent: true\`)
`;
}

function docEsTable(v: TargetVars): string {
  return `# EsTable API (${v.esPlusPkg})

## Props
| Prop | Type | Description |
|------|------|-------------|
| columns | \`TableColumn[]\` | Column definitions |
| options | \`TableOptions\` | Table behavior configuration |
| dataSource (${v.vDataSource}) | \`any[]\` | Table data array |
| pagination (${v.vModelSync("pagination")}) | \`PaginationConfig\` | Pagination state |

## TableColumn Interface
\`\`\`typescript
interface TableColumn {
  prop?: string            // Data field key
  label?: string           // Column header
  width?: number | string
  minWidth?: number | string
  align?: string           // left/center/right (default: center)
  fixed?: boolean | 'left' | 'right'
  groups?: TableColumn[]   // Nested group columns
  render?: (h, ctx) => VNode    // Custom cell render
  scopedSlots?: { customRender?: string }  // Named slot
  btns?: Array<{ name: string; type?: string; clickEvent?: (row) => void }>
  ellipsis?: boolean       // Show tooltip on overflow
  hidCol?: boolean         // Hide column
}
\`\`\`

## TableOptions Interface
\`\`\`typescript
interface TableOptions {
  border?: boolean
  stripe?: boolean
  multiSelect?: boolean       // Show checkbox column
  snIndex?: boolean           // Show row index column
  expand?: boolean            // Show expand column
  httpRequest?: (params) => Promise<any>  // Data fetching function
  configTableOut?: Record<string, string>  // Response field mapping
  rowkey?: string             // Row unique key
  isInitRun?: boolean         // Auto-fetch on mount (default true)
  heightType?: 'auto' | 'height' | 'maxHeight'  // 'height' = fixed height; 'maxHeight' = capped at tabHeight (a 'height' value is IGNORED); 'auto' = no container height constraint. Default 'auto'
  tabHeight?: number | string  // Height consumed for EVERY heightType: under 'height' it overrides 'height'; under 'maxHeight' it is the cap. number → px, string → raw CSS value
  height?: number | string    // Container height used ONLY when heightType is 'height' (ignored for 'auto' / 'maxHeight')

  // Virtual scrolling (el-table-v2, suitable for 10k+ rows)
  // Vue 3 only — Vue 2 + Element UI fallback to standard ElTable scrolling.
  virtual?: boolean
  engine?: 'default' | 'virtual' | 'vxe'   // 'vxe' swaps in vxe-table (same columns/dataSource API)
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
  rowClassName?: string | ((params: { row, rowIndex }) => string)
}
\`\`\`

## Instance Methods (via ref)
- \`httpRequestInstance(model?)\` — Trigger data fetch
- \`clearSelection()\` — Clear all selection (cross-page cache and vxe reserve included)
- \`getSelectionRows()\` — Get selected rows
- \`toggleRowSelection(row, selected?)\` — Toggle row checkbox
- \`scrollToRow(index)\` — Scroll to row by index. Implemented by the vxe engine (all three targets) and the virtual engine (vue3); a no-op on the default el-table / a-table engine
- \`refresh()\` — Reload current page

## Import
\`\`\`typescript
import { EsTable } from '${v.esPlusPkg}'
\`\`\`

## Key Features
- Built-in pagination with auto-refresh
- httpRequest with configTableOut for response mapping
- Grouped columns via \`groups\` property
- Operation column via \`btns\` array
- Auto-linked with EsForm via provide/inject
${v.esPlusPkg === "@es-plus/vue3"
    ? "- Virtual scrolling: same API, just add `virtual: true` for 10k+ row performance (renders the el-table-v2 engine; `engine: 'virtual'` is equivalent, `engine: 'vxe'` switches to vxe-table)"
    : v.esPlusPkg === "@es-plus/adapter-antdv"
    ? "- Virtual scrolling: `virtual: true` is forwarded to `<a-table :virtual>` (Ant Design Vue 4 native virtual scroll) — pair it with `height` for the viewport. The el-table-v2 renderer is Element Plus (vue3) only, and its `rowHeight`/`estimatedRowHeight`/`overscanCount` knobs do not apply here. `engine: 'vxe'` switches to vxe-table instead."
    : "- For 10k+ rows on Vue 2, use server-side pagination or `engine: 'vxe'` — Element UI has no el-table-v2, so `virtual: true` / `engine: 'virtual'` are ignored (with a console warning), but the vxe engine is fully supported here and brings vxe-table's own virtual scroll."}

## vxe engine — \`options.engine: 'vxe'\`
Opt in via \`options.engine: 'vxe'\`. Requires \`vxe-table\` registered globally
(\`import VxeTable from 'vxe-table'; app.use(VxeTable)\`); otherwise the engine renders an install hint instead of the grid. It keeps the same \`columns\` / \`dataSource\` API and adds vxe-grid's advanced features.

Additional \`options\` fields consumed **only** under vxe:
\`\`\`typescript
interface VxeOnlyOptions {
  editConfig?      // inline editing — auto-enables keepSource unless you override it
  toolbarConfig?   // true → { export, refresh, custom }; a toolbar hides EsTable's own configBtn
  exportConfig?    // Excel/CSV export
  columnConfig?    // column width / drag
  treeConfig?      // tree rows (deprecated \`children\` normalized to \`childrenField\`)
  proxyConfig?     // vxe owns the request + pager (EsTable hides its own pagination)
  expandConfig? seqConfig? spanMethod?
  showFooter? footerMethod? footerData?
  keyboardConfig? mouseConfig? validConfig? printConfig?
}
\`\`\`

Escape hatch: \`options.vxeConfig\` — any vxe-grid option, deep-merged last-wins; \`options.vxeOn\` maps config keys to vxe event handlers (\`onXxx\`).

vxe-only instance methods (no-op / \`[]\` / \`null\` under other engines):
- \`vxeInstance()\` — the raw vxe-grid (60+ methods / 45+ events)
- inline edit: \`getInsertRecords()\` / \`getUpdateRecords()\` / \`getRemoveRecords()\` / \`revertData()\` / \`clearActived()\` / \`clearValidate()\` / \`validate()\`
- \`refresh()\` / \`reload()\` call \`commitProxy\` when \`proxyConfig\` is set

Gotchas:
- \`multiSelect\` under vxe needs \`options.rowkey\` (cross-page reserve can't key rows otherwise)
- inline edits do **not** auto-write back to \`:data-source\` — persist via \`getUpdateRecords()\` or an \`edit-closed\` handler
- \`virtual: true\` selects a **separate** engine (\`'virtual'\`), not a vxe knob
`;
}

function docUseDialog(v: TargetVars): string {
  const v3Hint = v.esPlusPkg !== "@es-plus/vue2";
  return `# useDialog API (${v.esPlusPkg})

## Usage
\`\`\`typescript
import { useDialog } from '${v.esPlusPkg}'

const dialog = useDialog()

dialog({
  title: '新增用户',
  width: '500px',
  render: (h, { registerRef }) => ${v3Hint
      ? `(
    <EsForm ref={el => registerRef('form', el)} model={formData} formItemList={items} />
  )`
      : `h(EsForm, {
    ref: (el) => registerRef('form', el),
    props: { model: formData, formItemList: items }
  })`},
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {
      await getRefs('form')?.validate()
      // save logic
      close()
    }}
  ]
})
\`\`\`

${v.jsxNote}

## DialogOptions Interface
\`\`\`typescript
interface DialogOptions {
  title?: string
  width?: string | number
  visible?: boolean              // dialog visibility (imperative calls usually pass true)
  render?: (h, instance, components) => VNode   // Dialog body content
  renderHeader?: (h, instance) => VNode         // Custom header
  renderFooter?: (h, instance) => VNode         // Custom footer
  configBtn?: BtnConfig[]     // Footer buttons — NOTHING is rendered when omitted (no implicit confirm/cancel), same as the <es-dialog> component
  onClosed?: () => void
  isDraggable?: boolean       // Draggable dialog
  hiddenFullBtn?: boolean     // Hide fullscreen toggle
  isHiddenFooter?: boolean    // Hide footer entirely
  maxHeight?: string | number
  appendTo?: string | HTMLElement   // mount target (default: body)
  fullscreen?: boolean
  loading?: boolean           // loading mask over the body
  showClose?: boolean         // show the close (X) button — default true
  destroyOnClose?: boolean    // destroy the body on close (resets inner state)
  modal?: boolean             // render the mask — default true
  closeOnClickModal?: boolean // click the mask closes — default true
  closeOnPressEscape?: boolean// ESC closes — default true
  beforeClose?: (done: () => void) => void   // intercept close; call done() to proceed
  cacheKey?: string           // reuse one cached instance across calls (state kept)
  alignCenter?: boolean       // vertically centered
  top?: string                // CSS margin-top of the dialog (default '15vh')
  modalClass?: string         // custom class on the mask
}
\`\`\`
Cross-renderer members: **antdv does not declare \`loading\`** (its dialog has no body-loading
mask) — passing it there is silently ignored. \`cacheKey\` is supported on all three renderers
(instance cache, 10-min TTL after close).

## Return value
\`\`\`typescript
const { instance, close, destroy } = dialog({ ... })   // DialogResult
// also callable directly: dialog.close() / dialog.destroy(cacheKey?)
\`\`\`
- \`instance\` — the dialog vNode. Mutate its props reactively:
  \`instance.component.props.loading = false\` (Vue 3) / \`instance.loading = false\` (Vue 2).
- \`close()\` — close this dialog (or the \`cacheKey\` one)
- \`destroy(cacheKey?)\` — destroy one cached instance, or all when called with no argument

Pass \`cacheKey\` in the options to keep a dialog's state across reopenings (it is cached, not unmounted, and recycled ~10 min after close).

## render context — \`render(h, ctx, components)\`
- \`ctx.registerRef(name, el)\` — register an inner component ref by name
- \`ctx.getRefs()\` — read the registered refs object

## configBtn click — \`click(model, ctx)\`
\`ctx = { close, getRefs(name?), dialogInstance }\`.

## The dialog's own exposed methods (via ref / \`instance\`)
\`{ close, closed, toggleFullscreen, doClose }\` — see the EsDialog doc. (There is **no** \`registerRef\`/\`getRefs\`/\`setLoading\` on the dialog instance itself; \`registerRef\`/\`getRefs\` live on the render context, and \`setLoading\` does not exist.)

## Key Features
- Imperative API: call function instead of managing v-model
- ${v3Hint ? "JSX render for dialog body" : "Render function (h, ctx) for dialog body — JSX optional"}
- Ref registration for form validation in confirm handler
- Auto fullscreen button
- Draggable support
`;
}

function docEsDialog(v: TargetVars): string {
  const isAntdv = v.esPlusPkg === "@es-plus/adapter-antdv";
  return `# EsDialog API (${v.esPlusPkg})

Declarative dialog component. For the imperative (function-call) form, see the \`useDialog\` doc — same body/options, no template needed.

## Props
\`\`\`typescript
interface EsDialogProps {
  title?: string
  visible?: boolean              // ${v.vModelSync("visible")}
  width?: string | number
  appendTo?: string | HTMLElement // mount target (default: body)${v.esPlusPkg === "@es-plus/vue2" ? " — Element UI 2.x only supports the boolean append-to-body: a non-'body' selector degrades to body and warns at runtime" : v.esPlusPkg === "@es-plus/adapter-antdv" ? " — forwarded to a-modal getContainer" : " — forwarded to el-dialog appendTo"}
  configBtn?: BtnConfig[]        // footer buttons — NOTHING is rendered when omitted (no implicit confirm/cancel); use this or the footer slot
  maxHeight?: string | number
  isDraggable?: boolean
  fullscreen?: boolean           // initial fullscreen state
  hiddenFullBtn?: boolean        // hide the fullscreen toggle
  isHiddenFooter?: boolean       // hide the footer entirely
  showClose?: boolean            // show the close (X) button — default true
  loading?: boolean              // loading mask over the body
  destroyOnClose?: boolean       // destroy body content on close
  modal?: boolean                // show the overlay mask — default true
  closeOnClickModal?: boolean    // click mask to close — default true
  closeOnPressEscape?: boolean   // ESC to close — default true
  top?: string                   // dialog top offset (e.g. '15vh')
  render?: (h, ctx, components) => VNode    // body content
  renderHeader?: (h, instance) => VNode     // custom header
  renderFooter?: (h, instance) => VNode     // custom footer
  beforeClose?: (done: () => void) => void  // intercept close; call done() to proceed
}
\`\`\`

## Emits
- \`update:visible\` \`(val: boolean)\` — sync via ${v.vModelSync("visible")}
- \`closed\` \`(val: boolean)\` — fired after the dialog closes
- \`open\` — fired when it opens (same on all three renderers)

## Exposed instance methods (via ref) — same on all three renderers
- \`close()\` — close (runs the \`beforeClose\` gate)
- \`closed()\` — alias of \`close()\`
- \`toggleFullscreen()\` — toggle fullscreen
- \`doClose()\` — force close, **bypassing** \`beforeClose\`

## Slots
${isAntdv
      ? "- `title` — header / `default` — body / `footer` — footer"
      : "- `footer` — footer (rendered only when neither `configBtn` nor `renderFooter` is set)"}

## render context — \`render(h, ctx, components)\`
- \`ctx.registerRef(name, el)\` — register an inner component ref by name
- \`ctx.getRefs()\` — read the registered refs object

## configBtn click — \`click(model, ctx)\`
\`ctx = { close, getRefs(name?), dialogInstance }\`.

## Import
\`\`\`typescript
import { EsDialog } from '${v.esPlusPkg}'
\`\`\`

## Key Features
- Config-driven footer via \`configBtn\`; register an inner EsForm ref and \`validate()\` it before closing
- Draggable + fullscreen + \`beforeClose\` gate
- Footer buttons honor button-level \`permissionValue\` (RBAC)
`;
}

function docEsCrudPage(v: TargetVars): string {
  return `# EsCrudPage API (${v.esPlusPkg})

One \`schema\` object → a full CRUD page (query form + table + dialogs). The renderer wires EsForm + EsTable + dialogs together, so you describe the page, not the wiring.

## Props
\`\`\`typescript
interface CrudPageProps {
  schema: CrudPageSchema                                // required
  httpRequest?: (params) => Promise<unknown>            // data fetching fn
  autoLoad?: boolean                                    // fetch on mount — default true
}
\`\`\`

## CrudPageSchema (the \`schema\` prop)
\`\`\`typescript
interface CrudPageSchema {
  formItems?: FormItemOption[]          // query form fields
  formLayout?: { labelWidth?, minFoldRows? }
  toolbarBtns?: CrudBtnConfig[]         // rendered in the EsForm button area
  tableBtns?: TableBtnConfig[]          // above the table, position: 'left' | 'right'
  columns: TableColumn[]                // required — table columns
  tableOptions?: Partial<TableOptions>
  pagination?: PaginationConfig
  operationColumn?: OperationColumnConfig | false   // false = no action column
  dialogs?: Record<string, CrudDialogConfig>        // keyed popups; buttons bind via dialogKey
}
\`\`\`
A \`CrudDialogConfig\` is either \`formItems\` (auto-built form) or a custom \`render\`, plus \`onConfirm\`/\`onClose\`; a row button with \`dialogKey\` opens it with the row data.

## Emits
\`query\`, \`add\`, \`edit\`, \`delete\`, \`view\`, \`export\`, \`row-click\`, \`btn-click\`, \`dialog-confirm\`, \`dialog-cancel\`, \`dialog-open\`. Payloads: \`edit/view/delete\` → \`(row)\`; \`query/export\` → \`(model)\`; \`btn-click\` → \`(key, payload?)\`; \`dialog-confirm\` → \`(dialogKey, data)\`; \`dialog-open\` → \`(dialogKey, row?)\`.

## Exposed instance methods (via ref) — same on all three renderers
- \`refresh()\` — reload the table
- \`getSelectedRows()\` — selected rows
- \`tableRef\` / \`formRef\` — the inner EsTable / EsForm instances
- \`queryModel\` — the reactive query model
- \`openDialog(key, row?)\` / \`closeDialog(key)\` — drive the keyed dialogs imperatively

## Import
\`\`\`typescript
import { EsCrudPage } from '${v.esPlusPkg}'
\`\`\`

## Key Features
- Whole page — search + table + add/edit/view dialogs — from one schema
- \`dialogs\` + \`dialogKey\` replace hand-wired per-row dialog state
- \`operationColumn\` / \`tableBtns\` drive row & toolbar actions
`;
}

function docSvgIcon(v: TargetVars): string {
  const isAntdv = v.esPlusPkg === "@es-plus/adapter-antdv";
  return `# SvgIcon API (${v.esPlusPkg})

Renders an icon from an SVG sprite (or an external URL / Ant Design icon).

## Props
\`\`\`typescript
interface SvgIconProps {
  iconClass${isAntdv ? "?" : ""}: string       // sprite symbol id — renders <use xlink:href="#icon-{iconClass}">
  className?: string       // extra class${isAntdv
      ? "\n  iconName?: string        // alternative to iconClass; resolution = iconClass || iconName\n  // NOTE: iconClass is optional here, unlike vue3/vue2 where it is required"
      : ""}
}
\`\`\`

## Usage
\`\`\`vue
<SvgIcon icon-class="user" />
<SvgIcon icon-class="https://cdn.example.com/logo.svg" />  <!-- external: masked/ <img>, no sprite -->
\`\`\`

## Behavior
- Sprite id = \`#icon-{iconClass}\` — the sprite must be registered (e.g. \`vite-plugin-svg-icons\` with \`iconDirs: [resolve(process.cwd(), 'src/assets/icons/svg')]\`).
- External URL detected by \`/^(https?:|mailto:|tel:|open)/\` → renders a masked element instead of a sprite ref.
${isAntdv
      ? "- antdv extras: accepts a pre-prefixed id (`icon-user` → `#icon-user`), an `iconName` prop, and falls back to an `@ant-design/icons-vue` component when there is no sprite match.\n"
      : ""}
## Import
\`\`\`typescript
import { SvgIcon } from '${v.esPlusPkg}'
\`\`\`
`;
}

function buildDoc(target: Target, component: ComponentName): string {
  const v = TARGETS[target];
  switch (component) {
    case "EsForm":
      return docEsForm(v);
    case "EsTable":
      return docEsTable(v);
    case "EsDialog":
      return docEsDialog(v);
    case "EsCrudPage":
      return docEsCrudPage(v);
    case "SvgIcon":
      return docSvgIcon(v);
    case "useDialog":
      return docUseDialog(v);
    default:
      return `Component "${component}" has no documentation yet for target=${target}.`;
  }
}

export function registerGetComponentApi(server: McpServer) {
  server.tool(
    "get_component_api",
    "Get the full API documentation for an es-plus component, including TypeScript interfaces, props, methods, and usage examples. Specify target='vue2' for @es-plus/vue2 + Element UI variants, target='antdv' for @es-plus/adapter-antdv + Ant Design Vue; default is target='vue3'.",
    {
      component: z
        .enum(COMPONENT_LIST)
        .describe("Component name: EsForm, EsTable, EsDialog, EsCrudPage, SvgIcon, or useDialog (detailed docs for all six; the EsTable doc also covers the vxe engine)"),
      target: z
        .enum(["vue3", "vue2", "antdv"])
        .default("vue3")
        .describe(
          "Target framework: 'vue3' (default, @es-plus/vue3 + Element Plus), 'vue2' (@es-plus/vue2 + Element UI), or 'antdv' (@es-plus/adapter-antdv + Ant Design Vue, Vue 3 syntax). Match the user's project."
        ),
    },
    async ({ component, target }) => {
      const tgt = (target || "vue3") as Target;
      const doc = buildDoc(tgt, component);
      return {
        content: [{ type: "text", text: doc }],
      };
    }
  );
}
