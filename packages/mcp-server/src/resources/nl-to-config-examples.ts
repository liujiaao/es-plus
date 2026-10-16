import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StructuredCrudConfigInput } from "@es-plus/shared";

/**
 * Curated few-shot NL → StructuredCrudConfig pairs.
 *
 * These REPLACE keyword tables as the primary steering signal for NL→config.
 * The host LLM reads these examples plus the field-level `.describe()` guidance
 * baked into the generate_crud_from_config input schema, then reasons about the
 * user's request semantically — it is not limited by any keyword's coverage.
 *
 * Each example is a real, schema-valid config; nl-to-config-examples.spec.ts
 * validates every one against the authoritative StructuredCrudConfigSchema so
 * they can never silently rot into invalid guidance.
 */
export interface NlToConfigExample {
  label: string;
  /** The natural-language request a user might give. */
  nl: string;
  /** Why the config maps the way it does — the reasoning we want the LLM to imitate. */
  reasoning: string;
  config: StructuredCrudConfigInput;
}

export const NL_TO_CONFIG_EXAMPLES: NlToConfigExample[] = [
  {
    label: "Semantic type inference (status/date/avatar)",
    nl: "用户管理页面：查询条件有用户名、手机号、状态（启用/禁用）；表格展示用户名、手机号、头像、注册时间、状态；支持新增、编辑、删除。",
    reasoning:
      "状态是有限枚举 → Select + 固定 dataOptions；头像是图片 → Upload，且不作查询条件 (inQuery:false)；注册时间是时间 → DatePicker，且系统生成、不出现在表单 (inForm:false)。类型由字段含义推断，而非关键词命中。",
    config: {
      name: "UserManage",
      apiUrl: "/api/users",
      fields: [
        { prop: "username", label: "用户名", formtype: "Input" },
        { prop: "phone", label: "手机号", formtype: "Input" },
        {
          prop: "status",
          label: "状态",
          formtype: "Select",
          dataOptions: [
            { label: "启用", value: 1 },
            { label: "禁用", value: 0 },
          ],
        },
        { prop: "avatar", label: "头像", formtype: "Upload", inQuery: false },
        { prop: "createdAt", label: "注册时间", formtype: "DatePicker", inForm: false },
      ],
      actions: ["add", "edit", "delete"],
    },
  },
  {
    label: "Remote dropdown via apiParams (not dataOptions)",
    nl: "商品列表：查询有商品名、所属分类（分类下拉数据来自 /api/categories 接口）；表格展示商品名、分类、价格、上架状态；支持新增、编辑、删除、导出。",
    reasoning:
      "分类选项来自接口而非固定枚举 → 用 apiParams(url/labelField/valueField) 而不是 dataOptions；价格是明细字段不作查询 (inQuery:false)；上架状态是开关 → Switch。",
    config: {
      name: "ProductManage",
      apiUrl: "/api/products",
      fields: [
        { prop: "name", label: "商品名", formtype: "Input" },
        {
          prop: "categoryId",
          label: "所属分类",
          formtype: "Select",
          apiParams: { url: "/api/categories", labelField: "name", valueField: "id" },
        },
        { prop: "price", label: "价格", formtype: "Input", inQuery: false },
        { prop: "onSale", label: "上架状态", formtype: "Switch", inQuery: false },
      ],
      actions: ["add", "edit", "delete", "export"],
    },
  },
  {
    label: "Table button positioning (position:'left' / position:'right') + formatter extension point",
    nl: "订单管理：表格上方左侧有“新增订单”按钮，右侧有“批量导出”按钮；表格列有订单号、金额、下单时间；每行有查看、删除操作。",
    reasoning:
      "“左侧”→ position:'left'，“右侧”→ position:'right'（position 是三端共同推荐、自解释的定位字段；legacy code:1/2 仍被接受，但新配置不要写）；金额需格式化显示 → 用 formatter 扩展点表达展示逻辑；行内操作 → operationColumn.btns。",
    config: {
      name: "OrderManage",
      apiUrl: "/api/orders",
      fields: [
        { prop: "orderNo", label: "订单号", formtype: "Input" },
        {
          prop: "amount",
          label: "金额",
          formtype: "Input",
          inQuery: false,
          formatter: "(row) => `¥${Number(row.amount).toFixed(2)}`",
        },
        { prop: "createdAt", label: "下单时间", formtype: "DatePicker", inForm: false },
      ],
      actions: ["add", "delete", "view"],
      tableBtns: [
        { name: "新增订单", type: "primary", position: "left", dialogKey: "add" },
        { name: "批量导出", position: "right", actionType: "export" },
      ],
      operationColumn: {
        label: "操作",
        btns: [
          { name: "查看", dialogKey: "view" },
          { name: "删除", confirm: "确定删除该订单吗？" },
        ],
      },
    },
  },
  {
    label: "Business logic → typed extension points (permission + conditional display)",
    nl: "员工管理：只有管理员（权限码 employee:delete）能看到“删除”按钮；“离职日期”这一列如果为空显示“在职”，否则显示日期。",
    reasoning:
      "“只有管理员能删除”是权限约束 → 用 permissionValue，而不是丢弃需求；“为空显示在职”是条件展示逻辑，声明式 schema 无法直接表达 → 落成 formatter 扩展点（标记而非静默丢弃）。",
    config: {
      name: "EmployeeManage",
      apiUrl: "/api/employees",
      fields: [
        { prop: "name", label: "姓名", formtype: "Input" },
        { prop: "department", label: "部门", formtype: "Input" },
        {
          prop: "leaveDate",
          label: "离职日期",
          formtype: "DatePicker",
          inQuery: false,
          formatter: "(row) => row.leaveDate ? row.leaveDate : '在职'",
        },
      ],
      actions: ["add", "edit", "delete"],
      operationColumn: {
        label: "操作",
        btns: [
          { name: "编辑", dialogKey: "edit" },
          { name: "删除", confirm: "确定删除?", permissionValue: "employee:delete" },
        ],
      },
    },
  },
  {
    label: "Conditional field visibility → declarative isHidden (plain JSON, no code)",
    nl: "退款管理：查询退款单号；表格展示退款单号、订单号、退款金额、退款类型、退款原因；支持新增、编辑、删除。表单里「退款原因」只在退款类型为「部分退款」时才显示。",
    reasoning:
      "表单字段随另一字段的值显隐 → 用字段级 isHidden（纯 JSON 条件，条件成立即隐藏），NOT formatter/render。注意它是**反相**的：「只在退款类型=部分退款时显示」= 在退款类型 ≠ 部分退款时隐藏，故写 op:'ne'。它是**表单作用域**（查询表单 + 新增/编辑弹窗），不是表格列。op 省略时默认 eq。退款方式是有限枚举 → Select + dataOptions。",
    config: {
      name: "RefundManage",
      apiUrl: "/api/refunds",
      fields: [
        { prop: "refundNo", label: "退款单号", formtype: "Input" },
        { prop: "orderNo", label: "订单号", formtype: "Input" },
        { prop: "refundAmount", label: "退款金额", formtype: "InputNumber" },
        {
          prop: "refundType",
          label: "退款类型",
          formtype: "Select",
          inQuery: false,
          dataOptions: [
            { label: "全额退款", value: "full" },
            { label: "部分退款", value: "part" },
          ],
        },
        {
          prop: "refundReason",
          label: "退款原因",
          formtype: "Input",
          inQuery: false,
          isHidden: { field: "refundType", op: "ne", value: "part" },
        },
      ],
      actions: ["add", "edit", "delete"],
    },
  },
  {
    label: "Field linkage → declarative reactions (plain JSON, no code)",
    nl: "地区管理：查询省份；表格展示省份、城市、所属大区；支持新增、编辑。新增时城市下拉随省份变化（浙江→杭州、宁波；江苏→南京）；只有填了城市，发票号才必填；所属大区自动等于所选省份且不可手改。",
    reasoning:
      "「城市下拉随省份变化」→ city 的 options 依赖 province，用 city.reactions：选项是**字面量数组**（DSL 禁对象字面量），故按省份分支写成**多条规则**，各带自己的 when（province=zj / province=js）。「只有填了城市发票号才必填」→ invoiceNo.reactions 的 fulfill.required 是表达式 { notEmpty: [{ var: 'city' }] }。「大区自动等于省份、不可手改」→ region.reactions 的 fulfill 同时给 value:{ var:'province' }（回写 model，故 dependencies 必填）与 disabled:{ truthy:[{var:'province'}] }。全是纯 JSON，绝无 JS 回调；都是**表单作用域**（查询/新增/编辑），不是表格列。",
    config: {
      name: "RegionManage",
      apiUrl: "/api/regions",
      fields: [
        { prop: "province", label: "省份", formtype: "Select", dataOptions: [
          { label: "浙江", value: "zj" }, { label: "江苏", value: "js" },
        ] },
        {
          prop: "city",
          label: "城市",
          formtype: "Select",
          inQuery: false,
          reactions: [
            { dependencies: ["province"], when: { "==": [{ var: "province" }, "zj"] },
              fulfill: { dataOptions: [{ label: "杭州", value: "hz" }, { label: "宁波", value: "nb" }] } },
            { dependencies: ["province"], when: { "==": [{ var: "province" }, "js"] },
              fulfill: { dataOptions: [{ label: "南京", value: "nj" }] } },
          ],
        },
        {
          prop: "invoiceNo",
          label: "发票号",
          formtype: "Input",
          inQuery: false,
          reactions: [{ dependencies: ["city"], fulfill: { required: { notEmpty: [{ var: "city" }] } } }],
        },
        {
          prop: "region",
          label: "所属大区",
          formtype: "Input",
          inQuery: false,
          reactions: [{ dependencies: ["province"], fulfill: {
            value: { var: "province" },
            disabled: { truthy: [{ var: "province" }] },
          } }],
        },
      ],
      actions: ["add", "edit", "delete"],
    },
  },
  {
    label: "Multiple dialogs with different form fields",
    nl: "客户管理：新增和编辑用不同的弹窗表单——新增时填公司名、联系人、电话；编辑时在这些之外还能改信用额度。",
    reasoning:
      "新增/编辑表单字段不同 → 用 dialogs 分别定义 add / edit 的 formItems；公用字段进 fields，编辑专属的信用额度放进 edit 弹窗的 formItems。",
    config: {
      name: "CustomerManage",
      apiUrl: "/api/customers",
      fields: [
        { prop: "company", label: "公司名", formtype: "Input" },
        { prop: "contact", label: "联系人", formtype: "Input" },
        { prop: "phone", label: "电话", formtype: "Input" },
      ],
      actions: ["add", "edit", "delete"],
      dialogs: {
        add: {
          title: "新增客户",
          formItems: [
            { prop: "company", label: "公司名", formtype: "Input" },
            { prop: "contact", label: "联系人", formtype: "Input" },
            { prop: "phone", label: "电话", formtype: "Input" },
          ],
        },
        edit: {
          title: "编辑客户",
          formItems: [
            { prop: "company", label: "公司名", formtype: "Input" },
            { prop: "contact", label: "联系人", formtype: "Input" },
            { prop: "phone", label: "电话", formtype: "Input" },
            { prop: "creditLimit", label: "信用额度", formtype: "Input" },
          ],
        },
      },
    },
  },
  {
    label:
      "Dialog base keys (showClose / closeOnClickModal / closeOnPressEscape) + declarative footer buttons (configBtn)",
    nl: "合同管理：查询条件有合同编号、签约方；表格展示合同编号、签约方、签约金额、签约日期。新增合同要填这几项，但提交后直接进审批流——弹窗不要右上角的关闭按钮，点遮罩、按 ESC 都不许关（避免误触丢掉已填内容）；底部只保留“提交审批”和“取消”。行内保留编辑、删除。",
    reasoning:
      "“不要关闭按钮 / 点遮罩不关 / ESC 不关”是弹窗的**底座数据键**，值都是平面布尔，直接写进 dialogs.add：showClose:false、closeOnClickModal:false、closeOnPressEscape:false（三端同名同义；同类还有 width / isDraggable / maxHeight / fullscreen / hiddenFullBtn / appendTo / cacheKey）。" +
      "“底部只有提交审批 + 取消”是声明式底栏 → configBtn 数组：action:'confirm' 的按钮由运行时装配成「先校验表单、再走该弹窗的提交路径」，action:'cancel' 装配成「关闭并抛 dialog-cancel」，全程不写 click 函数；configBtn 是**替换**默认底栏，不写它才会得到自动生成的「取消 + 确定」。" +
      "**关键**：`dialogs` **不**改变按钮派生——工具栏与操作列照旧由 actions 派生（`actions:[\"add\",…]` 自带「新增」入口，弹窗因此点得开），把按钮面交出去的只有显式声明 `toolbarBtns` 与/或 `operationColumn`。这里之所以两个都显式写，是为了拿到自定义按钮文案（「新增合同」而非派生的「新增」）；一旦显式声明，每个弹窗都必须有按钮能打开它（入口按钮写 `dialogKey`），否则该弹窗成了死胡同。",
    config: {
      name: "ContractManage",
      apiUrl: "/api/contracts",
      fields: [
        { prop: "contractNo", label: "合同编号", formtype: "Input" },
        { prop: "party", label: "签约方", formtype: "Input" },
        { prop: "amount", label: "签约金额", formtype: "InputNumber", inQuery: false },
        { prop: "signDate", label: "签约日期", formtype: "DatePicker", inQuery: false },
      ],
      actions: ["add", "edit", "delete"],
      toolbarBtns: [{ name: "新增合同", key: "add", type: "primary", dialogKey: "add" }],
      operationColumn: {
        label: "操作",
        btns: [
          { name: "编辑", key: "edit", dialogKey: "edit" },
          { name: "删除", key: "delete", confirm: "确定删除该合同吗？" },
        ],
      },
      dialogs: {
        add: {
          title: "新增合同",
          width: "720px",
          // 底座数据键：防止误触关窗丢内容（三个键都是平面布尔，直接进 JSON）
          showClose: false,
          closeOnClickModal: false,
          closeOnPressEscape: false,
          formItems: [
            { prop: "contractNo", label: "合同编号", formtype: "Input" },
            { prop: "party", label: "签约方", formtype: "Input" },
            { prop: "amount", label: "签约金额", formtype: "InputNumber" },
            { prop: "signDate", label: "签约日期", formtype: "DatePicker" },
          ],
          // 声明式底栏：click 由运行时按 action 装配
          configBtn: [
            { name: "提交审批", type: "primary", action: "confirm" },
            { name: "取消", action: "cancel" },
          ],
        },
        edit: {
          title: "编辑合同",
          formItems: [
            { prop: "contractNo", label: "合同编号", formtype: "Input" },
            { prop: "party", label: "签约方", formtype: "Input" },
            { prop: "amount", label: "签约金额", formtype: "InputNumber" },
            { prop: "signDate", label: "签约日期", formtype: "DatePicker" },
          ],
        },
      },
    },
  },
  {
    label: "Explicit target (Ant Design Vue) — config shape is identical across targets",
    nl: "（用 antd）文章管理：查询有标题、分类、发布状态（草稿/已发布）；表格展示标题、分类、发布状态、发布时间；支持增删改查。",
    reasoning:
      "用户点名 antd → target:'antdv'；配置结构与 vue3/vue2 完全一致，只有 target 不同（多端同构）；发布状态是枚举 → Select。",
    config: {
      name: "ArticleManage",
      apiUrl: "/api/articles",
      target: "antdv",
      fields: [
        { prop: "title", label: "标题", formtype: "Input" },
        { prop: "category", label: "分类", formtype: "Input" },
        {
          prop: "status",
          label: "发布状态",
          formtype: "Select",
          dataOptions: [
            { label: "草稿", value: "draft" },
            { label: "已发布", value: "published" },
          ],
        },
        { prop: "publishedAt", label: "发布时间", formtype: "DatePicker", inForm: false },
      ],
      actions: ["add", "edit", "delete", "view"],
    },
  },
  {
    label: "Multi-level group headers + non-field columns → top-level `columns` escape array",
    nl: "考勤管理：查询条件有员工姓名和部门；表格第一列是序号列，随后用两级分组表头展示——「员工」下分员工姓名、部门，「考勤」下分出勤天数、迟到次数；支持新增、编辑、删除。",
    reasoning:
      "NL 要「序号列」+「两级分组表头」，扁平的 fields 表达不了（非字段列没有 prop/label，多级表头要嵌套）→ 用顶层 columns 逃生数组。`{ type: 'index' }` 是序号列；分组表头写 `{ label: '员工', groups: [ …子列… ] }`（跨端安全上限 2 级）。columns 一旦给出就**整体覆盖**派生列（override 非 merge）→ 每个要在表格出现的字段都得写进 columns（这里四个字段都进了 groups）。fields 仍驱动查询表单与新增/编辑表单。操作列**不**写进 columns —— 它仍由 actions 自动追加。",
    config: {
      name: "AttendanceManage",
      apiUrl: "/api/attendance",
      fields: [
        { prop: "employeeName", label: "员工姓名", formtype: "Input" },
        { prop: "department", label: "部门", formtype: "Input" },
        { prop: "attendDays", label: "出勤天数", formtype: "InputNumber", inQuery: false },
        { prop: "lateCount", label: "迟到次数", formtype: "InputNumber", inQuery: false },
      ],
      columns: [
        { type: "index", label: "序号", width: 60 },
        {
          label: "员工",
          groups: [
            { prop: "employeeName", label: "员工姓名" },
            { prop: "department", label: "部门" },
          ],
        },
        {
          label: "考勤",
          groups: [
            { prop: "attendDays", label: "出勤天数" },
            { prop: "lateCount", label: "迟到次数" },
          ],
        },
      ],
      actions: ["add", "edit", "delete"],
    },
  },
  {
    label: "Row-expand content → top-level `expandConfig` (declarative detail list)",
    nl: "订单管理：查询条件有订单号；表格展示订单号、金额、下单时间；每行可展开查看收货人、联系电话、收货地址；支持新增、删除。",
    reasoning:
      "NL 要「每行可展开查看…」——这是声明式**行展开内容**，用顶层 `expandConfig`（不是 `tableOptions.expandConfig` —— 那是 vxe 的 accordion 开关，与内容无关）。展开的三个字段是明细信息、不单独成列，故标 `inTable:false`（仍留在 fields 里供新增/编辑表单用）。这里没给 `columns`，生成器会自动前置一个展开列，无需自己写 `{type:'expand'}`（若 columns 里已声明 {type:'expand'}，内容就挂到它上面、保持位置）。`expandConfig.fields` 的顺序即展开区展示顺序。",
    config: {
      name: "OrderExpandManage",
      apiUrl: "/api/orders",
      fields: [
        { prop: "orderNo", label: "订单号", formtype: "Input" },
        { prop: "amount", label: "金额", formtype: "InputNumber", inQuery: false },
        { prop: "createdAt", label: "下单时间", formtype: "DatePicker", inForm: false },
        { prop: "receiver", label: "收货人", formtype: "Input", inTable: false, inQuery: false },
        { prop: "phone", label: "联系电话", formtype: "Input", inTable: false, inQuery: false },
        { prop: "address", label: "收货地址", formtype: "Input", inTable: false, inQuery: false },
      ],
      expandConfig: {
        title: "收货信息",
        fields: [
          { prop: "receiver", label: "收货人" },
          { prop: "phone", label: "联系电话" },
          { prop: "address", label: "收货地址" },
        ],
      },
      actions: ["add", "delete"],
    },
  },
  {
    label: "Tree / hierarchical rows → top-level `treeConfig`",
    nl: "部门管理：查询条件有部门名称；表格展示部门名称、负责人、状态、创建时间；部门是树形结构，子部门嵌套在父部门下面，默认全部展开。",
    reasoning:
      "NL 说「树形结构 / 子部门嵌套在父部门下」→ 顶层 `treeConfig`（声明式树表）。行数据层级键名是缺省的 `children`，故省略 `childrenField`；「默认全部展开」→ `expandAll: true`。`row-key` 由生成器自动发射（rowkey 默认 'id'），无需手写。没有分组表头/非字段列，不用 `columns`。treeConfig 是纯 JSON 声明式数据（非扩展点），且**区别于** `tableOptions.treeConfig`（vxe 专有的 VxeTreeConfig）——用顶层这个。懒加载/异步 load 不在本键范围。",
    config: {
      name: "DepartmentTreeManage",
      apiUrl: "/api/departments",
      fields: [
        { prop: "deptName", label: "部门名称", formtype: "Input" },
        { prop: "leader", label: "负责人", formtype: "Input" },
        {
          prop: "status",
          label: "状态",
          formtype: "Select",
          dataOptions: [
            { label: "启用", value: 1 },
            { label: "禁用", value: 0 },
          ],
        },
        { prop: "createdAt", label: "创建时间", formtype: "DatePicker", inForm: false },
      ],
      treeConfig: { expandAll: true },
      actions: ["add", "edit", "delete"],
    },
  },
  {
    label: "Row merge / grouped rows → top-level `mergeConfig`",
    nl: "员工台账：查询条件有姓名；表格展示部门、小组、姓名、职位；同一个部门的行把「部门」合并显示一次，同一个小组把「小组」合并显示一次；支持新增、编辑。",
    reasoning:
      "NL 说「同一个部门的行合并显示一次 / 合并单元格 / 分组表」→ 顶层 `mergeConfig`（声明式行合并，纯 JSON 数据、非扩展点）：`{ rowsBy: ['dept', 'team'] }`（数组非空）。语义是**相邻相等**分组：被点名的列按值切段，每段首行保留单元格且 `rowspan` = 段长，其余格被合并掉。`rowsBy` 的**顺序即分组轴**（先按部门、再按小组），照请求里点名的列序写。这是跨端声明式窄子集——生成器会把它翻成三端各自的机制（el-table `span-method` / a-table 列级 `customCell` / vxe `mergeMethod`），**绝不手写 span 函数**。**区别于**函数式 `tableOptions.spanMethod`（任意 JS 闭包，Tier-3、非跨端；两者并存时显式 spanMethod 胜出且生成器告警）。\n\n注意这是**分组**不是**树**：行仍是平铺（横向相邻合并），不是父子嵌套——「树形结构/子部门嵌套」用顶层 `treeConfig`，别混。",
    config: {
      name: "StaffMergeManage",
      apiUrl: "/api/staff",
      fields: [
        { prop: "dept", label: "部门", formtype: "Input", inForm: false },
        { prop: "team", label: "小组", formtype: "Input", inForm: false },
        { prop: "name", label: "姓名", formtype: "Input" },
        { prop: "role", label: "职位", formtype: "Input", inQuery: false },
      ],
      mergeConfig: { rowsBy: ["dept", "team"] },
      actions: ["add", "edit"],
    },
  },
  {
    label: "Inline row editing → `tableOptions.editConfig` + `columns[].editRender` (vxe engine)",
    nl: "商品价格维护：查询条件有商品名称；表格支持行内编辑，单击单元格修改价格；表格展示商品名称、价格、库存；支持编辑。",
    reasoning:
      "NL 说「表格支持行内编辑，单击单元格修改」→ 行内编辑三件套必须同给：(1) `tableOptions.engine: 'vxe'`；(2) 表级开关 `tableOptions.editConfig`（单击进入 → trigger 缺省即 'click'，单格编辑 → mode 缺省即 'cell'，显式写 `{ mode: 'cell' }` 更清楚）；(3) 每个可编辑列的 `columns[].editRender`（没有它该列永不可编辑，editConfig 就是空转）。价格/库存都是数值 → 编辑器用 `$input` + `props.type:'number'`。`columns` 是**覆盖**派生的整表列数组，故表里要展示的列都要写进来；操作列仍由 `actions` 自动追加，不写。editConfig/editRender 仅 vxe 生效。",
    config: {
      name: "SkuPriceEditManage",
      apiUrl: "/api/sku",
      fields: [
        { prop: "skuName", label: "商品名称", formtype: "Input" },
        { prop: "price", label: "价格", formtype: "InputNumber", inQuery: false },
        { prop: "stock", label: "库存", formtype: "InputNumber", inQuery: false },
      ],
      tableOptions: { engine: "vxe", editConfig: { mode: "cell" } },
      columns: [
        { prop: "skuName", label: "商品名称", editRender: { name: "$input" } },
        { prop: "price", label: "价格", editRender: { name: "$input", props: { type: "number" } } },
        { prop: "stock", label: "库存", editRender: { name: "$input", props: { type: "number" } } },
      ],
      actions: ["edit"],
    },
  },
];

