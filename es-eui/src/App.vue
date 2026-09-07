<template>
  <div
    id="app"
    :class="{ 'is-component': isComponent }"
  >
    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="container">
        <h1 class="logo">
          <router-link to="/">
            <span class="logo-img">ES</span>
            <span class="logo-text">ES-Plus</span>
          </router-link>
        </h1>
        <nav class="nav">
          <router-link
            to="/"
            :class="{ 'active': isHome }"
          >
            首页
          </router-link>
          <router-link
            to="/quickstart"
            :class="{ 'active': isQuickStart }"
          >
            30 秒上手
          </router-link>
          <router-link
            to="/cases"
            :class="{ 'active': isCases }"
          >
            核心案例
          </router-link>
          <router-link
            to="/guide"
            :class="{ 'active': isGuide }"
          >
            开发指南
          </router-link>
          <router-link
            to="/component/installation"
            :class="{ 'active': isComponent }"
          >
            组件
          </router-link>
          <router-link
            to="/theme"
            :class="{ 'active': isTheme }"
          >
            主题
          </router-link>
          <router-link
            to="/ai-tools"
            :class="{ 'active': isAiTools }"
          >
            AI 工具链
          </router-link>
          <a
            href="https://github.com"
            target="_blank"
            class="nav-link"
          >
            <i class="el-icon-link"></i> GitHub
          </a>
        </nav>
      </div>
    </header>

    <!-- Vue3 升级引导横幅 -->
    <div
      v-show="!bannerClosed"
      class="upgrade-banner"
    >
      <div class="banner-inner">
        <span class="banner-tag">NEW</span>
        <span class="banner-text">
          本页为 ES-Plus 的 <strong>Vue 2 + Element UI</strong> 渲染器文档。完整文档（含 <strong>三端通用对比</strong> 与 <strong>AI 工具链</strong>）见主文档站
        </span>
        <a
          href="https://liujiaao.github.io/es-plus/"
          target="_blank"
          rel="noopener"
          class="banner-link"
        >
          查看 ES-Plus 文档 <i class="el-icon-top-right"></i>
        </a>
        <button
          class="banner-close"
          aria-label="关闭"
          @click="bannerClosed = true"
        >
          <i class="el-icon-close"></i>
        </button>
      </div>
    </div>

    <!-- 主体内容 -->
    <div
      class="main"
      :class="{ 'banner-visible': !bannerClosed }"
    >
      <router-view />
    </div>

    <!-- 页脚 -->
    <footer
      v-if="isHome"
      class="footer"
    >
      <div class="container">
        <p>ES-Plus © 2024 基于 Vue 2.0 和 Element UI 的组件库</p>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      bannerClosed: false
    }
  },
  computed: {
    isHome() {
      return this.$route.path === '/'
    },
    isGuide() {
      return this.$route.path.startsWith('/guide')
    },
    isQuickStart() {
      return this.$route.path.startsWith('/quickstart')
    },
    isCases() {
      return this.$route.path.startsWith('/cases')
    },
    isComponent() {
      return this.$route.path.startsWith('/component')
    },
    isTheme() {
      return this.$route.path.startsWith('/theme')
    },
    isAiTools() {
      return this.$route.path.startsWith('/ai-tools')
    }
  }
}
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
  font-size: 14px;
  color: #303133;
  background-color: #fff;
}

#app {
  min-height: 100vh;
}

/* 顶部导航 */
.header {
  height: 60px;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;

  .container {
    max-width: 1350px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 20px;
  }

  .logo {
    margin: 0;
    
    a {
      display: flex;
      align-items: center;
      text-decoration: none;
    }

    .logo-img {
      width: 36px;
      height: 36px;
      background: var(--es-brand-primary);
      color: #fff;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      margin-right: 10px;
    }

    .logo-text {
      font-size: 20px;
      color: #303133;
      font-weight: 600;
    }
  }

  .nav {
    margin-left: auto;
    display: flex;
    align-items: center;

    a {
      display: inline-block;
      padding: 0 20px;
      color: #606266;
      text-decoration: none;
      font-size: 15px;
      transition: color 0.3s;
      line-height: 60px;

      &:hover,
      &.active {
        color: var(--es-brand-primary);
      }

      &.router-link-active {
        color: var(--es-brand-primary);
        font-weight: 500;
      }
    }

    .nav-link {
      i {
        margin-right: 4px;
      }
    }
  }
}

/* 主体内容 */
.main {
  padding-top: 60px;
  min-height: calc(100vh - 60px);
  transition: padding-top 0.3s;

  &.banner-visible {
    padding-top: 92px;
  }
}

/* Vue3 升级引导横幅 */
.upgrade-banner {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  z-index: 99;
  background: linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.banner-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 1200px;
  padding: 0 20px;
  width: 100%;
}

.banner-tag {
  display: inline-block;
  padding: 1px 8px;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 3px;
  letter-spacing: 0.5px;
  line-height: 18px;
  flex-shrink: 0;
}

.banner-text {
  color: #cbd5e1;
  font-size: 13px;
  line-height: 32px;
  white-space: nowrap;

  strong {
    color: #60a5fa;
    font-weight: 600;
  }
}

