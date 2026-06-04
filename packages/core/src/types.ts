/**
 * 框架无关的类型定义
 *
 * 这些类型描述 es-plus 的"配置层"数据形状（columns / formItemList / options 等），
 * 它们不依赖任何 Vue 或 Element 类型，可被 Vue 2 / Vue 3 渲染层共享。
 *
 * 设计原则：
 * 1. 不 import 任何 vue / element-plus / element-ui 类型
 * 2. 使用 unknown 替代具体 VNode 类型 —— 由各渲染层包装
 * 3. 对 Element 特定 props（type/size 等）使用宽松字面量联合
 *
 * 提取自 packages/vue3/src/types/index.ts，
 * 移除 VNode / RenderFunction / FormProps / ButtonProps 引用。
 */

// ============================================================================
// 通用基础类型
// ============================================================================

/**
 * 通用 model 数据形状（表单/表格行数据）
 * 使用宽松约束，允许任意 JSON 兼容值
 */
export type ModelData = Record<string, unknown>

/**
 * 渲染上下文中的 h 函数 —— 由渲染层（Vue 2 createElement / Vue 3 h）注入
 * 此处使用 unknown 表示"任意可调用的渲染函数"
 */
export type RenderFn = (...args: unknown[]) => unknown

/**
 * 通用 VNode 占位符 —— 不引入 vue 依赖，渲染层自行约束
 */
export type AnyVNode = unknown

/**
 * 按钮类型字面量（覆盖 Element Plus / Element UI 通用集合）
 */
export type EsButtonType =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'text'

/**
 * 按钮尺寸字面量
 */
export type EsButtonSize = 'large' | 'default' | 'small' | 'medium' | 'mini'

/**
 * 表格尺寸字面量（兼容 Element UI 的 medium/mini）
 */
export type EsTableSize = 'large' | 'default' | 'small' | 'medium' | 'mini'

// ============================================================================
// API 请求类型
// ============================================================================

/**
 * API 请求参数配置
 * 用于 EsTable.options.apiParams、FormItemOption.apiParams、CrudPage 的 dataSource 等
 */
export interface ApiParams {
  /** 请求 URL（必填） */
  url: string
  /** HTTP 方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | string
  /** 请求头 */
  headers?: Record<string, string>
  /** 默认 model 参数（合并到 formParams 之前） */
  model?: Record<string, unknown>
  /** 透传给底层 httpRequest 的额外配置 */
  options?: Record<string, unknown>
  /** 字段映射别名（labelField/valueField 用于下拉选项） */
  labelField?: string
  valueField?: string
}

// ============================================================================
// 表单字段类型
// ============================================================================

/**
 * 内置表单输入类型
 * - 'Input'        → ElInput / el-input
 * - 'Select'       → ElSelect / el-select
 * - 'DatePicker'   → ElDatePicker / el-date-picker（推荐，旧写法 'datePicker' 仍可用）
 * - 'TimePicker'   → ElTimePicker / el-time-picker（推荐，旧写法 'timePicker' 仍可用）
 * - 'Slider'       → ElSlider / el-slider
 * - 'ColorPicker'  → ElColorPicker / el-color-picker
 * - 'Transfer'     → ElTransfer / el-transfer
 * - 'Cascader'     → ElCascader / el-cascader
 * - 'Radio'        → ElRadioGroup
 * - 'Checkbox'     → ElCheckboxGroup
 * - 'Switch'       → ElSwitch
 * - 'Rate'         → ElRate
 * - 'Upload'       → ElUpload
 */
export type FormType =
  | 'Input'
  | 'Select'
  | 'DatePicker'
  | 'TimePicker'
  | 'Slider'
  | 'ColorPicker'
  | 'Transfer'
  | 'Cascader'
  | 'Radio'
  | 'Checkbox'
  | 'Switch'
  | 'Rate'
  | 'Upload'

/**
 * 表单字段选项
 *
 * 注意 render 签名：
 *   - Vue 3 传入全局 h 函数
 *   - Vue 2 传入 createElement 函数
 *   两者签名不同，但用户写法可保持一致：始终用第一个参数 h 来创建 VNode
 */