function buildContent(): string {
  const intro = [
    "# Natural-language → StructuredCrudConfig — few-shot examples",
    "",
    "Use these when constructing the `generate_crud_from_config` input. They show how to REASON from a request to a config — map fields by MEANING, not keywords:",
    "",
    "- Enumerated states (status/type/gender) → `Select` with `dataOptions`, or `apiParams` when options come from an API.",
    "- Dates/times → `DatePicker`/`TimePicker`; images/files → `Upload`; on/off → `Switch`.",
    "- System-generated columns (createdAt, id) → `inForm:false`; detail-only fields → `inQuery:false`.",
    "- Button placement: \"left\" → `position:'left'`, \"right\" → `position:'right'` (`code:1`/`code:2` is the legacy alias — still accepted, but prefer `position`).",
    "- Form-scope conditional visibility (\"field X shows only when Y is Z\", \"只在…时才填写\") → the field-level `isHidden` — a PLAIN JSON condition (never a JS string), `{ field, op?, value? }` or an array (AND), hidden while it holds. When a plain condition can't express it (OR / ordering / nested NOT), use a JSON expression instead, e.g. `{ or: [ { \"==\": [{ var: \"status\" }, \"pending\"] }, { \">\": [{ var: \"amount\" }, 100] } ] }`. Applies to the query/add/edit forms, NOT the table column.",
    "- Field linkage / computed (\"城市下拉随省份变化\", \"只有填了城市发票号才必填\", \"所属大区自动等于所选省份\") → the field-level `reactions` — a PLAIN JSON array of rules, NEVER a JS callback. Each rule is `{ dependencies?, when?, fulfill }`: `dependencies` = model paths that re-trigger it (REQUIRED when `fulfill.value` is present); `when` = optional gate expression (rule applies while truthy); `fulfill` = `{ dataOptions?, required?, disabled?, value? }` where `dataOptions` is a **LITERAL** option array and `required`/`disabled`/`value` are expression nodes (same DSL as `isHidden`) returning a boolean or the field's new value. Because the DSL forbids object literals, express option branching as ONE rule per case, each with its own `when` (e.g. `when: { \"==\": [{ var: \"province\" }, \"zj\"] }`). `value` is written back to the model. Use `isHidden` when the field merely appears/disappears; use `reactions` when its options / required / disabled / value must change. Applies to the query/add/edit forms, NOT the table column.",
    "- Multi-level group headers (\"分组表头\") and non-field columns (序号/勾选/展开列) → the top-level `columns` escape array (aligned with the renderer `TableColumn`): a group is `{ label, groups: [ … ] }` (2 levels max cross-renderer), a non-field column is `{ type: 'index' | 'selection' | 'expand' }`. `columns` REPLACES the derived table columns (override, not merge) — every field shown in the table must appear inside it; `fields` still drives the query/add/edit forms. The operation column is auto-appended from `actions`, so don't add it here.",
    "- Row-expand content (\"每行可展开查看…\") → the top-level `expandConfig`: `{ title?, fields: [ { prop, label? } ] }` (non-empty). Presence makes the table render ONE row-expander showing a read-only `label: value` list from `row[prop]` (usually detail-only fields, marked `inTable:false`). If `columns` already declares a `{ type: 'expand' }` column the content attaches there; otherwise the generator prepends one — don't add the expander column yourself. DISTINCT from `tableOptions.expandConfig` (the vxe `{ accordion }` switch) — never use that for row-expand content.",
    "- Tree / hierarchical rows (\"树形\", \"部门树\", \"分类树\", \"父子层级\", \"子节点嵌套在父节点下\") → the top-level `treeConfig`: `{ childrenField?, expandAll? }` — STATIC trees only. Renders parent/child levels from the nested child array in each row; `row-key` is emitted automatically. Set `childrenField` only when children nest under a key other than `children`; set `expandAll: true` to expand every node by default. Not for lazy/async loading. DISTINCT from `tableOptions.treeConfig` (the vxe-only VxeTreeConfig) — always use the top-level key.",
    "- Declarative row merge (\"合并单元格\", \"相同的部门只显示一次\", \"分组表\", \"同一类只显示一次\") → the top-level `mergeConfig`: `{ rowsBy: ['dept', 'team'] }` (non-empty). Each named column is grouped by ADJACENT-EQUAL values: the first row of a run keeps the cell with `rowspan` = run length, the rest are merged away. `rowsBy` order IS the grouping axis — keep the columns in the order the request names them. Cross-renderer (el-table `span-method` / a-table column `customCell` / vxe `mergeMethod`) — the generator consumes it, you do NOT write a span method. DISTINCT from the FUNCTIONAL `tableOptions.spanMethod` (an arbitrary JS closure — Tier-3 and NOT cross-renderer): if both are set the explicit `spanMethod` wins and the generator warns.",
    "- Inline row editing (\"表格行内编辑\", \"双击单元格改数量\", \"点单元格直接改\") → THREE parts, all under the vxe engine: `tableOptions.engine: 'vxe'`; the table-level switch `tableOptions.editConfig` (`{ trigger?: 'click' | 'dblclick' | 'manual', mode?: 'cell' | 'row', showStatus?, showUpdateStatus?, showInsertStatus?, autoClear?, enabled? }`, defaults trigger:'click' / mode:'cell'); and a per-column `columns[].editRender` on EVERY editable column (`{ name: '$input' | '$select' | '$textarea' | '$date', type?, options?, props?, autofocus?, defaultValue? }`, `$select` wants `options`). A column without `editRender` is NOT editable — `editConfig` alone is a no-op — and both are silently ignored unless the engine is vxe. Declare the editable columns via the top-level `columns` array (it REPLACES the derived columns; the operation column is still auto-appended). Function-valued `editRender.events` and custom renderers are out of scope.",
    "- Requirements the schema can't express (permission gating, computed table-cell values) → typed extension points (`permissionValue`, `formatter`, `render`) — mark them, don't drop them. (`isHidden` and `reactions` above are declarative data, NOT extension points — they cover field visibility and field linkage/computed; don't reach for formatter/render for those.)",
    "- Host-orchestration keys are NOT part of this schema — do NOT emit `on` (a control's event bag, `{ change: fn }`), `httpRequest` (custom fetch fn), `listenToCallBack` (external reload subscription), `isInitRun` (skip the first auto-request), or `entryQuery` (params injected on first load). They exist at RUNTIME on `FormItemOption`/`TableOptions` and are truly consumed there, but the AI schemas are CLOSED: an unknown key is stripped with NO error and NO warning, so emitting one silently loses the requirement. Say it declaratively instead: \"options / required / disabled / value follow another field\" → `reactions`; \"the field only appears when …\" → `isHidden`; a real callback (custom request / imperative reload / first-run flag) is the HOST's job in code after generation — emit the config without it.",
    "- Cross-file prerequisite (permission gating / i18n): `permissionValue` (field/column/button RBAC) and i18n `labelKey` are INERT until the HOST APP ENTRY assembles the plugin — `app.use(ESPlus, { permission: (code) => …, t: (key) => … })` on vue3/antdv, `Vue.use(ESPlus, {...})` on vue2 — and remote `apiParams` needs a global `httpRequest`. Emit the config as usual; never inline permission checks or `t(...)` calls into fields/columns (the entry side is the host's job). `scaffold_page` returns a ready-to-copy `src/main.ts` (vue2: `src/main.js`) assembly boilerplate covering all three.",
    "- `target` is the ONLY thing that changes between vue3 / vue2 / antdv; the config shape is identical (多端同构).",
    "",
    "---",
    "",
  ].join("\n");

  const blocks = NL_TO_CONFIG_EXAMPLES.map((ex) =>
    [
      `## ${ex.label}`,
      "",
      `**Request:** ${ex.nl}`,
      "",
      `**Reasoning:** ${ex.reasoning}`,
      "",
      "**Config:**",
      "",
      "```json",
      JSON.stringify(ex.config, null, 2),
      "```",
      "",
    ].join("\n")
  );

  return intro + blocks.join("\n");
}

export function registerNlToConfigExamplesResource(server: McpServer) {
  const uri = "esplus://examples/nl-to-config";
  server.resource(
    "examples-nl-to-config",
    uri,
    {
      description:
        "Few-shot natural-language → StructuredCrudConfig examples with reasoning. Read this before calling generate_crud_from_config — it teaches semantic field mapping (not keyword matching) and how to handle business logic via extension points.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{ uri, mimeType: "text/markdown", text: buildContent() }],
    })
  );
}
