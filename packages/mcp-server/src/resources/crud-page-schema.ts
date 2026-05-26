import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCrudPageTypes(): string {
  const typesPath = join(
    __dirname,
    "../../../../es-plus/src/components/es-crud-page/src/types.ts"
  );
  try {
    return readFileSync(typesPath, "utf-8");
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

export interface TableBtnConfig extends CrudBtnConfig {
  /** 1=left (default), 2=right */
  code?: 1 | 2
}

export interface OperationColumnConfig {
  label?: string
  width?: number | string
  fixed?: boolean | string
  btns: RowBtnConfig[]
}

export interface RowBtnConfig {
  name: string
  key?: string
  type?: string
  dialogKey?: string
  confirm?: string | boolean
  permissionValue?: string
}

export interface CrudDialogConfig {
  title?: string | ((row?: Record<string, unknown>) => string)
  width?: string | number
  formItems?: FormItemOption[]
  formLayout?: { span?: number; labelWidth?: string | number; minFoldRows?: number }
  render?: (h: any, context: DialogRenderContext) => any
  configBtn?: DialogBtnConfig[]
  isDraggable?: boolean
  maxHeight?: string | number
  fullscreen?: boolean
  isHiddenFooter?: boolean
  onConfirm?: (data: Record<string, unknown>, context: DialogActionContext) => void | Promise<void>
}

export type CrudAction = 'add' | 'edit' | 'delete' | 'view' | 'export' | 'import'

export interface CrudPageProps {
  schema: CrudPageSchema
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  autoLoad?: boolean
}

export interface CrudPageEmits {
  (e: 'query', model: Record<string, unknown>): void
  (e: 'add'): void
  (e: 'edit', row: Record<string, unknown>): void
  (e: 'delete', row: Record<string, unknown>): void
  (e: 'view', row: Record<string, unknown>): void
  (e: 'export', model: Record<string, unknown>): void
  (e: 'btn-click', key: string, payload?: Record<string, unknown>): void
  (e: 'dialog-confirm', dialogKey: string, data: Record<string, unknown>): void
  (e: 'dialog-cancel', dialogKey: string): void
  (e: 'dialog-open', dialogKey: string, row?: Record<string, unknown>): void
}

export interface CrudPageExpose {
  refresh: () => void
  getSelectedRows: () => Record<string, unknown>[]
  tableRef: any
  formRef: any
  queryModel: Record<string, unknown>
  openDialog: (key: string, row?: Record<string, unknown>) => void
  closeDialog: (key: string) => void
}`;

function buildContent(): string {
  const types = loadCrudPageTypes();

  return `# EsCrudPage Component — Schema-Driven CRUD

## Type Definitions

\`\`\`typescript
${types}
\`\`\`

## Usage

EsCrudPage accepts a \`CrudPageSchema\` object and renders a complete CRUD page at runtime.
It auto-generates query/reset buttons, operation column with edit/delete buttons, and dialog forms.

### Basic Example (Multi-Dialog Mode with JSX)

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
import { EsCrudPage, EsForm } from 'es-plus-ui'
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

## Key Points

1. **No need to define query/reset buttons** — EsCrudPage adds them automatically
2. **\`tableBtns\`** — buttons rendered in EsTable toolbar (code:1=left, code:2=right)
3. **\`toolbarBtns\`** — buttons rendered alongside query/reset in EsForm button area
4. **\`formLayout.minFoldRows\`** — enables form collapse when rows exceed this number
5. **\`dialogs\` + \`dialogKey\`** — multi-dialog architecture with button-dialog binding
6. **Dialog \`render\`** — use JSX to render custom content (nested EsCrudPage, etc.)
7. **Events**: \`@dialog-confirm\`, \`@btn-click\` for all button/dialog interactions
8. **Expose**: \`crudRef.value?.refresh()\`, \`openDialog(key, row)\`, \`closeDialog(key)\`
`;
}

export function registerCrudPageSchemaResource(server: McpServer) {
  server.resource(
    "crud-page-schema",
    "esplus://crud-page-schema",
    {
      description:
        "EsCrudPage component API: CrudPageSchema interface, props, events, and usage examples",
      mimeType: "text/plain",
    },
    async () => {
      return {
        contents: [
          {
            uri: "esplus://crud-page-schema",
            mimeType: "text/plain",
            text: buildContent(),
          },
        ],
      };
    }
  );
}
