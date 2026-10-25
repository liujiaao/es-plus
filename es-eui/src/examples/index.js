// --- Component imports (static — 100% reliable, no require.context ambiguity) ---
import FormBasic from './form/Basic.vue'
import FormControls from './form/Controls.vue'
import FormLayout from './form/Layout.vue'
import FormValidation from './form/Validation.vue'
import FormDynamicField from './form/DynamicField.vue'
import FormCustomRender from './form/CustomRender.vue'
import FormDynamicRule from './form/DynamicRule.vue'
import FormPolicyForm from './form/PolicyForm.vue'
import FormApiRequest from './form/ApiRequest.vue'
import FormRegionLinkage from './form/RegionLinkage.vue'
import FormRemoteRegionLinkage from './form/RemoteRegionLinkage.vue'
import FormImageUpload from './form/ImageUpload.vue'
import FormMultiImageUpload from './form/MultiImageUpload.vue'
import FormComputedFields from './form/ComputedFields.vue'
import FormDeclarativeLinkage from './form/DeclarativeLinkage.vue'
import FormDetailMode from './form/DetailMode.vue'

import TableBasic from './table/Basic.vue'
import TableAutoRequest from './table/AutoRequest.vue'
import TableCustomHttp from './table/CustomHttp.vue'
import TableRenderColumn from './table/RenderColumn.vue'
import TableLinkage from './table/Linkage.vue'
import TableMultiSelect from './table/MultiSelect.vue'
import TableActionColumn from './table/ActionColumn.vue'
import TableGroupColumn from './table/GroupColumn.vue'
import TableExpandRow from './table/ExpandRow.vue'
import TableRealWorld from './table/RealWorld.vue'
import TableTreeTable from './table/TreeTable.vue'
import TableLazyLoadTree from './table/LazyLoadTree.vue'
import TableMergeCells from './table/MergeCells.vue'
import TableComplexMerge from './table/ComplexMerge.vue'
import TableConfigBtn from './table/ConfigBtn.vue'
import TableFullHeight from './table/FullHeight.vue'
import TableSort from './table/Sort.vue'
import TableFixedColumns from './table/FixedColumns.vue'
import TableCurrentRow from './table/CurrentRow.vue'
import TableEditTable from './table/EditTable.vue'
import TableRemoteCrud from './table/RemoteCrud.vue'
import TableOptimisticToggle from './table/OptimisticToggle.vue'
import TableDetailDrawer from './table/DetailDrawer.vue'
import TableCrudEdgeCases from './table/CrudEdgeCases.vue'
import TableCodeLabel from './table/CodeLabel.vue'

import DialogBasic from './dialog/Basic.vue'
import DialogConfirm from './dialog/Confirm.vue'
import DialogCachedInstance from './dialog/CachedInstance.vue'
import DialogFormDialog from './dialog/FormDialog.vue'
import DialogDraggable from './dialog/Draggable.vue'
import DialogFullscreen from './dialog/Fullscreen.vue'
import DialogLoading from './dialog/Loading.vue'
import DialogLifecycle from './dialog/Lifecycle.vue'
import DialogCustomStyle from './dialog/CustomStyle.vue'
import DialogRenderComponent from './dialog/RenderComponent.vue'
import DialogRenderTableDialog from './dialog/RenderTableDialog.vue'
import DialogRenderComplexDialog from './dialog/RenderComplexDialog.vue'
import DialogRealWorld from './dialog/RealWorld.vue'
import DialogStepDialog from './dialog/StepDialog.vue'
import DialogMultiInstance from './dialog/MultiInstance.vue'
import DialogAsyncContent from './dialog/AsyncContent.vue'
import DialogDynamicBtn from './dialog/DynamicBtn.vue'

