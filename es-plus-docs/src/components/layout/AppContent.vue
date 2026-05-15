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
  min-height: calc(100vh - var(--header-height));
  background-color: var(--bg-color-page);
}

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
