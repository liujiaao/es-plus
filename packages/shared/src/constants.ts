export const FORM_TYPES = [
  { type: 'Input', description: '输入框 — 文本/数字/密码输入', example: '姓名、手机号、邮箱' },
  { type: 'InputNumber', description: '数字输入框 — 数值/金额输入', example: '年龄、价格、库存数量' },
  { type: 'Select', description: '下拉选择器 — 单选/多选', example: '状态、类型、分类' },
  { type: 'DatePicker', description: '日期选择器 — 日期/日期范围', example: '创建时间、日期范围' },
  { type: 'TimePicker', description: '时间选择器 — 时间/时间范围', example: '开始时间、结束时间' },
  { type: 'Slider', description: '滑块 — 数值区间选择', example: '价格区间、进度' },
  { type: 'ColorPicker', description: '颜色选择器', example: '主题色、标签颜色' },
  { type: 'Transfer', description: '穿梭框 — 左右列表选择', example: '权限分配、人员分配' },
  { type: 'Cascader', description: '级联选择器 — 多级联动', example: '省市区、部门层级' },
  { type: 'TreeSelect', description: '树选择器 — 树形数据中选值（可选任意层级）', example: '部门/组织、分类树、权限树' },
  { type: 'Autocomplete', description: '联想输入 — 在选项集里边输边筛（存选项 value）', example: '客户名称、城市、商品' },
  { type: 'Radio', description: '单选框组', example: '性别、是否启用' },
  { type: 'Checkbox', description: '多选框组', example: '兴趣爱好、功能模块' },
  { type: 'Switch', description: '开关 — 布尔切换', example: '启用/禁用、显示/隐藏' },
  { type: 'Rate', description: '评分 — 星级评分', example: '满意度、评分' },
  { type: 'Upload', description: '上传 — 文件/图片上传', example: '头像、附件、证件照' },
] as const;

export type FormType = typeof FORM_TYPES[number]['type'];

export const COMPONENT_LIST = ['EsForm', 'EsTable', 'EsDialog', 'EsCrudPage', 'SvgIcon', 'useDialog'] as const;
export type ComponentName = typeof COMPONENT_LIST[number];

/**
 * FormType 旧写法 → 新写法映射
 * datePicker → DatePicker, timePicker → TimePicker
 */
export const FORM_TYPE_ALIASES: Record<string, string> = {
  datePicker: 'DatePicker',
  timePicker: 'TimePicker',
}

/**
 * 将 FormType 归一化为 PascalCase
 */
export function normalizeFormType(type: string): string {
  return FORM_TYPE_ALIASES[type] ?? type
}
