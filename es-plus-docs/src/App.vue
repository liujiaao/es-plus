<template>
  <div class="app-wrapper">
    <AppHeader />
    <AppSidebar />
    <AppContent>
      <router-view />
    </AppContent>
  </div>
</template>

<script setup>
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppContent from './components/layout/AppContent.vue'
</script>

<style lang="scss">
:root {
  --header-height: 60px;
  --primary-color: #409eff;
  --primary-color-light: #ecf5ff;
  --bg-color: #ffffff;
  --bg-color-page: #f5f7fa;
  --text-color-primary: #303133;
  --text-color-regular: #606266;
  --text-color-secondary: #909399;
  --border-color-lighter: #ebeef5;
  --fill-color: #f0f2f5;
  --fill-color-light: #f5f7fa;
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
}

/* 代码高亮样式 */
.hljs {
  background-color: #f6f8fa;
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
</style>
