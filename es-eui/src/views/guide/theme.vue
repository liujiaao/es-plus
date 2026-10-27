<template>
  <div class="theme-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="el-icon-magic-stick" />
        <span>自定义主题</span>
      </div>
      <h1 class="hero-title">
        主题定制
      </h1>
      <p class="hero-desc">
        Element UI 的主题是<strong>编译期 SCSS 变量</strong> —— 主色以字面量进入构建产物，运行期改 CSS 变量不生效。
        ES-Plus 把品牌色收成设计 token 单一真源，自动生成 SCSS 主题：改一处，三端同时变色。
      </p>
    </section>

    <!-- Three Methods -->
    <section class="section">
      <div class="section-header">
        <div class="section-icon brand">
          <i class="el-icon-set-up" />
        </div>
        <h2 class="section-title">
          三种定制方式
        </h2>
      </div>
      <p class="section-desc">
        按「改动面 / 生效时机」选择。多数项目只需要第一种；后两种用于深度定制与运行期换肤。
      </p>

      <div class="method-cards">
        <div class="method-card">
          <div class="method-icon brand">
            <i class="el-icon-set-up" />
          </div>
          <h3 class="method-title">
            设计 token
          </h3>
          <p class="method-desc">
            改 <code>--es-brand-primary</code>，自动生成 Element UI 主题；三端同一真源，带门禁
          </p>
          <span class="method-tag">推荐</span>
        </div>
        <div class="method-card">
          <div class="method-icon scss">
            <i class="el-icon-edit-outline" />
          </div>
          <h3 class="method-title">
            SCSS 变量
          </h3>
          <p class="method-desc">
            Element UI 原生方式：色阶、圆角、字号都能改，编译期生效
          </p>
          <span class="method-tag">深度定制</span>
        </div>
        <div class="method-card">
          <div class="method-icon runtime">
            <i class="el-icon-refresh" />
          </div>
          <h3 class="method-title">
            运行期换肤
          </h3>
          <p class="method-desc">
            覆盖 <code>.el-*</code> 类名 + 应用侧变量，支持暗色与在线切换
          </p>
          <span class="method-tag">动态</span>
        </div>
      </div>
    </section>

    <!-- Step 01: design token -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          01
        </div>
        <div class="step-info">
          <h2 class="section-title">
            设计 token 单源
          </h2>
          <p class="section-desc">
            只维护一个品牌色，Element UI 主题由脚本生成 —— 生成物禁止手改
          </p>
        </div>
      </div>

      <div class="steps-content">
        <div class="step-item">
          <h4>步骤一：改单源里的品牌色</h4>
          <p><code>docs/tokens/design-tokens.css</code> 是 Vue 2 / Vue 3 / Ant Design Vue 三端共用的唯一真源：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">css</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>/* docs/tokens/design-tokens.css —— 三端唯一真源 */
:root {
  --es-brand-primary: #3b82f6;       /* 品牌主色 */
  --es-brand-primary-light: #dbeafe; /* 主色浅底 */
  --es-brand-accent: #06b6d4;        /* 强调色（配置 / 数据） */
}</code></pre>
          </div>
        </div>

        <div class="step-item">
          <h4>步骤二：生成 Element UI 主题并校验</h4>
          <p>两条命令 + 一道门禁，生成物写回 <code>es-eui/src/styles/element-theme.generated.scss</code>：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">bash</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code># 1. 把单源 token 分发到三端样式副本
npm run tokens:sync

# 2. 从 --es-brand-primary 生成 Element UI 的 $--color-primary
npm run element-theme:sync

# 3. 门禁：断言三端真的消费了 token（不只是文件被同步过）
npm run check:theme-bridge</code></pre>
          </div>
        </div>

        <div class="step-item">
          <h4>步骤三：生成物长这样</h4>
          <p>生成文件只覆盖 <code>$--color-primary</code> 一个变量，浅色阶由 Element UI 的 <code>mix()</code> 派生：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">scss</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>// 本文件由 scripts/gen-element-theme.mjs 生成，禁止手改。
$--font-path: '~element-ui/packages/theme-chalk/src/fonts';

// 取自 docs/tokens/design-tokens.css 的 --es-brand-primary
$--color-primary: #3b82f6;