export interface FormItemOption {
  /** model 字段路径，支持嵌套（如 'user.name'） */
  prop: string
  /** 字段标签 */
  label: string
  /** i18n 标签 key（优先于 label） */
  labelKey?: string
  /** 内置控件类型 */
  formtype?: FormType
  /** 栅格 span（1-24，默认 6） */
  span?: number
  /** 占位文本快捷方式（自动注入到 attrs.placeholder，attrs 中的同名属性优先） */
  placeholder?: string
  /** 是否可清除快捷方式（自动注入到 attrs.clearable，attrs 中的同名属性优先） */
  clearable?: boolean
  /** 是否禁用快捷方式（自动注入到 attrs.disabled / props.disabled，attrs 中的同名属性优先） */
  disabled?: boolean
  /** 透传给输入控件的 HTML 属性（Vue 2 createElement 的 attrs / Vue 3 的非组件 props） */
  attrs?: Record<string, unknown>
  /**
   * 透传给输入控件的组件 props（Vue 2 createElement 的 props 字段）
   * - 与 `attrs` 的区别：`props` 是组件声明 props（Vue 2 严格区分），`attrs` 是宽松透传
   * - Vue 3 适配器中 `props` 与 `attrs` 会被合并到一起透传给 Element Plus 组件
   * - 兼容 es-eui 既有约定（formItemList 中可同时使用 attrs / props）
   */
  props?: Record<string, unknown>
  /** 透传给输入控件的事件监听器 */
  on?: Record<string, unknown>
  /** 静态选项（Select/Radio/Checkbox/Cascader 用） */
  dataOptions?: Array<{ label: string; value: unknown; disabled?: boolean; children?: unknown[] }>
  /** 动态显隐判断 */
  isHidden?: (model: ModelData, item: FormItemOption, formProps: unknown) => boolean
  /** 自定义渲染函数（h, model, ctx） */
  render?: (h: RenderFn, model: ModelData, ctx: { row: FormItemOption; index: number }) => AnyVNode
  /** 远程加载选项配置 */
  apiParams?: ApiParams
  /** 是否在组件初始化时自动加载接口数据，默认 true */
  isInitRun?: boolean
  /** 选项格式化（接收原始数据，返回 [{ label, value }]） */
  callOptionListFormat?: (data: unknown[]) => unknown[]
  /** 自定义 HTTP 请求方法（覆盖全局） */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /**
   * 响应数据回调映射
   * - responseTransform(data) → 从 API 响应转换为 dataOptions 格式（推荐）
   * - beforeRequest(params) → 请求前拦截（推荐）
   * - afterResponse(res) → 响应后拦截（推荐）
   * - crtn(data) → 旧写法，同 responseTransform（@deprecated）
   * - brcb(params) → 旧写法，同 beforeRequest（@deprecated）
   * - qrcb(res) → 旧写法，同 afterResponse（@deprecated）
   */
  listenToCallBack?: ListenToCallBack
  /** 表单项是否必填（与 rules 二选一） */
  required?: boolean
  /** 校验规则 */
  rules?: Array<Record<string, unknown>>
  /** 表单项布局配置（透传给 el-form-item） */
  formItemOptions?: Record<string, unknown>
  /** 自定义控件相关 */
  components?: Record<string, unknown>
  /** 列宽（表格场景下） */
  width?: number | string
  /** 允许任意扩展键 */
  [key: string]: unknown
}

// ============================================================================
// 按钮配置类型
// ============================================================================

/**
 * 通用按钮配置（表单按钮、表格工具栏按钮、Dialog 底部按钮通用）
 */
export interface BtnConfig {
  /** 按钮显示文本 */
  name: string
  /** i18n 标签 key */
  nameKey?: string
  /** 按钮唯一标识（query/rest/add/export...） */
  key?: string
  /** 按钮类型 */
  type?: EsButtonType
  /** 按钮尺寸 */
  size?: EsButtonSize
  /** 图标（Element Plus 用组件名 / Element UI 用 class 字符串） */
  icon?: string
  /**
   * 按钮位置（推荐，语义自解释）
   * - 'left' = 左侧（默认）
   * - 'right' = 右侧
   */
  position?: 'left' | 'right'
  /**
   * 表格工具栏按钮的位置标记（@deprecated 使用 position 替代）
   * - 1 = 左侧（默认）
   * - 2 = 右侧
   */
  code?: 1 | 2
  /** 表单按钮方向（left/right 区分上下位置） */
  direction?: 'left' | 'right'
  /** 加载态 */
  loading?: boolean
  /** 禁用态（可用函数动态计算） */
  disabled?: boolean | ((model?: ModelData) => boolean)
  /** 权限编码（配合全局 permission 函数过滤） */
  permissionValue?: string
  /**
   * 是否触发 EsTable 的查询行为
   * - true：query/rest 等内置 key 会自动调起表格刷新
   */
  triggerEvent?: boolean
  /** 点击回调（model, formRef, httpRequestInstance?） */
  click?: (model: ModelData, formRef: unknown, httpRequestInstance?: unknown) => void
  /** 关联 dialog（CRUD 场景） */
  dialogKey?: string
  /** 关联动作类型（CRUD 场景，如 export/import） */
  actionType?: string
  /** 二次确认提示（true 用默认文案，字符串自定义文案） */
  confirm?: string | boolean
  /** 允许任意扩展键 */
  [key: string]: unknown
}

