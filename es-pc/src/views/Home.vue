<template>
  <div class="home-page">
    <div class="hero">
      <h1 class="hero-title">{{ brand.positioning }}</h1>
      <p class="hero-slogan-en">{{ brand.slogan.en }}</p>
      <p class="hero-desc">
        {{ brand.slogan.subtitle }}
        <br />
        同一份 Schema 跨 Element Plus / Ant Design Vue / Vue 2 / Vue 3 复用，AI 生成即编译。
      </p>
      <div class="hero-renderer">
        <span class="renderer-badge">本站渲染器：Ant Design Vue</span>
      </div>
      <a-space :size="16">
        <a-button type="primary" size="large" @click="$router.push('/guide')">
          <RocketOutlined /> 快速上手
        </a-button>
        <a-button size="large" @click="$router.push('/es-form')">
          <ThunderboltOutlined /> 浏览组件
        </a-button>
      </a-space>
    </div>

    <!-- 三个可验证承诺（文案单一真源 docs/brand/slogan.json） -->
    <div class="promises">
      <a-row :gutter="[24, 24]">
        <a-col :span="8" v-for="p in brand.promises" :key="p.key">
          <a-card class="promise-card" hoverable>
            <h3 class="promise-title">{{ p.title }}</h3>
            <div class="promise-claim">{{ p.claim }}</div>
            <p class="promise-desc">{{ p.desc }}</p>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- L2 头号案例：零事件代码的 CRUD -->
    <div class="l2-case">
      <h2 class="section-title">🎯 头号案例 · 零事件代码的 CRUD</h2>
      <p class="section-desc">
        原生「查询 → 重置 → 翻页」要写 4 个事件函数，还容易踩「拿最新表单值」的坑。
        es-plus 用 <code>EsForm 嵌套 EsTable</code> + <code>triggerEvent: true</code>，
        把整条联动链路收敛为 <strong>0 行事件代码</strong>。
      </p>
      <CodeDiff :left-code="nativeCode" :right-code="esplusCode" />
    </div>

    <!-- 三端通用：同一份 Schema 源码 + 三端渲染快照 -->
    <div class="tri-section">
      <h2 class="section-title">🌐 三端通用</h2>
      <p class="section-desc">
        同一份 JSON Schema 在 Vue 2 / Vue 3 / Ant Design Vue 三端渲染出一致界面，
        <strong>换一行 import 即切换</strong>。
      </p>
      <TriRenderTabs />
    </div>

    <!-- AI 一句话生成 CRUD 入口（指向主站 AiCrud） -->
    <div class="ai-entry">
      <a-card class="ai-entry-card" hoverable @click="openAiCrud">
        <div class="ai-entry-content">
          <h3>🤖 AI 一句话生成 CRUD</h3>
          <p>在 Claude Code / Cursor 里说一句话，生成可编译的三端通用 CRUD 页面。在线体验见主站 AiCrud。</p>
        </div>
      </a-card>
    </div>

    <a-divider />

    <div class="features">
      <h2 class="section-title">✨ 核心特性</h2>
      <a-row :gutter="[24, 24]">
        <a-col :span="8" v-for="item in features" :key="item.title">
          <a-card class="feature-card" hoverable>
            <div class="feature-icon">
              <component :is="item.icon" />
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <a-divider />

    <!-- ES-Plus 配置化组件 -->
    <div class="es-plus-intro">
      <h2 class="section-title">⚡ ES-Plus 配置化组件</h2>
      <p class="section-desc">
        基于 <code>@es-plus/adapter-antdv</code> 适配器，使用 <strong>JSON 配置</strong> 即可驱动 Ant Design Vue
        表单、表格、弹窗和 CRUD 页面。<strong>同一份 Schema 跨 UI 框架复用</strong>（Element Plus / Ant Design Vue）。
      </p>
      <a-row :gutter="[16, 16]">
        <a-col :span="6" v-for="comp in esPlusComps" :key="comp.name">
          <a-card hoverable class="esplus-comp-card" @click="$router.push(comp.route)">
            <div class="esplus-comp-name">{{ comp.name }}</div>
            <div class="esplus-comp-desc">{{ comp.desc }}</div>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <a-divider />

    <div class="tech-stack">
      <h2 class="section-title">🛠 技术栈</h2>
      <a-row :gutter="[16, 16]">
        <a-col :span="6" v-for="tech in techs" :key="tech.name">
          <a-card size="small" class="tech-card">
            <div class="tech-name">{{ tech.name }}</div>
            <div class="tech-ver">{{ tech.version }}</div>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <a-divider />

    <div class="quick-start">
      <h2 class="section-title">🚀 快速开始</h2>
      <a-card class="code-card">
        <pre><code># 安装依赖
