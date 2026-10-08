<script lang="ts">
import { defineComponent } from 'vue'
import type { CrudPageSchema } from '@es-plus/vue2'
import schema from './demo.config.json'

// 零后端示例数据。真实项目把 fetchList 换成你的接口即可。
const products = [
  { name: 'ES-Plus T 恤', price: 99, status: 1 },
  { name: 'ES-Plus 马克杯', price: 49, status: 1 },
  { name: 'ES-Plus 贴纸', price: 9, status: 0 },
]

// Vue 2.7 + @vitejs/plugin-vue2 下用常规 <script lang="ts"> + defineComponent 承载 TS，
// 而不是 <script setup lang="ts">：后者的 TS 类型语法（: Type / as / import type）会被
// plugin-vue2 的 babel 解析器拒绝。vue3 / antdv 模板用 script setup，vue2 这里刻意不同。
export default defineComponent({
  setup() {
    // http-request 约定：返回 { data: 行数组, total: 总数 }（纯数组也可）。
    async function fetchList(params: Record<string, unknown>) {
      const kw = String(params.name ?? '')
      const status = params.status
      const list = products.filter(
        (p) =>
          (!kw || p.name.includes(kw)) &&
          (status === undefined || status === '' || p.status === status),
      )
      return { data: list, total: list.length }
    }
    return { schema: schema as CrudPageSchema, fetchList }
  },
})
</script>

<template>
  <es-crud-page :schema="schema" :http-request="fetchList" />
</template>
