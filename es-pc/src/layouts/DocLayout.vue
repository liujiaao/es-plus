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
          <a-dropdown :trigger="['click']">
            <a-button type="link" class="site-switcher-btn">
              <template #icon><SwapOutlined /></template>
              {{ currentSiteLabel }}
            </a-button>
            <template #overlay>
              <a-menu :selectable="false" @click="switchSite">
                <a-menu-item v-for="s in SITES" :key="s.key">
                  <span>{{ s.key === currentSite ? '✓ ' : '' }}{{ s.label }}</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <a-button type="link" href="https://github.com/liujiaao/es-plus" target="_blank">
            <GithubOutlined /> GitHub
          </a-button>
          <a-button type="primary" size="small">v{{ adapterVersion }}</a-button>
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

          <!-- 核心案例（L1–L5 场景化梯度） -->
          <a-menu-item key="cases">
            <template #icon><ThunderboltOutlined /></template>
            <span>核心案例</span>
          </a-menu-item>

          <!-- 快速上手 -->
          <a-menu-item key="guide">
            <template #icon><RocketOutlined /></template>
            <span>快速上手</span>
          </a-menu-item>

          <!-- 组件 -->
          <a-sub-menu key="components-group">
            <template #icon><ThunderboltOutlined /></template>
            <template #title>组件</template>

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
          </a-sub-menu>

          <!-- 高级 -->
          <a-sub-menu key="advanced-group">
            <template #icon><ExperimentOutlined /></template>
            <template #title>高级</template>

            <a-menu-item key="advanced">
              <span>高级联动</span>
            </a-menu-item>
            <a-menu-item key="es-vxe-table">
              <span>vxe 高性能引擎</span>
            </a-menu-item>
          </a-sub-menu>

          <!-- AI 工具链 -->
          <a-menu-item key="ai-tools">
            <template #icon><RobotOutlined /></template>
            <span>AI 工具链</span>
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <!-- 内容区域 -->
      <a-layout-content class="doc-content">
        <div class="content-wrapper es-doc-content">
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
  ExperimentOutlined,
  RobotOutlined,
  SwapOutlined,
} from '@ant-design/icons-vue'
import { ADAPTER_ANTDV_VERSION } from '@/utils/versions'

const adapterVersion = ADAPTER_ANTDV_VERSION
const router = useRouter()
const route = useRoute()

/**
 * 三端站点切换器。
 *
 * `SITES` 是三站共同维护的一份列表（内容必须逐字一致，由
 * scripts/check-site-nav.mjs 校验），每项只有一个 `url` —— 即 CI 实际部署到的
 * 那个地址（.github/workflows/deploy-docs.yml 把三站合成一个 Pages 站点：
 * 主站在根、es-pc 在 /es-pc/、es-eui 在 /es-eui/）。
 *
 * 此前这里还有一套腾讯云 EdgeOne 地址，并由 `location.hostname.includes('github.io')`
 * 决定用哪套。问题有两层：那三个 EdgeOne 地址实测已不可用（401 / 不解析），
 * 而凡是拿不到 github.io 的环境（本地 localhost、将来挂的自有域名）都会被判为
 * 「非 GitHub 部署」→ 跳向死链；同一处 hostname 猜测还导致当前站识别错误。
 * 现已收敛为单一地址。
 */
const SITES = [
  { key: 'vue3', label: 'Vue 3 · Element Plus', url: 'https://liujiaao.github.io/es-plus/' },
  { key: 'antdv', label: 'Vue 3 · Ant Design Vue', url: 'https://liujiaao.github.io/es-plus/es-pc/' },
  { key: 'vue2', label: 'Vue 2 · Element UI', url: 'https://liujiaao.github.io/es-plus/es-eui/' },
]

/**
 * 本站身份：直接声明，不再从 hostname/pathname 反推。
 * 反推覆盖不了 localhost、预览环境与将来的自有域名，猜错就会显示错误的当前站
 * 并把用户送去它站的地址。该常量与 SITES/SITE_KEYS 的一致性由
 * scripts/check-site-nav.mjs 校验。
 */
const SITE_KEY = 'antdv'

const currentSite = SITE_KEY
const currentSiteLabel = SITES.find((s) => s.key === currentSite)?.label || '站点'
const switchSite = ({ key }) => {
  const site = SITES.find((s) => s.key === key)
  if (site && key !== currentSite && site.url) {
    window.location.href = site.url
  }
}

// 根据当前路由设置 selectedKeys
const routeNameToMenuKey = (name) => {
  const map = {
    'Home': 'home',
    'QuickStart': 'quickstart',
    'Cases': 'cases',
    'Guide': 'guide',
    'EsForm': 'es-form',
    'EsTable': 'es-table',
    'EsDialog': 'es-dialog',
    'EsCrudPage': 'es-crud-page',
    'Advanced': 'advanced',
    'EsVxeTable': 'es-vxe-table',
    'AiTools': 'ai-tools',
  }
  return map[name] || 'home'
}

const selectedKeys = ref([routeNameToMenuKey(route.name)])
const openKeys = ref(['components-group', 'advanced-group'])

function handleMenuClick({ key }) {
  // 所有子路由均挂载在 DocLayout 的 '/' 下，home 是唯一特例（path 为 ''）
  router.push(key === 'home' ? '/' : `/${key}`)
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
  color: var(--es-brand-primary);
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

.site-switcher-btn {
  padding: 0 4px;
}

.site-current {
  font-weight: 600;
  color: #1677ff;
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
