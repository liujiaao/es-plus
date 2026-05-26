import { z } from 'zod'
import { VALID_FORM_TYPES, VALID_CRUD_ACTIONS } from './contract.js'

const FieldRuleSchema = z.object({
  required: z.boolean().optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  type: z.enum(['string', 'number', 'email', 'url', 'integer']).optional(),
  message: z.string(),
  trigger: z.enum(['blur', 'change']).optional(),
})

const DataOptionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    disabled: z.boolean().optional(),
    children: z.array(DataOptionSchema).optional(),
  })
)

const formTypeEnum = VALID_FORM_TYPES as unknown as readonly [string, ...string[]]
const crudActionEnum = VALID_CRUD_ACTIONS as unknown as readonly [string, ...string[]]

const FieldConfigSchema = z.object({
  prop: z.string().min(1),
  label: z.string().min(1),
  formtype: z.enum(formTypeEnum),
  inQuery: z.boolean().default(true),
  inTable: z.boolean().default(true),
  inForm: z.boolean().default(true),
  querySpan: z.number().int().min(1).max(24).optional(),
  formSpan: z.number().int().min(1).max(24).optional(),
  required: z.boolean().optional(),
  rules: z.array(FieldRuleSchema).optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  dataOptions: z.array(DataOptionSchema).optional(),
  apiParams: z.object({
    url: z.string(),
    method: z.enum(['GET', 'POST']).optional(),
    labelField: z.string().optional(),
    valueField: z.string().optional(),
  }).optional(),
  width: z.union([z.number(), z.string()]).optional(),
  minWidth: z.union([z.number(), z.string()]).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fixed: z.union([z.boolean(), z.literal('left'), z.literal('right')]).optional(),
  ellipsis: z.boolean().optional(),
  formatter: z.string().optional(),
  render: z.string().optional(),
  permissionValue: z.string().optional(),
})

const ToolbarBtnSchema = z.object({
  name: z.string().min(1),
  key: z.string().optional(),
  type: z.string().optional(),
  icon: z.string().optional(),
  dialogKey: z.string().optional(),
  actionType: z.string().optional(),
  confirm: z.union([z.string(), z.boolean()]).optional(),
  permissionValue: z.string().optional(),
})

const RowBtnSchema = z.object({
  name: z.string().min(1),
  key: z.string().optional(),
  type: z.string().optional(),
  icon: z.string().optional(),
  dialogKey: z.string().optional(),
  confirm: z.union([z.string(), z.boolean()]).optional(),
  permissionValue: z.string().optional(),
})

const OperationColumnSchema = z.union([
  z.literal(false),
  z.object({
    label: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
    fixed: z.union([z.boolean(), z.literal('left'), z.literal('right')]).optional(),
    btns: z.array(RowBtnSchema).min(1),
  })
])

const DialogConfigSchema = z.object({
  title: z.string().optional(),
  width: z.union([z.string(), z.number()]).optional(),
  formItems: z.array(FieldConfigSchema).optional(),
  formLayout: z.object({
    span: z.number().optional(),
    labelWidth: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  hasCustomRender: z.boolean().optional(),
  isDraggable: z.boolean().optional(),
  maxHeight: z.union([z.string(), z.number()]).optional(),
  fullscreen: z.boolean().optional(),
  isHiddenFooter: z.boolean().optional(),
})

export const StructuredCrudConfigSchema = z.object({
  name: z.string().min(1).describe('Page/component name in PascalCase, e.g. "UserManage"'),
  apiUrl: z.string().min(1).describe('API base URL, e.g. "/api/users"'),
  fields: z.array(FieldConfigSchema).min(1).describe('Field definitions'),
  actions: z.array(z.enum(crudActionEnum)).min(1).describe('Enabled CRUD actions'),
  tableOptions: z.object({
    border: z.boolean().default(true),
    stripe: z.boolean().default(true),
    rowkey: z.string().default('id'),
    heightType: z.enum(['height', 'auto', 'maxHeight']).optional(),
    multiSelect: z.boolean().optional(),
    highlightCurrentRow: z.boolean().default(true),
    headerCellStyle: z.record(z.string(), z.string()).optional(),
  }).optional(),
  pagination: z.object({
    pageSize: z.number().int().default(10),
    pageSizes: z.array(z.number().int()).optional(),
  }).optional(),
  mode: z.enum(['schema', 'sfc']).default('schema').describe('Output mode'),
  typescript: z.boolean().default(true).describe('Generate TypeScript'),
  permissions: z.record(z.string(), z.string()).optional().describe('Permission codes for action buttons'),
  i18n: z.boolean().default(false).describe('Use labelKey for i18n'),
  toolbarBtns: z.array(ToolbarBtnSchema).optional().describe('Explicit toolbar buttons with dialog binding'),
  operationColumn: OperationColumnSchema.optional().describe('Operation column config (false = hidden)'),
  dialogs: z.record(z.string(), DialogConfigSchema).optional().describe('Multi-dialog configs keyed by dialog ID'),
})

export type StructuredCrudConfig = z.infer<typeof StructuredCrudConfigSchema>
export type FieldConfig = z.infer<typeof FieldConfigSchema>
export type FieldRule = z.infer<typeof FieldRuleSchema>
