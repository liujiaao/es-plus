<template>
  <div
    id="app"
    :class="{ 'is-component': isComponent }"
  >
    <!-- 键盘用户的第一站：Tab 一下跳过导航直达正文（路线图 1.7） -->
    <a class="es-skip-link" href="#es-main">跳到主内容</a>

    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="container">
        <!-- 站点标志不是标题：此前这里是 <h1>，于是每一页的 H1 都是「ESES-Plus」
             （标志 + 品牌名），真正的页面标题退成二级。读屏用户从大纲里看到的
             是一串「ESES-Plus」，SEO 的标题权重也落在品牌名上。改为 div，
             页面自己的 <h1> 才是大纲的第一个标题（T5「H1 = 用户任务」的前提）。 -->
        <div class="logo">
          <router-link to="/">
            <span class="logo-img">ES</span>
            <span class="logo-text">ES-Plus</span>
          </router-link>
        </div>
        <!-- 窄屏导航开关：桌面隐藏，<769px 时把 .nav 变成下拉面板 -->
        <button
          class="nav-toggle"
          :aria-label="mobileNavOpen ? '关闭菜单' : '打开菜单'"
          :aria-expanded="String(mobileNavOpen)"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <i :class="mobileNavOpen ? 'el-icon-close' : 'el-icon-menu'"></i>
        </button>
        <nav
          class="nav"
          :class="{ 'mobile-open': mobileNavOpen }"
        >
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
            to="/guide/theme"
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
            href="https://github.com/liujiaao/es-plus"
            target="_blank"
            rel="noopener"
            class="nav-link"
          >
            <i class="el-icon-link"></i> GitHub
          </a>
          <!-- 站内搜索（审计 P1-4）：词表取自路由 meta.title，样式见 docs-chrome.css -->
          <DocSearch />
          <el-dropdown
            trigger="click"
            class="site-switcher"
            @command="switchSite"
          >
            <span class="site-switcher-link">
              <i class="el-icon-refresh"></i> {{ currentSiteLabel }}<i class="el-icon-arrow-down el-icon--right"></i>
            </span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item
                v-for="s in SITES"
                :key="s.key"
                :command="s"
              >
                {{ s.key === currentSite ? '✓ ' : '' }}{{ s.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </nav>
      </div>
    </header>

    <!-- 渲染端说明条（审计 P1-6）：此前是 position: fixed 的深色渐变条，
         一条 32px 的固定条 + 顶栏 60px 让每一页首屏都先被吃掉 92px，而且它
         永远盖在内容上方。现在它回到文档流里跟着滚走 —— 需要时看得见，
         读正文时不占地方。视觉也从「营销横幅」降级为中性提示条。 -->
    <div
      v-show="!bannerClosed"
      class="upgrade-banner"
    >
      <div class="banner-inner">
        <span class="banner-tag">渲染端</span>
        <span class="banner-text">
          本站是 ES-Plus 的 <strong>Vue 2 + Element UI</strong> 渲染器文档；完整文档（含<strong>三端通用对比</strong>与<strong>AI 工具链</strong>）见主文档站
        </span>
        <a
          href="https://main.esplus-ai.com/"
          target="_blank"
          rel="noopener"
          class="banner-link"
        >
          前往主文档站 <i class="el-icon-top-right"></i>
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

    <!-- 主体内容：<main> 是三站统一的地标，也是 skip link 的落点（路线图 1.7） -->
    <main
      id="es-main"
      tabindex="-1"
      class="main"
    >
      <router-view />
    </main>

    <!-- 三站统一页脚（路线图 1.8）：此前只有首页有两行居中文本，
         其它页面走到末尾什么都没有。现在每一页都是同一个四列页脚。 -->
    <DocFooter />
  </div>
</template>

<script>
// 三端站点清单：与案例卡跨端互链共用一份（见 utils/sites.js 的说明）
import { SITES, SITE_KEY } from '@/utils/sites'
import { bindSkipLink } from '@/utils/doc-chrome'
import DocFooter from '@/components/doc/DocFooter.vue'
import DocSearch from '@/components/doc/DocSearch.vue'

export default {
  name: 'App',
  components: { DocFooter, DocSearch },
  data() {
    return {
      bannerClosed: false,
      mobileNavOpen: false,
      SITES
    }
  },
  mounted() {
    // 跳转链接必须拦默认行为：hash 路由会把 #es-main 当成一条不存在的路径
    bindSkipLink(document)
  },
  watch: {
    // 点任意导航项后收起下拉：否则它会盖住刚打开的页面
    $route() {
      this.mobileNavOpen = false
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
      // 顶栏「主题」指向 /guide/theme；/theme 是旧地址（重定向），两者都算选中
      return this.$route.path.startsWith('/guide/theme') || this.$route.path.startsWith('/theme')
    },
    isAiTools() {
      return this.$route.path.startsWith('/ai-tools')
    },
    currentSite() {
      return SITE_KEY
    },
    currentSiteLabel() {
      return SITES.find((s) => s.key === this.currentSite)?.label || '站点'
    }
  },
  methods: {
    switchSite(site) {
      if (site && site.key !== this.currentSite && site.url) {
        window.location.href = site.url
      }
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
  font-family: var(--es-font-sans);
  font-size: 14px;
  color: var(--es-text-regular);
  background-color: var(--es-bg);
}

/* 纵向 flex：正文吃满剩余高度，页脚永远落在视口底部（路线图 1.8）。
   此前这里只是 min-height，正文自己又写死 100vh - 60px，页脚被推到屏幕外一屏。

   padding-top 60px 让位给 fixed 顶栏：渲染端说明条现在是普通文档流元素，
   它必须排在顶栏**下方**而不是被顶栏盖住。 */
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-top: 60px;
}

/* 顶部导航 */
.header {
  height: 60px;
  background-color: var(--es-bg);
  border-bottom: 1px solid var(--es-border-lighter);
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
      /* 与另两站的品牌标记保持一致：同一渐变、同一圆角、同一字号 */
      background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
      color: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.3px;
      margin-right: 10px;
    }

    .logo-text {
      font-size: 18px;
      color: var(--es-text-primary);
      font-weight: 600;
    }
  }

  /* 窄屏开关：桌面不显示（导航直接排在顶栏里） */
  .nav-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-left: auto;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--es-text-regular);
    font-size: 20px;
    cursor: pointer;

    &:hover {
      background: var(--es-fill);
      color: var(--es-brand-strong);
    }
  }

  .nav {
    margin-left: auto;
    display: flex;
    align-items: center;

    a {
      display: inline-block;
      padding: 0 16px;
      color: var(--es-text-regular);
      text-decoration: none;
      font-size: 15px;
      transition: color var(--es-duration-base) var(--es-ease);
      line-height: 60px;

      &:hover,
      &.active {
        color: var(--es-brand-strong);
      }

      &.router-link-active {
        color: var(--es-brand-strong);
        font-weight: 500;
      }
    }

    .nav-link {
      i {
        margin-right: 4px;
      }
    }

    .site-switcher {
      margin-left: 12px;

      .site-switcher-link {
        display: inline-flex;
        align-items: center;
        height: 60px;
        color: var(--es-text-regular);
        font-size: 15px;
        cursor: pointer;
        transition: color var(--es-duration-base) var(--es-ease);

        &:hover {
          color: var(--es-brand-strong);
        }

        .el-icon-refresh {
          margin-right: 4px;
        }
      }

      .el-dropdown-menu__item.is-active {
        color: var(--es-brand-primary);
        font-weight: 600;
      }
    }
  }
}

