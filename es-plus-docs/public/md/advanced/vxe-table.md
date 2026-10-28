---
title: '高性能 vxe-table 表格'
route: '/advanced/vxe-table'
canonical: 'https://liujiaao.github.io/es-plus/#/advanced/vxe-table'
source: 'es-plus-docs/src/views/advanced-doc.data.ts'
type: 'advanced'
---

# 高性能 vxe-table 表格

> 通过 options.engine: "vxe" 一行切换至 vxe-table 高性能引擎，获得虚拟滚动、行内编辑、树形数据、导出、工具栏、服务端分页等企业级能力，同时保持 es-plus 配置化与联动范式不变。引擎可以运行期切换：同一份 columns / data 在两个渲染层之间现场迁移，勾选、排序、列宽随配置保留。

## 能力

- **一行切换引擎** —— options.engine: "vxe" 即可切换，列配置/联动/render 零改动
- **行内编辑** —— cell/row 两种模式，editRender 配置 $input/$select，内置校验
- **工具栏与导出** —— toolbarConfig 内置缩放/全屏，exportConfig 一键导出 CSV
- **proxyConfig 服务端分页** —— 完全托管分页状态，与 EsForm 搜索联动零代码
- **树形数据** —— treeConfig.transform 自动将扁平数组构造为树形
- **逃生舱** —— vxeConfig 深度合并原生配置，vxeOn 注入任意 vxe 事件

## 示例

- 引擎切换工作台：500 → 5 万行 —— 同一份工单数据现场切换 el-table / vxe：实测渲染耗时与表体 DOM 行数；勾选、排序、列宽写在配置里随引擎保留；5 万行只给 vxe —— 把 engine 从"玩具开关"变成可观测的能力上限。
- 多选与序号列 —— type:"selection" 复选框列 + type:"index" 序号列；rowkey 驱动 vxe reserve：翻页不丢勾选、回页自动回勾。selection-change 只报当前页，跨页全集用 getSelectionRows()，clearSelection() 连 reserve 一起清。
- 展开行 —— type:"expand" 展开行的内容用列 render 返回（ElDescriptions 详情卡），不写插槽、不写模板。
- 排序与格式化 —— sortable 列排序 + formatter 函数格式化 + vxeColumn.formatter 原生格式化，三种写法对比。
- render 自定义列：vxe 同 API —— render(h, {value, row, index}) 与 el-table 相同 API，vxe 引擎通过 RenderDomTb 桥接透传，无缝兼容。
- 单元格编辑 —— editConfig.mode:"cell" 单元格编辑，editRender $input/$select，getUpdateRecords 获取修改记录。
- 行编辑与校验 —— editConfig.mode:"row" 整行编辑，vxeColumn.rules 校验规则，getInsertRecords/getRemoveRecords 获取变更。
- 工具栏与导出 —— toolbarConfig 内置缩放/全屏/自定义列；exportConfig 导出 CSV；print 打印。
- 列宽调整与键盘鼠标 —— columnConfig.resizable 拖拽调列宽；keyboardConfig 方向键导航；mouseConfig.selected 点击选中单元格。
- 树形数据 —— treeConfig.transform 自动将 {id, parentId} 扁平数组构造树形，expandAll/collapseAll 展开折叠。
- proxyConfig 服务端分页 —— proxyConfig.ajax.query 接管请求，vxe 自管分页；表单与表格兄弟布局，查询/重置回调 commitProxy("reload") 重置页码并重查。
- 汇总行 footerMethod —— showFooter + footerMethod 动态计算合计行，随数据变化实时更新。
- 逃生舱 vxeConfig + vxeOn —— vxeConfig 深度合并任意 vxe-grid 原生配置；vxeOn 注入 cell-click / sort-change 等原生事件。
- vxe 业务闭环：查询·多选·弹窗 —— 搜索（EsForm）+ 多选分页表格（engine:vxe）+ useDialog 新增/编辑弹窗 + 删除确认 — 完整业务闭环。
- 分组表头 + 动态行合并 + 打印 —— 两级分组表头 groups + spanMethod 动态行合并 + mergeFooterItems 多行表尾；表单控合并模式，patchHtmlRowSpans 让合并单元格可打印。

## API

