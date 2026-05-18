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
:root {
  --header-height: 60px;
  --brand-primary: #3b82f6;
  --brand-primary-light: #dbeafe;
  --brand-accent: #06b6d4;
  --primary-color: var(--brand-primary);
  --primary-color-light: var(--brand-primary-light);
  --bg-color: #ffffff;
  --bg-color-page: #f5f7fa;
  --text-color-primary: #303133;
  --text-color-regular: #606266;
  --text-color-secondary: #909399;
  --border-color-lighter: #ebeef5;
  --fill-color: #f0f2f5;
  --fill-color-light: #f5f7fa;
}

.is-dark {
  --brand-primary-light: #1e3a5f;
  --primary-color-light: var(--brand-primary-light);
  --bg-color: #1d1e1f;
  --bg-color-page: #141414;
  --text-color-primary: #e5eaf3;
  --text-color-regular: #cfd3dc;
  --text-color-secondary: #a3a6ad;
  --border-color-lighter: #363637;
  --fill-color: #2c2e31;
  --fill-color-light: #2c2e31;
}

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

/* 代码高亮样式 */
.hljs {
  background-color: var(--fill-color);
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.hljs-keyword {
  color: #d73a49;
}

.hljs-string {
  color: #032f62;
}

.hljs-comment {
  color: #6a737d;
}

.hljs-tag {
  color: #22863a;
}

.hljs-attr {
  color: #6f42c1;
}

.hljs-number {
  color: #005cc5;
}

.is-dark .hljs-keyword { color: #c678dd; }
.is-dark .hljs-string { color: #98c379; }
.is-dark .hljs-comment { color: #5c6370; }
.is-dark .hljs-tag { color: #e06c75; }
.is-dark .hljs-attr { color: #d19a66; }
.is-dark .hljs-number { color: #d19a66; }
</style>
