<template>
  <div class="example-table-remote">
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

// 模拟异步请求
const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 10 } = params || {}
  const total = 100
  const data = Array.from({ length: Math.min(pageSize, total - (pageIndex - 1) * pageSize) }, (_, i) => ({
    id: (pageIndex - 1) * pageSize + i + 1,
    name: `用户${(pageIndex - 1) * pageSize + i + 1}`,
    email: `user${(pageIndex - 1) * pageSize + i + 1}@example.com`,
    status: ['active', 'inactive'][i % 2]
  }))
  return { data, total, pageSize, pageIndex }
}

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'email', label: '邮箱', minWidth: 180 },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    render: (_, { row }) => {
      const type = row.status === 'active' ? 'success' : 'info'
      return h(ElTag, { type, size: 'small' }, () => row.status === 'active' ? '活跃' : '不活跃')
    }
  }
]

const tableOptions = {
  border: true,
  stripe: true,
  actionUrl: '/api/users',
  httpRequest: mockRequest,
  apiParams: {
    url: '/api/users',
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
.example-table-remote {
  padding: 0;
}
</style>
