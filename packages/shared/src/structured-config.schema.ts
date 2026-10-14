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

/**
 * 显隐条件算子（与 core `FieldHiddenOp` 单一权威源对齐 —— core/types.ts）。
 * 这里刻意**不用裸 JS 字符串**：条件是可 JSON 化的数据，schema 模式下才能内联。
 */
const HIDDEN_OPS = ['eq', 'ne', 'in', 'nIn', 'empty', 'notEmpty', 'truthy', 'falsy'] as const

/**
 * 单条声明式显隐条件：**条件成立时隐藏该字段**。
 *
 * `field` 与 `prop` 同规（支持 `user.name` 嵌套），读的是同一 model —— 它同样会被
 * `parsePathSegments` 分段并在 model 上取值，因此与 `prop` 共用同一道 `isSafeProp` 防线。
 */
const HiddenConditionSchema = z.object({
  field: z.string().min(1).refine(isSafeProp, {
    message:
      'field 不得包含路径分隔符（/ \\）、空段/"."/".."，也不得使用 __proto__/constructor/prototype',
  }).describe('Model field path to test, e.g. "status" or "user.type"'),
  op: z.enum(HIDDEN_OPS).default('eq').describe(
    "Comparison operator. eq/ne = equal/not-equal (eq is the default; number↔string is tolerated, e.g. 1 matches '1'); in/nIn = value is/is-not in the given array; empty/notEmpty = ''/null/undefined/[] check; truthy/falsy = JS truthiness (!!v). The hidden field is hidden WHEN this expression holds."
  ),
  value: z.unknown().optional().describe(
    'Right-hand side of the comparison. REQUIRED for eq/ne (scalar) and in/nIn (array). IGNORED by empty/notEmpty/truthy/falsy.'
  ),
})

/**
 * 表达式算子（闭集）—— 与 core `expr.ts` 的 `EXPR_OPS` **逐项相等**（守卫断言）。
 * 与 HIDDEN_OPS 同理：刻意用可 JSON 化的数据，schema 模式下才能内联；不引任何库。
 */
const EXPR_OPS = [
  'var',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  'nin',
  'empty',
  'notEmpty',
  'truthy',
  'falsy',
  'and',
  'or',
  'not',
  'if',
] as const

/** 构成**单键算子节点**的算子（排除 `var`，其操作数是字符串路径而非数组）。 */
const EXPR_NODE_OP_SET: ReadonlySet<string> = new Set(EXPR_OPS.filter((op) => op !== 'var'))

/** `var` 节点：取 model 路径值（与 field/prop 共用同一道 `isSafeProp` 防线）。 */
const HiddenExprVarSchema = z.strictObject({
  var: z
    .string()
    .min(1)
    .refine(isSafeProp, {
      message:
        'var 不得包含路径分隔符（/ \\）、空段/"."/".."，也不得使用 __proto__/constructor/prototype',
    })
    .describe('Model field path to read, e.g. "status" or "user.type"'),
})

/**
 * 算子节点：**恰好一个**键、键 ∈ EXPR_OPS（不含 var）、值为操作数数组。
 * 用 record + refine 而非逐个枚举算子 —— 键集闭在白名单内即沙箱闭合，运行时再校验 arity。
 */
const hiddenExprOpNode = (operand: z.ZodType<unknown>) =>
  z.record(z.string(), z.array(operand)).refine(
    (o) => {
      const keys = Object.keys(o)
      return keys.length === 1 && EXPR_NODE_OP_SET.has(keys[0])
    },
    { message: '表达式算子节点必须是恰含一个键的对象，且键 ∈ EXPR_OPS（不含 var）' }
  )

/**
 * 表达式节点（AI-16 底座，JSONLogic 形态 / CEL 语义子集）：`{ var }` 或算子节点。
 * 用于 `isHidden` 的**顶层**取值 —— 顶层不接受裸字面量（避免与「禁用 JS 串」的原则冲突）。
 */
const HiddenExprNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([HiddenExprVarSchema, hiddenExprOpNode(HiddenExprOperandSchema)])
)

