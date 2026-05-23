<template>
  <div class="home-page">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">🚀 Vue 3 + Element Plus</div>
        <h1 class="hero-title">ES-Plus</h1>
        <p class="hero-description">
          企业级中后台前端解决方案<br>
          <span class="hero-subtitle">配置化 · 联动化 · 抽象化</span>
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="goToGuide">
            <el-icon class="btn-icon"><Document /></el-icon>
            快速开始
          </el-button>
          <el-button size="large" type="success" @click="goToAiCrud">
            <el-icon class="btn-icon"><MagicStick /></el-icon>
            AI 生成 CRUD
          </el-button>
          <el-button size="large" @click="goToPlayground">
            <el-icon class="btn-icon"><Monitor /></el-icon>
            Playground
          </el-button>
          <el-button size="large" @click="goToGithub">
            <el-icon class="btn-icon"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg></el-icon>
            GitHub
          </el-button>
        </div>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-value">3</span>
            <span class="stat-label">核心组件</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">60+</span>
            <span class="stat-label">配置项</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">-70%</span>
            <span class="stat-label">代码量</span>
          </div>
        </div>
      </div>
      <div class="hero-code">
        <div class="code-window">
          <div class="code-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
            <span class="code-title">示例代码</span>
          </div>
          <pre class="code-content"><code>&lt;es-form
  :model="formModel"
  :form-item-list="formItems"
  @confirm="handleSubmit"
/&gt;

&lt;es-table
  :data-source="tableData"
  :columns="columns"
&gt;
  &lt;es-form /&gt;
&lt;/es-table&gt;

const dialog = useDialog()
dialog({ title: '提示', render: () => h('div', '内容') })</code></pre>
        </div>
      </div>
    </div>
    
    <!-- Comparison Section -->
    <div class="comparison-section">
      <h2 class="section-title">为什么选择 ES-Plus？</h2>
      <p class="section-subtitle">同样的 CRUD 页面，代码量减少 70%</p>
      <div class="comparison-grid">
        <div class="comparison-card traditional">
          <div class="comparison-header">
            <span class="comparison-badge bad">传统写法</span>
            <span class="comparison-lines">~200 行</span>
          </div>
          <pre class="comparison-code" v-pre><code>&lt;template&gt;
  &lt;el-form :model="form" :rules="rules" ref="formRef"&gt;
    &lt;el-form-item label="姓名" prop="name"&gt;
      &lt;el-input v-model="form.name" /&gt;
    &lt;/el-form-item&gt;
    &lt;el-form-item label="状态" prop="status"&gt;
      &lt;el-select v-model="form.status"&gt;
        &lt;el-option v-for="item in statusOptions"
          :key="item.value" :label="item.label"
          :value="item.value" /&gt;
      &lt;/el-select&gt;
    &lt;/el-form-item&gt;
    &lt;!-- 每个字段重复 el-form-item... --&gt;
  &lt;/el-form&gt;
  &lt;el-table :data="tableData"&gt;
    &lt;el-table-column prop="name" label="姓名" /&gt;
    &lt;el-table-column prop="status" label="状态"&gt;
      &lt;template #default="{ row }"&gt;
        &lt;el-tag&gt;{{ row.status }}&lt;/el-tag&gt;
      &lt;/template&gt;
    &lt;/el-table-column&gt;
    &lt;!-- 每列重复 el-table-column... --&gt;
  &lt;/el-table&gt;
  &lt;el-pagination ... /&gt;
  &lt;!-- + 手动查询/重置/分页/请求逻辑 --&gt;
&lt;/template&gt;

&lt;script setup&gt;
// 查询、重置、分页、请求...
// 约 150 行业务逻辑
const handleQuery = () =&gt; { ... }
const handleReset = () =&gt; { ... }
const handlePageChange = () =&gt; { ... }
const fetchData = async () =&gt; { ... }
&lt;/script&gt;</code></pre>
        </div>

        <div class="comparison-card esplus">
          <div class="comparison-header">
            <span class="comparison-badge good">ES-Plus</span>
            <span class="comparison-lines">~20 行</span>
          </div>
          <pre class="comparison-code" v-pre><code>&lt;es-table
  :columns="columns"
  :options="options"
  v-model:data-source="tableData"
  v-model:pagination="pagination"
