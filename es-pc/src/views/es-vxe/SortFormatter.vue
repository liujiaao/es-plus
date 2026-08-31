<template>
  <div>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="点击列头可排序；薪资列使用 formatter 格式化；状态列使用 vxeColumn.formatter 自定义 vxe 原生格式化"
    />
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const statusMap = { active: '在职', leave: '离职', trial: '试用期' }

const columns = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120, sortable: true },
  {
    prop: 'salary', label: '薪资', width: 130, sortable: true, align: 'right',
    formatter: (row) => `¥${Number(row.salary).toLocaleString()}`,
  },
  {
    prop: 'status', label: '状态', width: 100,
    // vxe 原生格式化函数（通过 vxeColumn 逃生舱传入）
    vxeColumn: { formatter: ({ cellValue }) => statusMap[cellValue] ?? cellValue },
  },
  { prop: 'joinDate', label: '入职日期', width: 130, sortable: true },
]

const tableOptions = { engine: 'vxe', border: true, rowkey: 'id', sortable: true }

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const departments = ['技术部', '产品部', '设计部', '市场部']
const statuses = ['active', 'leave', 'trial']

const allData = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  salary: 8000 + i * 600,
  status: statuses[i % statuses.length],
  joinDate: `2021-${String((i % 12) + 1).padStart(2, '0')}-15`,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
