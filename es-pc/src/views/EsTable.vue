<template>
  <div class="es-table-page">
    <h1>EsTable 动态表格</h1>
    <p class="subtitle">
      基于 JSON 配置的动态表格组件，支持分页请求、列格式化、自定义渲染、多选、排序、
      操作列、虚拟滚动等功能。使用 <code>@es-plus/adapter-antdv</code> 适配 Ant Design Vue 4.x。
    </p>

    <a-divider />

    <!-- 基础表格 -->
    <section id="basic">
      <h2>基础用法</h2>
      <p>通过 <code>columns</code> 配置列，<code>data-source</code> 绑定数据。</p>
            <CodeDemo :source="rawSFCs['./es-table/Basic.vue']">
        <EsTableBasic />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 分页请求 -->
    <section id="pagination">
      <h2>httpRequest + configTableOut 分页</h2>
      <p>配置 <code>apiParams</code> 和 <code>httpRequest</code> 实现服务端分页，通过 <code>configTableOut</code> 映射响应字段。</p>
            <CodeDemo :source="rawSFCs['./es-table/Pagination.vue']">
        <EsTablePagination />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 自定义列渲染 -->
    <section id="custom">
      <h2>自定义列渲染</h2>
      <p>通过 <code>render</code> 函数或 <code>formatter</code> 自定义列内容展示。</p>
            <CodeDemo :source="rawSFCs['./es-table/Custom.vue']">
        <EsTableCustom />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 多选 -->
    <section id="selection">
      <h2>多选与跨页记忆</h2>
      <p><code>type: 'selection'</code> 与 <code>options.multiSelect</code> 等价地开启多选列；翻页后已选项自动回勾（需配 <code>rowkey</code>）。<code>selection-change</code> 只带当前页，跨页全集用 <code>getSelectionRows()</code>；<code>cachePageSelection: false</code> 时翻页即丢弃上一页勾选。组件不提供单选列（<code>type: 'selection'</code> 恒为复选框），单选请用 <code>highlightCurrentRow</code> + 行事件。</p>
            <CodeDemo :source="rawSFCs['./es-table/Selection.vue']">
        <EsTableSelection />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 操作列 -->
    <section id="actions">
      <h2>操作列</h2>
      <p>在列配置中添加 <code>btns</code> 数组定义操作按钮；<code>hidden</code> 同时按行状态与角色求值。工具栏的新增、批量审核（按勾选行）、导出都真实落到数据源。</p>
            <CodeDemo :source="rawSFCs['./es-table/RowActions.vue']">
        <EsTableRowActions />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 工具栏按钮 -->
    <section id="toolbar">
      <h2>工具栏按钮左右分栏</h2>
      <p><code>configBtn</code> 的 <code>code: 1 / 2</code> 把按钮分到左右两端；插槽按钮在左侧，导出 / 打印 / 刷新都在浏览器里真跑，批量删除按勾选真删。</p>
            <CodeDemo :source="rawSFCs['./es-table/Toolbar.vue']">
        <EsTableToolbar />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 行内编辑 -->
    <section id="edit">
      <h2>点击单元格即编辑</h2>
      <p>表格即编辑器，点击单元格进入编辑模式，支持批量保存/取消。</p>
            <CodeDemo :source="rawSFCs['./es-table/Edit.vue']">
        <EsTableEdit />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 排序 -->
    <section id="sort">
      <h2>排序：事件驱动 + 后端重排</h2>
      <p>antdv 侧 <code>sortable</code> 统一映射为 <code>sorter: true</code>，只发排序事件、不本地排；示例在 <code>change-table-sort</code> 里重排，真实项目带 order 重新请求。第三次点击清除排序并还原原始顺序。</p>
            <CodeDemo :source="rawSFCs['./es-table/Sort.vue']">
        <EsTableSort />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 固定列 -->
    <section id="fixed">
      <h2>固定列与高度</h2>
      <p><code>fixed</code> 固定列 + 自适应高度，适合宽表展示。</p>
            <CodeDemo :source="rawSFCs['./es-table/Fixed.vue']">
        <EsTableFixed />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 远程数据 -->
    <section id="remote">
      <h2>远程数据</h2>
      <p><code>actionUrl</code> + <code>httpRequest</code> + <code>configTableOut</code> 完整远程数据请求与分页。</p>
            <CodeDemo :source="rawSFCs['./es-table/RemoteData.vue']">
        <EsTableRemoteData />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 自适应高度 -->
    <section id="height">
      <h2>继承父容器高度</h2>
      <p><code>heightType: height</code> 继承父容器高度 + ResizeObserver 自动计算。</p>
            <CodeDemo :source="rawSFCs['./es-table/TableHeight.vue']">
        <EsTableTableHeight />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 分组表头 -->
    <section id="group">
      <h2>分组表头</h2>
      <p><code>groups</code> 嵌套列配置实现多级分组表头。</p>
            <CodeDemo :source="rawSFCs['./es-table/Group.vue']">
        <EsTableGroup />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 展开行 -->
    <section id="expand">
      <h2>展开行与树形</h2>
      <p><code>type:expand</code> 展开行 + <code>children</code> 树形数据两种层级展示模式。</p>
            <CodeDemo :source="rawSFCs['./es-table/Expand.vue']">
        <EsTableExpand />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 单元格合并 -->
    <section id="cell-merge">
      <h2>单元格合并与行样式</h2>
      <p><code>spanMethod</code> 合并单元格 + <code>rowClassName</code> 条件行样式。</p>
            <CodeDemo :source="rawSFCs['./es-table/CellMerge.vue']">
        <EsTableCellMerge />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 当前行 -->
    <section id="current-row">
      <h2>当前行与主从联动</h2>
      <p><code>highlightCurrentRow</code> 自动高亮当前行 + <code>@row-click</code> 事件驱动从表（antdv 无 el-table 的 <code>current-change</code>，行事件统一走 <code>@row-click</code>）。</p>
            <CodeDemo :source="rawSFCs['./es-table/CurrentRow.vue']">
        <EsTableCurrentRow />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 动态列 -->
    <section id="dynamic-columns">
      <h2>动态列显隐</h2>
      <p><code>hidCol</code> 按列身份显隐（不重建数组，列顺序 / 宽度 / 固定位保持不变）。</p>
            <CodeDemo :source="rawSFCs['./es-table/DynamicColumns.vue']">
        <EsTableDynamicColumns />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 查询表格 -->
    <section id="query-table">
      <h2>配置化查询：零 handleSearch</h2>
      <p><code>apiParams.model</code> 自动合并搜索参数 + <code>httpRequestInstance</code> 手动刷新，零手动联动代码。</p>
            <CodeDemo :source="rawSFCs['./es-table/QueryTable.vue']">
        <EsTableQueryTable />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 回调管线 -->
    <section id="callback-pipeline">
      <h2>请求回调管线</h2>
      <p><code>listenToCallBack</code> 请求响应拦截 + <code>configTableOut</code> 字段映射 + <code>entryQuery</code> 默认参数。</p>
            <CodeDemo :source="rawSFCs['./es-table/CallbackPipeline.vue']">
        <EsTableCallbackPipeline />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 码值列声明式标签 -->
    <section id="code-label">
      <h2>码值列：零 render 出标签</h2>
      <p>状态是 <code>0/1/2</code> 这样的码值，列上写一份 <code>dataOptions</code> 就得到中文标签与语义色：命中显示 label、<code>tagType</code> 渲染成 a-tag 的状态色，未命中显示原值、空值走 <code>emptyPlaceholder</code>。没有一个 render 函数，同一份 JSON 在 vue3（ElTag）/ vue2（el-tag）上同样成立。</p>
            <CodeDemo :source="rawSFCs['./es-table/CodeLabel.vue']">
        <EsTableCodeLabel />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>API / 属性</h2>
    <a-table
      :dataSource="tableProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>TableColumn 配置</h2>
    <p>
      <code>columns</code> 的每一项。三端字段名一致；<code>cellClassName</code> /
      <code>headerCellClassName</code> 是本端（Ant Design Vue 的列定义）独有的透传键。
    </p>
    <a-table
      :dataSource="tableColumns"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>TableOptions 配置</h2>
    <p>
      <code>options</code> 的每一项。带「vxe」标注的只在
      <code>options.engine: 'vxe'</code> 下有行为。
    </p>
    <a-table
      :dataSource="tableOptions"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>事件</h2>
    <a-table
      :dataSource="tableEvents"
      :columns="eventColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>方法</h2>
    <p>通过 <code>ref</code> 调用，三端同名同义。带「vxe」标注的只在 <code>options.engine: 'vxe'</code> 下有行为。</p>
    <a-table
      :dataSource="tableMethods"
      :columns="methodColumns"
      :pagination="false"
      size="small"
      bordered
    />
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
import EsTableBasic from './es-table/Basic.vue'
import EsTablePagination from './es-table/Pagination.vue'
import EsTableCustom from './es-table/Custom.vue'
import EsTableSelection from './es-table/Selection.vue'
import EsTableRowActions from './es-table/RowActions.vue'
import EsTableToolbar from './es-table/Toolbar.vue'
import EsTableEdit from './es-table/Edit.vue'
import EsTableSort from './es-table/Sort.vue'
import EsTableFixed from './es-table/Fixed.vue'
import EsTableRemoteData from './es-table/RemoteData.vue'
import EsTableTableHeight from './es-table/TableHeight.vue'
import EsTableGroup from './es-table/Group.vue'
import EsTableExpand from './es-table/Expand.vue'
import EsTableCellMerge from './es-table/CellMerge.vue'
import EsTableCurrentRow from './es-table/CurrentRow.vue'
import EsTableDynamicColumns from './es-table/DynamicColumns.vue'
import EsTableQueryTable from './es-table/QueryTable.vue'
import EsTableCallbackPipeline from './es-table/CallbackPipeline.vue'
import EsTableCodeLabel from './es-table/CodeLabel.vue'

