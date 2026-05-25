export declare const VALID_FORM_TYPES: readonly ["Input", "Select", "datePicker", "timePicker", "Slider", "ColorPicker", "Transfer", "Cascader", "Radio", "Checkbox", "Switch", "Rate", "Upload"];
export type FormType = typeof VALID_FORM_TYPES[number];
export declare const SPECIAL_BTN_KEYS: {
    readonly QUERY: "query";
    readonly RESET: "rest";
};
export declare const BUILT_IN_BTN_KEYS: readonly ["query", "rest", "add", "export", "import"];
export declare const OPERATION_COLUMN_PROP_SFC = "operate";
export declare const OPERATION_COLUMN_PROP_CRUD_PAGE = "action";
export declare const VALID_CRUD_ACTIONS: readonly ["add", "edit", "delete", "view", "export"];
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
//# sourceMappingURL=contract.d.ts.map