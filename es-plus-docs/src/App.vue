<template>
  <div class="app-wrapper" :class="{ 'is-dark': isDark }">
    <AppHeader @toggle-mobile-menu="toggleMobileMenu" />
    <AppSidebar :mobile-open="mobileMenuOpen" @close="mobileMenuOpen = false" />
    <AppContent>
      <router-view />
    </AppContent>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppContent from './components/layout/AppContent.vue'
import { useThemeStore } from './stores/theme'

const themeStore = useThemeStore()
const isDark = ref(false)
const mobileMenuOpen = ref(false)

const toggleMobileMenu = (open) => {
  mobileMenuOpen.value = open
}

onMounted(() => {
  themeStore.initTheme()
  isDark.value = themeStore.isDark

  // Watch for theme changes from header toggle
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('is-dark')
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

.app-wrapper {
  min-height: 100vh;
  background-color: var(--bg-color-page);
  color: var(--text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

/* 代码高亮（hljs）token 颜色统一在 styles/index.scss，避免重复定义相互覆盖 */
</style>
