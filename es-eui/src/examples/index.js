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

import DialogBasic from './dialog/Basic.vue'
import DialogConfirm from './dialog/Confirm.vue'
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
import CombinationStepForm from './combination/StepForm.vue'
import CombinationRowApproval from './combination/RowApproval.vue'
import CombinationPermissionButtons from './combination/PermissionButtons.vue'
import CombinationBatchEdit from './combination/BatchEdit.vue'
import CombinationEditableGridSubmit from './combination/EditableGridSubmit.vue'
import CombinationImportData from './combination/ImportData.vue'

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
  './dialog/Basic.vue': DialogBasic,
  './dialog/Confirm.vue': DialogConfirm,
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
  './combination/StepForm.vue': CombinationStepForm,
  './combination/RowApproval.vue': CombinationRowApproval,
  './combination/PermissionButtons.vue': CombinationPermissionButtons,
  './combination/BatchEdit.vue': CombinationBatchEdit,
  './combination/EditableGridSubmit.vue': CombinationEditableGridSubmit,
  './combination/ImportData.vue': CombinationImportData,
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
}

/**
 * Get Vue component by category and key.
 * @param {string} category - 'form' | 'table' | 'dialog' | 'combination' | 'vxe-table'
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
  { key: 'Layout', title: '栅格布局与折叠', description: '通过 layoutFormProps 配置栅格布局，minfoldRows 实现折叠展开效果。' },
  { key: 'Validation', title: '表单验证', description: '内置验证规则支持：required、min、max、pattern、email 等，configBtn 配置提交按钮自动触发验证。' },
  { key: 'DynamicField', title: '动态字段显示', description: '通过 isHiden 函数根据其他字段值动态显示/隐藏表单项。' },
  { key: 'CustomRender', title: '自定义渲染', description: '通过 render 函数自定义表单项渲染，支持富文本编辑器、颜色选择器等复杂控件。' },
  { key: 'DynamicRule', title: '动态验证规则', description: '通过 :key 强制重新渲染表单，实现验证规则的动态切换。' },
  { key: 'PolicyForm', title: '政策编辑表单（实战）', description: '复杂企业级表单示例，包含多种控件类型、JSX 自定义渲染和分布式布局。' },
  { key: 'ApiRequest', title: '接口请求示例', description: '通过 apiParams 配置远程数据加载，支持 Select 下拉选项动态获取。' },
  { key: 'RegionLinkage', title: '省市区三级联动（静态）', description: 'Cascader 级联选择器，使用静态 dataOptions 实现省市区三级联动。' },
  { key: 'RemoteRegionLinkage', title: '远程加载省市区', description: 'Select 组件通过 apiParams 远程加载数据，实现省市区动态联动。' },
  { key: 'ImageUpload', title: '单图片上传', description: 'Upload 组件集成，自定义 httpRequest 实现图片上传预览，useDialog 实现大图预览。' },
  { key: 'MultiImageUpload', title: '多图片上传', description: '多图片上传模式，listType 设置为 picture-card，支持批量上传和预览。' },
  { key: 'ComputedFields', title: '字段联动计算', description: 'watch 监听字段变化自动回填与计算（单价×数量=小计，×折扣=应付），派生字段只读展示。' },
  { key: 'DetailMode', title: '详情/编辑模式', description: '同一份 formItemList 通过 computed 切换 attrs.disabled，实现详情与编辑双模式复用。' },
]

export const tableExamples = [
  { key: 'Basic', title: '基础表格', description: '最简单的表格配置，只需定义 columns 和 data 即可快速生成数据表格。' },
  { key: 'AutoRequest', title: '全自动数据表格', description: '通过 apiParams 配置远程数据源，表格自动请求数据并处理分页。' },
  { key: 'CustomHttp', title: '自定义请求实例', description: '自定义 httpRequest 方法，支持 Token 注入、错误处理等个性化需求。' },
  { key: 'RenderColumn', title: 'Render 列渲染', description: '通过 render 函数自定义列内容，支持按钮、标签等 JSX 渲染。' },
  { key: 'Linkage', title: '表格表单联动', description: 'EsForm + EsTable 组合使用，表单查询条件触发表格数据刷新。' },
  { key: 'MultiSelect', title: '跨页选择记忆', description: 'multiSelect + cachePageSelection 解决 el-table 切换分页选择丢失的痛点。' },
  { key: 'ActionColumn', title: '操作列示例', description: '通过 btns 配置声明式操作列，支持查看、编辑、删除等行操作按钮。' },
  { key: 'GroupColumn', title: '多级表头', description: '通过 groups 配置多级表头（表头分组），适用于复杂报表场景。' },
  { key: 'ExpandRow', title: '展开行', description: 'type: "expand" 配置展开行，支持自定义展开内容渲染。' },
  { key: 'RealWorld', title: '政策管理表格（实战）', description: '生产级完整示例：EsForm + EsTable + useDialog 实现 CRUD 完整业务闭环。' },
  { key: 'TreeTable', title: '树形表格', description: '支持树形数据展示，通过 children 字段自动构建树形结构。' },
  { key: 'LazyLoadTree', title: '懒加载树形表格', description: 'lazy + lazyLoad 实现树形节点的懒加载，适用于大数据量树形场景。' },
  { key: 'MergeCells', title: '合并单元格', description: '通过 spanMethod 实现行/列动态合并单元格。' },
  { key: 'ComplexMerge', title: '复杂多列合并', description: '多维合并单元格，根据多个条件动态计算 rowspan 和 colspan。' },
  { key: 'ConfigBtn', title: '表格按钮配置', description: 'configBtn 配置表格工具栏按钮，支持左侧/右侧分栏布局。' },
  { key: 'FullHeight', title: '继承父容器高度', description: 'tabHeight: "100%" 实现表格高度自适应父容器。' },
  { key: 'Sort', title: '列排序', description: 'sortable 启用列排序，sortMethod 自定义比较（按数值/时间戳），@sort-change 监听排序变化。' },
  { key: 'FixedColumns', title: '固定列', description: 'fixed: "left" / "right" 固定两侧列，中间列横向滚动，配合固定高度体验最佳。' },
  { key: 'CurrentRow', title: '当前行高亮', description: 'highlightCurrentRow 单行高亮 + @current-change 事件，常用于主从表联动。' },
  { key: 'EditTable', title: '行内编辑', description: '单元格点击进入编辑态，render 切换编辑器/文本，快照实现取消还原。' },
  { key: 'RemoteCrud', title: '远程 CRUD 闭环', description: '共享假后端：服务端搜索+分页 + 新增/编辑弹窗（编辑前拉取最新详情）+ 删除，写操作真实异步并 refetch。' },
  { key: 'OptimisticToggle', title: '乐观更新 + 失败回滚', description: '切换状态立即改 UI 并异步提交，失败自动回滚原值；「模拟失败」开关演示回滚，按行 loading 防并发。' },
  { key: 'DetailDrawer', title: '只读详情抽屉', description: '列表精简、详情完整：点「查看」按 id 异步拉取最新详情并在抽屉展示加载态，详情与列表数据解耦。' },
  { key: 'CrudEdgeCases', title: 'CRUD 边界场景', description: '422 字段错误回填对应表单项、删除本页最后一条自动回退一页、删除延迟提交可撤销，三个易忽略的健壮性边界。' },
]

export const dialogExamples = [
  { key: 'Basic', title: '基础弹窗', description: 'useDialog 最简用法：一个函数调用即可打开弹窗。' },
  { key: 'Confirm', title: '确认弹窗', description: 'configBtn 配置确认/取消按钮，onSubmit 回调处理确认逻辑。' },
  { key: 'FormDialog', title: '表单弹窗 (JSX + EsForm)', description: 'JSX render 函数中使用 EsForm，实现表单弹窗。' },
  { key: 'Draggable', title: '可拖拽弹窗', description: 'isDraggable: true 开启弹窗拖拽功能。' },
  { key: 'Fullscreen', title: '全屏弹窗', description: 'fullscreen: true 开启全屏弹窗模式。' },
  { key: 'Loading', title: '加载状态', description: '弹窗加载状态，动态更新弹窗内容。' },
  { key: 'Lifecycle', title: '生命周期', description: 'onOpen / onClosed 生命周期回调监听弹窗打开和关闭。' },
  { key: 'CustomStyle', title: '自定义样式', description: 'customClass 自定义弹窗样式类名。' },
  { key: 'RenderComponent', title: 'JSX 渲染 EsForm 表单', description: '使用 JSX render 函数渲染 EsForm，getRefs 获取表单实例进行验证。' },
  { key: 'RenderTableDialog', title: 'JSX 渲染 EsTable 表格', description: '使用 JSX render 函数渲染 EsTable，支持多选和事件监听。' },
  { key: 'RenderComplexDialog', title: 'JSX 复杂内容弹窗', description: 'el-tabs 多标签页 + 多个 EsForm + 动态标签管理，展示弹窗承载复杂内容的能力。' },
  { key: 'RealWorld', title: '实战表单弹窗', description: '预创建 dialog 实例，支持新增/编辑两个场景，完整表单验证流程。' },
  { key: 'StepDialog', title: '分步表单弹窗', description: 'el-steps + 分步 EsForm + 分步校验，isHiddenFooter 自绘导航按钮，getRefs 校验当前步。' },
  { key: 'MultiInstance', title: '多实例弹窗', description: 'onlyInstance: false 下同一 useDialog 可同时打开多个互不干扰的实例。' },
  { key: 'AsyncContent', title: '异步内容弹窗', description: '打开后加载远程数据，instance.loading 控制遮罩，数据到达自动重渲染。' },
  { key: 'DynamicBtn', title: '动态按钮弹窗', description: 'configBtn 的 disabled 支持函数形式，随内容实时启停（审批场景）。' },
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
  { key: 'StepForm', title: '分步表单', description: 'el-steps + 多个 EsForm 共用 model，逐步 validate 校验，末步核对后提交。' },
  { key: 'RowApproval', title: '行审批流转', description: '声明式 operate 列 btns（hidden 函数动态显隐）+ 行级状态流转 + 驳回原因弹窗。' },
  { key: 'PermissionButtons', title: '按钮权限控制', description: '按角色切换 $EsPlus.permission，EsForm configBtn 与 EsTable operate btns 的 permissionValue 联动显隐。' },
  { key: 'BatchEdit', title: '多选批量编辑', description: '勾选多行 → 批量修改部门/状态（仅提交勾选字段）→ api.batchUpdate 一次提交 → refetch + 清空勾选。' },
  { key: 'EditableGridSubmit', title: '可编辑表格批量提交', description: '行内编辑/新增/删除，前端跟踪「新增/修改/删除」三类脏数据，一次性批量提交后端并回读。' },
  { key: 'ImportData', title: '批量导入', description: '粘贴多行文本 → 解析预览 → api.bulkCreate 逐行校验 → 按行号回填成功/失败原因，合法行落库。' },
]

export const vxeTableExamples = [
  { key: 'BasicSwitch', title: '引擎切换', description: '一行配置在 el-table（默认）与 vxe-table（高性能）之间切换，列配置/数据/联动完全兼容。' },
  { key: 'SelectionIndex', title: '多选与序号列', description: 'type:"selection" 复选框列 + type:"index" 序号列；getSelectionRows / clearSelection 获取/清空选中。' },
  { key: 'ExpandRow', title: '展开行', description: 'type:"expand" 展开行，通过 render 自定义展开内容，支持 el-descriptions 详情卡。' },
  { key: 'SortFormatter', title: '排序与格式化', description: 'sortable 列排序 + formatter 函数格式化 + vxeColumn.formatter 原生格式化，三种写法对比。' },
  { key: 'CustomRender', title: '自定义 render 渲染', description: 'render(h, { value, row, index }) 与 el-table 相同 API，vxe 引擎桥接透传，无缝兼容。' },
  { key: 'CellEdit', title: '单元格编辑', description: 'editConfig.mode:"cell" 单元格编辑，editRender $input/$select，getUpdateRecords 获取修改记录。' },
  { key: 'RowEdit', title: '行编辑与校验', description: 'editConfig.mode:"row" 整行编辑，vxeColumn.rules 校验规则，getInsertRecords/getRemoveRecords 获取变更。' },
  { key: 'ToolbarExport', title: '工具栏与导出', description: 'toolbarConfig 内置缩放/全屏/自定义列；exportConfig 导出 CSV；print 打印。' },
  { key: 'ColumnResize', title: '列宽调整与键盘鼠标', description: 'columnConfig.resizable 拖拽调列宽；keyboardConfig 方向键导航；mouseConfig.selected 单元格选中（类 Excel）。' },
  { key: 'TreeData', title: '树形数据', description: 'treeConfig.transform 自动将 { id, parentId } 扁平数组构造树形，expandAll/collapseAll 展开折叠。' },
  { key: 'ProxyConfig', title: 'proxyConfig 服务端分页', description: 'proxyConfig.ajax.query 接管请求，vxe 自管分页，EsForm 搜索触发 commitProxy("query") 重载。' },
  { key: 'FooterSummary', title: '汇总行 footerMethod', description: 'showFooter + footerMethod 动态计算合计行，随数据变化实时更新。' },
  { key: 'EscapeHatch', title: '逃生舱 vxeConfig + vxeOn', description: 'vxeConfig 深度合并任意 vxe-grid 原生配置；vxeOn 注入 cell-click / sort-change 等原生事件。' },
  { key: 'CrudWithDialog', title: '完整 CRUD + useDialog', description: '搜索（EsForm）+ 多选分页表格（engine:vxe）+ useDialog 新增/编辑弹窗 + 删除确认 —— 完整业务闭环。' },
  { key: 'MergeCells', title: '复杂合并单元格', description: '三级表头 groups + spanMethod 行列动态合并 + vxeConfig.mergeHeaderItems/mergeFooterItems 静态合并；表单联动切换合并模式。' },
]
