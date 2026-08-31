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

      <h3>行内编辑</h3>
      <p><code>editConfig</code> 配置单元格内直接改数据，<code>getUpdateRecords()</code> 取回改动。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/InlineEdit.vue']">
        <EsVxeInlineEdit />
      </CodeDemo>

      <h3>多选与序号列</h3>
      <p><code>type: 'selection'</code> 复选框列 + <code>type: 'snIndex'</code> 序号列，<code>getSelectionRows()</code> 获取选中。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/Selection.vue']">
        <EsVxeSelection />
      </CodeDemo>

      <h3>树形数据</h3>
      <p><code>treeConfig.transform</code> 将扁平数据自动构造成树形，<code>setAllTreeExpand</code> 展开/折叠。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/TreeData.vue']">
        <EsVxeTreeData />
      </CodeDemo>

      <h3>工具栏与导出</h3>
      <p><code>toolbarConfig</code> 内置缩放/全屏/导出；<code>exportConfig</code> 导出 CSV。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/ToolbarExport.vue']">
        <EsVxeToolbarExport />
      </CodeDemo>

      <h3>多级表头</h3>
      <p><code>groups</code> 将列分组，形成多级表头（组头 + 子列）。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/GroupsHeader.vue']">
        <EsVxeGroupsHeader />
      </CodeDemo>

      <h3>虚拟滚动</h3>
      <p><code>vxeConfig.scrollY</code> 启用 vxe 原生虚拟滚动，万行数据滚动流畅不卡顿。</p>
      <CodeDemo :source="rawSFCs['./es-vxe/VirtualScroll.vue']">
        <EsVxeVirtualScroll />
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
import EsVxeInlineEdit from './es-vxe/InlineEdit.vue'
import EsVxeSelection from './es-vxe/Selection.vue'
import EsVxeTreeData from './es-vxe/TreeData.vue'
import EsVxeToolbarExport from './es-vxe/ToolbarExport.vue'
import EsVxeGroupsHeader from './es-vxe/GroupsHeader.vue'
import EsVxeVirtualScroll from './es-vxe/VirtualScroll.vue'

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
