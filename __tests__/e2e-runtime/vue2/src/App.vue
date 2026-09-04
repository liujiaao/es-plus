<template>
  <div style="padding: 16px">
    <es-crud-page :schema="schema" :http-request="backend.httpRequest" />
  </div>
</template>

<script>
import { createInMemoryBackend } from './backend'
import { makeSchema } from './schema'

// Tier 2 fixture 根组件：真实 <es-crud-page> + 内存后端注入到 httpRequest 缝。
// backend 挂到 window.__backend，供 Playwright spec 读取 calls 计数做断言。
export default {
  name: 'App',
  data() {
    const backend = createInMemoryBackend([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])
    window.__backend = backend
    return {
      backend,
      schema: makeSchema(backend),
    }
  },
}
</script>
