<template>
  <main class="app-content">
    <div class="content-wrapper">
      <slot />
    </div>
  </main>
</template>

<style lang="scss" scoped>
.app-content {
  margin-left: 260px;
  padding-top: var(--header-height);
  min-height: 100vh;
  background-color: var(--bg-color-page);
}

/* 横向留白由各页面自行控制（文本页留白，Home 等落地页需全屏出血），
   这里保持 0，只负责固定头部的顶部避让与 1400 最大宽度居中。 */
.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

@media (max-width: 768px) {
  .app-content {
    margin-left: 0;
  }
}
</style>
