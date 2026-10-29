/**
 * Ant Design Vue 适配器类型定义
 *
 * 设计原则：
 * 1. 不 import 任何 ant-design-vue 类型 —— 使用宽松字面量联合
 * 2. 与 @es-plus/core 类型 100% 兼容
 * 3. Button/Size 等字面量覆盖 ADV 的实际值范围
 */
import type { VNode, RenderFunction } from 'vue'
import type {
  ListenToCallBack as CoreListenToCallBack,
  TableColumnDataOption,
  VxeEditRender,
  VxeTreeConfig,
  VxeProxyConfig,
  VxeExpandConfig,
  VxeSeqConfig,
  TableEngineExposed,
} from '@es-plus/core'

// ============================================================================
// 表单字段类型 (与 @es-plus/core 的 FormType 一致)
// ============================================================================
/**
 * 显隐算子 / 声明式条件 —— 与 core `types.ts` 的同名类型结构一致。
 *
 * 与 `FormItemOption` 一样，本文件是 core 契约的**框架特化副本**（渲染器契约
 * 各自声明、形状兼容）。此处只多一条约束：条件里**不得**出现函数，它是纯 JSON。
 */
export type FieldHiddenOp = 'eq' | 'ne' | 'in' | 'nIn' | 'empty' | 'notEmpty' | 'truthy' | 'falsy'
export interface FieldHiddenCondition {
  /** model 字段路径（支持 `user.name`），条件成立时隐藏该字段 */
  field: string
  op?: FieldHiddenOp
  value?: unknown
}

/**
 * 表达式算子（闭集）—— 与 core `expr.ts` 的 `EXPR_OPS` 同源。
 * 表达式是**纯 JSON**（JSONLogic 形态），用于旧 8 算子表达不了的谓词（OR / 序关系 / 嵌套 not）。
 */
export type FieldHiddenExprOp =
  | 'var'
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'in'
  | 'nin'
  | 'empty'
  | 'notEmpty'
  | 'truthy'
  | 'falsy'
  | 'and'
  | 'or'
  | 'not'
  | 'if'

/** JSON 表达式节点（AI-16 超集）：`{ var: 'status' }` 或 `{ '==': [{ var: 'status' }, 'pending'] }`。 */
export interface FieldHiddenExprNode {
  var?: string
  [op: string]: unknown
}

/** `isHidden` 的表达式形态：单节点或节点数组。 */
export type FieldHiddenExpr = FieldHiddenExprNode | FieldHiddenExprNode[]

/**
 * 字段联动 fulfillment（AI-07）—— 与 core `types.ts` 的同名类型结构一致，纯 JSON。
 *
 * `dataOptions` 是**字面量选项数组**（非表达式：AI-16 DSL 无对象字面量），
 * `required` / `disabled` / `value` 是表达式节点（`value` 存在时 `dependencies` 必填）。
 */
export interface FieldReactionFulfill {
  dataOptions?: Array<{ label: string; value: unknown; disabled?: boolean; children?: unknown[] }>
  required?: FieldHiddenExprNode
  disabled?: FieldHiddenExprNode
  value?: FieldHiddenExprNode
}

/** 字段联动规则（AI-07）：`when` 门控，`fulfill` 提供派生结果。 */
export interface FieldReaction {
  dependencies?: string[]
  when?: FieldHiddenExprNode
  fulfill: FieldReactionFulfill
}

