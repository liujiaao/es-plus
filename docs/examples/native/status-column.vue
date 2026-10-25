<template>
  <!-- 状态 / 渠道 / 空值三列都要自己写模板分支或 formatter -->
  <el-table :data="rows" border>
    <el-table-column prop="orderNo" label="订单号" width="150" />
    <el-table-column label="状态" width="110">
      <template #default="{ row }">
        <el-tag v-if="row.status === 2" type="success">已发货</el-tag>
        <el-tag v-else-if="row.status === 1" type="primary">已支付</el-tag>
        <el-tag v-else-if="row.status === 0" type="info">待支付</el-tag>
        <el-tag v-else type="danger">已退款</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="渠道" width="110">
      <template #default="{ row }">{{ channelText(row.channel) }}</template>
    </el-table-column>
    <el-table-column label="支付时间" width="160">
      <template #default="{ row }">{{ row.paidAt || '未支付' }}</template>
    </el-table-column>
  </el-table>
</template>

<script setup>
import { ref } from 'vue'

// 后端给的是码值（0/1/2/3，渠道是字符串）
const rows = ref([
  { orderNo: 'SO-2026-001', status: 2, channel: 'app', paidAt: '06-01 10:20' },
  { orderNo: 'SO-2026-002', status: 1, channel: 'h5', paidAt: '06-02 14:05' },
  { orderNo: 'SO-2026-003', status: 0, channel: 'mini', paidAt: '' },
  { orderNo: 'SO-2026-004', status: 3, channel: 'app', paidAt: '06-03 09:40' },
  { orderNo: 'SO-2026-005', status: 2, channel: 'h5', paidAt: '06-04 16:30' },
])

// 「码值 → 展示」在原生写法里就是一段手写映射
const CHANNELS = { app: 'App', h5: 'H5', mini: '小程序' }

function channelText(channel) {
  return CHANNELS[channel] || '—'
}
</script>
