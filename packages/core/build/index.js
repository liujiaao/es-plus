/**
 * @es-plus/core 入口
 *
 * 框架无关核心层 —— 不依赖 vue / element-plus / element-ui，
 * 由 @es-plus/vue3 (Vue 3) 与 @es-plus/vue2 (Vue 2) 共同消费。
 *
 * 子路径导出与本入口保持同步：
 *   import { isObject } from '@es-plus/core/shared'
 *   import { isObject } from '@es-plus/core'    // 也可以
 */
// ─── 工具函数 ─────────────────────────────────────────────────
export { isObject, isArray, isFunction, isString, isNumber, isEmpty, firstWordUpperCase, kebabToCamel, toPascalCase, findValueByKey, wrapPromise, getNestedValue, setNestedValue, } from './shared';
// ─── 全局配置 ─────────────────────────────────────────────────
export { configureEsPlus, getGlobalConfig, resetGlobalConfig, } from './config';
// ─── 常量 ─────────────────────────────────────────────────────
export { VALID_FORM_TYPES, FORM_TYPE_ALIASES, SPECIAL_BTN_KEYS, BUILT_IN_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, VALID_CRUD_ACTIONS, DEFAULT_CONFIG_TABLE_OUT, CRUD_PAGE_BTN_CLICK_KEYS, CRUD_PAGE_DIALOG_KEYS, DEFAULT_TOOLBAR_BTNS, DEFAULT_ROW_BTNS, } from './constants';
// ─── 表单布局算法 ─────────────────────────────────────────────
export { getRowColsAlgorithm, shouldShowFoldButton, getBtnColSpan, applyFoldFlags, } from './form-layout';
// ─── 跨页选择 ─────────────────────────────────────────────────
export { createSelectionState, applySelectionChange, restoreSelectionForPage, clearAllSelection, } from './table-selection';
// ─── 请求相关 ─────────────────────────────────────────────────
export { DEFAULT_CONFIG_FORM_FIELD_OUT, checkQueryFields, configFormField, formatConfigOut, queryTableListMethod, httpRequestFormInstance, getEveryFormQueryField, } from './request';
// ─── 字段/按钮解析 ────────────────────────────────────────────
export { filterVisibleFormItems, calculateAutoSpan, applyAutoSpan, splitButtonsByDirection, splitToolbarButtonsByCode, getButtonPosition, filterButtonsByPermission, normalizeButtonsHideState, resolveButtonDisabled, applyConfigTableOut, } from './field-resolver';
// ─── 向后兼容适配层 ──────────────────────────────────────────
export { normalizeFormType, resolveFormLayProps, getCallback, normalizeFormItem, normalizeFormItemList, } from './compat';
// compat 中的 getButtonPosition/isButtonLeft/isButtonRight 也在 field-resolver 中导出
export { getButtonPosition as resolveButtonPosition, isButtonLeft, isButtonRight, } from './compat';
//# sourceMappingURL=index.js.map