export interface FormItemOption {
  prop: string
  label: string
  labelKey?: string
  formtype?: 'Input' | 'InputNumber' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
  span?: number
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  attrs?: Record<string, unknown>
  /**
   * 透传给输入控件的组件 props。
   * - 与 `attrs` 的区别：`props` 是组件声明 props，`attrs` 是宽松透传
   * - 本适配器中 `props` 与 `attrs` 会被合并后一起透传给 Ant Design Vue 组件
   * - 兼容 es-eui 既有约定（formItemList 中可同时使用 attrs / props）
   */
  props?: Record<string, unknown>
  /**
   * 透传给输入控件的事件监听器。
   * 键名用组件事件名（如 `change`、`update:value`），适配器会转换成 Vue 3
   * `h()` 需要的 `onXxx` 形式；已写成 `onXxx` 的键名原样透传。
   */
  on?: Record<string, unknown>
  dataOptions?: Array<{ label: string; value: unknown; disabled?: boolean }>
  /**
   * 动态显隐判断：返回 true 表示**隐藏**该字段。
   *
   * - 函数形态：原生用法
   * - 声明式形态：单条件或条件数组（AND，纯 JSON），由 core `normalizeFormItem`
   *   在运行时编译为函数 —— 故渲染层只需照旧调用 `isHidden`
   */
  isHidden?:
    | FieldHiddenCondition
    | FieldHiddenCondition[]
    | FieldHiddenExpr
    | ((model: Record<string, unknown>, item: FormItemOption, formProps: unknown) => boolean)
  /** 字段联动（AI-07）：声明式规则数组，纯 JSON、无回调；由 core `reactions.ts` 求值。 */
  reactions?: FieldReaction[]
  render?: (h: RenderFunction, model: Record<string, unknown>, ctx: { row: FormItemOption; index: number }) => VNode | string
  apiParams?: ApiParams
  isInitRun?: boolean
  callOptionListFormat?: (data: unknown[]) => unknown[]
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /**
   * Callback mapping. Supports readable names (recommended) and legacy abbreviations:
   * - responseTransform (recommended) / crtn (deprecated)
   * - beforeRequest (recommended) / brcb (deprecated)
   * - afterResponse (recommended) / qrcb (deprecated)
   */
  listenToCallBack?: CoreListenToCallBack | Record<string, (params: unknown) => unknown>
  components?: Record<string, unknown>
  /**
   * 表单项是否必填（与 rules 二选一）
   * 与 `formItemOptions.required` 同时存在时，**`formItemOptions` 优先**
   */
  required?: boolean
  /**
   * 校验规则（透传给 a-form-item 的 rules）
   * 与 form 级 rules 是叠加关系（本字段规则在前，消息优先）；
   * 与 `formItemOptions.rules` 同时存在时，**`formItemOptions` 优先**
   */
  rules?: Array<Record<string, unknown>>
  /**
   * 表单项布局配置（透传给 a-form-item）
   * 其中的 `required` / `rules` 优先于本类型上的同名字段
   */
  formItemOptions?: Record<string, unknown>
  width?: number | string
  /**
   * 字段级权限编码（配合全局 `permission` 函数过滤）：无权限时整个表单项不渲染
   * （在 es-form 的 `formItemListFilter` 里与 `isHidden` 同层过滤）。
   */
  permissionValue?: string
  [key: string]: unknown
}

export interface ApiParams {
  url: string
  method?: string
  headers?: Record<string, string>
  model?: Record<string, unknown>
  options?: Record<string, unknown>
  labelField?: string
  valueField?: string
}

// ============================================================================
// 按钮配置 (ADV 按钮类型: primary | default | dashed | text | link | danger)
// ============================================================================
export interface BtnConfig {
  name: string
  key?: string
  type?: 'primary' | 'default' | 'dashed' | 'text' | 'link' | 'danger' | string
  size?: 'large' | 'middle' | 'small' | string
  icon?: string
  /** Button position (recommended, self-documenting): 'left' | 'right' */
  position?: 'left' | 'right'
  /** @deprecated Use position instead. 1=left, 2=right */
  code?: 1 | 2
  direction?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean | (() => boolean)
  permissionValue?: string
  /** 是否联动 EsTable 查询 —— key 为 'query'/'rest' 且本字段为 true 时触发一次表格刷新 */
  triggerEvent?: boolean
  click?: (model: Record<string, unknown>, formRef: unknown, httpRequestInstance?: unknown) => void
  /** 关联弹窗 key（CRUD 场景，见 es-crud-page.vue 的 openDialog 分支） */
  dialogKey?: string
  /** 关联动作类型（CRUD 场景，如 export/import；无 key 时兜底作语义键） */
  actionType?: string
  /** 二次确认提示（true 用默认文案，字符串自定义文案） */
  confirm?: string | boolean
  [key: string]: unknown
}

