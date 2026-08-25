<template>
  <div class="example-vxe-basic">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ engine: 'vxe', border: true, stripe: true, rowkey: 'id' }"
    />
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/adapter-antdv'

const tableData = [
  { id: 1, orderNo: 'NO-2024001', customer: '张三', amount: 1280.5, status: '已支付' },
  { id: 2, orderNo: 'NO-2024002', customer: '李四', amount: 3560.0, status: '待发货' },
  { id: 3, orderNo: 'NO-2024003', customer: '王五', amount: 899.9, status: '已支付' },
  { id: 4, orderNo: 'NO-2024004', customer: '赵六', amount: 2100.0, status: '已取消' },
]

const columns = [
  { prop: 'orderNo', label: '订单号', minWidth: 140 },
  { prop: 'customer', label: '客户', width: 100 },
  { prop: 'amount', label: '金额', width: 120, align: 'right' },
  { prop: 'status', label: '状态', width: 100 },
]
</script>