/* 主体内容 */
.main {
  flex: 1 1 auto;
  min-height: 0;
  /* 顶栏的 60px 由 #app 的 padding-top 让出来，这里不再重复避让；
     说明条回到文档流后，「横幅出现/关闭」不再引起整页位移。 */
}

/* 渲染端说明条（审计 P1-6）：普通文档流 + 中性配色，跟着页面滚走。
   此前是 fixed 的 32px 深色渐变条，等于每条路由的首屏都被扣掉 92px。 */
.upgrade-banner {
  position: relative; /* 关闭按钮 absolute 的定位基准 */
  background: var(--es-brand-tint);
  border-bottom: 1px solid var(--es-border-lighter);
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--es-space-3);
  max-width: var(--es-layout-max);
  padding: 6px 20px;
  width: 100%;
}

.banner-tag {
  display: inline-block;
  padding: 1px 8px;
  background: var(--es-brand-strong);
  color: #fff;
  font-size: var(--es-text-xs);
  font-weight: 600;
  border-radius: var(--es-radius-xs);
  letter-spacing: 0.02em;
  line-height: 18px;
  flex-shrink: 0;
}

.banner-text {
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
  line-height: 1.5;

  strong {
    color: var(--es-text-primary);
    font-weight: 600;
  }
}

.banner-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--es-brand-strong);
  font-size: var(--es-text-sm);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--es-duration-base) var(--es-ease);
  flex-shrink: 0;

  &:hover {
    color: var(--es-text-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
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
  color: var(--es-text-secondary);
  cursor: pointer;
  border-radius: var(--es-radius-xs);
  transition: color var(--es-duration-base) var(--es-ease),
    background-color var(--es-duration-base) var(--es-ease);
  padding: 0;

  &:hover {
    color: var(--es-text-primary);
    background: var(--es-fill);
  }
}

/* 页脚外观与数据都不在这里：docs/theme/docs-footer.css + utils/site-footer.js（路线图 1.8） */

/* 容器 */
.container {
  max-width: var(--es-layout-max);
  margin: 0 auto;
  padding: 0 20px;
}

/* 通用文档样式 */
/* 高度不再写死：正文段吃剩余高度（.main 的 flex: 1），
   这里再要 100vh - 60px 会把页脚顶到视口外（路线图 1.8）。 */
.docs-page {
  display: flex;
  align-items: flex-start;
}

/* 侧边栏（审计 P0-5 / §6.2-5）：此前是 position: fixed; top: 92px，
   一旦说明条回到文档流，92 这个数是「顶栏 + 说明条」的硬编码，说明条滚走之后
   侧栏与顶栏之间会多出一条 32px 的空隙。改成 sticky 后它跟着顶栏一起走：
   自然位置在说明条下方，滚过说明条后钉在顶栏下沿。 */
.side-nav {
  position: sticky;
  top: 60px;
  flex: 0 0 var(--es-sidebar-width);
  width: var(--es-sidebar-width);
  height: calc(100vh - 60px);
  padding: var(--es-space-5) 0;
  border-right: 1px solid var(--es-border-lighter);
  background: var(--es-bg);
  overflow-y: auto;

  .nav-group {
    margin-bottom: var(--es-space-4);

    .nav-title {
      padding: var(--es-space-2) 20px;
      font-size: var(--es-text-xs);
      color: var(--es-text-secondary);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .nav-item {
      display: block;
      padding: var(--es-space-2) 20px var(--es-space-2) 24px;
      color: var(--es-text-regular);
      text-decoration: none;
      font-size: var(--es-text-base);
      line-height: var(--es-leading-snug);
      transition: color var(--es-duration-base) var(--es-ease),
        background-color var(--es-duration-base) var(--es-ease),
        border-color var(--es-duration-base) var(--es-ease);
      border-right: 3px solid transparent;

      &:hover {
        color: var(--es-brand-strong);
      }

      &.active,
      &.router-link-active {
        color: var(--es-brand-strong);
        border-right-color: var(--es-brand-strong);
        background: var(--es-brand-tint);
      }
    }
  }
}

/* 内容区 */
.content {
  flex: 1 1 auto;
  min-width: 0;
  padding: 30px 40px;
}

/* 抽屉开关与遮罩只在窄屏存在（外观在这里，节点由 DocShell 渲染） */
.side-nav-toggle {
  display: none;
  align-items: center;
  gap: var(--es-space-2);
  width: calc(100% - 32px);
  margin: var(--es-space-3) var(--es-space-4) 0;
  padding: 10px 14px;
  border: 1px solid var(--es-border-light);
  border-radius: var(--es-radius-sm);
  background: var(--es-bg);
  color: var(--es-text-regular);
  font-size: var(--es-text-base);
  font-weight: 500;
  text-align: left;
  cursor: pointer;

  i {
    font-size: 16px;
    color: var(--es-brand-strong);
  }

  &:active {
    background: var(--es-fill);
  }
}

.side-nav-mask {
  display: none;
  position: fixed;
  inset: 60px 0 0;
  z-index: 94;
  background: rgba(15, 23, 42, 0.42);
}

/* 正文度量不在壳层做：各页根节点都带自己的 max-width（1200/1400 不等），
   壳层的通用规则会被页面级选择器压掉。统一到 760/960 属于路线图 1.3
   （逐模板改页面根节点），见 docs/theme/docs-layout.css 的 .es-doc-measure / .es-doc-wide。 */

/* 文档标题 */
.content-title {
  font-size: var(--es-text-3xl);
  font-weight: 600;
  color: var(--es-text-primary);
  margin-bottom: var(--es-space-5);
  padding-bottom: var(--es-space-3);
  border-bottom: 1px solid var(--es-border-lighter);
}

.content-subtitle {
  font-size: var(--es-text-xl);
  font-weight: 600;
  color: var(--es-text-primary);
  margin: var(--es-space-6) 0 var(--es-space-3);
}

/* 段落 */
.content p {
  line-height: var(--es-leading-relaxed);
  color: var(--es-text-regular);
  margin-bottom: var(--es-space-3);
}

/* 代码块（深色终端风，本站固定，不跟随主题） */
pre {
  background: #0f1010; // #f5f7fa;
  padding: 15px 20px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 15px 0;
}

/* 深色代码块的文字色必须显式声明，并且**压过共享 docs-content.css 的
 * `.es-doc-content pre code { color: var(--es-doc-code-block-text) }`。
 * 那条规则的颜色是给 `.code-block-wrapper`（浅底，三站统一的代码块）用的；
 * 落到这里的深底上就是主题的深色文字压深色底，实测对比度 1.3:1 —— 快速开始等
 * 七个路由的代码示例基本不可读。`:not()` 把 wrapper 排除在外，它仍走 token。
 * 特异性：`.es-doc-content` + `pre` + `:not(pre 后代)` + `code` > 0,1,2。 */
pre:not(.code-block-wrapper pre) code {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  color: #dcdfe4;
  line-height: 1.6;
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
// 审计 P0-3：与 guide / component 各页的 .hero-section 用同一套浅色语言；
// 徽章此前是 #3b82f6 实心底 + 白字（3.68:1，14px 正文不达标），改为白底品牌字。
.modern-hero {
  text-align: center;
  padding: var(--es-space-7) var(--es-space-4);
  background: var(--es-brand-tint);
  border: 1px solid var(--es-border-lighter);
  border-radius: var(--es-radius-lg);
  margin-bottom: var(--es-space-6);

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(--es-bg);
    border: 1px solid var(--es-border-light);
    color: var(--es-brand-strong);
    border-radius: var(--es-radius-full);
    font-size: var(--es-text-sm);
    font-weight: 600;
    margin-bottom: var(--es-space-4);

    i {
      font-size: 16px;
    }
  }

  .hero-title {
    font-size: var(--es-display-sm);
    line-height: var(--es-leading-tight);
    letter-spacing: -0.02em;
    font-weight: 700;
    color: var(--es-text-primary);
    margin: 0 0 var(--es-space-3);
  }

  .hero-desc {
    max-width: 640px;
    margin: 0 auto;
    font-size: var(--es-text-base);
    color: var(--es-text-regular);
    line-height: var(--es-leading-relaxed);
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

      /* 分区图标原来四种颜色各配一种渐变，外加两枚彩虹 —— 同一类东西被颜色
         分成了六种。收成一个品牌色（审计 §6.6：一个页面最多一个强调色）。 */
      &.blue,
      &.purple,
      &.green,
      &.orange,
      &.cyan,
      &.pink { background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%); }
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
    background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
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

// 这里原有 .modern-tip-card / -success / -info 三组样式（61 行，硬编码琥珀 / 绿 / 蓝渐变）。
// 全仓 0 处模板使用 —— 它们只是「看着像统一卡片」的死样式，真正的提示卡片是各页的 .tip-card。
// 视觉系统（路线图 2.7「统一卡片」）只留一套，删掉，免得有人以为它才是标准。
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
    transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);

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

      &.vue,
      &.element,
      &.browser { background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%); }
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
    transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);

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

      &.blue,
      &.purple,
      &.green,
      &.orange,
      &.cyan { background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%); }
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
      transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);
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
      background: var(--es-success-tint);
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
    transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);

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

      &.blue,
      &.purple,
      &.green,
      &.orange { background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%); }
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
      background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
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
      transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);
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
    background: var(--es-success-tint);
    border-left: 4px solid var(--es-success);

    h4 {
      color: var(--es-success-text);
    }
  }

  &--info {
    background: var(--es-info-tint);
    border-left: 4px solid var(--es-info);

    h4 {
      color: var(--es-info-text);
    }
  }

  &--warning {
    background: var(--es-warning-tint);
    border-left: 4px solid var(--es-warning);

    h4 {
      color: var(--es-warning-text);
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
      background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
      color: white;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      text-decoration: none;
      transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
      }
    }
  }
}