/** 表达式操作数：字面量 / 操作数数组 / 节点（递归）。 */
const HiddenExprOperandSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(HiddenExprOperandSchema),
    HiddenExprVarSchema,
    hiddenExprOpNode(HiddenExprOperandSchema),
  ])
)

/**
 * 显隐条件：单条件 / 单表达式节点，或条件数组（**全部成立 = AND 才隐藏**）。
 *
 * 顺序敏感：旧条件放首位（首匹配保旧行为）；两分支不相交（旧条件必有字符串 `field`，
 * 表达式节点必为不含 `field` 的 `{var}`/算子对象）。数组分支允许旧条件与表达式混用。
 */
const HiddenConditionListSchema = z.union([
  HiddenConditionSchema,
  HiddenExprNodeSchema,
  z.array(z.union([HiddenConditionSchema, HiddenExprNodeSchema])).min(1),
])

/**
 * 字段联动（AI-07）的 fulfillment —— 纯 JSON，**绝无 JS 回调**。
 *
 * - `dataOptions`：**字面量选项数组**（JSON 数据，非表达式）—— AI-16 表达式 DSL 刻意
 *   排除对象字面量，故「选项随另一字段变化」用**多条规则 + 各自的 `when`** 表达；
 * - `required` / `disabled`：求值为布尔的 AI-16 表达式节点；
 * - `value`：求值为**本字段自己**新值的表达式节点（写回 model；存在时 `dependencies` 必填）。
 */
const ReactionFulfillSchema = z.object({
  dataOptions: z.array(DataOptionSchema).optional().describe(
    'Literal option array for this field when the rule is active (NOT an expression — the DSL forbids object literals, so branch by declaring one rule per case with its own `when`).'
  ),
  required: HiddenExprNodeSchema.optional().describe('Expression node evaluating to a boolean: make this field required.'),
  disabled: HiddenExprNodeSchema.optional().describe('Expression node evaluating to a boolean: disable this field.'),
  value: HiddenExprNodeSchema.optional().describe('Expression node evaluating to this field\'s new value, written back to the model (requires a non-empty `dependencies`).'),
})

/** 字段联动规则（AI-07，对标 Formily `x-reactions` 的声明式子集）。 */
const ReactionSchema = z
  .object({
    dependencies: z
      .array(z.string().min(1).refine(isSafeProp, {
        message:
          'dependencies 项不得包含路径分隔符（/ \\）、空段/"."/".."，也不得使用 __proto__/constructor/prototype',
      }))
      .optional()
      .describe('Model paths that trigger re-evaluation of this rule. REQUIRED when `fulfill.value` is present.'),
    when: HiddenExprNodeSchema.optional().describe(
      'Optional gate expression: the rule applies only when it evaluates truthy. Plain JSON data, never a JS function string.'
    ),
    fulfill: ReactionFulfillSchema,
  })
  .refine((r) => r.fulfill.value === undefined || (r.dependencies?.length ?? 0) > 0, {
    message: 'reactions.fulfill.value 需要非空 dependencies（否则任何 model 变更都会重算并覆盖用户手改）',
  })

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
  isHidden: HiddenConditionListSchema.optional().describe(
    "Conditional visibility for this field, expressed as PLAIN JSON DATA — never a JS function string (functions cannot be inlined into a schema-mode pageSchema). Semantics: the field is HIDDEN when the condition HOLDS (`{ field: 'payType', op: 'eq', value: 'cash' }` = hidden while payType is cash). An ARRAY of conditions is AND (hidden only when all hold). A condition may ALSO be a JSON expression (JSONLogic-shaped) when a plain condition can't express it — e.g. OR, ordering, or nesting: `{ or: [ { '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] } ] }`. Expression ops (closed set): var == != > >= < <= in nin empty notEmpty truthy falsy and or not if. The legacy {field,op,value} form remains valid and is preferred for simple cases. Applies to the query/filter form and to add/edit dialog forms (its `inQuery`/`inForm` placement) — NOT to the table column (`inTable`). Evaluated live against the form model by the three renderers."
  ),
  reactions: z.array(ReactionSchema).optional().describe(
    "Field-level linkage / computed rules (AI-07) — PLAIN JSON, never JS callbacks. Use when THIS field's options/required/disabled/value depend on ANOTHER field. Each rule `{ dependencies?, when?, fulfill }`: `dependencies` lists the model paths that retrigger it (REQUIRED for fulfill.value); `when` gates the rule; `fulfill` supplies `dataOptions` (literal array), `required`/`disabled` (boolean expressions) and/or `value` (this field's new value, written back). Example: `city` options follow `province` → one rule per province with `when: { '==': [{ var: 'province' }, 'zj'] }` and `fulfill.dataOptions: [{label:'杭州',value:'hz'}]`. Applies to the query/filter form and add/edit dialog forms — NOT to the table column."
  ),
})

