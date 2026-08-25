<template>
  <div class="home-page">
    <div class="hero">
      <h1 class="hero-title">@es-plus/adapter-antdv</h1>
      <p class="hero-desc">
        基于 JSON Schema 配置驱动 Ant Design Vue 4.x 的企业级中后台组件库。
        <br />
        同一份 Schema 可跨 Element Plus / Ant Design Vue / Vue 2 / Vue 3 复用。
      </p>
      <a-space :size="16">
        <a-button type="primary" size="large" @click="$router.push('/guide')">
          <RocketOutlined /> 快速上手
        </a-button>
        <a-button size="large" @click="$router.push('/es-form')">
          <ThunderboltOutlined /> 浏览组件
        </a-button>
      </a-space>
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

const features = [
  { title: 'JSON 配置驱动', desc: '通过 formItemList / columns / schema 即可生成完整页面，减少 80% 模板代码', icon: DeploymentUnitOutlined },
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
  margin-bottom: 16px;
  background: linear-gradient(135deg, #1677ff, #722ed1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  color: #1677ff;
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
  color: #1677ff;
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
  border-color: #1677ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.15);
}

.esplus-comp-name {
  font-size: 18px;
  font-weight: 600;
  color: #1677ff;
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
