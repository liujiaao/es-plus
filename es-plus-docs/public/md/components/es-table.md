---
title: 'EsTable 高级表格'
route: '/components/es-table'
canonical: 'https://liujiaao.github.io/es-plus/#/components/es-table'
source: 'es-plus-docs/src/views/component-doc.data.ts'
type: 'component'
---

# EsTable 高级表格

> 基于 Element Plus 的增强型表格组件，支持配置化列定义、自动分页、数据联动等高级功能。

## 能力

- **配置化** —— 通过 columns 配置定义表格列
- **自适应** —— 自动计算表格高度，支持 Resize
- **分页** —— 内置分页逻辑，支持多种分页配置
- **联动** —— 与 EsForm 无缝联动

## 示例

- 配置化基础表格 —— 一份 columns JSON 渲染整张表格，不写模板、不写插槽。
- 表格工具栏 —— 表格顶部操作区，支持 configBtn、leftText 配置和 default slot 自定义内容。
- 自定义列渲染 —— render 函数、scopedSlots、formatter 多种自定义列渲染方式。
- 多选与跨页记忆 —— multiSelect + cachePageSelection + rowKey，分页后切换页码仍能保持跨页勾选状态。
- 点击单元格即编辑 —— 表格即编辑器，点击单元格进入编辑模式，支持批量保存/取消。
- 前端 / 后端排序 —— 前端排序与后端排序两种模式。
- 分组表头 —— groups 嵌套列配置实现多级分组表头。
- 固定列与固定高度 —— fixed 固定列 + heightType: height 固定高度，宽表横向滚动时关键列始终可见。
- 分页表格：v-model 自动翻页 —— 配置 httpRequest + configTableOut 对接免费接口，v-model 双向绑定自动分页。
- 远程数据表格 —— actionUrl + httpRequest + configTableOut 完整远程数据请求与分页。
- 展开行与树形 —— type:expand 展开行 + children 树形数据两种层级展示模式。
- 声明式行合并与行样式 —— mergeConfig.rowsBy 声明式合并单元格（同一份 JSON 三端通用，无需手写 span 函数）+ rowClassName 条件行样式。
- 配置化查询：零 handleSearch —— 查询区也是配置：es-form 嵌套进 es-table，按钮 key=query/rest + triggerEvent 自动联动，整页没有 handleSearch / handleReset。
- 行操作按钮与动态显隐 —— btns 的 hidden 同时按行状态与角色求值：草稿/已驳回才出现「提交审核」，已通过不可删；工具栏新增、批量审核（按勾选行）、导出都真实落到数据源。
- 动态列与汇总行 —— hidCol 动态列显隐 + show-summary/summary-method 配置化汇总行。
- 请求回调管线 —— listenToCallBack brcb/qrcb 请求响应拦截 + configTableOut 字段映射 + entryQuery 默认参数。
- 当前行与主从联动 —— highlightCurrentRow 行高亮 + @current-change 事件驱动从表 + 汇总统计。
- 自适应容器高度 —— heightType: height 继承父容器高度 + ResizeObserver 自动计算，容器变表格自适应。
- 码值列：零 render 出标签 —— 状态是 0/1/2 这样的码值，列上写一份 dataOptions 就得到中文标签与语义色 —— 三端各自渲染原生标签（ElTag / el-tag / a-tag），没有一个 render 函数。未命中显示原值，空值走 emptyPlaceholder。

## API

### props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| dataSource | Array | [] | 表格数据（必填，支持 v-model） |
| columns | TableColumn[] | [] | 列配置数组（必填，见 TableColumn 表） |
| options | TableOptions | {} | 表格选项配置（见 TableOptions 表） |
| pagination | PaginationConfig | {} | 分页配置（支持 v-model） |
| initTabHeight | number | 400 | 初始表格高度 |
| showHeaderBar | boolean | true | 是否显示头部栏区域 |
| headBarClass | string \| Object | - | 头部栏样式类 |

