/**
 * Ant Design Vue 适配器类型定义
 *
 * 设计原则：
 * 1. 不 import 任何 ant-design-vue 类型 —— 使用宽松字面量联合
 * 2. 与 @es-plus/core 类型 100% 兼容
 * 3. Button/Size 等字面量覆盖 ADV 的实际值范围
 */
import type { VNode, RenderFunction } from 'vue'
import type { ListenToCallBack as CoreListenToCallBack } from '@es-plus/core'

// ============================================================================
// 表单字段类型 (与 @es-plus/core 的 FormType 一致)
// ============================================================================
export interface FormItemOption {
  prop: string
  label: string
  labelKey?: string
  formtype?: 'Input' | 'Select' | 'DatePicker' | 'TimePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
  span?: number
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  attrs?: Record<string, unknown>
  props?: Record<string, unknown>
  on?: Record<string, unknown>
  dataOptions?: Array<{ label: string; value: unknown; disabled?: boolean }>
  isHidden?: (model: Record<string, unknown>, item: FormItemOption, formProps: unknown) => boolean
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
  width?: number | string
  required?: boolean
  rules?: Array<Record<string, unknown>>
  formItemOptions?: Record<string, unknown>
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
  nameKey?: string
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
  disabled?: boolean | ((model?: Record<string, unknown>) => boolean)
  permissionValue?: string
  /** 当 key 为 'query'/'rest' 时触发内置表格联动逻辑 */
  triggerEvent?: boolean
  click?: (model: Record<string, unknown>, formRef: unknown, httpRequestInstance?: unknown) => void
  dialogKey?: string
  actionType?: string
  confirm?: string | boolean
  render?: (h: RenderFunction) => VNode
  isHide?: boolean | (() => boolean)
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
  ellipsis?: boolean
  hidCol?: boolean
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
  spanMethod?: (data: { row: Record<string, unknown>; column: unknown; rowIndex: number; columnIndex: number }) => [number, number]
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
  configBtn?: BtnConfig[]
  leftText?: string
  virtual?: boolean
  engine?: 'default' | 'virtual'
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
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
  visible?: boolean
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
  modal?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  beforeClose?: (done: () => void) => void
  alignCenter?: boolean
  top?: string
  modalClass?: string
  [key: string]: unknown
}

// ============================================================================
// 组件实例类型
// ============================================================================
export interface EsFormInstance {
  formItmeRequestInstance: (propsList: string[]) => Promise<void>
  getFormRef: () => { validate: () => Promise<boolean>; resetFields: () => void; clearValidate: (props?: string | string[]) => void; validateField: (props: string | string[]) => Promise<boolean>; scrollToField: (prop: string) => void }
  validate: () => Promise<boolean>
  resetFields: () => void
  clearValidate: (props?: string | string[]) => void
  validateField: (props: string | string[]) => Promise<boolean>
  scrollToField: (prop: string) => void
}

export interface EsTableInstance {
  httpRequestInstance: (model?: Record<string, unknown>) => Promise<unknown>
  getSelectionRows: () => Record<string, unknown>[]
  clearSelection: () => void
  toggleRowSelection: (row: Record<string, unknown>, selected?: boolean) => void
  clearAllSelection: () => void
  refresh: () => void
  scrollToRow: (row: number | string) => void
}

// ============================================================================
// 全局插件配置
// ============================================================================
export interface EsPlusOptions {
  permission?: (value: string) => boolean
  t?: (key: string) => string
  globalProperties?: boolean
  skipComponentRegistration?: boolean
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  EsTable?: Record<string, unknown>
  EsForm?: Record<string, unknown>
  EsDialog?: Record<string, unknown>
  [key: string]: unknown
}

// Re-export core types for convenience
export type { ListenToCallBack } from '@es-plus/core'
