export const NL_TO_CONFIG_EXAMPLES = [
    {
        label: "Semantic type inference (status/date/avatar)",
        nl: "用户管理页面：查询条件有用户名、手机号、状态（启用/禁用）；表格展示用户名、手机号、头像、注册时间、状态；支持新增、编辑、删除。",
        reasoning: "状态是有限枚举 → Select + 固定 dataOptions；头像是图片 → Upload，且不作查询条件 (inQuery:false)；注册时间是时间 → DatePicker，且系统生成、不出现在表单 (inForm:false)。类型由字段含义推断，而非关键词命中。",
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
        reasoning: "分类选项来自接口而非固定枚举 → 用 apiParams(url/labelField/valueField) 而不是 dataOptions；价格是明细字段不作查询 (inQuery:false)；上架状态是开关 → Switch。",
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
        label: "Table button positioning (code:1 left / code:2 right) + formatter extension point",
        nl: "订单管理：表格上方左侧有“新增订单”按钮，右侧有“批量导出”按钮；表格列有订单号、金额、下单时间；每行有查看、删除操作。",
        reasoning: "“左侧”→ code:1，“右侧”→ code:2（code 是三端唯一同构定位字段，绝不用 position）；金额需格式化显示 → 用 formatter 扩展点表达展示逻辑；行内操作 → operationColumn.btns。",
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
                { name: "新增订单", type: "primary", code: 1, dialogKey: "add" },
                { name: "批量导出", code: 2, actionType: "export" },
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
        reasoning: "“只有管理员能删除”是权限约束 → 用 permissionValue，而不是丢弃需求；“为空显示在职”是条件展示逻辑，声明式 schema 无法直接表达 → 落成 formatter 扩展点（标记而非静默丢弃）。",
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
        label: "Multiple dialogs with different form fields",
        nl: "客户管理：新增和编辑用不同的弹窗表单——新增时填公司名、联系人、电话；编辑时在这些之外还能改信用额度。",
        reasoning: "新增/编辑表单字段不同 → 用 dialogs 分别定义 add / edit 的 formItems；公用字段进 fields，编辑专属的信用额度放进 edit 弹窗的 formItems。",
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
        label: "Explicit target (Ant Design Vue) — config shape is identical across targets",
        nl: "（用 antd）文章管理：查询有标题、分类、发布状态（草稿/已发布）；表格展示标题、分类、发布状态、发布时间；支持增删改查。",
        reasoning: "用户点名 antd → target:'antdv'；配置结构与 vue3/vue2 完全一致，只有 target 不同（多端同构）；发布状态是枚举 → Select。",
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
];
function buildContent() {
    const intro = [
        "# Natural-language → StructuredCrudConfig — few-shot examples",
        "",
        "Use these when constructing the `generate_crud_from_config` input. They show how to REASON from a request to a config — map fields by MEANING, not keywords:",
        "",
        "- Enumerated states (status/type/gender) → `Select` with `dataOptions`, or `apiParams` when options come from an API.",
        "- Dates/times → `DatePicker`/`TimePicker`; images/files → `Upload`; on/off → `Switch`.",
        "- System-generated columns (createdAt, id) → `inForm:false`; detail-only fields → `inQuery:false`.",
        "- Button placement: “left” → `code:1`, “right” → `code:2` (never emit `position`).",
        "- Requirements the schema can't express (permission gating, conditional display, computed values) → typed extension points (`permissionValue`, `formatter`, `render`) — mark them, don't drop them.",
        "- `target` is the ONLY thing that changes between vue3 / vue2 / antdv; the config shape is identical (多端同构).",
        "",
        "---",
        "",
    ].join("\n");
    const blocks = NL_TO_CONFIG_EXAMPLES.map((ex) => [
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
    ].join("\n"));
    return intro + blocks.join("\n");
}
export function registerNlToConfigExamplesResource(server) {
    const uri = "esplus://examples/nl-to-config";
    server.resource("examples-nl-to-config", uri, {
        description: "Few-shot natural-language → StructuredCrudConfig examples with reasoning. Read this before calling generate_crud_from_config — it teaches semantic field mapping (not keyword matching) and how to handle business logic via extension points.",
        mimeType: "text/markdown",
    }, async () => ({
        contents: [{ uri, mimeType: "text/markdown", text: buildContent() }],
    }));
}
//# sourceMappingURL=nl-to-config-examples.js.map