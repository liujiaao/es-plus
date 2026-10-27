<template>
  <div class="app-wrapper" :class="{ dark: isDark, 'is-landing': isLanding }">
    <!-- 键盘用户的第一站：Tab 一下就能跳过整个导航直达正文（路线图 1.7）。
         落点 #es-main 在 AppContent 的 <main> 上，带 tabindex="-1" 才接得住焦点。 -->
    <a class="es-skip-link" href="#es-main">跳到主内容</a>
    <AppHeader @toggle-mobile-menu="toggleMobileMenu" />
    <AppSidebar :mobile-open="mobileMenuOpen" @close="mobileMenuOpen = false" />
    <AppContent>
      <router-view />
    </AppContent>
    <!-- 页脚在三站的每一页都有（此前只有首页有）：路线图 1.8 -->
    <AppFooter />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppContent from './components/layout/AppContent.vue'
import AppFooter from './components/layout/AppFooter.vue'
import { bindSkipLink } from '@/utils/doc-chrome.js'
import { useThemeStore } from './stores/theme'

const route = useRoute()
const themeStore = useThemeStore()
// 初值直接读 index.html 内联脚本已经挂上的类：否则挂载前有一帧 app-wrapper 仍是浅色
const isDark = ref(document.documentElement.classList.contains('dark'))
const mobileMenuOpen = ref(false)

/**
 * Landing 不挂文档侧栏（路线图 T1 规则）。首页是**产品页**，不是文档页：左边一条
 * 「快速开始 / 核心案例 / 组件 API」的目录会把它拉回「文档站」的观感，也白吃掉
 * 260px —— 首屏证据（三端产物面板）正是靠这点宽度才读得下。
 *
 * 只在桌面宽度生效（见样式里那条 min-width）：窄屏下侧栏就是抽屉，是首页唯一的
 * 导航入口，藏掉等于让手机用户走不出去。
 */
const isLanding = computed(() => route.path === '/')

const toggleMobileMenu = (open) => {
  mobileMenuOpen.value = open
}

onMounted(() => {
  // 跳转链接必须拦默认行为：hash 路由会把 #es-main 当成一条不存在的路径
  bindSkipLink(document)
  themeStore.initTheme()
  isDark.value = themeStore.isDark

  // Watch for theme changes from header toggle
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
</script>

<style lang="scss">
/* 设计 token 由 design-tokens.css（单一真源）提供，这里只保留全局基础样式 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-color-primary);
  background-color: var(--bg-color-page);
}

/* 纵向 flex：正文吃掉剩余高度，页脚永远贴在视口底部（短页面不再把页脚顶到
   屏幕外一屏的位置）。侧栏是 fixed、顶栏是 fixed，都不参与这条流。 */
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-color-page);
  color: var(--text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

/* Landing 去侧栏（路线图 T1）：只在桌面宽度生效。
   三条规则必须同时改 —— 侧栏收起的那一刻，正文要让出 260px 的左缩进，页脚也要
   把「给固定侧栏让位」的左边距一起放掉，否则首页左边留一条空白带。 */
@media (min-width: 1201px) {
  .app-wrapper.is-landing .app-sidebar {
    display: none;
  }

  .app-wrapper.is-landing .app-content {
    margin-left: 0;
  }

  .app-wrapper.is-landing .es-footer {
    margin-left: 0;
  }
}

/* 代码高亮（hljs）token 颜色统一在 styles/index.scss，避免重复定义相互覆盖 */
</style>