import CombinationQueryFormLinkage from './combination/QueryFormLinkage.vue'
import CombinationFormWithTable from './combination/FormWithTable.vue'
import CombinationDialogNativeForm from './combination/DialogNativeForm.vue'
import CombinationDialogEsForm from './combination/DialogEsForm.vue'
import CombinationDialogEsTable from './combination/DialogEsTable.vue'
import CombinationFormTableMultiSelect from './combination/FormTableMultiSelect.vue'
import CombinationDataFlowManagement from './combination/DataFlowManagement.vue'
import CombinationBatchOperation from './combination/BatchOperation.vue'
import CombinationTabMultiTable from './combination/TabMultiTable.vue'
import CombinationMasterDetail from './combination/MasterDetail.vue'
import CombinationMasterDetailFlow from './combination/MasterDetailFlow.vue'
import CombinationStepForm from './combination/StepForm.vue'
import CombinationRowApproval from './combination/RowApproval.vue'
import CombinationPermissionButtons from './combination/PermissionButtons.vue'
import CombinationBatchEdit from './combination/BatchEdit.vue'
import CombinationEditableGridSubmit from './combination/EditableGridSubmit.vue'
import CombinationImportData from './combination/ImportData.vue'

import CrudBasic from './crud/Basic.vue'
import CrudMultiDialog from './crud/MultiDialog.vue'

import VxeTableBasicSwitch from './vxe-table/BasicSwitch.vue'
import VxeTableSelectionIndex from './vxe-table/SelectionIndex.vue'
import VxeTableExpandRow from './vxe-table/ExpandRow.vue'
import VxeTableSortFormatter from './vxe-table/SortFormatter.vue'
import VxeTableCustomRender from './vxe-table/CustomRender.vue'
import VxeTableCellEdit from './vxe-table/CellEdit.vue'
import VxeTableRowEdit from './vxe-table/RowEdit.vue'
import VxeTableToolbarExport from './vxe-table/ToolbarExport.vue'
import VxeTableColumnResize from './vxe-table/ColumnResize.vue'
import VxeTableTreeData from './vxe-table/TreeData.vue'
import VxeTableProxyConfig from './vxe-table/ProxyConfig.vue'
import VxeTableFooterSummary from './vxe-table/FooterSummary.vue'
import VxeTableEscapeHatch from './vxe-table/EscapeHatch.vue'
import VxeTableCrudWithDialog from './vxe-table/CrudWithDialog.vue'
import VxeTableMergeCells from './vxe-table/MergeCells.vue'

import ErrorBoundaryBasic from './error-boundary/Basic.vue'
import SvgIconBasic from './svg-icon/Basic.vue'