&gt;
  &lt;es-form
    :model="form"
    :form-item-list="formItems"
    :config-btn="btns"
  /&gt;
&lt;/es-table&gt;

&lt;script setup&gt;
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
  { prop: 'status', label: '状态', formtype: 'Select',
    span: 6, dataOptions: [...] }
]
const btns = [
  { name: '查询', type: 'primary', key: 'query',
    triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]
const columns = [
  { prop: 'name', label: '姓名' },
  { prop: 'status', label: '状态' }
]
// 查询/重置/分页全自动，零事件代码
&lt;/script&gt;</code></pre>
        </div>
      </div>
      <div class="comparison-stats">
        <div class="comp-stat">
          <span class="comp-stat-value">-70%</span>
          <span class="comp-stat-label">代码量</span>
        </div>
        <div class="comp-stat">
          <span class="comp-stat-value">0</span>
          <span class="comp-stat-label">手动事件</span>
        </div>
        <div class="comp-stat">
          <span class="comp-stat-value">JSON</span>
          <span class="comp-stat-label">配置驱动</span>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="features-section">
      <h2 class="section-title">核心特性</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon-wrapper blue">
            <el-icon :size="28"><Edit /></el-icon>
          </div>
          <h3 class="feature-title">配置化</h3>
          <p class="feature-desc">通过 JSON 配置快速生成表单和表格，无需编写繁琐的模板代码，大幅提高开发效率</p>
        </div>
        
        <div class="feature-card">
          <div class="feature-icon-wrapper green">
            <el-icon :size="28"><Connection /></el-icon>
          </div>
          <h3 class="feature-title">联动化</h3>
          <p class="feature-desc">支持字段间联动、组件间通信，轻松实现复杂的业务场景和数据交互</p>
        </div>
        
        <div class="feature-card">
          <div class="feature-icon-wrapper purple">
            <el-icon :size="28"><SetUp /></el-icon>
          </div>
          <h3 class="feature-title">抽象化</h3>
          <p class="feature-desc">封装常用业务逻辑，提供高阶组件和 Hooks，让代码更简洁、更易维护</p>
        </div>
        
        <div class="feature-card">
          <div class="feature-icon-wrapper orange">
            <el-icon :size="28"><Grid /></el-icon>
          </div>
          <h3 class="feature-title">高扩展性</h3>
          <p class="feature-desc">基于 Element Plus 构建，完全兼容其 API，支持自定义渲染和插件扩展</p>
        </div>
      </div>
    </div>
    
    <!-- Components Section -->
    <div class="components-section">
      <h2 class="section-title">组件概览</h2>
      <div class="components-grid">
        <router-link to="/components/es-form" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><DocumentChecked /></el-icon>
          </div>
          <div class="component-info">
            <h3>EsForm <span class="component-tag">表单</span></h3>
            <p>高级表单组件，支持配置化字段定义、联动验证、异步加载等功能</p>
            <div class="component-links">
              <span class="link">查看文档 →</span>
            </div>
          </div>
        </router-link>
        
        <router-link to="/components/es-table" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><List /></el-icon>
          </div>
          <div class="component-info">
            <h3>EsTable <span class="component-tag">表格</span></h3>
            <p>高级表格组件，支持配置化列定义、自动分页、数据联动等特性</p>
            <div class="component-links">
              <span class="link">查看文档 →</span>
            </div>
          </div>
        </router-link>
        
        <router-link to="/advanced/use-dialog" class="component-card">
          <div class="component-icon">
            <el-icon :size="40"><ChatDotRound /></el-icon>
          </div>
          <div class="component-info">
            <h3>useDialog <span class="component-tag">弹窗</span></h3>
            <p>编程式弹窗 Hook，支持 JSX 渲染、表单集成、嵌套弹窗等高级功能</p>
            <div class="component-links">
              <span class="link">查看文档 →</span>
            </div>
          </div>
        </router-link>
      </div>
    </div>
    
    <!-- AI Coding Section -->
    <div class="ai-section">
      <h2 class="section-title">AI Coding 时代的最佳搭档</h2>
      <p class="section-subtitle">JSON 配置 = AI 最容易理解和生成的格式</p>
      <div class="ai-grid">
        <div class="ai-card">
          <div class="ai-card-icon">
            <el-icon :size="32"><MagicStick /></el-icon>
          </div>
          <h3>AI 一句话生成页面</h3>
          <p>描述业务需求，AI 直接输出 JSON 配置，即刻渲染为完整 CRUD 页面</p>
        </div>
        <div class="ai-card">
          <div class="ai-card-icon">
            <el-icon :size="32"><Edit /></el-icon>
          </div>
          <h3>JSON Schema 自动补全</h3>
          <p>提供完整 JSON Schema，Cursor / Copilot 编写配置时享受智能提示</p>
        </div>
        <div class="ai-card">
          <div class="ai-card-icon">
            <el-icon :size="32"><SetUp /></el-icon>
          </div>
          <h3>结构化 = 可校验</h3>
          <p>配置是数据，可静态校验、可 diff、可版本管理，AI 改错了一眼就能发现</p>
        </div>
      </div>
      <div class="ai-cta">
        <el-button type="success" size="large" @click="goToAiCrud">
          <el-icon class="btn-icon"><MagicStick /></el-icon>
          体验 AI CRUD 生成器
        </el-button>
      </div>
    </div>

    <!-- Get Started Section -->
    <div class="get-started-section">
      <h2 class="section-title">快速开始</h2>
      <div class="install-steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>安装依赖</h4>
            <div class="code-block">
              <code>npm install es-plus-ui element-plus @element-plus/icons-vue</code>
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>引入组件</h4>
            <div class="code-block">
              <code>import { EsForm, EsTable, useDialog } from 'es-plus-ui'</code>
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>开始使用</h4>
            <div class="code-block">
              <code>&lt;es-form :model="model" :form-item-list="items" /&gt;</code>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <footer class="home-footer">
      <p>ES-Plus © {{ new Date().getFullYear() }} - 企业级配置化前端组件库</p>
    </footer>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { Document, Monitor, Edit, Connection, SetUp, Grid, DocumentChecked, List, ChatDotRound, MagicStick } from '@element-plus/icons-vue'

const router = useRouter()

const goToGuide = () => {
  router.push('/guide/getting-started')
}

const goToPlayground = () => {
  router.push('/playground')
}

const goToAiCrud = () => {
  router.push('/ai-crud')
}

const goToGithub = () => {
  window.open('https://github.com/liujiaao/es-plus', '_blank')
}
</script>

<style lang="scss" scoped>
.home-page {
  min-height: calc(100vh - var(--header-height));
}

// Hero Section
.hero-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  min-height: 600px;
  padding: 80px 48px;
  background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
}

