<template>
  <div class="quickstart-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-time" />
        <span>5 分钟快速上手</span>
      </div>
      <h1 class="hero-title">
        快速开始
      </h1>
      <p class="hero-desc">
        跟随本教程，你将在几分钟内完成 ES-Plus 的环境搭建，
        并运行你的第一个中后台应用页面。
      </p>
    </section>

    <!-- Prerequisites -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-info-filled" />
        </div>
        <h2 class="section-title">
          环境准备
        </h2>
      </div>
      <p class="section-desc">
        在开始之前，请确保你的开发环境满足以下要求：
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

    <!-- Step 1: Install -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          01
        </div>
        <div class="step-info">
          <h2 class="section-title">
            安装依赖
          </h2>
          <p class="section-desc">
            在项目根目录执行以下命令安装 ES-Plus 及其依赖
          </p>
        </div>
      </div>
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">bash</span>
          <button
            class="copy-btn"
            @click="copyCode('install')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>npm install @es-plus/vue2 element-ui --save</code></pre>
      </div>
    </section>

    <!-- Step 2: Configure -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          02
        </div>
        <div class="step-info">
          <h2 class="section-title">
            引入并配置
          </h2>
          <p class="section-desc">
            在项目的入口文件 main.js 中引入并注册 ES-Plus
          </p>
        </div>
      </div>
      
      <div class="config-tabs">
        <div class="tab-header">
          <div 
            class="tab-item" 
            :class="{ active: activeTab === 'full' }"
            @click="activeTab = 'full'"
          >
            完整配置
          </div>
          <div 
            class="tab-item" 
            :class="{ active: activeTab === 'minimal' }"
            @click="activeTab = 'minimal'"
          >
            最小配置
          </div>
        </div>
        
        <div
          v-show="activeTab === 'full'"
          class="code-block"
        >
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
import App from './App.vue'
import router from './router'

// 引入 Element UI
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// 引入 ES-Plus
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'

// 引入你的 HTTP 请求工具（如 axios 封装）
import http from '@/utils/request'

Vue.use(ElementUI)

// 注册 ES-Plus 并配置全局方法
Vue.use(EsPlus, {
  EsTable: {
    methods: {
      // 配置表格数据请求方法（必填）
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
        return http(opt)
      },
      // 配置分页布局（可选）
      paginationLayout: () => ({
        layout: 'total, sizes, prev, pager, next, jumper',
        pageSizes: [10, 20, 50, 100],
        isSmall: true
      }),
      // 配置响应数据字段映射（可选）
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
      // 配置表单数据请求方法（必填）
      $httpRequest({ url, formParams, ...options }) {
        return http({
          url,
          method: options.method || 'POST',
          data: formParams
        })
      }
    }
  }
})

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')</code></pre>
        </div>

        <div
          v-show="activeTab === 'minimal'"
          class="code-block"
        >
          <div class="code-header">
            <span class="code-lang">javascript</span>
            <button
              class="copy-btn"
              @click="copyCode('minimalConfig')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import http from '@/utils/request'

Vue.use(ElementUI)

Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return http({
          url,
          method: options?.method || 'POST',
          data: formParams
        })
      }
    }
  },
  EsForm: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return http({
          url,
          method: options.method || 'POST',
          data: formParams
        })
      }
    }
  }
})

