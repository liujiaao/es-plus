<template>
  <div class="example-current-row">
    <div class="master-section">
      <es-table
        :data-source="orders"
        :columns="masterColumns"
        :options="masterOptions"
        @row-click="handleOrderSelect"
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
import { EsTable } from '@es-plus/adapter-antdv'
import { Tag, message } from 'ant-design-vue'
import { ref, computed, h } from 'vue'

const currentOrder = ref(null)

// antdv 的 Tag 用 color 表达语义色（不是 el-tag 的 type）
const statusMap = {
  paid: { text: '已支付', color: 'success' },
  pending: { text: '待支付', color: 'warning' },
  shipped: { text: '已发货', color: 'processing' }
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
      const s = statusMap[row.status] || { text: '-', color: 'default' }
      return h(Tag, { color: s.color }, () => s.text)
    }
  },
  { prop: 'amount', label: '金额', width: 120, formatter: (r) => `¥${r.amount.toLocaleString()}` }
]

const masterOptions = {
  border: true,
  highlightCurrentRow: true,
  leftText: '订单列表',
  configBtn: [
    // 只保留真实生效的动作：清空右侧明细，回到「请选择订单」空态。
    // （行高亮由点击切换，组件未暴露 setCurrentRow —— 不摆一个点了没反应的「刷新」）
    {
      name: '清空明细', icon: 'Delete', position: 'right',
      click: () => {
        if (!currentOrder.value) { message.info('还没有选中的订单'); return }
        currentOrder.value = null
      }
    }
  ]
}

const currentItems = computed(() => currentOrder.value ? (orderItems[currentOrder.value.id] || []) : [])

const detailColumns = [
  { prop: 'product', label: '商品名称', minWidth: 150 },
  { prop: 'price', label: '单价', width: 120, formatter: (r) => `¥${r.price.toLocaleString()}` },
  { prop: 'qty', label: '数量', width: 80 },
  { prop: 'subtotal', label: '小计', width: 120, formatter: (r) => `¥${r.subtotal.toLocaleString()}` }
]

const detailTotal = computed(() =>
  currentItems.value.reduce((s, d) => s + d.subtotal, 0)
)

// a-table 没有汇总行（summaryMethod 是 el-table 专有），
// 这里把合计放进 leftText，主从联动 + 跑马灯式的头部信息一次演示
const detailOptions = computed(() => ({
  border: true,
  leftText: currentOrder.value
    ? `订单明细 — ${currentOrder.value.id}　合计 ¥${detailTotal.value.toLocaleString()}`
    : '订单明细（点击上方订单行查看）'
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
