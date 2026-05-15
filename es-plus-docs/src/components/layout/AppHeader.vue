<template>
  <header class="app-header">
    <div class="header-left">
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
      <DocSearch />
      <a href="https://github.com" target="_blank" class="github-link">
        <el-icon :size="20"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg></el-icon>
      </a>
    </div>
  </header>
</template>

<script setup>
import DocSearch from '../doc/DocSearch.vue'
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
  gap: 48px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  
  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--primary-color) 0%, #36cfc9 100%);
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
  gap: 16px;
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
  .header-nav {
    display: none;
  }
}
</style>
