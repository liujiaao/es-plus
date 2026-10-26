<template>
  <es-table
    ref="tableRef"
    :columns="columns"
    :options="options"
    v-model:data-source="tableData"
    v-model:pagination="pagination"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

const columns = [
  { prop: 'orderNo', label: '订单号', width: 150 },
  { prop: 'customer', label: '客户', minWidth: 140 },
  { prop: 'amount', label: '金额', align: 'right' },
  { prop: 'status', label: '状态', dataOptions: [{"label":"待发货","value":0,"tagType":"warning"},{"label":"已发货","value":1,"tagType":"success"},{"label":"已签收","value":2,"tagType":"info"}] },
  {
    prop: 'operate',
    label: '操作',
    width: 100,
    fixed: 'right',
    btns: [
      { name: '查看', triggerEvent: true },
    ]
  },
]

const options = {
  border: true,
  stripe: true,
  highlightCurrentRow: true,
  headerCellStyle: {"background":"#f5f7fa"},
  rowkey: 'id',
}

const tableData = ref([])
const tableRef = ref(null)
const pagination = ref({ current: 1, pageSize: 10, total: 0 })
</script>
