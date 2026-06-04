export const VALID_FORM_TYPES = [
    'Input', 'Select', 'DatePicker', 'TimePicker', 'Slider', 'ColorPicker',
    'Transfer', 'Cascader', 'Radio', 'Checkbox', 'Switch', 'Rate', 'Upload'
];
/**
 * FormType 旧写法 → 新写法映射
 * datePicker → DatePicker, timePicker → TimePicker
 */
export const FORM_TYPE_ALIASES = {
    datePicker: 'DatePicker',
    timePicker: 'TimePicker',
};
/**
 * 将 FormType 归一化为 PascalCase
 */
export function normalizeFormType(type) {
    return FORM_TYPE_ALIASES[type] ?? type;
}
export const SPECIAL_BTN_KEYS = {
    QUERY: 'query',
    RESET: 'rest',
};
export const BUILT_IN_BTN_KEYS = ['query', 'rest', 'add', 'export', 'import'];
export const OPERATION_COLUMN_PROP_SFC = 'operate';
export const OPERATION_COLUMN_PROP_CRUD_PAGE = 'action';
export const VALID_CRUD_ACTIONS = ['add', 'edit', 'delete', 'view', 'export', 'import'];
export const DEFAULT_CONFIG_TABLE_OUT = {
    total: 'total',
    tableData: 'data',
    pageSize: 'pageSize',
    current: 'pageIndex'
};
export const CRUD_PAGE_BTN_CLICK_KEYS = {
    ADD_CONFIRM: 'add-confirm',
    EDIT_CONFIRM: 'edit-confirm',
};
export const CRUD_PAGE_DIALOG_KEYS = {
    ADD: 'add',
    EDIT: 'edit',
    VIEW: 'view',
};
export const DEFAULT_TOOLBAR_BTNS = {
    ADD: { name: '新增', type: 'primary', key: 'add', icon: 'Plus', dialogKey: 'add' },
    EXPORT: { name: '导出', key: 'export', icon: 'Download', actionType: 'export' },
    IMPORT: { name: '导入', key: 'import', icon: 'Upload', actionType: 'import' },
};
export const DEFAULT_ROW_BTNS = {
    VIEW: { name: '查看', type: 'primary', key: 'view', dialogKey: 'view' },
    EDIT: { name: '编辑', type: 'primary', key: 'edit', dialogKey: 'edit' },
    DELETE: { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该条数据吗？' },
};
//# sourceMappingURL=contract.js.map