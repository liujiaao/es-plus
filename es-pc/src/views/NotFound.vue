<template>
  <div class="not-found">
    <a-result status="404" title="404" sub-title="这个地址在本站没有对应页面。">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="$router.push('/')">回到首页</a-button>
          <a-button @click="$router.push('/es-form')">浏览组件</a-button>
        </a-space>
      </template>
    </a-result>
    <p class="hint">
      完整文档（含指南、三端通用对比与 AI 工具链）在主文档站：
      <a href="https://liujiaao.github.io/es-plus/" target="_blank" rel="noopener">
        liujiaao.github.io/es-plus
      </a>
    </p>
  </div>
</template>

<script setup>
/**
 * 404 兜底页。
 *
 * 此前本站**没有** pathMatch 兜底路由 —— vue-router 匹配不到就什么都不渲染，
 * 表现是整页空白（连「找不到页面」都看不到）。案例目录这类跨站链接一旦写错
 * （例如 L2 头号案例的 antdv 链接曾写成 "/" 或指向别站路径），用户看到的就是白屏。
 * 有了这一页，写错的链接至少能被看出来。
 */
</script>

<style scoped>
.not-found {
  padding: 60px 24px;
  max-width: 720px;
  margin: 0 auto;
}

.hint {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: #999;
}
</style>