/**
 * 显式表格列（`columns` 逃生数组的元素）—— 对齐组件契约 `TableColumn`。
 *
 * `fields`（扁平）只能派生「一个字段 = 一列」，表达不了**多级表头**（`groups` 自指递归）
 * 与**非字段列**（`type:'index'|'selection'|'expand'` —— 它们没有 `prop`/`label`/`formtype`，
 * 塞进 `FieldConfigSchema` 只能放宽那三个硬必填）。这层就是为此存在的窄口径承载：
 * 只收结构化列属性，**不收** `render`/`formatter` 源码字符串（自定义单元格仍走字段级扩展点）。
 *
 * `groups` 递归（组件 `TableColumn.groups?: TableColumn[]` 同形；JSON 单源
 * `table-column.schema.json` 亦以 `$ref:"#"` 自指）。跨端安全上限 = **2 级表头**
 * （antdv N 级递归，vue3/vue2 默认仅 1 级）—— 超 2 级由生成器降级告警，不在此拒绝。
 */
const ColumnSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    prop: z.string().min(1).refine(isSafeProp, {
      message:
        'prop 不得包含路径分隔符（/ \\）、空段/"."/".."，也不得使用 __proto__/constructor/prototype',
    }).optional().describe('Data key for this column, e.g. "userName". Omit for non-field columns (type: index/selection/expand).'),
    label: z.string().optional().describe('Column header text. Omit for non-field columns.'),
    labelKey: z.string().optional().describe('i18n key alternative to label (used when i18n is on)'),
    type: z.enum(['index', 'selection', 'expand']).optional().describe(
      "Non-field column kind: 'index' = row number, 'selection' = checkbox column, 'expand' = row expander (needs a content slot / expandConfig). Omit for a normal data column."
    ),
    width: z.union([z.number(), z.string()]).optional(),
    minWidth: z.union([z.number(), z.string()]).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    fixed: z.union([z.boolean(), z.literal('left'), z.literal('right')]).optional(),
    sortable: z.boolean().optional(),
    ellipsis: z.boolean().optional(),
    showOverflowTooltip: z.boolean().optional(),
    permissionValue: z.string().optional().describe('Permission code; the column is not rendered without it'),
    groups: z.array(ColumnSchema).optional().describe(
      'Nested child columns for a GROUP HEADER (multi-level). Recursive. Cross-renderer safe up to 2 levels (antdv supports N; vue3/vue2 default tables flatten beyond 1).'
    ),
    btns: z.array(z.record(z.string(), z.unknown())).optional().describe('In-cell action buttons (operation column)'),
    editRender: z
      .object({
        name: z.string().optional().describe("Inline-edit renderer name, e.g. '$input' | '$select' | '$textarea' | '$date' (vxe engine only)."),
        type: z.enum(['default', 'visible']).optional().describe("'default' = enter edit on trigger; 'visible' = editor always shown."),
        options: z
          .array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }))
          .optional()
          .describe("Option list for a '$select' editor (label/value pairs)."),
        props: z.record(z.string(), z.unknown()).optional().describe('Props forwarded to the editor component.'),
        autofocus: z.union([z.string(), z.boolean()]).optional(),
        defaultValue: z.unknown().optional(),
      })
      .optional()
      .describe("Column-level inline editor (AI-09 子项④). vxe engine only — requires tableOptions.editConfig AND tableOptions.engine:'vxe'. Function-valued fields (events) and custom-registered renderers are out of scope (Tier-3)."),
  })
)

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
    editConfig: z
      .object({
        trigger: z.enum(['click', 'dblclick', 'manual']).optional().describe("How editing is entered (default 'click')."),
        mode: z.enum(['cell', 'row']).optional().describe("'cell' = single cell; 'row' = whole row."),
        showStatus: z.boolean().optional(),
        showUpdateStatus: z.boolean().optional(),
        showInsertStatus: z.boolean().optional(),
        autoClear: z.boolean().optional(),
        enabled: z.boolean().optional(),
      })
      .optional()
      .describe(
        "Enable vxe inline editing (AI-09 子项④). vxe engine only — MUST be paired with tableOptions.engine:'vxe'. A cell is only editable when its column also declares `editRender`. `keepSource` is auto-enabled at runtime (edits are tracked on an internal copy; read them via getUpdateRecords()/edit-closed rather than expecting an auto write-back)."
      ),
    configTableOut: z
      .object({
        total: z.string().optional(),
        tableData: z.string().optional(),
        pageSize: z.string().optional(),
        current: z.string().optional(),
      })
      .optional()
      .describe(
        'Map the LIST API response onto table semantics when the backend does not use the default flat shape. Default mapping is { total: "records", tableData: "rows", pageSize: "pageSize", current: "pageNo" }. Each value is the FLAT response key (no deep paths — the component only reads top-level keys). e.g. a backend returning { list: [...], count: N } → { tableData: "list", total: "count" }. Only the keys you set are remapped; omit a key to keep its default.'
      ),
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
  columns: z.array(ColumnSchema).optional().describe(
    "Explicit table columns (escape hatch over the `fields`-derived columns). When present it REPLACES the derived data columns (override, not merge) — `fields` still drives the query/add/edit forms. Use it for multi-level group headers (`groups`), and non-field columns (`type`: index/selection/expand). The operation column is STILL appended from `actions`/`operationColumn` (set `operationColumn:false` to manage it yourself). Omit to keep the derived one-field-one-column behavior."
  ),
  expandConfig: z
    .object({
      title: z.string().optional().describe('Optional title shown at the top of the expanded row.'),
      fields: z
        .array(
          z.object({
            prop: z.string().min(1).describe('Row field to display (value = `row[prop]`).'),
            label: z.string().optional().describe('Label text for this field.'),
            labelKey: z.string().optional().describe('i18n label key (used with a global t() function; takes precedence over `label`).'),
          })
        )
        .min(1)
        .describe('Read-only fields rendered inside the expanded row, one per line as `label: value`.'),
    })
    .optional()
    .describe(
      "Row-expand content (AI-09 子项②). When set, the table gets ONE row-expander whose expanded content is a read-only field list. If `columns` already declares a `{type:'expand'}` column it is used as-is (position preserved) and the content attaches to it; otherwise the generator prepends a leading expand column. Distinct from `tableOptions.expandConfig` (the vxe `{accordion}` switch)."
    ),
  treeConfig: z
    .object({
      childrenField: z
        .string()
        .optional()
        .describe("Key name that holds a row's nested child nodes (default 'children'). Set only when the API nests children under a different key."),
      expandAll: z.boolean().optional().describe('Whether all nodes start expanded (default false).'),
    })
    .optional()
    .describe(
      "Declarative tree table (AI-09 子项③). When set, the table renders parent/child levels from the nested child array in each row (row-key is emitted automatically). Static trees only — lazy/async loading is out of scope for this key. SAME NAME but DIFFERENT LAYER from `tableOptions.treeConfig` (the vxe-only VxeTreeConfig): this top-level key is the cross-renderer narrow subset, honored by el-table / a-table as well as vxe."
    ),
})

export type StructuredCrudConfig = z.infer<typeof StructuredCrudConfigSchema>
/** Pre-parse shape (defaults still optional) — use when authoring/emitting configs before validation. */
export type StructuredCrudConfigInput = z.input<typeof StructuredCrudConfigSchema>
export type FieldConfig = z.infer<typeof FieldConfigSchema>
export type FieldRule = z.infer<typeof FieldRuleSchema>