### TableColumn

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| prop | string | - | 数据字段名 |
| key | string | - | 列唯一标识 |
| label | string | - | 列标题 |
| labelKey | string | - | 国际化 key（配合全局 t 函数） |
| width | number \| string | - | 列宽度（虚拟模式必须为数值，默认 150） |
| minWidth | number \| string | - | 最小列宽度 |
| align | string | center | 对齐方式：left/center/right |
| fixed | boolean \| string | - | 固定列（left/right/true=left） |
| sortable | boolean | - | 是否可排序（虚拟模式兼容） |
| ellipsis | boolean | - | 文本溢出省略 + Tooltip 提示（虚拟模式兼容） |
| formatter | Function | - | (row) => string，格式化函数 |
| render | Function | - | (h, { row, value, index }) => VNode |
| scopedSlots | Object | - | { customRender: string } 插槽配置（虚拟模式兼容） |
| groups | TableColumn[] | - | 多级表头子列（虚拟模式扁平化渲染） |
| expandConfig | Object | - | 展开行内容 { title?, fields }，仅 type: "expand" 列消费 |
| hidCol | boolean | - | 是否隐藏该列 |
| permissionValue | string | - | 列级权限编码：无权限时该列不渲染（未配置全局 permission 时放行） |
| btns | Array | - | 行操作按钮 [{ name, type?, clickEvent? }] |
| type | string | - | 特殊列类型：selection（复选框多选，组件不提供单选列）/expand/index |
| emptyPlaceholder | string | - | 空值占位文本，默认 "-" |
| dataOptions | TableColumnDataOption[] | - | 码值映射 [{ label, value, tagType? }]：命中显示 label，tagType 渲染 ElTag；未命中原值。render / formatter 优先 |
| editRender | Object | - | vxe：行内编辑渲染器，需配合 options.editConfig |
| footerFormatter | Function | - | vxe：表尾单元格格式化，配合 options.showFooter |

### TableOptions

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| border | boolean | false | 是否显示边框 |
| stripe | boolean | false | 是否显示斑马纹 |
| size | string | small | 表格尺寸：large/default/small |
| multiSelect | boolean | false | 启用多选列（与列上的 type: "selection" 等价，有其一即可） |
| expand | boolean | false | 启用展开行 |
| snIndex | boolean | false | 显示序号列 |
| loading | boolean | false | 加载状态 |
| highlightCurrentRow | boolean | true | 是否高亮当前行；单选可用 @current-change（虚拟引擎只发 @row-click） |
| heightType | string | - | 高度类型：height（推荐）/ auto / maxHeight |
| tabHeight | number \| string | - | 表格容器高度（推荐，虚拟/普通模式统一使用） |
| height | number \| string | - | 固定高度（tabHeight 的别名，heightType="height" 时生效） |
| rowkey | string | - | 行唯一标识字段名（跨页选择/虚拟模式必填） |
| cachePageSelection | boolean | true | 跨页选择缓存（default / virtual / vxe 三引擎同义）：开启时翻页保留已选并累积；false 时翻页即丢弃上一页勾选。需配 rowkey |
| rowClassName | string \| Function | - | 行类名，支持 (row, rowIndex) => string 动态设置 |
| virtual | boolean | false | 启用虚拟滚动（基于 el-table-v2，支持 10 万+ 行数据） |
| engine | string | default | 渲染引擎：default（el-table）/ virtual（el-table-v2）/ vxe（vxe-table 高性能引擎） |
| rowHeight | number | 50 | 虚拟滚动行高（仅 virtual 模式） |
| estimatedRowHeight | number | - | 动态行高预估值（仅 virtual 模式） |
| overscanCount | number | 2 | 可视区域外预渲染行数（仅 virtual 模式） |
| httpRequest | Function | - | 自定义请求方法（覆盖全局配置） |
| apiParams | ApiParams | - | API 请求配置 { url, method, model, headers } |
| configTableOut | Object | - | 响应字段映射 { total, tableData, pageSize, current } |
| listenToCallBack | Object | - | 请求/响应回调管线 { brcb, qrcb } |
| entryQuery | Object | - | 固定并入每次请求体的默认参数（与分页参数、apiParams.model 合并） |
| actionUrl | string | - | 请求地址（简写） |
| isInitRun | boolean | - | 初始化时是否自动请求数据 |
| configBtn | Array | - | 顶部操作按钮配置（TableOptions 的键，不是组件 prop） |
| leftText | string | - | 顶部左侧文本 |
| headerCellStyle | Object | - | 表头单元格样式 |
| headerCellClassName | string \| Function | - | 表头单元格类名 |
| showHeader | boolean | true | 是否显示表头 |
| emptyText | string | - | 空数据时的占位文本 |
| rowStyle | Object \| Function | - | 行内样式，支持 ({ row, rowIndex }) => object |
| defaultSort | Object | - | 默认排序 { prop, order: "ascending" \| "descending" } |
| spanMethod | Function | - | 合并单元格 ({ row, column, rowIndex, columnIndex }) => [rowspan, colspan] |
| cellClassName | string \| Function | - | 单元格类名 |
| cellStyle | Object \| Function | - | 单元格样式 |
| refetchKeepPage | boolean | false | 请求式刷新时保留当前页码 |
| localPagination | boolean | false | 本地分页（对已加载数据切片，不发请求） |
| vxeConfig | Object | - | vxe 引擎：整体透传给 vxe-grid 的配置 |
| vxeOn | Object | - | vxe 引擎：透传给 vxe-grid 的事件监听 |
| showFooter | boolean | false | vxe：显示表尾 |
| footerMethod | Function | - | vxe：表尾计算 ({ columns, data }) => 二维数组 |
| footerData | Array | - | vxe：静态表尾数据（二维数组） |
| editConfig | Object | - | vxe：行内编辑配置 |
| keepSource | boolean | - | vxe：保留原始行数据（配合 revertData） |
| treeConfig | Object | - | vxe：树形表格配置 |
| proxyConfig | Object | - | vxe：数据代理配置 |
| expandConfig | Object | - | vxe：展开行为配置（与列上的 expandConfig「展开内容」不是同一概念） |
| seqConfig | Object | - | vxe：序号列配置 |
| printConfig | Object \| boolean | - | vxe：打印配置 |
| exportConfig | Object \| boolean | - | vxe：导出配置 |
| toolbarConfig | Object \| boolean | - | vxe：工具栏配置 |
| columnConfig | Object | - | vxe：列配置面板 |
| keyboardConfig | Object | - | vxe：键盘导航配置 |
| mouseConfig | Object | - | vxe：鼠标行为配置 |
| validConfig | Object | - | vxe：校验提示配置 |

