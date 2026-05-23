const TYPES_CONTENT = `// es-plus-ui TypeScript Type Definitions

import type { VNode, RenderFunction } from 'vue'
import type { FormItemProps, FormProps, ButtonProps } from 'element-plus'

export type FormType = 'Input' | 'Select' | 'datePicker' | 'timePicker' | 'Slider' | 'ColorPicker' | 'Transfer' | 'Cascader' | 'Radio' | 'Checkbox' | 'Switch' | 'Rate' | 'Upload'

export interface FormItemOption {
  prop: string
  label: string
  formtype?: FormType
  span?: number
  attrs?: Record<string, unknown>
  on?: Record<string, unknown>
  dataOptions?: Array<{ label: string; value: unknown }>
  isHidden?: (model: Record<string, unknown>, item: FormItemOption, formProps: FormProps) => boolean
  render?: (h: RenderFunction, model: Record<string, unknown>, ctx: { row: FormItemOption; index: number }) => VNode | string
  apiParams?: ApiParams
  isInitRun?: boolean
  callOptionListFormat?: (data: unknown[]) => unknown[]
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  listenToCallBack?: Record<string, (params: unknown) => unknown>
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
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'large' | 'default' | 'small'
  icon?: string
  direction?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean | (() => boolean)
  triggerEvent?: boolean
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
  heightType?: 'auto' | 'height'
  tabHeight?: number | string
  isInitRun?: boolean
  actionUrl?: string
  apiParams?: ApiParams
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  listenToCallBack?: Record<string, (params: unknown) => unknown>
  configTableOut?: Record<string, string>
  entryQuery?: Record<string, unknown>
  rowkey?: string
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
`;
export function registerTypesResource(server) {
    server.resource("types", "esplus://types", {
        description: "Complete TypeScript type definitions for all es-plus-ui components",
        mimeType: "text/plain",
    }, async () => {
        return {
            contents: [
                {
                    uri: "esplus://types",
                    mimeType: "text/plain",
                    text: TYPES_CONTENT,
                },
            ],
        };
    });
}
//# sourceMappingURL=types.js.map