// ============================================================================
// 表单布局类型
// ============================================================================

/**
 * EsForm 的 layoutFormProps 配置
 * 控制查询表单的栅格、按钮位置、折叠展开
 */
export interface LayoutFormProps {
  /** el-row 透传 props（gutter 等） */
  rowLayProps?: Record<string, unknown>
  /** 表单本体配置（推荐写法） */
  formLayProps?: {
    /** 隐藏内置按钮区域 */
    isBtnHidden?: boolean
    /** 折叠时显示行数（>0 启用折叠功能） */
    minFoldRows?: number
    /** 按钮所在 col 的 span */
    btnColSpan?: number
    /** 按钮区 label 宽度 */
    labelBtnWidth?: string | number
    /** 表单 label 宽度 */
    labelWidth?: string | number
    /** 表单尺寸 */
    size?: EsButtonSize
  }
  /** @deprecated 使用 formLayProps 替代（拼写修正） */
  fromLayProps?: {
    /** 隐藏内置按钮区域 */
    isBtnHidden?: boolean
    /** 折叠时显示行数（>0 启用折叠功能） */
    minFoldRows?: number
    /** 按钮所在 col 的 span */
    btnColSpan?: number
    /** 按钮区 label 宽度 */
    labelBtnWidth?: string | number
    /** 表单 label 宽度 */
    labelWidth?: string | number
    /** 表单尺寸 */
    size?: EsButtonSize
  }
  /** 是否显示"列设置"等扩展按钮 */
  setOptions?: boolean
}

// ============================================================================
// 表格列与选项类型
// ============================================================================

/**
 * 表格列定义
 *
 * 可选 prop+label 表示数据列；可选 groups 表示分组表头。
 * type='index'/'selection'/'expand' 用于内置列。
 */
export interface TableColumn {
  /** 数据字段名 */
  prop?: string
  /** 兼容字段名（部分场景使用 key 而非 prop） */
  key?: string
  /** 列标题 */
  label?: string
  /** i18n 标签 key */
  labelKey?: string
  /** 列宽 */
  width?: number | string
  /** 最小列宽 */
  minWidth?: number | string
  /** 对齐方式（左/中/右） */
  align?: string
  /** 固定列 */
  fixed?: boolean | 'left' | 'right' | string
  /** 内置列类型 */
  type?: 'index' | 'selection' | 'expand'
  /** 是否可排序 */
  sortable?: boolean | 'custom'
  /** 单元格 formatter（接收 row 返回字符串） */
  formatter?: (row: ModelData, col?: unknown, value?: unknown, index?: number) => string
  /** 自定义渲染函数 */
  render?: (
    h: RenderFn,
    ctx: { row: ModelData; value: unknown; index: number; columnIndex?: number }
  ) => AnyVNode
  /** 命名插槽渲染 */
  scopedSlots?: { customRender?: string }
  /** 分组列（嵌套表头） */
  groups?: TableColumn[]
  /** 文本超出省略号 + tooltip */
  ellipsis?: boolean
  /** 隐藏列（保留配置但不渲染） */
  hidCol?: boolean
  /** 操作按钮列 */
  btns?: Array<{
    name: string
    type?: EsButtonType
    icon?: string
    permissionValue?: string
    clickEvent?: (row: ModelData) => void
    [key: string]: unknown
  }>
  /** 允许任意扩展键 */
  [key: string]: unknown
}

/**
 * 后端响应字段映射
 * 把后端响应的 { data, total, ... } 映射到组件内部约定字段
 */
