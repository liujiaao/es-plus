<template>
  <div>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="columnConfig.resizable 列宽拖拽；keyboardConfig 键盘导航（方向键移动）；mouseConfig 鼠标选中区域（类 Excel 体验）"
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

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 130 },
  { prop: 'position', label: '职位', width: 130 },
  { prop: 'salary', label: '薪资', width: 130 },
  { prop: 'email', label: '邮箱', minWidth: 200 },
]

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  columnConfig: { resizable: true },
  keyboardConfig: { isArrow: true, isDel: false, isEnter: true, isTab: true, isEdit: false },
  mouseConfig: { selected: true },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const departments = ['技术部', '产品部', '设计部', '市场部']
const positions = ['工程师', '高级工程师', '架构师', '经理']

const allData = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  position: positions[i % positions.length],
  salary: `¥${(8000 + i * 500).toLocaleString()}`,
  email: `user${i + 1}@company.com`,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