const componentMap = {
  './form/Basic.vue': FormBasic,
  './form/Controls.vue': FormControls,
  './form/Layout.vue': FormLayout,
  './form/Validation.vue': FormValidation,
  './form/DynamicField.vue': FormDynamicField,
  './form/CustomRender.vue': FormCustomRender,
  './form/DynamicRule.vue': FormDynamicRule,
  './form/PolicyForm.vue': FormPolicyForm,
  './form/ApiRequest.vue': FormApiRequest,
  './form/RegionLinkage.vue': FormRegionLinkage,
  './form/RemoteRegionLinkage.vue': FormRemoteRegionLinkage,
  './form/ImageUpload.vue': FormImageUpload,
  './form/MultiImageUpload.vue': FormMultiImageUpload,
  './form/ComputedFields.vue': FormComputedFields,
  './form/DeclarativeLinkage.vue': FormDeclarativeLinkage,
  './form/DetailMode.vue': FormDetailMode,
  './table/Basic.vue': TableBasic,
  './table/AutoRequest.vue': TableAutoRequest,
  './table/CustomHttp.vue': TableCustomHttp,
  './table/RenderColumn.vue': TableRenderColumn,
  './table/Linkage.vue': TableLinkage,
  './table/MultiSelect.vue': TableMultiSelect,
  './table/ActionColumn.vue': TableActionColumn,
  './table/GroupColumn.vue': TableGroupColumn,
  './table/ExpandRow.vue': TableExpandRow,
  './table/RealWorld.vue': TableRealWorld,
  './table/TreeTable.vue': TableTreeTable,
  './table/LazyLoadTree.vue': TableLazyLoadTree,
  './table/MergeCells.vue': TableMergeCells,
  './table/ComplexMerge.vue': TableComplexMerge,
  './table/ConfigBtn.vue': TableConfigBtn,
  './table/FullHeight.vue': TableFullHeight,
  './table/Sort.vue': TableSort,
  './table/FixedColumns.vue': TableFixedColumns,
  './table/CurrentRow.vue': TableCurrentRow,
  './table/EditTable.vue': TableEditTable,
  './table/RemoteCrud.vue': TableRemoteCrud,
  './table/OptimisticToggle.vue': TableOptimisticToggle,
  './table/DetailDrawer.vue': TableDetailDrawer,
  './table/CrudEdgeCases.vue': TableCrudEdgeCases,
  './table/CodeLabel.vue': TableCodeLabel,
  './dialog/Basic.vue': DialogBasic,
  './dialog/Confirm.vue': DialogConfirm,
  './dialog/CachedInstance.vue': DialogCachedInstance,
  './dialog/FormDialog.vue': DialogFormDialog,
  './dialog/Draggable.vue': DialogDraggable,
  './dialog/Fullscreen.vue': DialogFullscreen,
  './dialog/Loading.vue': DialogLoading,
  './dialog/Lifecycle.vue': DialogLifecycle,
  './dialog/CustomStyle.vue': DialogCustomStyle,
  './dialog/RenderComponent.vue': DialogRenderComponent,
  './dialog/RenderTableDialog.vue': DialogRenderTableDialog,
  './dialog/RenderComplexDialog.vue': DialogRenderComplexDialog,
  './dialog/RealWorld.vue': DialogRealWorld,
  './dialog/StepDialog.vue': DialogStepDialog,
  './dialog/MultiInstance.vue': DialogMultiInstance,
  './dialog/AsyncContent.vue': DialogAsyncContent,
  './dialog/DynamicBtn.vue': DialogDynamicBtn,
  './combination/QueryFormLinkage.vue': CombinationQueryFormLinkage,
  './combination/FormWithTable.vue': CombinationFormWithTable,
  './combination/DialogNativeForm.vue': CombinationDialogNativeForm,
  './combination/DialogEsForm.vue': CombinationDialogEsForm,
  './combination/DialogEsTable.vue': CombinationDialogEsTable,
  './combination/FormTableMultiSelect.vue': CombinationFormTableMultiSelect,
  './combination/DataFlowManagement.vue': CombinationDataFlowManagement,
  './combination/BatchOperation.vue': CombinationBatchOperation,
  './combination/TabMultiTable.vue': CombinationTabMultiTable,
  './combination/MasterDetail.vue': CombinationMasterDetail,
  './combination/MasterDetailFlow.vue': CombinationMasterDetailFlow,
  './combination/StepForm.vue': CombinationStepForm,
  './combination/RowApproval.vue': CombinationRowApproval,
  './combination/PermissionButtons.vue': CombinationPermissionButtons,
  './combination/BatchEdit.vue': CombinationBatchEdit,
  './combination/EditableGridSubmit.vue': CombinationEditableGridSubmit,
  './combination/ImportData.vue': CombinationImportData,
  './crud/Basic.vue': CrudBasic,
  './crud/MultiDialog.vue': CrudMultiDialog,
  './vxe-table/BasicSwitch.vue': VxeTableBasicSwitch,
  './vxe-table/SelectionIndex.vue': VxeTableSelectionIndex,
  './vxe-table/ExpandRow.vue': VxeTableExpandRow,
  './vxe-table/SortFormatter.vue': VxeTableSortFormatter,
  './vxe-table/CustomRender.vue': VxeTableCustomRender,
  './vxe-table/CellEdit.vue': VxeTableCellEdit,
  './vxe-table/RowEdit.vue': VxeTableRowEdit,
  './vxe-table/ToolbarExport.vue': VxeTableToolbarExport,
  './vxe-table/ColumnResize.vue': VxeTableColumnResize,
  './vxe-table/TreeData.vue': VxeTableTreeData,
  './vxe-table/ProxyConfig.vue': VxeTableProxyConfig,
  './vxe-table/FooterSummary.vue': VxeTableFooterSummary,
  './vxe-table/EscapeHatch.vue': VxeTableEscapeHatch,
  './vxe-table/CrudWithDialog.vue': VxeTableCrudWithDialog,
  './vxe-table/MergeCells.vue': VxeTableMergeCells,
  './error-boundary/Basic.vue': ErrorBoundaryBasic,
  './svg-icon/Basic.vue': SvgIconBasic,
}

