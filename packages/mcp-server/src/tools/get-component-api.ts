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

type Target = "vue3" | "vue2";

interface TargetVars {
  esPlusPkg: string;
  elementPkg: string;
  elementCss: string;
  scriptSetup: string;
  vModelSync: (prop: string) => string;
  jsxNote: string;
}

const TARGETS: Record<Target, TargetVars> = {
  vue3: {
    esPlusPkg: "@es-plus/vue3",
    elementPkg: "element-plus",
    elementCss: "element-plus/dist/index.css",
    scriptSetup: "<script setup>",
    vModelSync: (prop) => `v-model:${prop}`,
    jsxNote: "Use `<script setup lang=\"tsx\">` for JSX.",
  },
  vue2: {
    esPlusPkg: "@es-plus/vue2",
    elementPkg: "element-ui",
    elementCss: "element-ui/lib/theme-chalk/index.css",
    scriptSetup: "<script>\nimport { defineComponent } from 'vue'\nexport default defineComponent({\n  setup() { /* ... */ }\n})",
    vModelSync: (prop) => `:${prop}.sync`,
    jsxNote: "Vue 2.7's `<script setup>` works but JSX requires the @vue/babel-preset-jsx plugin. defineComponent + setup() is the safer fallback.",
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
  formtype?: FormType       // Input/Select/datePicker/Switch/Rate/Upload/...
  span?: number             // Grid span (1-24, default 6)
  attrs?: Record<string, unknown>  // Pass-through to ${v.elementPkg} component
  dataOptions?: Array<{ label: string; value: unknown }>  // Options for Select/Radio/Checkbox
  isHidden?: (model, item, formProps) => boolean  // Dynamic visibility
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
| dataSource (${v.vModelSync("data-source")}) | \`any[]\` | Table data array |
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
  heightType?: 'auto' | 'height'  // Height mode
  tabHeight?: number | string // Container height value (used with heightType)

  // Virtual scrolling (el-table-v2, suitable for 10k+ rows)
  // Vue 3 only — Vue 2 + Element UI fallback to standard ElTable scrolling.
  virtual?: boolean
  engine?: 'default' | 'virtual'
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
  rowClassName?: string | ((params: { row, rowIndex }) => string)
}
\`\`\`

## Instance Methods (via ref)
- \`httpRequestInstance(model?)\` — Trigger data fetch
- \`clearSelection()\` — Clear row selection
- \`getSelectionRows()\` — Get selected rows
- \`toggleRowSelection(row, selected?)\` — Toggle row checkbox
- \`scrollToRow(index)\` — Scroll to row by index (virtual mode, vue3 only)
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
    ? "- Virtual scrolling: same API, just add `virtual: true` for 10k+ row performance"
    : "- For 10k+ rows on Vue 2, use server-side pagination — el-table-v2 virtual scrolling is Vue 3 only"}
`;
}

function docUseDialog(v: TargetVars): string {
  const v3Hint = v.esPlusPkg === "@es-plus/vue3";
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
  render?: (h, instance, components) => VNode   // Dialog body content
  renderHeader?: (h, instance) => VNode         // Custom header
  renderFooter?: (h, instance) => VNode         // Custom footer
  configBtn?: BtnConfig[]     // Footer buttons (auto-generated if not using renderFooter)
  onClosed?: () => void
  isDraggable?: boolean       // Draggable dialog
  hiddenFullBtn?: boolean     // Hide fullscreen toggle
  isHiddenFooter?: boolean    // Hide footer entirely
  maxHeight?: string | number
  fullscreen?: boolean
}
\`\`\`

> Note: \`onSubmit\` is exposed by the type but the runtime never wires it up
> from any footer button — drive submit via a \`configBtn\` item with its own
> \`click\` handler (see example above).

## Dialog Instance (available in render/configBtn callbacks)
- \`close()\` — Close dialog
- \`registerRef(name, ref)\` — Register a component ref
- \`getRefs(name)\` — Get registered ref by name
- \`setLoading(bool)\` — Toggle button loading state

## Key Features
- Imperative API: call function instead of managing v-model
- ${v3Hint ? "JSX render for dialog body" : "Render function (h, ctx) for dialog body — JSX optional"}
- Ref registration for form validation in confirm handler
- Auto fullscreen button
- Draggable support
`;
}

function buildDoc(target: Target, component: ComponentName): string {
  const v = TARGETS[target];
  switch (component) {
    case "EsForm":
      return docEsForm(v);
    case "EsTable":
      return docEsTable(v);
    case "useDialog":
      return docUseDialog(v);
    default:
      return `Component "${component}" has no documentation yet for target=${target}.`;
  }
}

export function registerGetComponentApi(server: McpServer) {
  server.tool(
    "get_component_api",
    "Get the full API documentation for an es-plus component, including TypeScript interfaces, props, methods, and usage examples. Specify target='vue2' for @es-plus/vue2 + Element UI variants; default is target='vue3'.",
    {
      component: z
        .enum(COMPONENT_LIST)
        .describe("Component name: EsForm, EsTable, or useDialog"),
      target: z
        .enum(["vue3", "vue2"])
        .default("vue3")
        .describe(
          "Target framework: 'vue3' (default, @es-plus/vue3 + Element Plus) or 'vue2' (@es-plus/vue2 + Element UI). Match the user's project — Vue 3 codebase → vue3, Vue 2 codebase → vue2."
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
