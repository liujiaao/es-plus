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

export const VALID_CRUD_ACTIONS = ['add', 'edit', 'delete', 'view', 'export'] as const
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
