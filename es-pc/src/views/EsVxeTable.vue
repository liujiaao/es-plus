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
    </section>

    <a-divider />

    <section id="capabilities">
      <h2>✨ 核心能力</h2>
      <a-list :dataSource="capabilities" size="small" bordered>
        <template #renderItem="{ item }">
          <a-list-item>
            <strong>{{ item.title }}</strong>
            <span> — {{ item.desc }}</span>
          </a-list-item>
        </template>
      </a-list>
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

const capabilities = [
  { title: '行内编辑', desc: 'editConfig 配置单元格内直接改数据，getUpdateRecords 取回改动' },
  { title: '导出 / 打印', desc: 'exportConfig / printConfig 配置导出 Excel 与打印' },
  { title: '树形数据', desc: '树形表格，支持懒加载与展开' },
  { title: '多级表头', desc: 'groups 配置多级表头' },
  { title: '虚拟滚动', desc: '大数据量下保持流畅' },
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