.banner-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 14px;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.25s;
  flex-shrink: 0;

  &:hover {
    opacity: 0.9;
    box-shadow: 0 2px 10px rgba(59, 130, 246, 0.4);
  }

  i {
    font-size: 12px;
  }
}

.banner-close {
  position: absolute;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  padding: 0;

  &:hover {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.08);
  }
}

/* 页脚 */
.footer {
  background: #f5f7fa;
  padding: 40px 0;
  text-align: center;
  color: #909399;
  font-size: 14px;
  border-top: 1px solid #e6e6e6;

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }
}

/* 容器 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 通用文档样式 */
.docs-page {
  display: flex;
  min-height: calc(100vh - 60px);
}

/* 侧边栏 */
.side-nav {
  width: 260px;
  padding: 30px 0;
  border-right: 1px solid #e6e6e6;
  background: #fff;
  position: fixed;
  top: 92px;
  bottom: 0;
  overflow-y: auto;

  .nav-group {
    margin-bottom: 20px;

    .nav-title {
      padding: 10px 20px;
      font-size: 14px;
      color: #909399;
      font-weight: 600;
      text-transform: uppercase;
    }

    .nav-item {
      display: block;
      padding: 10px 20px 10px 30px;
      color: #606266;
      text-decoration: none;
      font-size: 14px;
      transition: all 0.3s;
      border-right: 3px solid transparent;

      &:hover {
        color: var(--es-brand-primary);
      }

      &.active,
      &.router-link-active {
        color: var(--es-brand-primary);
        border-right-color: var(--es-brand-primary);
        background: #f5f7fa;
      }
    }
  }
}

/* 内容区 */
.content {
  flex: 1;
  margin-left: 260px;
  padding: 30px 40px;
  max-width: calc(100% - 260px);
}

/* 文档标题 */
.content-title {
  font-size: 28px;
  font-weight: 400;
  color: #1f2f3d;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.content-subtitle {
  font-size: 22px;
  font-weight: 400;
  color: #1f2f3d;
  margin: 30px 0 15px;
}

/* 段落 */
.content p {
  line-height: 1.8;
  color: #28292d;
  margin-bottom: 15px;
}

/* 代码块 */
pre {
  background: #0f1010; // #f5f7fa;
  padding: 15px 20px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 15px 0;

  code {
    font-family: 'Courier New', Consolas, monospace;
    font-size: 13px;
    color: #dcdfe4;
    line-height: 1.6;
  }
}

/* 行内代码 */
code {
  // background: #f4f4f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', Consolas, monospace;
  color: #c0392b;
  font-size: 13px;
}

/* 开发指南等页面手写了深色 .code-block（深色头部 + 深色容器 #1e1e1e）。
 * 这些页面被布局包在 .es-doc-content 内，而 docs-content.css（单一权威源）会给
 * .es-doc-content pre 施加“亮色 GitHub 风格”背景/文字/圆角/外边距，渗入深色 .code-block
 * 后造成“深色头部 + 亮色代码体”的割裂与低对比。此处把 .code-block 内的 pre 归还给深色容器：
 * 透明背景、去除多余圆角/外边距、浅色文字。选择器 (.es-doc-content .code-block pre = 0,2,1)
 * 稳定压过渗入规则 (.es-doc-content pre = 0,1,1)，与样式加载顺序无关。 */
.es-doc-content .code-block pre {
  margin: 0;
  background: transparent;
  border-radius: 0;
}
.es-doc-content .code-block pre code {
  color: #d4d4d4;
  background: transparent;
  padding: 0;
}

/* 表格 */
.table-props {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;

  th, td {
    padding: 12px;
    text-align: left;
    border: 1px solid #ebeef5;
  }

  th {
    background: #f5f7fa;
    font-weight: 600;
    color: #303133;
  }

  td {
    color: #606266;
  }
}

/* 提示框 */
.tip {
  padding: 12px 20px;
  background: #ecf5ff;
  border-left: 4px solid var(--es-brand-primary);
  border-radius: 4px;
  margin: 20px 0;

  p {
    margin: 0;
    color: #606266;
  }
}

.warning {
  padding: 12px 20px;
  background: #fdf6ec;
  border-left: 4px solid #e6a23c;
  border-radius: 4px;
  margin: 20px 0;

  p {
    margin: 0;
    color: #606266;
  }
}

/* ==================== 现代化文档样式 ==================== */

// Variables
$primary: var(--es-brand-primary);
$success: #67c23a;
$warning: #e6a23c;
$danger: #f56c6c;
$text-primary: #1a1a1a;
$text-secondary: #4a5568;
$text-tertiary: #718096;
$border-color: #e2e8f0;
$bg-light: #f7fafc;

