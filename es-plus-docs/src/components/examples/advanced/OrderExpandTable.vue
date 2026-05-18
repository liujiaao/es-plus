<template>
  <div class="example-order-expand">
    <es-table
      :data-source="orderData"
      :columns="orderColumns"
      :options="{ expand: true, border: true }"
    >
      <template #expand="{ row }">
        <div class="expand-wrapper">
          <es-table
            :data-source="row.items"
            :columns="itemColumns"
            :options="itemTableOptions"
          />
        </div>
      </template>
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { EsTable } from 'es-plus'
import { ref } from 'vue'
import { ElTag } from 'element-plus'

const statusMap = {
  pending: { text: '待付款', type: 'warning' },
  paid: { text: '已付款', type: '' },
  shipped: { text: '已发货', type: 'success' },
  completed: { text: '已完成', type: 'success' }
}

const orderData = ref([
  {
    id: 'ORD001', customer: '张三', date: '2024-03-15', status: 'paid', total: 6798,
    items: [
      { name: 'iPhone 15', price: 5999, quantity: 1, subtotal: 5999 },
      { name: '手机壳', price: 99, quantity: 2, subtotal: 198 },
      { name: '充电器', price: 299, quantity: 2, subtotal: 598 }
    ]
  },
  {
    id: 'ORD002', customer: '李四', date: '2024-03-14', status: 'shipped', total: 12599,
    items: [
      { name: 'MacBook Air', price: 8999, quantity: 1, subtotal: 8999 },
      { name: '鼠标', price: 349, quantity: 1, subtotal: 349 },
      { name: '键盘', price: 699, quantity: 1, subtotal: 699 },
      { name: '扩展坞', price: 552, quantity: 1, subtotal: 552 }
    ]
  },
  {
    id: 'ORD003', customer: '王五', date: '2024-03-13', status: 'pending', total: 2198,
    items: [
      { name: 'AirPods Pro', price: 1599, quantity: 1, subtotal: 1599 },
      { name: '保护壳', price: 149, quantity: 1, subtotal: 149 },
      { name: '耳塞套装', price: 450, quantity: 1, subtotal: 450 }
    ]
  },
  {
    id: 'ORD004', customer: '赵六', date: '2024-03-12', status: 'completed', total: 459,
    items: [
      { name: '小米手环', price: 249, quantity: 1, subtotal: 249 },
      { name: '数据线', price: 35, quantity: 3, subtotal: 105 },
      { name: '充电头', price: 105, quantity: 1, subtotal: 105 }
    ]
  }
])

const orderColumns = [
  { type: 'expand', width: 50, scopedSlots: { customRender: 'expand' } },
  { prop: 'id', label: '订单号', width: 120 },
  { prop: 'customer', label: '客户' },
  { prop: 'date', label: '日期', width: 120 },
  {
    prop: 'status', label: '状态', width: 100,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return <ElTag type={s.type} size="small">{s.text}</ElTag>
    }
  },
  { prop: 'total', label: '总金额', width: 120, formatter: (r) => `¥${r.total.toLocaleString()}` }
]

const itemColumns = [
  { prop: 'name', label: '商品名称', minWidth: 180 },
  { prop: 'price', label: '单价', width: 100, formatter: (r) => `¥${r.price}` },
  { prop: 'quantity', label: '数量', width: 80 },
  { prop: 'subtotal', label: '小计', width: 100, formatter: (r) => `¥${r.subtotal.toLocaleString()}` }
]

const itemTableOptions = {
  border: true,
  size: 'small',
  showSummary: true,
  summaryMethod: ({ columns, data }) => {
    return columns.map((col, index) => {
      if (index === 0) return '合计'
      if (col.property === 'quantity') return data.reduce((sum, r) => sum + (r.quantity || 0), 0)
      if (col.property === 'subtotal') return `¥${data.reduce((sum, r) => sum + (r.subtotal || 0), 0).toLocaleString()}`
      return ''
    })
  }
}
</script>

<style scoped>
.example-order-expand {
  padding: 0;
}
.expand-wrapper {
  padding: 12px 20px;
  background: #fafafa;
}
</style>
