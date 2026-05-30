import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Target = "vue3" | "vue2";

// vue3 and vue2 put the EsCrudPage types in slightly different paths:
//   packages/vue3/src/components/es-crud-page/src/types.ts
//   packages/vue2/src/components/es-crud-page/types.ts
function loadCrudPageTypes(target: Target): string {
  const path = target === "vue2"
    ? join(__dirname, "../../../../vue2/src/components/es-crud-page/types.ts")
    : join(__dirname, "../../../../vue3/src/components/es-crud-page/src/types.ts");
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return CRUD_PAGE_TYPES_FALLBACK;
  }
}

const CRUD_PAGE_TYPES_FALLBACK = `export interface CrudPageSchema {
  formItems?: FormItemOption[]
  formLayout?: { span?: number; labelWidth?: string | number; minFoldRows?: number }
  toolbarBtns?: CrudBtnConfig[]
  tableBtns?: TableBtnConfig[]
  columns: TableColumn[]
  tableOptions?: Partial<TableOptions>
  pagination?: PaginationConfig
  operationColumn?: OperationColumnConfig | false
  dialogs?: Record<string, CrudDialogConfig>
  /** @deprecated */ queryBtns?: BtnConfig[]
  /** @deprecated */ actions?: CrudAction[]
  /** @deprecated */ dialogFormItems?: FormItemOption[]
  /** @deprecated */ dialogOptions?: Partial<DialogOptions>
}

export interface CrudBtnConfig extends BtnConfig {
  dialogKey?: string
  actionType?: string
  confirm?: string | boolean
}

export interface OperationColumnConfig {
  label?: string
  width?: number | string
  fixed?: 'left' | 'right' | boolean
  btns: RowBtnConfig[]
}

export interface RowBtnConfig {
  name: string
  key?: string
  type?: string
  dialogKey?: string
  confirm?: string | boolean
  clickEvent?: (row: Record<string, unknown>) => void
  permissionValue?: string
}

export interface CrudDialogConfig {
  title?: string | ((row?: Record<string, unknown>) => string)
  width?: string | number
  formItems?: FormItemOption[]
  formLayout?: { labelWidth?: string | number }
  render?: (h: unknown, instance: unknown, components: Record<string, unknown>) => unknown
  isHiddenFooter?: boolean
  hasCustomRender?: boolean
  onConfirm?: (data: Record<string, unknown>, ctx: { row?: Record<string, unknown> }) => Promise<void> | void
  onCancel?: () => void
}

export interface EsCrudPageInstance {
  refresh: () => void
  getSelectedRows: () => Record<string, unknown>[]
  tableRef: any
  formRef: any
  queryModel: Record<string, unknown>
  openDialog: (key: string, row?: Record<string, unknown>) => void
  closeDialog: (key: string) => void
}`;

function vue3Example(): string {
  return `### Basic Example — Vue 3 (Multi-Dialog Mode with JSX)

\`\`\`vue
<template>
  <es-crud-page
    ref="crudRef"
    :schema="pageSchema"
    @dialog-confirm="handleDialogConfirm"
    @btn-click="handleBtnClick"
  />
</template>

<script setup lang="tsx">
import { ref } from 'vue'
import { EsCrudPage, EsForm } from '@es-plus/vue3'
import { ElMessage } from 'element-plus'

const crudRef = ref(null)

const pageSchema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
    { prop: 'status', label: '状态', formtype: 'Select', span: 6,
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
    { prop: 'createTime', label: '创建时间', formtype: 'datePicker', span: 8,
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } }
  ],
  formLayout: { labelWidth: '80px', minFoldRows: 1 },
  tableBtns: [
    { name: '新增', type: 'primary', icon: 'Plus', code: 1, dialogKey: 'add' },
    { name: '导出', icon: 'Download', code: 2, actionType: 'export' }
  ],
  columns: [
    { prop: 'name', label: '姓名' },
    { prop: 'status', label: '状态' },
    { prop: 'email', label: '邮箱' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/users' },
    rowkey: 'id'
  },
  operationColumn: {
    label: '操作', width: 160, fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除？' }
    ]
  },
  dialogs: {
    add: {
      title: '新增用户', width: '560px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 24,
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 }
      ]
    },
    edit: {
      title: (row) => \`编辑 — \${row?.name || ''}\`,
      width: '560px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
        { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 }
      ]
    }
  },
  pagination: { pageSize: 10 }
}

function handleDialogConfirm(dialogKey, data) {
  ElMessage.success(\`[\${dialogKey}] 保存成功\`)
  crudRef.value?.refresh()
}

function handleBtnClick(key, payload) {
  if (key === 'delete') {
    ElMessage.success('已删除')
    crudRef.value?.refresh()
  }
}
</script>
\`\`\`
`;
}

