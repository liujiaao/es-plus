<template>
  <div class="installation-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-download" />
        <span>轻松集成</span>
      </div>
      <h1 class="hero-title">
        安装指南
      </h1>
      <p class="hero-desc">
        本节将介绍如何在项目中安装和配置 ES-Plus 组件库，
        只需几步即可开始使用。
      </p>
    </section>

    <!-- Environment Requirements -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-info-filled" />
        </div>
        <h2 class="section-title">
          环境要求
        </h2>
      </div>
      <p class="section-desc">
        在开始安装之前，请确保你的开发环境满足以下要求：
      </p>
      <div class="requirement-cards">
        <div class="req-card">
          <div class="req-icon vue">
            <i class="el-icon-s-flag" />
          </div>
          <div class="req-info">
            <div class="req-name">
              Vue
            </div>
            <div class="req-version">
              2.6+
            </div>
          </div>
        </div>
        <div class="req-card">
          <div class="req-icon element">
            <i class="el-icon-s-management" />
          </div>
          <div class="req-info">
            <div class="req-name">
              Element UI
            </div>
            <div class="req-version">
              2.15+
            </div>
          </div>
        </div>
        <div class="req-card">
          <div class="req-icon browser">
            <i class="el-icon-monitor" />
          </div>
          <div class="req-info">
            <div class="req-name">
              浏览器
            </div>
            <div class="req-version">
              现代浏览器
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Step 1: npm Install -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          01
        </div>
        <div class="step-info">
          <h2 class="section-title">
            npm 安装
          </h2>
          <p class="section-desc">
            在项目根目录执行以下命令安装 ES-Plus
          </p>
        </div>
      </div>
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">bash</span>
          <button
            class="copy-btn"
            @click="copyCode('npm')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>npm install @es-plus/vue2 --save</code></pre>
      </div>
      <p class="section-desc">
        或者使用 yarn：
      </p>
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">bash</span>
          <button
            class="copy-btn"
            @click="copyCode('yarn')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>yarn add @es-plus/vue2</code></pre>
      </div>
    </section>

    <!-- Step 2: Full Import -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          02
        </div>
        <div class="step-info">
          <h2 class="section-title">
            完整引入
          </h2>
          <p class="section-desc">
            在 main.js 中写入以下内容，引入并注册组件库
          </p>
        </div>
      </div>
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('fullImport')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

// 引入 Element UI
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// 引入 ES-Plus
import EsPlus from '@es-plus/vue2'

// 注册 Element UI
Vue.use(ElementUI)

