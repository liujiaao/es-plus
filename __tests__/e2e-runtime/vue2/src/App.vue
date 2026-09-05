<template>
  <div style="padding: 16px">
    <!-- F2 触发按钮：令下一次列表请求失败一次，再走 EsCrudPage.refresh() -->
    <button data-test="fail-refresh" style="margin-bottom: 12px" @click="triggerFailRefresh">强制失败刷新</button>
    <es-crud-page ref="crud" :schema="schema" :http-request="backend.httpRequest" />
  </div>
</template>

<script>
import { createInMemoryBackend } from './backend'
import { makeSchema } from './schema'

// Tier 2 fixture 根组件：真实 <es-crud-page> + 内存后端注入到 httpRequest 缝。
// backend 挂到 window.__backend，供 Playwright spec 读取 calls 计数做断言。
// 另外挂两个观测点供 F2 断言：
//   window.__unhandled     —— 全局未捕获的 promise rejection（应始终为空）
//   window.__requestErrors —— EsTable emit('request-error') 收集到的错误信息
export default {
  name: 'App',
  data() {
    const backend = createInMemoryBackend([
      { id: 1, name: 'Alice', score: 0, info: { city: 'Beijing' } },
      { id: 2, name: 'Bob', score: 99, info: { city: 'Shanghai' } },
    ])
    window.__backend = backend
    window.__unhandled = []
    window.__requestErrors = []
    return {
      backend,
      schema: makeSchema(backend),
    }
  },
  created() {
    this._onUnhandled = (e) => {
      window.__unhandled.push(String((e.reason && e.reason.message) || e.reason))
    }
    window.addEventListener('unhandledrejection', this._onUnhandled)
  },
  mounted() {
    // EsCrudPage 不转发内部表格的 request-error；这里经 exposed tableRef 直接监听，
    // 供 F2 断言「失败已被暴露」。
    const table = this.$refs.crud && this.$refs.crud.tableRef
    if (table && typeof table.$on === 'function') {
      table.$on('request-error', (err) => {
        window.__requestErrors.push(String((err && err.message) || err))
      })
    }
  },
  beforeDestroy() {
    window.removeEventListener('unhandledrejection', this._onUnhandled)
  },
  methods: {
    triggerFailRefresh() {
      // 下一次列表请求失败一次，随后命令式 refresh：验证失败被暴露且不冒泡成 unhandled rejection
      this.backend.failNextList()
      const crud = this.$refs.crud
      if (crud && typeof crud.refresh === 'function') crud.refresh()
    },
  },
}
</script>
