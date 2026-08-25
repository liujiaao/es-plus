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
      <EsTableBasic />
    </section>

    <a-divider />

    <!-- 分页请求 -->
    <section id="pagination">
      <h2>分页请求</h2>
      <p>配置 <code>apiParams</code> 和 <code>httpRequest</code> 实现服务端分页，通过 <code>configTableOut</code> 映射响应字段。</p>
      <EsTablePagination />
    </section>

    <a-divider />

    <!-- 自定义列渲染 -->
    <section id="custom">
      <h2>自定义列渲染</h2>
      <p>通过 <code>render</code> 函数或 <code>formatter</code> 自定义列内容展示。</p>
      <EsTableCustom />
    </section>

    <a-divider />

    <!-- 多选 -->
    <section id="selection">
      <h2>多选</h2>
      <p>通过 <code>type: 'selection'</code> 开启多选列。</p>
      <EsTableSelection />
    </section>

    <a-divider />

    <!-- 操作列 -->
    <section id="actions">
      <h2>操作列</h2>
      <p>在列配置中添加 <code>btns</code> 数组定义操作按钮。</p>
      <EsTableRowActions />
    </section>

    <a-divider />

    <!-- 工具栏按钮 -->
    <section id="toolbar">
      <h2>工具栏按钮</h2>
      <p>通过 <code>configBtn</code> 在表格上方添加工具栏操作按钮。</p>
      <EsTableToolbar />
    </section>

    <a-divider />

    <!-- 行内编辑 -->
    <section id="edit">
      <h2>行内编辑</h2>
      <p>表格即编辑器，点击单元格进入编辑模式，支持批量保存/取消。</p>
      <EsTableEdit />
    </section>

    <a-divider />

    <!-- 排序 -->
    <section id="sort">
      <h2>排序</h2>
      <p>前端排序与后端排序两种模式。</p>
      <EsTableSort />
    </section>

    <a-divider />

    <!-- 固定列 -->
    <section id="fixed">
      <h2>固定列与高度</h2>
      <p><code>fixed</code> 固定列 + 自适应高度，适合宽表展示。</p>
      <EsTableFixed />
    </section>

    <a-divider />

    <!-- 远程数据 -->
    <section id="remote">
      <h2>远程数据</h2>
      <p><code>actionUrl</code> + <code>httpRequest</code> + <code>configTableOut</code> 完整远程数据请求与分页。</p>
      <EsTableRemoteData />
    </section>

    <a-divider />

    <!-- 自适应高度 -->
    <section id="height">
      <h2>自适应容器高度</h2>
      <p><code>heightType: height</code> 继承父容器高度 + ResizeObserver 自动计算。</p>
      <EsTableTableHeight />
    </section>

    <a-divider />

    <!-- 分组表头 -->
    <section id="group">
      <h2>分组表头</h2>
      <p><code>groups</code> 嵌套列配置实现多级分组表头。</p>
      <EsTableGroup />
    </section>

    <a-divider />

    <!-- 展开行 -->
    <section id="expand">
      <h2>展开行与树形</h2>
      <p><code>type:expand</code> 展开行 + <code>children</code> 树形数据两种层级展示模式。</p>
      <EsTableExpand />
    </section>

    <a-divider />

    <!-- 单元格合并 -->
    <section id="cell-merge">
      <h2>单元格合并与行样式</h2>
      <p><code>spanMethod</code> 合并单元格 + <code>rowClassName</code> 条件行样式。</p>
      <EsTableCellMerge />
    </section>

    <a-divider />

    <!-- 当前行 -->
    <section id="current-row">
      <h2>当前行与主从联动</h2>
      <p><code>highlightCurrentRow</code> 行高亮 + <code>@current-change</code> 事件驱动从表。</p>
      <EsTableCurrentRow />
    </section>

    <a-divider />

    <!-- 动态列 -->
    <section id="dynamic-columns">
      <h2>动态列与汇总行</h2>
      <p><code>hidCol</code> 动态列显隐 + 汇总行配置。</p>
      <EsTableDynamicColumns />
    </section>

    <a-divider />

    <!-- 查询表格 -->
    <section id="query-table">
      <h2>配置化查询表格</h2>
      <p><code>entryQuery</code> 自动合并搜索参数 + <code>httpRequestInstance</code> 手动刷新，零手动联动代码。</p>
      <EsTableQueryTable />
    </section>

    <a-divider />

    <!-- 回调管线 -->
    <section id="callback-pipeline">
      <h2>请求回调管线</h2>
      <p><code>listenToCallBack</code> 请求响应拦截 + <code>configTableOut</code> 字段映射 + <code>entryQuery</code> 默认参数。</p>
      <EsTableCallbackPipeline />
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
  </div>
</template>

<script setup>
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

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const tableProps = [
  { key: '1', prop: 'data-source', type: 'array', default: '[]', desc: '表格数据（静态模式）' },
  { key: '2', prop: 'columns', type: 'TableColumn[]', default: '[]', desc: '列配置' },
  { key: '3', prop: 'options', type: 'TableOptions', default: '{}', desc: '表格选项（含请求、边框、行样式等）' },
  { key: '4', prop: 'pagination', type: 'PaginationConfig', default: '{}', desc: '分页配置' },
  { key: '5', prop: 'init-tab-height', type: 'number', default: '400', desc: '初始表格高度' },
  { key: '6', prop: 'show-header-bar', type: 'boolean', default: 'true', desc: '是否显示头部栏区域' },
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
