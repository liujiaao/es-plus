import type { StructuredCrudConfigInput } from './structured-config.schema.js'

/**
 * Shared NL → StructuredCrudConfig steering prompt + few-shot pairs.
 *
 * This is the SINGLE programmatic source for the reasoning we want a host or
 * headless LLM to imitate when turning a natural-language request into a
 * StructuredCrudConfig. It is reused by:
 *   - the CLI opt-in LLM path (`packages/cli/src/ai/nl-to-config.ts`)
 *   - the accuracy eval scorer (`scripts/eval-llm.mjs`)
 *
 * The MCP server exposes the same knowledge as an MCP resource
 * (`esplus://examples/nl-to-config`) for host-LLM constrained decoding; both are
 * validated against the authoritative StructuredCrudConfigSchema so guidance can
 * never rot into invalid configs.
 *
 * Principle: examples + semantic rules REPLACE keyword tables. The model reasons
 * about field MEANING, not keyword hits, and is not bounded by any lookup's
 * coverage.
 */
export interface NlToConfigFewShot {
  /** A natural-language request a user might give. */
  nl: string
  /** Why the config maps the way it does — the reasoning to imitate. */
  reasoning: string
  config: StructuredCrudConfigInput
}

export const NL_TO_CONFIG_FEWSHOT: NlToConfigFewShot[] = [
  {
    nl: '用户管理页面：查询条件有用户名、手机号、状态（启用/禁用）；表格展示用户名、手机号、头像、注册时间、状态；支持新增、编辑、删除。',
    reasoning:
      '状态是有限枚举 → Select + 固定 dataOptions；头像是图片 → Upload，明细字段不作查询 (inQuery:false)；注册时间是时间 → DatePicker，系统生成、不在表单 (inForm:false)。类型由含义推断而非关键词命中。',
    config: {
      name: 'UserManage',
      apiUrl: '/api/users',
      fields: [
        { prop: 'username', label: '用户名', formtype: 'Input' },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
        },
        { prop: 'avatar', label: '头像', formtype: 'Upload', inQuery: false },
        { prop: 'createdAt', label: '注册时间', formtype: 'DatePicker', inForm: false },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '商品列表：查询有商品名、所属分类（分类下拉数据来自 /api/categories 接口）；表格展示商品名、分类、价格、上架状态；支持新增、编辑、删除、导出。',
    reasoning:
      '分类选项来自接口而非固定枚举 → 用 apiParams(url/labelField/valueField) 而不是 dataOptions；价格是明细字段不作查询 (inQuery:false)；上架状态是开关 → Switch。',
    config: {
      name: 'ProductManage',
      apiUrl: '/api/products',
      fields: [
        { prop: 'name', label: '商品名', formtype: 'Input' },
        {
          prop: 'categoryId',
          label: '所属分类',
          formtype: 'Select',
          apiParams: { url: '/api/categories', labelField: 'name', valueField: 'id' },
        },
        { prop: 'price', label: '价格', formtype: 'Input', inQuery: false },
        { prop: 'onSale', label: '上架状态', formtype: 'Switch', inQuery: false },
      ],
      actions: ['add', 'edit', 'delete', 'export'],
    },
  },
  {
    nl: '订单管理：表格上方左侧一个"批量导出"按钮，右侧一个"新增订单"按钮；表格展示订单号、金额、下单时间；支持新增、删除、查看；金额右对齐并保留两位小数。',
    reasoning:
      '工具栏按钮的左右定位只由 code 决定：code:1=左、code:2=右（不要用 position）。金额的两位小数显示是 schema 无法声明的展示逻辑 → 落成 formatter 扩展点串，而不是丢弃。',
    config: {
      name: 'OrderManage',
      apiUrl: '/api/orders',
      fields: [
        { prop: 'orderNo', label: '订单号', formtype: 'Input' },
        {
          prop: 'amount',
          label: '金额',
          formtype: 'Input',
          inQuery: false,
          align: 'right',
          formatter: '(row) => Number(row.amount).toFixed(2)',
        },
        { prop: 'createdAt', label: '下单时间', formtype: 'DatePicker' },
      ],
      actions: ['add', 'delete', 'view'],
      tableBtns: [
        { name: '批量导出', code: 1, actionType: 'export' },
        { name: '新增订单', type: 'primary', code: 2, actionType: 'add' },
      ],
    },
  },
  {
    nl: 'vue2 项目的任务管理：查询有任务名、优先级（高/中/低）、状态（待办/进行中/已完成）；表格展示任务名、优先级、状态、截止日期；支持新增、编辑、删除。',
    reasoning:
      '目标框架是 vue2 → target:"vue2"。优先级和状态都是有限枚举 → Select + dataOptions；截止日期 → DatePicker。多枚举各自独立配置 options。',
    config: {
      name: 'TaskManage',
      apiUrl: '/api/tasks',
      target: 'vue2',
      fields: [
        { prop: 'title', label: '任务名', formtype: 'Input' },
        {
          prop: 'priority',
          label: '优先级',
          formtype: 'Select',
          dataOptions: [
            { label: '高', value: 3 },
            { label: '中', value: 2 },
            { label: '低', value: 1 },
          ],
        },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '待办', value: 0 },
            { label: '进行中', value: 1 },
            { label: '已完成', value: 2 },
          ],
        },
        { prop: 'dueDate', label: '截止日期', formtype: 'DatePicker', inQuery: false },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '审计日志：只读列表，查询有操作人、操作类型、时间范围；表格展示操作人、操作类型、目标、IP、时间；不需要任何行操作。',
    reasoning:
      '只读 → actions 仅 ["view"]，并关闭操作列 operationColumn:false。所有字段都是展示用；时间范围查询用 DatePicker。',
    config: {
      name: 'AuditLog',
      apiUrl: '/api/audit-logs',
      fields: [
        { prop: 'operator', label: '操作人', formtype: 'Input' },
        {
          prop: 'action',
          label: '操作类型',
          formtype: 'Select',
          dataOptions: [
            { label: '登录', value: 'login' },
            { label: '新增', value: 'create' },
            { label: '删除', value: 'delete' },
          ],
        },
        { prop: 'target', label: '目标', formtype: 'Input', inQuery: false },
        { prop: 'ip', label: 'IP', formtype: 'Input', inQuery: false },
        { prop: 'createdAt', label: '时间', formtype: 'DatePicker' },
      ],
      actions: ['view'],
      operationColumn: false,
    },
  },
  {
    nl: '部门管理：查询有部门名称、负责人；表格展示部门名称、负责人、状态、创建时间；支持新增、编辑、删除；新增和编辑按钮需要权限码 dept:write。',
    reasoning:
      '按钮级权限 → permissions 映射（action → 权限码），这是 RBAC 门控，schema 原生支持，不要落成注释。创建时间系统生成 (inForm:false)。',
    config: {
      name: 'DeptManage',
      apiUrl: '/api/departments',
      permissions: { add: 'dept:write', edit: 'dept:write' },
      fields: [
        { prop: 'deptName', label: '部门名称', formtype: 'Input' },
        { prop: 'leader', label: '负责人', formtype: 'Input' },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
        },
        { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inForm: false },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
]

/**
 * Build the system prompt for an LLM converting a Chinese/English NL CRUD
 * description into a StructuredCrudConfig. The model's output is validated
 * against StructuredCrudConfigSchema by the caller (with a self-repair loop).
 */
export function buildNlToConfigSystemPrompt(): string {
  const rules = [
    'You convert a natural-language CRUD page description into a single StructuredCrudConfig JSON object.',
    '',
    'Infer field formtype by MEANING, never by keyword matching:',
    '- status / type / enum / gender / a small fixed set → Select (with dataOptions)',
    '- options that come from an API → Select/Cascader with apiParams (NOT dataOptions)',
    '- date / time → DatePicker / TimePicker',
    '- image / avatar / attachment / file → Upload',
    '- long text / remark / description → Input with attrs.type = "textarea"',
    '- boolean on/off toggle → Switch',
    '- region / category tree → Cascader',
    '- score / rating → Rate',
    '- otherwise → Input',
    '',
    'Partition each field into the three areas by intent:',
    '- inQuery: is it a filter above the table? (detail-only fields → inQuery:false)',
    '- inTable: is it a visible column?',
    '- inForm: is it entered in the add/edit form? (system-generated fields like createdAt → inForm:false)',
    '',
    'Toolbar button placement is decided ONLY by code: code:1 = left, code:2 = right. Never use a "position" field.',
    'Button-level RBAC → the top-level `permissions` map (action → permission code).',
    '',
    'Business logic the declarative schema cannot express must be PRESERVED as a typed extension point, never dropped:',
    '- read-only display logic → `formatter` (an arrow-function source string)',
    '- fully custom cell/control → `render` (a function source string)',
    '- per-field visibility gate → `permissionValue`',
    'Emitting one of these is correct behavior; silently omitting the requirement is a failure.',
    '',
    'Respond with ONLY the JSON object — no prose, no markdown fences.',
    '',
    'Examples (NL → reasoning → config):',
  ]
  const shots = NL_TO_CONFIG_FEWSHOT.map((ex, i) => {
    return [
      `### Example ${i + 1}`,
      `NL: ${ex.nl}`,
      `Reasoning: ${ex.reasoning}`,
      `Config: ${JSON.stringify(ex.config)}`,
    ].join('\n')
  })
  return rules.join('\n') + '\n\n' + shots.join('\n\n')
}