// 注册 ES-Plus
Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, formParams }) {
        return axios.post(url, formParams)
      }
    }
  },
  EsForm: {
    methods: {
      $httpRequest({ url, formParams }) {
        return axios.post(url, formParams)
      }
    }
  }
})

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')</code></pre>
      </div>
    </section>

    <!-- Step 3: On-demand Import -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          03
        </div>
        <div class="step-info">
          <h2 class="section-title">
            按需引入（推荐）
          </h2>
          <p class="section-desc">
            借助 babel-plugin-component，只引入需要的组件以减小打包体积
          </p>
        </div>
      </div>

      <div class="import-steps">
        <div class="import-step-card">
          <div class="step-label">
            <span class="step-dot">1</span>
            <span class="step-text">安装插件</span>
          </div>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">bash</span>
              <button
                class="copy-btn"
                @click="copyCode('plugin')"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>npm install babel-plugin-component -D</code></pre>
          </div>
        </div>

        <div class="import-step-card">
          <div class="step-label">
            <span class="step-dot">2</span>
            <span class="step-text">配置 .babelrc</span>
          </div>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">json</span>
              <button
                class="copy-btn"
                @click="copyCode('babelrc')"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>{
  "plugins": [
    [
      "component",
      {
        "libraryName": "@es-plus/vue2",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}</code></pre>
          </div>
        </div>

        <div class="import-step-card">
          <div class="step-label">
            <span class="step-dot">3</span>
            <span class="step-text">按需引入组件</span>
          </div>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">javascript</span>
              <button
                class="copy-btn"
                @click="copyCode('ondemand')"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>import Vue from 'vue'
import { EsTable, EsForm, useDialog } from '@es-plus/vue2'

Vue.component('EsTable', EsTable)
Vue.component('EsForm', EsForm)
Vue.prototype.$useDialog = useDialog</code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- Tips Section -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-s-claim" />
        </div>
        <h2 class="section-title">
          使用提示
        </h2>
      </div>
      
      <div class="tips-grid">
        <div class="tip-card">
          <div class="tip-icon">
            <i class="el-icon-check" />
          </div>
          <div class="tip-content">
            <strong>安装完成</strong>
            <span>安装完成后，可以查看<router-link to="/guide/quickstart">快速上手</router-link>了解基本用法。</span>
          </div>
        </div>

        <div class="tip-card">
          <div class="tip-icon">
            <i class="el-icon-warning-outline" />
          </div>
          <div class="tip-content">
            <strong>依赖说明</strong>
            <span>ES-Plus 依赖 Element UI，请确保已正确安装和引入 Element UI。</span>
          </div>
        </div>

        <div class="tip-card">
          <div class="tip-icon">
            <i class="el-icon-s-tools" />
          </div>
          <div class="tip-content">
            <strong>配置说明</strong>
            <span>$httpRequest 是必填配置，用于组件内部发起数据请求。</span>
          </div>
        </div>

        <div class="tip-card">
          <div class="tip-icon">
            <i class="el-icon-question" />
          </div>
          <div class="tip-content">
            <strong>遇到问题？</strong>
            <span>如果在安装过程中遇到问题，可以参考 GitHub 仓库或提交 Issue。</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer CTA -->
    <section class="footer-cta">
      <div class="cta-content">
        <i class="el-icon-right" />
        <h3>准备开始</h3>
        <p>安装完成后，跟随快速上手指南，创建你的第一个页面</p>
        <router-link
          to="/guide/quickstart"
          class="cta-link"
        >
          <span>快速上手</span>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'ComponentInstallation',
  methods: {
    copyCode(type) {
      const codes = {
        npm: 'npm install @es-plus/vue2 --save',
        yarn: 'yarn add @es-plus/vue2',
        fullImport: `import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

// 引入 Element UI
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// 引入 ES-Plus
import EsPlus from '@es-plus/vue2'

// 注册 Element UI
Vue.use(ElementUI)

// 注册 ES-Plus
Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, formParams }) {
        return axios.post(url, formParams)
      }
    }
  },
  EsForm: {
    methods: {
      $httpRequest({ url, formParams }) {
        return axios.post(url, formParams)
      }
    }
  }
})

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')`,
        plugin: 'npm install babel-plugin-component -D',
        babelrc: `{
  "plugins": [
    [
      "component",
      {
        "libraryName": "@es-plus/vue2",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}`,
        ondemand: `import Vue from 'vue'
import { EsTable, EsForm, useDialog } from '@es-plus/vue2'

Vue.component('EsTable', EsTable)
Vue.component('EsForm', EsForm)
Vue.prototype.$useDialog = useDialog`
      }

      const text = codes[type]
      if (text) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            this.$message.success('已复制到剪贴板')
          })
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = text
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
          this.$message.success('已复制到剪贴板')
        }
      }
    }
  }
}
</script>

<style lang="scss" scoped>
$primary: #409eff;
$success: #67c23a;
$warning: #e6a23c;
$danger: #f56c6c;
$text-primary: #1a1a1a;
$text-secondary: #4a5568;
$text-tertiary: #718096;
$border-color: #e2e8f0;
$bg-light: #f7fafc;

.installation-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px;
  color: $text-primary;
  line-height: 1.6;
}

// Hero Section
.hero-section {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  margin-bottom: 50px;
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: rgba(255,255,255,0.15);
    border-radius: 50px;
    font-size: 14px;
    margin-bottom: 20px;
    backdrop-filter: blur(10px);

    i {
      font-size: 16px;
    }
  }

  .hero-title {
    font-size: 42px;
    font-weight: 700;
    margin: 0 0 16px;
    position: relative;
  }

  .hero-desc {
    max-width: 500px;
    margin: 0 auto;
    font-size: 16px;
    opacity: 0.9;
    line-height: 1.7;
    position: relative;
  }
}

