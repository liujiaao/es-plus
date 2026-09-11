import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'
import type {
  ListenToCallBack as CoreListenToCallBack,
  VxeEditRender,
  VxeEditConfig,
  VxeExportConfig,
  VxeToolbarConfig,
  VxeColumnConfig,
  VxeKeyboardConfig,
  VxeMouseConfig,
  VxeClipboardConfig,
  VxeValidConfig,
  VxeFooterMethod,
  VxeTreeConfig,
  VxeProxyConfig,
  VxeExpandConfig,
  VxeSeqConfig,
} from '@es-plus/core'

export type {
  VxeEditRender,
  VxeEditConfig,
  VxeExportConfig,
  VxeToolbarConfig,
  VxeColumnConfig,
  VxeKeyboardConfig,
  VxeMouseConfig,
  VxeClipboardConfig,
  VxeValidConfig,
  VxeFooterMethod,
  VxeTreeConfig,
  VxeProxyConfig,
  VxeExpandConfig,
  VxeSeqConfig,
}

export interface FormItemOption {
  prop: string
  label: string
  labelKey?: string
  formtype?: 'Input' | 'InputNumber' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
  span?: number
  /** Shortcut: auto-injected into attrs.placeholder */
  placeholder?: string
  /** Shortcut: auto-injected into attrs.clearable */
  clearable?: boolean
  /** Shortcut: auto-injected into attrs.disabled */
  disabled?: boolean
  attrs?: Record<string, unknown>
  /**
   * 透传给输入控件的组件 props。
   * - 与 `attrs` 的区别：`props` 是组件声明 props，`attrs` 是宽松透传
   * - Vue 3 适配器中 `props` 与 `attrs` 会被合并后一起透传给 Element Plus 组件
   * - 兼容 es-eui 既有约定（formItemList 中可同时使用 attrs / props）
   */
  props?: Record<string, unknown>
  /**
   * 透传给输入控件的事件监听器。
   * 键名用组件事件名（如 `change`、`update:modelValue`），适配器会转换成 Vue 3
   * `h()` 需要的 `onXxx` 形式；已写成 `onXxx` 的键名原样透传。
   */
  on?: Record<string, unknown>
  dataOptions?: Array<{ label: string; value: unknown }>
  isHidden?: (model: Record<string, unknown>, item: FormItemOption, formProps: FormProps) => boolean
  render?: (h: RenderFunction, model: Record<string, unknown>, ctx: { row: FormItemOption; index: number }) => VNode | string
  apiParams?: ApiParams
  /** Whether to auto-load API data on init, default true; set false to load manually via formItmeRequestInstance */
  isInitRun?: boolean
  callOptionListFormat?: (data: unknown[]) => unknown[]
  /** Custom HTTP request method override */
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
   * 校验规则（透传给 el-form-item 的 rules）
   * 与 form 级 rules 是叠加关系（本字段规则在前，消息优先）；
   * 与 `formItemOptions.rules` 同时存在时，**`formItemOptions` 优先**
   */
  rules?: Array<Record<string, unknown>>
  /**
   * 表单项布局配置（透传给 el-form-item）
   * 其中的 `required` / `rules` 优先于本类型上的同名字段
   */
  formItemOptions?: Record<string, unknown>
  width?: number | string
  [key: string]: unknown
}

export interface ApiParams {
  url: string
  method?: string
  headers?: Record<string, string>
  model?: Record<string, unknown>
  options?: Record<string, unknown>
}

export interface BtnConfig {
  name: string
  key?: string
  type?: ButtonProps['type']
  size?: ButtonProps['size']
  icon?: string
  /** Button position (recommended, self-documenting): 'left' | 'right' */
  position?: 'left' | 'right'
  /** @deprecated Use position instead. 1=left, 2=right */
  code?: 1 | 2
  direction?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean | (() => boolean)
  permissionValue?: string
  click?: (model: Record<string, unknown>, formRef: unknown, httpRequestInstance?: unknown) => void
  [key: string]: unknown
}

