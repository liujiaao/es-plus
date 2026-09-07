<template>
  <div class="theme-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-s-open" />
        <span>自定义主题</span>
      </div>
      <h1 class="hero-title">
        主题定制
      </h1>
      <p class="hero-desc">
        ES-Plus 基于 Element UI 的样式系统，支持通过 SCSS 变量、CSS 变量和主题配置对象
        多种方式自定义主题，轻松打造符合品牌风格的中后台应用。
      </p>
    </section>

    <!-- Theme Methods -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon blue">
          <i class="el-icon-magic-stick" />
        </div>
        <h2 class="section-title">
          主题定制方式
        </h2>
      </div>
      <p class="section-desc">
        ES-Plus 提供三种主题定制方式，你可以根据项目需求选择合适的方式：
      </p>

      <div class="method-cards">
        <div class="method-card">
          <div class="method-icon scss">
            <i class="el-icon-edit-outline" />
          </div>
          <h3 class="method-title">
            SCSS 变量
          </h3>
          <p class="method-desc">
            通过修改 SCSS 变量完全定制主题，适合需要深度定制的项目
          </p>
          <span class="method-tag">推荐</span>
        </div>
        <div class="method-card">
          <div class="method-icon css">
            <i class="el-icon-collection" />
          </div>
          <h3 class="method-title">
            CSS 变量
          </h3>
          <p class="method-desc">
            使用 CSS 自定义属性动态切换主题，适合需要运行时切换的场景
          </p>
          <span class="method-tag">动态</span>
        </div>
        <div class="method-card">
          <div class="method-icon config">
            <i class="el-icon-set-up" />
          </div>
          <h3 class="method-title">
            配置对象
          </h3>
          <p class="method-desc">
            通过 JS 配置对象快速覆盖主题色，适合简单主题调整
          </p>
          <span class="method-tag">简单</span>
        </div>
      </div>
    </section>

    <!-- SCSS Variable Method -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          01
        </div>
        <div class="step-info">
          <h2 class="section-title">
            SCSS 变量定制
          </h2>
          <p class="section-desc">
            通过修改 Element UI 的 SCSS 变量来定制主题
          </p>
        </div>
      </div>

      <div class="steps-content">
        <div class="step-item">
          <h4>步骤一：创建主题样式文件</h4>
          <p>在项目 src 目录下创建 <code>styles/variables.scss</code> 文件：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">scss</span>
              <button
                class="copy-btn"
                @click="copyCode('scssTheme')"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>/* Element UI 主题变量 */
$--color-primary: #409eff;
$--color-success: #67c23a;
$--color-warning: #e6a23c;
$--color-danger: #f56c6c;
$--color-info: #909399;

/* 自定义品牌色 */
$--color-brand: #667eea;
$--color-brand-light: #764ba2;

/* 文字颜色 */
$--color-text-primary: #303133;
$--color-text-regular: #606266;
$--color-text-secondary: #909399;

/* 边框和背景 */
$--border-color-base: #dcdfe6;
$--background-color-base: #f5f7fa;

/* 字体路径，必须配置 */
$--font-path: '~element-ui/lib/theme-chalk/fonts';

/* 引入 Element UI 样式 */
@import "~element-ui/packages/theme-chalk/src/index";</code></pre>
          </div>
        </div>

        <div class="step-item">
          <h4>步骤二：在入口文件引入</h4>
          <p>在 main.js 中引入自定义主题文件：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">javascript</span>
              <button
                class="copy-btn"
                @click="copyCode('mainImport')"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>import Vue from 'vue'
import ElementUI from 'element-ui'
import EsPlus from '@es-plus/vue2'

// 引入自定义主题（在 Element UI 和 ES-Plus 之前引入）
import './styles/variables.scss'