npm install @es-plus/adapter-antdv @es-plus/core ant-design-vue @ant-design/icons-vue

# 在 main.js 中注册
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'

app.use(ESPlus, {
  globalProperties: true,
  permission: (value) => true,
})

# 启动开发服务器
cd es-pc && npm run dev

# 构建生产版本
npm run build</code></pre>
      </a-card>
    </div>
  </div>
</template>

<script setup>
import { h } from 'vue'
import {
  RocketOutlined,
  ThunderboltOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  CodeOutlined,
  RobotOutlined,
  ApiOutlined,
  InteractionOutlined,
} from '@ant-design/icons-vue'
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发，禁止手改本文件
import brand from '@/brand/slogan.json'
import CodeDiff from '@/components/CodeDiff.vue'
import TriRenderTabs from '@/components/TriRenderTabs.vue'

const openAiCrud = () => {
  window.open('https://liujiaao.github.io/es-plus/#/ai-crud', '_blank')
}

const features = [
  { title: 'JSON 配置驱动', desc: '通过 formItemList / columns / schema 即可生成完整页面，减少 70% 模板代码', icon: DeploymentUnitOutlined },
  { title: '跨框架复用', desc: '同一份 Schema 可在 Element Plus / Ant Design Vue 之间复用，降低迁移成本', icon: InteractionOutlined },
  { title: 'AI 代码生成', desc: '配套 CLI 与 MCP Server（详见主文档站），支持从自然语言或配置直接生成可编译页面', icon: RobotOutlined },
  { title: '表单表格联动', desc: 'triggerEvent 自动联动查询/重置/分页，无需手写事件回调', icon: FileSearchOutlined },
  { title: '命令式弹窗', desc: 'useDialog 编程式调用弹窗，支持嵌套、拖拽、全屏、自定义渲染', icon: CodeOutlined },
  { title: 'Vue 2 / Vue 3 兼容', desc: '提供 @es-plus/vue2 / @es-plus/vue3 / adapter-antdv 三套渲染包', icon: ApiOutlined },
]

const esPlusComps = [
  { name: 'EsForm', desc: '动态表单 · 14种控件 · JSON 驱动', route: '/es-form' },
  { name: 'EsTable', desc: '动态表格 · 分页排序 · 自定义渲染', route: '/es-table' },
  { name: 'EsDialog', desc: '动态弹窗 · 命令式API · 表单/表格弹窗', route: '/es-dialog' },
  { name: 'EsCrudPage', desc: 'CRUD编排 · 多弹窗 · 权限控制', route: '/es-crud-page' },
]

const techs = [
  { name: 'Vue', version: '3.5+' },
  { name: 'Vite', version: '6.3+' },
  { name: 'Ant Design Vue', version: '4.2+' },
  { name: 'Vue Router', version: '4.5+' },
  { name: '@es-plus/adapter-antdv', version: '1.0.0' },
  { name: '@es-plus/core', version: '1.0.1' },
]

