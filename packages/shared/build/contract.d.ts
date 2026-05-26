export declare const VALID_FORM_TYPES: readonly ["Input", "Select", "datePicker", "timePicker", "Slider", "ColorPicker", "Transfer", "Cascader", "Radio", "Checkbox", "Switch", "Rate", "Upload"];
export type FormType = typeof VALID_FORM_TYPES[number];
export declare const SPECIAL_BTN_KEYS: {
    readonly QUERY: "query";
    readonly RESET: "rest";
};
export declare const BUILT_IN_BTN_KEYS: readonly ["query", "rest", "add", "export", "import"];
export declare const OPERATION_COLUMN_PROP_SFC = "operate";
export declare const OPERATION_COLUMN_PROP_CRUD_PAGE = "action";
export declare const VALID_CRUD_ACTIONS: readonly ["add", "edit", "delete", "view", "export", "import"];
export type CrudAction = typeof VALID_CRUD_ACTIONS[number];
export declare const DEFAULT_CONFIG_TABLE_OUT: {
    readonly total: "total";
    readonly tableData: "data";
    readonly pageSize: "pageSize";
    readonly current: "pageIndex";
};
export declare const CRUD_PAGE_BTN_CLICK_KEYS: {
    readonly ADD_CONFIRM: "add-confirm";
    readonly EDIT_CONFIRM: "edit-confirm";
};
export declare const CRUD_PAGE_DIALOG_KEYS: {
    readonly ADD: "add";
    readonly EDIT: "edit";
    readonly VIEW: "view";
};
export declare const DEFAULT_TOOLBAR_BTNS: {
    readonly ADD: {
        readonly name: "新增";
        readonly type: "primary";
        readonly key: "add";
        readonly icon: "Plus";
        readonly dialogKey: "add";
    };
    readonly EXPORT: {
        readonly name: "导出";
        readonly key: "export";
        readonly icon: "Download";
        readonly actionType: "export";
    };
    readonly IMPORT: {
        readonly name: "导入";
        readonly key: "import";
        readonly icon: "Upload";
        readonly actionType: "import";
    };
};
export declare const DEFAULT_ROW_BTNS: {
    readonly VIEW: {
        readonly name: "查看";
        readonly type: "primary";
        readonly key: "view";
        readonly dialogKey: "view";
    };
    readonly EDIT: {
        readonly name: "编辑";
        readonly type: "primary";
        readonly key: "edit";
        readonly dialogKey: "edit";
    };
    readonly DELETE: {
        readonly name: "删除";
        readonly type: "danger";
        readonly key: "delete";
        readonly confirm: "确定删除该条数据吗？";
    };
};
//# sourceMappingURL=contract.d.ts.map