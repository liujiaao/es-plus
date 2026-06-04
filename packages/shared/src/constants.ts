export const FORM_TYPES = [
  { type: 'Input', description: '输入框 — 文本/数字/密码输入', example: '姓名、手机号、邮箱' },
  { type: 'Select', description: '下拉选择器 — 单选/多选', example: '状态、类型、分类' },
  { type: 'DatePicker', description: '日期选择器 — 日期/日期范围', example: '创建时间、日期范围' },
  { type: 'TimePicker', description: '时间选择器 — 时间/时间范围', example: '开始时间、结束时间' },
  { type: 'Slider', description: '滑块 — 数值区间选择', example: '价格区间、进度' },
  { type: 'ColorPicker', description: '颜色选择器', example: '主题色、标签颜色' },
  { type: 'Transfer', description: '穿梭框 — 左右列表选择', example: '权限分配、人员分配' },
  { type: 'Cascader', description: '级联选择器 — 多级联动', example: '省市区、部门层级' },
  { type: 'Radio', description: '单选框组', example: '性别、是否启用' },
  { type: 'Checkbox', description: '多选框组', example: '兴趣爱好、功能模块' },
  { type: 'Switch', description: '开关 — 布尔切换', example: '启用/禁用、显示/隐藏' },
  { type: 'Rate', description: '评分 — 星级评分', example: '满意度、评分' },
  { type: 'Upload', description: '上传 — 文件/图片上传', example: '头像、附件、证件照' },
] as const;

export type FormType = typeof FORM_TYPES[number]['type'];

export const COMPONENT_LIST = ['EsForm', 'EsTable', 'useDialog'] as const;
export type ComponentName = typeof COMPONENT_LIST[number];

export const PRESET_EXAMPLES = [
  {
    label: '用户管理',
    prompt: '用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除'
  },
  {
    label: '订单列表',
    prompt: '订单列表，查询订单号、客户名称、日期范围、状态，表格显示订单号、客户、金额、状态、创建时间，支持查看详情和删除'
  },
  {
    label: '商品管理',
    prompt: '商品管理，查询商品名称、分类、状态，表格显示名称、分类、价格、库存、状态，支持新增编辑删除'
  },
  {
    label: '日志查询',
    prompt: '操作日志查询，查询关键词、级别、日期范围，表格显示时间、级别、操作人、内容，只查看不编辑'
  },
  {
    label: '角色权限',
    prompt: '角色管理页面，查询角色名称、状态，表格显示角色名称、描述、状态、创建时间，支持新增编辑删除'
  },
  {
    label: '员工花名册',
    prompt: '员工管理，查询姓名、部门、职位，表格显示姓名、性别、年龄、部门、职位、手机号、状态，支持新增编辑'
  },
  {
    label: '文章管理',
    prompt: '文章管理，查询标题、分类、状态，表格显示标题、分类、创建人、创建时间、状态，支持新增编辑删除'
  },
  {
    label: '系统配置',
    prompt: '系统配置管理，查询名称、类型，表格显示名称、编号、类型、描述、状态，支持新增编辑删除导出'
  },
];

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
