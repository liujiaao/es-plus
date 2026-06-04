import type { VNode, RenderFunction } from 'vue'
import type { FormItemOption, BtnConfig, TableColumn, TableOptions, PaginationConfig, DialogOptions } from '../../../types'

// ─── 核心 Schema ───

export interface CrudPageSchema {
  /** 查询表单字段配置 */
  formItems?: FormItemOption[]
  /** 表单布局配置 */
  formLayout?: { span?: number; labelWidth?: string | number; minFoldRows?: number }
  /** 工具栏按钮（显式声明，替代从 actions 自动生成，渲染在 EsForm 按钮区域） */
  toolbarBtns?: CrudBtnConfig[]
  /** 表格工具栏按钮（渲染在 EsTable 上方的 configBtn 区域，code:1=左侧 code:2=右侧） */
  tableBtns?: TableBtnConfig[]
  /** 表格列配置 */
  columns: TableColumn[]
  /** 表格选项配置 */
  tableOptions?: Partial<TableOptions>
  /** 分页配置 */
  pagination?: PaginationConfig
  /** 操作列配置（false = 不显示操作列） */
  operationColumn?: OperationColumnConfig | false
  /** 多弹窗配置（key 作为弹窗标识，按钮通过 dialogKey 绑定） */
  dialogs?: Record<string, CrudDialogConfig>

  // ─── 向后兼容（已废弃但仍可用） ───
  /** @deprecated 使用 toolbarBtns + operationColumn 替代 */
  actions?: CrudAction[]
  /** @deprecated 使用 dialogs 替代 */
  dialogFormItems?: FormItemOption[]
  /** @deprecated 使用 dialogs 替代 */
  dialogOptions?: Partial<DialogOptions>
  /** @deprecated 使用 toolbarBtns 替代 */
  queryBtns?: BtnConfig[]
}

// ─── 工具栏按钮 ───

export interface CrudBtnConfig extends BtnConfig {
  /** 点击时打开的弹窗 key */
  dialogKey?: string
  /** 语义动作类型（用于事件 emit） */
  actionType?: string
  /** 点击前确认提示（true = 默认提示文字，string = 自定义提示文字） */
  confirm?: string | boolean
}

// ─── 表格工具栏按钮 ───

export interface TableBtnConfig extends CrudBtnConfig {
  /** Button position (recommended): 'left' | 'right' */
  position?: 'left' | 'right'
  /** @deprecated Use position instead. 1=left, 2=right */
  code?: 1 | 2
}

// ─── 操作列 ───

export interface OperationColumnConfig {
  /** 列标题，默认 '操作' */
  label?: string
  /** 列宽 */
  width?: number | string
  /** 固定方向，默认 'right' */
  fixed?: boolean | string
  /** 行操作按钮列表 */
  btns: RowBtnConfig[]
}

export interface RowBtnConfig {
  /** 按钮文字 */
  name: string
  /** 按钮标识 key */
  key?: string
  /** 按钮类型 */
  type?: string
  /** 图标 */
  icon?: string
  /** 权限标识 */
  permissionValue?: string
  /** 点击时打开的弹窗 key，自动将当前行数据传入弹窗 */
  dialogKey?: string
  /** 点击前确认提示（如删除确认） */
  confirm?: string | boolean
  /** 是否隐藏（支持动态判断） */
  hidden?: boolean | ((row: Record<string, unknown>) => boolean)
  /** 自定义点击处理 */
  click?: (row: Record<string, unknown>, context: RowBtnContext) => void
}

export interface RowBtnContext {
  /** 刷新表格数据 */
  refresh: () => void
  /** 获取表格选中行 */
  getSelectedRows: () => Record<string, unknown>[]
  /** 主动打开某个弹窗 */
  openDialog: (key: string, row?: Record<string, unknown>) => void
}

// ─── 弹窗配置 ───

export interface CrudDialogConfig {
  /** 弹窗标题（支持动态标题） */
  title?: string | ((row?: Record<string, unknown>) => string)
  /** 弹窗宽度 */
  width?: string | number
  /** 内容模式 1：表单字段（简单场景） */
  formItems?: FormItemOption[]
  /** 表单布局 */
  formLayout?: { span?: number; labelWidth?: string | number }
  /** 内容模式 2：自定义渲染（复杂场景） */
  render?: (h: any, context: DialogRenderContext) => VNode | any
  /** 弹窗底部按钮（不传则根据 onConfirm 自动生成取消+确定） */
  configBtn?: DialogBtnConfig[]
  /** 可拖拽 */
  isDraggable?: boolean
  /** 最大高度 */
  maxHeight?: string | number
  /** 全屏 */
  fullscreen?: boolean
  /** 隐藏底部 */
  isHiddenFooter?: boolean
  /** 弹窗打开时回调 */
  onOpen?: (row?: Record<string, unknown>) => void
  /** 确认回调（未提供 configBtn 时自动生成确认按钮调用此方法） */
  onConfirm?: (data: Record<string, unknown>, context: DialogActionContext) => void | Promise<void>
  /** 弹窗关闭时回调 */
  onClose?: () => void
}

export interface DialogRenderContext {
  /** 打开弹窗时传入的行数据 */
  row: Record<string, unknown>
  /** 响应式表单模型 */
  model: Record<string, unknown>
  /** 注册组件引用（供 footer 按钮通过 getRefs 访问） */
  registerRef: (name: string, el: any) => void
  /** 关闭弹窗 */
  close: () => void
  /** 刷新表格 */
  refresh: () => void
}

export interface DialogBtnConfig extends BtnConfig {
  /** 按钮行为类型 */
  action?: 'confirm' | 'cancel' | 'custom'
}

export interface DialogActionContext {
  /** 关闭弹窗 */
  close: () => void
  /** 刷新表格数据 */
  refresh: () => void
  /** 获取弹窗内组件引用 */
  getRefs: (name?: string) => any
  /** 当前行数据 */
  row: Record<string, unknown>
}

// ─── 向后兼容类型 ───

export type CrudAction = 'add' | 'edit' | 'delete' | 'view' | 'export' | 'import'

// ─── 组件 Props / Emits / Expose ───

export interface CrudPageProps {
  /** CRUD 页面完整配置 */
  schema: CrudPageSchema
  /** 自定义 HTTP 请求方法 */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /** 是否在挂载时自动请求数据，默认 true */
  autoLoad?: boolean
}

export interface CrudPageEmits {
  (e: 'query', model: Record<string, unknown>): void
  (e: 'add'): void
  (e: 'edit', row: Record<string, unknown>): void
  (e: 'delete', row: Record<string, unknown>): void
  (e: 'view', row: Record<string, unknown>): void
  (e: 'export', model: Record<string, unknown>): void
  (e: 'row-click', row: Record<string, unknown>): void
  (e: 'btn-click', key: string, payload?: Record<string, unknown>): void
  (e: 'dialog-confirm', dialogKey: string, data: Record<string, unknown>): void
  (e: 'dialog-cancel', dialogKey: string): void
  (e: 'dialog-open', dialogKey: string, row?: Record<string, unknown>): void
}

export interface CrudPageExpose {
  /** 刷新表格数据 */
  refresh: () => void
  /** 获取选中行 */
  getSelectedRows: () => Record<string, unknown>[]
  /** 表格组件实例 */
  tableRef: any
  /** 表单组件实例 */
  formRef: any
  /** 当前查询表单模型 */
  queryModel: Record<string, unknown>
  /** 主动打开弹窗 */
  openDialog: (key: string, row?: Record<string, unknown>) => void
  /** 主动关闭弹窗 */
  closeDialog: (key: string) => void
}
