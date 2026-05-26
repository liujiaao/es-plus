export const VALID_FORM_TYPES = [
  'Input', 'Select', 'datePicker', 'timePicker', 'Slider', 'ColorPicker',
  'Transfer', 'Cascader', 'Radio', 'Checkbox', 'Switch', 'Rate', 'Upload'
] as const

export type FormType = typeof VALID_FORM_TYPES[number]

export const SPECIAL_BTN_KEYS = {
  QUERY: 'query',
  RESET: 'rest',
} as const

export const BUILT_IN_BTN_KEYS = ['query', 'rest', 'add', 'export', 'import'] as const

export const OPERATION_COLUMN_PROP_SFC = 'operate'

export const OPERATION_COLUMN_PROP_CRUD_PAGE = 'action'

export const VALID_CRUD_ACTIONS = ['add', 'edit', 'delete', 'view', 'export', 'import'] as const
export type CrudAction = typeof VALID_CRUD_ACTIONS[number]

export const DEFAULT_CONFIG_TABLE_OUT = {
  total: 'total',
  tableData: 'data',
  pageSize: 'pageSize',
  current: 'pageIndex'
} as const

export const CRUD_PAGE_BTN_CLICK_KEYS = {
  ADD_CONFIRM: 'add-confirm',
  EDIT_CONFIRM: 'edit-confirm',
} as const

export const CRUD_PAGE_DIALOG_KEYS = {
  ADD: 'add',
  EDIT: 'edit',
  VIEW: 'view',
} as const

export const DEFAULT_TOOLBAR_BTNS = {
  ADD: { name: '新增', type: 'primary', key: 'add', icon: 'Plus', dialogKey: 'add' },
  EXPORT: { name: '导出', key: 'export', icon: 'Download', actionType: 'export' },
  IMPORT: { name: '导入', key: 'import', icon: 'Upload', actionType: 'import' },
} as const

export const DEFAULT_ROW_BTNS = {
  VIEW: { name: '查看', type: 'primary', key: 'view', dialogKey: 'view' },
  EDIT: { name: '编辑', type: 'primary', key: 'edit', dialogKey: 'edit' },
  DELETE: { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该条数据吗？' },
} as const
