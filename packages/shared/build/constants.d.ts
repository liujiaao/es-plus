export declare const FORM_TYPES: readonly [{
    readonly type: "Input";
    readonly description: "输入框 — 文本/数字/密码输入";
    readonly example: "姓名、手机号、邮箱";
}, {
    readonly type: "Select";
    readonly description: "下拉选择器 — 单选/多选";
    readonly example: "状态、类型、分类";
}, {
    readonly type: "datePicker";
    readonly description: "日期选择器 — 日期/日期范围";
    readonly example: "创建时间、日期范围";
}, {
    readonly type: "timePicker";
    readonly description: "时间选择器 — 时间/时间范围";
    readonly example: "开始时间、结束时间";
}, {
    readonly type: "Slider";
    readonly description: "滑块 — 数值区间选择";
    readonly example: "价格区间、进度";
}, {
    readonly type: "ColorPicker";
    readonly description: "颜色选择器";
    readonly example: "主题色、标签颜色";
}, {
    readonly type: "Transfer";
    readonly description: "穿梭框 — 左右列表选择";
    readonly example: "权限分配、人员分配";
}, {
    readonly type: "Cascader";
    readonly description: "级联选择器 — 多级联动";
    readonly example: "省市区、部门层级";
}, {
    readonly type: "Radio";
    readonly description: "单选框组";
    readonly example: "性别、是否启用";
}, {
    readonly type: "Checkbox";
    readonly description: "多选框组";
    readonly example: "兴趣爱好、功能模块";
}, {
    readonly type: "Switch";
    readonly description: "开关 — 布尔切换";
    readonly example: "启用/禁用、显示/隐藏";
}, {
    readonly type: "Rate";
    readonly description: "评分 — 星级评分";
    readonly example: "满意度、评分";
}, {
    readonly type: "Upload";
    readonly description: "上传 — 文件/图片上传";
    readonly example: "头像、附件、证件照";
}];
export type FormType = typeof FORM_TYPES[number]['type'];
export declare const COMPONENT_LIST: readonly ["EsForm", "EsTable", "useDialog"];
export type ComponentName = typeof COMPONENT_LIST[number];
export declare const PRESET_EXAMPLES: {
    label: string;
    prompt: string;
}[];
//# sourceMappingURL=constants.d.ts.map