const rawSFCs = import.meta.glob('./es-table/*.vue', { query: '?raw', import: 'default', eager: true })

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const eventColumns = [
  { title: '事件', dataIndex: 'event', key: 'event', width: 220 },
  { title: '回调参数', dataIndex: 'params', key: 'params', width: 220 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const methodColumns = [
  { title: '方法', dataIndex: 'prop', key: 'prop', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
  { title: '参数', dataIndex: 'params', key: 'params', width: 160 },
]

const tableProps = [
  { key: '1', prop: 'dataSource', type: 'array', default: '[]', desc: '表格数据（静态模式）' },
  { key: '2', prop: 'columns', type: 'TableColumn[]', default: '[]', desc: '列配置' },
  { key: '3', prop: 'options', type: 'TableOptions', default: '{}', desc: '表格选项（含请求、边框、行样式等）' },
  { key: '4', prop: 'pagination', type: 'PaginationConfig', default: '{}', desc: '分页配置' },
  { key: '5', prop: 'initTabHeight', type: 'number', default: '400', desc: '初始表格高度' },
  { key: '6', prop: 'showHeaderBar', type: 'boolean', default: 'true', desc: '是否显示头部栏区域' },
  { key: '7', prop: 'headBarClass', type: 'string | object', default: "''", desc: '头部栏区域的样式类' },
]

const tableEvents = [
  { key: '1', event: 'update:dataSource', params: '(data)', desc: '数据变化（配合 v-model:data-source）' },
  { key: '2', event: 'update:pagination', params: '(pagination)', desc: '分页变化（配合 v-model:pagination）' },
  { key: '3', event: 'pagination-current-change', params: '(pagination)', desc: '翻页' },
  { key: '4', event: 'size-change', params: '(pagination, size)', desc: '每页条数变化' },
  { key: '5', event: 'change-table-sort', params: '(column)', desc: '排序变化' },
  { key: '6', event: 'selection-change', params: '(rows)', desc: '勾选变化：当前页选中行（default / vxe 同口径）；跨页全集用 getSelectionRows()' },
  { key: '7', event: 'request-error', params: '(error)', desc: '自动加载失败（命令式 refresh/reload 的 rejection 不在此列）' },
  { key: '8', event: 'cell-edit', params: '({ row, prop, value, oldValue })', desc: 'vxe 行内编辑提交（失焦 / 换行）：每改一格发一条，未改值不发；旧值由引擎补上（原生 edit-closed 没有）' },
]

const tableMethods = [
  { key: '1', prop: 'httpRequestInstance', params: '(model?, { keepPage }?)', desc: '手动触发数据请求（默认回到第 1 页；keepPage: true 保留当前页）' },
  { key: '2', prop: 'requestError', params: '-', desc: '最近一次自动加载的错误（成功后清空）' },
  { key: '3', prop: 'getSelectionRows', params: '-', desc: '取当前勾选行（含跨页缓存）' },
  { key: '4', prop: 'clearSelection', params: '-', desc: '清空全部选中（含跨页缓存；clearAllSelection 为同义别名）' },
  { key: '5', prop: 'clearAllSelection', params: '-', desc: '同 clearSelection（旧名，保留兼容）' },
  { key: '6', prop: 'toggleRowSelection', params: '(row, selected?)', desc: '切换某一行的选中状态' },
  { key: '7', prop: 'refresh', params: '(model?)', desc: '刷新当前页（保留页码重新取数）' },
  { key: '8', prop: 'reload', params: '(model?)', desc: '重新加载并回到第 1 页' },
  { key: '9', prop: 'doLayout', params: '-', desc: '重新计算表格布局（列宽错位时调用）' },
  { key: '10', prop: 'scrollToRow', params: '(index)', desc: '滚动到指定行' },
  { key: '11', prop: 'getUpdateRecords', params: '-', desc: 'vxe：取已修改行' },
  { key: '12', prop: 'getInsertRecords', params: '-', desc: 'vxe：取新增行' },
  { key: '13', prop: 'getRemoveRecords', params: '-', desc: 'vxe：取删除行' },
  { key: '14', prop: 'revertData', params: '(rows?)', desc: 'vxe：还原行数据（不传则还原全部）' },
  { key: '15', prop: 'clearActived', params: '-', desc: 'vxe：关闭所有已激活的单元格编辑态' },
  { key: '16', prop: 'clearValidate', params: '-', desc: 'vxe：清除行内校验提示' },
  { key: '17', prop: 'validate', params: '(rows?)', desc: 'vxe：触发行内校验，返回 Promise' },
  { key: '18', prop: 'exportData', params: '(opts?)', desc: 'vxe：导出当前数据（xlsx/csv/xml/html）' },
  { key: '19', prop: 'print', params: '(opts?)', desc: 'vxe：调用打印，可传 { html } 打印修正后的 HTML' },
  { key: '20', prop: 'getPrintHtml', params: '(opts?)', desc: 'vxe：取表格 HTML（合并区需配合 patchHtmlRowSpans 修正）' },
  { key: '21', prop: 'vxeInstance', params: '-', desc: 'vxe：取底层 vxe-grid 实例' },
]

const tableColumns = [
  { key: '1', prop: 'prop', type: 'string', default: '-', desc: '数据字段名' },
  { key: '2', prop: 'key', type: 'string', default: '-', desc: '列唯一标识（与 prop 二选一）' },
  { key: '3', prop: 'label', type: 'string', default: '-', desc: '列标题' },
  { key: '4', prop: 'labelKey', type: 'string', default: '-', desc: '国际化 key，配置了全局 t 函数时优先于 label' },
  { key: '5', prop: 'width', type: 'number | string', default: '-', desc: '列宽度' },
  { key: '6', prop: 'minWidth', type: 'number | string', default: '-', desc: '最小列宽' },
  { key: '7', prop: 'align', type: 'string', default: 'center', desc: '对齐方式：left / center / right' },
  { key: '8', prop: 'fixed', type: 'boolean | string', default: '-', desc: '固定列：left / right / true（等价 left）' },
  { key: '9', prop: 'type', type: 'string', default: '-', desc: '内置列类型：index / selection / expand' },
  { key: '10', prop: 'sortable', type: 'boolean | "custom"', default: '-', desc: '可排序；"custom" 表示由后端排序' },
  { key: '11', prop: 'formatter', type: 'Function', default: '-', desc: '(row) => string，格式化函数' },
  { key: '12', prop: 'render', type: 'Function', default: '-', desc: '(h, { row, value, index }) => VNode' },
  { key: '13', prop: 'scopedSlots', type: 'Object', default: '-', desc: '{ customRender: "插槽名" }' },
  { key: '14', prop: 'groups', type: 'TableColumn[]', default: '-', desc: '多级分组表头的子列' },
  { key: '15', prop: 'expandConfig', type: 'Object', default: '-', desc: '展开行内容 { title?, fields }，仅 type: "expand" 列消费' },
  { key: '16', prop: 'ellipsis', type: 'boolean', default: '-', desc: '超出省略并显示 Tooltip' },
  { key: '17', prop: 'emptyPlaceholder', type: 'string', default: "'-'", desc: '空值占位文本（null / undefined / 空串时显示）' },
  { key: '18', prop: 'dataOptions', type: 'TableColumnDataOption[]', default: '-', desc: '码值映射 [{ label, value, tagType? }]：命中显示 label，tagType 渲染 a-tag 状态色；未命中原值。render / formatter 优先' },
  { key: '19', prop: 'hidCol', type: 'boolean', default: '-', desc: '隐藏该列（保留配置不渲染）' },
  { key: '20', prop: 'permissionValue', type: 'string', default: '-', desc: '列级权限编码：无权限时该列不渲染（未配置全局 permission 时放行）' },
  { key: '21', prop: 'btns', type: 'Array', default: '-', desc: '操作列按钮 [{ name, type?, icon?, permissionValue?, hidden?, clickEvent? }]' },
  { key: '22', prop: 'editRender', type: 'Object', default: '-', desc: 'vxe：行内编辑渲染器，需配合 options.editConfig' },
  { key: '23', prop: 'footerFormatter', type: 'Function', default: '-', desc: 'vxe：表尾单元格格式化，配合 options.showFooter' },
  { key: '24', prop: 'cellClassName', type: 'string | Function', default: '-', desc: '本端独有：单元格类名（a-table 列透传）' },
  { key: '25', prop: 'headerCellClassName', type: 'string | Function', default: '-', desc: '本端独有：表头单元格类名（a-table 列透传）' },
]

const tableOptions = [
  { key: '1', prop: 'border', type: 'boolean', default: 'false', desc: '是否显示边框' },
  { key: '2', prop: 'stripe', type: 'boolean', default: 'false', desc: '斑马纹（Ant Design Vue 无原生 stripe，按行样式实现）' },
  { key: '3', prop: 'size', type: 'string', default: 'small', desc: '表格尺寸：large / middle / small' },
  { key: '4', prop: 'headerCellStyle', type: 'object', default: '-', desc: '表头单元格样式' },
  { key: '5', prop: 'headerCellClassName', type: 'string | Function', default: '-', desc: '表头单元格类名' },
  { key: '6', prop: 'highlightCurrentRow', type: 'boolean', default: 'true', desc: '高亮当前行（单选即用它 + 行事件）' },
  { key: '7', prop: 'showHeader', type: 'boolean', default: 'true', desc: '是否显示表头' },
  { key: '8', prop: 'emptyText', type: 'string', default: '-', desc: '空数据时的占位文本' },
  { key: '9', prop: 'multiSelect', type: 'boolean', default: 'false', desc: '启用多选列（与列上的 type: "selection" 等价）' },
  { key: '10', prop: 'expand', type: 'boolean', default: 'false', desc: '启用展开行' },
  { key: '11', prop: 'snIndex', type: 'boolean', default: 'false', desc: '显示序号列' },
  { key: '12', prop: 'loading', type: 'boolean', default: 'false', desc: '加载态' },
  { key: '13', prop: 'cachePageSelection', type: 'boolean', default: 'true', desc: '跨页记忆选中项（需配 rowkey；false 时翻页即丢弃上一页勾选）' },
  { key: '14', prop: 'heightType', type: 'string', default: 'auto', desc: '高度类型：auto / height / maxHeight' },
  { key: '15', prop: 'tabHeight', type: 'number | string', default: '-', desc: '表格容器高度（推荐）' },
  { key: '16', prop: 'height', type: 'number | string', default: '-', desc: '固定高度（tabHeight 的别名，heightType: "height" 时生效）' },
  { key: '17', prop: 'rowkey', type: 'string', default: '-', desc: '行唯一标识字段名（跨页选择 / 虚拟滚动必填）' },
  { key: '18', prop: 'rowClassName', type: 'string | Function', default: '-', desc: '行类名，支持 ({ row, rowIndex }) => string' },
  { key: '19', prop: 'rowStyle', type: 'object | Function', default: '-', desc: '行内样式，支持 ({ row, rowIndex }) => object' },
  { key: '20', prop: 'defaultSort', type: 'Object', default: '-', desc: '默认排序 { prop, order: "ascending" | "descending" }' },
  { key: '21', prop: 'spanMethod', type: 'Function', default: '-', desc: '合并单元格 ({ row, column, rowIndex, columnIndex }) => [rowspan, colspan]' },
  { key: '22', prop: 'cellClassName', type: 'string | Function', default: '-', desc: '单元格类名' },
  { key: '23', prop: 'cellStyle', type: 'object | Function', default: '-', desc: '单元格样式' },
  { key: '24', prop: 'isInitRun', type: 'boolean', default: 'false', desc: '初始化时自动请求数据' },
  { key: '25', prop: 'actionUrl', type: 'string', default: '-', desc: '请求地址（apiParams.url 的简写）' },
  { key: '26', prop: 'apiParams', type: 'ApiParams', default: '-', desc: '请求配置 { url, method, model, headers, options }' },
  { key: '27', prop: 'httpRequest', type: 'Function', default: '-', desc: '自定义请求方法 (params) => Promise，覆盖全局配置' },
  { key: '28', prop: 'listenToCallBack', type: 'Object', default: '-', desc: '请求/响应回调管线 { brcb, qrcb }（兼容 { beforeRequest, afterResponse }）' },
  { key: '29', prop: 'configTableOut', type: 'Object', default: '-', desc: '响应字段映射 { total, tableData, pageSize, current }' },
  { key: '30', prop: 'entryQuery', type: 'object', default: '-', desc: '并入每次请求体的固定参数' },
  { key: '31', prop: 'refetchKeepPage', type: 'boolean', default: 'false', desc: '请求式刷新时保留当前页码' },
  { key: '32', prop: 'localPagination', type: 'boolean', default: 'false', desc: '本地分页（对已加载数据切片，不发请求）' },
  { key: '33', prop: 'configBtn', type: 'BtnConfig[]', default: '-', desc: '表格顶部操作按钮（见 EsForm 页的 BtnConfig 配置；它是 TableOptions 的键，不是组件 prop）' },
  { key: '34', prop: 'leftText', type: 'string', default: '-', desc: '头部栏左侧文本' },
  { key: '35', prop: 'virtual', type: 'boolean', default: 'false', desc: '虚拟滚动开关。antdv 端不生效（a-table 无虚拟表格），置 true 会告警并回退默认引擎' },
  { key: '36', prop: 'engine', type: 'string', default: 'default', desc: '渲染引擎：default / vxe 可用；virtual 在本端仅告警忽略，大数据量请用 vxe' },
  { key: '37', prop: 'rowHeight', type: 'number', default: '50', desc: '虚拟滚动的行高（仅 vue3 虚拟引擎使用，本端忽略）' },
  { key: '38', prop: 'estimatedRowHeight', type: 'number', default: '-', desc: '动态行高预估值（仅 vue3 虚拟引擎使用，本端忽略）' },
  { key: '39', prop: 'overscanCount', type: 'number', default: '2', desc: '可视区外预渲染行数（仅 vue3 虚拟引擎使用，本端忽略）' },
  { key: '40', prop: 'showFooter', type: 'boolean', default: 'false', desc: 'vxe：显示表尾' },
  { key: '41', prop: 'footerMethod', type: 'Function', default: '-', desc: 'vxe：表尾计算 ({ columns, data }) => 二维数组' },
  { key: '42', prop: 'footerData', type: 'Array', default: '-', desc: 'vxe：静态表尾数据（二维数组）' },
  { key: '43', prop: 'editConfig', type: 'object', default: '-', desc: 'vxe：行内编辑配置' },
  { key: '44', prop: 'keepSource', type: 'boolean', default: '-', desc: 'vxe：保留原始行数据（配合 revertData）' },
  { key: '45', prop: 'treeConfig', type: 'Object', default: '-', desc: 'vxe：树形表格配置' },
  { key: '46', prop: 'proxyConfig', type: 'Object', default: '-', desc: 'vxe：数据代理配置' },
  { key: '47', prop: 'expandConfig', type: 'Object', default: '-', desc: 'vxe：展开行为配置（与列上的 expandConfig「展开内容」不是同一概念）' },
  { key: '48', prop: 'seqConfig', type: 'Object', default: '-', desc: 'vxe：序号列配置' },
  { key: '49', prop: 'printConfig', type: 'Object | true', default: '-', desc: 'vxe：打印配置' },
  { key: '50', prop: 'exportConfig', type: 'object', default: '-', desc: 'vxe：导出配置' },
  { key: '51', prop: 'toolbarConfig', type: 'object', default: '-', desc: 'vxe：工具栏配置' },
  { key: '52', prop: 'columnConfig', type: 'object', default: '-', desc: 'vxe：列配置面板' },
  { key: '53', prop: 'keyboardConfig', type: 'object', default: '-', desc: 'vxe：键盘导航配置' },
  { key: '54', prop: 'mouseConfig', type: 'object', default: '-', desc: 'vxe：鼠标行为配置' },
  { key: '56', prop: 'validConfig', type: 'object', default: '-', desc: 'vxe：校验提示配置' },
]
</script>

<style scoped>
h1 { font-size: 30px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
