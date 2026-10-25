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
        { prop: 'createdAt', label: '注册时间', formtype: 'DatePicker', inQuery: false, inForm: false },
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
        { prop: 'price', label: '价格', formtype: 'InputNumber', inQuery: false },
        { prop: 'onSale', label: '上架状态', formtype: 'Switch', inQuery: false },
      ],
      actions: ['add', 'edit', 'delete', 'export'],
    },
  },
  {
    nl: '订单管理：表格上方左侧一个"批量导出"按钮，右侧一个"新增订单"按钮；表格展示订单号、金额、下单时间；支持新增、删除、查看；金额右对齐并保留两位小数。',
    reasoning:
      '工具栏按钮的左右定位用 position："left"/"right"（三端渲染器都读它；code:1/2 是仍被接受的旧别名）。按钮的动作绑定按语义分两类：打开弹窗的 add/edit/view 用 dialogKey（新增→dialogKey:"add" 才会打开内置新增弹窗），导出/导入这类副作用用 actionType（actionType:"export"/"import"）—— 二者不可混用，给新增写 actionType:"add" 不会打开任何弹窗（是个死按钮）。金额的两位小数显示是 schema 无法声明的展示逻辑 → 落成 formatter 扩展点串，而不是丢弃。',
    config: {
      name: 'OrderManage',
      apiUrl: '/api/orders',
      fields: [
        { prop: 'orderNo', label: '订单号', formtype: 'Input' },
        {
          prop: 'amount',
          label: '金额',
          formtype: 'InputNumber',
          inQuery: false,
          align: 'right',
          formatter: '(row) => Number(row.amount).toFixed(2)',
        },
        { prop: 'createdAt', label: '下单时间', formtype: 'DatePicker' },
      ],
      actions: ['add', 'delete', 'view'],
      tableBtns: [
        { name: '批量导出', position: 'left', actionType: 'export' },
        { name: '新增订单', type: 'primary', position: 'right', dialogKey: 'add' },
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
          inQuery: false,
        },
        { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inQuery: false, inForm: false },
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
      '"界面要国际化" → i18n:true（标签走 labelKey）；"新增/编辑表单两列排布" → **每字段 formSpan:12**（栅格由字段级 span 决定，formLayout 只管 labelWidth/minFoldRows、没有 span 键）；"标签宽 100px" → 顶层 formLayout {labelWidth:"100px"}；菜单类型是有限枚举 → Select；排序是数值 → InputNumber。（跨文件前提：labelKey 只有宿主入口 app.use(ESPlus,{t}) 装配 i18n 的 t(key) 后才生效，否则回落 label）',
    config: {
      name: 'MenuManage',
      apiUrl: '/api/menus',
      i18n: true,
      formLayout: { labelWidth: '100px' },
      fields: [
        { prop: 'menuName', label: '菜单名称', formtype: 'Input', formSpan: 12 },
        {
          prop: 'menuType',
          label: '菜单类型',
          formtype: 'Select',
          formSpan: 12,
          dataOptions: [
            { label: '目录', value: 'catalog' },
            { label: '菜单', value: 'menu' },
            { label: '按钮', value: 'button' },
          ],
        },
        { prop: 'path', label: '路由路径', formtype: 'Input', inQuery: false, formSpan: 12 },
        { prop: 'sort', label: '排序', formtype: 'InputNumber', inQuery: false, formSpan: 12 },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          formSpan: 12,
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
          inQuery: false,
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
        { prop: 'ts', label: '时间', formtype: 'DatePicker', inQuery: false, inForm: false },
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
      '"某些列仅特定权限可见" → 对应字段用 permissionValue 逐字段门控（schema 原生支持的可见性，既不丢弃也不落成注释）；薪资字段是明细 (inQuery:false)。注意 permissionValue 是字段级可见性，与按钮级 permissions 不是一回事。（跨文件前提：permissionValue 只有宿主入口 app.use(ESPlus,{permission}) 装配 permission(code) 后才生效，否则静默放行）',
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
      '"状态列彩色标签自定义渲染" 明确要求自定义渲染 → 保留 render 扩展点（函数源码串，不丢）；注意若只是「码值 → 中文 + 标签色」，声明式 dataOptions + tagType 就够，不必上 render；"操作列每行有处理/关闭按钮" → operationColumn 配成对象并显式列出两个行按钮 btns（处理走 edit 弹窗）。',
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
        { prop: 'submittedAt', label: '提交时间', formtype: 'DatePicker', inQuery: false, inForm: false },
      ],
      actions: ['view', 'delete'],
    },
  },
  {
    nl: '资金台账：查询有账户名；表格展示账户名、余额、币种、更新时间；支持新增、编辑、删除。注意列表接口返回的是 { list: [...], totalCount: N }，请按此做响应字段映射。',
    reasoning:
      '后端列表响应是 { list, totalCount } 而非常规的 { rows, records } → 在 tableOptions.configTableOut 做平铺键映射 { tableData: "list", total: "totalCount" }（每个值是响应里的平铺键名，不是深层路径；只声明要改的键，其余保持默认）。余额是数值 → InputNumber；币种是有限枚举 → Select + dataOptions；更新时间系统生成 → inForm:false。',
    config: {
      name: 'LedgerManage',
      apiUrl: '/api/ledgers',
      fields: [
        { prop: 'accountName', label: '账户名', formtype: 'Input' },
        { prop: 'balance', label: '余额', formtype: 'InputNumber', inQuery: false },
        {
          prop: 'currency',
          label: '币种',
          formtype: 'Select',
          dataOptions: [
            { label: '人民币', value: 'CNY' },
            { label: '美元', value: 'USD' },
          ],
          inQuery: false,
        },
        { prop: 'updatedAt', label: '更新时间', formtype: 'DatePicker', inQuery: false, inForm: false },
      ],
      tableOptions: { configTableOut: { tableData: 'list', total: 'totalCount' } },
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '退款单管理：查询条件有退款单号和订单号；表格展示退款单号、订单号、退款金额、退款方式、退款原因；支持新增、编辑、删除。新增/编辑时，退款原因只在退款方式为「部分退款」时才需要填写。',
    reasoning:
      '「只在…时才需要填写」= 条件显隐，且是**反相**的：字段在「退款方式 ≠ 部分退款」时隐藏，所以在退款原因字段上写 `isHidden: { field: "refundType", op: "ne", value: "part" }`（语义是「条件成立即隐藏」，op 省略时默认 eq）。它是**纯 JSON 数据**，绝不是函数字符串 —— 不要写成 permissionValue（那是权限码）或 render/formatter。退款方式是有限枚举 → Select + dataOptions，value 用英文码，条件里的 value 必须与之一致；退款金额是数值 → InputNumber。查询条件按 NL 只有两个 → 其余字段 inQuery:false；退款单号是系统生成的业务单号 → inForm:false。',
    config: {
      name: 'RefundManage',
      apiUrl: '/api/refunds',
      fields: [
        { prop: 'refundNo', label: '退款单号', formtype: 'Input', inForm: false },
        { prop: 'orderNo', label: '订单号', formtype: 'Input' },
        { prop: 'refundAmount', label: '退款金额', formtype: 'InputNumber', inQuery: false },
        {
          prop: 'refundType',
          label: '退款方式',
          formtype: 'Select',
          inQuery: false,
          dataOptions: [
            { label: '全额退款', value: 'full' },
            { label: '部分退款', value: 'part' },
          ],
        },
        {
          prop: 'refundReason',
          label: '退款原因',
          formtype: 'Input',
          inQuery: false,
          isHidden: { field: 'refundType', op: 'ne', value: 'part' },
        },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '省份城市管理：查询条件有省份；表格展示省份、城市、详细地址；支持新增、编辑、删除。新增/编辑时，「城市」的下拉选项随所选省份变化——选浙江出杭州、宁波，选江苏出南京、苏州。',
    reasoning:
      '「一个字段的下拉选项随另一字段变化」= 字段联动 `reactions`（纯 JSON，绝不是函数回调）。`dataOptions` 是**字面量选项数组、不是表达式** —— 表达式 DSL 刻意没有对象字面量，所以「选项随条件分支」要写成**每个分支一条规则**，各带自己的 `when` 谓词：省份为 zj 出一条、为 js 出一条，后声明者覆盖先声明者（last-wins）。`dependencies` 列出触发重算的 model 路径（province）。这是**表单作用域**的联动（查询表单 + 新增/编辑弹窗），不是表格列。省份与城市都是有限枚举 → Select + dataOptions，规则里的 value 必须与之一致。',
    config: {
      name: 'ProvinceCityManage',
      apiUrl: '/api/regions',
      fields: [
        { prop: 'province', label: '省份', formtype: 'Select', dataOptions: [{ label: '浙江', value: 'zj' }, { label: '江苏', value: 'js' }] },
        {
          prop: 'city',
          label: '城市',
          formtype: 'Select',
          inQuery: false,
          reactions: [
            { dependencies: ['province'], when: { '==': [{ var: 'province' }, 'zj'] }, fulfill: { dataOptions: [{ label: '杭州', value: 'hz' }, { label: '宁波', value: 'nb' }] } },
            { dependencies: ['province'], when: { '==': [{ var: 'province' }, 'js'] }, fulfill: { dataOptions: [{ label: '南京', value: 'nj' }, { label: '苏州', value: 'sz' }] } },
          ],
        },
        { prop: 'address', label: '详细地址', formtype: 'Input', inQuery: false },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '考勤管理：查询条件有员工姓名和部门；表格第一列是序号列，随后用两级分组表头展示——「员工」下分员工姓名、部门，「考勤」下分出勤天数、迟到次数；支持新增、编辑、删除。',
    reasoning:
      'NL 要求「序号列」+「两级分组表头」——扁平的 `fields` 数组表达不了（非字段列没有 prop/label/formtype，多级表头需要嵌套）。所以用顶层 `columns` 逃生数组：`{ type: "index" }` 是序号列（非字段列），分组表头写 `{ label: "员工", groups: [ …子列… ] }`（跨端安全上限 2 级）。注意 `columns` 一旦给出就**整体覆盖**派生列（override 非 merge），因此每个要在表格里出现的字段都必须写进 `columns`（这里四个字段都进了 groups）；`fields` 仍照常驱动查询表单与新增/编辑表单，故查询字段只需在 `fields` 里标 inQuery。操作列不写进 `columns`——它仍由 actions 自动追加。',
    config: {
      name: 'AttendanceManage',
      apiUrl: '/api/attendance',
      fields: [
        { prop: 'employeeName', label: '员工姓名', formtype: 'Input' },
        { prop: 'department', label: '部门', formtype: 'Input' },
        { prop: 'attendDays', label: '出勤天数', formtype: 'InputNumber', inQuery: false },
        { prop: 'lateCount', label: '迟到次数', formtype: 'InputNumber', inQuery: false },
      ],
      columns: [
        { type: 'index', label: '序号', width: 60 },
        {
          label: '员工',
          groups: [
            { prop: 'employeeName', label: '员工姓名' },
            { prop: 'department', label: '部门' },
          ],
        },
        {
          label: '考勤',
          groups: [
            { prop: 'attendDays', label: '出勤天数' },
            { prop: 'lateCount', label: '迟到次数' },
          ],
        },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '订单管理：查询条件有订单号；表格展示订单号、金额、下单时间；每行可展开查看收货人、联系电话、收货地址；支持新增、删除。',
    reasoning:
      'NL 要求「每行可展开查看…」——这是声明式**行展开内容**，用顶层 `expandConfig`（不是 `tableOptions.expandConfig`，后者是 vxe 的 accordion 开关，与内容无关）。展开的三个字段是明细信息，不单独成列，故标 `inTable:false`；它们仍可留在 `fields` 里（供新增/编辑表单使用，若不需要也可只放在 expandConfig.fields）。这里没给 `columns`，生成器会自动前置一个展开列，无需自己写 `{type:"expand"}`。`expandConfig.fields` 顺序即展示顺序。',
    config: {
      name: 'OrderExpandManage',
      apiUrl: '/api/orders',
      fields: [
        { prop: 'orderNo', label: '订单号', formtype: 'Input' },
        { prop: 'amount', label: '金额', formtype: 'InputNumber', inQuery: false },
        { prop: 'createdAt', label: '下单时间', formtype: 'DatePicker', inQuery: false, inForm: false },
        { prop: 'receiver', label: '收货人', formtype: 'Input', inTable: false, inQuery: false },
        { prop: 'phone', label: '联系电话', formtype: 'Input', inTable: false, inQuery: false },
        { prop: 'address', label: '收货地址', formtype: 'Input', inTable: false, inQuery: false },
      ],
      expandConfig: {
        title: '收货信息',
        fields: [
          { prop: 'receiver', label: '收货人' },
          { prop: 'phone', label: '联系电话' },
          { prop: 'address', label: '收货地址' },
        ],
      },
      actions: ['add', 'delete'],
    },
  },
  {
    nl: '部门管理：查询条件有部门名称；表格展示部门名称、负责人、状态、创建时间；部门是树形结构，子部门嵌套在父部门下面，默认全部展开。',
    reasoning:
      'NL 要求「树形结构 / 子部门嵌套在父部门下」——这是声明式**树表**，用顶层 `treeConfig`。行数据的层级键名是缺省的 `children`，故 `childrenField` 省略；「默认全部展开」→ `expandAll: true`。`row-key` 由生成器自动发射（rowkey 默认 "id"），无需手写。这里没有分组表头/非字段列，不用 `columns`。注意 `treeConfig` 是纯 JSON 声明式数据（非扩展点），且**区别于** `tableOptions.treeConfig`（那是 vxe 专有的 VxeTreeConfig）——用顶层这个。懒加载/异步 load 不在本键范围。',
    config: {
      name: 'DepartmentTreeManage',
      apiUrl: '/api/departments',
      fields: [
        { prop: 'deptName', label: '部门名称', formtype: 'Input' },
        { prop: 'leader', label: '负责人', formtype: 'Input', inQuery: false },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ],
          inQuery: false,
        },
        { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inQuery: false, inForm: false },
      ],
      treeConfig: { expandAll: true },
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '员工台账：查询条件有姓名；表格展示部门、小组、姓名、职位；同一个部门的行把「部门」合并显示一次，同一个小组把「小组」合并显示一次；支持新增、编辑。',
    reasoning:
      'NL 说「同一个部门的行合并显示一次 / 合并单元格 / 分组表」——这是声明式**行合并**，用顶层 `mergeConfig`：`{ rowsBy: ["dept", "team"] }`（数组非空）。语义是「相邻相等」分组：被点名的列按值切段，每段首行保留单元格且 `rowspan` = 段长，其余格被合并掉；`rowsBy` 的**顺序即分组轴**（先部门、再小组），照请求里点名的列序写。这是跨端声明式窄子集——生成器把它翻成三端各自机制（el-table `span-method` / a-table 列级 `customCell` / vxe `mergeMethod`），**绝不手写 span 函数**。**区别于**函数式 `tableOptions.spanMethod`（任意 JS 闭包，Tier-3、非跨端；两者并存时显式 `spanMethod` 胜出且生成器告警）。注意这是**分组**不是**树**：行仍平铺（横向相邻合并），「树形结构 / 子部门嵌套」用顶层 `treeConfig`。',
    config: {
      name: 'StaffMergeManage',
      apiUrl: '/api/staff',
      fields: [
        { prop: 'dept', label: '部门', formtype: 'Input', inQuery: false, inForm: false },
        { prop: 'team', label: '小组', formtype: 'Input', inQuery: false, inForm: false },
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'role', label: '职位', formtype: 'Input', inQuery: false },
      ],
      mergeConfig: { rowsBy: ['dept', 'team'] },
      actions: ['add', 'edit'],
    },
  },
  {
    nl: '商品价格维护：查询条件有商品名称；表格支持行内编辑，单击单元格修改价格；表格展示商品名称、价格、库存；支持编辑。',
    reasoning:
      'NL 说「表格支持行内编辑，单击单元格修改」→ 行内编辑三件套必须同给：(1) `tableOptions.engine: "vxe"`；(2) 表级开关 `tableOptions.editConfig`（单击进入 → trigger 缺省即 "click"，单格编辑 → mode 缺省即 "cell"，显式写 `{ mode: "cell" }` 更清楚）；(3) 每个可编辑列的 `columns[].editRender`（没有它该列永不可编辑，editConfig 就是空转）。价格/库存都是数值 → 编辑器用 `$input` + `props.type:"number"`。`columns` 是**覆盖**派生的整表列数组，故表里要展示的列都要写进来；操作列仍由 `actions` 自动追加，不写。',
    config: {
      name: 'SkuPriceEditManage',
      apiUrl: '/api/sku',
      fields: [
        { prop: 'skuName', label: '商品名称', formtype: 'Input' },
        { prop: 'price', label: '价格', formtype: 'InputNumber', inQuery: false },
        { prop: 'stock', label: '库存', formtype: 'InputNumber', inQuery: false },
      ],
      tableOptions: { engine: 'vxe', editConfig: { mode: 'cell' } },
      columns: [
        { prop: 'skuName', label: '商品名称', editRender: { name: '$input' } },
        { prop: 'price', label: '价格', editRender: { name: '$input', props: { type: 'number' } } },
        { prop: 'stock', label: '库存', editRender: { name: '$input', props: { type: 'number' } } },
      ],
      actions: ['edit'],
    },
  },
  {
    nl: '客户合同管理：查询条件有合同编号和客户名称；表格第一列是复选框，之后依次展示合同编号、客户名称、合同金额、签约日期（按这个顺序）；支持新增、编辑、删除。',
    reasoning:
      '「第一列是复选框」是非字段列 —— 扁平 `fields` 表达不了，必须用顶层 `columns`，写 `{ type: "selection", width: 50 }`（其余非字段列：`index` 序号、`expand` 展开器）。`columns` 一旦给出就**整体覆盖**派生列（override 非 merge），所以「表格展示…」点名的每个字段都必须按 NL 给出的**顺序**逐个写进 `columns`；漏写一个，该列就直接消失。操作列仍然由 `actions` 自动追加，不要写进 `columns`。`fields` 继续驱动查询表单与新增/编辑表单（查询字段照常标 inQuery）。',
    config: {
      name: 'ContractSelectionManage',
      apiUrl: '/api/contracts',
      fields: [
        { prop: 'contractNo', label: '合同编号', formtype: 'Input' },
        { prop: 'customerName', label: '客户名称', formtype: 'Input' },
        { prop: 'amount', label: '合同金额', formtype: 'InputNumber', inQuery: false },
        { prop: 'signedAt', label: '签约日期', formtype: 'DatePicker', inQuery: false },
      ],
      columns: [
        { type: 'selection', width: 50 },
        { prop: 'contractNo', label: '合同编号' },
        { prop: 'customerName', label: '客户名称' },
        { prop: 'amount', label: '合同金额' },
        { prop: 'signedAt', label: '签约日期' },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '报销管理：查询条件有报销单号；表格展示报销单号、报销类型、金额、收款方、备注；支持新增、编辑、删除。新增/编辑时，报销类型选「其他」就必须填写备注；选「个人」时收款方自动填「个人」，其余类型自动填「公司」。',
    reasoning:
      '「选某值时必须填写」= 字段级 `reactions` 的 `fulfill.required`（求值为布尔的 JSONLogic 表达式节点，**不是**裸 boolean，也不是 `{field,op,value}` 旧条件）；「某值自动填另一字段」= 同字段的 `fulfill.value`（表达式 `if`，三操作数允许 else 分支）——两者都是纯 JSON，绝不是 JS 回调。`fulfill.value` 规则**必须**带非空 `dependencies`（否则任何编辑都会重算并覆盖用户手改）。`required` 不需要 `when`：表达式本身已编码条件，运行时直接按求值结果切换必填。注意 `remark` 同时是表格列与表单字段（不是 isHidden —— 字段始终可见，只是条件必填）。',
    config: {
      name: 'ExpenseLinkageManage',
      apiUrl: '/api/expenses',
      fields: [
        { prop: 'expenseNo', label: '报销单号', formtype: 'Input' },
        {
          prop: 'expenseType',
          label: '报销类型',
          formtype: 'Select',
          inQuery: false,
          dataOptions: [
            { label: '个人', value: 'personal' },
            { label: '公司', value: 'company' },
            { label: '其他', value: 'other' },
          ],
        },
        { prop: 'amount', label: '金额', formtype: 'InputNumber', inQuery: false },
        {
          prop: 'payee',
          label: '收款方',
          formtype: 'Input',
          inQuery: false,
          reactions: [
            {
              dependencies: ['expenseType'],
              fulfill: {
                value: {
                  if: [
                    { '==': [{ var: 'expenseType' }, 'personal'] },
                    '个人',
                    '公司',
                  ],
                },
              },
            },
          ],
        },
        {
          prop: 'remark',
          label: '备注',
          formtype: 'Input',
          inQuery: false,
          attrs: { type: 'textarea' },
          reactions: [
            {
              dependencies: ['expenseType'],
              fulfill: { required: { '==': [{ var: 'expenseType' }, 'other'] } },
            },
          ],
        },
      ],
      actions: ['add', 'edit', 'delete'],
    },
  },
  {
    nl: '请假单管理：查询条件有请假人和状态（待审/通过/驳回）；表格展示请假人、请假类型、开始日期、天数、状态；支持新增、查看。查看弹窗标题改成「请假详情」，底部只保留一个「关闭」按钮。',
    reasoning:
      '「查看弹窗标题 / 底部只留一个关闭按钮」是 `dialogs.view` 的**基础键**：`title` 覆盖默认标题，`configBtn` 是纯 JSON 数组（这里是 `[{ name: "关闭", action: "cancel" }]`），运行时按 `action` 装配点击行为（"confirm" 校验并提交、"cancel" 直接关闭）——**绝不能**在 JSON 里写 `click` 函数。声明 `dialogs` 不会关掉按钮派生：`actions: ["add","view"]` 仍自动派生「新增」工具栏按钮与「查看」行按钮，二者分别打开 add/view 弹窗，无需再写 toolbarBtns/operationColumn。',
    config: {
      name: 'LeaveViewDialogManage',
      apiUrl: '/api/leaves',
      fields: [
        { prop: 'leavePerson', label: '请假人', formtype: 'Input' },
        { prop: 'leaveType', label: '请假类型', formtype: 'Select', inQuery: false, dataOptions: [{ label: '事假', value: 'personal' }, { label: '病假', value: 'sick' }, { label: '年假', value: 'annual' }] },
        { prop: 'startDate', label: '开始日期', formtype: 'DatePicker', inQuery: false },
        { prop: 'days', label: '天数', formtype: 'InputNumber', inQuery: false },
        {
          prop: 'status',
          label: '状态',
          formtype: 'Select',
          dataOptions: [
            { label: '待审', value: 'pending' },
            { label: '通过', value: 'approved' },
            { label: '驳回', value: 'rejected' },
          ],
        },
      ],
      dialogs: {
        view: {
          title: '请假详情',
          formItems: [
            { prop: 'leavePerson', label: '请假人', formtype: 'Input' },
            { prop: 'leaveType', label: '请假类型', formtype: 'Select' },
            { prop: 'startDate', label: '开始日期', formtype: 'DatePicker' },
            { prop: 'days', label: '天数', formtype: 'InputNumber' },
            { prop: 'status', label: '状态', formtype: 'Select' },
          ],
          configBtn: [{ name: '关闭', action: 'cancel' }],
        },
      },
      actions: ['add', 'view'],
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
    '- numeric value / amount / price / quantity / stock / count / money / integer → InputNumber',
    '- otherwise → Input',
    '',
    'Partition each field into the three areas by intent:',
    '- inQuery: is it a filter above the table? (detail-only fields → inQuery:false)',
    '- inTable: is it a visible column?',
    '- inForm: is it entered in the add/edit form? (system-generated fields like createdAt → inForm:false)',
    'Exclude ONLY where the description says so, and write that exclusion explicitly: emit `false` when the description EXCLUDES the field from an area — it enumerates that area ("查询条件有用户名、状态", "表格展示 A、B、C") and this field is not among them, or it says the field belongs elsewhere ("只在表格里看"). Do NOT invent an exclusion when the description simply never mentions that area — silence means included (the schema default is `true`, and an omitted key is treated as included everywhere downstream). Only an explicit `false` excludes.',
    '',
    'Query-form and add/edit-form column width come from the FIELD, never the layout: to make the query form N columns set `querySpan` on each query field, and to make the add/edit form N columns set `formSpan` on each form field (values 1–24, so 2 columns = 12 each, 3 columns = 8 each). `formLayout` (top-level or per-dialog) carries ONLY `labelWidth` and `minFoldRows` — it has NO `span` key, so never express a column count there.',
    'Dialog appearance and close behaviour ("不要关闭按钮/X", "点遮罩不要关", "按 ESC 不要关", "每次打开都重置表单", "弹窗挂到 #app-dialogs 下", "弹窗要能拖拽 / 要全屏 / 隐藏底部 / 限制高度") → the matching data key on the dialog: `showClose` (hide the X, default true), `closeOnClickModal`, `closeOnPressEscape`, `destroyOnClose` (reset state on each open), `appendTo` (a CSS SELECTOR string — never a DOM node), `isDraggable`, `fullscreen`, `isHiddenFooter`, `maxHeight`, `modal` (the mask), `hiddenFullBtn`. These are plain booleans/strings, usually defaulting to true, so write `false` to turn one off; all three renderers forward them verbatim to the underlying dialog. Put them on `dialogs[k]` — do NOT drop the requirement, and do NOT express it as a comment.',
    'Custom dialog footer buttons ("弹窗底部要有一个…按钮", "只要一个关闭按钮") → `dialogs[k].configBtn`, a JSON ARRAY of `{ name, type?, action?: "confirm" | "cancel" | "custom", permissionValue? }`. The runtime attaches the click handler from `action` ("confirm" validates the dialog form then runs the submit path, "cancel" just closes), so NEVER emit a `click` function here. Omitting `configBtn` keeps the generated cancel+confirm pair. A fully custom dialog BODY is a function and cannot travel in JSON: declare `hasCustomRender: true` on that dialog and the wrapper gets a TODO(es-plus) placeholder to fill in.',
    'Declaring `dialogs` is the way to give a dialog its own base keys (appearance/close behaviour, `configBtn`, `formItems`) — it does NOT put the page into a button-less mode: the toolbar buttons and the row action column keep being derived from `actions` (default `["add","edit","delete"]`), so `dialogs: { add: … }` with `add` among the actions already gets the 「新增」 toolbar button that opens it. The button surface is handed over ONLY by declaring `toolbarBtns` and/or `operationColumn` explicitly — those (never `dialogs`) are what stop the derivation: any `toolbarBtns` array replaces the derived toolbar (`[]` = none), and any `operationColumn` value (including `false`) replaces the derived row-action column. If you do declare them, every dialog must be reachable from a button you name (`toolbarBtns`/`tableBtns` entries carry `dialogKey`, `operationColumn.btns` entries carry `dialogKey`, `confirm` for the delete button) — a dialog nothing opens is a dead end (the generator warns "has no opener"), and a button whose `dialogKey` matches no `dialogs[k]` entry does nothing when clicked.',
    'Toolbar button placement uses position: "left" | "right" — all three renderers read it (the renderer types mark code as deprecated). code:1 = left / code:2 = right is a legacy alias that is still accepted and auto-normalized.',
    'Bind each button to its behavior by semantics, matching the library defaults: dialog buttons (add / edit / view) use `dialogKey` (the "新增" toolbar button → dialogKey:"add" opens the built-in add dialog; row 编辑 → dialogKey:"edit", 查看 → dialogKey:"view"); side-effect buttons (export / import) use `actionType` ("导出" → actionType:"export", "导入" → actionType:"import"); the row delete button uses `confirm`. NEVER put actionType:"add" on an add button — only `dialogKey` opens the built-in dialog, so an actionType:"add" button does nothing.',
    'Button-level RBAC → the top-level `permissions` map (action → permission code).',
    'When the list response does not use the library default shape ({ rows, records }), declare the mapping declaratively in `tableOptions.configTableOut` — a FLAT path object { total?, tableData?, pageSize?, current? } whose VALUES are the response key names, e.g. a backend returning { list, count } → { tableData: "list", total: "count" }. Do NOT model response mapping any other way; it is a plain object, never a callback.',
    'Conditional field visibility ("only needed when …", "只在…时才填写") → the field-level `isHidden`, expressed as PLAIN JSON DATA, never a JS function: a single condition `{ field, op?, value? }` or an ARRAY of them (AND — hidden only when ALL hold). Semantics: the field is HIDDEN WHILE the condition HOLDS, so "show only when refundType is part" is `{ field: "refundType", op: "ne", value: "part" }`. `field` is another field path in the same form, `value` must match that field\'s value type (e.g. the dataOptions value), ops = eq (default) / ne / in / nIn / empty / notEmpty / truthy / falsy. Only when the predicate genuinely needs OR / AND-OR mixes, ordering (>, <=) or a nested NOT — which the plain form cannot express — use a JSON expression instead (JSONLogic-shaped, same `isHidden` key), e.g. `{ or: [ { "==": [{ var: "status" }, "pending"] }, { ">": [{ var: "amount" }, 100] } ] }`; expression ops = var == != > >= < <= in nin empty notEmpty truthy falsy and or not if (prefer the plain form for simple cases). It applies to the query and add/edit forms, NOT to the table column. Emit this rather than dropping the conditional field.',
    'Field-value linkage / computed ("城市下拉随省份变化", "only required once city is filled", "所属大区自动等于所选省份", "结案后结论不可改") → the field-level `reactions` array (PLAIN JSON, never JS callbacks). Use it when THIS field\'s options / required / disabled / value depend on ANOTHER field. Each rule is `{ dependencies?, when?, fulfill }`: `dependencies` lists the model paths that retrigger it (REQUIRED whenever `fulfill.value` is present — otherwise every edit would overwrite the user\'s manual entry); `when` is a plain-JSON expression (same DSL as `isHidden`, ops = var == != > >= < <= in nin empty notEmpty truthy falsy and or not if) gating the rule; `fulfill` supplies any of: `dataOptions` (a LITERAL option array — NOT an expression: the DSL forbids object literals, so express "options depending on another field" as ONE RULE PER CASE, each with its own `when`, e.g. province=zj → rule A options, province=js → rule B options), `required` / `disabled` (expression nodes evaluating to a boolean), and `value` (an expression node producing THIS field\'s new value, written back to the model). Rules are evaluated in order with LAST WINS. Applies to the query and add/edit forms, NOT the table column. This is DISTINCT from `isHidden`: use `isHidden` when the field merely appears/disappears; use `reactions` when its options, required, disabled or value must change.',
    'Multi-level group headers and non-field columns (row number / checkbox / expander) cannot be expressed by the flat `fields` array — use the top-level `columns` array (an escape hatch aligned with the renderer `TableColumn`). When present it REPLACES the derived table columns (override, not merge), while `fields` still drives the query/add/edit forms. A group header is `{ label, groups: [ …child columns… ] }` — cross-renderer safe to 2 levels (antdv supports more; vue3/vue2 default tables flatten beyond one nesting). A non-field column is `{ type: "index" | "selection" | "expand" }` (no prop/label needed). The operation column is STILL appended from `actions`/`operationColumn`, so do not add it to `columns`. Use `columns` only when the NL asks for grouped headers or index/selection/expander columns; otherwise keep the plain `fields` array.',
    'Row-expand content ("每行可展开查看…", "点击行展开显示…") → the top-level `expandConfig`: `{ title?, fields: [ { prop, label? } ] }` (fields non-empty). Its presence makes the table render ONE row-expander whose content is a read-only `label: value` list read from `row[prop]`. The listed props are typically detail-only fields (mark them `inTable:false` so they are not also a column). If `columns` already declares a `{ type: "expand" }` column the content attaches to it (position kept); otherwise the generator prepends one expander column — you do NOT need to add the expander column yourself. This is DISTINCT from `tableOptions.expandConfig` (the vxe `{ accordion }` switch) — never use that for row-expand content.',
    'Tree / hierarchical data ("树形", "部门树", "分类树", "父子层级", "子节点嵌套在父节点下") → the top-level `treeConfig`: `{ childrenField?, expandAll? }` — STATIC trees only. It renders parent/child levels from the nested child array in each row; `row-key` is emitted automatically (the default `rowkey` already covers it), so do NOT add anything for it. Set `childrenField` ONLY when the API nests children under a key other than `children` (e.g. `subItems`); set `expandAll: true` when the NL asks for all nodes expanded by default. Do NOT model lazy/async loading here (out of scope). SAME NAME but DIFFERENT LAYER from `tableOptions.treeConfig` (the vxe-only VxeTreeConfig) — always use the TOP-LEVEL key.',
    'Row merge / grouped rows ("合并单元格", "同一个部门只显示一次", "分组表", "同一类只显示一次") → the top-level `mergeConfig`: `{ rowsBy: [...] }` (a non-empty STRING ARRAY). Each named column is grouped by ADJACENT-EQUAL values: the first row of each run keeps the cell with `rowspan` = run length, the rest are merged away. The `rowsBy` ORDER IS the grouping axis — name the columns in the order the NL lists them. It is cross-renderer declarative DATA: the renderers translate it (el-table `span-method` / a-table column `customCell` / vxe `mergeMethod`), so NEVER hand-write a span function. DISTINCT from the FUNCTIONAL `tableOptions.spanMethod` (an arbitrary JS closure — Tier-3 and NOT cross-renderer): if both are set the explicit `spanMethod` wins and the generator warns. NOTE this is GROUPING, not a tree: rows stay FLAT (adjacent horizontal merge) — for parent/child nesting use the top-level `treeConfig` instead.',
    'Inline row editing ("表格行内编辑", "双击单元格改数量", "点单元格直接改") → THREE parts MUST be given together, all under the vxe engine: (1) `tableOptions.engine: "vxe"`; (2) the table-level switch `tableOptions.editConfig` — `{ trigger?: "click" | "dblclick" | "manual", mode?: "cell" | "row", showStatus?, showUpdateStatus?, showInsertStatus?, autoClear?, enabled? }` (defaults are trigger:"click", mode:"cell"); (3) a per-column `columns[].editRender` on EVERY editable column — `{ name: "$input" | "$select" | "$textarea" | "$date", type? : "default" | "visible", options?: [{label,value}], props?, autofocus?, defaultValue? }` ("$select" wants `options`). A column WITHOUT `editRender` is NOT editable, so `editConfig` alone is a no-op; and BOTH are silently ignored at runtime unless the engine is vxe (the generator warns otherwise). Use the top-level `columns` array to declare those editable columns (it REPLACES the derived table columns, so every table-visible field must appear inside it; the operation column is still auto-appended from `actions`). Editing tracks changes on an internal copy at runtime (keepSource is auto-enabled) — read them via the vxe edit-closed/update API. Function-valued `editRender.events` and custom-registered renderers are OUT OF SCOPE.',
    'Enum / status cells that show a code as a label ("状态列显示成中文", "按状态用不同颜色的标签展示") → put the mapping on the FIELD as `dataOptions` (`{ label, value, tagType? }`): the generator copies it onto the derived table column and all three renderers display the label natively, with `tagType` (primary/success/warning/danger/info) as a TAG COLOUR — no render function, so the config stays pure JSON and still compiles in schema mode. Add `tagType` only where the description asks for colour in the table (a plain label mapping gets no tagType). Two cases stay on `render`: (a) the description explicitly asks for custom rendering ("需要自定义渲染" / "自定义单元格"), or (b) the cell needs more than a value→label map (icons, several fields, links).',
    '',
    'Business logic the declarative schema cannot express must be PRESERVED as a typed extension point, never dropped:',
    '- read-only display logic → `formatter` (an arrow-function source string)',
    '- fully custom TABLE CELL → `render` (a function source string; honored as a scoped slot). A form-control render is NOT deliverable — form items are JSON data — so it is kept as a marked TODO(es-plus) marker and the field falls back to its declared control; for custom FORM behaviour prefer the declarative keys (formItemOptions/attrs/dataOptions/reactions)',
    '- per-field permission gate → `permissionValue` (a permission CODE string, consumed by the host\'s global permission(code) — this is RBAC, NOT a data-driven condition; for "depends on another field\'s value" use `isHidden` when the field merely appears/disappears, or `reactions` when its options / required / disabled / value must change)',
    'Emitting one of these is correct behavior; silently omitting the requirement is a failure.',
    'Host-orchestration keys are NOT part of this schema — do NOT emit them: `on` (a control\'s event bag, e.g. `on: { change: fn }`), `httpRequest` (a custom fetch function), `listenToCallBack` (an external "reload me" subscription), `isInitRun` (the "skip the first auto-request" switch) and `entryQuery` (query params injected on first load). They exist at RUNTIME on the form item / table options (`FormItemOption` / `TableOptions`) and are genuinely consumed there, but the AI schemas are CLOSED: an unknown key is stripped with NO error and NO warning, so emitting one silently loses the requirement. Map the intent onto what the schema CAN say — "this field\'s options / required / disabled / value change with another field" → `reactions`; "the field only appears when …" → `isHidden`; anything that truly needs a callback (a custom request, an imperative reload, a first-run flag) is the HOST\'s job in code after generation: emit the config WITHOUT it rather than inventing a key that will be dropped.',
    '`permissionValue` (RBAC) and i18n `labelKey` are INERT until the HOST APPLICATION\'s entry assembles the plugin — it MUST call `app.use(ESPlus, { permission: (code) => …, t: (key) => … })` (vue2: `Vue.use`); remote `apiParams` likewise needs a global `httpRequest`. Emit the config as usual, and do NOT inline permission checks or `t(...)` calls into fields/columns — the scaffold\'s `main.ts` boilerplate covers the entry side.',
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