// 引入 ES-Plus 样式
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)</code></pre>
          </div>
        </div>
      </div>

      <div class="tip-box info">
        <i class="el-icon-info-filled" />
        <p><strong>提示</strong>：使用 SCSS 变量定制需要安装 sass 和 sass-loader，并确保项目支持 SCSS 预处理。</p>
      </div>
    </section>

    <!-- CSS Variable Method -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          02
        </div>
        <div class="step-info">
          <h2 class="section-title">
            CSS 变量定制
          </h2>
          <p class="section-desc">
            使用 CSS 自定义属性（CSS Variables）实现动态主题切换
          </p>
        </div>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">css</span>
          <button
            class="copy-btn"
            @click="copyCode('cssVar')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>/* 在全局样式文件中定义 CSS 变量 */
:root {
  --es-primary-color: #409eff;
  --es-success-color: #67c23a;
  --es-warning-color: #e6a23c;
  --es-danger-color: #f56c6c;
  --es-border-radius: 4px;
  --es-font-size-base: 14px;
}

/* 暗色主题 */
[data-theme="dark"] {
  --es-primary-color: #5b8ff9;
  --es-bg-color: #1a1a1a;
  --es-text-color: #e0e0e0;
}

/* 在组件中使用 */
.es-button {
  background-color: var(--es-primary-color);
  border-radius: var(--es-border-radius);
}</code></pre>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('switchTheme')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>// 主题切换工具函数
export function switchTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName)
  localStorage.setItem('es-theme', themeName)
}

// 初始化主题
export function initTheme() {
  const savedTheme = localStorage.getItem('es-theme') || 'light'
  switchTheme(savedTheme)
}</code></pre>
      </div>
    </section>

    <!-- Config Object Method -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          03
        </div>
        <div class="step-info">
          <h2 class="section-title">
            配置对象定制
          </h2>
          <p class="section-desc">
            通过 ES-Plus 的全局配置对象快速覆盖组件样式
          </p>
        </div>
      </div>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">javascript</span>
          <button
            class="copy-btn"
            @click="copyCode('configTheme')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>import Vue from 'vue'
import EsPlus from '@es-plus/vue2'

Vue.use(EsPlus, {
  // EsTable 主题配置
  EsTable: {
    theme: {
      headerBgColor: '#f5f7fa',
      headerTextColor: '#606266',
      rowHoverColor: '#f5f7fa',
      borderColor: '#ebeef5'
    }
  },
  // EsForm 主题配置
  EsForm: {
    theme: {
      labelWidth: '100px',
      labelPosition: 'right',
      itemMarginBottom: '22px'
    }
  },
  // EsDialog 主题配置
  EsDialog: {
    theme: {
      headerBgColor: '#fff',
      headerBorderColor: '#ebeef5',
      borderRadius: '4px'
    }
  }
})</code></pre>
      </div>
    </section>

    <!-- Common Variables -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon purple">
          <i class="el-icon-collection-tag" />
        </div>
        <h2 class="section-title">
          常用主题变量
        </h2>
      </div>

      <div class="param-table-wrapper">
        <table class="param-table">
          <thead>
            <tr>
              <th>变量名</th>
              <th>默认值</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>$--color-primary</td>
              <td>#409EFF</td>
              <td>主题色，用于按钮、链接、选中状态等</td>
            </tr>
            <tr>
              <td>$--color-success</td>
              <td>#67C23A</td>
              <td>成功色，用于成功提示、操作成功状态</td>
            </tr>
            <tr>
              <td>$--color-warning</td>
              <td>#E6A23C</td>
              <td>警告色，用于警告提示</td>
            </tr>
            <tr>
              <td>$--color-danger</td>
              <td>#F56C6C</td>
              <td>危险色，用于错误提示、删除操作</td>
            </tr>
            <tr>
              <td>$--color-info</td>
              <td>#909399</td>
              <td>信息色，用于信息提示</td>
            </tr>
            <tr>
              <td>$--color-text-primary</td>
              <td>#303133</td>
              <td>主要文字颜色</td>
            </tr>
            <tr>
              <td>$--color-text-regular</td>
              <td>#606266</td>
              <td>常规文字颜色</td>
            </tr>
            <tr>
              <td>$--color-text-secondary</td>
              <td>#909399</td>
              <td>次要文字颜色</td>
            </tr>
            <tr>
              <td>$--border-color-base</td>
              <td>#DCDFE6</td>
              <td>边框颜色</td>
            </tr>
            <tr>
              <td>$--border-radius-base</td>
              <td>4px</td>
              <td>基础圆角大小</td>
            </tr>
            <tr>
              <td>$--font-size-base</td>
              <td>14px</td>
              <td>基础字体大小</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tip-box warning">
        <i class="el-icon-warning" />
        <p><strong>注意</strong>：修改主题变量后需要重新编译项目才能生效。使用 CSS 变量方式可以实现运行时动态切换。</p>
      </div>
    </section>

    <!-- Theme Switcher Demo -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-view" />
        </div>
        <h2 class="section-title">
          主题切换示例
        </h2>
      </div>
      <p class="section-desc">
        以下是一个简单的主题切换组件示例：
      </p>

      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">vue</span>
          <button
            class="copy-btn"
            @click="copyCode('themeComponent')"
          >
            <i class="el-icon-document-copy" />
            复制
          </button>
        </div>
        <pre v-pre><code>&lt;template&gt;
  &lt;div class="theme-switcher"&gt;
    &lt;el-dropdown @command="handleThemeChange"&gt;
      &lt;el-button type="primary"&gt;
        &lt;i class="el-icon-s-open" /&gt; 切换主题
      &lt;/el-button&gt;
      &lt;el-dropdown-menu slot="dropdown"&gt;
        &lt;el-dropdown-item command="default"&gt;默认主题&lt;/el-dropdown-item&gt;
        &lt;el-dropdown-item command="dark"&gt;暗色主题&lt;/el-dropdown-item&gt;
        &lt;el-dropdown-item command="blue"&gt;蓝色主题&lt;/el-dropdown-item&gt;
      &lt;/el-dropdown-menu&gt;
    &lt;/el-dropdown&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script&gt;
