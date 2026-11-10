/**
 * EsCrudPage 类型定义 —— Vue 2 版本
 *
 * 与 Vue 3 版本保持完全一致的字段定义，
 * 仅 VNode/RenderFunction 类型从 Vue 2 体系导入（实际仅用于 DialogRenderContext.render 类型标注）。
 */

import type {
  FormItemOption,
  BtnConfig,
  TableColumn,
  TableOptions,
  PaginationConfig,
  DialogOptions,
  FormGroupLayout,
} from '@es-plus/core'

// ─── 核心 Schema ───

export interface CrudPageSchema {
  /** 查询表单字段配置 */
  formItems?: FormItemOption[]
  /** 表单布局配置 */
  formLayout?: { labelWidth?: string | number; minFoldRows?: number; layout?: FormGroupLayout }
  /** 工具栏按钮（显式声明，渲染在 EsForm 按钮区域） */
  toolbarBtns?: CrudBtnConfig[]
  /** 表格工具栏按钮（渲染在 EsTable 上方的 configBtn 区域） */
  tableBtns?: TableBtnConfig[]
  /** 表格列配置 */
  columns: TableColumn[]
  /** 表格选项配置 */
  tableOptions?: Partial<TableOptions>
  /** 分页配置 */
  pagination?: PaginationConfig
  /** 操作列配置（false = 不显示操作列） */
  operationColumn?: OperationColumnConfig | false
  /** 多弹窗配置 */
  dialogs?: Record<string, CrudDialogConfig>

  // 向后兼容字段
  /** @deprecated 使用 toolbarBtns + operationColumn 替代 */
  actions?: CrudAction[]
  /** @deprecated 使用 dialogs 替代 */
  dialogFormItems?: FormItemOption[]
  /** @deprecated 使用 dialogs 替代 */
  dialogOptions?: Partial<DialogOptions>
  /** @deprecated 使用 toolbarBtns 替代 */
  queryBtns?: BtnConfig[]
  /**
   * `es-plus.page-source@1` —— 生成器写入的**出处**（W4 回读闭环）。
   *
   * 运行时忽略此键：它是数据，不是配置。`read_page` 把它无损解压回生成器当时的输入，
   * 宿主改完再生成即可；`lossy[]` 逐条说明输入与产物为何不完全一致。
   * 单源见 `@es-plus/shared` 的 `page-source.ts` —— 本包不依赖 shared 运行时，
   * 故这里是同形的手写镜像（新增字段时两处必须同批改）。
   */
  __esPlusSource?: EsPlusPageSource
}

/** 见上方 `__esPlusSource` 的说明：与 `@es-plus/shared` 的 `EsPlusPageSource` 同形。 */
export interface EsPlusPageSource {
  contract: 'es-plus.page-source@1'
  generator: 'es-plus'
  target: 'vue3' | 'vue2' | 'antdv'
  mode: 'schema' | 'sfc'
  config: Record<string, unknown>
  lossy: Array<{
    path: string
    kind: 'dropped' | 'ignored-in-mode' | 'not-expressible' | 'normalized'
    detail: string
  }>
}

export interface CrudBtnConfig extends BtnConfig {
  dialogKey?: string
  actionType?: string
  confirm?: string | boolean
}

export interface TableBtnConfig extends CrudBtnConfig {
  /** Button position (recommended): 'left' | 'right' */
  position?: 'left' | 'right'
  /** @deprecated Use position instead. 1=left, 2=right */
  code?: 1 | 2
}

export interface OperationColumnConfig {
  label?: string
  width?: number | string
  fixed?: boolean | string
  btns: RowBtnConfig[]
}

export interface RowBtnConfig {
  name: string
  /** 按钮标识 key（`btn-click` 事件里用它分派；未声明时以 name 兜底） */
  key?: string
  type?: string
  icon?: string
  permissionValue?: string
  dialogKey?: string
  confirm?: string | boolean
  hidden?: boolean | ((row: Record<string, unknown>) => boolean)
  click?: (row: Record<string, unknown>, context: RowBtnContext) => void
}

export interface RowBtnContext {
  refresh: () => void
  getSelectedRows: () => Record<string, unknown>[]
  openDialog: (key: string, row?: Record<string, unknown>) => void
}

export interface CrudDialogConfig {
  title?: string | ((row?: Record<string, unknown>) => string)
  width?: string | number
  formItems?: FormItemOption[]
  formLayout?: { labelWidth?: string | number; layout?: FormGroupLayout }
  render?: (h: any, context: DialogRenderContext) => any
  configBtn?: DialogBtnConfig[]
  isDraggable?: boolean
  maxHeight?: string | number
  fullscreen?: boolean
  isHiddenFooter?: boolean
  // ─── 弹窗底座数据键（AI-27）—— openDialog 白名单逐键透传 ───
  showClose?: boolean
  destroyOnClose?: boolean
  modal?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  hiddenFullBtn?: boolean
  appendTo?: string | HTMLElement
  cacheKey?: string
  /**
   * AI-only 注解键（AN-14）：弹窗体是函数，无法经 JSON 传输；生成器看到它会转成
   * wrapper SFC 里的 `TODO(es-plus)` 占位并告警。**不是**弹窗 prop —— 运行时白名单
   * `DIALOG_PASSTHROUGH_KEYS` 刻意不转发它（见 es-crud-page.vue 的注释）。
   */
  hasCustomRender?: boolean
  onOpen?: (row?: Record<string, unknown>) => void
  onConfirm?: (
    data: Record<string, unknown>,
    context: DialogActionContext
  ) => void | Promise<void>
  onClose?: () => void
}

export interface DialogRenderContext {
  row: Record<string, unknown>
  model: Record<string, unknown>
  registerRef: (name: string, el: any) => void
  close: () => void
  refresh: () => void
}

export interface DialogBtnConfig extends BtnConfig {
  action?: 'confirm' | 'cancel' | 'custom'
}

export interface DialogActionContext {
  close: () => void
  refresh: () => void
  getRefs: (name?: string) => any
  row: Record<string, unknown>
}

export type CrudAction = 'add' | 'edit' | 'delete' | 'view' | 'export' | 'import'
