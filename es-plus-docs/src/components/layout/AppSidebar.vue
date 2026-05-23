<template>
  <transition name="sidebar-overlay">
    <div v-if="mobileOpen" class="sidebar-overlay" @click="$emit('close')" />
  </transition>
  <aside class="app-sidebar" :class="{ 'mobile-open': mobileOpen }">
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
          <li class="nav-item">
            <router-link to="/guide/mcp-server" class="nav-link">
              <span class="nav-icon"><el-icon><MagicStick /></el-icon></span>
              MCP Server
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/guide/migration" class="nav-link">
              <span class="nav-icon"><el-icon><Switch /></el-icon></span>
              迁移指南
            </router-link>
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
            <router-link to="/ai-crud" class="nav-link">
              <span class="nav-icon"><el-icon><MagicStick /></el-icon></span>
              AI CRUD 生成器
            </router-link>
          </li>
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

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { Edit, Grid, ChatDotRound, Connection, Monitor, Switch, MagicStick } from '@element-plus/icons-vue'

const props = defineProps<{
  mobileOpen?: boolean
}>()

const emit = defineEmits(['close'])

const route = useRoute()

// Navigate on mobile closes sidebar
watch(() => route.path, () => {
  if (props.mobileOpen) {
    emit('close')
  }
})
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
  transition: transform 0.3s ease;
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active {
  transition: opacity 0.3s ease;
}

.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to {
  opacity: 0;
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

@media (max-width: 768px) {
  .app-sidebar {
    transform: translateX(-100%);
    z-index: 200;

    &.mobile-open {
      transform: translateX(0);
    }
  }
}
</style>
