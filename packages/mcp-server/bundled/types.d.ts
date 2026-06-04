// Auto-generated from E:\wokerCode\es-plus\es-plus\packages\vue3\src\types\index.ts
// Do not edit manually — run "npm run bundle-types" to update

import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'
import type { ListenToCallBack as CoreListenToCallBack } from '@es-plus/core'

export interface FormItemOption {
  prop: string
  label: string
  labelKey?: string
  formtype?: 'Input' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
  span?: number
  /** Shortcut: auto-injected into attrs.placeholder */
  placeholder?: string
  /** Shortcut: auto-injected into attrs.clearable */
  clearable?: boolean
  /** Shortcut: auto-injected into attrs.disabled */
  disabled?: boolean
  attrs?: Record<string, unknown>
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
  btns?: Array<{ name: string; type?: string; clickEvent?: (row: Record<string, unknown>) => void }>
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
  /** Table engine: default=el-table, virtual=el-table-v2 */
  engine?: 'default' | 'virtual'
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
  httpRequestInstance: (model?: Record<string, unknown>) => Promise<unknown>
  clearSelection: () => void
  toggleRowSelection: (row: Record<string, unknown>, selected?: boolean) => void
  clearAllSelection: () => void
  refresh: () => void
}

export interface EsPlusOptions {
  permission?: (value: string) => boolean
  t?: (key: string) => string
  globalProperties?: boolean
  [key: string]: unknown
}

// Re-export core ListenToCallBack for convenience
export type { ListenToCallBack } from '@es-plus/core'
