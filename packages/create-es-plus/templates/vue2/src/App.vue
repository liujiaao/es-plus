<script lang="ts">
import { defineComponent } from 'vue'
import DemoCrud from './views/DemoCrud.vue'

export default defineComponent({
  components: { DemoCrud },
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>ES-Plus · Vue 2 + Element UI</h1>
      <p>这一页由一份配置驱动。改 <code>src/views/demo.config.json</code> 看三端一致如何工作。</p>
    </header>
    <main class="app-main">
      <DemoCrud />
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #1f2937;
}
.app-header {
  padding: 24px 32px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.app-header h1 {
  margin: 0 0 4px;
  font-size: 20px;
}
.app-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}
.app-header code {
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 4px;
}
.app-main {
  padding: 24px 32px;
}
</style>
