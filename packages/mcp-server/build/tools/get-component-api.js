import { z } from "zod";
import { COMPONENT_LIST } from "../core/constants.js";
const COMPONENT_DOCS = {
    EsForm: `# EsForm API

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
  attrs?: Record<string, unknown>  // Pass-through to Element Plus component
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
  icon?: string             // Element Plus icon name
  triggerEvent?: boolean    // If true, triggers table refresh via provide/inject
  click?: (model, formRef, httpRequestInstance?) => void
}
\`\`\`

## Instance Methods (via ref)
- \`validate()\` — Trigger form validation
- \`resetFields()\` — Reset to initial values
- \`clearValidate()\` — Clear validation messages

## Key Features
- Config-driven: define form entirely via JSON
- Auto grid layout with \`span\` property
- Fold/expand for query forms
- Built-in provide/inject linking with EsTable (\`triggerEvent: true\`)
`,
    EsTable: `# EsTable API

## Props
| Prop | Type | Description |
|------|------|-------------|
| columns | \`TableColumn[]\` | Column definitions |
| options | \`TableOptions\` | Table behavior configuration |
| dataSource (v-model) | \`any[]\` | Table data array |
| pagination (v-model) | \`PaginationConfig\` | Pagination state |

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
}
\`\`\`

## Instance Methods (via ref)
- \`httpRequestInstance(model?)\` — Trigger data fetch
- \`clearSelection()\` — Clear row selection
- \`toggleRowSelection(row, selected?)\` — Toggle row checkbox
- \`refresh()\` — Reload current page

## Key Features
- Built-in pagination with auto-refresh
- httpRequest with configTableOut for response mapping
- Grouped columns via \`groups\` property
- Operation column via \`btns\` array
- Auto-linked with EsForm via provide/inject
`,
    useDialog: `# useDialog API

## Usage
\`\`\`typescript
import { useDialog } from 'es-plus-ui'

const dialog = useDialog()

dialog({
  title: '新增用户',
  width: '500px',
  render: (h, { registerRef }) => (
    <EsForm ref={el => registerRef('form', el)} model={formData} formItemList={items} />
  ),
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

## DialogOptions Interface
\`\`\`typescript
interface DialogOptions {
  title?: string
  width?: string | number
  render?: (h, instance, components) => VNode   // Dialog body content
  renderHeader?: (h, instance) => VNode         // Custom header
  renderFooter?: (h, instance) => VNode         // Custom footer
  configBtn?: BtnConfig[]     // Footer buttons (auto-generated if not using renderFooter)
  onSubmit?: (close) => void
  onClosed?: () => void
  isDraggable?: boolean       // Draggable dialog
  hiddenFullBtn?: boolean     // Hide fullscreen toggle
  isHiddenFooter?: boolean    // Hide footer entirely
  maxHeight?: string | number
  fullscreen?: boolean
}
\`\`\`

## Dialog Instance (available in render/configBtn callbacks)
- \`close()\` — Close dialog
- \`registerRef(name, ref)\` — Register a component ref
- \`getRefs(name)\` — Get registered ref by name
- \`setLoading(bool)\` — Toggle button loading state

## Key Features
- Imperative API: call function instead of managing v-model
- JSX render for dialog body
- Ref registration for form validation in confirm handler
- Auto fullscreen button
- Draggable support
`,
};
export function registerGetComponentApi(server) {
    server.tool("get_component_api", "Get the full API documentation for an es-plus-ui component, including TypeScript interfaces, props, methods, and usage examples.", {
        component: z
            .enum(COMPONENT_LIST)
            .describe("Component name: EsForm, EsTable, or useDialog"),
    }, async ({ component }) => {
        const doc = COMPONENT_DOCS[component];
        if (!doc) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Component "${component}" not found. Available: ${COMPONENT_LIST.join(", ")}`,
                    },
                ],
                isError: true,
            };
        }
        return {
            content: [{ type: "text", text: doc }],
        };
    });
}
//# sourceMappingURL=get-component-api.js.map