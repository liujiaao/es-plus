import { VALID_FORM_TYPES, SPECIAL_BTN_KEYS, BUILT_IN_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, VALID_CRUD_ACTIONS, DEFAULT_CONFIG_TABLE_OUT, CRUD_PAGE_BTN_CLICK_KEYS, } from "@es-plus/shared";
function buildConventionsContent() {
    return `# es-plus-ui Code Generation Conventions

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

## Global Config Pattern
When using app.use(ESPlus), configure globally:
\`\`\`typescript
app.use(ESPlus, {
  EsTable: {
    methods: {
      $httpRequest: (params) => axios(params),
      configQueryFieldOutput: ${JSON.stringify(DEFAULT_CONFIG_TABLE_OUT)}
    }
  }
})
\`\`\`
With global config, use \`apiParams: { url: '/api/xxx' }\` instead of inline httpRequest.

## EsCrudPage btn-click Event Keys
- Add confirm: "${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}"
- Edit confirm: "${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}"

## Import Requirements
- When using status render with ElTag: import { ElTag } from 'element-plus'
- When using delete confirmation: import { ElMessageBox, ElMessage } from 'element-plus'
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

## StructuredCrudConfig Schema

\`\`\`typescript
interface StructuredCrudConfig {
  name: string         // PascalCase component name, e.g. "UserManage"
  apiUrl: string       // Real API endpoint, e.g. "/api/users"
  fields: FieldConfig[]
  actions: ('add' | 'edit' | 'delete' | 'view' | 'export' | 'import')[]
  tableOptions?: {
    border?: boolean            // default: true
    stripe?: boolean            // default: true
    rowkey?: string             // default: 'id'
    heightType?: 'height' | 'auto' | 'maxHeight'
    multiSelect?: boolean
    highlightCurrentRow?: boolean  // default: true
    headerCellStyle?: Record<string, string>
  }
  pagination?: { pageSize?: number }  // default: 10
  mode?: 'schema' | 'sfc'            // default: 'schema'
  typescript?: boolean                // default: true
  permissions?: Record<string, string> // e.g. { add: 'user:add', edit: 'user:edit' }
  i18n?: boolean                      // default: false
}

interface FieldConfig {
  prop: string          // Backend field name
  label: string         // Display label (Chinese/English)
  formtype: FormType    // One of 13 types

  // Placement
  inQuery?: boolean     // Show in query form (default: true)
  inTable?: boolean     // Show in table (default: true)
  inForm?: boolean      // Show in dialog form (default: true)

  // Layout
  querySpan?: number    // Query form grid span (default: 6, datePicker: 8)
  formSpan?: number     // Dialog form grid span (default: 24)

  // Validation
  required?: boolean    // Shorthand for required rule
  rules?: FieldRule[]   // Custom rules: { pattern?, min?, max?, type?, message, trigger? }

  // Component attrs (passthrough to Element Plus)
  attrs?: Record<string, any>

  // Options (Select/Radio/Checkbox/Cascader)
  dataOptions?: { label: string, value: string | number | boolean, children?: ... }[]
  apiParams?: { url: string, method?: 'GET'|'POST', labelField?: string, valueField?: string }

  // Table column display
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  ellipsis?: boolean
  formatter?: string    // "(row) => row.amount.toFixed(2)"
  render?: string       // "(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.status === 1 ? '启用' : '禁用')"

  // Permission
  permissionValue?: string
}
\`\`\`

## Complete Example

\`\`\`json
{
  "name": "UserManage",
  "apiUrl": "/api/system/users",
  "fields": [
    { "prop": "username", "label": "用户名", "formtype": "Input", "required": true, "rules": [{ "min": 2, "max": 20, "message": "用户名长度 2-20 个字符" }] },
    { "prop": "phone", "label": "手机号", "formtype": "Input", "required": true, "rules": [{ "pattern": "^1[3-9]\\\\d{9}$", "message": "手机号格式不正确" }] },
    { "prop": "email", "label": "邮箱", "formtype": "Input", "inQuery": false, "rules": [{ "type": "email", "message": "邮箱格式不正确" }] },
    { "prop": "status", "label": "状态", "formtype": "Select", "dataOptions": [{ "label": "启用", "value": 1 }, { "label": "禁用", "value": 0 }], "render": "(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.status === 1 ? '启用' : '禁用')" },
    { "prop": "deptId", "label": "部门", "formtype": "Select", "apiParams": { "url": "/api/system/depts/options" }, "inTable": false },
    { "prop": "createTime", "label": "创建时间", "formtype": "datePicker", "attrs": { "type": "daterange", "valueFormat": "YYYY-MM-DD" }, "inForm": false, "querySpan": 8 }
  ],
  "actions": ["add", "edit", "delete"],
  "tableOptions": { "rowkey": "userId" },
  "permissions": { "add": "system:user:add", "edit": "system:user:edit", "delete": "system:user:delete" },
  "typescript": true
}
\`\`\`

## httpRequest Integration (Production Pattern)

\`\`\`typescript
// main.ts — configure once for the entire application
import axios from 'axios'
import ESPlus from 'es-plus-ui'

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
})
\`\`\`

With global config in place, pages only need \`apiParams: { url: '/api/xxx' }\` — no inline httpRequest.

## TypeScript Mode

When \`typescript: true\` (default), generated code includes:
- \`<script setup lang="ts">\`
- Interface definitions for form models
- Proper type annotations on reactive() and ref()
- Type parameters for component refs

## Permission Pattern

When \`permissions\` is provided, buttons receive \`permissionValue\`:
\`\`\`typescript
{ name: '新增', type: 'primary', key: 'add', permissionValue: 'system:user:add' }
{ name: '编辑', type: 'primary', clickEvent: ..., permissionValue: 'system:user:edit' }
\`\`\`
The runtime checks against the user's permission list and hides unauthorized buttons.

## i18n Mode

When \`i18n: true\`, fields use \`labelKey\` instead of hardcoded labels:
\`\`\`typescript
{ prop: 'username', labelKey: 'field.username', formtype: 'Input' }
\`\`\`
The host app must provide a translation function via global config or \`useI18n()\`.

## Multi-Dialog Mode (New)

EsCrudPage v2 supports multiple independent dialogs with button-dialog binding:

### tableBtns — Table Toolbar Buttons (Recommended)
\`\`\`json
"tableBtns": [
  { "name": "下载", "icon": "Download", "code": 1, "dialogKey": "download" },
  { "name": "新增", "type": "primary", "icon": "Plus", "code": 1, "dialogKey": "add" },
  { "name": "Excel导入", "icon": "Upload", "code": 2, "actionType": "import" }
]
\`\`\`
- \`code: 1\` = left side of table toolbar (default)
- \`code: 2\` = right side of table toolbar
- \`dialogKey\`: clicking the button opens the dialog with this key
- \`actionType\`: emits btn-click event with this key (no dialog)
- \`confirm\`: shows ElMessageBox before action

### toolbarBtns — Form Area Buttons (Legacy Positioning)
\`\`\`json
"toolbarBtns": [
  { "name": "新增", "type": "primary", "icon": "Plus", "dialogKey": "add" },
  { "name": "导入", "icon": "Upload", "dialogKey": "import" },
  { "name": "导出", "icon": "Download", "actionType": "export" }
]
\`\`\`
- Rendered alongside query/reset buttons in EsForm's button area
- Use \`tableBtns\` instead for better UX (buttons above table, separated from query controls)

### formLayout — Query Form Layout & Collapse
\`\`\`json
"formLayout": { "labelWidth": "100px", "minFoldRows": 2 }
\`\`\`
- \`minFoldRows\`: when form rows exceed this number, shows expand/collapse toggle
- \`labelWidth\`: label width for all form items

### operationColumn — Explicit Row Action Buttons
\`\`\`json
"operationColumn": {
  "label": "操作",
  "width": 240,
  "fixed": "right",
  "btns": [
    { "name": "编辑", "type": "primary", "dialogKey": "edit" },
    { "name": "审批", "type": "warning", "dialogKey": "approve" },
    { "name": "删除", "type": "danger", "key": "delete", "confirm": "确定删除该条数据吗？" }
  ]
}
\`\`\`
Set \`"operationColumn": false\` to hide the operation column entirely.

### dialogs — Multi-Dialog Configs
\`\`\`json
"dialogs": {
  "add": { "title": "新增用户", "width": "600px", "formItems": [...] },
  "edit": { "title": "编辑用户", "width": "600px", "formItems": [...] },
  "import": { "title": "批量导入", "width": "500px", "hasCustomRender": true }
}
\`\`\`
- Each key is a dialog identifier bound by \`dialogKey\` on buttons
- \`formItems\`: renders EsForm inside dialog (simple mode)
- \`hasCustomRender\`: flag for code gen — dev must implement render function manually
- \`onConfirm\`: callback when confirm button is clicked (wrapper SFC handles)
- \`isHiddenFooter\`: hides dialog footer (for view-only dialogs)

### New Events
- \`@dialog-confirm="(dialogKey, data) => {}"\` — emitted after dialog form confirmed
- \`@dialog-cancel="(dialogKey) => {}"\` — emitted when dialog cancelled
- \`@dialog-open="(dialogKey, row?) => {}"\` — emitted when dialog opens
- \`@btn-click="(key, payload?) => {}"\` — for non-dialog button actions (export, custom)

### configureEsPlus() — Module-Level Config (Auto-Import Mode)
\`\`\`typescript
// main.ts — works without app.use(EsPlus)
import { configureEsPlus } from 'es-plus-ui'

configureEsPlus({
  EsTable: { methods: { $httpRequest: (p) => axios(p).then(r => r.data) } },
  EsForm: { $httpRequest: (p) => axios(p).then(r => r.data) },
  permission: (code) => userStore.permissions.includes(code)
})
\`\`\`
This ensures global config is available even in auto-import mode (unplugin-vue-components).

### Migration from Legacy Mode
Old: \`{ "actions": ["add","edit","delete"], "dialogFormItems": [...] }\`
New: \`{ "toolbarBtns": [...], "operationColumn": {...}, "dialogs": {...} }\`
Both modes are supported — legacy config auto-converts at runtime.

## Common Gotchas (Full List)

1. Reset button key is "rest" NOT "reset" — this is intentional in es-plus-ui
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
`;
}
export function registerConventionsResource(server) {
    server.resource("conventions", "esplus://conventions", {
        description: "Code generation conventions and rules for es-plus-ui (button keys, formtypes, import requirements)",
        mimeType: "text/plain",
    }, async () => {
        return {
            contents: [
                {
                    uri: "esplus://conventions",
                    mimeType: "text/plain",
                    text: buildConventionsContent(),
                },
            ],
        };
    });
}
//# sourceMappingURL=conventions.js.map