### TableOptions（vxe 引擎新增项）

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| engine | "vxe" | 切换至 vxe-table 高性能引擎，列配置 / 联动 / render 函数零改动 |
| spanMethod | ({ row, rowIndex, column, columnIndex }) => { rowspan, colspan } | 行列动态合并，与 el-table 同签名；{rowspan:0} 表示该格被上方格覆盖。注意：不可与 vxeConfig.mergeCells 同时使用；动态合并打印需配合 patchHtmlRowSpans |
| showFooter | boolean | 是否显示合计行（tfoot），需配合 footerMethod 或 footerData 使用，缺少此项合计行不显示 |
| footerMethod | ({ columns, data }) => any[][] | 合计行动态计算函数，返回二维数组，每个子数组对应一行合计，下标与列一一对应；与 footerData 二选一 |
| footerData | any[][] | 合计行静态数据（格式与 footerMethod 返回值相同），适合固定合计行内容的场景 |
| editConfig | { mode, trigger, showStatus?, autoClear? } | mode:"cell" 单元格编辑 \| "row" 整行编辑；trigger:"click"\|"dblclick"\|"manual"；设置后 keepSource 自动为 true，可追踪增删改 |
| printConfig | boolean \| VxeGridPrintConfig | true 使用默认打印配置，或传 { columns, style, sheetName } 自定义。启用后 toolbarConfig.print 按钮才能生效 |
| toolbarConfig | { zoom?, custom?, export?, print?, refresh?, slots? } | 工具栏：zoom 全屏，custom 自定义列，export 导出，print 打印，refresh 刷新。toolbarConfig:true 展开为 { export:true, refresh:true, custom:true } |
| exportConfig | boolean \| { filename?, type?, sheetName?, useStyle? } | type:"csv"（默认）\| "xlsx"（需安装 @vxe-table/plugin-export-xlsx）；exportConfig:true 使用默认配置 |
| columnConfig | { resizable?, minResizableWidth?, maxResizableWidth? } | 全局列配置，resizable:true 允许用户拖拽调整列宽 |
| keyboardConfig | { isArrow?, isEnter?, isTab?, isEdit? } | isArrow 方向键移动单元格，isEnter 回车确认并向下，isTab Tab 切列，isEdit 字符键直接触发编辑 |
| mouseConfig | { selected? } | selected:true 点击单元格高亮选中，方向键可在单元格间移动 |
| validConfig | { autoPos?, message? } | autoPos:true 校验后自动定位首个错误格；message:"tooltip"\|"modal" 错误提示方式 |
| treeConfig | { transform?, rowField?, parentField?, expandAll? } | transform:true 自动将扁平 [{id,parentId}] 构造树形；某列需设置 vxeColumn.treeNode:true 作为展开节点列 |
| proxyConfig | { autoLoad?, ajax: { query, queryAll? }, response? } | vxe 接管分页：ajax.query({ page, form }) 返回后端数据；response.list/total 映射响应字段（vxe 4.6+ 推荐，旧写法 props 仍兼容）；autoLoad:true 挂载自动请求。commitProxy("reload") 重置到第 1 页再查，commitProxy("query") 沿用当前页 |
| expandConfig | { trigger?, accordion?, lazy?, loadMethod? } | trigger:"row"\|"manual"；accordion:true 手风琴模式；lazy+loadMethod 懒加载展开内容 |
| seqConfig | { startIndex?, seqMethod? } | 序号列配置：startIndex 指定起始序号（默认 1），seqMethod 自定义生成函数；配合 snIndex:true 使用 |
| vxeConfig | VxeGridProps | 逃生舱：深度合并至 vxe-grid 原生配置，优先级高于所有一等公民字段，可设置 mergeHeaderCells / mergeCells / mergeFooterItems 等静态合并 |
| vxeOn | Record<string, Function> | 逃生舱：注入 vxe 原生事件，键名为 vxe 事件名（kebab-case），如 "cell-click"、"edit-closed"、"zoom"、"scroll" |

