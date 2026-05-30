/**
 * 框架无关的常量定义
 *
 * 这些常量来自 packages/shared/src/contract.ts，是 MCP/CLI 与运行时共用的契约。
 * 重新导出到 @es-plus/core 以便 Vue 2 / Vue 3 渲染层都能从同一处读取，
 * 避免两个包各自定义出现漂移。
 *
 * 维护规则：
 * 1. 这里只能存放"无副作用、无 Vue/Element 依赖"的纯常量
 * 2. 修改前需同步检查 mcp-server / cli 是否依赖
 */
/**
 * 内置表单输入类型清单
 * 用于 schema 校验、自动完成提示、CRUD 配置生成器
 */
export declare const VALID_FORM_TYPES: readonly ["Input", "Select", "datePicker", "timePicker", "Slider", "ColorPicker", "Transfer", "Cascader", "Radio", "Checkbox", "Switch", "Rate", "Upload"];
/** 由 VALID_FORM_TYPES 推导的字面量联合类型 */
export type FormTypeLiteral = (typeof VALID_FORM_TYPES)[number];
/**
 * 特殊按钮 key —— 触发表格内置行为
 * - QUERY：触发查询（reset 当前页 + 重新请求）
 * - RESET：清空表单 + 触发查询
 *
 * 注意：RESET 的拼写是历史遗留 'rest'，不可改名（破坏向后兼容）
 */
export declare const SPECIAL_BTN_KEYS: {
    readonly QUERY: "query";
    readonly RESET: "rest";
};
/** 内置工具栏按钮 key 清单（CRUD 默认按钮使用这些 key） */
export declare const BUILT_IN_BTN_KEYS: readonly ["query", "rest", "add", "export", "import"];
/** 操作列在 columns 中的占位 prop —— 普通 SFC 场景 */
export declare const OPERATION_COLUMN_PROP_SFC = "operate";
/** 操作列在 columns 中的占位 prop —— EsCrudPage 场景 */
export declare const OPERATION_COLUMN_PROP_CRUD_PAGE = "action";
/**
 * 合法的 CRUD 动作类型（dialogKey/actionType 取值范围）
 */
export declare const VALID_CRUD_ACTIONS: readonly ["add", "edit", "delete", "view", "export", "import"];
export type CrudActionLiteral = (typeof VALID_CRUD_ACTIONS)[number];
/**
 * 后端响应字段映射的默认值
 * 当用户没有配置 configTableOut 时使用
 */
export declare const DEFAULT_CONFIG_TABLE_OUT: {
    readonly total: "total";
    readonly tableData: "data";
    readonly pageSize: "pageSize";
    readonly current: "pageIndex";
};
/**
 * EsCrudPage 的特殊点击事件 key —— 用于触发 add/edit 表单提交流程
 */
export declare const CRUD_PAGE_BTN_CLICK_KEYS: {
    readonly ADD_CONFIRM: "add-confirm";
    readonly EDIT_CONFIRM: "edit-confirm";
};
/**
 * EsCrudPage 内置 Dialog key
 */
export declare const CRUD_PAGE_DIALOG_KEYS: {
    readonly ADD: "add";
    readonly EDIT: "edit";
    readonly VIEW: "view";
};
/**
 * EsCrudPage 默认工具栏按钮模板
 * 注意 icon 字段：
 * - Vue 3 + Element Plus 渲染层会把 'Plus' 作为图标组件名解析
 * - Vue 2 + Element UI 渲染层会把 'Plus' 转换为 'el-icon-plus' class
 */
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
/**
 * EsCrudPage 默认行操作按钮模板
 * delete 自带 confirm 提示，避免误删
 */
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
//# sourceMappingURL=constants.d.ts.map