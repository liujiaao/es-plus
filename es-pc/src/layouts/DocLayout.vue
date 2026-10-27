<template>
  <a-layout class="doc-layout">
    <!-- 顶部导航 -->
    <a-layout-header class="doc-header">
      <div class="header-left">
        <!-- 窄屏抽屉开关：与侧栏的 collapsed 同一个状态，两处指同一件事 -->
        <a-button
          class="nav-toggle"
          type="text"
          aria-label="菜单"
          @click="siderCollapsed = !siderCollapsed"
        >
          <MenuOutlined />
        </a-button>
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
            <a-button type="link" class="site-switcher-btn" aria-label="切换站点">
              <template #icon><SwapOutlined /></template>
              <span class="site-label-text">{{ currentSiteLabel }}</span>
            </a-button>
            <template #overlay>
              <a-menu :selectable="false" @click="switchSite">
                <a-menu-item v-for="s in SITES" :key="s.key">
                  <span>{{ s.key === currentSite ? '✓ ' : '' }}{{ s.label }}</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <a-button type="link" class="github-btn" href="https://github.com/liujiaao/es-plus" target="_blank">
            <GithubOutlined /><span class="github-text"> GitHub</span>
          </a-button>
          <a-button type="primary" size="small" class="version-btn">v{{ adapterVersion }}</a-button>
        </a-space>
      </div>
    </a-layout-header>

    <a-layout class="doc-body">
      <!-- 侧边栏：窄屏收成抽屉（collapsed-width=0），开关在顶栏左侧 -->
      <a-layout-sider
        v-model:collapsed="siderCollapsed"
        class="doc-sider"
        width="260"
        :collapsed-width="0"
        breakpoint="lg"
        :trigger="null"
      >
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

          <!-- 一句话生成的产物页：模型只写 schema，三站加载同一份字节 -->
          <a-menu-item key="ai-generated">
            <template #icon><RobotOutlined /></template>
            <router-link to="/ai-generated" class="menu-link">AI 生成 · 一句话成页</router-link>
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
            <a-menu-item key="es-error-boundary">
              <router-link to="/es-error-boundary" class="menu-link">EsErrorBoundary 错误边界</router-link>
            </a-menu-item>
            <a-menu-item key="svg-icon">
              <router-link to="/svg-icon" class="menu-link">SvgIcon 图标</router-link>
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
            <!-- 三站页脚同一结构：品牌 · 定位 ／ © 年份 · 本站渲染端 -->
            <span class="footer-brand">ES-Plus · {{ brand.positioning }}</span>
            <span class="footer-meta">© {{ year }} · Ant Design Vue 渲染端</span>
          </div>
        </a-layout-footer>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  // 不再引入 BookOutlined：它此前被当作本站 logo，现已换成统一的「ES」品牌标记
  GithubOutlined,
  MenuOutlined,
  HomeOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  RobotOutlined,
  SwapOutlined,
  TrophyOutlined,
} from '@ant-design/icons-vue'
import { ADAPTER_ANTDV_VERSION } from '@/utils/versions'
// 品牌文案单一真源：由 scripts/sync-brand.mjs 从 docs/brand/slogan.json 分发
import brand from '@/brand/slogan.json'
// 三端站点清单：与案例卡跨端互链共用一份（见 utils/sites.js 的说明）
import { SITES, SITE_KEY } from '@/utils/sites'

const year = new Date().getFullYear()

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
    'AiGenerated': 'ai-generated',
    'Guide': 'guide',
    'EsForm': 'es-form',
    'EsTable': 'es-table',
    'EsDialog': 'es-dialog',
    'EsCrudPage': 'es-crud-page',
    'EsErrorBoundary': 'es-error-boundary',
    'SvgIcon': 'svg-icon',
    'Advanced': 'advanced',
    'EsVxeTable': 'es-vxe-table',
    'AiTools': 'ai-tools',
  }
  return map[name] || 'home'
}

const selectedKeys = ref([routeNameToMenuKey(route.name)])
const openKeys = ref(['components-group', 'advanced-group'])

// 窄屏抽屉：宽屏下侧栏常驻（a-layout-sider 的 breakpoint="lg" 在 >=992px 会自动展开），
// 点菜单跳转后收起，否则抽屉会遮住刚打开的页面。
const siderCollapsed = ref(false)
watch(() => route.fullPath, () => {
  if (window.matchMedia('(max-width: 991px)').matches) siderCollapsed.value = true
})
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
  max-width: calc(var(--es-layout-max) - var(--es-sidebar-width));
  background: #fff;
  border-radius: 8px;
  padding: 32px;
  min-height: calc(100vh - 200px);
}

.doc-footer {
  max-width: calc(var(--es-layout-max) - var(--es-sidebar-width));
  padding: 0 32px 24px;
  background: transparent;
}

.footer-info {
  display: flex;
  justify-content: space-between;
  color: #999;
  font-size: 13px;
}

/* 抽屉开关：宽屏常驻侧栏时不需要它 */
.nav-toggle {
  display: none;
}

/* 窄屏（<992px，与 a-layout-sider 的 breakpoint="lg" 对齐）：
   侧栏改为浮层抽屉，正文占满；顶栏只留品牌、开关与切站图标。 */
@media (max-width: 991px) {
  .nav-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
    font-size: 18px;
  }

  .doc-header {
    padding: 0 12px;
    height: 56px;
    line-height: 56px;
  }

  .header-left .logo-text {
    display: none;
  }

  /* 抽屉：脱离文档流，避免 260px 侧栏把正文压成一条缝 */
  .doc-sider {
    position: fixed;
    left: 0;
    top: 56px;
    bottom: 0;
    z-index: 90;
    height: auto;
    box-shadow: 2px 0 16px rgba(0, 0, 0, 0.12);
  }

  /* 收起时宽度为 0，阴影会变成一条压在正文左缘的暗线 */
  .doc-sider.ant-layout-sider-collapsed {
    box-shadow: none;
  }

  .doc-content {
    padding: 12px;
  }

  .content-wrapper {
    padding: 16px;
  }

  .doc-footer {
    padding: 0 16px 16px;
  }

  .footer-info {
    flex-direction: column;
    gap: 4px;
  }

  /* 顶栏右键组在 390px 下原本超出视口 37px（页面因此横向滚动）：
     切站只留图标（完整名称在下拉里），版本号让位。 */
  .site-label-text,
  .version-btn {
    display: none;
  }
}

@media (max-width: 576px) {
  .github-text {
    display: none;
  }
}
</style>
