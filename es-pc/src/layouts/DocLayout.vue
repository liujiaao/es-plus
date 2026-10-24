<template>
  <a-layout class="doc-layout">
    <!-- 顶部导航 -->
    <a-layout-header class="doc-header">
      <div class="header-left">
        <a-space align="center" :size="12">
          <!-- 品牌标记：此前这里用的是 Ant Design Vue 的 BookOutlined 图标 ——
               拿第三方 UI 库的图标当自己的 logo，另两站用的是「ES」方块，
               同一个产品三处标记各不相同。统一为「ES」方块（配色走品牌 token）。 -->
          <span class="logo-mark">ES</span>
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
        <!-- 每个条目都用 <router-link> 承载：<a-menu-item> 渲染出来是 <li>，
             只靠 @click + router.push 的话，这里根本没有 <a href> —— 右键
             「在新标签页打开」、复制链接、搜索引擎抓取全都拿不到地址。 -->
        <a-menu
          v-model:selectedKeys="selectedKeys"
          v-model:openKeys="openKeys"
          mode="inline"
          :style="{ borderInlineEnd: 'none' }"
        >
          <!-- 概览 -->
          <a-menu-item key="home">
            <template #icon><HomeOutlined /></template>
            <router-link to="/" class="menu-link">首页</router-link>
          </a-menu-item>

          <!-- 核心案例（L1–L5 场景化梯度） -->
          <a-menu-item key="cases">
            <template #icon><ThunderboltOutlined /></template>
            <router-link to="/cases" class="menu-link">核心案例</router-link>
          </a-menu-item>

          <!-- 旗舰案例：一份纯 JSON 的完整审批闭环（三站同源） -->
          <a-menu-item key="flagship-approval">
            <template #icon><TrophyOutlined /></template>
            <router-link to="/flagship-approval" class="menu-link">旗舰案例 · 合同审批</router-link>
          </a-menu-item>

          <!-- 快速上手 -->
          <a-menu-item key="guide">
            <template #icon><RocketOutlined /></template>
            <router-link to="/guide" class="menu-link">快速上手</router-link>
          </a-menu-item>

          <!-- 组件 -->
          <a-sub-menu key="components-group">
            <template #icon><ThunderboltOutlined /></template>
            <template #title>组件</template>

            <a-menu-item key="es-form">
              <router-link to="/es-form" class="menu-link">EsForm 动态表单</router-link>
            </a-menu-item>
            <a-menu-item key="es-table">
              <router-link to="/es-table" class="menu-link">EsTable 动态表格</router-link>
            </a-menu-item>
            <a-menu-item key="es-dialog">
              <router-link to="/es-dialog" class="menu-link">EsDialog 动态弹窗</router-link>
            </a-menu-item>
            <a-menu-item key="es-crud-page">
              <router-link to="/es-crud-page" class="menu-link">EsCrudPage CRUD页面</router-link>
            </a-menu-item>
          </a-sub-menu>

          <!-- 高级 -->
          <a-sub-menu key="advanced-group">
            <template #icon><ExperimentOutlined /></template>
            <template #title>高级</template>

            <a-menu-item key="advanced">
              <router-link to="/advanced" class="menu-link">高级联动</router-link>
            </a-menu-item>
            <a-menu-item key="es-vxe-table">
              <router-link to="/es-vxe-table" class="menu-link">vxe 高性能引擎</router-link>
            </a-menu-item>
          </a-sub-menu>

          <!-- AI 工具链 -->
          <a-menu-item key="ai-tools">
            <template #icon><RobotOutlined /></template>
            <router-link to="/ai-tools" class="menu-link">AI 工具链</router-link>
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
import { useRoute } from 'vue-router'
import {
  // 不再引入 BookOutlined：它此前被当作本站 logo，现已换成统一的「ES」品牌标记
  GithubOutlined,
  HomeOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  RobotOutlined,
  SwapOutlined,
  TrophyOutlined,
} from '@ant-design/icons-vue'
import { ADAPTER_ANTDV_VERSION } from '@/utils/versions'
// 三端站点清单：与案例卡跨端互链共用一份（见 utils/sites.js 的说明）
import { SITES, SITE_KEY } from '@/utils/sites'

const adapterVersion = ADAPTER_ANTDV_VERSION
const route = useRoute()

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
    'FlagshipApproval': 'flagship-approval',
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

/* 与另两站的「ES」方块对齐：品牌主色 → 强调色的渐变、圆角、白色粗体字。
   （此前这里是 BookOutlined 图标的字号/颜色样式） */
.header-left .logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.28);
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

  /* 菜单条目里的真实链接：铺满整行，颜色/下划线继承菜单样式 */
  .menu-link {
    display: block;
    color: inherit;
    text-decoration: none;

    &:hover {
      color: inherit;
    }
  }
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
