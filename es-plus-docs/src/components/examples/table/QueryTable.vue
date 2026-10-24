<template>
  <div class="example-query-table">
    <es-table
      v-model:data-source="tableData"
      v-model:pagination="pagination"
      :columns="columns"
      :options="tableOptions"
    >
      <!--
        查询区同样是「配置」：字段数组 → 表单，按钮 key=query/rest + triggerEvent → 自动联动表格。
        整页没有 handleSearch / handleReset 之类的胶水代码。
      -->
      <es-form
        :model="query"
        :form-item-list="queryItems"
        :config-btn="queryBtns"
        :layout-form-props="layoutProps"
      />
    </es-table>
  </div>
</template>

<script setup>
import { EsForm, EsTable } from '@es-plus/vue3'
import { ref, reactive, h } from 'vue'
import { ElTag } from 'element-plus'

const tableData = ref([])
const query = reactive({ keyword: '', status: '' })
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
  paid: { text: '已付款', type: 'primary' },
  shipped: { text: '已发货', type: 'success' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' }
}

// 查询表单：一个字段一行配置
const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '订单号/客户名', clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions, attrs: { placeholder: '全部状态', clearable: true } }
]

// 按钮即联动：key=query 触发查询（回到第 1 页），key=rest 重置字段并刷新
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true }
]

const layoutProps = { formLayProps: { labelWidth: '60px' }, rowLayProps: { gutter: 16 } }

// 模拟后端接口（真实项目里换成 httpRequest，或直接给 apiParams.url）
// 注意参数分层：分页在顶层（pageIndex/pageSize），表单搜索值在 formParams 里
const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 10, formParams = {} } = params || {}
  const { keyword, status } = formParams
  const allData = Array.from({ length: 86 }, (_, i) => ({
    id: 1001 + i,
    orderNo: `ORD-2024-${String(i + 1).padStart(3, '0')}`,
    customer: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
    amount: [2580, 1299, 6800, 450, 15200][i % 5],
    status: ['pending', 'paid', 'shipped', 'completed', 'cancelled'][i % 5],
    date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`
  }))
  let filtered = allData
  if (keyword) filtered = filtered.filter((d) => d.orderNo.includes(keyword) || d.customer.includes(keyword))
  if (status) filtered = filtered.filter((d) => d.status === status)
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

// apiParams.model 自动把查询条件并入每次请求（分页参数由表格注入）
const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/orders', method: 'GET', model: query },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
</script>

<style scoped>
.example-query-table {
  padding: 0;
}
</style>