/**
 * Get Vue component by category and key.
 * @param {string} category - 'form' | 'table' | 'dialog' | 'crud' | 'combination' | 'vxe-table' | 'error-boundary' | 'svg-icon'
 * @param {string} key - PascalCase filename without .vue, e.g. 'Basic', 'AutoRequest'
 */
export function getComponent(category, key) {
  const path = `./${category}/${key}.vue`
  return componentMap[path] || null
}

// --- Raw source code (pre-generated by scripts/generate-raw-sources.js) ---
import { RAW_SOURCES } from './raw-sources.generated'

export function getRawCode(category, key) {
  return RAW_SOURCES[`${category}/${key}`] || ''
}

// --- Metadata arrays for each doc page ---

export const formExamples = [
  { key: 'Basic', title: '基础表单', description: '最简单的表单配置，只需定义 formItemList 和 model 即可快速生成表单。' },
  { key: 'Controls', title: '常用控件展示', description: '14 种控件类型，通过 formtype 配置即可切换：Input、Radio、Select、Checkbox、Switch、DatePicker、Rate 等。' },
  { key: 'Layout', title: '栅格布局与折叠', description: '通过 layoutFormProps 配置栅格布局，minFoldRows 实现折叠展开效果。' },
  { key: 'Validation', title: '表单验证', description: '内置规则 required / min / max / pattern / email，外加 validator 跨字段校验（确认密码）；configBtn 提交即触发校验。' },
  { key: 'DynamicField', title: '动态字段显示', description: '通过 isHidden 函数根据其他字段值动态显示/隐藏表单项。' },
  { key: 'CustomRender', title: 'render 自定义控件', description: 'render(h, model, { row }) 接管表单项：富文本编辑器、色板等 el 组件没有的控件照样纳入表单校验与提交。' },
  { key: 'DynamicRule', title: '动态验证规则', description: 'formItemList 由 computed 派生：开关拨动即重算规则数组，字段显隐与必填规则实时切换，无需重建表单。' },
  { key: 'PolicyForm', title: '政策编辑表单（实战）', description: '复杂企业级表单示例，包含多种控件类型、JSX 自定义渲染和分布式布局。' },
  { key: 'ApiRequest', title: '接口请求示例', description: '通过 apiParams 配置远程数据加载，支持 Select 下拉选项动态获取。' },
  { key: 'RegionLinkage', title: '省市区三级联动（静态）', description: 'Cascader 级联选择器，使用静态 dataOptions 实现省市区三级联动。' },
  { key: 'RemoteRegionLinkage', title: '远程加载省市区', description: 'Select 组件通过 apiParams 远程加载数据，实现省市区动态联动。' },
  { key: 'ImageUpload', title: '单图片上传', description: 'Upload 组件集成，自定义 httpRequest 实现图片上传预览，useDialog 实现大图预览。' },
  { key: 'MultiImageUpload', title: '多图片上传', description: '多图片上传模式，listType 设置为 picture-card，支持批量上传和预览。' },
  { key: 'ComputedFields', title: '字段联动计算', description: 'watch 监听字段变化自动回填与计算（单价×数量=小计，×折扣=应付），派生字段只读展示。' },
  { key: 'DeclarativeLinkage', title: '报销单：零回调联动', description: '省→市→门店三级下拉、选了城市才要求发票号、大区自动带出并锁定、金额 > 5000 才要求说明、非部分退款时隐藏退款原因 —— 全部来自一份纯 JSON（reactions + JSON 表达式），示例里 0 个函数。' },
  { key: 'DetailMode', title: '详情/编辑模式', description: '同一份 formItemList 通过 computed 切换 attrs.disabled，实现详情与编辑双模式复用。' },
]

