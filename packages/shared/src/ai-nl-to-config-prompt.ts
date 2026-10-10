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
      '工具栏按钮的左右定位用 position："left"/"right"（三端渲染器都读它；code:1/2 是仍被接受的旧别名）。金额的两位小数显示是 schema 无法声明的展示逻辑 → 落成 formatter 扩展点串，而不是丢弃。',
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
        { name: '批量导出', position: 'left', actionType: 'export' },
        { name: '新增订单', type: 'primary', position: 'right', actionType: 'add' },
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
  {
    nl: '收货地址管理：查询有收货人；表格展示收货人、所在地区、详细地址、是否默认；所在地区是省/市/区三级固定级联；支持新增、编辑、删除。',
    reasoning:
      '省/市/区是固定的三级树、不来自接口 → Cascader + 内联嵌套 dataOptions.children（递归），而不是 apiParams；详细地址是明细不作查询 (inQuery:false)；是否默认是开关 → Switch。',
    config: {
      name: 'AddressBook',
      apiUrl: '/api/addresses',
      fields: [
        { prop: 'receiver', label: '收货人', formtype: 'Input' },
        {
          prop: 'region',
          label: '所在地区',
          formtype: 'Cascader',
          inQuery: false,
          dataOptions: [
            {
              label: '浙江省',
              value: 'zj',
              children: [
                {
                  label: '杭州市',
                  value: 'hz',
                  children: [
                    { label: '西湖区', value: 'xh' },
                    { label: '余杭区', value: 'yh' },
                  ],
                },
              ],
            },
          ],
        },
        { prop: 'detail', label: '详细地址', formtype: 'Input', inQuery: false },
        { prop: 'isDefault', label: '是否默认', formtype: 'Switch', inQuery: false },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '菜单管理（整个界面要国际化）：查询有菜单名称、菜单类型（目录/菜单/按钮）；表格展示菜单名称、类型、路由路径、排序、状态；新增/编辑表单两列排布、标签宽 100px；支持新增、编辑、删除。',
    reasoning:
      '"界面要国际化" → i18n:true（标签走 labelKey）；"两列排布、标签宽" 是表单布局 → 顶层 formLayout {span:12, labelWidth:"100px"}；菜单类型是有限枚举 → Select；排序是数值 → InputNumber。',
    config: {
      name: 'MenuManage',
      apiUrl: '/api/menus',
      i18n: true,
      formLayout: { span: 12, labelWidth: '100px' },
      fields: [
        { prop: 'menuName', label: '菜单名称', formtype: 'Input' },
        {
          prop: 'menuType',
          label: '菜单类型',
          formtype: 'Select',
          dataOptions: [
            { label: '目录', value: 'catalog' },
            { label: '菜单', value: 'menu' },
            { label: '按钮', value: 'button' },
          ],
        },
        { prop: 'path', label: '路由路径', formtype: 'Input', inQuery: false },
        { prop: 'sort', label: '排序', formtype: 'InputNumber', inQuery: false },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
        },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '用 SFC 单文件组件模式生成标签管理：查询有标签名、标签分组；表格展示标签名、分组、颜色、使用次数；支持新增、编辑、删除。',
    reasoning:
      '明确要 SFC 单文件组件 → mode:"sfc"（产出自带 <script setup> 的 .vue，而非 pageSchema JSON + 包装器）；"颜色" 是取色语义 → ColorPicker；使用次数是统计值、系统生成 (inForm:false) 且不作查询。',
    config: {
      name: 'TagManage',
      apiUrl: '/api/tags',
      mode: 'sfc',
      fields: [
        { prop: 'tagName', label: '标签名', formtype: 'Input' },
        { prop: 'groupName', label: '标签分组', formtype: 'Input' },
        { prop: 'color', label: '颜色', formtype: 'ColorPicker', inQuery: false },
        { prop: 'useCount', label: '使用次数', formtype: 'InputNumber', inQuery: false, inForm: false },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '监控指标明细：数据量很大，表格要开虚拟滚动；查询有指标名、级别（正常/警告/严重）；表格展示时间、指标名、指标值、主机、级别；只读。',
    reasoning:
      '"数据量很大、开虚拟滚动" → tableOptions.virtual:true（三端引擎不同：vue3 el-table-v2、antdv 透传、vue2 退化并告警，设置本身安全）；只读 → actions 仅 ["view"]；指标值/主机是明细 (inQuery:false, inForm:false)。',
    config: {
      name: 'MetricLog',
      apiUrl: '/api/metrics',
      tableOptions: { virtual: true },
      fields: [
        { prop: 'ts', label: '时间', formtype: 'DatePicker', inForm: false },
        { prop: 'metric', label: '指标名', formtype: 'Input' },
        { prop: 'value', label: '指标值', formtype: 'InputNumber', inQuery: false, inForm: false },
        { prop: 'host', label: '主机', formtype: 'Input', inQuery: false, inForm: false },
        {
          prop: 'level',
          label: '级别',
          formtype: 'Select',
          dataOptions: [
            { label: '正常', value: 'ok' },
            { label: '警告', value: 'warn' },
            { label: '严重', value: 'crit' },
          ],
        },
      ],
      actions: ['view'],
    },
  },
  {
    nl: '会员管理：新增和编辑用不同的弹窗——新增填昵称、手机号、等级；编辑时除这些外还能改积分和状态；表格展示昵称、手机号、等级、积分、状态；支持新增、编辑、删除。',
    reasoning:
      '新增/编辑表单项不同 → 用 dialogs.add / dialogs.edit 分别声明各自的 formItems（编辑多出积分、状态）；顶层 fields 承载表格列全集，弹窗差异不污染列定义。',
    config: {
      name: 'MemberManage',
      apiUrl: '/api/members',
      fields: [
        { prop: 'nickname', label: '昵称', formtype: 'Input' },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        {
          prop: 'level',
          label: '等级',
          formtype: 'Select',
          dataOptions: [
            { label: '普通', value: 1 },
            { label: 'VIP', value: 2 },
          ],
        },
        { prop: 'points', label: '积分', formtype: 'InputNumber', inQuery: false },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          inQuery: false,
          dataOptions: [
            { label: '正常', value: 1 },
            { label: '冻结', value: 0 },
          ],
        },
      ],
      actions: ['add', 'edit', 'delete'],
      dialogs: {
        add: {
          title: '新增会员',
          formItems: [
            { prop: 'nickname', label: '昵称', formtype: 'Input' },
            { prop: 'phone', label: '手机号', formtype: 'Input' },
            { prop: 'level', label: '等级', formtype: 'Select' },
          ],
        },
        edit: {
          title: '编辑会员',
          formItems: [
            { prop: 'nickname', label: '昵称', formtype: 'Input' },
            { prop: 'phone', label: '手机号', formtype: 'Input' },
            { prop: 'level', label: '等级', formtype: 'Select' },
            { prop: 'points', label: '积分', formtype: 'InputNumber' },
            { prop: 'status', label: '状态', formtype: 'Select' },
          ],
        },
      },
    },
  },
  {
    nl: '薪资管理：表格展示员工、部门、基本工资、绩效、实发工资；其中"基本工资""实发工资"只有具备 salary:view 权限的人能看到；查询有员工、部门；支持编辑。',
    reasoning:
      '"某些列仅特定权限可见" → 对应字段用 permissionValue 逐字段门控（schema 原生支持的可见性，既不丢弃也不落成注释）；薪资字段是明细 (inQuery:false)。注意 permissionValue 是字段级可见性，与按钮级 permissions 不是一回事。',
    config: {
      name: 'SalaryManage',
      apiUrl: '/api/salaries',
      fields: [
        { prop: 'employee', label: '员工', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Input' },
        { prop: 'base', label: '基本工资', formtype: 'InputNumber', inQuery: false, permissionValue: 'salary:view' },
        { prop: 'bonus', label: '绩效', formtype: 'InputNumber', inQuery: false },
        { prop: 'net', label: '实发工资', formtype: 'InputNumber', inQuery: false, permissionValue: 'salary:view' },
      ],
      actions: ['edit'],
    },
  },
  {
    nl: '工单管理：查询有工单号、状态（待处理/处理中/已完成）；表格展示工单号、标题、状态、优先级；状态列要用彩色标签自定义渲染；操作列每行有"处理""关闭"两个按钮；支持查看、编辑。',
    reasoning:
      '"状态列彩色标签自定义渲染" 超出声明式 schema → 落成 render 扩展点（函数源码串，保留不丢）；"操作列每行有处理/关闭按钮" → operationColumn 配成对象并显式列出两个行按钮 btns（处理走 edit 弹窗）。',
    config: {
      name: 'TicketManage',
      apiUrl: '/api/tickets',
      fields: [
        { prop: 'ticketNo', label: '工单号', formtype: 'Input' },
        { prop: 'title', label: '标题', formtype: 'Input', inQuery: false },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '待处理', value: 0 },
            { label: '处理中', value: 1 },
            { label: '已完成', value: 2 },
          ],
          render: "(row) => h('el-tag', { type: row.status === 2 ? 'success' : row.status === 1 ? 'warning' : 'info' }, STATUS_TEXT[row.status])",
        },
        {
          prop: 'priority',
          label: '优先级',
          formtype: 'Select',
          inQuery: false,
          dataOptions: [
            { label: '高', value: 3 },
            { label: '中', value: 2 },
            { label: '低', value: 1 },
          ],
        },
      ],
      actions: ['view', 'edit'],
      operationColumn: {
        label: '操作',
        btns: [
          { name: '处理', dialogKey: 'edit' },
          { name: '关闭' },
        ],
      },
    },
  },
  {
    nl: '用 Ant Design Vue 做评论管理：查询有评论人、审核状态（待审/通过/驳回）；表格展示评论人、内容摘要、审核状态、提交时间；支持查看、删除。',
    reasoning:
      '明确要 Ant Design Vue → target:"antdv"（Vue3 语法，UI 符号映射到 ant-design-vue：message / Modal / <a-tag>）；审核状态是枚举 → Select；提交时间系统生成 (inForm:false)。',
    config: {
      name: 'CommentManage',
      apiUrl: '/api/comments',
      target: 'antdv',
      fields: [
        { prop: 'author', label: '评论人', formtype: 'Input' },
        { prop: 'summary', label: '内容摘要', formtype: 'Input', inQuery: false },
        {
          prop: 'auditStatus',
          label: '审核状态',
          formtype: 'Select',
          dataOptions: [
            { label: '待审', value: 0 },
            { label: '通过', value: 1 },
            { label: '驳回', value: 2 },
          ],
        },
        { prop: 'submittedAt', label: '提交时间', formtype: 'DatePicker', inForm: false },
      ],
      actions: ['view', 'delete'],
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
    'Toolbar button placement uses position: "left" | "right" — all three renderers read it (the renderer types mark code as deprecated). code:1 = left / code:2 = right is a legacy alias that is still accepted and auto-normalized.',
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