### events

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| update:dataSource | (data) | 数据更新（v-model:data-source 自动触发） |
| update:pagination | (pagination) | 分页更新（v-model:pagination 自动触发） |
| pagination-current-change | (pagination) | 页码变化时触发 |
| size-change | (pagination, size) | 每页条数变化时触发 |
| change-table-sort | (column) | 排序变化时触发 |
| selection-change | (rows) | 勾选变化：当前页选中行数组（default / virtual / vxe 同口径）；跨页全集用 getSelectionRows() 取 |
| selection-change | (rows) | 勾选变化：当前页选中行数组（default / virtual / vxe 同口径）；跨页全集用 getSelectionRows() 取 |
| cell-edit | ({ row, prop, value, oldValue }) | vxe 行内编辑提交（失焦 / 换行时）：每改一格发一条，未改值不发。vxe 原生 edit-closed 只给 { row, column }，这里把字段名与旧值一并补上；行模式（editConfig.mode: "row"）一次会话改几格就发几条 |
| request-error | (error) | 自动取数失败时触发；错误同时挂在 requestError 上，成功后复位为 null |

### methods

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| httpRequestInstance | (model?, { keepPage }?) | 手动取数。默认回到第 1 页（搜索语义），keepPage: true 保留当前页 |
| refresh | (model?) | 刷新当前页：保留页码重新取数并重排；本地/静态数据只重排 |
| reload | (model?) | 回到第 1 页重新取数（等价于一次新查询） |
| doLayout | - | 仅重排列宽/布局，不重新取数（旧 refresh 行为的逃生舱） |
| requestError | Ref<unknown> | 最近一次自动加载的错误；成功后复位为 null |
| getSelectionRows | - | 获取选中行（含跨页缓存）。注：跨页选择不通过事件暴露，需通过此方法或 ref 主动读取 |
| clearSelection | - | 清空全部选中（含跨页缓存与 vxe reserve；clearAllSelection 为同义别名） |
| clearAllSelection | - | 同 clearSelection（旧名，保留兼容） |
| toggleRowSelection | (row, selected?) | 命令式勾选单行；省略 selected 时切换。el-table / virtual / vxe 三引擎同签名 |
| scrollToRow | (rowIndex) | 滚动到指定行（virtual 模式 / vxe 引擎均支持；el-table 引擎无此接口） |
| getUpdateRecords | - | vxe 行内编辑：已修改的行（engine: "vxe" 时有效） |
| getInsertRecords | - | vxe 行内编辑：新增的行 |
| getRemoveRecords | - | vxe 行内编辑：已删除的行 |
| revertData | (rows?) | vxe 行内编辑：还原未保存的改动 |
| clearActived | - | vxe 行内编辑：清除当前激活（编辑中）单元格 |
| clearValidate | - | vxe 行内编辑：清除校验状态 |
| validate | (rows?) | vxe 行内编辑：校验表格（可指定行），返回 Promise |
| exportData | (opts?) | vxe 导出：导出当前数据（xlsx/csv/xml/html，opts 即 vxe exportData 配置） |
| print | (opts?) | vxe 打印：调用 vxe 打印；可传 { html } 打印 getPrintHtml 修正过的 HTML |
| getPrintHtml | (opts?) | vxe 打印：取表格 HTML 字符串（vxe 打印不执行 spanMethod，合并区需配合 patchHtmlRowSpans 修正） |
| vxeInstance | - | vxe 原始实例，访问 vxe-table 全部方法/事件（engine: "vxe" 时有效） |