// Section Common
.section {
  margin-bottom: 50px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  .section-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: white;

    &.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    &.purple { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    &.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    &.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
  }

  .section-title {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }
}

.section-desc {
  font-size: 15px;
  color: $text-secondary;
  margin: 0 0 20px;
}

// Step Header
.step-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;

  .step-number {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .step-info {
    .section-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 6px;
    }

    .section-desc {
      margin: 0;
    }
  }
}

// Requirement Cards
.requirement-cards {
  display: flex;
  gap: 16px;

  .req-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px;
    background: white;
    border-radius: 12px;
    border: 1px solid $border-color;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.08);
    }

    .req-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;

      &.vue { background: linear-gradient(135deg, #41b883 0%, #34495e 100%); }
      &.element { background: linear-gradient(135deg, #409eff 0%, #67c23a 100%); }
      &.browser { background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); }
    }

    .req-info {
      .req-name {
        font-size: 14px;
        color: $text-tertiary;
        margin-bottom: 2px;
      }

      .req-version {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
      }
    }
  }
}

// Import Steps
.import-steps {
  display: flex;
  flex-direction: column;
  gap: 24px;

  .import-step-card {
    background: white;
    border-radius: 12px;
    border: 1px solid $border-color;
    padding: 20px;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }

    .step-label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;

      .step-dot {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: white;
      }

      .step-text {
        font-size: 15px;
        font-weight: 600;
        color: $text-primary;
      }
    }

    .code-block {
      margin-bottom: 0;
    }
  }
}

// Code Block
.code-block {
  background: #1e1e1e;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #2d2d2d;
    border-bottom: 1px solid #3d3d3d;

    .code-lang {
      font-size: 12px;
      color: #9cdcfe;
      text-transform: uppercase;
      font-weight: 500;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      font-size: 12px;
      color: #ccc;
      background: #3d3d3d;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        background: #4d4d4d;
        color: white;
      }
    }
  }

  pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;

    code {
      font-family: 'Fira Code', 'Consolas', monospace;
    }
  }
}

// Tips Grid
.tips-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  .tip-card {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    background: white;
    border-radius: 12px;
    border: 1px solid $border-color;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.06);
    }

    &:nth-child(1) {
      border-left: 4px solid $success;
      .tip-icon { color: $success; }
    }

    &:nth-child(2) {
      border-left: 4px solid $warning;
      .tip-icon { color: $warning; }
    }

    &:nth-child(3) {
      border-left: 4px solid $primary;
      .tip-icon { color: $primary; }
    }

    &:nth-child(4) {
      border-left: 4px solid #f56c6c;
      .tip-icon { color: #f56c6c; }
    }

    .tip-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .tip-content {
      font-size: 14px;
      color: $text-secondary;
      line-height: 1.6;

      strong {
        display: block;
        color: $text-primary;
        margin-bottom: 4px;
      }

      a {
        color: $primary;
        text-decoration: none;
        margin: 0 4px;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

// Footer CTA
.footer-cta {
  margin-top: 60px;
  padding: 40px;
  background: $bg-light;
  border-radius: 16px;
  text-align: center;

  .cta-content {
    > i {
      font-size: 40px;
      color: $primary;
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 8px;
    }

    p {
      font-size: 14px;
      color: $text-secondary;
      margin: 0 0 20px;
    }

    .cta-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);

        i {
          transform: translateX(4px);
        }
      }

      i {
        transition: transform 0.3s;
      }
    }
  }
}

// Responsive
@media (max-width: 768px) {
  .installation-page {
    padding: 20px 16px;
  }

  .hero-section {
    padding: 40px 20px;

    .hero-title {
      font-size: 32px;
    }
  }

  .requirement-cards {
    flex-direction: column;
  }

  .tips-grid {
    grid-template-columns: 1fr;
  }
}
</style>