export const tableExamples = [
  { key: 'Basic', title: '基础表格', description: '最简单的表格配置，只需定义 columns 和 data 即可快速生成数据表格。' },
  { key: 'AutoRequest', title: '全自动数据表格', description: '通过 apiParams 配置远程数据源，表格自动请求数据并处理分页。' },
  { key: 'CustomHttp', title: '自定义请求实例', description: '自定义 httpRequest 方法，支持 Token 注入、错误处理等个性化需求。' },
  { key: 'RenderColumn', title: 'Render 列渲染', description: '通过 render 函数自定义列内容，支持按钮、标签等 JSX 渲染。' },
  { key: 'Linkage', title: '表格表单联动', description: 'EsForm + EsTable 组合使用，表单查询条件触发表格数据刷新。' },
  { key: 'MultiSelect', title: '跨页选择记忆', description: 'multiSelect + cachePageSelection 解决 el-table 切换分页选择丢失的痛点。' },
  { key: 'ActionColumn', title: '声明式操作列（btns）', description: '通过 btns 配置声明式操作列，支持查看、编辑、删除等行操作按钮；图标/类型/回调全走配置，不写模板。' },
  { key: 'GroupColumn', title: '多级表头', description: '通过 groups 配置多级表头（表头分组），适用于复杂报表场景。' },
  { key: 'ExpandRow', title: '展开行：自定义详情区', description: 'type: "expand" 配置展开行，展开区内容用 render 自由渲染，适合「列表精简 + 详情随行展开」。' },
  { key: 'RealWorld', title: '政策管理表格（实战）', description: '生产级完整示例：EsForm + EsTable + useDialog 实现 CRUD 完整业务闭环。' },
  { key: 'TreeTable', title: '树形表格：children 自动成树', description: '数据自带 children 字段即可渲染树形表格，无需额外转换；配合 row-key 保持展开状态。' },
  { key: 'LazyLoadTree', title: '懒加载树形表格', description: 'lazy + lazyLoad 实现树形节点的懒加载，适用于大数据量树形场景。' },
  { key: 'MergeCells', title: '声明式合并单元格', description: 'mergeConfig.rowsBy 按相邻相等值合并单元格：纯 JSON、三端通用，不需要手写 span 函数。' },
  { key: 'ComplexMerge', title: '复杂多列合并（函数式 spanMethod）', description: '多维合并单元格，根据多个条件动态计算 rowspan 和 colspan —— 这是 Tier-3 逃生舱，不能跨端复用。' },
  { key: 'ConfigBtn', title: '工具栏按钮：左右分栏', description: 'configBtn 配置表格工具栏按钮，可按左右两区分栏布局，常用操作靠右。' },
  { key: 'FullHeight', title: '继承父容器高度', description: 'tabHeight: "100%" 实现表格高度自适应父容器。' },
  { key: 'Sort', title: '列排序与自定义比较', description: 'sortable 启用列排序，sortMethod 自定义比较（按数值/时间戳），@sort-change 监听排序变化。' },
  { key: 'FixedColumns', title: '首尾固定列', description: 'fixed: "left" / "right" 固定两侧列，中间列横向滚动，配合固定高度体验最佳。' },
  { key: 'CurrentRow', title: '当前行高亮', description: 'highlightCurrentRow 单行高亮 + @current-change 事件，常用于主从表联动。' },
  { key: 'EditTable', title: '行内编辑', description: '单元格点击进入编辑态，render 切换编辑器/文本，快照实现取消还原。' },
  { key: 'RemoteCrud', title: '远程 CRUD 闭环', description: '共享假后端：服务端搜索+分页 + 新增/编辑弹窗（编辑前拉取最新详情）+ 删除，写操作真实异步并 refetch。' },
  { key: 'OptimisticToggle', title: '乐观更新 + 失败回滚', description: '切换状态立即改 UI 并异步提交，失败自动回滚原值；「模拟失败」开关演示回滚，按行 loading 防并发。' },
  { key: 'DetailDrawer', title: '只读详情抽屉', description: '列表精简、详情完整：点「查看」按 id 异步拉取最新详情并在抽屉展示加载态，详情与列表数据解耦。' },
  { key: 'CrudEdgeCases', title: 'CRUD 边界场景', description: '422 字段错误回填对应表单项、删除本页最后一条自动回退一页、删除延迟提交可撤销，三个易忽略的健壮性边界。' },
  { key: 'CodeLabel', title: '码值列：零 render 出标签', description: '状态是 0/1/2 这样的码值，列上写一份 dataOptions 就得到中文标签与语义色 —— 渲染成原生 el-tag（vue3 / antdv 分别是 ElTag / a-tag），不写 render 函数；未命中显示原值，空值走 emptyPlaceholder。' },
]