// Hero Section - 统一的首屏样式
.modern-hero {
  text-align: center;
  padding: 40px 20px;
  background: var(--es-brand-primary-light);
  border-radius: var(--es-radius-sm);
  margin-bottom: 32px;
  color: #1a1a2e;
  position: relative;
  overflow: hidden;

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    background: var(--es-brand-primary);
    color: #fff;
    border-radius: 50px;
    font-size: 14px;
    margin-bottom: 16px;
    position: relative;

    i {
      font-size: 16px;
    }
  }

  .hero-title {
    font-size: 32px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0 0 12px;
    position: relative;
  }

  .hero-desc {
    max-width: 550px;
    margin: 0 auto;
    font-size: 15px;
    color: #606266;
    line-height: 1.7;
    position: relative;
  }
}

// Section Common
.modern-section {
  margin-bottom: 50px;

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
      &.cyan { background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); }
      &.pink { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); }
    }

    .section-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      color: $text-primary;
    }
  }

  .section-desc {
    font-size: 15px;
    color: $text-secondary;
    margin: 0 0 20px;
    line-height: 1.6;
  }
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
      color: $text-primary;
    }

    .section-desc {
      margin: 0;
      font-size: 15px;
      color: $text-secondary;
    }
  }
}

// Code Block - 统一的代码块样式
.modern-code-block {
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
    background: transparent;

    code {
      font-family: 'Fira Code', 'Consolas', monospace;
      color: #d4d4d4;
    }
  }
}

// Tip Card - 统一的提示卡片样式
.modern-tip-card {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fff9e6 0%, #fff5d6 100%);
  border-radius: 10px;
  border-left: 4px solid #faad14;
  margin: 20px 0;

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

// Success Tip
.modern-tip-success {
  background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
  border-left-color: #52c41a;

  .tip-icon {
    color: #52c41a;
  }

  .tip-content strong {
    color: #389e0d;
  }
}

// Info Tip
.modern-tip-info {
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
  border-left-color: #1890ff;

  .tip-icon {
    color: #1890ff;
  }

  .tip-content strong {
    color: #096dd9;
  }
}

// Requirement Cards
.req-cards {
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

// Next Links - 统一的下一步链接样式
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
      &.cyan { background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); }
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

// Config Table - 统一的配置表格样式
.modern-table-wrapper {
  overflow-x: auto;
}

.modern-table {
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

// Feature Cards - 特性卡片
.feature-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  .feature-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid $border-color;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: white;
      margin-bottom: 16px;

      &.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      &.purple { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
      &.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
      &.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    }

    .feature-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 8px;
      color: $text-primary;
    }

    .feature-desc {
      font-size: 13px;
      color: $text-secondary;
      margin: 0;
      line-height: 1.6;
    }
  }
}

// Demo Block - 示例区块样式优化
.demo-block {
  background: white;
  border-radius: 12px !important;
  border: 1px solid $border-color !important;
  // margin-bottom: 24px;
  overflow: hidden !important;
  margin-bottom: 80px !important;

  .demo-block__header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    background: $bg-light;
    border-bottom: 1px solid $border-color;

    .demo-block__title {
      font-size: 15px;
      font-weight: 600;
      color: $text-primary;
    }

    .demo-block__badge {
      padding: 2px 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 11px;
      border-radius: 4px;
    }
  }

  .demo-block__body {
    padding: 24px;
  }

  .demo-block__code {
    border-top: 1px solid $border-color;
     background: #2d2d2d !important;
    .code-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: $bg-light;
      cursor: pointer;
      transition: all 0.3s;
     background: #fff !important;

      &:hover {
        background: #e8f4ff !important;
      }

      i {
        color: $primary;
      }

      span {
        font-size: 13px;
        color: $text-secondary;
      }
    }

    pre {
      margin: 0;
      padding: 20px;
      background: #1e1e1e;
      overflow-x: auto;

      code {
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 13px;
        color: #d4d4d4;
        line-height: 1.6;
      }
    }
  }
}

// Tips Box - 提示框样式优化
.tips-box {
  padding: 16px 20px;
  border-radius: 10px;
  margin: 20px 0;

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 10px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      line-height: 1.8;
      color: $text-secondary;
    }
  }

  &--success {
    background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
    border-left: 4px solid #52c41a;

    h4 {
      color: #389e0d;
    }
  }

  &--info {
    background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
    border-left: 4px solid #1890ff;

    h4 {
      color: #096dd9;
    }
  }

  &--warning {
    background: linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%);
    border-left: 4px solid #faad14;

    h4 {
      color: #d48806;
    }
  }
}

// Footer CTA - 底部行动号召
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
      color: $text-primary;
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
  .upgrade-banner {
    height: auto;
    padding: 6px 0;
  }

  .banner-inner {
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .banner-text {
    font-size: 12px;
    white-space: normal;
    text-align: center;
    line-height: 1.5;
  }

  .banner-close {
    position: static;
  }

  .main.banner-visible {
    padding-top: 80px;
  }

  .side-nav {
    top: 80px !important;
  }

  .modern-hero {
    padding: 40px 20px;

    .hero-title {
      font-size: 32px;
    }
  }

  .req-cards {
    flex-direction: column;
  }

  .next-links {
    grid-template-columns: 1fr;
  }

  .feature-cards {
    grid-template-columns: 1fr;
  }

  .modern-table {
    font-size: 13px;

    th, td {
      padding: 10px 12px;
    }
  }
}
</style>
