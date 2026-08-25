<template>
  <a-layout class="doc-layout">
    <!-- 顶部导航 -->
    <a-layout-header class="doc-header">
      <div class="header-left">
        <a-space align="center" :size="12">
          <BookOutlined class="logo-icon" />
          <span class="logo-text">ES-Plus 开发文档</span>
        </a-space>
      </div>
      <div class="header-right">
        <a-space :size="16">
          <a-button type="link" href="https://github.com" target="_blank">
            <GithubOutlined /> GitHub
          </a-button>
          <a-button type="primary" size="small">v1.0.0</a-button>
        </a-space>
      </div>
    </a-layout-header>

    <a-layout class="doc-body">
      <!-- 侧边栏 -->
      <a-layout-sider class="doc-sider" width="260">
        <a-menu
          v-model:selectedKeys="selectedKeys"
          v-model:openKeys="openKeys"
          mode="inline"
          :style="{ borderInlineEnd: 'none' }"
          @click="handleMenuClick"
        >
          <!-- 概览 -->
          <a-menu-item key="home">
            <template #icon><HomeOutlined /></template>
            <span>首页</span>
          </a-menu-item>

          <!-- 快速上手 -->
          <a-menu-item key="guide">
            <template #icon><RocketOutlined /></template>
            <span>快速上手</span>
          </a-menu-item>

          <!-- ES-Plus 配置化组件 -->
          <a-sub-menu key="esplus-group">
            <template #icon><ThunderboltOutlined /></template>
            <template #title>ES-Plus 配置化组件</template>

            <a-menu-item key="es-form">
              <span>EsForm 动态表单</span>
            </a-menu-item>
            <a-menu-item key="es-table">
              <span>EsTable 动态表格</span>
            </a-menu-item>
            <a-menu-item key="es-dialog">
              <span>EsDialog 动态弹窗</span>
            </a-menu-item>
            <a-menu-item key="es-crud-page">
              <span>EsCrudPage CRUD页面</span>
            </a-menu-item>
            <a-menu-item key="advanced">
              <span>高级联动</span>
            </a-menu-item>
          </a-sub-menu>

          <!-- vxe 高性能引擎 -->
          <a-menu-item key="es-vxe-table">
            <template #icon><ThunderboltOutlined /></template>
            <span>vxe 高性能引擎</span>
          </a-menu-item>

          <!-- AI 工具链 -->
          <a-menu-item key="ai-tools">
            <template #icon><RobotOutlined /></template>
            <span>AI 工具链</span>
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <!-- 内容区域 -->
      <a-layout-content class="doc-content">
        <div class="content-wrapper">
          <router-view />
        </div>

        <a-layout-footer class="doc-footer">
          <a-divider />
          <div class="footer-info">
            <span>ES-Plus ©2026 Created by 刘加傲</span>
            <span>Powered by Vue 3 + Vite + Ant Design Vue</span>
          </div>
        </a-layout-footer>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  BookOutlined,
  GithubOutlined,
  HomeOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  RobotOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()

// 根据当前路由设置 selectedKeys
const routeNameToMenuKey = (name) => {
  const map = {
    'Home': 'home',
    'Guide': 'guide',
    'EsForm': 'es-form',
    'EsTable': 'es-table',
    'EsDialog': 'es-dialog',
    'EsCrudPage': 'es-crud-page',
    'Advanced': 'advanced',
  }
  return map[name] || 'home'
}

const selectedKeys = ref([routeNameToMenuKey(route.name)])
const openKeys = ref(['esplus-group'])

// ES-Plus 路由映射
const esPlusRoutes = ['es-form', 'es-table', 'es-dialog', 'es-crud-page', 'advanced']

function handleMenuClick({ key }) {
  if (key === 'home') {
    router.push('/')
  } else if (key === 'guide') {
    router.push('/guide')
  } else if (esPlusRoutes.includes(key)) {
    router.push(`/${key}`)
  }
}
</script>

<style scoped>
.doc-layout {
  min-height: 100vh;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 24px;
  height: 64px;
  line-height: 64px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left .logo-icon {
  font-size: 24px;
  color: #1677ff;
}

.header-left .logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.header-right {
  display: flex;
  align-items: center;
}

.doc-body {
  margin-top: 0;
}

.doc-sider {
  background: #fff;
  border-right: 1px solid #f0f0f0;
  height: calc(100vh - 64px);
  position: sticky;
  top: 64px;
  overflow-y: auto;
}

.doc-content {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: #f5f5f5;
}

.content-wrapper {
  max-width: 1200px;
  background: #fff;
  border-radius: 8px;
  padding: 32px;
  min-height: calc(100vh - 200px);
}

.doc-footer {
  max-width: 1200px;
  padding: 0 32px 24px;
  background: transparent;
}

.footer-info {
  display: flex;
  justify-content: space-between;
  color: #999;
  font-size: 13px;
}
</style>