export const dialogExamples = [
  { key: 'Basic', title: '基础弹窗', description: 'useDialog 最简用法：一个函数调用即可打开弹窗。' },
  { key: 'Confirm', title: '确认弹窗：语义按钮 + 关闭拦截', description: 'configBtn 按语义配危险/主色按钮；beforeClose(done) 在 X、遮罩、ESC 三条关闭路径上拦一道，未保存改动不会丢。' },
  { key: 'FormDialog', title: '表单弹窗 (JSX + EsForm)', description: 'JSX render 函数中使用 EsForm，实现表单弹窗。' },
  { key: 'Draggable', title: '可拖拽弹窗', description: 'isDraggable: true 开启弹窗拖拽功能。' },
  { key: 'Fullscreen', title: '全屏弹窗', description: 'fullscreen: true 开启全屏弹窗模式。' },
  { key: 'Loading', title: '加载态：先开后填', description: '先开弹窗占位，instance.loading 控制遮罩，数据到达后再回填内容——避免点按钮后长时间无反馈。' },
  { key: 'Lifecycle', title: '生命周期：回调驱动页面状态', description: 'onOpen / onClosed 回调把打开/关闭次数与时刻写到页面上，不用开控制台。' },
  { key: 'CustomStyle', title: 'customClass 容器样式', description: 'customClass 给弹窗外层挂自定义类名，圆角/背景/阴影等视觉细节不用改组件源码。' },
  { key: 'RenderComponent', title: 'JSX 渲染 EsForm 表单', description: '使用 JSX render 函数渲染 EsForm，getRefs 获取表单实例进行验证。' },
  { key: 'RenderTableDialog', title: 'JSX 渲染 EsTable 表格', description: '使用 JSX render 函数渲染 EsTable，支持多选和事件监听。' },
  { key: 'RenderComplexDialog', title: 'JSX 复杂内容弹窗', description: 'el-tabs 多标签页 + 多个 EsForm + 动态标签管理，展示弹窗承载复杂内容的能力。' },
  { key: 'RealWorld', title: '实战表单弹窗', description: '预创建 dialog 实例，支持新增/编辑两个场景，完整表单验证流程。' },
  { key: 'StepDialog', title: '分步表单弹窗', description: 'el-steps + 分步 EsForm + 分步校验，isHiddenFooter 自绘导航按钮，getRefs 校验当前步。' },
  { key: 'MultiInstance', title: '多实例弹窗', description: 'onlyInstance: true 下同一 useDialog 可同时打开多个互不干扰的实例。' },
  { key: 'AsyncContent', title: '异步内容弹窗', description: '打开后加载远程数据，instance.loading 控制遮罩，数据到达自动重渲染。' },
  { key: 'DynamicBtn', title: '动态按钮弹窗', description: 'configBtn 的 disabled 支持函数形式，随内容实时启停（审批场景）。' },
  { key: 'CachedInstance', title: '实例缓存：关闭不等于销毁', description: 'cacheKey 让弹窗关闭后保留实例（10 分钟未再打开才回收），重新打开时表单草稿、tab 选中原样还在。' },
]