function vue2Example(): string {
  return `### Basic Example — Vue 2 (Multi-Dialog Mode, defineComponent + setup, .sync)

\`\`\`vue
<template>
  <es-crud-page
    ref="crudRef"
    :schema="pageSchema"
    @dialog-confirm="handleDialogConfirm"
    @btn-click="handleBtnClick"
  />
</template>

<script>
import { defineComponent, ref } from 'vue'
import { EsCrudPage } from '@es-plus/vue2'
import { Message } from 'element-ui'

export default defineComponent({
  components: { EsCrudPage },
  setup() {
    const crudRef = ref(null)

    const pageSchema = {
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
        { prop: 'status', label: '状态', formtype: 'Select', span: 6,
          dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
        { prop: 'createTime', label: '创建时间', formtype: 'datePicker', span: 8,
          // Element UI uses different attr names for some date pickers — verify against EUI docs
          attrs: { type: 'daterange', 'value-format': 'yyyy-MM-dd' } }
      ],
      formLayout: { labelWidth: '80px', minFoldRows: 1 },
      tableBtns: [
        // Element UI icons are class-based ('el-icon-plus'); the runtime accepts
        // either the raw class or just the bare keyword and prepends 'el-icon-'.
        { name: '新增', type: 'primary', icon: 'plus', code: 1, dialogKey: 'add' },
        { name: '导出', icon: 'download', code: 2, actionType: 'export' }
      ],
      columns: [
        { prop: 'name', label: '姓名' },
        { prop: 'status', label: '状态' },
        { prop: 'email', label: '邮箱' }
      ],
      tableOptions: {
        border: true,
        apiParams: { url: '/api/users' },
        rowkey: 'id'
      },
      operationColumn: {
        label: '操作', width: 160, fixed: 'right',
        btns: [
          { name: '编辑', type: 'primary', dialogKey: 'edit' },
          { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除？' }
        ]
      },
      dialogs: {
        add: {
          title: '新增用户', width: '560px',
          formItems: [
            { prop: 'name', label: '姓名', formtype: 'Input', span: 24,
              formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
            { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 }
          ]
        },
        edit: {
          title: (row) => \`编辑 — \${row?.name || ''}\`,
          width: '560px',
          formItems: [
            { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
            { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 }
          ]
        }
      },
      pagination: { pageSize: 10 }
    }

    function handleDialogConfirm(dialogKey, data) {
      Message.success(\`[\${dialogKey}] 保存成功\`)
      crudRef.value?.refresh()
    }

    function handleBtnClick(key, payload) {
      if (key === 'delete') {
        Message.success('已删除')
        crudRef.value?.refresh()
      }
    }

    return { crudRef, pageSchema, handleDialogConfirm, handleBtnClick }
  }
})
</script>
\`\`\`

### Vue 2 ↔ Vue 3 syntax deltas in this example
- \`<script>\` + \`defineComponent({ setup() {} })\` instead of \`<script setup>\`
- \`Message\` from \`element-ui\` (no \`ElMessage\` prefix on EUI named exports)
- Icon: bare \`'plus'\` string instead of \`'Plus'\` PascalCase
- Date \`valueFormat\` uses Moment-style tokens (\`'yyyy-MM-dd'\`) instead of Element Plus \`'YYYY-MM-DD'\` —
  verify the exact attr per Element UI's el-date-picker docs (it's actually \`value-format\` kebab-case in templates,
  camelCase in JS attrs object — both accepted via \`v-bind\`)
- The \`schema\` JSON itself is identical to vue3 — that's the whole point of @es-plus/shared
`;
}

function buildContent(target: Target): string {
  const types = loadCrudPageTypes(target);
  const pkg = target === "vue2" ? "@es-plus/vue2" : "@es-plus/vue3";

  return `# EsCrudPage Component — Schema-Driven CRUD (${pkg}, target=${target})

## Type Definitions

\`\`\`typescript
${types}
\`\`\`

## Usage

EsCrudPage accepts a \`CrudPageSchema\` object and renders a complete CRUD page at runtime.
It auto-generates query/reset buttons, operation column with edit/delete buttons, and dialog forms.

${target === "vue2" ? vue2Example() : vue3Example()}

## Key Points

1. **No need to define query/reset buttons** — EsCrudPage adds them automatically
2. **\`tableBtns\`** — buttons rendered in EsTable toolbar (code:1=left, code:2=right)
3. **\`toolbarBtns\`** — buttons rendered alongside query/reset in EsForm button area
4. **\`formLayout.minFoldRows\`** — enables form collapse when rows exceed this number
5. **\`dialogs\` + \`dialogKey\`** — multi-dialog architecture with button-dialog binding
6. **Dialog \`render\`** — ${target === "vue3" ? "use JSX to render custom content (nested EsCrudPage, etc.)" : "use h() render function or scoped slot; JSX requires @vue/babel-preset-jsx"}
7. **Events**: \`@dialog-confirm\`, \`@btn-click\` for all button/dialog interactions
8. **Expose**: \`crudRef.value?.refresh()\`, \`openDialog(key, row)\`, \`closeDialog(key)\`
${target === "vue2"
    ? "9. **Vue 2**: use `:visible.sync` if you control dialog visibility directly; the `dialogKey` pattern via EsCrudPage handles this for you so you typically don't need .sync at the call site"
    : ""}
`;
}

export function registerCrudPageSchemaResource(server: McpServer) {
  const targets: Array<{ uri: string; target: Target; descSuffix: string }> = [
    { uri: "esplus://crud-page-schema", target: "vue3", descSuffix: " (defaults to @es-plus/vue3)" },
    { uri: "esplus://crud-page-schema/vue3", target: "vue3", descSuffix: " — @es-plus/vue3 explicit" },
    { uri: "esplus://crud-page-schema/vue2", target: "vue2", descSuffix: " — @es-plus/vue2 (defineComponent + setup + Element UI)" },
  ];

  for (const { uri, target, descSuffix } of targets) {
    server.resource(
      uri === "esplus://crud-page-schema" ? "crud-page-schema" : `crud-page-schema-${target}`,
      uri,
      {
        description: `EsCrudPage component API: CrudPageSchema interface, props, events, and usage examples${descSuffix}`,
        mimeType: "text/plain",
      },
      async () => ({
        contents: [
          { uri, mimeType: "text/plain", text: buildContent(target) },
        ],
      })
    );
  }
}
