<template>
  <div class="docs-page">
    <!-- 左侧导航 -->
    <aside class="side-nav">
      <div class="nav-group">
        <div class="nav-title">
          开发指南
        </div>
        <router-link
          to="/component/installation"
          class="nav-item"
        >
          安装
        </router-link>
        <router-link
          to="/component/quickstart"
          class="nav-item"
        >
          快速上手
        </router-link>
      </div>
      <div class="nav-group">
        <div class="nav-title">
          组件
        </div>
        <router-link
          to="/component/estable"
          class="nav-item"
        >
          EsTable 表格
        </router-link>
        <router-link
          to="/component/vxetable"
          class="nav-item"
        >
          高性能 vxe-table 表格
        </router-link>
        <router-link
          to="/component/esform"
          class="nav-item"
        >
          EsForm 表单
        </router-link>
        <router-link
          to="/component/esdialog"
          class="nav-item"
        >
          useDialog 弹窗
        </router-link>
        <router-link
          to="/component/combination"
          class="nav-item"
        >
          组合联动
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
  name: 'ComponentLayout'
}
</script>