export interface ConfigTableOut {
  /** 总数字段名 */
  total?: string
  /** 数据数组字段名 */
  tableData?: string
  /** 每页大小字段名 */
  pageSize?: string
  /** 当前页字段名 */
  current?: string
}

/**
 * EsTable 选项配置
 */
export interface TableOptions {
  // ─── 基础外观 ─────────────────────────────────────
  border?: boolean
  stripe?: boolean
  size?: EsTableSize
  headerCellStyle?: Record<string, unknown>
  highlightCurrentRow?: boolean
  /** 是否显示表头，默认 true */
  showHeader?: boolean
  /** 空数据时显示的文本，默认 '暂无数据' */
  emptyText?: string

  // ─── 内置列 ──────────────────────────────────────
  multiSelect?: boolean
  expand?: boolean
  snIndex?: boolean

  // ─── 状态 ────────────────────────────────────────
  loading?: boolean
  cachePageSelection?: boolean

  // ─── 高度 ────────────────────────────────────────
  heightType?: 'auto' | 'height' | 'maxHeight'
  tabHeight?: number | string
  height?: number | string

  // ─── 行 ──────────────────────────────────────────
  rowkey?: string
  rowClassName?: string | ((params: { row: ModelData; rowIndex: number }) => string)
  /** 行样式（对象或函数形式） */
  rowStyle?: Record<string, unknown> | ((params: { row: ModelData; rowIndex: number }) => Record<string, unknown>)
  /** 默认排序 { prop, order } */
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  /** 合并单元格方法 */
  spanMethod?: (data: { row: ModelData; column: unknown; rowIndex: number; columnIndex: number }) => [number, number]
  /** 单元格类名 */
  cellClassName?: string | ((data: { row: ModelData; column: unknown; rowIndex: number; columnIndex: number }) => string)
  /** 单元格样式 */
  cellStyle?: Record<string, unknown> | ((data: { row: ModelData; column: unknown; rowIndex: number; columnIndex: number }) => Record<string, unknown>)
  /** 表头单元格类名 */
  headerCellClassName?: string | ((data: { column: unknown; rowIndex: number }) => string)

  // ─── 数据请求 ─────────────────────────────────────
  isInitRun?: boolean
  actionUrl?: string
  apiParams?: ApiParams
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /**
   * 响应数据回调映射
   * - beforeRequest(params) → 请求前拦截（推荐）
   * - afterResponse(res) → 响应后拦截（推荐）
   * - brcb(params) → 旧写法（@deprecated）
   * - qrcb(res) → 旧写法（@deprecated）
   */
  listenToCallBack?: ListenToCallBack
  configTableOut?: ConfigTableOut
  entryQuery?: Record<string, unknown>

  // ─── 工具栏 ──────────────────────────────────────
  configBtn?: BtnConfig[]
  leftText?: string

  // ─── 虚拟滚动（仅 Vue 3 + el-table-v2 支持） ────────
  /** 启用虚拟滚动（Vue 2 版本不支持，会降级为普通表格） */
  virtual?: boolean
  /** 渲染引擎选择 */
  engine?: 'default' | 'virtual'
  /** 虚拟滚动行高（默认 50） */
  rowHeight?: number
  /** 动态行高预估值 */
  estimatedRowHeight?: number
  /** 可视区域外预渲染行数（默认 2） */
  overscanCount?: number

  /** 允许任意扩展键 */
  [key: string]: unknown
}

/**
 * 分页配置
 */
export interface PaginationConfig {
  /** 每页条数 */
  pageSize?: number
  /** 当前页 */
  current?: number
  /** 总数 */
  total?: number
  /** 可选每页大小 */
  pageSizes?: number[]
  /** 控件尺寸 */
  size?: EsButtonSize
  /** Element UI 紧凑模式 */
  isSmall?: boolean
  /** 显示布局（如 'total, sizes, prev, pager, next, jumper'） */
  layout?: string
}

// ============================================================================
// Dialog 类型
// ============================================================================

/**
 * useDialog 配置项
 */