new Vue({ render: h => h(App) }).$mount('#app')</code></pre>
        </div>
      </div>

      <div class="tip-card">
        <div class="tip-icon">
          <i class="el-icon-warning-outline" />
        </div>
        <div class="tip-content">
          <strong>提示</strong>
          <span>$httpRequest 是必填配置，用于组件内部发起数据请求。如果没有配置，表格和表单将无法自动获取数据。</span>
        </div>
      </div>
    </section>

    <!-- Step 3: Create Page -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          03
        </div>
        <div class="step-info">
          <h2 class="section-title">
            创建第一个页面
          </h2>
          <p class="section-desc">
            创建一个简单的用户列表页面，展示表格和表单的基础用法
          </p>
        </div>
      </div>

      <div class="feature-showcase">
        <div class="showcase-preview">
          <div class="preview-header">
            <i class="el-icon-s-data" />
            <span>用户列表示例</span>
          </div>
          <div class="preview-body">
            <div class="mock-form">
              <div class="mock-input">
                用户名
              </div>
              <div class="mock-select">
                状态 ▼
              </div>
              <div class="mock-btn primary">
                查询
              </div>
              <div class="mock-btn">
                重置
              </div>
            </div>
            <div class="mock-table">
              <div class="mock-row">
                <span>1</span>
                <span>张三</span>
                <span>zhangsan@email.com</span>
                <span class="tag success">启用</span>
                <span class="action">编辑 删除</span>
              </div>
              <div class="mock-row">
                <span>2</span>
                <span>李四</span>
                <span>lisi@email.com</span>
                <span class="tag danger">禁用</span>
                <span class="action">编辑 删除</span>
              </div>
            </div>
          </div>
        </div>

        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">vue</span>
            <button
              class="copy-btn"
              @click="copyCode('pageExample')"
            >
              <i class="el-icon-document-copy" />
              复制
            </button>
          </div>
          <pre v-pre><code>&lt;template&gt;
  &lt;div class="user-list-page"&gt;
    &lt;es-table
      ref="userTable"
      :columns="columns"
      :options="tableOptions"
    &gt;
      &lt;es-form
        :form-item-list="searchItems"
        :model="searchForm"
        :config-btn="searchBtns"
      /&gt;
    &lt;/es-table&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  data() {
    return {
      searchForm: { username: '', status: '' },
      searchItems: [
        {
          prop: 'username',
          label: '用户名',
          span: 6,
          formtype: 'Input',
          attrs: { placeholder: '请输入用户名', clearable: true }
        },
        {
          prop: 'status',
          label: '状态',
          span: 6,
          formtype: 'Select',
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]
        }
      ],
      searchBtns: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true }
      ],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'username', label: '用户名', width: 150 },
        { key: 'email', label: '邮箱', minWidth: 200 },
        {
          key: 'status',
          label: '状态',
          width: 100,
          render: (h, { row }) => {
            const type = row.status === '1' ? 'success' : 'danger'
            const text = row.status === '1' ? '启用' : '禁用'
            return &lt;el-tag type={type} size="small"&gt;{text}&lt;/el-tag&gt;
          }
        },
        {
          key: 'action',
          label: '操作',
          width: 150,
          fixed: 'right',
          render: (h, { row }) => (
            &lt;div&gt;
              &lt;el-button type="text" on-click={() => this.handleEdit(row)}&gt;
                编辑
              &lt;/el-button&gt;
              &lt;el-button type="text" style="color: #f56c6c;" 
                on-click={() => this.handleDelete(row)}&gt;
                删除
              &lt;/el-button&gt;
            &lt;/div&gt;
          )
        }
      ],
      tableOptions: {
        border: true,
        stripe: true,
        showHeaderBar: true,
        apiParams: { url: '/api/user/list', method: 'POST' }
      }
    }
  },
  methods: {
    handleEdit(row) {
      this.$message.info('编辑用户：' + row.username)
    },
    handleDelete(row) {
      this.$confirm('确定删除用户 "' + row.username + '" 吗？', '提示', {
        type: 'warning'
      }).then(() => {
        this.$message.success('删除成功')
        this.$refs.userTable.httpRquestInstace()
      })
    }
  }
}
&lt;/script&gt;</code></pre>
        </div>
      </div>
    </section>

    <!-- Core Concepts -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-s-opportunity" />
        </div>
        <h2 class="section-title">
          核心概念
        </h2>
      </div>

      <div class="concepts-grid">
        <div class="concept-card">
          <div class="concept-icon blue">
            <i class="el-icon-s-order" />
          </div>
          <h3 class="concept-title">
            配置化表单
          </h3>
          <p class="concept-desc">
            通过 form-item-list 配置生成表单，支持 14 种控件类型
          </p>
          <ul class="concept-list">
            <li><code>prop</code> - 表单字段名</li>
            <li><code>formtype</code> - 控件类型</li>
            <li><code>dataOptions</code> - 下拉选项</li>
            <li><code>attrs</code> - 原生属性</li>
          </ul>
        </div>

        <div class="concept-card">
          <div class="concept-icon green">
            <i class="el-icon-s-data" />
          </div>
          <h3 class="concept-title">
            配置化表格
          </h3>
          <p class="concept-desc">
            通过 columns 配置生成表格列，支持自定义渲染
          </p>
          <ul class="concept-list">
            <li><code>key</code> - 数据字段名</li>
            <li><code>label</code> - 列标题</li>
            <li><code>width</code> - 列宽度</li>
            <li><code>render</code> - 自定义渲染</li>
          </ul>
        </div>

        <div class="concept-card">
          <div class="concept-icon orange">
            <i class="el-icon-link" />
          </div>
          <h3 class="concept-title">
            自动数据请求
          </h3>
          <p class="concept-desc">
            配置 apiParams 即可实现自动请求和分页处理
          </p>
          <ul class="concept-list">
            <li>初始化自动请求</li>
            <li>表单参数自动传递</li>
            <li>分页参数自动处理</li>
            <li>响应数据自动映射</li>
          </ul>
        </div>

        <div class="concept-card">
          <div class="concept-icon pink">
            <i class="el-icon-refresh" />
          </div>
          <h3 class="concept-title">
            表单表格联动
          </h3>
          <p class="concept-desc">
            内置联动机制，查询、重置一键完成
          </p>
          <ul class="concept-list">
            <li>triggerEvent 触发查询</li>
            <li>查询参数自动同步</li>
            <li>重置后自动刷新</li>
            <li>数据流清晰可控</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- useDialog Section -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-s-claim" />
        </div>
        <h2 class="section-title">
          使用 useDialog 打开弹窗
        </h2>
      </div>
      <p class="section-desc">
        ES-Plus 提供了函数式弹窗 useDialog，可以在方法中直接调用
      </p>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('useDialog')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    handleAdd() {
      const dialog = useDialog()
      dialog({
        title: '新增用户',
        width: '600px',
        render: (h) => (
          &lt;es-form
            ref="addForm"
            form-item-list={this.formItems}
            model={{ username: '', status: '1' }}
          /&gt;
        ),
        configBtn: [
          {
            name: '保存',
            type: 'primary',
            click: (instance, { close, getRefs }) => {
              getRefs('addForm').validate((valid) => {
                if (valid) {
                  this.saveData(instance.model).then(() => {
                    this.$message.success('保存成功')
                    close()
                    this.$refs.userTable.httpRquestInstace()
                  })
                }
              })
            }
          },
          {
            name: '取消',
            click: (instance, { close }) => close()
          }
        ]
      })
    }
  }
}</code></pre>
      </div>
    </section>

    <!-- Next Steps -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-right" />
        </div>
        <h2 class="section-title">
          下一步
        </h2>
      </div>
      <p class="section-desc">
        你已经掌握了 ES-Plus 的基础用法！接下来可以深入学习：
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
            <p>了解表格的高级功能（分页、排序、批量操作等）</p>
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
            <p>学习更多控件类型和表单验证</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link
          to="/component/esdialog"
          class="next-card"
        >
          <div class="next-icon green">
            <i class="el-icon-s-claim" />
          </div>
          <div class="next-info">
            <h3>useDialog 弹窗</h3>
            <p>掌握函数式弹窗的更多用法</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link
          to="/guide/configuration"
          class="next-card"
        >
          <div class="next-icon orange">
            <i class="el-icon-s-tools" />
          </div>
          <div class="next-info">
            <h3>全局配置</h3>
            <p>了解完整的配置选项</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>

    <!-- Footer CTA -->
    <section class="footer-cta">
      <div class="cta-content">
        <i class="el-icon-question" />
        <h3>遇到问题？</h3>
        <p>如果在使用过程中遇到问题，可以参考 GitHub 仓库中的示例代码或提交 Issue</p>
        <a
          href="https://github.com/liujiaao/es-eui"
          target="_blank"
          class="cta-link"
        >
          <i class="el-icon-link" />
          访问 GitHub 仓库
        </a>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GuideQuickstart',
  data() {
    return {
      activeTab: 'full'
    }
  },
  methods: {
    copyCode(type) {
      const codes = {
        install: 'npm install @es-plus/vue2 element-ui --save',
        fullConfig: `import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import http from '@/utils/request'

Vue.use(ElementUI)

Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, headers, formParams, ...options }) {
        const opt = {
          url,
          method: options?.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...headers }
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
        isSmall: true
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
        return http({ url, method: options.method || 'POST', data: formParams })
      }
    }
  }
})`,
        minimalConfig: `import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import http from '@/utils/request'

Vue.use(ElementUI)

Vue.use(EsPlus, {
  EsTable: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return http({ url, method: options?.method || 'POST', data: formParams })
      }
    }
  },
  EsForm: {
    methods: {
      $httpRequest({ url, formParams, ...options }) {
        return http({ url, method: options.method || 'POST', data: formParams })
      }
    }
  }
})`,
        pageExample: `// 用户列表页面示例
export default {
  data() {
    return {
      searchForm: { username: '', status: '' },
      searchItems: [
        {
          prop: 'username',
          label: '用户名',
          span: 6,
          formtype: 'Input',
          attrs: { placeholder: '请输入用户名', clearable: true }
        },
        {
          prop: 'status',
          label: '状态',
          span: 6,
          formtype: 'Select',
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]
        }
      ],
      searchBtns: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true }
      ],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'username', label: '用户名', width: 150 },
        { key: 'email', label: '邮箱', minWidth: 200 },
        {
          key: 'status',
          label: '状态',
          width: 100,
          render: (h, { row }) => {
            const type = row.status === '1' ? 'success' : 'danger'
            const text = row.status === '1' ? '启用' : '禁用'
            return <el-tag type={type} size="small">{text}</el-tag>
          }
        },
        {
          key: 'action',
          label: '操作',
          width: 150,
          fixed: 'right',
          render: (h, { row }) => (
            <div>
              <el-button type="text" on-click={() => this.handleEdit(row)}>编辑</el-button>
              <el-button type="text" style="color: #f56c6c;" on-click={() => this.handleDelete(row)}>删除</el-button>
            </div>
          )
        }
      ],
      tableOptions: {
        border: true,
        stripe: true,
        showHeaderBar: true,
        apiParams: { url: '/api/user/list', method: 'POST' }
      }
    }
  }
}`,
        useDialog: `import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    handleAdd() {
      const dialog = useDialog()
      dialog({
        title: '新增用户',
        width: '600px',
        render: (h) => (
          <es-form
            ref="addForm"
            form-item-list={this.formItems}
            model={{ username: '', status: '1' }}
          />
        ),
        configBtn: [
          {
            name: '保存',
            type: 'primary',
            click: (instance, { close, getRefs }) => {
              getRefs('addForm').validate((valid) => {
                if (valid) {
                  this.saveData(instance.model).then(() => {
                    this.$message.success('保存成功')
                    close()
                    this.$refs.userTable.httpRquestInstace()
                  })
                }
              })
            }
          },
          { name: '取消', click: (instance, { close }) => close() }
        ]
      })
    }
  }
}`
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

.quickstart-page {
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

// Config Tabs
.config-tabs {
  margin-bottom: 20px;

  .tab-header {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;

    .tab-item {
      padding: 10px 20px;
      font-size: 14px;
      color: $text-secondary;
      background: white;
      border: 1px solid $border-color;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        color: $primary;
        border-color: $primary;
      }

      &.active {
        color: white;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-color: transparent;
      }
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
     // color: #d4d4d4;
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

// Feature Showcase
.feature-showcase {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  margin-bottom: 20px;

  .showcase-preview {
    background: white;
    border-radius: 12px;
    border: 1px solid $border-color;
    overflow: hidden;

    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: $bg-light;
      border-bottom: 1px solid $border-color;
      font-size: 14px;
      font-weight: 500;
      color: $text-secondary;

      i {
        color: $primary;
      }
    }

    .preview-body {
      padding: 16px;

      .mock-form {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;

        .mock-input,
        .mock-select {
          padding: 6px 12px;
          background: white;
          border: 1px solid $border-color;
          border-radius: 4px;
          font-size: 12px;
          color: $text-tertiary;
        }

        .mock-input {
          width: 100px;
        }

        .mock-select {
          width: 80px;
        }

        .mock-btn {
          padding: 6px 14px;
          background: white;
          border: 1px solid $border-color;
          border-radius: 4px;
          font-size: 12px;
          color: $text-secondary;

          &.primary {
            background: $primary;
            border-color: $primary;
            color: white;
          }
        }
      }

      .mock-table {
        .mock-row {
          display: grid;
          grid-template-columns: 40px 60px 1fr 50px 60px;
          gap: 8px;
          padding: 8px;
          font-size: 11px;
          border-bottom: 1px solid #f0f0f0;

          &.header {
            background: $bg-light;
            font-weight: 500;
            color: $text-secondary;
          }

          span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;

            &.success {
              background: #f6ffed;
              color: #52c41a;
            }

            &.danger {
              background: #fff1f0;
              color: #ff4d4f;
            }
          }

          .action {
            color: $primary;
          }
        }
      }
    }
  }
}

// Concepts Grid
.concepts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  .concept-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid $border-color;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    }

    .concept-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;
      margin-bottom: 16px;

      &.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      &.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
      &.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
      &.pink { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); }
    }

    .concept-title {
      font-size: 17px;
      font-weight: 600;
      margin: 0 0 8px;
    }

    .concept-desc {
      font-size: 13px;
      color: $text-secondary;
      margin: 0 0 16px;
      line-height: 1.6;
    }

    .concept-list {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: $text-secondary;
        padding: 6px 0;
        border-bottom: 1px dashed #eee;

        &:last-child {
          border-bottom: none;
        }

        code {
          padding: 2px 6px;
          background: $bg-light;
          border-radius: 4px;
          font-family: 'Consolas', monospace;
          color: $primary;
        }
      }
    }
  }
}

// Next Links
.next-links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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
      }
    }

    .el-icon-arrow-right {
      font-size: 18px;
      color: $text-tertiary;
      transition: all 0.3s;
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
    i {
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
      }
    }
  }
}

// Responsive
@media (max-width: 768px) {
  .quickstart-page {
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

  .feature-showcase {
    grid-template-columns: 1fr;
  }

  .concepts-grid {
    grid-template-columns: 1fr;
  }

  .next-links {
    grid-template-columns: 1fr;
  }
}
</style>
