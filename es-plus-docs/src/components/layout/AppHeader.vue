<template>
  <header class="app-header">
    <div class="header-left">
      <button class="hamburger-btn" @click="toggleMobileMenu" aria-label="菜单">
        <el-icon :size="20"><component :is="mobileMenuOpen ? 'Close' : 'Expand'" /></el-icon>
      </button>
      <router-link to="/" class="logo">
        <span class="logo-icon">ES</span>
        <span class="logo-text">Plus</span>
      </router-link>
      <nav class="header-nav">
        <router-link to="/" class="nav-item">首页</router-link>
        <router-link to="/guide/getting-started" class="nav-item">指南</router-link>
        <router-link to="/components/es-form" class="nav-item">组件</router-link>
        <router-link to="/advanced/use-dialog" class="nav-item">高级</router-link>
        <router-link to="/playground" class="nav-item">Playground</router-link>
      </nav>
    </div>
    <div class="header-right">
      <button class="search-btn" @click="searchVisible = true" title="搜索 (Ctrl+K)">
        <el-icon :size="18"><Search /></el-icon>
        <span class="search-shortcut-text">Ctrl K</span>
      </button>
      <button class="theme-btn" @click="toggleTheme" :title="isDark ? '切换亮色' : '切换暗色'">
        <el-icon :size="18"><component :is="isDark ? 'Sunny' : 'Moon'" /></el-icon>
      </button>
      <a href="https://github.com/liujiaao/es-plus" target="_blank" rel="noopener" class="github-link">
        <el-icon :size="20"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg></el-icon>
      </a>
    </div>
  </header>
  <DocSearch v-model:visible="searchVisible" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Search, Close, Expand, Sunny, Moon } from '@element-plus/icons-vue'
import DocSearch from '../doc/DocSearch.vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const isDark = ref(themeStore.isDark)
const mobileMenuOpen = ref(false)
const searchVisible = ref(false)

const emit = defineEmits(['toggle-mobile-menu'])

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
  emit('toggle-mobile-menu', mobileMenuOpen.value)
}

const toggleTheme = () => {
  themeStore.toggleTheme()
  isDark.value = themeStore.isDark
}

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchVisible.value = true
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="scss" scoped>
.app-header {
  height: var(--header-height);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.hamburger-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-color-regular);
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--fill-color-light);
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;

  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--brand-accent) 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 14px;
  }

  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-color-primary);
    letter-spacing: -0.5px;
  }
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-item {
  color: var(--text-color-regular);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;

  &:hover {
    color: var(--primary-color);
  }

  &.router-link-active {
    color: var(--primary-color);
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--text-color-secondary);
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
}

.search-shortcut-text {
  font-size: 12px;
  opacity: 0.6;
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-color-regular);
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background-color: var(--fill-color-light);
    color: var(--primary-color);
  }
}

.github-link {
  color: var(--text-color-regular);
  transition: color 0.2s;
  display: flex;
  align-items: center;

  &:hover {
    color: var(--text-color-primary);
  }
}

@media (max-width: 768px) {
  .hamburger-btn {
    display: flex;
  }

  .header-nav {
    display: none;
  }

  .search-shortcut-text {
    display: none;
  }

  .header-left {
    gap: 12px;
  }

  .app-header {
    padding: 0 16px;
  }
}
</style>
