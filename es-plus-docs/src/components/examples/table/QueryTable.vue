<template>
  <div class="example-query-table">
    <es-table
      ref="tableRef"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
      :columns="columns"
      :options="tableOptions"
    >
      <template #default>
        <div class="search-bar">
          <el-input v-model="searchForm.keyword" placeholder="订单号/客户名" clearable style="width: 180px" />
          <el-select v-model="searchForm.status" placeholder="订单状态" clearable style="width: 130px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
      </template>
    </es-table>
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
import { ref, reactive, h } from 'vue'
import { ElTag } from 'element-plus'

const tableRef = ref()
const tableData = ref([])
const searchForm = reactive({ keyword: '', status: '' })
const pagination = ref({ pageSize: 10, current: 1, total: 0, pageSizes: [5, 10, 20] })

const statusOptions = [
  { label: '待付款', value: 'pending' },
  { label: '已付款', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]
const statusMap = {
  pending: { text: '待付款', type: 'warning' },
  paid: { text: '已付款', type: '' },
  shipped: { text: '已发货', type: 'success' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' }
}

// 模拟后端接口
const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 10, keyword, status } = params || {}
  const allData = Array.from({ length: 86 }, (_, i) => ({
    id: 1001 + i,
    orderNo: `ORD-2024-${String(i + 1).padStart(3, '0')}`,
    customer: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
    amount: [2580, 1299, 6800, 450, 15200][i % 5],
    status: ['pending', 'paid', 'shipped', 'completed', 'cancelled'][i % 5],
    date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`
  }))
  let filtered = allData
  if (keyword) filtered = filtered.filter(d => d.orderNo.includes(keyword) || d.customer.includes(keyword))
  if (status) filtered = filtered.filter(d => d.status === status)
  const total = filtered.length
  const start = (pageIndex - 1) * pageSize
  return { data: filtered.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const columns = [
  { prop: 'orderNo', label: '订单号', width: 140 },
  { prop: 'customer', label: '客户' },
  {
    prop: 'amount',
    label: '金额',
    width: 100,
    formatter: (row) => `¥${row.amount.toLocaleString()}`
  },
  {
    prop: 'status',
    label: '状态',

    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return h(ElTag, { type: s.type, size: 'small' }, () => s.text)
    }
  },
  { prop: 'date', label: '日期', width: 120 }
]

// apiParams.model 自动合并搜索参数到每次请求
const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/orders', method: 'GET', model: searchForm },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}

const handleSearch = () => tableRef.value?.httpRequestInstance()
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  tableRef.value?.httpRequestInstance()
}
</script>

<style scoped>
.example-query-table {
  padding: 0;
}
.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 10px;
}
</style>