// Responsive
@media (max-width: 768px) {
  /* 说明条本来就在文档流里，窄屏只需要允许换行 */
  .banner-inner {
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    padding: 8px 40px 8px 12px;
  }

  .banner-text {
    font-size: var(--es-text-xs);
    white-space: normal;
    text-align: center;
    line-height: 1.5;
  }

  .banner-close {
    top: 50%;
    transform: translateY(-50%);
  }

  /* 顶栏导航在窄屏收成下拉面板：10 个入口横排会把页面撑出横向滚动条（390px 时 892px 宽） */
  .header {
    .nav-toggle {
      display: inline-flex;
    }

    .nav {
      display: none;
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      z-index: 101;
      flex-direction: column;
      align-items: stretch;
      margin-left: 0;
      padding: 6px 0;
      max-height: calc(100vh - 60px);
      overflow-y: auto;
      background: #fff;
      border-bottom: 1px solid var(--es-border-lighter);
      box-shadow: var(--es-shadow-md);

      &.mobile-open {
        display: flex;
      }

      a {
        line-height: 44px;
        padding: 0 20px;
      }

      .site-switcher {
        margin-left: 0;

        .site-switcher-link {
          display: flex;
          height: 44px;
          padding: 0 20px;
        }
      }
    }
  }

  /* ── 文档侧栏：从「静态 375×380 把正文推到首屏外」改成抽屉 ──
     静态侧栏在 390px 下既压掉整屏高度、又没法收起；固定 260px 宽则会把正文
     挤成 130px 一条缝。抽屉是主流文档站（VuePress / VitePress / dumi）的做法：
     默认不占位，点顶部的「文档目录」按钮滑出，选中条目或点遮罩即关闭。
     开关由 DocShell 渲染（本文件只负责外观）。 */
  .docs-page {
    flex-direction: column;
  }

  .side-nav-toggle {
    display: inline-flex;
  }

  .side-nav {
    position: fixed;
    top: 60px;
    left: 0;
    bottom: 0;
    z-index: 95;
    flex: none;
    width: 280px;
    max-width: 82vw;
    height: auto;
    padding: var(--es-space-3) 0;
    border-right: 1px solid var(--es-border-lighter);
    box-shadow: var(--es-shadow-lg);
    overflow-y: auto;
    transform: translateX(-100%);
    transition: transform var(--es-duration-base) var(--es-ease);

    &.is-open {
      transform: none;
    }
  }

  .side-nav-mask {
    display: block;
  }

  .content {
    width: 100%;
    padding: 20px 16px;
  }

  .modern-hero {
    padding: var(--es-space-6) var(--es-space-4);

    .hero-title {
      font-size: var(--es-text-3xl);
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