### slots

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| default | - | 表格上方自定义区域（headerBar）。最常用的是把 <es-form> 嵌进来做查询区——配合按钮 triggerEvent 即可自动联动 |
| <你的插槽名> | { row, column, $index } | 列作用域插槽：列配置写 scopedSlots: { customRender: "你的插槽名" } 即可接到它；也可改用列上的 render 函数 |


## 主题（CSS 变量）

> 非虚拟滚动的表格由 Element Plus 的 el-table 渲染，换肤走 --el-*；下面这些是组件自己样式里直接消费的变量 —— 虚拟滚动引擎（el-table-v2）不自带灰底与分隔线，所以表头底色、单元格边框、斑马纹、高亮行都得自己接变量，否则深色站点上是一片白。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `--es-bg` | #fff | 空态遮罩底色（ES-Plus 自己的 token，三端同源）：深色站点覆盖这一个变量，空态就不再是白板 —— 这是组件「不写死颜色」的那一处 |
| `--el-table-header-bg-color` | var(--el-fill-color-light, #f5f7fa) | 虚拟滚动表头底色：el-table-v2 不像 el-table 自带灰底，缺省两级回退 |
| `--el-border-color-lighter` | 跟随 Element Plus | 虚拟表格的单元格分隔线与 ::after 叠出来的外边框 |
| `--el-fill-color-lighter` | 跟随 Element Plus | 斑马纹偶数行底色（es-virtual-table--stripe） |
| `--el-fill-color-light` | 跟随 Element Plus | hover 行底色 |
| `--el-color-primary-light-9` | 跟随 Element Plus | 当前行（current-row）高亮底色 |
| `--el-text-color-secondary` | 跟随 Element Plus | 展开图标默认色 |
| `--el-color-primary` | 跟随 Element Plus | 展开图标 hover 色 |

## 可访问性

- 排序方向通过表头 aria-sort 暴露：排序状态机由组件自己推进（同列 asc→desc→取消、换列从 asc 起），顺带修好了 sortBy.order 恒为 undefined 导致 aria-sort 永久缺失的问题（证据：`packages/vue3/src/components/es-table/src/engines/use-virtual-sort.ts` 含 `aria-sort`）
- 工具栏与行操作按钮都是 el-button（原生 <button>），键盘可达；按钮的 hidden 是条件求值后不渲染，而不是 display:none 留在 Tab 序列里（证据：`packages/vue3/src/components/es-table/src/table-btns.vue` 含 `el-button`）
- 边界：表格行本身不可聚焦、也不能用方向键遍历（Element Plus 的 el-table 不是 grid role）—— 要键盘多选请开 multiSelect 的勾选框，那是原生 checkbox（证据：`packages/vue3/src/components/es-table/src/component.vue` 含 `multiSelect`）

## 相关

- **es-form**（/components/es-form）—— 查询表单与表格是同一套配置：es-form 的按钮 triggerEvent 直接驱动本组件重新请求
- **es-crud-page**（/components/es-crud-page）—— 整页 CRUD 时这份 columns 配置会连同工具栏、操作列、弹窗一起由 schema 派生

## 版本

| 端 | 首个包含本组件的版本 |
| --- | --- |
| vue3 | 1.4.0 |
| vue2 | 0.9.0 |
| antdv | 1.0.0 |