.hero-content {
  max-width: 560px;
}

.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 24px;
}

.hero-title {
  font-size: 72px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 16px;
  letter-spacing: -2px;
}

.hero-description {
  font-size: 22px;
  color: var(--text-color-regular);
  margin-bottom: 32px;
  line-height: 1.6;
}

.hero-subtitle {
  color: var(--text-color-secondary);
  font-size: 18px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 48px;
}

.btn-icon {
  margin-right: 6px;
}

.hero-stats {
  display: flex;
  gap: 48px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-color-secondary);
}

// Hero Code
.hero-code {
  display: flex;
  justify-content: center;
}

.code-window {
  width: 100%;
  max-width: 500px;
  background: #1e1e1e;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.code-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d2d;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  
  &.red { background: #ff5f56; }
  &.yellow { background: #ffbd2e; }
  &.green { background: #27ca40; }
}

.code-title {
  margin-left: 12px;
  font-size: 13px;
  color: #909399;
}

.code-content {
  padding: 20px;
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  line-height: 1.8;
  color: #abb2bf;
  overflow-x: auto;
}

// Comparison Section
.comparison-section {
  padding: 100px 48px;
  background: var(--bg-color);
}

.section-subtitle {
  text-align: center;
  font-size: 18px;
  color: var(--text-color-secondary);
  margin-top: -48px;
  margin-bottom: 48px;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.comparison-card {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color-lighter);
  transition: transform 0.3s, box-shadow 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  }

  &.traditional {
    border-color: #f56c6c33;
  }

  &.esplus {
    border-color: #67c23a33;
  }
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-color-page);
  border-bottom: 1px solid var(--border-color-lighter);
}

.comparison-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;

  &.bad {
    background: #fef0f0;
    color: #f56c6c;
  }

  &.good {
    background: #f0f9eb;
    color: #67c23a;
  }
}