export const crudExamples = [
  { key: 'MultiDialog', title: '多弹窗 CRUD', description: '一张表挂「详情」「编辑」两个弹窗：「详情」用 render 自定义内容，「编辑」用 formItems + onConfirm 写回。' },
  { key: 'Basic', title: '基础 CRUD 页', description: '一份 schema 生成查询表单 + 表格 + 分页 + 新增/编辑弹窗；toolbarBtns 与 operationColumn 上的 dialogKey 决定开哪个弹窗。' },
]

export const combinationExamples = [
  { key: 'QueryFormLinkage', title: '查询表单联动', description: 'EsForm + EsTable 查询联动：表单条件变化自动触发表格数据查询。' },
  { key: 'FormWithTable', title: '表单内嵌表格', description: 'EsForm 的 render 函数中内嵌 EsTable 组件。' },
  { key: 'DialogNativeForm', title: '弹窗 + 原生表单', description: 'useDialog + el-form 组合，Vue.observable 实现弹窗内响应式数据。' },
  { key: 'DialogEsForm', title: '弹窗 + EsForm (推荐)', description: 'useDialog + EsForm 推荐方案，getRefs 验证表单。' },
  { key: 'DialogEsTable', title: '弹窗 + EsTable', description: 'useDialog + EsTable，弹窗内展示数据表格并支持选择。' },
  { key: 'FormTableMultiSelect', title: '多选 + 表单联动', description: 'EsForm + EsTable 多选，表单筛选与批量操作联动。' },
  { key: 'DataFlowManagement', title: '行内编辑 + EsForm', description: 'EsTable 行内编辑，render 函数动态切换编辑/查看模式。' },
  { key: 'BatchOperation', title: '批量操作', description: 'EsTable 多选 + useDialog 批量操作确认与执行。' },
  { key: 'TabMultiTable', title: '多标签页表格', description: 'el-tabs 切换不同 EsTable，每个标签页独立管理数据。' },
  { key: 'MasterDetail', title: '主子表联动编辑', description: 'useDialog + EsForm + EsTable 主子表，Vue.observable 管理明细数据，动态计算合计。' },
  { key: 'MasterDetailFlow', title: '主表点选 → 从表重查', description: '点订单行 → 从表按订单号重查（嵌套信封用 configTableOut 声明映射）；编辑明细 → 主表金额与「已修改」标记回写。listenToCallBack 只做响应加工，不是跨组件信号。' },
  { key: 'StepForm', title: '分步表单', description: 'el-steps + 多个 EsForm 共用 model，逐步 validate 校验，末步核对后提交。' },
  { key: 'RowApproval', title: '行审批流转', description: '声明式 operate 列 btns（hidden 函数动态显隐）+ 行级状态流转 + 驳回原因弹窗。' },
  { key: 'PermissionButtons', title: '按钮权限控制', description: '按角色切换 $EsPlus.permission，EsForm configBtn 与 EsTable operate btns 的 permissionValue 联动显隐。' },
  { key: 'BatchEdit', title: '多选批量编辑', description: '勾选多行 → 批量修改部门/状态（仅提交勾选字段）→ api.batchUpdate 一次提交 → refetch + 清空勾选。' },
  { key: 'EditableGridSubmit', title: '可编辑表格批量提交', description: '行内编辑/新增/删除，前端跟踪「新增/修改/删除」三类脏数据，一次性批量提交后端并回读。' },
  { key: 'ImportData', title: '可回滚的批量导入', description: 'CSV 前端校验（必填/枚举/数字/重复）→ 错误行用 EsForm 就地修正 → 每 3 条一批提交；服务端只裁决审批阈值，被拒行修正后只补交待导入行；结果表由 entryQuery 带入批次号重查，整批可回滚。' },
]

