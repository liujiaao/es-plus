<template>
  <div class="configuration-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-s-tools" />
        <span>全局配置</span>
      </div>
      <h1 class="hero-title">
        配置指南
      </h1>
      <p class="hero-desc">
        通过全局配置，你可以自定义 ES-Plus 组件的行为，
        包括数据请求、分页布局、字段映射等，让组件更好地适配你的项目。
      </p>
    </section>

    <!-- EsTable Config -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-s-data" />
        </div>
        <h2 class="section-title">
          EsTable 配置
        </h2>
      </div>
      <p class="section-desc">
        EsTable 支持以下全局配置项：
      </p>

      <!-- $httpRequest -->
      <div class="config-item">
        <div class="config-header">
          <h3 class="config-name">
            $httpRequest
          </h3>
          <span class="config-badge required">必填</span>
        </div>
        <p class="config-desc">
          配置表格数据请求方法，EsTable 会自动调用此方法获取数据。
        </p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('tableHttp')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        // 返回 Promise
        return axios({
          url,
          method: options.method || 'POST',
          data: formParams,
          headers
        })
      }
    }
  }
})</code></pre>
        </div>
      </div>

      <!-- paginationLayout -->
      <div class="config-item">
        <div class="config-header">
          <h3 class="config-name">
            paginationLayout
          </h3>
          <span class="config-badge optional">可选</span>
        </div>
        <p class="config-desc">
          配置分页组件的显示方式和页码选项。
        </p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('pagination')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>Vue.use(EsPlus, {
  EsTable: {
    methods: {
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: false
      })
    }
  }
})</code></pre>
        </div>
        <div class="param-table-wrapper">
          <table class="param-table">
            <thead>
              <tr>
                <th>参数</th>
                <th>说明</th>
                <th>类型</th>
                <th>默认值</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>layout</td>
                <td>分页元素布局</td>
                <td>String</td>
                <td>'total, sizes, prev, pager, next, jumper'</td>
              </tr>
              <tr>
                <td>pageSizes</td>
                <td>每页条数选项</td>
                <td>Array</td>
                <td>[10, 20, 50, 100]</td>
              </tr>
              <tr>
                <td>isSmall</td>
                <td>是否使用小型分页</td>
                <td>Boolean</td>
                <td>true</td>
              </tr>
              <tr>
                <td>background</td>
                <td>是否为分页按钮添加背景色</td>
                <td>Boolean</td>
                <td>false</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- configQueryfieldOutput -->
      <div class="config-item">
        <div class="config-header">
          <h3 class="config-name">
            configQueryfieldOutput
          </h3>
          <span class="config-badge optional">可选</span>
        </div>
        <p class="config-desc">
          配置响应数据字段映射，用于适配不同后端接口的数据结构。
        </p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('fieldOutput')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>Vue.use(EsPlus, {
  EsTable: {
    methods: {
      configQueryfieldOutput() {
        return {
          total: 'total',           // 总记录数字段
          pageSize: 'pageSize',     // 每页条数字段
          current: 'pageIndex',     // 当前页字段
          tableData: 'data'         // 列表数据字段
        }
      }
    }
  }
})</code></pre>
        </div>
      </div>
    </section>

    <!-- EsForm Config -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-s-order" />
        </div>
        <h2 class="section-title">
          EsForm 配置
        </h2>
      </div>
      <p class="section-desc">
        EsForm 支持以下全局配置项：
      </p>

      <!-- $httpRequest -->
      <div class="config-item">
        <div class="config-header">
          <h3 class="config-name">
            $httpRequest
          </h3>
          <span class="config-badge required">必填</span>
        </div>
        <p class="config-desc">
          配置表单数据请求方法，用于表单内 Select 等组件的数据源请求。
        </p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('formHttp')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>Vue.use(EsPlus, {
  EsForm: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return axios({
          url,
          method: options.method || 'POST',
          data: formParams
        })
      }
    }
  }
})</code></pre>
        </div>
      </div>

      <!-- fieldFieldOutput -->
      <div class="config-item">
        <div class="config-header">
          <h3 class="config-name">
            fieldFieldOutput
          </h3>
          <span class="config-badge optional">可选</span>
        </div>
        <p class="config-desc">
          配置表单关联数据的响应字段映射。
        </p>
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('formFieldOutput')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>Vue.use(EsPlus, {
  EsForm: {
    methods: {
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
})</code></pre>
        </div>
      </div>
    </section>

    <!-- Full Config Example -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-document-checked" />
        </div>
        <h2 class="section-title">
          完整配置示例
        </h2>
      </div>
      <p class="section-desc">
        以下是一个完整的配置示例，包含了所有常用的配置项：
      </p>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('fullConfig')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>import Vue from 'vue'
import EsPlus from '@es-plus/vue2'
import axios from 'axios'

Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          url,
          method: options?.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return axios(opt)
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
      $httpRequest({ url, formParams, ...options }) {
        return axios.post(url, formParams)
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
})</code></pre>
      </div>

      <div class="tip-card">
        <div class="tip-icon">
          <i class="el-icon-info-filled" />
        </div>
        <div class="tip-content">
          <strong>提示</strong>
          <span>全局配置中的方法会被组件内部调用，如果返回的 Promise 被 reject，组件会自动处理错误提示。</span>
        </div>
      </div>
    </section>

    <!-- Config Summary Table -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-s-unfold" />
        </div>
        <h2 class="section-title">
          配置项汇总
        </h2>
      </div>

      <div class="config-table-wrapper">
        <table class="config-table">
          <thead>
            <tr>
              <th>配置项</th>
              <th>所属组件</th>
              <th>说明</th>
              <th>必填</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>$httpRequest</code></td>
              <td>EsTable / EsForm</td>
              <td>数据请求方法</td>
              <td><span class="badge required">是</span></td>
            </tr>
            <tr>
              <td><code>paginationLayout</code></td>
              <td>EsTable</td>
              <td>分页布局配置</td>
              <td><span class="badge optional">否</span></td>
            </tr>
            <tr>
              <td><code>configQueryfieldOutput</code></td>
              <td>EsTable</td>
              <td>表格响应字段映射</td>
              <td><span class="badge optional">否</span></td>
            </tr>
            <tr>
              <td><code>fieldFieldOutput</code></td>
              <td>EsForm</td>
              <td>表单响应字段映射</td>
              <td><span class="badge optional">否</span></td>
            </tr>
          </tbody>
        </table>
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
        配置完成后，你可以开始学习和使用各个组件：
      </p>

      <div class="next-links">
        <router-link
          to="/component/estable"
          class="next-card"
        >
          <div class="next-icon blue">
            <i class="el-icon-s-data" />
          </div>
          <div class="next-info">
            <h3>EsTable 表格组件</h3>
            <p>了解配置化表格的详细用法和高级功能</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link
          to="/component/esform"
          class="next-card"
        >
          <div class="next-icon purple">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-info">
            <h3>EsForm 表单组件</h3>
            <p>学习配置化表单的各种控件类型</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link
          to="/component/esdialog"
          class="next-card"
        >
          <div class="next-icon orange">
            <i class="el-icon-s-claim" />
          </div>
          <div class="next-info">
            <h3>useDialog 弹窗</h3>
            <p>掌握函数式弹窗的使用方法</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GuideConfiguration',
  methods: {
    copyCode(type) {
      const codes = {
        tableHttp: `Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        return axios({
          url,
          method: options.method || 'POST',
          data: formParams,
          headers
        })
      }
    }
  }
})`,
        pagination: `Vue.use(EsPlus, {
  EsTable: {
    methods: {
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true,
        background: false
      })
    }
  }
})`,
        fieldOutput: `Vue.use(EsPlus, {
  EsTable: {
    methods: {
      configQueryfieldOutput() {
        return {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        }
      }
    }
  }
})`,
        formHttp: `Vue.use(EsPlus, {
  EsForm: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return axios({
          url,
          method: options.method || 'POST',
          data: formParams
        })
      }
    }
  }
})`,
        formFieldOutput: `Vue.use(EsPlus, {
  EsForm: {
    methods: {
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
        fullConfig: `import Vue from 'vue'
import EsPlus from '@es-plus/vue2'
import axios from 'axios'

Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          url,
          method: options?.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }
        if (opt.method.toUpperCase() === 'GET') {
          opt.params = formParams
        } else {
          opt.data = formParams
        }
        return axios(opt)
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
      $httpRequest({ url, formParams, ...options }) {
        return axios.post(url, formParams)
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
})`
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

.configuration-page {
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
  margin: 0 0 24px;
}

// Config Item
.config-item {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-color;
  padding: 24px;
  margin-bottom: 20px;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  }

  .config-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .config-name {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      font-family: 'Consolas', monospace;
      color: $primary;
    }

    .config-badge {
      padding: 2px 10px;
      border-radius: 50px;
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

  .config-desc {
    font-size: 14px;
    color: $text-secondary;
    margin: 0 0 16px;
    line-height: 1.6;
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

// Param Table
.param-table-wrapper {
  overflow-x: auto;
  margin-top: 16px;
}

.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 10px 14px;
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
  }

  tbody tr:hover {
    background: $bg-light;
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
  .configuration-page {
    padding: 20px 16px;
  }

  .hero-section {
    padding: 40px 20px;

    .hero-title {
      font-size: 32px;
    }
  }

  .config-item {
    padding: 20px;
  }

  .next-links {
    grid-template-columns: 1fr;
  }

  .config-table,
  .param-table {
    font-size: 13px;

    th, td {
      padding: 10px 12px;
    }
  }
}
</style>