export interface LayoutFormProps {
  rowLayProps?: Record<string, unknown>
  /** Form layout config (recommended, correct spelling) */
  formLayProps?: {
    isBtnHidden?: boolean
    minFoldRows?: number
    btnColSpan?: number
    labelBtnWidth?: string | number
    labelWidth?: string | number
    size?: 'large' | 'default' | 'small' | 'medium' | 'mini'
  }
  /** @deprecated Use formLayProps instead (spelling correction) */
  fromLayProps?: {
    isBtnHidden?: boolean
    minFoldRows?: number
    btnColSpan?: number
    labelBtnWidth?: string | number
    labelWidth?: string | number
    size?: 'large' | 'default' | 'small' | 'medium' | 'mini'
  }
  setOptions?: boolean
}

export interface TableColumn {
  prop?: string
  key?: string
  label?: string
  labelKey?: string
  width?: number | string
  minWidth?: number | string
  align?: string
  fixed?: boolean | string
  formatter?: (row: Record<string, unknown>) => string
  render?: (h: RenderFunction, ctx: { row: Record<string, unknown>; value: unknown; index: number }) => VNode | string
  scopedSlots?: { customRender?: string }
  groups?: TableColumn[]
  ellipsis?: boolean
  hidCol?: boolean
  type?: 'index' | 'selection' | 'expand'
  sortable?: boolean | 'custom'
  btns?: Array<{
    name: string
    type?: string
    icon?: string
    permissionValue?: string
    hidden?: boolean | ((row: Record<string, unknown>) => boolean)
    clickEvent?: (row: Record<string, unknown>) => void
    [key: string]: unknown
  }>
  /** Inline edit renderer (vxe engine only, requires options.editConfig) */
  editRender?: VxeEditRender
  /** Footer cell formatter (vxe engine + options.showFooter only) */
  footerFormatter?: (params: {
    items: unknown[]
    _columnIndex: number
    column: { field: string; title: string; [key: string]: unknown }
    columns: Array<{ field: string; title: string; [key: string]: unknown }>
  }) => string
  [key: string]: unknown
}

