// Auto-generated from E:\wokerCode\es-plus\es-plus\packages\vue3\src\types\index.ts
// Do not edit manually — run "npm run bundle-types" to update

import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'

export interface FormItemOption {
  prop: string
  label: string
  labelKey?: string
  formtype?: 'Input' | 'Select' | 'datePicker' | 'timePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'
  span?: number
  attrs?: Record<string, unknown>
  on?: Record<string, unknown>
  dataOptions?: Array<{ label: string; value: unknown }>
  isHidden?: (model: Record<string, unknown>, item: FormItemOption, formProps: FormProps) => boolean
  render?: (h: RenderFunction, model: Record<string, unknown>, ctx: { row: FormItemOption; index: number }) => VNode | string
  apiParams?: ApiParams
  /** 是否在组件初始化时自动加载接口数据，默认 true；设为 false 时需手动调用 formItmeRequestInstance 加载 */
  isInitRun?: boolean
  callOptionListFormat?: (data: unknown[]) => unknown[]
  /** 自定义 HTTP 请求方法，用于覆盖全局请求配置 */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /** 响应数据回调映射，crtn 用于将 API 响应转换为 dataOptions 格式 */
  listenToCallBack?: Record<string, (params: unknown) => unknown>
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
  direction?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean | (() => boolean)
  permissionValue?: string
  click?: (model: Record<string, unknown>, formRef: unknown, httpRequestInstance?: unknown) => void
  [key: string]: unknown
}

export interface LayoutFormProps {
  rowLayProps?: Record<string, unknown>
  fromLayProps?: {
    isBtnHidden?: boolean
    minFoldRows?: number
    btnColSpan?: number
    labelBtnWidth?: string | number
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
  cachePageSelection?: boolean
  heightType?: 'auto' | 'height' | 'maxHeight'
  tabHeight?: number | string
  isInitRun?: boolean
  actionUrl?: string
  apiParams?: ApiParams
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  listenToCallBack?: Record<string, (params: unknown) => unknown>
  configTableOut?: Record<string, string>
  entryQuery?: Record<string, unknown>
  configBtn?: BtnConfig[]
  leftText?: string
  rowkey?: string
  height?: number | string
  /** 启用虚拟滚动（等同 engine: 'virtual'） */
  virtual?: boolean
  /** 表格渲染引擎：default=el-table, virtual=el-table-v2 */
  engine?: 'default' | 'virtual'
  /** 虚拟滚动行高（默认 50） */
  rowHeight?: number
  /** 动态行高预估值 */
  estimatedRowHeight?: number
  /** 可视区域外预渲染行数（默认 2） */
  overscanCount?: number
  /** 行类名（虚拟模式支持函数） */
  rowClassName?: string | ((params: { row: Record<string, unknown>; rowIndex: number }) => string)
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
