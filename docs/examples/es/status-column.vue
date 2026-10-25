<template>
  <!-- 同一张表：码值 → 中文标签 / 空值占位都由列声明完成 -->
  <es-table :data-source="rows" :columns="columns" :options="{ border: true }" />
</template>

<script setup>
import { EsTable } from '@es-plus/vue3'

// 后端给的是码值（与 native 版同一份数据）
const rows = [
  { orderNo: 'SO-2026-001', status: 2, channel: 'app', paidAt: '06-01 10:20' },
  { orderNo: 'SO-2026-002', status: 1, channel: 'h5', paidAt: '06-02 14:05' },
  { orderNo: 'SO-2026-003', status: 0, channel: 'mini', paidAt: '' },
  { orderNo: 'SO-2026-004', status: 3, channel: 'app', paidAt: '06-03 09:40' },
  { orderNo: 'SO-2026-005', status: 2, channel: 'h5', paidAt: '06-04 16:30' },
]

// 码值 → 展示是纯数据映射：不写 v-if、不写 formatter、不 import 标签组件。
// 带 tagType 渲染成本端原生标签（EP → el-tag，Element UI → el-tag，AntDV → a-tag）；
// 不带 tagType 只做文案替换；emptyPlaceholder 处理空值。
const columns = [
  { prop: 'orderNo', label: '订单号', width: 150 },
  {
    prop: 'status',
    label: '状态',
    width: 110,
    dataOptions: [
      { label: '待支付', value: 0, tagType: 'info' },
      { label: '已支付', value: 1, tagType: 'primary' },
      { label: '已发货', value: 2, tagType: 'success' },
      { label: '已退款', value: 3, tagType: 'danger' },
    ],
  },
  {
    prop: 'channel',
    label: '渠道',
    width: 110,
    dataOptions: [
      { label: 'App', value: 'app' },
      { label: 'H5', value: 'h5' },
      { label: '小程序', value: 'mini' },
    ],
  },
  { prop: 'paidAt', label: '支付时间', width: 160, emptyPlaceholder: '未支付' },
]
</script>
