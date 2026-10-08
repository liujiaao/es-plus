<script setup lang="ts">
import type { CrudPageSchema } from '@es-plus/adapter-antdv'
import schema from './demo.config.json'

// 零后端示例数据。真实项目把 fetchList 换成你的接口即可。
const products = [
  { name: 'ES-Plus T 恤', price: 99, status: 1 },
  { name: 'ES-Plus 马克杯', price: 49, status: 1 },
  { name: 'ES-Plus 贴纸', price: 9, status: 0 },
]

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
</script>

<template>
  <es-crud-page :schema="(schema as CrudPageSchema)" :http-request="fetchList" />
</template>