### TableOptions（通用字段 · vxe 注意事项）

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| rowkey | string | 【vxe 引擎必须设置】默认映射为 "id"；缺少 rowkey 时跨页多选（reserve）无法保留选中行，会收到控制台警告 |
| multiSelect | boolean | vxe 引擎映射为 checkboxConfig.reserve:true，自动支持跨页保留选中；须配合 rowkey 使用 |
| snIndex | boolean | vxe 引擎映射为 type:seq 列；起始序号可通过 seqConfig.startIndex 调整 |
| headerCellStyle | object \| Function \| false | vxe 引擎映射为 headerCellConfig.style，默认为 { background:"#f5f7fa" }（与 el-table 保持一致）；显式设置 false 可关闭默认背景 |
| cellStyle / cellClassName | object \| string \| Function | vxe 引擎映射为 cellConfig.style / cellConfig.className，函数参数为 { row, rowIndex, column, columnIndex } |
| rowClassName / rowStyle | string \| Function | vxe 引擎映射为 rowConfig.className / rowConfig.style，函数参数为 { row, rowIndex } |
| defaultSort | { prop, order } | vxe 引擎将 order 映射：ascending→asc，descending→desc，注入 sortConfig.defaultSort |
| heightType | "auto" \| "height" \| "maxHeight" | "auto" 自适应，"height" 固定高度（超出滚动），"maxHeight" 最大高度，vxe 引擎完整兼容 |

### TableColumn（vxe 引擎新增项）

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| groups | TableColumn[] | 多级表头：子列数组，支持任意嵌套层级。父列只设 label（不设 prop），子列设 prop+label；vxe 引擎渲染为 children 多列分组 |
| editRender | { name, props?, options?, events? } | 列编辑器：name 支持内置 $input/$select/$switch/$textarea，或自定义已注册组件名；props 传给编辑组件的属性；options 下拉选项 |
| vxeColumn | VxeColumnProps | 逃生舱：原生 vxe-column 任意配置，如 rules（单元格校验规则）、formatter（vxe 原生格式化）、treeNode:true（树形节点展开列） |
| footerFormatter | ({ items, column }) => string | 合计行单元格格式化，仅在 options.showFooter:true 时生效；items 为该列所有行的数据值数组，可用于求和/平均等计算 |

### 暴露方法（TableEngineExposed）

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| vxeInstance() | () => VxeGridInstance | 获取原始 vxe-grid 实例，可调用全部 vxe API（60+ 方法 / 45+ 事件）。常用于 getPrintHtml、commitProxy 等未封装方法 |
| getTableRef() | () => VxeGridInstance | 等价于 vxeInstance()，获取 vxe-grid DOM 引用 |
| doLayout() | () => void | 重新计算列宽和表格布局（内部调用 recalculate(true)），容器尺寸变化后或动态列变更后调用 |
| toggleRowSelection(row, selected?) | (row, selected?: boolean) => void | 勾选 / 取消指定行：selected=true 勾选，false 取消，不传则切换当前状态 |
| clearSelection() | () => void | 清除所有复选框选中状态（含跨页缓存 reserves） |
| getSelectedRows() | () => any[] | 获取当前所有选中行（含跨页缓存），返回行数据数组 |
| scrollToRow(rowIndex) | (rowIndex: number) => void | 滚动到指定行（数据下标，从 0 开始） |
| clearActived() | () => Promise<void> | 退出当前激活的编辑单元格，行编辑模式下同时取消整行编辑状态 |
| clearValidate() | () => Promise<void> | 清除所有单元格的校验错误提示（不影响数据，只清 UI 错误态） |
| validate(rows?) | (rows?: any[]) => Promise<any> | 触发行内编辑校验；不传参校验全部行；返回 Promise，校验失败时 reject 携带错误信息 |
| getInsertRecords() | () => any[] | 获取未保存的新增行列表（由 keepSource 追踪，设置 editConfig 后自动开启） |
| getUpdateRecords() | () => any[] | 获取已修改行列表（与 keepSource 记录的原始数据比对差异） |
| getRemoveRecords() | () => any[] | 获取已标记删除的行列表 |
| revertData(rows?) | (rows?: any \| any[]) => Promise<void> | 还原到编辑前状态：不传参还原所有行，传入指定行对象仅还原对应行 |
| exportData(opts?) | (opts?: VxeExportConfig) => Promise<void> | 触发数据导出，参数覆盖 options.exportConfig；可指定 filename/type/columns 等 |
| print() | () => Promise<void> | 触发 vxe 内置打印窗口，需先在 options 中设置 printConfig:true；动态 spanMethod 合并场景请改用 vxeInstance().print({ html: patchHtmlRowSpans(...) }) |

### 打印工具函数

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| patchHtmlRowSpans(html, spanFn) | (html: string, spanFn: (ri, ci) => { rowspan, colspan }) => string | 修正 vxe getPrintHtml 输出的 tbody rowspan/colspan，解决 spanMethod 动态合并在打印中失效的问题。从 es-plus 按需导入：import { patchHtmlRowSpans } from "es-plus" |