// ============================================================================
// 表单布局
// ============================================================================
export interface LayoutFormProps {
  rowLayProps?: Record<string, unknown>
  formLayProps?: {
    isBtnHidden?: boolean
    minFoldRows?: number
    btnColSpan?: number
    labelBtnWidth?: string | number
    labelWidth?: string | number
    size?: 'large' | 'middle' | 'small' | string
  }
  /** @deprecated 使用 formLayProps 替代 */
  fromLayProps?: {
    isBtnHidden?: boolean
    minFoldRows?: number
    btnColSpan?: number
    labelBtnWidth?: string | number
    labelWidth?: string | number
    size?: 'large' | 'middle' | 'small' | string
  }
  setOptions?: boolean
}

// ============================================================================
// 表格列 (ADV: dataIndex 替代 prop, title 替代 label, ellipsis 替代 show-overflow-tooltip)
// ============================================================================
export interface TableColumn {
  prop?: string
  key?: string
  label?: string
  labelKey?: string
  width?: number | string
  minWidth?: number | string
  align?: string
  fixed?: boolean | 'left' | 'right' | string
  type?: 'index' | 'selection' | 'expand'
  sortable?: boolean | 'custom'
  formatter?: (row: Record<string, unknown>) => string
  render?: (h: RenderFunction, ctx: { row: Record<string, unknown>; value: unknown; index: number }) => VNode | string
  scopedSlots?: { customRender?: string }
  groups?: TableColumn[]
  /**
   * 行展开内容（仅 `type:'expand'` 列消费）—— AI-09 子项②。
   * 展开行内渲染一组只读「标签: 值」（值取 `record[prop]`）。与 `TableOptions.expandConfig`
   * （vxe `{ accordion }`）**不同概念**：那是 vxe 引擎的展开行为开关，这里是展开的内容。
   */
  expandConfig?: { title?: string; fields: Array<{ prop: string; label?: string; labelKey?: string }> }
  ellipsis?: boolean
  /** 空值占位文本，默认 '-'（null / undefined / '' 时显示） */
  emptyPlaceholder?: string
  /**
   * 声明式「码值 → 展示」映射（可选带上标签染色）。
   *
   * 命中 `value` 时显示 `label`；带 `tagType` 时以 a-tag 渲染（状态色）。未命中回退原始值。
   * 纯 JSON，可直接进 schema 模式；生成器会把 `fields[].dataOptions` 复制到派生列。
   * 用户显式 `render` / `scopedSlots.customRender` / `formatter` 优先级更高。
   */
  dataOptions?: TableColumnDataOption[]
  hidCol?: boolean
  /** 字段级权限编码（配合全局 `permission` 函数过滤）：无权限时该列不渲染（在 es-table 的 filteredColumns 里与 hidCol 同层过滤）。 */
  permissionValue?: string
  /**
   * 行内编辑渲染器（仅 vxe 引擎生效，需配合 options.editConfig）。
   * 消费点：engines/use-vxe-column-adapter.ts 直接读 `col.editRender`（此前只能 `as any`）。
   */
  editRender?: VxeEditRender
  /**
   * 表尾单元格格式化（仅 vxe 引擎 + options.showFooter）。
   * 消费点：engines/use-vxe-column-adapter.ts 包一层 `String(...)`（此前同样只能 `as any`）。
   */
  footerFormatter?: (params: {
    items: unknown[]
    _columnIndex: number
    column: { field: string; title: string; [key: string]: unknown }
    columns: Array<{ field: string; title: string; [key: string]: unknown }>
  }) => string
  cellClassName?: string | ((data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => string)
  headerCellClassName?: string | ((data: { column: unknown; rowIndex: number }) => string)
  btns?: Array<{
    name: string
    type?: string
    icon?: string
    permissionValue?: string
    hidden?: boolean | ((row: Record<string, unknown>) => boolean)
    clickEvent?: (row: Record<string, unknown>) => void
    [key: string]: unknown
  }>
  [key: string]: unknown
}

// ============================================================================
// 表格选项
// ============================================================================
export interface TableOptions {
  border?: boolean
  stripe?: boolean
  size?: 'large' | 'middle' | 'small' | string
  headerCellStyle?: Record<string, unknown>
  highlightCurrentRow?: boolean
  showHeader?: boolean
  emptyText?: string
  multiSelect?: boolean
  expand?: boolean
  snIndex?: boolean
  loading?: boolean
  cachePageSelection?: boolean
  heightType?: 'auto' | 'height' | 'maxHeight'
  tabHeight?: number | string
  height?: number | string
  rowkey?: string
  rowClassName?: string | ((params: { row: Record<string, unknown>; rowIndex: number }) => string)
  rowStyle?: Record<string, unknown> | ((params: { row: Record<string, unknown>; rowIndex: number }) => Record<string, unknown>)
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  /**
   * 服务端排序声明：存在即表示「排序由后端算」——本端关掉本地排序，
   * 每次请求带 { sortField, sortOrder }（字段名可改），点表头时保留当前页重取。
   * 缺省 = 本地排序（历史行为）。求值与参数拼装在 core 的 table-sort。
   */
  sortParam?: boolean | { field?: string; order?: string }
  spanMethod?: (data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => [number, number]
  /**
   * 声明式合并单元格（跨端窄子集）：`{ rowsBy: ['列 prop', ...] }`，按「相邻行该列取值相等」合并。
   * a-table 没有 span-method prop，本端只能走这条；函数式 spanMethod 在本端不生效。
   */
  mergeConfig?: { rowsBy: string[] }
  cellClassName?: string | ((data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => string)
  cellStyle?: Record<string, unknown> | ((data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => Record<string, unknown>)
  headerCellClassName?: string | ((data: { column: unknown; rowIndex: number }) => string)
  isInitRun?: boolean
  actionUrl?: string
  apiParams?: ApiParams
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  listenToCallBack?: CoreListenToCallBack | Record<string, (params: unknown) => unknown>
  configTableOut?: Record<string, string>
  entryQuery?: Record<string, unknown>
  /** httpRequestInstance() 重新拉取时是否保留当前页码（表级默认值，默认 false）。消费点见 component.vue 的 resolveKeepPage */
  refetchKeepPage?: boolean
  /** 内建客户端分页：传入全量 dataSource，组件内部切片并自管 current/pageSize/total（见 component.vue 的 isLocalPagination） */
  localPagination?: boolean
  configBtn?: BtnConfig[]
  leftText?: string
  /**
   * 虚拟滚动开关。保持与 vue3 端配置同形，但 **antdv 本端不生效**：
   * a-table 没有虚拟表格，置 true 会告警并回退默认引擎（见 component.vue 的 virtualRequested）。
   */
  virtual?: boolean
  /** default / vxe 可用；'virtual' 在本端仅告警忽略，大数据量请用 'vxe' */
  engine?: 'default' | 'virtual' | 'vxe'
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
  treeConfig?: VxeTreeConfig
  proxyConfig?: VxeProxyConfig
  expandConfig?: VxeExpandConfig
  seqConfig?: VxeSeqConfig
  showFooter?: boolean
  footerMethod?: (params: { columns: unknown[]; data: Record<string, unknown>[] }) => unknown[][]
  footerData?: unknown[][]
  editConfig?: Record<string, unknown>
  keepSource?: boolean
  /** 打印配置（vxe engine；true 用默认配置）。由 core 的 vxe-engine/build-grid-config.ts 消费 */
  printConfig?: Record<string, unknown> | true
  exportConfig?: Record<string, unknown>
  toolbarConfig?: Record<string, unknown>
  columnConfig?: Record<string, unknown>
  keyboardConfig?: Record<string, unknown>
  mouseConfig?: Record<string, unknown>
  validConfig?: Record<string, unknown>
  [key: string]: unknown
}

export interface PaginationConfig {
  pageSize?: number
  current?: number
  total?: number
  pageSizes?: number[]
  size?: 'large' | 'middle' | 'small' | string
  isSmall?: boolean
}

// ============================================================================
// Dialog / Modal (ADV: a-modal, v-model:open 替代 v-model)
// ============================================================================
export interface DialogOptions {
  title?: string
  width?: string | number
  /**
   * 弹窗显示状态（a-modal 的 open）。
   *
   * useDialog 会在未显式传入时补 true，且缓存/开关均靠翻转该 prop；
   * component.vue 也把它声明成了 props（`visible?: boolean`）—— 此前本类型漏了它。
   */
  visible?: boolean
  render?: (h: RenderFunction, instance: unknown, components: Record<string, unknown>) => VNode
  renderHeader?: (h: RenderFunction, instance: unknown) => VNode
  renderFooter?: (h: RenderFunction, instance: unknown) => VNode
  configBtn?: BtnConfig[]
  onClosed?: () => void
  isDraggable?: boolean
  hiddenFullBtn?: boolean
  isHiddenFooter?: boolean
  maxHeight?: string | number
  appendTo?: string | HTMLElement
  fullscreen?: boolean
  showClose?: boolean
  destroyOnClose?: boolean
  modal?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  beforeClose?: (done: () => void) => void
  /** 实例缓存键：同一 cacheKey 跨多次调用复用同一弹窗实例（保留内部状态），关闭后延迟 10 分钟自动回收 */
  cacheKey?: string
  alignCenter?: boolean
  top?: string
  modalClass?: string
  [key: string]: unknown
}

// ============================================================================
// 组件实例类型（接口对齐 vue3 最小集；defineExpose 实现保留 vue3 全集）
// ============================================================================
export interface EsFormInstance {
  validate: () => Promise<boolean>
  resetFields: () => void
  clearValidate: () => void
}

export interface EsTableInstance {
  /** 触发请求（可传额外查询参数） */
  httpRequestInstance: (model?: Record<string, unknown>) => Promise<unknown>
  /** 清除当前页选择 */
  clearSelection: () => void
  /** 切换某一行的选中状态 */
  toggleRowSelection: (row: Record<string, unknown>, selected?: boolean) => void
  /** 清除所有页选择（含跨页缓存） */
  clearAllSelection: () => void
  /** 刷新当前页：保留页码重新取数 + 重排布局，返回 Promise */
  refresh: (model?: Record<string, unknown>) => Promise<unknown> | void
  /** 重新加载：回到第 1 页重新取数（搜索/重置语义），返回 Promise */
  reload: (model?: Record<string, unknown>) => Promise<unknown> | void
  /** 仅重排列宽/布局，不重新取数（纯布局逃生舱） */
  doLayout: () => void
  /** 导出（vxe4 的 grid 不代理该方法，组件内部已下沉到 <vxe-table>） */
  exportData: (opts?: Record<string, unknown>) => Promise<unknown> | void
  /** 打印（vxe4 的 grid 不代理该方法，组件内部已下沉到 <vxe-table>） */
  print: (opts?: Record<string, unknown>) => Promise<unknown> | void
  /** 取打印用 HTML（保留完整多级表头，配合 patchHtmlRowSpans 修正合并单元格） */
  getPrintHtml: (opts?: Record<string, unknown>) => Promise<{ html: string }>
}

// ============================================================================
// 全局插件配置（对齐 vue3 最小集；EsTable/EsForm/EsDialog/httpRequest 等归 EsPlusGlobalConfig）
// ============================================================================
export interface EsPlusOptions {
  permission?: (value: string) => boolean
  t?: (key: string) => string
  globalProperties?: boolean
  /** 跳过组件全局注册（自动导入模式下设为 true，见 index.ts 的 install） */
  skipComponentRegistration?: boolean
  /** 全局 httpRequest（core 的权威字段，见 core/config.ts 的 resolveHttpRequest） */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /** 各组件级默认配置：install 时按组件名下发 */
  EsTable?: Record<string, unknown>
  EsForm?: Record<string, unknown>
  EsDialog?: Record<string, unknown>
  [key: string]: unknown
}

// Re-export core types for convenience
export type {
  ListenToCallBack,
  TableColumnDataOption,
  TableEngineExposed,
  VxeTreeConfig,
  VxeProxyConfig,
  VxeExpandConfig,
  VxeSeqConfig,
} from '@es-plus/core'
