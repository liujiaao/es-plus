<template>
  <div class="example-current-row">
    <div class="master-section">
      <es-table
        ref="masterRef"
        :data-source="orders"
        :columns="masterColumns"
        :options="masterOptions"
        @current-change="handleOrderSelect"
      />
    </div>
    <div class="detail-section">
      <es-table
        :data-source="currentItems"
        :columns="detailColumns"
        :options="detailOptions"
      />
    </div>
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
import { ref, computed, h } from 'vue'
import { ElTag, ElMessage } from 'element-plus'
import { Refresh, Delete } from '@element-plus/icons-vue'

const masterRef = ref()
const currentOrder = ref(null)

const statusMap = {
  paid: { text: '已支付', type: 'success' },
  pending: { text: '待支付', type: 'warning' },
  shipped: { text: '已发货', type: '' }
}

const orders = ref([
  { id: 'ORD-001', customer: '张三', date: '2024-01-15', status: 'paid', amount: 6198 },
  { id: 'ORD-002', customer: '李四', date: '2024-01-14', status: 'pending', amount: 1599 },
  { id: 'ORD-003', customer: '王五', date: '2024-01-13', status: 'shipped', amount: 14397 },
  { id: 'ORD-004', customer: '赵六', date: '2024-01-12', status: 'paid', amount: 899 },
  { id: 'ORD-005', customer: '孙七', date: '2024-01-11', status: 'pending', amount: 3299 }
])

const orderItems = {
  'ORD-001': [
    { product: 'iPhone 15', price: 5999, qty: 1, subtotal: 5999 },
    { product: '手机壳', price: 199, qty: 1, subtotal: 199 }
  ],
  'ORD-002': [
    { product: 'AirPods Pro', price: 1599, qty: 1, subtotal: 1599 }
  ],
  'ORD-003': [
    { product: 'MacBook Pro', price: 12999, qty: 1, subtotal: 12999 },
    { product: '鼠标', price: 499, qty: 1, subtotal: 499 },
    { product: '键盘', price: 899, qty: 1, subtotal: 899 }
  ],
  'ORD-004': [
    { product: '充电器', price: 299, qty: 2, subtotal: 598 },
    { product: '数据线', price: 149, qty: 2, subtotal: 298 }
  ],
  'ORD-005': [
    { product: 'iPad Air', price: 3299, qty: 1, subtotal: 3299 }
  ]
}

const masterColumns = [
  { prop: 'id', label: '订单号', width: 120 },
  { prop: 'customer', label: '客户'},
  { prop: 'date', label: '日期' },
  {
    prop: 'status',
    label: '状态',
   
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return h(ElTag, { type: s.type, size: 'small' }, () => s.text)
    }
  },
  { prop: 'amount', label: '金额', width: 120, formatter: (r) => `¥${r.amount.toLocaleString()}` }
]

const masterOptions = {
  border: true,
  highlightCurrentRow: true,
  leftText: '订单列表',
  configBtn: [
    { name: '刷新', icon: Refresh, code: 2, click: () => { ElMessage.success('已刷新') } },
    { name: '清空选中', icon: Delete, code: 2, click: () => { currentOrder.value = null } }
  ]
}

const currentItems = computed(() => currentOrder.value ? (orderItems[currentOrder.value.id] || []) : [])

const detailColumns = [
  { prop: 'product', label: '商品名称', minWidth: 150 },
  { prop: 'price', label: '单价', width: 120, formatter: (r) => `¥${r.price.toLocaleString()}` },
  { prop: 'qty', label: '数量', width: 80 },
  { prop: 'subtotal', label: '小计', width: 120, formatter: (r) => `¥${r.subtotal.toLocaleString()}` }
]

const getDetailSummaries = ({ columns, data }) => {
  const sums = []
  columns.forEach((col, index) => {
    if (index === 0) { sums[index] = '合计'; return }
    if (col.property === 'subtotal') {
      sums[index] = `¥${data.reduce((s, d) => s + d.subtotal, 0).toLocaleString()}`
    } else {
      sums[index] = ''
    }
  })
  return sums
}

const detailOptions = computed(() => ({
  border: true,
  showSummary: true,
  summaryMethod: getDetailSummaries,
  leftText: currentOrder.value ? `订单明细 — ${currentOrder.value.id}` : '订单明细（请选择订单）'
}))

const handleOrderSelect = (row) => {
  currentOrder.value = row
}
</script>

<style scoped>
.example-current-row {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.master-section,
.detail-section {
  width: 100%;
}
</style>
