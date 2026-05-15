<template>
  <aside class="app-sidebar">
    <div class="sidebar-content">
      <!-- 指南部分 -->
      <div class="nav-section">
        <div class="nav-title">指南</div>
        <ul class="nav-list">
          <li class="nav-item">
            <router-link to="/guide/getting-started" class="nav-link">快速开始</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/guide/installation" class="nav-link">安装</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/guide/usage" class="nav-link">使用</router-link>
          </li>
        </ul>
      </div>
      
      <!-- 组件部分 -->
      <div class="nav-section">
        <div class="nav-title">组件</div>
        <ul class="nav-list">
          <li class="nav-item">
            <router-link to="/components/es-form" class="nav-link">
              <span class="nav-icon"><el-icon><Edit /></el-icon></span>
              EsForm 高级表单
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/components/es-table" class="nav-link">
              <span class="nav-icon"><el-icon><Grid /></el-icon></span>
              EsTable 高级表格
            </router-link>
          </li>
        </ul>
      </div>
      
      <!-- 高级用法 -->
      <div class="nav-section">
        <div class="nav-title">高级用法</div>
        <ul class="nav-list">
          <li class="nav-item">
            <router-link to="/advanced/use-dialog" class="nav-link">
              <span class="nav-icon"><el-icon><ChatDotRound /></el-icon></span>
              useDialog 弹窗
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/advanced/linkage" class="nav-link">
              <span class="nav-icon"><el-icon><Connection /></el-icon></span>
              高级联动组合
            </router-link>
          </li>
        </ul>
      </div>
      
      <!-- Playground -->
      <div class="nav-section">
        <div class="nav-title">工具</div>
        <ul class="nav-list">
          <li class="nav-item">
            <router-link to="/playground" class="nav-link">
              <span class="nav-icon"><el-icon><Monitor /></el-icon></span>
              Playground
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { Edit, Grid, ChatDotRound, Connection, Monitor } from '@element-plus/icons-vue'
</script>

<style lang="scss" scoped>
.app-sidebar {
  width: 260px;
  height: calc(100vh - var(--header-height));
  position: fixed;
  left: 0;
  top: var(--header-height);
  background-color: var(--bg-color);
  border-right: 1px solid var(--border-color-lighter);
  overflow-y: auto;
  z-index: 100;
}

.sidebar-content {
  padding: 16px 0;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-title {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  margin: 2px 0;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  color: var(--text-color-regular);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
  
  &:hover {
    color: var(--primary-color);
    background-color: var(--fill-color-light);
  }
  
  &.router-link-active {
    color: var(--primary-color);
    background-color: var(--primary-color-light);
    border-left-color: var(--primary-color);
    font-weight: 500;
  }
}

.nav-icon {
  display: flex;
  align-items: center;
  margin-right: 10px;
  color: inherit;
}
</style>
