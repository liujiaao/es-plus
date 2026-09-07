<template>
  <div class="installation-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-download" />
        <span>npm install</span>
      </div>
      <h1 class="hero-title">
        安装
      </h1>
      <p class="hero-desc">
        ES-Plus 提供了多种安装方式，你可以根据项目需求选择完整引入或按需引入，
        灵活适配不同规模的应用场景。
      </p>
    </section>

    <!-- Step 1: NPM Install -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          01
        </div>
        <div class="step-info">
          <h2 class="section-title">
            NPM 安装
          </h2>
          <p class="section-desc">
            推荐使用 npm 的方式安装，它能更好地和 webpack 打包工具配合使用
          </p>
        </div>
      </div>

      <div class="install-options">
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">npm</span>
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

        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">yarn</span>
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
      </div>
    </section>

    <!-- Step 2: Import ES-Plus -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          02
        </div>
        <div class="step-info">
          <h2 class="section-title">
            引入 ES-Plus
          </h2>
          <p class="section-desc">
            在 main.js 中写入以下内容，完成组件注册和全局配置
          </p>
        </div>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('mainjs')"
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
import http from '@/utils/request'

Vue.use(ElementUI)

// 注册 ES-Plus 并配置全局方法
Vue.use(EsPlus, {
  EsTable: {
    methods: {
      // 配置表格数据请求方法
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          baseURL: '',
          url,
          contentType: 'application/json',
          method: options?.method || 'POST',
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return http(opt)
      },
      // 配置分页布局
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: false
      }),
      // 配置响应数据字段映射
      configQueryfieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        }
      }
    }
  },
  EsForm: {
    methods: {
      // 配置表单数据请求方法
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          baseURL: '',
          url,
          contentType: 'application/json',
          method: options.method || 'POST',
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return http(opt)
      },
      // 配置响应数据字段映射
      fieldFieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          listData: 'data'
        }
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

      <!-- Configuration Table -->
      <div class="config-section">
        <h3 class="config-title">
          <i class="el-icon-s-tools" />
          配置项说明
        </h3>
        <div class="config-table-wrapper">
          <table class="config-table">
            <thead>
              <tr>
                <th>配置项</th>
                <th>说明</th>
                <th>类型</th>
                <th>必填</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>$httpRequest</code></td>
                <td>数据请求方法，用于组件内部发起 API 请求</td>
                <td>Function</td>
                <td><span class="badge required">是</span></td>
              </tr>
              <tr>
                <td><code>paginationLayout</code></td>
                <td>分页组件布局配置</td>
                <td>Function</td>
                <td><span class="badge optional">否</span></td>
              </tr>
              <tr>
                <td><code>configQueryfieldOutput</code></td>
                <td>表格响应数据字段映射</td>
                <td>Function</td>
                <td><span class="badge optional">否</span></td>
              </tr>
              <tr>
                <td><code>fieldFieldOutput</code></td>
                <td>表单响应数据字段映射</td>
                <td>Function</td>
                <td><span class="badge optional">否</span></td>
              </tr>
            </tbody>
          </table>
        </div>
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
            借助 babel-plugin-component，我们可以只引入需要的组件，以达到减小项目体积的目的
          </p>
        </div>
      </div>

      <div class="step-subtitle">
        <i class="el-icon-s-promotion" />
        <span>首先，安装 babel-plugin-component</span>
      </div>
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">bash</span>
          <button
            class="copy-btn"
            @click="copyCode('babelPlugin')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>npm install babel-plugin-component -D</code></pre>
      </div>

      <div class="step-subtitle">
        <i class="el-icon-edit-outline" />
        <span>然后，将 .babelrc 修改为</span>
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
    </section>

    <!-- Step 4: Full Import Example -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          04
        </div>
        <div class="step-info">
          <h2 class="section-title">
            完整引入示例
          </h2>
          <p class="section-desc">
            以下是在页面中按需引入组件的示例代码
          </p>
        </div>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('importExample')"
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

      <div class="tip-card">
        <div class="tip-icon">
          <i class="el-icon-warning-outline" />
        </div>
        <div class="tip-content">
          <strong>提示</strong>
          <span>完整引入和按需引入两种方式可任选其一，但建议在生产环境使用按需引入以减小打包体积。</span>
        </div>
      </div>
    </section>

    <!-- Next Steps -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-right" />
        </div>
        <h2 class="section-title">
          下一步
        </h2>
      </div>
      <p class="section-desc">
        安装完成后，你可以开始探索 ES-Plus 的强大功能：
      </p>

      <div class="next-links">
        <router-link
          to="/guide/quickstart"
          class="next-card"
        >
          <div class="next-icon blue">
            <i class="el-icon-time" />
          </div>
          <div class="next-info">
            <h3>快速开始</h3>
            <p>5 分钟快速上手教程，创建你的第一个页面</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link
          to="/component/estable"
          class="next-card"
        >
          <div class="next-icon purple">
            <i class="el-icon-s-data" />
          </div>
          <div class="next-info">
            <h3>EsTable 组件</h3>
            <p>了解配置化表格的详细用法和高级功能</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link
          to="/component/esform"
          class="next-card"
        >
          <div class="next-icon orange">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-info">
            <h3>EsForm 组件</h3>
            <p>学习配置化表单的各种控件类型</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GuideInstallation',
  methods: {
    copyCode(type) {
      const codes = {
        npm: 'npm install @es-plus/vue2 --save',
        yarn: 'yarn add @es-plus/vue2',
        mainjs: `import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import http from '@/utils/request'

Vue.use(ElementUI)

Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          baseURL: '',
          url,
          contentType: 'application/json',
          method: options?.method || 'POST',
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return http(opt)
      },
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: false
      }),
      configQueryfieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        }
      }
    }
  },
  EsForm: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          baseURL: '',
          url,
          contentType: 'application/json',
          method: options.method || 'POST',
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return http(opt)
      },
      fieldFieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          listData: 'data'
        }
      }
    }
  }
})`,
        babelPlugin: 'npm install babel-plugin-component -D',
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
        importExample: `import Vue from 'vue'
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
    max-width: 550px;
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

// Install Options
.install-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

// Step Subtitle
.step-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 24px 0 12px;
  font-size: 14px;
  color: $text-secondary;
  font-weight: 500;

  i {
    color: $primary;
    font-size: 16px;
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

// Config Section
.config-section {
  margin-top: 24px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  border: 1px solid $border-color;

  .config-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px;
    color: $text-primary;

    i {
      color: $primary;
    }
  }
}

// Config Table
.config-table-wrapper {
  overflow-x: auto;
}

.config-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid $border-color;
  }

  th {
    font-weight: 600;
    color: $text-primary;
    background: $bg-light;
    white-space: nowrap;
  }

  td {
    color: $text-secondary;

    code {
      padding: 2px 6px;
      background: $bg-light;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      color: $primary;
      font-size: 12px;
    }
  }

  tbody tr:hover {
    background: $bg-light;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;

    &.required {
      background: #fff1f0;
      color: #ff4d4f;
    }

    &.optional {
      background: #f6ffed;
      color: #52c41a;
    }
  }
}

// Tip Card
.tip-card {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fff9e6 0%, #fff5d6 100%);
  border-radius: 10px;
  border-left: 4px solid #faad14;
  margin-top: 20px;

  .tip-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #faad14;
    font-size: 18px;
    flex-shrink: 0;
  }

  .tip-content {
    font-size: 14px;
    color: $text-secondary;
    line-height: 1.6;

    strong {
      color: #d48806;
      margin-right: 8px;
    }
  }
}

// Next Links
.next-links {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  .next-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: white;
    border-radius: 12px;
    border: 1px solid $border-color;
    text-decoration: none;
    transition: all 0.3s ease;

    &:hover {
      transform: translateX(4px);
      border-color: $primary;
      box-shadow: 0 4px 20px rgba(64,158,255,0.1);

      .el-icon-arrow-right {
        color: $primary;
        transform: translateX(4px);
      }
    }

    .next-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;
      flex-shrink: 0;

      &.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      &.purple { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
      &.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
      &.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    }

    .next-info {
      flex: 1;

      h3 {
        font-size: 15px;
        font-weight: 600;
        color: $text-primary;
        margin: 0 0 4px;
      }

      p {
        font-size: 13px;
        color: $text-tertiary;
        margin: 0;
        line-height: 1.5;
      }
    }

    .el-icon-arrow-right {
      font-size: 18px;
      color: $text-tertiary;
      transition: all 0.3s;
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

  .install-options {
    grid-template-columns: 1fr;
  }

  .next-links {
    grid-template-columns: 1fr;
  }

  .config-table {
    font-size: 13px;

    th, td {
      padding: 10px 12px;
    }
  }
}
</style>
