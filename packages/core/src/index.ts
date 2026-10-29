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
export {
  isObject,
  isArray,
  isFunction,
  isString,
  isNumber,
  isEmpty,
  firstWordUpperCase,
  kebabToCamel,
  toPascalCase,
  findValueByKey,
  wrapPromise,
  getNestedValue,
  setNestedValue,
  parsePathSegments,
} from './shared'

// ─── 类型定义（跨渲染器契约 barrel，单一权威源）─────────────
// 所有跨渲染器契约类型统一从 ./public-types 透传，三个渲染器 index.ts
// 必须导出同名类型，由 scripts/check-type-exports.mjs 强制校验。
export type * from './public-types'
export { PUBLIC_CONTRACT_TYPES } from './public-types'
export type { PublicContractTypeName } from './public-types'

// ─── 全局配置 ─────────────────────────────────────────────────
export {
  configureEsPlus,
  getGlobalConfig,
  resetGlobalConfig,
  httpRequest,
  resolveHttpRequest,
  resolveComponentConfig,
  createGlobalConfigView,
} from './config'
export type { EsPlusGlobalConfig, HttpRequestFn } from './config'

// ─── 常量 ─────────────────────────────────────────────────────
export {
  VALID_FORM_TYPES,
  FORM_TYPE_ALIASES,
  SPECIAL_BTN_KEYS,
  BUILT_IN_BTN_KEYS,
  TABLE_CONTEXT_INJECT_KEY,
  OPERATION_COLUMN_PROP_SFC,
  OPERATION_COLUMN_PROP_CRUD_PAGE,
  VALID_CRUD_ACTIONS,
  DEFAULT_CONFIG_TABLE_OUT,
  CRUD_PAGE_BTN_CLICK_KEYS,
  CRUD_PAGE_DIALOG_KEYS,
  DEFAULT_TOOLBAR_BTNS,
  DEFAULT_ROW_BTNS,
} from './constants'
export type { FormTypeLiteral, CrudActionLiteral } from './constants'

// ─── 表单布局算法 ─────────────────────────────────────────────
export {
  getRowColsAlgorithm,
  shouldShowFoldButton,
  getBtnColSpan,
  applyFoldFlags,
} from './form-layout'
export type { RowLayoutInfo, FormLayoutResult } from './form-layout'

// ─── EsCrudPage action 面解析（三端共用，AN-06）───────────────
export { resolveCrudActions, LEGACY_CRUD_ACTIONS } from './crud-actions'
export type { CrudActionsSource } from './crud-actions'

// ─── 跨页选择 ─────────────────────────────────────────────────
export {
  createSelectionState,
  applySelectionChange,
  restoreSelectionForPage,
  clearAllSelection,
  wantsCrossPageSelection,
  mergeSelectedRows,
} from './table-selection'
export type { SelectionState, TableRefLike } from './table-selection'

// ─── 分页请求判定 ─────────────────────────────────────────────
export { resolveKeepPage, computeBoundaryRollback } from './pagination'
export type { BoundaryRollbackInput, BoundaryRollbackResult } from './pagination'

// ─── 请求相关 ─────────────────────────────────────────────────
export {
  DEFAULT_CONFIG_FORM_FIELD_OUT,
  checkQueryFields,
  configFormField,
  formatConfigOut,
  queryTableListMethod,
  httpRequestFormInstance,
  getEveryFormQueryField,
} from './request'
export type {
  RequestConfig,
  ConfigFormFieldOut,
  FormFieldOptionResult,
} from './request'

// ─── 字段/按钮解析 ────────────────────────────────────────────
export {
  filterVisibleFormItems,
  calculateAutoSpan,
  applyAutoSpan,
  splitButtonsByDirection,
  splitToolbarButtonsByCode,
  getButtonPosition,
  resolveButtonSide,
  filterButtonsByPermission,
  normalizeButtonsHideState,
  resolveButtonDisabled,
  applyConfigTableOut,
  resolveItemValidateProps,
  resolveFormRules,
  matchHiddenCondition,
  compileHiddenCondition,
} from './field-resolver'

