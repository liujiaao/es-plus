---
title: 'EsCrudPage：schema 驱动整页'
route: '/components/es-crud-page'
canonical: 'https://liujiaao.github.io/es-plus/components/es-crud-page/'
source: 'es-plus-docs/src/views/component-doc.data.ts'
type: 'component'
---

# EsCrudPage：schema 驱动整页

> Schema 驱动的一站式 CRUD 页面组件，支持多弹窗架构、按钮-弹窗声明绑定、自定义渲染、权限控制。

## 能力

- **多弹窗架构** —— dialogs 声明多个弹窗，toolbarBtns/operationColumn 通过 dialogKey 绑定
- **权限控制** —— permissionValue 配合全局 permission 函数控制按钮显隐
- **自定义渲染** —— 弹窗支持 render 函数、configBtn 自定义底部、动态标题
- **程序化控制** —— openDialog/closeDialog 方法支持外部程序化控制弹窗

## 示例

- 基础 CRUD：一行 actions 派生 —— 只写一行 actions：工具栏、操作列、弹窗全部自动派生；增删改真正落到数据源。
- 多弹窗绑定 —— 一个页面挂新增/编辑/批量分配三个弹窗，按钮到弹窗全靠 dialogKey 绑定。
- 自定义弹窗内容 —— dialogs.render 接管弹窗：拖拽上传真的入库，统计面板读的是实时数据。
- 动态标题与回填 —— title 写成函数跟着行数据变，编辑弹窗按 prop 路径自动回填选中行。
- 行确认与删除 —— 危险操作先走 confirm 二次确认，确认后才真正删除/发布/批量归档。
- 权限控制按钮 —— permissionValue + configureEsPlus(permission)：切角色即时隐藏无权按钮。
- 自定义弹窗底部 —— configBtn 按 action 语义装配：custom 自己接线，confirm 走校验后提交。
- 程序化控制弹窗 —— ref.openDialog / closeDialog 程序化开关弹窗，保存结果回写列表。
- 隐藏操作列 —— operationColumn: false + 纯工具栏：CSV 导出与清空日志都在 btn-click 里真实执行。
- 完整业务：多弹窗 + 导出 —— 用户管理全功能：多弹窗 + 动态标题 + render 详情 + 批量启用 + CSV 导出。

## API

### props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| schema | CrudPageSchema | - | CRUD 页面完整配置对象（必填，见 CrudPageSchema 表） |
| httpRequest | Function | - | 自定义 HTTP 请求方法，覆盖 schema.tableOptions.httpRequest |
| autoLoad | boolean | true | 是否在挂载时自动请求数据 |

### CrudPageSchema

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| formItems | FormItemOption[] | [] | 查询表单字段配置（同 EsForm formItemList） |
| formLayout | { labelWidth, minFoldRows } | - | 表单布局（列宽由字段级 querySpan/formSpan 决定） |
| columns | TableColumn[] | - | 表格列配置（必填，同 EsTable columns） |
| tableOptions | TableOptions | {} | 表格选项配置（同 EsTable options） |
| pagination | PaginationConfig | - | 分页配置 |
| toolbarBtns | CrudBtnConfig[] | - | 工具栏按钮（见 CrudBtnConfig 表） |
| tableBtns | TableBtnConfig[] | - | 表格工具栏按钮（渲染在 EsTable 上方；position: left/right）。键与 CrudBtnConfig 相同（另含已废弃的 code），只有 EsCrudPage 消费该字段，写进 EsTable 的 options 不会生效 |
| operationColumn | OperationColumnConfig \| false | - | 操作列配置，false 隐藏操作列（见 OperationColumnConfig 表） |
| dialogs | Record<string, CrudDialogConfig> | - | 多弹窗配置，key 为弹窗标识（见 CrudDialogConfig 表） |
| actions (deprecated) | CrudAction[] | - | 旧版快捷动作，建议改用 toolbarBtns + operationColumn |
| dialogFormItems (deprecated) | FormItemOption[] | - | 旧版单弹窗表单，建议改用 dialogs |
| dialogOptions (deprecated) | DialogOptions | - | 旧版单弹窗配置，建议改用 dialogs |
| queryBtns (deprecated) | BtnConfig[] | - | 旧版查询按钮，建议改用 toolbarBtns |

### CrudBtnConfig

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| name | string | 必填 | 按钮文本 |
| key | string | - | 按钮唯一标识；query / add / export 有内建语义，其余经 btn-click 派发 |
| type | string | - | 按钮类型：primary/success/warning/danger |
| size | string | - | 按钮尺寸；tableBtns 缺省为 small |
| icon | string | - | 图标名称（Element Plus Icons） |
| position | string | left | 左右位置：left / right（tableBtns 用它分组；toolbarBtns 由 EsForm 按钮区布局决定） |
| code | 1 \| 2 | - | 位置旧写法：2 视为 right，其余视为 left（position 优先） |
| direction | string | - | 按钮排列方向：left / right（弹窗与表格的按钮底座读取；toolbarBtns 不读取） |
| loading | boolean | false | 加载态（禁用点击并显示 loading） |
| disabled | boolean \| Function | false | 禁用状态，支持函数动态判断 |
| permissionValue | string | - | 权限标识，配合全局 permission 函数控制显隐 |
| triggerEvent | boolean | false | 仅 toolbarBtns：key 为 query / rest 时点击触发一次表格刷新 |
| click | Function | - | (model, formRef?) => void；tableBtns 中的 click 会被 CRUD 页接管（改走 dialogKey / actionType） |
| dialogKey | string | - | 点击时打开的弹窗 key（自动绑定 dialogs 中的配置） |
| actionType | string | - | 语义动作类型（用于 btn-click 事件 emit） |
| confirm | string \| boolean | - | 点击前确认提示文字 |

