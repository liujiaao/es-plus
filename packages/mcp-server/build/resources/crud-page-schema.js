import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadCrudPageTypes() {
    const typesPath = join(__dirname, "../../../../es-plus/src/components/es-crud-page/src/types.ts");
    try {
        return readFileSync(typesPath, "utf-8");
    }
    catch {
        return CRUD_PAGE_TYPES_FALLBACK;
    }
}
const CRUD_PAGE_TYPES_FALLBACK = `export interface CrudPageSchema {
  formItems?: FormItemOption[]
  queryBtns?: BtnConfig[]
  columns: TableColumn[]
  tableOptions?: Partial<TableOptions>
  dialogFormItems?: FormItemOption[]
  dialogOptions?: Partial<DialogOptions>
  actions?: CrudAction[]
  pagination?: PaginationConfig
  formLayout?: { span?: number; labelWidth?: string | number }
}

export type CrudAction = 'add' | 'edit' | 'delete' | 'view' | 'export'

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
  (e: 'row-click', row: Record<string, unknown>): void
  (e: 'btn-click', key: string, row?: Record<string, unknown>): void
}

export interface CrudPageExpose {
  refresh: () => void
  getSelectedRows: () => Record<string, unknown>[]
  tableRef: any
  formRef: any
  queryModel: Record<string, unknown>
}`;
function buildContent() {
    const types = loadCrudPageTypes();
    return `# EsCrudPage Component — Schema-Driven CRUD

## Type Definitions

\`\`\`typescript
${types}
\`\`\`

## Usage

EsCrudPage accepts a \`CrudPageSchema\` object and renders a complete CRUD page at runtime.
It auto-generates query/reset buttons, operation column with edit/delete buttons, and dialog forms.

### Basic Example

\`\`\`vue
<template>
  <es-crud-page
    ref="crudRef"
    :schema="pageSchema"
    :http-request="fetchData"
    @delete="handleDelete"
    @btn-click="handleBtnClick"
  />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const crudRef = ref(null)

const pageSchema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { clearable: true } },
    { prop: 'status', label: '状态', formtype: 'Select', span: 6, attrs: { clearable: true },
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ],
  columns: [
    { prop: 'name', label: '姓名' },
    { prop: 'status', label: '状态' },
    { prop: 'email', label: '邮箱' }
  ],
  tableOptions: {
    border: true,
    stripe: true,
    highlightCurrentRow: true,
    headerCellStyle: { background: '#f5f7fa' },
    apiParams: { url: '/api/users' },
    rowkey: 'id'
  },
  dialogFormItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 24,
      formItemOptions: { rules: [{ required: true, message: '请输入姓名', trigger: 'blur' }] } },
    { prop: 'email', label: '邮箱', formtype: 'Input', span: 24,
      formItemOptions: { rules: [{ required: true, message: '请输入邮箱', trigger: 'blur' }] } }
  ],
  actions: ['add', 'edit', 'delete'],
  pagination: { pageSize: 10 }
}

async function fetchData(params) {
  const { data } = await axios.get('/api/users', { params: params.formParams })
  return data
}

function handleDelete(row) {
  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })
    .then(async () => {
      await axios.delete(\`/api/users/\${row.id}\`)
      ElMessage.success('删除成功')
      crudRef.value?.refresh()
    })
    .catch(() => {})
}

function handleBtnClick(key, data) {
  if (key === 'add-confirm') {
    // Call add API with data
    crudRef.value?.refresh()
  }
  if (key === 'edit-confirm') {
    // Call edit API with data
    crudRef.value?.refresh()
  }
}
</script>
\`\`\`

## Key Points

1. **No need to define query/reset buttons** — EsCrudPage adds them automatically
2. **No need to define operation column** — EsCrudPage adds edit/delete buttons based on \`actions\`
3. **Schema is pure JSON** — no render functions, functions go in the wrapper SFC
4. **Use \`apiParams: { url }\`** in tableOptions when global httpRequest is configured
5. **Events**: \`@delete\` for row deletion, \`@btn-click\` for dialog confirm (key: "add-confirm" | "edit-confirm")
6. **Expose**: \`crudRef.value?.refresh()\` to reload table data after mutations
`;
}
export function registerCrudPageSchemaResource(server) {
    server.resource("crud-page-schema", "esplus://crud-page-schema", {
        description: "EsCrudPage component API: CrudPageSchema interface, props, events, and usage examples",
        mimeType: "text/plain",
    }, async () => {
        return {
            contents: [
                {
                    uri: "esplus://crud-page-schema",
                    mimeType: "text/plain",
                    text: buildContent(),
                },
            ],
        };
    });
}
//# sourceMappingURL=crud-page-schema.js.map