export interface DialogOptions {
  /** 标题 */
  title?: string
  /** 宽度 */
  width?: string | number
  /** 弹窗显示状态（编程式调用通常为 true） */
  visible?: boolean
  /** 弹窗主体内容 */
  render?: (h: RenderFn, instance: unknown, components: Record<string, unknown>) => AnyVNode
  /** 自定义头部 */
  renderHeader?: (h: RenderFn, instance: unknown) => AnyVNode
  /** 自定义底部 */
  renderFooter?: (h: RenderFn, instance: unknown) => AnyVNode
  /** 底部按钮 */
  configBtn?: BtnConfig[]
  /** 提交回调 */
  onSubmit?: (close: () => void) => void
  /** 关闭后回调 */
  onClosed?: () => void
  /** 是否可拖拽 */
  isDraggable?: boolean
  /** 隐藏全屏按钮 */
  hiddenFullBtn?: boolean
  /** 隐藏底部 */
  isHiddenFooter?: boolean
  /** 内容最大高度 */
  maxHeight?: string | number
  /** 挂载点 */
  appendTo?: string | HTMLElement
  /** 全屏 */
  fullscreen?: boolean
  /** 关闭按钮显示 */
  showClose?: boolean
  /** 关闭时销毁内容 */
  destroyOnClose?: boolean
  /** 是否需要遮罩层，默认 true */
  modal?: boolean
  /** 点击遮罩层是否关闭弹窗，默认 true */
  closeOnClickModal?: boolean
  /** 按下 ESC 是否关闭弹窗，默认 true */
  closeOnPressEscape?: boolean
  /** 关闭前的回调，调用 done() 关闭弹窗 */
  beforeClose?: (done: () => void) => void
  /** 是否垂直居中弹窗 */
  alignCenter?: boolean
  /** Dialog CSS 中的 margin-top 值，默认 '15vh' */
  top?: string
  /** 遮罩层自定义类名 */
  modalClass?: string
  /** 允许任意扩展键 */
  [key: string]: unknown
}

// ============================================================================
// 回调映射接口
// ============================================================================

/**
 * 统一的回调映射接口
 *
 * 提供可读性强的回调名，同时保留旧缩写别名（@deprecated）用于向后兼容。
 * 内部读取时优先新名称，fallback 旧名称，确保两种写法均可使用。
 */
export interface ListenToCallBack {
  /** 将 API 响应转换为 dataOptions 格式（推荐） */
  responseTransform?: (data: unknown) => unknown[]
  /** @deprecated 使用 responseTransform */
  crtn?: (data: unknown) => unknown[]

  /** 请求发送前的参数拦截/转换（推荐） */
  beforeRequest?: (params: unknown) => unknown
  /** @deprecated 使用 beforeRequest */
  brcb?: (params: unknown) => unknown

  /** 响应返回后的数据拦截/转换（推荐） */
  afterResponse?: (res: unknown) => unknown
  /** @deprecated 使用 afterResponse */
  qrcb?: (res: unknown) => unknown

  /** 允许扩展其他回调 */
  [key: string]: ((...args: unknown[]) => unknown) | undefined
}

// ============================================================================
// 组件实例类型（公开方法签名）
// ============================================================================

/**
 * EsForm 实例方法
 */
export interface EsFormInstance {
  validate: () => Promise<boolean>
  resetFields: () => void
  clearValidate: () => void
}

/**
 * EsTable 实例方法
 */
export interface EsTableInstance {
  /** 触发请求（可传额外查询参数） */
  httpRequestInstance: (model?: Record<string, unknown>) => Promise<unknown>
  /** 清除当前页选择 */
  clearSelection: () => void
  /** 切换某一行的选中状态 */
  toggleRowSelection: (row: ModelData, selected?: boolean) => void
  /** 清除所有页选择（含跨页缓存） */
  clearAllSelection: () => void
  /** 重新加载当前页 */
  refresh: () => void
}

// ============================================================================
// 全局插件配置类型
// ============================================================================

/**
 * Vue.use(EsPlus, options) 的 options
 */
export interface EsPlusOptions {
  /** 权限校验函数（接收 permissionValue 返回是否有权限） */
  permission?: (value: string) => boolean
  /** i18n 翻译函数 */
  t?: (key: string) => string
  /** 是否注册全局属性（$useDialog 等） */
  globalProperties?: boolean
  /** 跳过组件全局注册（自动导入模式下设为 true） */
  skipComponentRegistration?: boolean
  /** 全局 httpRequest 函数 */
  httpRequest?: (params: Record<string, unknown>) => Promise<unknown>
  /** 各组件级默认配置 */
  EsTable?: Record<string, unknown>
  EsForm?: Record<string, unknown>
  EsDialog?: Record<string, unknown>
  /** 允许任意扩展键 */
  [key: string]: unknown
}