.comparison-lines {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.comparison-code {
  padding: 16px 20px;
  margin: 0;
  background: #1e1e1e;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #abb2bf;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.comparison-stats {
  display: flex;
  justify-content: center;
  gap: 80px;
  margin-top: 48px;
}

.comp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.comp-stat-value {
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.comp-stat-label {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin-top: 8px;
}

// Features Section
.features-section {
  padding: 100px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 36px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 64px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
}

.feature-card {
  padding: 40px 32px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  }
}

.feature-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  border-radius: 16px;
  color: white;
  
  &.blue { background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent)); }
  &.green { background: linear-gradient(135deg, #67c23a, #95d475); }
  &.purple { background: linear-gradient(135deg, #6f42c1, #a855f7); }
  &.orange { background: linear-gradient(135deg, #e6a23c, #f4a460); }
}

.feature-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.feature-desc {
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.8;
}

// Components Section
.components-section {
  padding: 100px 48px;
  background: var(--bg-color-page);
}

.components-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.component-card {
  display: flex;
  padding: 32px;
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 16px;
  text-decoration: none;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.08);
    border-color: var(--primary-color);
  }
}

.component-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: var(--primary-color-light);
  border-radius: 16px;
  color: var(--primary-color);
  margin-right: 24px;
  flex-shrink: 0;
}

.component-info {
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  p {
    font-size: 14px;
    color: var(--text-color-secondary);
    line-height: 1.6;
    margin-bottom: 16px;
  }
}

.component-tag {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--primary-color-light);
  color: var(--primary-color);
  border-radius: 4px;
  font-weight: 500;
}

.component-links {
  .link {
    font-size: 14px;
    color: var(--primary-color);
    font-weight: 500;
  }
}

// AI Section
.ai-section {
  padding: 100px 48px;
  background: linear-gradient(135deg, #f0f9eb 0%, #ecf5ff 100%);
  text-align: center;
}

.ai-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.ai-card {
  padding: 40px 24px;
  background: var(--bg-color);
  border-radius: 16px;
  border: 1px solid var(--border-color-lighter);
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
  }

  p {
    font-size: 14px;
    color: var(--text-color-secondary);
    line-height: 1.7;
  }
}

.ai-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #67c23a, #409eff);
  color: white;
}

.ai-cta {
  margin-top: 48px;
}

// Get Started Section
.get-started-section {
  padding: 100px 48px;
  max-width: 800px;
  margin: 0 auto;
}

.install-steps {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.step-number {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color), var(--brand-accent));
  color: white;
  border-radius: 50%;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  
  h4 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 12px;
  }
}

.code-block {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px 20px;
  
  code {
    color: #abb2bf;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 14px;
  }
}

// Footer
.home-footer {
  padding: 48px;
  text-align: center;
  border-top: 1px solid var(--border-color-lighter);
  
  p {
    font-size: 14px;
    color: var(--text-color-secondary);
  }
}

// Responsive
@media (max-width: 1200px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .comparison-stats {
    gap: 48px;
  }

  .hero-section {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .hero-content {
    max-width: 100%;
  }
  
  .hero-actions {
    justify-content: center;
  }
  
  .hero-stats {
    justify-content: center;
  }
  
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .components-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 48px;
  }

  .features-grid,
  .ai-grid {
    grid-template-columns: 1fr;
  }

  .hero-section {
    padding: 60px 24px;
  }

  .features-section,
  .components-section,
  .get-started-section,
  .comparison-section,
  .ai-section {
    padding: 60px 24px;
  }
}
</style>
