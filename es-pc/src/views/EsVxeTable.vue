<template>
  <div class="es-vxe-page">
    <h1>vxe 高性能引擎</h1>
    <p class="subtitle">
      ES-Plus 的 <code>EsTable</code> 支持三套渲染引擎，<code>engine: 'vxe'</code> 切换到底层 vxe-table，获得行内编辑、导出、树形数据等企业级能力——<strong>同一份 columns 配置，三套引擎通用</strong>。
    </p>

    <a-divider />

    <section id="engines">
      <h2>🚀 三套渲染引擎</h2>
      <a-table :dataSource="engines" :columns="engineColumns" :pagination="false" size="middle" bordered />
    </section>

    <a-divider />

    <section id="enable">
      <h2>🔧 启用 vxe 引擎</h2>
      <p>安装 vxe-table 并配置 <code>engine: 'vxe'</code>：</p>
      <a-card class="code-block">
        <pre v-pre><code>npm install vxe-table@^4.6 vxe-pc-ui@^4.16

// 注册 vxe-table（Vue 3 场景）
import VxeUIAll from 'vxe-pc-ui'
import 'vxe-pc-ui/lib/style.css'
import VxeTable from 'vxe-table'
import 'vxe-table/lib/style.css'
app.use(VxeUIAll).use(VxeTable)</code></pre>
      </a-card>
    </section>

    <a-divider />

    <section id="examples">
      <h2>📝 案例</h2>

      <h3>基础表格</h3>
      <p>使用 <code>engine: 'vxe'</code> 切换到 vxe 引擎，其余配置与标准引擎完全一致。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/Basic.vue']">
        <EsVxeBasic />
      </CodeDemo>

      <h3>排序与格式化</h3>
      <p><code>sortable</code> 列头排序；<code>formatter</code> 格式化显示；<code>vxeColumn.formatter</code> 走 vxe 原生格式化。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/SortFormatter.vue']">
        <EsVxeSortFormatter />
      </CodeDemo>

      <h3>自定义渲染</h3>
      <p><code>render(h, { value, row })</code> 与默认引擎一致的 render 函数 API，vxe 引擎自动桥接透传（Tag / Progress / Avatar）。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/CustomRender.vue']">
        <EsVxeCustomRender />
      </CodeDemo>

      <h3>行内编辑（单元格）</h3>
      <p><code>editConfig</code> 配置单元格内直接改数据，<code>getUpdateRecords()</code> 取回改动。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/InlineEdit.vue']">
        <EsVxeInlineEdit />
      </CodeDemo>

      <h3>行编辑与校验</h3>
      <p><code>editConfig.mode: 'row'</code> 整行编辑 + <code>vxeColumn.rules</code> 校验；<code>insertAt/remove/getUpdateRecords/revertData</code> 批量增删改。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/RowEdit.vue']">
        <EsVxeRowEdit />
      </CodeDemo>

      <h3>多选与序号列</h3>
      <p><code>type: 'selection'</code> 复选框列 + <code>type: 'index'</code> 序号列，<code>getSelectionRows()</code> 获取选中。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/Selection.vue']">
        <EsVxeSelection />
      </CodeDemo>

      <h3>展开行</h3>
      <p><code>type: 'expand'</code> 展开行，<code>render</code> 自定义展开区内容，<code>expandConfig.trigger</code> 控制触发方式。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/ExpandRow.vue']">
        <EsVxeExpandRow />
      </CodeDemo>

      <h3>树形数据</h3>
      <p><code>treeConfig.transform</code> 将扁平数据自动构造成树形，<code>setAllTreeExpand</code> 展开/折叠。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/TreeData.vue']">
        <EsVxeTreeData />
      </CodeDemo>

      <h3>多级表头</h3>
      <p><code>groups</code> 将列分组，形成多级表头（组头 + 子列）。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/GroupsHeader.vue']">
        <EsVxeGroupsHeader />
      </CodeDemo>

      <h3>合并单元格（企业级）</h3>
      <p>三级表头 + <code>spanMethod</code> 行列混合合并 + <code>vxeConfig.mergeHeaderItems / mergeFooterItems</code> 表头表尾合并，可编辑实时重算达成率；<code>patchHtmlRowSpans</code> 修正合并单元格分页打印（表头每页重复）。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/MergeCells.vue']">
        <EsVxeMergeCells />
      </CodeDemo>

      <h3>表尾合计</h3>
      <p><code>showFooter + footerMethod</code> 汇总行，配合动态数据实时更新合计值。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/FooterSummary.vue']">
        <EsVxeFooterSummary />
      </CodeDemo>

      <h3>工具栏与导出</h3>
      <p><code>toolbarConfig</code> 内置缩放/全屏/导出；<code>exportConfig</code> 导出 CSV。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/ToolbarExport.vue']">
        <EsVxeToolbarExport />
      </CodeDemo>

      <h3>列宽拖拽与键盘导航</h3>
      <p><code>columnConfig.resizable</code> 列宽拖拽；<code>keyboardConfig</code> 方向键导航；<code>mouseConfig</code> 类 Excel 单元格选中。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/ColumnResize.vue']">
        <EsVxeColumnResize />
      </CodeDemo>

      <h3>虚拟滚动</h3>
      <p><code>vxeConfig.scrollY</code> 启用 vxe 原生虚拟滚动，万行数据滚动流畅不卡顿。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/VirtualScroll.vue']">
        <EsVxeVirtualScroll />
      </CodeDemo>

      <h3>服务端分页（proxyConfig）</h3>
      <p><code>proxyConfig</code> 让 vxe 自管分页请求；EsForm 与 EsTable 兄弟结构，按钮 <code>commitProxy('query')</code> 触发刷新。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/ProxyConfig.vue']">
        <EsVxeProxyConfig />
      </CodeDemo>

      <h3>逃生舱（vxeConfig / vxeOn）</h3>
      <p><code>vxeConfig</code> 深度合并任意 vxe-grid 原生配置，<code>vxeOn</code> 注入原生事件——es-plus 不理解的能力都能透传。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/EscapeHatch.vue']">
        <EsVxeEscapeHatch />
      </CodeDemo>

      <h3>CRUD + 弹窗（综合）</h3>
      <p>服务端搜索分页 + <code>useDialog</code> 新增/编辑表单 + 行内删除 + 工具栏导出打印，一个页面串起完整业务闭环。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/CrudWithDialog.vue']">
        <EsVxeCrudWithDialog />
      </CodeDemo>
    </section>

    <a-divider />

    <section id="note">
      <h2>📌 说明</h2>
      <p>
        vxe-table 是可选 peer 依赖（<code>vxe-table >= 4.5.0 &lt; 5.0.0</code>），未安装时
        <code>engine: 'vxe'</code> 会自动降级为默认引擎并在开发环境告警。vxe 引擎的完整配置（导出、
        树形数据、合并单元格）见主文档站的
        <a href="https://liujiaao.github.io/es-plus/" target="_blank">vxe-table 文档</a>。
      </p>
    </section>
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
import EsVxeBasic from './es-vxe/Basic.vue'
import EsVxeSortFormatter from './es-vxe/SortFormatter.vue'
import EsVxeCustomRender from './es-vxe/CustomRender.vue'
import EsVxeInlineEdit from './es-vxe/InlineEdit.vue'
import EsVxeRowEdit from './es-vxe/RowEdit.vue'
import EsVxeSelection from './es-vxe/Selection.vue'
import EsVxeExpandRow from './es-vxe/ExpandRow.vue'
import EsVxeTreeData from './es-vxe/TreeData.vue'
import EsVxeGroupsHeader from './es-vxe/GroupsHeader.vue'
import EsVxeMergeCells from './es-vxe/MergeCells.vue'
import EsVxeFooterSummary from './es-vxe/FooterSummary.vue'
import EsVxeToolbarExport from './es-vxe/ToolbarExport.vue'
import EsVxeColumnResize from './es-vxe/ColumnResize.vue'
import EsVxeVirtualScroll from './es-vxe/VirtualScroll.vue'
import EsVxeProxyConfig from './es-vxe/ProxyConfig.vue'
import EsVxeEscapeHatch from './es-vxe/EscapeHatch.vue'
import EsVxeCrudWithDialog from './es-vxe/CrudWithDialog.vue'

const rawSFCs = import.meta.glob('./es-vxe/*.vue', { query: '?raw', import: 'default', eager: true })

// vxe 引擎是跨渲染器的：vue3 / vue2 / antdv 三端均支持 engine: 'vxe'，且同一份 columns 配置通用。
const engines = [
  { engine: '默认（el-table）', desc: '几十 ~ 几千行，标准场景', flag: '默认' },
  { engine: 'virtual（el-table-v2）', desc: '上万行，虚拟滚动', flag: 'options.virtual' },
  { engine: 'vxe（vxe-table）', desc: '行内编辑 / 导出 / 树形 / 多级表头', flag: "engine: 'vxe'" },
]

const engineColumns = [
  { title: '引擎', dataIndex: 'engine', key: 'engine' },
  { title: '适用场景', dataIndex: 'desc', key: 'desc' },
  { title: '启用方式', dataIndex: 'flag', key: 'flag' },
]

</script>

<style scoped>
.es-vxe-page {
  max-width: 860px;
}

.subtitle {
  font-size: 16px;
  color: #666;
}

.code-block {
  margin: 16px 0;
  background: #f6f8fa;
}

.code-block pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-block code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
}
</style>
