<template>
  <div class="example-pagination-table">
    <es-table
      v-model:data-source="tableData"
      v-model:pagination="pagination"
      :columns="columns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup>
import { ref, h } from 'vue'
import { ElTag } from 'element-plus'
import EsTable from 'es-plus/components/es-table'

const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0, pageSizes: [5, 10, 20] })

const httpRequest = async (params) => {
  const pageIndex = params.pageIndex || 1
  const pageSize = params.pageSize || 10
  const start = (pageIndex - 1) * pageSize
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts?_start=${start}&_limit=${pageSize}`
  )
  const data = await response.json()
  const total = parseInt(response.headers.get('x-total-count') || '100')
  return { data, total, pageSize, pageIndex }
}

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'title', label: '标题', minWidth: 200, align: 'left' },
  {
    prop: 'body',
    label: '内容',
    minWidth: 250,
    align: 'left',
    formatter: (row) => row.body?.length > 60 ? row.body.substring(0, 60) + '...' : row.body
  },
  {
    prop: 'userId',
    label: '用户',
    width: 100,
    render: (_, { row }) => h(ElTag, { size: 'small' }, () => `用户${row.userId}`)
  }
]

const tableOptions = {
  border: true,
  // stripe: true,
  height: 400,
  heightType: 'height',
  // actionUrl: 'https://jsonplaceholder.typicode.com/posts',
  httpRequest,
  apiParams: {
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'GET'
  },
  configTableOut: {
    total: 'total',
    tableData: 'data',
    pageSize: 'pageSize',
    current: 'pageIndex'
  }
}
</script>

<style scoped>
.example-pagination-table {
  padding: 0;
}
</style>
