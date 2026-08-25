<template>
  <div class="guide-page">
    <h1>快速上手</h1>
    <p class="subtitle">跟随本指南，在 Vue 3 + Ant Design Vue 项目中使用 @es-plus/adapter-antdv</p>

    <a-divider />

    <!-- 环境准备 -->
    <section id="env">
      <h2>📋 环境准备</h2>
      <p>在开始之前，请确保你的开发环境满足以下要求：</p>
      <a-table
        :dataSource="envRequirements"
        :columns="envColumns"
        :pagination="false"
        size="middle"
        bordered
      />
    </section>

    <a-divider />

    <!-- 安装 -->
    <section id="install">
      <h2>📦 安装</h2>
      <p>在已有 Vue 3 + Vite 项目中安装 ES-Plus 适配器及相关依赖：</p>
      <a-card class="code-block">
        <pre v-pre><code>npm install @es-plus/adapter-antdv @es-plus/core
npm install ant-design-vue @ant-design/icons-vue vue-router</code></pre>
      </a-card>
    </section>

    <a-divider />

    <!-- 项目配置 -->
    <section id="config">
      <h2>⚙️ 项目配置</h2>

      <h3>入口文件 main.js</h3>
      <p>注册 Ant Design Vue 与 ES-Plus 适配器：</p>
      <a-card class="code-block">
        <pre v-pre><code>import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import 'dayjs/locale/zh-cn'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(Antd)
app.use(router)
app.use(ESPlus, {
  globalProperties: true,
  permission: (value) => true,
})
app.mount('#app')</code></pre>
      </a-card>

      <h3>Vite 配置别名（可选）</h3>
      <a-card class="code-block">
        <pre v-pre><code>import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': '/src' },
  },
})</code></pre>
      </a-card>
    </section>

    <a-divider />

    <!-- 使用组件 -->
    <section id="usage">
      <h2>🎨 使用组件</h2>
      <p>安装完成后，即可通过 JSON 配置驱动表单、表格、弹窗和 CRUD 页面：</p>

      <a-card class="code-block">
        <pre v-pre><code>// main.js
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'

app.use(ESPlus, {
  globalProperties: true,
  permission: (value) => true,
})

// 页面中使用 EsForm
const formModel = reactive({ name: '', status: undefined })
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input' },
  { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [
    { label: '启用', value: 1 }, { label: '禁用', value: 0 }
  ]}
]

// 页面中使用 EsTable
const tableData = [
  { name: '张三', age: 28 },
  { name: '李四', age: 32 },
]
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'age', label: '年龄' },
]</code></pre>
      </a-card>
    </section>

    <a-divider />

    <!-- 与 Element Plus 版的差异 -->
    <section id="diff">
      <h2>🔀 与 Element Plus 版的差异</h2>
      <a-table
        :dataSource="diffData"
        :columns="diffColumns"
        :pagination="false"
        size="middle"
        bordered
      />
    </section>

    <a-divider />

    <!-- 下一步 -->
    <section id="next">
      <h2>📖 下一步</h2>
      <a-row :gutter="[16, 16]">
        <a-col :span="12">
          <a-card hoverable class="next-card" @click="$router.push('/es-form')">
            <h4><ThunderboltOutlined /> 浏览组件文档</h4>
            <p>查看 EsForm、EsTable、EsDialog、EsCrudPage 的完整示例与 API</p>
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card hoverable class="next-card" @click="$router.push('/advanced')">
            <h4><InteractionOutlined /> 高级联动</h4>
            <p>学习表单表格联动、跨页选择、虚拟滚动等复杂场景</p>
          </a-card>
        </a-col>
      </a-row>
    </section>
  </div>
</template>

<script setup>
import {
  ThunderboltOutlined,
  InteractionOutlined,
} from '@ant-design/icons-vue'

const envColumns = [
  { title: '工具', dataIndex: 'tool', key: 'tool' },
  { title: '版本要求', dataIndex: 'version', key: 'version' },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const envRequirements = [
  { key: '1', tool: 'Node.js', version: '>= 18.0', desc: 'JavaScript 运行时' },
  { key: '2', tool: 'npm / pnpm', version: '>= 9.0', desc: '包管理器' },
  { key: '3', tool: 'Vue', version: '3.5+', desc: 'Vue 框架' },
  { key: '4', tool: 'Ant Design Vue', version: '4.2+', desc: 'UI 组件库' },
]

const diffColumns = [
  { title: '场景', dataIndex: 'scene', key: 'scene', width: 140 },
  { title: 'Element Plus 版（es-plus）', dataIndex: 'ep', key: 'ep' },
  { title: 'Ant Design Vue 版（adapter-antdv）', dataIndex: 'adv', key: 'adv' },
]

const diffData = [
  {
    key: '1',
    scene: '包名',
    ep: 'import { EsForm } from "es-plus"',
    adv: 'import { EsForm } from "@es-plus/adapter-antdv"',
  },
  {
    key: '2',
    scene: '消息提示',
    ep: 'import { ElMessage } from "element-plus"',
    adv: 'import { message } from "ant-design-vue"',
  },
  {
    key: '3',
    scene: '日期选择',
    ep: 'formtype: "DatePicker"',
    adv: 'formtype: "DatePicker" 或 "DatePicker"，范围 type: "daterange"',
  },
  {
    key: '4',
    scene: '颜色选择',
    ep: 'formtype: "ColorPicker"',
    adv: 'AntDV 无内置，降级为 input[type=color]',
  },
  {
    key: '5',
    scene: '上传组件',
    ep: 'on: { success, remove, change, preview }',
    adv: 'onSuccess / onRemove / onChange / onPreview',
  },
]
</script>

<style scoped>
h1 {
  font-size: 30px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 15px;
}

h2 {
  font-size: 22px;
  font-weight: 600;
  margin: 24px 0 16px;
  color: #1a1a2e;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 20px 0 12px;
  color: #333;
}

h4 {
  font-size: 16px;
  margin: 0 0 8px;
}

p {
  color: #555;
  line-height: 1.8;
  margin-bottom: 12px;
}

section {
  scroll-margin-top: 100px;
}

.code-block {
  border-radius: 8px;
  background: #1e1e2e;
  margin-bottom: 16px;
}

.code-block pre {
  margin: 0;
  padding: 0;
  overflow-x: auto;
}

.code-block code {
  color: #e0e0e0;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.9;
}

.next-card {
  border-radius: 8px;
  cursor: pointer;
}

.next-card p {
  font-size: 13px;
  color: #999;
  margin: 0;
}
</style>
