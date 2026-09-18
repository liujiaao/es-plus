<template>
  <div class="not-found">
    <div class="nf-code">404</div>
    <p class="nf-desc">这个地址在本站没有对应页面。</p>
    <div class="nf-actions">
      <el-button type="primary" @click="$router.push('/')">回到首页</el-button>
      <el-button @click="$router.push('/component/esform')">浏览组件</el-button>
    </div>
    <p class="nf-hint">
      完整文档（含指南、三端通用对比与 AI 工具链）在主文档站：
      <a href="https://liujiaao.github.io/es-plus/" target="_blank" rel="noopener">
        liujiaao.github.io/es-plus
      </a>
    </p>
  </div>
</template>

<script>
/**
 * 404 兜底页。
 *
 * 此前本站路由表没有通配兜底 —— vue-router（hash 模式）匹配不到就什么都不渲染，
 * 表现是整页空白。跨站链接（见 docs/cases/cases.json）写错时用户看到的就是白屏。
 */
export default {
  name: 'NotFound'
}
</script>

<style scoped>
.not-found {
  max-width: 640px;
  margin: 0 auto;
  padding: 90px 24px;
  text-align: center;
}

.nf-code {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--es-brand-primary);
}

.nf-desc {
  margin: 12px 0 24px;
  font-size: 15px;
  color: #718096;
}

.nf-actions {
  margin-bottom: 20px;
}

.nf-hint {
  font-size: 13px;
  color: #718096;
}

.nf-hint a {
  color: var(--es-brand-primary);
}
</style>
