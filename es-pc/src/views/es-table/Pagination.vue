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
import { EsTable } from '@es-plus/adapter-antdv'
import { ref, h } from 'vue'
import { Tag } from 'ant-design-vue'
import { fetchPostsPaginated } from '@/utils/mock-api'

const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0, pageSizes: [5, 10, 20] })

// 站内本地 mock：不直连 jsonplaceholder，断网/被墙时也能正常分页，不会静默空白
const httpRequest = (params) => {
  const pageIndex = params.pageIndex || 1
  const pageSize = params.pageSize || 10
  return fetchPostsPaginated({ pageIndex, pageSize })
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
    render: (_, { row }) => h(Tag, { size: 'small' }, () => `用户${row.userId}`)
  }
]

const tableOptions = {
  border: true,
  // stripe: true,
  height: 400,
  heightType: 'height',
  httpRequest,
  // 真实项目指向后端分页接口；本示例由 httpRequest 返回本地 mock
  apiParams: {
    url: '/api/mock/posts',
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