// ── L2 头号案例「零事件代码的 CRUD」并排 diff 内容 ──
// 痛点：原生「查询→重置→翻页」要 4 个事件函数，还易踩「拿最新表单值」的坑。
// 解法：EsForm 嵌套 EsTable + triggerEvent:true，0 行事件代码。
const nativeCode = `<a-form :model="query" layout="inline">
  <a-form-item label="用户名"><a-input v-model="query.name" /></a-form-item>
  <a-form-item label="状态"><a-select v-model="query.status" :options="statusOptions" /></a-form-item>
  <a-form-item>
    <a-button type="primary" @click="handleQuery">查询</a-button>
    <a-button @click="handleReset">重置</a-button>
  </a-form-item>
</a-form>

<a-table :data-source="list" :columns="cols"
  :loading="loading" :pagination="pagination"
  @change="handleTableChange" />

// ── 原生 script：4 个事件函数 ──
const query = reactive({ name: '', status: '' })
const list = ref([]); const loading = ref(false)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })

const fetchData = async () => {
  loading.value = true
  const { data } = await axios.get('/api/users', { params: { ...query, ...pagination } })
  list.value = data.data; pagination.total = data.total
  loading.value = false
}
// 4 个事件函数，且「拿最新表单值」容易踩坑
const handleQuery = () => { pagination.current = 1; fetchData() }
const handleReset = () => { Object.assign(query, { name: '', status: '' }); pagination.current = 1; fetchData() }
const handleTableChange = (p) => { pagination.current = p.current; pagination.pageSize = p.pageSize; fetchData() }
`

const esplusCode = `<es-table :columns="columns" :options="options">
  <es-form :model="query" :form-item-list="items" :config-btn="btns" />
</es-table>

// ── es-plus script：0 行事件代码 ──
const query = reactive({ name: '', status: '' })
const items = [
  { prop: 'name', label: '用户名', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions },
]
const btns = [
  { name: '查询', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]
const columns = [
  { prop: 'name', label: '用户名' },
  { prop: 'status', label: '状态' },
]
const options = { apiParams: { url: '/api/users' } }
// 0 行事件代码：查询/重置/分页全自动联动（triggerEvent）
`
</script>

<style scoped>
.hero {
  text-align: center;
  padding: 48px 0 32px;
}

.hero-title {
  font-size: 40px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--es-brand-primary), var(--es-brand-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-slogan-en {
  font-size: 20px;
  font-weight: 600;
  color: var(--es-brand-primary);
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.hero-renderer {
  margin-bottom: 28px;
}

.renderer-badge {
  display: inline-block;
  padding: 4px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--es-brand-primary);
  background: var(--es-brand-primary-light);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 20px;
}

.hero-desc {
  font-size: 17px;
  color: #666;
  margin-bottom: 32px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.8;
}

.promises {
  max-width: 1080px;
  margin: 0 auto 32px;
}

.promise-card {
  text-align: center;
  border-radius: 12px;
  height: 100%;
  border: 1px solid #f0f0f0;
}

.promise-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}

.promise-claim {
  display: inline-block;
  margin-bottom: 12px;
  padding: 4px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--es-brand-accent);
  background: rgba(6, 182, 212, 0.08);
  border-radius: 20px;
}

.promise-desc {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.7;
}

.l2-case {
  max-width: 1080px;
  margin: 0 auto 32px;
}

.tri-section {
  max-width: 1080px;
  margin: 0 auto 32px;
}

.ai-entry {
  max-width: 1080px;
  margin: 0 auto 32px;
}

.ai-entry-card {
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f9eb 0%, #ecf5ff 100%);
  border: 1px solid #e6f4d8;
  cursor: pointer;
}

.ai-entry-content {
  text-align: center;
  padding: 8px 0;
}

.ai-entry-content h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}

.ai-entry-content p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #1a1a2e;
}

.section-desc {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
  line-height: 1.8;
}

.section-desc code {
  background: #f0f5ff;
  color: var(--es-brand-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.feature-card {
  text-align: center;
  border-radius: 8px;
}

.feature-card h3 {
  margin: 12px 0 8px;
  font-size: 17px;
}

.feature-card p {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.feature-icon {
  font-size: 36px;
  color: var(--es-brand-primary);
}

.es-plus-intro {
  margin-bottom: 16px;
}

.esplus-comp-card {
  text-align: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.esplus-comp-card:hover {
  border-color: var(--es-brand-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.15);
}

.esplus-comp-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--es-brand-primary);
  margin-bottom: 6px;
}

.esplus-comp-desc {
  font-size: 13px;
  color: #999;
}

.tech-card {
  text-align: center;
  border-radius: 8px;
}

.tech-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.tech-ver {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.code-card {
  border-radius: 8px;
  background: #1e1e2e;
}

.code-card pre {
  margin: 0;
  padding: 0;
}

.code-card code {
  color: #e0e0e0;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 14px;
  line-height: 2;
}
</style>