@import '~element-ui/packages/theme-chalk/src/index';</code></pre>
          </div>
        </div>
      </div>

      <div class="tip-box info">
        <i class="el-icon-info" />
        <p>
          <strong>为什么必须「生成」而不是手写一份常量</strong>：<code>$--color-primary</code> 在 Element UI 源码里是
          <code>!default</code> 的编译期常量，<code>--color-primary-light-1..9</code> 由 <code>mix()</code> 从它派生。
          编译产物里是写死的十六进制，运行期 <code>setProperty</code> 改不动 —— 于是只有两个选择：手写第二份（必然漂移）
          或从单源生成。ES-Plus 选后者，让「改 token 文件」始终是三端唯一需要做的事。
        </p>
      </div>

      <div class="tip-box warning">
        <i class="el-icon-warning-outline" />
        <p>
          <strong>同一条链路覆盖三端</strong>：Vue 3 侧由 <code>--el-color-primary</code> 运行时桥接，Ant Design Vue 侧把
          token 计算值传给 <code>ConfigProvider</code> 的 <code>colorPrimary</code>，Vue 2 侧就是这份生成的 SCSS。
          <code>check:theme-bridge</code> 逐条断言三个消费点存在 —— 只比文件字节相等是不够的（文件在、门禁绿、
          组件仍用库默认蓝，这个错以前真发生过）。
        </p>
      </div>
    </section>

    <!-- Step 02: SCSS -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          02
        </div>
        <div class="step-info">
          <h2 class="section-title">
            SCSS 变量定制
          </h2>
          <p class="section-desc">
            需要改色阶、圆角、字号时，直接覆盖 Element UI 的 SCSS 变量
          </p>
        </div>
      </div>

      <div class="steps-content">
        <div class="step-item">
          <h4>步骤一：创建主题样式文件</h4>
          <p>变量必须在 <code>@import</code> 之前赋值（源码里都是 <code>!default</code>，后赋值无效）：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">scss</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>/* src/styles/element-variables.scss */
$--color-primary: #3b82f6;
$--color-success: #16a34a;
$--color-warning: #d97706;
$--color-danger: #dc2626;
$--color-info: #64748b;

/* 圆角与字号 */
$--border-radius-base: 6px;
$--font-size-base: 14px;

/* 图标字体路径：本文件不在 theme-chalk 目录下，必须显式指到包内 */
$--font-path: '~element-ui/packages/theme-chalk/src/fonts';

/* 引入 Element UI 样式（会按上面的变量重新编译） */
@import '~element-ui/packages/theme-chalk/src/index';</code></pre>
          </div>
        </div>

        <div class="step-item">
          <h4>步骤二：在入口文件引入</h4>
          <p>不要同时再引 <code>element-ui/lib/theme-chalk/index.css</code>，否则两份样式互相打架：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">javascript</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>import Vue from 'vue'
import ElementUI from 'element-ui'
import EsPlus from '@es-plus/vue2'

// 自定义主题（必须在 Vue.use 之前、且不再引入预编译 CSS）
import './styles/element-variables.scss'
// ES-Plus 组件自身样式
import '@es-plus/vue2/dist/style.css'