// ─── 表达式求值器（AI-16 底座：JSON 表达式 DSL）───────────────
// 零依赖、无 eval / new Function 的闭白名单求值器（JSONLogic 形态 / CEL 语义子集）。
// `isHidden` 的表达式形态由 field-resolver 委托此处求值；此处对外暴露求值器本身，
// 供宿主在代码侧静态求值（AI-07 联动将由它承载）。
// `looseEqual` 亦在此透出：AI-07 的「仅在变更时写回」判定（收敛终止的前提）
// 由渲染层在调用点完成，需与求值器同源的相等语义（严格 + 仅放宽 number↔string）。
export { evalExpr, isHiddenExpr, isExprNode, EXPR_OPS, looseEqual } from './expr'
export type { FieldHiddenExpr, FieldHiddenExprNode, FieldHiddenExprOp } from './types'

// ─── 字段联动规划器（AI-07：声明式 reactions，纯 JSON、无回调）────────
// 在 AI-16 求值器之上：显示派生（dataOptions/required/disabled）合入三端
// formItemListFilter；值回写（fulfill.value）由渲染层 model watcher 落盘。
// 本模块只读 model、从不写 model —— 响应式与写入均属渲染层。
export {
  resolveReactionOverlay,
  resolveReactionItem,
  buildReactionRequiredRule,
  resolveReactionValues,
  collectReactionDependencies,
} from './reactions'
export type { ReactionValue } from './reactions'
export type { FieldReaction, FieldReactionFulfill } from './types'

// ─── vxe 引擎纯函数（跨包共享）──────────────────────────────
export { buildFirstClassGridOptions } from './vxe-engine'

// ─── 声明式合并单元格（AI-23：跨端窄子集 mergeConfig.rowsBy）──
// 求值全在本模块，三端只做「取值 → 调用 → 交给各自组件」（el-table spanMethod /
// a-table customCell / vxe mergeMethod），故三端等价由构造保证。
export { buildColumnSpans, buildRowSpanMethod, resolveMergeConfig } from './merge-span'
export type { MergeConfig, MergeRow } from './merge-span'

// ─── 前置非数据列合成（AN-09：选择 / 序号 / 展开，五个列产出路径共用一个判据）──
export {
  synthesizeLeadingColumns,
  buildLeadingColumns,
  leadingColumnToTableColumn,
  LEADING_COLUMN_ORDER,
  LEADING_COLUMN_DEFAULTS,
} from './table-columns'
export type { LeadingColumnSpec, LeadingColumnType } from './table-columns'

// ─── 表格单元格「码值 → 展示」解析（TableColumn.dataOptions，三端 × 各引擎同规）──
export { findTableDataOption, resolveTableCellDisplay } from './table-cell'
export type { TableCellDisplay } from './table-cell'

// ─── 服务端排序契约（`tableOptions.sortParam`，三端窄子集）──────────────
// 排序状态机与参数拼装全在本模块，三端只做「存状态 → 请求时调 buildSortParams →
// 表头变化时重取」，故三端等价由构造保证。
export {
  DEFAULT_SORT_PARAM_NAMES,
  resolveSortParam,
  normalizeSortOrder,
  toTableSortState,
  sameSortState,
  seedSortState,
  buildSortParams,
} from './table-sort'
export type { SortParamNames, SortParamOption, TableSortOrder, TableSortState } from './table-sort'

// ─── 行内编辑提交归一（`cell-edit` 载荷，三端同一求值点）───────────────
// 三份 vxe 引擎只做「进会话拍快照 / 出会话比一遍」，判定全在 table-edit。
export { resolveEditProp, snapshotEditRow, diffEditRow } from './table-edit'

// ─── vxe 打印辅助（纯 DOM 字符串变换，三端共享）───────────────
export { patchHtmlRowSpans } from './vxe-print'

// ─── 向后兼容适配层 ──────────────────────────────────────────
export {
  normalizeFormType,
  resolveFormLayProps,
  toCssSize,
  getCallback,
  normalizeFormItem,
  normalizeFormItemList,
  filterBtnProps,
  BTN_ORCHESTRATION_KEYS,
} from './compat'
// compat 中的 getButtonPosition/isButtonLeft/isButtonRight 也在 field-resolver 中导出
export {
  getButtonPosition as resolveButtonPosition,
  isButtonLeft,
  isButtonRight,
} from './compat'