export default {
  methods: {
    handleThemeChange(theme) {
      // 切换 CSS 变量主题
      const themes = {
        default: { primary: '#409eff', bg: '#fff' },
        dark: { primary: '#5b8ff9', bg: '#1a1a1a' },
        blue: { primary: '#1890ff', bg: '#f0f5ff' }
      }
      
      const selected = themes[theme]
      document.documentElement.style.setProperty('--es-primary-color', selected.primary)
      document.documentElement.style.setProperty('--es-bg-color', selected.bg)
      
      localStorage.setItem('es-theme', theme)
      this.$message.success(`已切换到${theme}主题`)
    }
  }
}
&lt;/script&gt;</code></pre>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'GuideTheme',
  methods: {
    copyCode(type) {
      const codes = {
        scssTheme: `/* Element UI 主题变量 */
$--color-primary: #409eff;
$--color-success: #67c23a;
$--color-warning: #e6a23c;
$--color-danger: #f56c6c;
$--color-info: #909399;

/* 自定义品牌色 */
$--color-brand: #667eea;
$--color-brand-light: #764ba2;

/* 文字颜色 */
$--color-text-primary: #303133;
$--color-text-regular: #606266;
$--color-text-secondary: #909399;

/* 边框和背景 */
$--border-color-base: #dcdfe6;
$--background-color-base: #f5f7fa;

/* 字体路径，必须配置 */
$--font-path: '~element-ui/lib/theme-chalk/fonts';

/* 引入 Element UI 样式 */
@import "~element-ui/packages/theme-chalk/src/index";`,
        mainImport: `import Vue from 'vue'
import ElementUI from 'element-ui'
import EsPlus from '@es-plus/vue2'

// 引入自定义主题（在 Element UI 和 ES-Plus 之前引入）
import './styles/variables.scss'

// 引入 ES-Plus 样式
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)`,
        cssVar: `:root {
  --es-primary-color: #409eff;
  --es-success-color: #67c23a;
  --es-warning-color: #e6a23c;
  --es-danger-color: #f56c6c;
  --es-border-radius: 4px;
  --es-font-size-base: 14px;
}

[data-theme="dark"] {
  --es-primary-color: #5b8ff9;
  --es-bg-color: #1a1a1a;
  --es-text-color: #e0e0e0;
}`,
        switchTheme: `// 主题切换工具函数
export function switchTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName)
  localStorage.setItem('es-theme', themeName)
}

// 初始化主题
export function initTheme() {
  const savedTheme = localStorage.getItem('es-theme') || 'light'
  switchTheme(savedTheme)
}`,
        configTheme: `Vue.use(EsPlus, {
  EsTable: {
    theme: {
      headerBgColor: '#f5f7fa',
      headerTextColor: '#606266',
      rowHoverColor: '#f5f7fa'
    }
  },
  EsForm: {
    theme: {
      labelWidth: '100px',
      labelPosition: 'right'
    }
  }
})`,
        themeComponent: `<template>
  <div class="theme-switcher">
    <el-dropdown @command="handleThemeChange">
      <el-button type="primary">
        <i class="el-icon-s-open" /> 切换主题
      </el-button>
      <el-dropdown-menu slot="dropdown">
        <el-dropdown-item command="default">默认主题</el-dropdown-item>
        <el-dropdown-item command="dark">暗色主题</el-dropdown-item>
      </el-dropdown-menu>
    </el-dropdown>
  </div>
</template>`
      }
      
      const code = codes[type]
      if (code) {
        this.$copyText(code).then(() => {
          this.$message.success('代码已复制到剪贴板')
        }).catch(() => {
          this.$message.error('复制失败')
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.theme-page {
  padding-bottom: 40px;
}

.hero-section {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 40px;

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-radius: 20px;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .hero-title {
    font-size: 40px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 16px;
  }

  .hero-desc {
    font-size: 16px;
    color: #606266;
    line-height: 1.6;
    max-width: 700px;
    margin: 0 auto;
  }
}

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

    &.blue {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    &.purple {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    &.green {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    i {
      font-size: 20px;
      color: #fff;
    }
  }

  .section-title {
    font-size: 24px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }
}

.section-desc {
  font-size: 14px;
  color: #606266;
  margin-bottom: 24px;
  line-height: 1.6;
}

.method-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.method-card {
  position: relative;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  background: #fff;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    transform: translateY(-2px);
  }

  .method-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;

    &.scss {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    }
    &.css {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    &.config {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    i {
      font-size: 24px;
      color: #fff;
    }
  }

  .method-title {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  .method-desc {
    font-size: 13px;
    color: #606266;
    line-height: 1.5;
    margin: 0;
  }

  .method-tag {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 2px 8px;
    background: #f0f9eb;
    color: #67c23a;
    border-radius: 4px;
    font-size: 12px;
  }
}

.step-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;

  .step-number {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .step-info {
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 6px;
    }
  }
}

.steps-content {
  padding-left: 64px;
}

.step-item {
  margin-bottom: 32px;

  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 12px;
  }

  p {
    font-size: 14px;
    color: #606266;
    margin-bottom: 16px;
  }

  code {
    // background: #f5f7fa;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    color: #409eff;
  }
}

.code-block {
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #2d2d2d;

    .code-lang {
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background: transparent;
      border: 1px solid #555;
      border-radius: 4px;
      color: #ccc;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: #409eff;
        color: #409eff;
      }
    }
  }

  pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;

    code {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    }
  }
}

.param-table-wrapper {
  overflow-x: auto;
  margin-top: 20px;
}

.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #ebeef5;
  }

  th {
    background: #f5f7fa;
    color: #1a1a1a;
    font-weight: 600;
  }

  td {
    color: #606266;

    code {
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      color: #409eff;
    }
  }

  tr:hover td {
    background: #f5f7fa;
  }
}

.tip-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin-top: 20px;

  &.info {
    background: #f0f9eb;
    border-left: 4px solid #67c23a;

    i {
      color: #67c23a;
    }
  }

  &.warning {
    background: #fdf6ec;
    border-left: 4px solid #e6a23c;

    i {
      color: #e6a23c;
    }
  }

  i {
    font-size: 20px;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: #606266;
    line-height: 1.6;

    strong {
      color: #1a1a1a;
    }
  }
}

@media (max-width: 768px) {
  .method-cards {
    grid-template-columns: 1fr;
  }

  .steps-content {
    padding-left: 0;
  }
}
</style>
