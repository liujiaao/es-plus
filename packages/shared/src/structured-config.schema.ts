import { z } from 'zod'
import { VALID_FORM_TYPES, VALID_CRUD_ACTIONS, FORM_TYPE_ALIASES } from './contract.js'

// 教学面：`.describe()` 是宿主 LLM 唯一能看到的语义（CRUD prompt / 片段 prompt 都从
// 这里或它的 zod3 镜像自省）。规则子键此前裸奔，模型只能靠猜 pattern/trigger 的含义。
const FieldRuleSchema = z.object({
  required: z
    .boolean()
    .optional()
    .describe("Enforce a value with this rule (same effect as field-level `required`; prefer the field-level key for unconditional requirements)."),
  pattern: z
    .string()
    .optional()
    .describe('RegExp SOURCE STRING the value must match (e.g. "^1\\d{10}$"), not a RegExp object.'),
  min: z.number().optional().describe("Minimum length for strings / minimum value for numbers."),
  max: z.number().optional().describe("Maximum length for strings / maximum value for numbers."),
  type: z
    .enum(['string', 'number', 'email', 'url', 'integer'])
    .optional()
    .describe("Value type validated by this rule."),
  message: z.string().describe("Message shown when the rule fails — REQUIRED, write it in the user's language."),
  trigger: z
    .enum(['blur', 'change'])
    .optional()
    .describe("'blur' validates when the field loses focus; 'change' validates while the value changes."),
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
      'Optional gate expression: the rule applies only when it evaluates truthy. Must be a JSONLogic EXPRESSION NODE (e.g. { "==": [{ var: "country" }, "us"] }) — never the { field, op, value } legacy condition form (that form belongs to isHidden), never a bare boolean. Plain JSON data, never a JS function string.'
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
  labelKey: z.string().optional().describe(
    "i18n label key for this field's column/form label (used with a global t() function; takes precedence over `label`). When omitted, i18n mode derives one as `field.<prop>`. NOTE: it only takes effect once the HOST entry assembles the plugin with a `t` option (otherwise the runtime falls back to `label`)."
  ),
  formtype: z.enum(formTypeEnum).describe(
    "Pick by the field's MEANING, not by keyword matching: status/type/enum/gender → Select; date/time → DatePicker/TimePicker; image/avatar/attachment/file → Upload; long text/remark/description → Input (attrs.type:'textarea'); boolean on/off → Switch; single-choice small set → Radio; multi-choice → Checkbox; region/category tree → Cascader; score → Rate. Default to Input for plain text."
  ),
  inQuery: z.boolean().default(true).describe('Show as a query/filter field above the table'),
  inTable: z.boolean().default(true).describe('Show as a table column'),
  inForm: z.boolean().default(true).describe('Show in the add/edit form'),
  querySpan: z.number().int().min(1).max(24).optional().describe('Grid width of this field in the query form (1-24; 2 columns = 12 each). Column count is set PER FIELD — `formLayout` has no span key.'),
  formSpan: z.number().int().min(1).max(24).optional().describe('Grid width of this field in the add/edit form (1-24; 2 columns = 12 each). Column count is set PER FIELD — `formLayout` has no span key.'),
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
    "Extension point: a render-function source string for a custom TABLE CELL, e.g. \"(_, { row }) => h(ElTag, { type: row.status === 1 ? 'success' : 'danger' }, () => row.statusLabel)\" — honored on the table face (wired to a scoped slot in the wrapper SFC). A FORM-control render cannot be inlined (form items are serialized as JSON data in both modes), so it is preserved as a marked TODO(es-plus) marker in the generated SFC — NOT silently delivered; prefer the declarative form capabilities (formItemOptions/attrs/dataOptions/reactions) when a field needs custom FORM behaviour. Emit this (rather than dropping the requirement) when business logic exceeds the declarative schema."
  ),
  permissionValue: z.string().optional(),
  isHidden: HiddenConditionListSchema.optional().describe(
    "Conditional visibility for this field, expressed as PLAIN JSON DATA — never a JS function string (functions cannot be inlined into a schema-mode pageSchema). Semantics: the field is HIDDEN when the condition HOLDS (`{ field: 'payType', op: 'eq', value: 'cash' }` = hidden while payType is cash). An ARRAY of conditions is AND (hidden only when all hold) and may mix the two forms. TWO forms, never mixed within one node: (1) legacy condition `{ field, op, value }` whose `op` is one of eq | ne | in | nIn | empty | notEmpty | truthy | falsy (default eq) — preferred for simple comparisons; (2) a JSON expression (JSONLogic-shaped) when a plain condition can't express it — e.g. OR, ordering, or nesting: `{ or: [ { '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] } ] }`. Expression ops (closed set): var == != > >= < <= in nin empty notEmpty truthy falsy and or not if. An expression op inside a legacy `{field, op, value}` node is INVALID (runtime warns and treats the field as visible) — use form (2) for `>`, `!=`, etc. Applies to the query/filter form and to add/edit dialog forms (its `inQuery`/`inForm` placement) — NOT to the table column (`inTable`). Evaluated live against the form model by the three renderers."
  ),
  reactions: z.array(ReactionSchema).optional().describe(
    "Field-level linkage / computed rules (AI-07) — PLAIN JSON, never JS callbacks. Use when THIS field's options/required/disabled/value depend on ANOTHER field. Each rule `{ dependencies?, when?, fulfill }`: `dependencies` lists the model paths that retrigger it (REQUIRED for fulfill.value); `when` gates the rule; `fulfill` supplies `dataOptions` (literal array), `required`/`disabled` (boolean expressions) and/or `value` (this field's new value, written back). `when`/`required`/`disabled`/`value` are JSONLogic EXPRESSION NODES only (e.g. `{ '==': [{ var: 'country' }, 'us'] }`) — never the `{ field, op, value }` legacy condition form and never a bare boolean. Example: `city` options follow `province` → one rule per province with `when: { '==': [{ var: 'province' }, 'zj'] }` and `fulfill.dataOptions: [{label:'杭州',value:'hz'}]`. Applies to the query/filter form and add/edit dialog forms — NOT to the table column."
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
    // 列级 `expandConfig`（AI-09 子项② 的列内形态）。与顶层同形状、同语义，钉在
    // `type:'expand'` 列上 —— 用于「展开器不在首列」或「columns 是唯一真相」的配置。
    //
    // 为什么必须声明：Zod 默认 strip 未知键，而**生成器的列契约白名单正是从本
    // schema 的 ColumnSchema 推导**（structured-generator.ts 的 `columnContractKeys`）。
    // 漏声明 = 只在展开列上写 expandConfig 的配置在 schema 模式被 `sanitizeExplicitColumns`
    // 剥掉、展开器内容恒空，且零告警（SFC 模式的 pushSfcColumn 本来就会发它）。
    // 两层同时给出时顶层胜（生成器的 applyExpandConfig / SFC 分支都这样合并）。
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
        "Row-expand content declared ON the `type:'expand'` column (AI-09 子项②). Same shape/semantics as the top-level `expandConfig`; use it when the expander is not the leading column or when `columns` is the source of truth. If BOTH are set, the top-level one wins on the expand column. Distinct from `tableOptions.expandConfig` (the vxe `{accordion}` switch)."
      ),
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

/**
 * AN-07：表格按钮的规范键归一 —— `label→name`、`action→actionType`，
 * 并保持 `position → code` 的既有归一（表格按钮默认左侧）。
 *
 * 单源实现：Zod 的 `.transform()` 与生成器入口（`generateFromConfig`）都调它。
 * 为什么生成器要单独调一次？`transform` 只作用于 `.parse()` 的**返回值**，而
 * `generateFromConfig` 刻意不消费 parse 结果（见 `assertValidConfig` 头注：schema 带大量
 * `.default()`，改用解析值会顺带改写既有语义）。只把别名加进 Zod 而不在生成器入口归一，
 * 结果就是「校验通过、产物里按钮仍没有名字」—— 正是本项要消灭的那种静默。
 */
export function normalizeTableBtn<T extends Record<string, any>>(b: T) {
  const rest = { ...b }
  delete rest.label
  delete rest.action
  const actionType = b.actionType ?? b.action
  return {
    ...rest,
    name: (b.name ?? b.label) as string,
    code: (b.position === 'right' ? 2 : b.position === 'left' ? 1 : (b.code ?? 1)) as 1 | 2,
    ...(actionType !== undefined ? { actionType } : {}),
  }
}

const TableBtnSchema = z
  .object({
    // AN-07：`name` 不是必填本身，而是「name ?? label」归一化后的结果 —— 见下方
    // superRefine（两个都没有才算错）。前门此前把示例写成 `{ label, action }`，
    // 而 schema 只认 `{ name, actionType }`：Zod 默认 strip 未知键，照抄示例会得到
    // 「成功解析、按钮却没有名字/动作」的空壳（实测 tableBtns 维度 2/10）。
    name: z.string().min(1).optional(),
    /** @deprecated `name` 的别名（宿主 LLM / 旧示例常写 label）。归一化后不保留。 */
    label: z.string().optional().describe('Alias of `name` (legacy example shape: label/action)'),
    key: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    position: z.enum(['left', 'right']).optional().describe('left | right (recommended positioning field)'),
    code: z.union([z.literal(1), z.literal(2)]).optional().describe('1=left, 2=right (legacy alias of position; normalized automatically)'),
    dialogKey: z.string().optional(),
    actionType: z.string().optional(),
    /** @deprecated `actionType` 的别名（旧示例写法）。归一化后不保留。 */
    action: z.string().optional().describe('Alias of `actionType` (legacy example shape: label/action)'),
    confirm: z.union([z.string(), z.boolean()]).optional(),
    permissionValue: z.string().optional(),
  })
  .superRefine((b, ctx) => {
    // 归一化后仍没有名字 = 按钮点不出来的空壳；在解析期报错，而不是让下游渲染一个空按钮。
    if (!b.name && !b.label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tableBtns[] 缺少 name（别名 label 也未给）—— 按钮必须有显示名',
      })
    }
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
  //
  // AN-07：同时把别名收敛到规范键 —— `label→name`、`action→actionType`，并**删掉别名键**
  // （否则下游会同时看到 name 与 label，两处可能不一致）。superRefine 已保证此时 name 非空。
  .transform((b) => normalizeTableBtn(b))

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

/**
 * 弹窗底部按钮的**声明式子集**（AI-27）。
 *
 * 运行时 `DialogBtnConfig extends BtnConfig`，但 `click` 由 `EsCrudPage` 的
 * `resolveDialogBtns` **按 `action` 自动装配**（`confirm` → 校验后提交，`cancel` → 关闭），
 * 所以 AI 面只收 `{ name, type, action, permissionValue }` —— 这四键足以表达
 * 「加一个自定义按钮 / 改确定按钮样式 / 按权限码隐藏」，全部是纯 JSON，
 * 且**逐个都有运行时消费者**。函数值（`click`）与位置类键（`position`/`code`/`direction`）
 * 是表格/表单工具栏的概念，在弹窗底部无意义，故不收。
 */
const DialogBtnSchema = z.object({
  name: z.string().min(1).describe('Button label text.'),
  type: z.string().optional().describe("Button type, e.g. 'primary' | 'danger' | 'default'."),
  action: z
    .enum(['confirm', 'cancel', 'custom'])
    .optional()
    .describe("Button behaviour. 'confirm' = validate the dialog form then run the dialog's submit path; 'cancel' = close and emit dialog-cancel; 'custom' (or omitted) = plain button whose click must be wired by the host wrapper."),
  permissionValue: z.string().optional().describe('Permission code; the button is filtered out unless the globally configured permission function grants it.'),
})

const DialogConfigSchema = z.object({
  title: z.string().optional(),
  width: z.union([z.string(), z.number()]).optional(),
  formItems: z.array(FieldConfigSchema).optional(),
  formLayout: z.object({
    labelWidth: z.union([z.string(), z.number()]).optional(),
    minFoldRows: z.number().int().optional().describe('Form collapses when rows exceed this number'),
  }).optional(),
  hasCustomRender: z
    .boolean()
    .optional()
    .describe('Declares that the dialog body is hand-implemented in the wrapper SFC (there is no JSON transport for a render function). Setting it relaxes the "a mutating dialog needs formItems" check and makes the generator emit a TODO(es-plus) marker; it is NOT forwarded to the dialog component.'),
  isDraggable: z.boolean().optional().describe('Make the dialog draggable by its header.'),
  maxHeight: z.union([z.string(), z.number()]).optional().describe('Max height of the dialog body (scrolls beyond it).'),
  fullscreen: z.boolean().optional().describe('Open the dialog fullscreen.'),
  isHiddenFooter: z.boolean().optional().describe('Hide the whole footer (overrides configBtn).'),
  // ── 弹窗底座数据键（AI-27）────────────────────────────────────────────────
  // 这 6 个 + appendTo + cacheKey 是 core `DialogOptions` 的**具名键**，三端 es-dialog
  // 都真消费（vue3 经 attrs 透传给 el-dialog、vue2 声明为 props 或经 passThroughAttrs、
  // antdv 声明为 props）。此前 AI 契约零声明 → 宿主 LLM 在 `.dialogs[k]` 里写它们会被
  // Zod 静默剥掉，而运行时又**确实**有消费者（同 cachePageSelection / isHidden 一族）。
  showClose: z.boolean().optional().describe('Show the built-in close (X) entry; default true. false hides the self-drawn X and the native one together (the dialog then only closes via footer buttons).'),
  destroyOnClose: z.boolean().optional().describe('Destroy the dialog content on close (resets internal state each open).'),
  modal: z.boolean().optional().describe('Render the mask/overlay; default true.'),
  closeOnClickModal: z.boolean().optional().describe('Close when the mask is clicked; default true.'),
  closeOnPressEscape: z.boolean().optional().describe('Close when Escape is pressed; default true.'),
  hiddenFullBtn: z.boolean().optional().describe('Hide the built-in fullscreen toggle button.'),
  appendTo: z
    .string()
    .optional()
    .describe("CSS selector of the mount node for the dialog (e.g. 'body' or '#app-dialogs'). A DOM element cannot travel in JSON, so only the selector form is accepted — the runtime resolves it with querySelector and falls back to document.body."),
  cacheKey: z
    .string()
    .optional()
    .describe('Instance cache key: repeat calls with the same key reuse one dialog instance so its internal state survives close/reopen (recycled 10 minutes after close). Implemented identically by all three runtimes (vue3 / vue2 / ant-design-vue).'),
  configBtn: z
    .array(DialogBtnSchema)
    .min(1)
    .optional()
    .describe('Declarative footer buttons. When omitted a cancel+confirm pair is generated automatically. Each entry is JSON data — the click handler is attached by the runtime from `action`.'),
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
    heightType: z
      .enum(['height', 'auto', 'maxHeight'])
      .optional()
      .describe(
        "How the container height is applied: 'height' = fixed height (value from `height`, or `tabHeight` if set); 'maxHeight' = capped at `tabHeight` (a `height` value is IGNORED); 'auto' = no container height constraint. Default 'auto'."
      ),
    tabHeight: z
      .union([z.number(), z.string()])
      .optional()
      .describe(
        "Table height consumed for EVERY heightType: under 'height' it overrides `height`; under 'maxHeight' it is the cap. number → px, string → raw CSS value (e.g. '60vh'). Prefer it over `height` whenever a concrete height is needed — it is the only height key that applies when heightType is 'maxHeight'."
      ),
    height: z
      .union([z.number(), z.string()])
      .optional()
      .describe(
        "Container height used ONLY when heightType is 'height' (ignored for 'auto' / 'maxHeight' — use tabHeight there). Takes precedence over nothing: an explicit tabHeight always wins."
      ),
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
    // ── AI-22：闭合 strip-hazard。以下键在 core `TableOptions` / JSON 单源
    //    `table-options.schema.json` 已有、三端运行时也已消费，唯独两处 AI Zod 零声明
    //    —— 此前经 AI 入口传入会被**静默剥掉**（解析成功、零告警）。此块补齐并纳入
    //    `check-schema-contract.mjs` 的 STRUCTURED_TABLE_CONTRACT 守卫。
    size: z
      .enum(['large', 'default', 'small'])
      .optional()
      .describe("Table density. Default 'small' at runtime; el-table and a-table both accept these."),
    showHeader: z.boolean().optional().describe('Show the table header (default true). Set false to hide it.'),
    emptyText: z.string().optional().describe("Text shown when there are no rows (default '暂无数据')."),
    snIndex: z.boolean().optional().describe('Render a leading row-index (serial number) column.'),
    leftText: z.string().optional().describe('Text shown on the left side of the table toolbar.'),
    cachePageSelection: z
      .boolean()
      .optional()
      .describe(
        'Persist the checkbox selection across page changes (needs a stable rowkey). Default true at runtime; set false to reset selection on page change.'
      ),
    refetchKeepPage: z
      .boolean()
      .optional()
      .describe('Keep the current page when re-fetching (default false). Query/reset still return to page 1.'),
    localPagination: z
      .boolean()
      .optional()
      .describe('Paginate already-fetched data client-side instead of requesting each page from the API.'),
    // 注意：`defaultSort` 是本块唯一带嵌套 `.object({}).optional()` 的键，必须放**末尾** ——
    // check-schema-contract 的 tableOptions 块捕获非贪婪地停在首个 `}).optional()`，否则它
    // 之后的契约键会落在捕获区外、漏检。
    defaultSort: z
      .object({ prop: z.string(), order: z.enum(['ascending', 'descending']) })
      .optional()
      .describe('Default sort applied on first render.'),
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
    // ── AN-08：补 schema 缺失键，避免误杀 ────────────────────────────────
    // `tableOptions.treeConfig` / `tableOptions.expandConfig` 是 core `TableOptions`
    // 的具名键、vxe 引擎真消费，且官方示例
    // （es-plus-docs/src/components/examples/vxe-table/TreeData.vue）就写着
    // `treeConfig: { rowField, parentField, transform }`。此前 AI Zod 零声明：
    // 经结构化配置传入会被**静默剥掉**，页面不是树表、且零告警。
    //
    // 只收 **JSON 可承载** 的子集：`loadMethod` / `toggleMethod` 是函数（Tier-3 扩展点），
    // 不进 AI 契约。与顶层 `treeConfig`（跨端窄子集）是**不同层**：两者都写时由生成器
    // 合并到运行时唯一家 `tableOptions.treeConfig`，顶层覆盖同名字键（见 structured-generator）。
    //
    // 位置：放在 `configTableOut` 之后。`check-schema-contract` 的 tableOptions 块捕获
    // 非贪婪地停在首个 `}).optional()`（即 `defaultSort`），此后的键不在其捕获区，
    // 因此这两个嵌套对象**不能**插在 `defaultSort` 之前，否则会让契约键整段失检。
    treeConfig: z
      .object({
        transform: z
          .boolean()
          .optional()
          .describe('Build the tree client-side from FLAT rows (needs rowField + parentField). vxe only.'),
        rowField: z.string().optional().describe("Row id field for transform mode (default 'id')."),
        parentField: z.string().optional().describe("Parent id field for transform mode (default 'parentId')."),
        childrenField: z.string().optional().describe("Child array field (default 'children')."),
        children: z.string().optional().describe("@deprecated vxe v4 alias of childrenField; normalized at runtime."),
        mapChildren: z
          .string()
          .optional()
          .describe("Field that caches original children in transform mode (default '_X_ROW_CHILD')."),
        expandAll: z.boolean().optional().describe('Start with every node expanded.'),
        lazy: z
          .boolean()
          .optional()
          .describe('Lazy-load children (vxe only; the loader function itself is a Tier-3 extension point and cannot travel in JSON).'),
      })
      .optional()
      .describe(
        "vxe-only rich tree config (the SAME-NAME top-level `treeConfig` is the cross-renderer narrow subset; when both are set the generator merges them into tableOptions.treeConfig with the top-level key winning). Use `treeConfig.transform:true + rowField + parentField` to build a tree from FLAT rows; use the top-level `treeConfig` for nested `children` arrays on el-table / a-table."
      ),
    expandConfig: z
      .object({
        expandAll: z.boolean().optional().describe('Expand every row by default.'),
        accordion: z.boolean().optional().describe('Accordion mode: at most one row expanded at a time.'),
        lazy: z
          .boolean()
          .optional()
          .describe('Lazy-load expand content (vxe only; the loader function itself is a Tier-3 extension point).'),
      })
      .optional()
      .describe(
        "vxe-only row-expand switch (paired with `expand: true` / an expand column). Distinct from the top-level `expandConfig` (declarative read-only field list honored by all three renderers)."
      ),
  }).optional(),
  pagination: z.object({
    pageSize: z.number().int().default(10).describe('Rows per page on first render (default 10).'),
    pageSizes: z.array(z.number().int()).optional().describe('Selectable page-size options shown in the pager, e.g. [10, 20, 50].'),
  }).optional(),
  mode: z.enum(['schema', 'sfc']).default('schema').describe('Output mode'),
  target: z.enum(['vue3', 'vue2', 'antdv']).default('vue3').describe('Target framework: "vue3" (@es-plus/vue3 + Element Plus, default), "vue2" (@es-plus/vue2 + Element UI), or "antdv" (@es-plus/adapter-antdv + Ant Design Vue)'),
  typescript: z.boolean().default(true).describe('Generate TypeScript'),
  permissions: z.record(z.string(), z.string()).optional().describe('Permission codes for action buttons'),
  i18n: z.boolean().default(false).describe('Use labelKey for i18n'),
  formLayout: z.object({
    labelWidth: z.union([z.string(), z.number()]).optional(),
    minFoldRows: z.number().int().optional().describe('Query form collapses when rows exceed this number'),
  }).optional().describe('Query form layout config'),
  toolbarBtns: z.array(ToolbarBtnSchema).optional().describe('Toolbar buttons rendered in EsForm button area (position:left|right; defaults to right)'),
  tableBtns: z.array(TableBtnSchema).optional().describe('Table toolbar buttons (position:left|right, recommended; legacy code:1=left/2=right) rendered above EsTable'),
  operationColumn: OperationColumnSchema.optional().describe('Operation column config (false = hidden)'),
  dialogs: z.record(z.string(), DialogConfigSchema).optional().describe(
    'Per-dialog configs keyed by dialog ID (add/edit/view/…). Declaring `dialogs` gives a dialog its own base keys (appearance/close behaviour, `configBtn`, `formItems`) and does NOT suppress button derivation — the toolbar and row-action buttons are still derived from `actions` unless `toolbarBtns`/`operationColumn` are declared explicitly (those two, never `dialogs`, hand the button surface over).'
  ),
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
  mergeConfig: z
    .object({
      rowsBy: z
        .array(z.string().min(1))
        .min(1)
        .describe('Column props to merge. Each is grouped by ADJACENT-EQUAL values: the first row of a run keeps the cell with rowspan = run length, the rest are merged away.'),
    })
    .optional()
    .describe(
      "Declarative row-merge (AI-23). `rowsBy: ['dept','team']` merges those columns across consecutive rows with equal values (the standard 'grouped rows' table). Cross-renderer narrow subset: el-table (span-method), a-table (per-column customCell) and vxe (mergeMethod) all honor it. The FUNCTIONAL escape hatch `tableOptions.spanMethod` remains Tier-3 and is NOT cross-renderer (a-table has no span-method channel) — if both are set, the explicit `spanMethod` wins."
    ),
})

export type StructuredCrudConfig = z.infer<typeof StructuredCrudConfigSchema>
/** Pre-parse shape (defaults still optional) — use when authoring/emitting configs before validation. */
export type StructuredCrudConfigInput = z.input<typeof StructuredCrudConfigSchema>
export type FieldConfig = z.infer<typeof FieldConfigSchema>
export type FieldRule = z.infer<typeof FieldRuleSchema>