Vue.use(ElementUI)
Vue.use(EsPlus)</code></pre>
          </div>
        </div>
      </div>

      <div class="tip-box info">
        <i class="el-icon-info" />
        <p><strong>依赖</strong>：需要 <code>sass</code> 与 <code>sass-loader</code>，且构建链支持 <code>~</code> 前缀的模块路径（vue-cli 默认支持）。</p>
      </div>

      <h4 class="table-title">
        常用 Element UI 变量
      </h4>
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
            <tr v-for="row in elementVars" :key="row.name">
              <td><code>{{ row.name }}</code></td>
              <td>{{ row.value }}</td>
              <td>{{ row.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tip-box warning">
        <i class="el-icon-warning-outline" />
        <p>
          <strong>注意</strong>：SCSS 变量是构建期常量，改完必须重新编译；能运行期切换的只有你在
          <a href="https://element.eleme.io/#/zh-CN/component/custom-theme" target="_blank" rel="noopener">Element UI 官方主题文档</a>
          里看到的那些变量，而它们在产物中已经展开成十六进制。
        </p>
      </div>
    </section>

    <!-- Step 03: runtime -->
    <section class="section">
      <div class="step-header">
        <div class="step-number">
          03
        </div>
        <div class="step-info">
          <h2 class="section-title">
            运行期换肤
          </h2>
          <p class="section-desc">
            暗色模式 / 在线切换主题：ES-Plus 不提供 CSS 变量层，靠覆盖类名实现
          </p>
        </div>
      </div>

      <div class="tip-box warning">
        <i class="el-icon-warning-outline" />
        <p>
          <strong>先纠正一个常见误解</strong>：<code>@es-plus/vue2</code> 不对外暴露 <code>--es-primary-color</code>
          之类的 CSS 变量，Element UI 2.x 也没有官方暗色主题。运行期换肤 = 在你自己的样式里覆盖
          <code>.el-*</code> 类名，并把颜色收进<strong>你自己的</strong>变量。变量名请避开 <code>--es-</code> 前缀，
          那是站点设计 token 的命名空间。
        </p>
      </div>

      <div class="steps-content">
        <div class="step-item">
          <h4>步骤一：用应用侧变量覆盖类名</h4>
          <p>暗色约定键用 <code>dark</code>（挂到 <code>&lt;html&gt;</code> 上），不要自造 <code>is-dark</code> 之类的私有类名：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">css</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>/* 应用侧变量：名字由你定，与组件库 API 无关 */
:root {
  --app-primary: #3b82f6;
  --app-primary-hover: #60a5fa;
  --app-bg: #ffffff;
}

html.dark {
  --app-primary: #60a5fa;
  --app-primary-hover: #93c5fd;
  --app-bg: #141414;
}

/* 覆盖 Element UI 主按钮 */
.el-button--primary {
  background-color: var(--app-primary);
  border-color: var(--app-primary);
}
.el-button--primary:hover,
.el-button--primary:focus {
  background-color: var(--app-primary-hover);
  border-color: var(--app-primary-hover);
}

/* 页面底色（ES-Plus 的 .es-form / .es-table 也在同一个 DOM 树里） */
body {
  background-color: var(--app-bg);
}</code></pre>
          </div>
        </div>

        <div class="step-item">
          <h4>步骤二：切换与持久化</h4>
          <p>只改 <code>&lt;html&gt;</code> 上的一个类名，CSS 变量与所有覆盖规则一起生效：</p>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">javascript</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>// src/utils/theme.js
const KEY = 'app-theme'

export function setTheme(mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  localStorage.setItem(KEY, mode)
}

export function initTheme() {
  const saved = localStorage.getItem(KEY)
  // 没存过就跟随系统
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  setTheme(saved || (prefersDark ? 'dark' : 'light'))
}</code></pre>
          </div>
        </div>

        <div class="step-item">
          <h4>步骤三：接到界面上的切换组件</h4>
          <div class="code-block">
            <div class="code-header">
              <span class="code-lang">vue</span>
              <button
                class="copy-btn"
                @click="copyCode"
              >
                <i class="el-icon-document-copy" />
                复制
              </button>
            </div>
            <pre v-pre><code>&lt;template&gt;
  &lt;el-dropdown @command="setTheme"&gt;
    &lt;el-button size="mini"&gt;
      &lt;i class="el-icon-magic-stick" /&gt; 主题
    &lt;/el-button&gt;
    &lt;el-dropdown-menu slot="dropdown"&gt;
      &lt;el-dropdown-item command="light"&gt;浅色&lt;/el-dropdown-item&gt;
      &lt;el-dropdown-item command="dark"&gt;暗色&lt;/el-dropdown-item&gt;
    &lt;/el-dropdown-menu&gt;
  &lt;/el-dropdown&gt;
&lt;/template&gt;

&lt;script&gt;
import { setTheme } from '@/utils/theme'

export default {
  methods: { setTheme }
}
&lt;/script&gt;</code></pre>
          </div>
        </div>
      </div>

      <div class="tip-box info">
        <i class="el-icon-info" />
        <p>
          <strong>本站的做法</strong>：暗色键统一为 <code>dark</code>，因为 Element Plus、ant-design-vue、vxe-table
          的暗色主题都以它为准。用私有名字的后果是「站点外壳变暗、组件库保持亮色」的半残暗色 —— 三端都踩过这个坑。
        </p>
      </div>
    </section>
  </div>
</template>

<script>
/**
 * 常用变量表：值取自 es-eui/node_modules/element-ui/packages/theme-chalk/src/common/var.scss
 * 的 `!default` 声明。不在这里手抄一遍代码片段 —— 复制按钮直接读 DOM 里的 textContent，
 * 避免「页面上改了、copyCode 的字符串没改」这种只有粘贴出去才会发现的漂移。
 */
const ELEMENT_VARS = [
  { name: '$--color-primary', value: '#409EFF', desc: '主色，用于按钮、链接、选中态；浅色阶 light-1..9 由它混色派生' },
  { name: '$--color-success', value: '#67C23A', desc: '成功色' },
  { name: '$--color-warning', value: '#E6A23C', desc: '警告色' },
  { name: '$--color-danger', value: '#F56C6C', desc: '危险色' },
  { name: '$--color-info', value: '#909399', desc: '信息色' },
  { name: '$--color-text-primary', value: '#303133', desc: '主要文字颜色' },
  { name: '$--color-text-regular', value: '#606266', desc: '常规文字颜色' },
  { name: '$--color-text-secondary', value: '#909399', desc: '次要文字颜色' },
  { name: '$--border-color-base', value: '#DCDFE6', desc: '边框颜色' },
  { name: '$--border-radius-base', value: '4px', desc: '基础圆角' },
  { name: '$--font-size-base', value: '14px', desc: '基础字号' },
  { name: '$--font-path', value: 'fonts', desc: '图标字体路径；不在 theme-chalk 目录下时必须显式指定' }
]

export default {
  name: 'GuideTheme',
  data() {
    return { elementVars: ELEMENT_VARS }
  },
  methods: {
    copyCode(event) {
      const block = event.currentTarget.closest('.code-block')
      const source = block && block.querySelector('pre code')
      const code = source ? source.textContent.replace(/\s+$/, '') : ''
      if (!code) return
      this.$copyText(code)
        .then(() => this.$message.success('代码已复制到剪贴板'))
        .catch(() => this.$message.error('复制失败'))
    }
  }
}
</script>

<style lang="scss" scoped>
/* 颜色一律走设计 token（src/assets/design-tokens.css），不再写死第二份品牌色。
   本站由 main.js 引入 tokens 与 Element UI 生成主题，两条链路的品牌色同源。 */
.theme-page {
  padding-bottom: 40px;
}

.hero-section {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid var(--es-border-lighter);
  margin-bottom: 40px;

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
    color: #fff;
    border-radius: 20px;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .hero-title {
    font-size: 40px;
    font-weight: 700;
    color: var(--es-text-primary);
    margin-bottom: 16px;
  }

  .hero-desc {
    font-size: 16px;
    color: var(--es-text-regular);
    line-height: 1.7;
    max-width: 760px;
    margin: 0 auto;

    strong {
      color: var(--es-text-primary);
    }
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

    &.brand {
      background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
    }

    i {
      font-size: 20px;
      color: #fff;
    }
  }

  .section-title {
    font-size: var(--es-text-2xl);
    font-weight: 600;
    color: var(--es-text-primary);
    margin: 0;
  }
}

.section-desc {
  font-size: 14px;
  color: var(--es-text-regular);
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
  border-radius: var(--es-radius-lg);
  border: 1px solid var(--es-border-light);
  background: var(--es-bg);
  transition: all 0.3s;

  &:hover {
    box-shadow: var(--es-shadow-md);
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

    &.brand {
      background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
    }
    &.scss {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    }
    &.runtime {
      background: linear-gradient(135deg, #06b6d4 0%, #0e7490 100%);
    }

    i {
      font-size: 24px;
      color: #fff;
    }
  }

  .method-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--es-text-primary);
    margin-bottom: 8px;
  }

  .method-desc {
    font-size: 13px;
    color: var(--es-text-regular);
    line-height: 1.6;
    margin: 0;
  }

  .method-tag {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 2px 8px;
    background: var(--es-brand-primary-light);
    color: var(--es-brand-primary);
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
    background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
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
      color: var(--es-text-primary);
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
    color: var(--es-text-primary);
    margin-bottom: 12px;
  }

  p {
    font-size: 14px;
    color: var(--es-text-regular);
    margin-bottom: 16px;
    line-height: 1.7;
  }

  code {
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    color: var(--es-brand-primary);
  }
}

.table-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--es-text-primary);
  margin: 32px 0 12px;
}

.code-block {
  background: #1e1e1e;
  border-radius: var(--es-radius-sm);
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
        border-color: var(--es-brand-primary);
        color: var(--es-brand-primary);
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
      line-height: 1.7;
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
    border-bottom: 1px solid var(--es-border-lighter);
  }

  th {
    background: var(--es-fill-light);
    color: var(--es-text-primary);
    font-weight: 600;
  }

  td {
    color: var(--es-text-regular);
    vertical-align: top;

    code {
      background: var(--es-fill);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      color: var(--es-brand-primary);
    }
  }

  tr:hover td {
    background: var(--es-fill-light);
  }
}

.tip-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--es-radius-sm);
  margin-top: 20px;

  &.info {
    background: rgba(59, 130, 246, 0.06);
    border-left: 4px solid var(--es-brand-primary);

    i {
      color: var(--es-brand-primary);
    }
  }

  &.warning {
    background: rgba(217, 119, 6, 0.08);
    border-left: 4px solid var(--es-warning);

    i {
      color: var(--es-warning);
    }
  }

  i {
    font-size: 20px;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: var(--es-text-regular);
    line-height: 1.7;

    strong {
      color: var(--es-text-primary);
    }

    a {
      color: var(--es-brand-primary);
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