export const vxeTableExamples = [
  { key: 'BasicSwitch', title: '引擎切换工作台：500 → 5 万行', description: '同一份工单数据现场切换 el-table / vxe-grid：实测渲染耗时与表体 DOM 行数；勾选、排序、列宽写在配置里随引擎保留；5 万行只给 vxe —— 把 engine 从"玩具开关"变成可观测的能力上限。' },
  { key: 'SelectionIndex', title: '多选与序号列', description: 'type:"selection" 复选框列 + type:"index" 序号列；getSelectionRows / clearSelection 获取/清空选中。' },
  { key: 'ExpandRow', title: '展开行', description: 'type:"expand" 展开行，通过 render 自定义展开内容，支持 el-descriptions 详情卡。' },
  { key: 'SortFormatter', title: '排序与格式化', description: 'sortable 列排序 + formatter 函数格式化 + vxeColumn.formatter 原生格式化，三种写法对比。' },
  { key: 'CustomRender', title: '自定义 render 渲染', description: 'render(h, { value, row, index }) 与 el-table 相同 API，vxe 引擎桥接透传，无缝兼容。' },
  { key: 'CellEdit', title: '单元格编辑', description: 'editConfig.mode:"cell" 单元格编辑，editRender $input/$select，getUpdateRecords 获取修改记录。' },
  { key: 'RowEdit', title: '行编辑与校验', description: 'editConfig.mode:"row" 整行编辑，vxeColumn.rules 校验规则，getInsertRecords/getRemoveRecords 获取变更。' },
  { key: 'ToolbarExport', title: '工具栏与导出', description: 'toolbarConfig 内置缩放/全屏/自定义列；exportConfig 导出 CSV；print 打印。' },
  { key: 'ColumnResize', title: '列宽调整与键盘鼠标', description: 'columnConfig.resizable 拖拽调列宽；keyboardConfig 方向键导航；mouseConfig.selected 点击选中单元格。' },
  { key: 'TreeData', title: '树形数据', description: 'treeConfig.transform 自动将 { id, parentId } 扁平数组构造树形，expandAll/collapseAll 展开折叠。' },
  { key: 'ProxyConfig', title: 'proxyConfig 服务端分页', description: 'proxyConfig.ajax.query 接管请求，vxe 自管分页，EsForm 搜索触发 commitProxy("query") 重载。' },
  { key: 'FooterSummary', title: '汇总行 footerMethod', description: 'showFooter + footerMethod 动态计算合计行，随数据变化实时更新。' },
  { key: 'EscapeHatch', title: '逃生舱 vxeConfig + vxeOn', description: 'vxeConfig 深度合并任意 vxe-grid 原生配置；vxeOn 注入 cell-click / sort-change 等原生事件。' },
  { key: 'CrudWithDialog', title: '完整 CRUD + useDialog', description: '搜索（EsForm）+ 多选分页表格（engine:vxe）+ useDialog 新增/编辑弹窗 + 删除确认 —— 完整业务闭环。' },
  { key: 'MergeCells', title: '复杂合并单元格', description: '两级分组表头（4 组）+ spanMethod 行列动态合并 + mergeFooterItems 表尾合并 + 可编辑实时重算；表单联动切换合并模式。' },
]

export const errorBoundaryExamples = [
  {
    key: 'Basic',
    title: '故障注入台：一处坏掉，整页还在',
    description:
      '两个会抛错的子组件分别走「自定义 fallback + reset」与「只给 fallback-text + ref.reset()」两条恢复路径；error 事件实时落到日志，边界外的按钮全程可点 —— 隔离是能被操作验证的。'
  },
]

export const svgIconExamples = [
  {
    key: 'Basic',
    title: '一个图标出口：尺寸 / 着色 / 类名 / 外部图片',
    description:
      '内联一份雪碧图即可跑：字号控制尺寸、color 控制颜色、className 追加装饰样式，最后的协议地址切到外部图片模式。组件只输出那一个 1em 的图标，其余全部交给宿主。'
  },
]
