<template>
  <div class="docs-page">
    <!-- 左侧导航 -->
    <aside class="side-nav">
      <div class="nav-group">
        <div class="nav-title">
          开发指南
        </div>
        <router-link
          to="/guide"
          class="nav-item"
          exact
        >
          介绍
        </router-link>
        <router-link
          to="/guide/quickstart"
          class="nav-item"
        >
          快速上手
        </router-link>
        <router-link
          to="/guide/installation"
          class="nav-item"
        >
          安装
        </router-link>
        <router-link
          to="/guide/configuration"
          class="nav-item"
        >
          全局配置
        </router-link>
      </div>
      <div class="nav-group">
        <div class="nav-title">
          进阶
        </div>
        <router-link
          to="/guide/theme"
          class="nav-item"
        >
          自定义主题
        </router-link>
        <router-link
          to="/guide/i18n"
          class="nav-item"
        >
          国际化
        </router-link>
        <router-link
          to="/guide/developer-guide"
          class="nav-item"
        >
          开发者完全指南
        </router-link>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <div class="content es-doc-content">
      <router-view />
    </div>
  </div>
</template>

<script>
export default {
  name: 'GuideLayout'
}
</script>
