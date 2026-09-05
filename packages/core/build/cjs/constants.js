"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROW_BTNS = exports.DEFAULT_TOOLBAR_BTNS = exports.CRUD_PAGE_DIALOG_KEYS = exports.CRUD_PAGE_BTN_CLICK_KEYS = exports.DEFAULT_CONFIG_TABLE_OUT = exports.VALID_CRUD_ACTIONS = exports.OPERATION_COLUMN_PROP_CRUD_PAGE = exports.OPERATION_COLUMN_PROP_SFC = exports.TABLE_CONTEXT_INJECT_KEY = exports.BUILT_IN_BTN_KEYS = exports.SPECIAL_BTN_KEYS = exports.FORM_TYPE_ALIASES = exports.VALID_FORM_TYPES = void 0;
exports.normalizeFormType = normalizeFormType;
/**
 * 内置表单输入类型清单
 * 用于 schema 校验、自动完成提示、CRUD 配置生成器
 *
 * PascalCase 为推荐写法（DatePicker / TimePicker），
 * camelCase 旧写法（datePicker / timePicker）仍保留以兼容。
 */
exports.VALID_FORM_TYPES = [
    'Input',
    'InputNumber',
    'Select',
    'DatePicker',
    'TimePicker',
    'Slider',
    'ColorPicker',
    'Transfer',
    'Cascader',
    'Radio',
    'Checkbox',
    'Switch',
    'Rate',
    'Upload',
];
/**
 * FormType 旧写法 → 新写法映射
 * 用于运行时归一化：用户写 'datePicker' 会被转换为 'DatePicker'
 */
exports.FORM_TYPE_ALIASES = {
    datePicker: 'DatePicker',
    timePicker: 'TimePicker',
};
/**
 * 将 FormType 归一化为 PascalCase
 * 旧写法（如 'datePicker'）会被转换为推荐写法（'DatePicker'），
 * 未知值原样返回。
 */
function normalizeFormType(type) {
    return exports.FORM_TYPE_ALIASES[type] ?? type;
}
/**
 * 特殊按钮 key —— 触发表格内置行为
 * - QUERY：触发查询（reset 当前页 + 重新请求）
 * - RESET：清空表单 + 触发查询
 *
 * 注意：RESET 的拼写是历史遗留 'rest'，不可改名（破坏向后兼容）
 */
exports.SPECIAL_BTN_KEYS = {
    QUERY: 'query',
    RESET: 'rest',
};
/** 内置工具栏按钮 key 清单（CRUD 默认按钮使用这些 key） */
exports.BUILT_IN_BTN_KEYS = ['query', 'rest', 'add', 'export', 'import'];
/**
 * EsForm ↔ EsTable 联动的 provide/inject 上下文 key
 * 历史上拼写为 'getTableInstantce'（Instance 拼错），现统一为正确拼写并收敛到常量，
 * 避免三端各自硬编码字符串再次漂移。
 */
exports.TABLE_CONTEXT_INJECT_KEY = 'getTableInstance';
/** 操作列在 columns 中的占位 prop —— 普通 SFC 场景 */
exports.OPERATION_COLUMN_PROP_SFC = 'operate';
/** 操作列在 columns 中的占位 prop —— EsCrudPage 场景 */
exports.OPERATION_COLUMN_PROP_CRUD_PAGE = 'action';
/**
 * 合法的 CRUD 动作类型（dialogKey/actionType 取值范围）
 */
exports.VALID_CRUD_ACTIONS = ['add', 'edit', 'delete', 'view', 'export', 'import'];
/**
 * 后端响应字段映射的默认值
 * 当用户没有配置 configTableOut 时使用
 */
exports.DEFAULT_CONFIG_TABLE_OUT = {
    total: 'records',
    tableData: 'rows',
    pageSize: 'pageSize',
    current: 'pageNo',
};
/**
 * EsCrudPage 的特殊点击事件 key —— 用于触发 add/edit 表单提交流程
 */
exports.CRUD_PAGE_BTN_CLICK_KEYS = {
    ADD_CONFIRM: 'add-confirm',
    EDIT_CONFIRM: 'edit-confirm',
};
/**
 * EsCrudPage 内置 Dialog key
 */
exports.CRUD_PAGE_DIALOG_KEYS = {
    ADD: 'add',
    EDIT: 'edit',
    VIEW: 'view',
};
/**
 * EsCrudPage 默认工具栏按钮模板
 * 注意 icon 字段：
 * - Vue 3 + Element Plus 渲染层会把 'Plus' 作为图标组件名解析
 * - Vue 2 + Element UI 渲染层会把 'Plus' 转换为 'el-icon-plus' class
 */
exports.DEFAULT_TOOLBAR_BTNS = {
    ADD: { name: '新增', type: 'primary', key: 'add', icon: 'Plus', dialogKey: 'add' },
    EXPORT: { name: '导出', key: 'export', icon: 'Download', actionType: 'export' },
    IMPORT: { name: '导入', key: 'import', icon: 'Upload', actionType: 'import' },
};
/**
 * EsCrudPage 默认行操作按钮模板
 * delete 自带 confirm 提示，避免误删
 */
exports.DEFAULT_ROW_BTNS = {
    VIEW: { name: '查看', type: 'primary', key: 'view', dialogKey: 'view' },
    EDIT: { name: '编辑', type: 'primary', key: 'edit', dialogKey: 'edit' },
    DELETE: { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该条数据吗？' },
};
