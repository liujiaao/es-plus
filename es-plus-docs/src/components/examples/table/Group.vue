<template>
  <div class="example-group-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true, headerCellStyle: { background: '#f5f7fa' } }"
    />
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'

const tableData = [
  { name: '张三', q1: 80, q2: 85, q3: 90, q4: 88, year: 343 },
  { name: '李四', q1: 75, q2: 82, q3: 85, q4: 90, year: 332 },
  { name: '王五', q1: 90, q2: 88, q3: 92, q4: 95, year: 365 }
]

const columns = [
  { prop: 'name', label: '姓名', width: 100, fixed: 'left' },
  {
    label: '季度成绩',
    groups: [
      { prop: 'q1', label: 'Q1',  align: 'center' },
      { prop: 'q2', label: 'Q2',  align: 'center' },
      { prop: 'q3', label: 'Q3', align: 'center' },
      { prop: 'q4', label: 'Q4',  align: 'center' }
    ]
  },
  { prop: 'year', label: '年度总分', width: 100, align: 'center', fixed: 'right' }
]
</script>

<style scoped>
.example-group-table {
  padding: 0;
}
</style>
