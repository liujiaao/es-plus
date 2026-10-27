<template>
  <!-- id + tabindex 是 skip link 的落点：没有 tabindex，浏览器只会滚到这里，
       焦点仍留在链接上，再按 Tab 又回到导航。 -->
  <main id="es-main" tabindex="-1" class="app-content">
    <div class="content-wrapper">
      <slot />
    </div>
  </main>
</template>

<style lang="scss" scoped>
@use '../../styles/breakpoints' as bp;

.app-content {
  margin-left: var(--es-sidebar-width);
  padding-top: var(--header-height);
  min-height: 100vh;
  background-color: var(--bg-color-page);
}

/* 横向留白由各页面自行控制（文本页留白，Home 等落地页需全屏出血），
   这里保持 0，只负责固定头部的顶部避让与外壳最大宽度居中。
   1400 → var(--es-layout-max)：与另两站同一条外壳上限（docs/theme/docs-layout.css）。 */
.content-wrapper {
  max-width: var(--es-layout-max);
  margin: 0 auto;
  padding: 0;
}

// 与 AppHeader / AppSidebar 同一切换点：侧栏收起为抽屉时，正文立刻放掉左缩进
@media (max-width: bp.$nav-collapse) {
  .app-content {
    margin-left: 0;
  }
}
</style>