### OperationColumnConfig

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| label | string | 操作 | 列标题 |
| width | number \| string | - | 列宽度 |
| fixed | boolean \| string | right | 固定方向 |
| btns | RowBtnConfig[] | - | 行操作按钮列表（见 RowBtnConfig 表） |

### RowBtnConfig

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| name | string | - | 按钮文字 |
| key | string | - | 按钮标识（用于 btn-click 事件） |
| type | string | - | 按钮类型 |
| icon | string | - | 图标 |
| dialogKey | string | - | 点击时打开的弹窗 key，自动将当前行数据传入 |
| confirm | string \| boolean | - | 点击前确认提示（如删除确认） |
| permissionValue | string | - | 权限标识 |
| hidden | boolean \| Function | - | 是否隐藏，支持 (row) => boolean 动态判断 |
| click | Function | - | 自定义点击处理 (row, { refresh, getSelectedRows, openDialog }) => void |

### CrudDialogConfig

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| title | string \| Function | - | 弹窗标题，支持 (row) => string 动态标题 |
| width | string \| number | 600px | 弹窗宽度 |
| formItems | FormItemOption[] | - | 表单字段（简单场景） |
| formLayout | { labelWidth } | - | 弹窗表单布局（只认 labelWidth；列宽由字段级 span 决定） |
| render | Function | - | 自定义渲染 (h, { row, model, close, refresh }) => VNode |
| configBtn | DialogBtnConfig[] | - | 底部按钮配置，action: confirm/cancel/custom |
| isHiddenFooter | boolean | false | 隐藏底部按钮区域 |
| isDraggable | boolean | false | 可拖拽 |
| fullscreen | boolean | false | 全屏 |
| maxHeight | string \| number | - | 最大高度 |
| showClose | boolean | true | 显示关闭入口（自绘的与原生的一起隐藏） |
| destroyOnClose | boolean | - | 关闭时销毁内容（每次打开重置内部状态） |
| modal | boolean | true | 是否需要遮罩层 |
| closeOnClickModal | boolean | true | 点击遮罩层是否关闭 |
| closeOnPressEscape | boolean | true | 按下 ESC 是否关闭 |
| hiddenFullBtn | boolean | false | 隐藏全屏按钮 |
| appendTo | string | - | 挂载点（CSS 选择器；DOM 元素无法经 JSON 传递） |
| cacheKey | string | - | 实例缓存键：同键跨多次调用复用同一弹窗实例（保留内部状态） |
| hasCustomRender | boolean | - | AI 生成器注解键：生成器据此转成 TODO 占位。运行时白名单刻意不转发，不是弹窗 prop |
| onOpen | Function | - | 弹窗打开时回调 (row?) => void |
| onConfirm | Function | - | 确认回调 (data, { close, refresh, getRefs, row }) => void |
| onClose | Function | - | 弹窗关闭时回调 |

### events

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| dialog-confirm | (dialogKey, data) | 弹窗确认时触发 |
| dialog-cancel | (dialogKey) | 弹窗取消时触发 |
| dialog-open | (dialogKey, row?) | 弹窗打开时触发 |
| btn-click | (key, payload?) | 按钮点击时触发（非弹窗类按钮或行操作） |
| query | (model) | 查询事件 |
| export | (model) | 导出事件 |
| add | - | 新增按钮点击（向后兼容） |
| edit | (row) | 编辑按钮点击（向后兼容） |
| view | (row) | 查看按钮点击（向后兼容） |
| delete | (row) | 删除按钮点击（向后兼容） |
| row-click | (row) | 表格行点击事件透传 |
| cell-edit | ({ row, prop, value, oldValue }) | vxe 行内编辑提交（透传 es-table 的同名事件）：每改一格发一条，未改值不发 |

### methods

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| refresh | - | 刷新表格数据 |
| getSelectedRows | - | 获取选中行 |
| openDialog | (key, row?) | 程序化打开弹窗 |
| closeDialog | (key) | 程序化关闭弹窗 |
| queryModel | - | 当前查询表单模型（响应式） |
| tableRef | - | 内部 EsTable 组件实例 |
| formRef | - | 内部 EsForm 组件实例 |


## 主题（CSS 变量）

> EsCrudPage 不写自己的样式：查询表单、表格、弹窗分别是 EsForm / EsTable / EsDialog，主题变量跟着那三个组件与 Element Plus 走（表格那几条见 EsTable 页的主题变量表）。

继承：Element Plus

## 可访问性

- 查询区与表单、表格全部由 EsForm / EsTable 组合：字段标签关联、按钮键盘可达、表头 aria-sort 与那两个组件完全一致，不是另写一套（证据：`packages/vue3/src/components/es-crud-page/src/es-crud-page.vue` 含 `EsForm`）
- 弹窗走 es-dialog（el-dialog 底座）：打开后焦点进入弹窗、Esc 关闭、关闭后焦点回到触发按钮 —— 沿用 Element Plus 的默认行为，本组件没有关掉它（证据：`packages/vue3/src/components/es-dialog/src/component.vue` 含 `<el-dialog`）

## 相关

- **es-form**（/components/es-form）—— 弹窗里的表单、查询区的字段都按同一份 schema 生成
- **es-table**（/components/es-table）—— 表格列、工具栏按钮、操作列由 schema 派生，能力上限就是 EsTable 的能力上限
- **es-error-boundary**（/components/es-error-boundary）—— 自定义 dialogs[].render 是业务代码，出错时用错误边界围住弹窗，别让它拖垮整页

## 版本

| 端 | 首个包含本组件的版本 |
| --- | --- |
| vue3 | 1.4.0 |
| vue2 | 0.9.0 |
| antdv | 1.0.0 |
