import { z } from 'zod'
import { VALID_FORM_TYPES, VALID_CRUD_ACTIONS, FORM_TYPE_ALIASES } from './contract.js'

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

/**
 * formtype 的合法取值 = **规范写法 ∪ 旧别名**。
 *
 * 别名（`datePicker` / `timePicker`）是被文档承认、且在运行时生效的写法：
 * 三端 `use-form-inputs` 都先过 `normalizeFormType`（core 单源）再查组件表，
 * `form-item.schema.json` 的 describe 也写明 "deprecated but still accepted"。
 *
 * 校验侧必须与运行时一致。只用 `VALID_FORM_TYPES`（14 项 PascalCase）会拒绝一个
 * 实际可用的写法 —— 在 `generateFromConfig` 加了入口校验（A5）之后，这直接表现为
 * 「旧写法过去能生成、现在抛错」的回归，而报错文案只说"枚举不含它"，看不出别名本该被接受。
 */
const formTypeEnum = [
  ...VALID_FORM_TYPES,
  ...Object.keys(FORM_TYPE_ALIASES),
] as unknown as readonly [string, ...string[]]
const crudActionEnum = VALID_CRUD_ACTIONS as unknown as readonly [string, ...string[]]

/**
 * `prop` 会被用作：数据模型的键（core `parsePathSegments` 按 `/\.|\[|\]/` 分段）、
 * 生成代码里的成员访问路径、以及 SFC 的插槽名的一部分。这里只拒绝**确定会坏事**的形态：
 *
 *  - 路径分隔符 `/`、`\`：与 `name` 同理（不得被当作文件/目录路径使用）；
 *  - 空段 / `.` / `..`：`parsePathSegments` 会把它们滤掉或指向父级，语义不可预期；
 *  - `__proto__` / `constructor` / `prototype`：core 的 `getNestedValue`/`setNestedValue`
 *    已经拒绝这三个键（原型污染），在入口一并挡掉，避免「校验通过、运行时静默不生效」。
 *
 * **刻意不**拒绝 kebab-case（`user-name`）等非标识符 prop：它们在 `mode=schema` 下
 * 今天确实可用（prop 只作为数据键透传，`model['user-name']` 正常）。生成侧已按需
 * 引号化/方括号化，产物可编译。收紧到「必须是标识符」会把既有可用配置判红，
 * 属于误判 —— 生成器只在 SFC 模式下对该形态发警告（见 structured-generator.ts 的
 * `warnNonIdentifierProps`）。
 */
const UNSAFE_PROP_SEGMENT = /^(?:__proto__|constructor|prototype)$/

function isSafeProp(v: string): boolean {
  if (v === '.' || v === '..' || /[\\/]/.test(v)) return false
  const segments = v.split(/\.|\[|\]/).filter((s) => s !== '')
  if (segments.length === 0) return false
  return !segments.some((s) => UNSAFE_PROP_SEGMENT.test(s))
}

const FieldConfigSchema = z.object({
  prop: z.string().min(1).refine(isSafeProp, {
    message:
      'prop 不得包含路径分隔符（/ \\）、空段/"."/".."，也不得使用 __proto__/constructor/prototype',
  }).describe('Field key in the data model (camelCase), e.g. "userName"'),
  label: z.string().min(1).describe('Human-readable column/form label, e.g. "用户名"'),
  formtype: z.enum(formTypeEnum).describe(
    "Pick by the field's MEANING, not by keyword matching: status/type/enum/gender → Select; date/time → DatePicker/TimePicker; image/avatar/attachment/file → Upload; long text/remark/description → Input (attrs.type:'textarea'); boolean on/off → Switch; single-choice small set → Radio; multi-choice → Checkbox; region/category tree → Cascader; score → Rate. Default to Input for plain text."
  ),
  inQuery: z.boolean().default(true).describe('Show as a query/filter field above the table'),
  inTable: z.boolean().default(true).describe('Show as a table column'),
  inForm: z.boolean().default(true).describe('Show in the add/edit form'),
  querySpan: z.number().int().min(1).max(24).optional(),
  formSpan: z.number().int().min(1).max(24).optional(),
  required: z.boolean().optional(),
  rules: z.array(FieldRuleSchema).optional(),
  attrs: z.record(z.string(), z.unknown()).optional().describe("Extra component props, e.g. { type: 'textarea', maxlength: 200 }"),
  dataOptions: z.array(DataOptionSchema).optional().describe('Static options for Select/Radio/Checkbox/Cascader. Use this for known fixed enums.'),
  apiParams: z.object({
    url: z.string(),
    method: z.enum(['GET', 'POST']).optional(),
    labelField: z.string().optional(),
    valueField: z.string().optional(),
  }).optional().describe('Remote options source for Select/Cascader — use instead of dataOptions when options come from an API.'),
  width: z.union([z.number(), z.string()]).optional(),
  minWidth: z.union([z.number(), z.string()]).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fixed: z.union([z.boolean(), z.literal('left'), z.literal('right')]).optional(),
  ellipsis: z.boolean().optional(),
  formatter: z.string().optional().describe(
    'Extension point: a JS arrow-function source string for read-only cell formatting, e.g. "(row) => row.amount.toFixed(2)". Use this to express display logic the schema can\'t otherwise capture.'
  ),
  render: z.string().optional().describe(
    "Extension point: a render-function source string for a fully custom cell/form control. Emit this (rather than dropping the requirement) when business logic exceeds the declarative schema."
  ),
  permissionValue: z.string().optional(),
})

