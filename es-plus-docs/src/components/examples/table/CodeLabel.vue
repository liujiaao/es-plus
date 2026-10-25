<template>
  <div class="example-table-code-label">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true, stripe: true }"
    />
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/vue3'

// 后端给的是码值（0/1/2/9），中间还混着字符串 '1' —— 真实接口的常见形态。
const tableData = [
  { orderNo: 'SO-2024-001', amount: 1280, status: 2, channel: 'app', paidAt: '06-01 10:20' },
  { orderNo: 'SO-2024-002', amount: 899, status: '1', channel: 'h5', paidAt: '' },
  { orderNo: 'SO-2024-003', amount: 450, status: 0, channel: 'mini', paidAt: '06-03 09:05' },
  { orderNo: 'SO-2024-004', amount: 2380, status: 9, channel: 'app', paidAt: '06-04 16:40' },
  { orderNo: 'SO-2024-005', amount: 760, status: null, channel: 'h5', paidAt: '' }
]

// 「码值 → 展示」是一个纯数据映射，不是一段逻辑：写在列上的 dataOptions 就够了。
// 命中 → 显示 label，带 tagType 就渲染成本端原生标签（这里 ElTag，vue2 是 el-tag、
// antdv 是 a-tag），不需要 import 任何标签组件、更不需要 render 函数。
// 同一份列配置在 el-table / vxe / 虚拟引擎下都成立（注入点在 filteredColumns）。
const columns = [
  { prop: 'orderNo', label: '订单号', width: 132 },
  { prop: 'amount', label: '金额', width: 82 },
  {
    prop: 'status',
    label: '状态',
    width: 96,
    dataOptions: [
      { label: '待支付', value: 0, tagType: 'info' },
      { label: '已支付', value: 1, tagType: 'primary' },
      { label: '已发货', value: 2, tagType: 'success' },
      { label: '已退款', value: 3, tagType: 'danger' }
    ]
  },
  {
    prop: 'channel',
    label: '下单渠道',
    width: 100,
    // 不要标签色时只写 label：码值映射与「彩色标签」是两个独立开关。
    dataOptions: [
      { label: 'App', value: 'app' },
      { label: 'H5', value: 'h5' },
      { label: '小程序', value: 'mini' }
    ]
  },
  { prop: 'paidAt', label: '支付时间', minWidth: 120, emptyPlaceholder: '未支付' }
]
</script>

<style scoped>
.example-table-code-label {
  padding: 0;
}
</style>