export interface TableOptions {
  multiSelect?: boolean
  expand?: boolean
  snIndex?: boolean
  loading?: boolean
  border?: boolean
  stripe?: boolean
  size?: 'large' | 'default' | 'small'
  headerCellStyle?: Record<string, unknown>
  highlightCurrentRow?: boolean
  /** Whether to show table header, default true */
  showHeader?: boolean
  /** Empty text when no data */
  emptyText?: string
  cachePageSelection?: boolean
  heightType?: 'auto' | 'height' | 'maxHeight'
  tabHeight?: number | string
  isInitRun?: boolean
  actionUrl?: string
  apiParams?: ApiParams
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /**
   * Callback mapping. Supports readable names and legacy abbreviations:
   * - beforeRequest (recommended) / brcb (deprecated)
   * - afterResponse (recommended) / qrcb (deprecated)
   */
  listenToCallBack?: CoreListenToCallBack | Record<string, (params: unknown) => unknown>
  configTableOut?: Record<string, string>
  entryQuery?: Record<string, unknown>
  configBtn?: BtnConfig[]
  leftText?: string
  rowkey?: string
  height?: number | string
  /** Enable virtual scrolling (same as engine: 'virtual') */
  virtual?: boolean
  /** Table engine: default=el-table, virtual=el-table-v2, vxe=vxe-table */
  engine?: 'default' | 'virtual' | 'vxe'
  /** Virtual scroll row height (default 50) */
  rowHeight?: number
  /** Dynamic row height estimate */
  estimatedRowHeight?: number
  /** Overscan count for virtual scroll (default 2) */
  overscanCount?: number
  /** Row class name (supports function in virtual mode) */
  rowClassName?: string | ((params: { row: Record<string, unknown>; rowIndex: number }) => string)
  /** Row style (object or function) */
  rowStyle?: Record<string, unknown> | ((params: { row: Record<string, unknown>; rowIndex: number }) => Record<string, unknown>)
  /** Default sort { prop, order } */
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  /** Span method for merging cells */
  spanMethod?: (data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => [number, number]
  /** Cell class name */
  cellClassName?: string | ((data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => string)
  /** Cell style */
  cellStyle?: Record<string, unknown> | ((data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => Record<string, unknown>)
  /** Header cell class name */
  headerCellClassName?: string | ((data: { column: unknown; rowIndex: number }) => string)
  // ── vxe engine first-class options ──────────────────────────────
  /** Show footer totals row (vxe engine only) */
  showFooter?: boolean
  /** Footer totals calculation function (vxe engine; mutually exclusive with footerData) */
  footerMethod?: VxeFooterMethod
  /** Static footer totals data 2D array (vxe engine; mutually exclusive with footerMethod) */
  footerData?: unknown[][]
  /** Inline editing config (vxe engine only, requires column.editRender) */
  editConfig?: VxeEditConfig
  /** Keep original data snapshot so getUpdateRecords/getInsertRecords work (auto-enabled when editConfig is set) */
  keepSource?: boolean
  /** Excel/CSV export config (vxe engine only; xlsx requires extra plugin) */
  exportConfig?: VxeExportConfig | true
  /** Toolbar config — hides ES-Plus configBtn to avoid double toolbars (vxe engine only) */
  toolbarConfig?: VxeToolbarConfig | boolean
  /** Column width drag resize (vxe engine only) */
  columnConfig?: VxeColumnConfig
  /** Keyboard navigation (vxe engine only) */
  keyboardConfig?: VxeKeyboardConfig
  /** Cell click highlight mode (vxe engine only) */
  mouseConfig?: VxeMouseConfig
  /** Clipboard copy/paste; requires mouseConfig.selected (vxe engine only) */
  clipboardConfig?: VxeClipboardConfig
  /** Cell content validation (vxe engine only) */
  validConfig?: VxeValidConfig
  /** Tree data config; requires column.treeNode:true (vxe engine only) */
  treeConfig?: VxeTreeConfig
  /** Proxy data source — vxe internal pagination + remote query (vxe engine only; mutually exclusive with actionUrl/apiParams) */
  proxyConfig?: VxeProxyConfig
  /** Row expand config (vxe engine only) */
  expandConfig?: VxeExpandConfig
  /** Sequence column config (vxe engine only; requires snIndex:true or type:'index') */
  seqConfig?: VxeSeqConfig
  /** Raw vxe-grid config escape hatch (deep-merged after first-class options; overrides anything above) */
  vxeConfig?: Record<string, unknown>
  /** vxe-grid event injection via config (key = event name, e.g. 'cell-click') */
  vxeOn?: Record<string, (...args: unknown[]) => unknown>
  [key: string]: unknown
}

export interface PaginationConfig {
  pageSize?: number
  current?: number
  total?: number
  pageSizes?: number[]
  size?: 'large' | 'default' | 'small'
  isSmall?: boolean
}

export interface DialogOptions {
  title?: string
  width?: string | number
  render?: (h: RenderFunction, instance: unknown, components: Record<string, unknown>) => VNode
  renderHeader?: (h: RenderFunction, instance: unknown) => VNode
  renderFooter?: (h: RenderFunction, instance: unknown) => VNode
  configBtn?: BtnConfig[]
  onSubmit?: (close: () => void) => void
  onClosed?: () => void
  isDraggable?: boolean
  hiddenFullBtn?: boolean
  isHiddenFooter?: boolean
  maxHeight?: string | number
  appendTo?: string | HTMLElement
  fullscreen?: boolean
  showClose?: boolean
  destroyOnClose?: boolean
  /** Whether a mask layer is shown, default true */
  modal?: boolean
  /** Whether clicking the mask closes the dialog, default true */
  closeOnClickModal?: boolean
  /** Whether pressing ESC closes the dialog, default true */
  closeOnPressEscape?: boolean
  /** Callback before dialog closes, call done() to close */
  beforeClose?: (done: () => void) => void
  /** 实例缓存键：同一 cacheKey 跨多次调用复用同一弹窗实例（保留内部状态），关闭后延迟 10 分钟自动回收 */
  cacheKey?: string
  /** Whether to vertically center the dialog */
  alignCenter?: boolean
  /** Dialog CSS margin-top, default '15vh' */
  top?: string
  /** Custom class for the mask layer */
  modalClass?: string
  [key: string]: unknown
}

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
}

export interface EsPlusOptions {
  permission?: (value: string) => boolean
  t?: (key: string) => string
  globalProperties?: boolean
  [key: string]: unknown
}

// Re-export core ListenToCallBack for convenience
export type { ListenToCallBack } from '@es-plus/core'
