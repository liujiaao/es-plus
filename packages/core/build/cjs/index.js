"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAutoSpan = exports.filterVisibleFormItems = exports.getEveryFormQueryField = exports.httpRequestFormInstance = exports.queryTableListMethod = exports.formatConfigOut = exports.configFormField = exports.checkQueryFields = exports.DEFAULT_CONFIG_FORM_FIELD_OUT = exports.computeBoundaryRollback = exports.resolveKeepPage = exports.clearAllSelection = exports.restoreSelectionForPage = exports.applySelectionChange = exports.createSelectionState = exports.applyFoldFlags = exports.getBtnColSpan = exports.shouldShowFoldButton = exports.getRowColsAlgorithm = exports.DEFAULT_ROW_BTNS = exports.DEFAULT_TOOLBAR_BTNS = exports.CRUD_PAGE_DIALOG_KEYS = exports.CRUD_PAGE_BTN_CLICK_KEYS = exports.DEFAULT_CONFIG_TABLE_OUT = exports.VALID_CRUD_ACTIONS = exports.OPERATION_COLUMN_PROP_CRUD_PAGE = exports.OPERATION_COLUMN_PROP_SFC = exports.TABLE_CONTEXT_INJECT_KEY = exports.BUILT_IN_BTN_KEYS = exports.SPECIAL_BTN_KEYS = exports.FORM_TYPE_ALIASES = exports.VALID_FORM_TYPES = exports.httpRequest = exports.resetGlobalConfig = exports.getGlobalConfig = exports.configureEsPlus = exports.PUBLIC_CONTRACT_TYPES = exports.setNestedValue = exports.getNestedValue = exports.wrapPromise = exports.findValueByKey = exports.toPascalCase = exports.kebabToCamel = exports.firstWordUpperCase = exports.isEmpty = exports.isNumber = exports.isString = exports.isFunction = exports.isArray = exports.isObject = void 0;
exports.isButtonRight = exports.isButtonLeft = exports.resolveButtonPosition = exports.BTN_ORCHESTRATION_KEYS = exports.filterBtnProps = exports.normalizeFormItemList = exports.normalizeFormItem = exports.getCallback = exports.resolveFormLayProps = exports.normalizeFormType = exports.patchHtmlRowSpans = exports.buildFirstClassGridOptions = exports.resolveFormRules = exports.resolveItemValidateProps = exports.applyConfigTableOut = exports.resolveButtonDisabled = exports.normalizeButtonsHideState = exports.filterButtonsByPermission = exports.getButtonPosition = exports.splitToolbarButtonsByCode = exports.splitButtonsByDirection = exports.applyAutoSpan = void 0;
// ─── 工具函数 ─────────────────────────────────────────────────
var shared_1 = require("./shared");
Object.defineProperty(exports, "isObject", { enumerable: true, get: function () { return shared_1.isObject; } });
Object.defineProperty(exports, "isArray", { enumerable: true, get: function () { return shared_1.isArray; } });
Object.defineProperty(exports, "isFunction", { enumerable: true, get: function () { return shared_1.isFunction; } });
Object.defineProperty(exports, "isString", { enumerable: true, get: function () { return shared_1.isString; } });
Object.defineProperty(exports, "isNumber", { enumerable: true, get: function () { return shared_1.isNumber; } });
Object.defineProperty(exports, "isEmpty", { enumerable: true, get: function () { return shared_1.isEmpty; } });
Object.defineProperty(exports, "firstWordUpperCase", { enumerable: true, get: function () { return shared_1.firstWordUpperCase; } });
Object.defineProperty(exports, "kebabToCamel", { enumerable: true, get: function () { return shared_1.kebabToCamel; } });
Object.defineProperty(exports, "toPascalCase", { enumerable: true, get: function () { return shared_1.toPascalCase; } });
Object.defineProperty(exports, "findValueByKey", { enumerable: true, get: function () { return shared_1.findValueByKey; } });
Object.defineProperty(exports, "wrapPromise", { enumerable: true, get: function () { return shared_1.wrapPromise; } });
Object.defineProperty(exports, "getNestedValue", { enumerable: true, get: function () { return shared_1.getNestedValue; } });
Object.defineProperty(exports, "setNestedValue", { enumerable: true, get: function () { return shared_1.setNestedValue; } });
var public_types_1 = require("./public-types");
Object.defineProperty(exports, "PUBLIC_CONTRACT_TYPES", { enumerable: true, get: function () { return public_types_1.PUBLIC_CONTRACT_TYPES; } });
// ─── 全局配置 ─────────────────────────────────────────────────
var config_1 = require("./config");
Object.defineProperty(exports, "configureEsPlus", { enumerable: true, get: function () { return config_1.configureEsPlus; } });
Object.defineProperty(exports, "getGlobalConfig", { enumerable: true, get: function () { return config_1.getGlobalConfig; } });
Object.defineProperty(exports, "resetGlobalConfig", { enumerable: true, get: function () { return config_1.resetGlobalConfig; } });
Object.defineProperty(exports, "httpRequest", { enumerable: true, get: function () { return config_1.httpRequest; } });
// ─── 常量 ─────────────────────────────────────────────────────
var constants_1 = require("./constants");
Object.defineProperty(exports, "VALID_FORM_TYPES", { enumerable: true, get: function () { return constants_1.VALID_FORM_TYPES; } });
Object.defineProperty(exports, "FORM_TYPE_ALIASES", { enumerable: true, get: function () { return constants_1.FORM_TYPE_ALIASES; } });
Object.defineProperty(exports, "SPECIAL_BTN_KEYS", { enumerable: true, get: function () { return constants_1.SPECIAL_BTN_KEYS; } });
Object.defineProperty(exports, "BUILT_IN_BTN_KEYS", { enumerable: true, get: function () { return constants_1.BUILT_IN_BTN_KEYS; } });
Object.defineProperty(exports, "TABLE_CONTEXT_INJECT_KEY", { enumerable: true, get: function () { return constants_1.TABLE_CONTEXT_INJECT_KEY; } });
Object.defineProperty(exports, "OPERATION_COLUMN_PROP_SFC", { enumerable: true, get: function () { return constants_1.OPERATION_COLUMN_PROP_SFC; } });
Object.defineProperty(exports, "OPERATION_COLUMN_PROP_CRUD_PAGE", { enumerable: true, get: function () { return constants_1.OPERATION_COLUMN_PROP_CRUD_PAGE; } });
Object.defineProperty(exports, "VALID_CRUD_ACTIONS", { enumerable: true, get: function () { return constants_1.VALID_CRUD_ACTIONS; } });
Object.defineProperty(exports, "DEFAULT_CONFIG_TABLE_OUT", { enumerable: true, get: function () { return constants_1.DEFAULT_CONFIG_TABLE_OUT; } });
Object.defineProperty(exports, "CRUD_PAGE_BTN_CLICK_KEYS", { enumerable: true, get: function () { return constants_1.CRUD_PAGE_BTN_CLICK_KEYS; } });
Object.defineProperty(exports, "CRUD_PAGE_DIALOG_KEYS", { enumerable: true, get: function () { return constants_1.CRUD_PAGE_DIALOG_KEYS; } });
Object.defineProperty(exports, "DEFAULT_TOOLBAR_BTNS", { enumerable: true, get: function () { return constants_1.DEFAULT_TOOLBAR_BTNS; } });
Object.defineProperty(exports, "DEFAULT_ROW_BTNS", { enumerable: true, get: function () { return constants_1.DEFAULT_ROW_BTNS; } });
// ─── 表单布局算法 ─────────────────────────────────────────────
var form_layout_1 = require("./form-layout");
Object.defineProperty(exports, "getRowColsAlgorithm", { enumerable: true, get: function () { return form_layout_1.getRowColsAlgorithm; } });
Object.defineProperty(exports, "shouldShowFoldButton", { enumerable: true, get: function () { return form_layout_1.shouldShowFoldButton; } });
Object.defineProperty(exports, "getBtnColSpan", { enumerable: true, get: function () { return form_layout_1.getBtnColSpan; } });
Object.defineProperty(exports, "applyFoldFlags", { enumerable: true, get: function () { return form_layout_1.applyFoldFlags; } });
// ─── 跨页选择 ─────────────────────────────────────────────────
var table_selection_1 = require("./table-selection");
Object.defineProperty(exports, "createSelectionState", { enumerable: true, get: function () { return table_selection_1.createSelectionState; } });
Object.defineProperty(exports, "applySelectionChange", { enumerable: true, get: function () { return table_selection_1.applySelectionChange; } });
Object.defineProperty(exports, "restoreSelectionForPage", { enumerable: true, get: function () { return table_selection_1.restoreSelectionForPage; } });
Object.defineProperty(exports, "clearAllSelection", { enumerable: true, get: function () { return table_selection_1.clearAllSelection; } });
// ─── 分页请求判定 ─────────────────────────────────────────────
var pagination_1 = require("./pagination");
Object.defineProperty(exports, "resolveKeepPage", { enumerable: true, get: function () { return pagination_1.resolveKeepPage; } });
Object.defineProperty(exports, "computeBoundaryRollback", { enumerable: true, get: function () { return pagination_1.computeBoundaryRollback; } });
// ─── 请求相关 ─────────────────────────────────────────────────
var request_1 = require("./request");
Object.defineProperty(exports, "DEFAULT_CONFIG_FORM_FIELD_OUT", { enumerable: true, get: function () { return request_1.DEFAULT_CONFIG_FORM_FIELD_OUT; } });
Object.defineProperty(exports, "checkQueryFields", { enumerable: true, get: function () { return request_1.checkQueryFields; } });
Object.defineProperty(exports, "configFormField", { enumerable: true, get: function () { return request_1.configFormField; } });
Object.defineProperty(exports, "formatConfigOut", { enumerable: true, get: function () { return request_1.formatConfigOut; } });
Object.defineProperty(exports, "queryTableListMethod", { enumerable: true, get: function () { return request_1.queryTableListMethod; } });
Object.defineProperty(exports, "httpRequestFormInstance", { enumerable: true, get: function () { return request_1.httpRequestFormInstance; } });
Object.defineProperty(exports, "getEveryFormQueryField", { enumerable: true, get: function () { return request_1.getEveryFormQueryField; } });
// ─── 字段/按钮解析 ────────────────────────────────────────────
var field_resolver_1 = require("./field-resolver");
Object.defineProperty(exports, "filterVisibleFormItems", { enumerable: true, get: function () { return field_resolver_1.filterVisibleFormItems; } });
Object.defineProperty(exports, "calculateAutoSpan", { enumerable: true, get: function () { return field_resolver_1.calculateAutoSpan; } });
Object.defineProperty(exports, "applyAutoSpan", { enumerable: true, get: function () { return field_resolver_1.applyAutoSpan; } });
Object.defineProperty(exports, "splitButtonsByDirection", { enumerable: true, get: function () { return field_resolver_1.splitButtonsByDirection; } });
Object.defineProperty(exports, "splitToolbarButtonsByCode", { enumerable: true, get: function () { return field_resolver_1.splitToolbarButtonsByCode; } });
Object.defineProperty(exports, "getButtonPosition", { enumerable: true, get: function () { return field_resolver_1.getButtonPosition; } });
Object.defineProperty(exports, "filterButtonsByPermission", { enumerable: true, get: function () { return field_resolver_1.filterButtonsByPermission; } });
Object.defineProperty(exports, "normalizeButtonsHideState", { enumerable: true, get: function () { return field_resolver_1.normalizeButtonsHideState; } });
Object.defineProperty(exports, "resolveButtonDisabled", { enumerable: true, get: function () { return field_resolver_1.resolveButtonDisabled; } });
Object.defineProperty(exports, "applyConfigTableOut", { enumerable: true, get: function () { return field_resolver_1.applyConfigTableOut; } });
Object.defineProperty(exports, "resolveItemValidateProps", { enumerable: true, get: function () { return field_resolver_1.resolveItemValidateProps; } });
Object.defineProperty(exports, "resolveFormRules", { enumerable: true, get: function () { return field_resolver_1.resolveFormRules; } });
// ─── vxe 引擎纯函数（跨包共享）──────────────────────────────
var vxe_engine_1 = require("./vxe-engine");
Object.defineProperty(exports, "buildFirstClassGridOptions", { enumerable: true, get: function () { return vxe_engine_1.buildFirstClassGridOptions; } });
// ─── vxe 打印辅助（纯 DOM 字符串变换，三端共享）───────────────
var vxe_print_1 = require("./vxe-print");
Object.defineProperty(exports, "patchHtmlRowSpans", { enumerable: true, get: function () { return vxe_print_1.patchHtmlRowSpans; } });
// ─── 向后兼容适配层 ──────────────────────────────────────────
var compat_1 = require("./compat");
Object.defineProperty(exports, "normalizeFormType", { enumerable: true, get: function () { return compat_1.normalizeFormType; } });
Object.defineProperty(exports, "resolveFormLayProps", { enumerable: true, get: function () { return compat_1.resolveFormLayProps; } });
Object.defineProperty(exports, "getCallback", { enumerable: true, get: function () { return compat_1.getCallback; } });
Object.defineProperty(exports, "normalizeFormItem", { enumerable: true, get: function () { return compat_1.normalizeFormItem; } });
Object.defineProperty(exports, "normalizeFormItemList", { enumerable: true, get: function () { return compat_1.normalizeFormItemList; } });
Object.defineProperty(exports, "filterBtnProps", { enumerable: true, get: function () { return compat_1.filterBtnProps; } });
Object.defineProperty(exports, "BTN_ORCHESTRATION_KEYS", { enumerable: true, get: function () { return compat_1.BTN_ORCHESTRATION_KEYS; } });
// compat 中的 getButtonPosition/isButtonLeft/isButtonRight 也在 field-resolver 中导出
var compat_2 = require("./compat");
Object.defineProperty(exports, "resolveButtonPosition", { enumerable: true, get: function () { return compat_2.getButtonPosition; } });
Object.defineProperty(exports, "isButtonLeft", { enumerable: true, get: function () { return compat_2.isButtonLeft; } });
Object.defineProperty(exports, "isButtonRight", { enumerable: true, get: function () { return compat_2.isButtonRight; } });
