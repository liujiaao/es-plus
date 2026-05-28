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
export { isObject, isArray, isFunction, isString, isNumber, isEmpty, firstWordUpperCase, kebabToCamel, toPascalCase, findValueByKey, wrapPromise, getNestedValue, setNestedValue, } from './shared';
export type { ModelData, RenderFn, AnyVNode, EsButtonType, EsButtonSize, EsTableSize, ApiParams, FormType, FormItemOption, BtnConfig, LayoutFormProps, TableColumn, ConfigTableOut, TableOptions, PaginationConfig, DialogOptions, EsFormInstance, EsTableInstance, EsPlusOptions, } from './types';
export { configureEsPlus, getGlobalConfig, resetGlobalConfig, } from './config';
export type { EsPlusGlobalConfig } from './config';
export { VALID_FORM_TYPES, SPECIAL_BTN_KEYS, BUILT_IN_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, VALID_CRUD_ACTIONS, DEFAULT_CONFIG_TABLE_OUT, CRUD_PAGE_BTN_CLICK_KEYS, CRUD_PAGE_DIALOG_KEYS, DEFAULT_TOOLBAR_BTNS, DEFAULT_ROW_BTNS, } from './constants';
export type { FormTypeLiteral, CrudActionLiteral } from './constants';
export { getRowColsAlgorithm, shouldShowFoldButton, getBtnColSpan, applyFoldFlags, } from './form-layout';
export type { RowLayoutInfo, FormLayoutResult } from './form-layout';
export { createSelectionState, applySelectionChange, restoreSelectionForPage, clearAllSelection, } from './table-selection';
export type { SelectionState, TableRefLike } from './table-selection';
export { DEFAULT_CONFIG_FORM_FIELD_OUT, checkQueryFields, configFormField, formatConfigOut, queryTableListMethod, httpRequestFormInstance, getEveryFormQueryField, } from './request';
export type { RequestConfig, ConfigFormFieldOut, FormFieldOptionResult, } from './request';
export { filterVisibleFormItems, calculateAutoSpan, applyAutoSpan, splitButtonsByDirection, splitToolbarButtonsByCode, filterButtonsByPermission, normalizeButtonsHideState, resolveButtonDisabled, applyConfigTableOut, } from './field-resolver';
//# sourceMappingURL=index.d.ts.map