const ToolbarBtnSchema = z
  .object({
    name: z.string().min(1),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    direction: z
      .enum(['left', 'right'])
      .optional()
      .describe("Form-button direction (legacy form-side positioning field; wins over 'position')"),
    position: z.enum(['left', 'right']).optional().describe('left | right (recommended positioning field)'),
    code: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .describe('1=left, 2=right (legacy alias of position; normalized automatically)'),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
    triggerEvent: z.boolean().optional(),
  })
  // 与 TableBtnSchema 同形，但**兜底方向相反**：表单工具栏按钮的文档化默认是**右侧**
  // （core 的 splitButtonsByDirection「默认（不配 direction）视为右侧」），表格按钮才是左侧。
  // 抄 TableBtnSchema 的 `b.code ?? 1` 会把每个没写 position 的表单按钮从右侧翻到左侧。
  //
  // 背景与 TableBtnSchema 相同：Zod 默认 strip 未知键，`code` 未声明时宿主 LLM 写
  // `code:1`（左侧）会被静默丢弃、按钮落到默认的右侧，解析成功且无告警。
  //
  // `direction` 同理但此前被漏掉：core 的 resolveButtonSide 早就把表单链定为
  // `direction → position → code → right`（见 field-resolver.ts 的注释），而本 schema
  // 只声明 position/code —— 写 `direction:'left'` 会被静默 strip 掉、按钮落到右侧。
  // 这里把优先级对齐 core：direction 优先，再 position，最后 code。
  //
  // 必须是**短路优先**而不是「左侧 OR / 右侧 OR」：后者在两者冲突时会把
  // `{direction:'right', position:'left'}` 判成左侧（code:1），而 core 的
  // resolveButtonSide 取的是 `direction ?? position` = 右侧 —— 归一化出的 code
  // 与运行时实际落位相反。用 ?? 串联，字段优先级与 core 逐字对齐。
  .transform((b) => {
    const side = b.direction ?? b.position
    if (side) return { ...b, code: (side === 'left' ? 1 : 2) as 1 | 2 }
    return { ...b, code: (b.code ?? 2) as 1 | 2 }
  })

const TableBtnSchema = z
  .object({
    name: z.string().min(1),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    position: z.enum(['left', 'right']).optional().describe('left | right (recommended positioning field)'),
    code: z.union([z.literal(1), z.literal(2)]).optional().describe('1=left, 2=right (legacy alias of position; normalized automatically)'),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
  })
  // position 与 code 的关系在合并层收敛，避免两处语义分叉。
  //
  // 背景（已实测）：Zod 默认 strip 未知键，因此只声明 code 时，宿主 LLM 若按
  // `esplus://crud-page-schema` 示例写 `position: 'right'`，会被**静默改写成 code:1（左侧）**——
  // 解析报成功、无任何告警，按钮跑到错误的一侧。而渲染器契约（三端 BtnConfig）恰恰把
  // position 标为推荐、把 code 标为 deprecated，core 的 getButtonPosition 也优先读 position。
  //
  // 归一化策略：position 为准，若只给 position 则同步生成一致的 code。
  // 这样既不再丢 position，又保证下游（渲染器 / golden 评分器 / 生成物 JSON）读 code 永远正确。
  .transform((b) => ({
    ...b,
    code: (b.position === 'right' ? 2 : b.position === 'left' ? 1 : (b.code ?? 1)) as 1 | 2,
  }))

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
    minFoldRows: z.number().int().optional().describe('Form collapses when rows exceed this number'),
  }).optional(),
  hasCustomRender: z.boolean().optional(),
  isDraggable: z.boolean().optional(),
  maxHeight: z.union([z.string(), z.number()]).optional(),
  fullscreen: z.boolean().optional(),
  isHiddenFooter: z.boolean().optional(),
})

export const StructuredCrudConfigSchema = z.object({
  name: z.string().min(1).refine(
    (v) => !/[\\/]/.test(v) && v !== '.' && v !== '..' && !/^[A-Za-z]:/.test(v),
    { message: 'name 会被用作文件/目录名，不得包含路径分隔符、"." 或 ".."' }
  ).describe('Page/component name in PascalCase, e.g. "UserManage"'),
  apiUrl: z.string().min(1).describe('API base URL, e.g. "/api/users"'),
  fields: z.array(FieldConfigSchema).min(1).describe('Field definitions'),
  actions: z.array(z.enum(crudActionEnum)).min(1).describe('Enabled CRUD actions'),
  tableOptions: z.object({
    border: z.boolean().default(true),
    stripe: z.boolean().default(true),
    rowkey: z.string().default('id'),
    heightType: z.enum(['height', 'auto', 'maxHeight']).optional(),
    tabHeight: z.union([z.number(), z.string()]).optional().describe('Table container height (works with heightType); number → px, string → raw CSS value'),
    height: z.union([z.number(), z.string()]).optional(),
    multiSelect: z.boolean().optional(),
    highlightCurrentRow: z.boolean().default(true),
    headerCellStyle: z.record(z.string(), z.string()).optional(),
    virtual: z
      .boolean()
      .optional()
      .describe(
        'Enable virtual scrolling for large datasets. The engine is target-specific: vue3 renders the el-table-v2 engine; antdv forwards `virtual` to <a-table> (Ant Design Vue 4 has native virtual scroll); vue2 + Element UI has no equivalent and degrades to a plain el-table with a console warning — the vue2 large-data path is `engine: \'vxe\'` instead. Safe to set on any target — only the rendering engine differs.'
      ),
    engine: z
      .enum(['default', 'virtual', 'vxe'])
      .optional()
      .describe(
        "Table rendering engine, an alternative to `virtual: true`. 'default' = el-table / a-table / el-table, 'virtual' = the target's virtual engine (vue3 el-table-v2; antdv <a-table :virtual>; vue2 has no equivalent and degrades to a plain el-table with a warning), 'vxe' = vxe-table, available on ALL THREE targets — vue3 and antdv through their own vxe adapters, and vue2 through @es-plus/vue2's vxe engine (vxe-table itself supports Vue 2). 'vxe' is therefore the large-data path for vue2, where 'virtual' is not available."
      ),
    rowHeight: z
      .number()
      .optional()
      .describe('Row height in px for virtual mode (vue3 / el-table-v2 only; default 50)'),
    estimatedRowHeight: z
      .number()
      .optional()
      .describe('Estimated row height for dynamic-height virtual scrolling (vue3 / el-table-v2 only)'),
    overscanCount: z
      .number()
      .int()
      .optional()
      .describe('Buffer rows outside the visible area (vue3 / el-table-v2 only; default 2)'),
    rowClassName: z.string().optional().describe('Custom row CSS class name'),
  }).optional(),
  pagination: z.object({
    pageSize: z.number().int().default(10),
    pageSizes: z.array(z.number().int()).optional(),
  }).optional(),
  mode: z.enum(['schema', 'sfc']).default('schema').describe('Output mode'),
  target: z.enum(['vue3', 'vue2', 'antdv']).default('vue3').describe('Target framework: "vue3" (@es-plus/vue3 + Element Plus, default), "vue2" (@es-plus/vue2 + Element UI), or "antdv" (@es-plus/adapter-antdv + Ant Design Vue)'),
  typescript: z.boolean().default(true).describe('Generate TypeScript'),
  permissions: z.record(z.string(), z.string()).optional().describe('Permission codes for action buttons'),
  i18n: z.boolean().default(false).describe('Use labelKey for i18n'),
  formLayout: z.object({
    span: z.number().optional(),
    labelWidth: z.union([z.string(), z.number()]).optional(),
    minFoldRows: z.number().int().optional().describe('Query form collapses when rows exceed this number'),
  }).optional().describe('Query form layout config'),
  toolbarBtns: z.array(ToolbarBtnSchema).optional().describe('Toolbar buttons rendered in EsForm button area (position:left|right; defaults to right)'),
  tableBtns: z.array(TableBtnSchema).optional().describe('Table toolbar buttons (position:left|right, recommended; legacy code:1=left/2=right) rendered above EsTable'),
  operationColumn: OperationColumnSchema.optional().describe('Operation column config (false = hidden)'),
  dialogs: z.record(z.string(), DialogConfigSchema).optional().describe('Multi-dialog configs keyed by dialog ID'),
})

export type StructuredCrudConfig = z.infer<typeof StructuredCrudConfigSchema>
/** Pre-parse shape (defaults still optional) — use when authoring/emitting configs before validation. */
export type StructuredCrudConfigInput = z.input<typeof StructuredCrudConfigSchema>
export type FieldConfig = z.infer<typeof FieldConfigSchema>
export type FieldRule = z.infer<typeof FieldRuleSchema>
