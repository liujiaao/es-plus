<template>
  <div class="example-vxe-virtual">
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="vxe-table 原生虚拟滚动：1000 行数据，scrollY.gt:100 超过 100 行自动启用虚拟渲染，滚动流畅不卡顿"
    />
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/adapter-antdv'

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', minWidth: 140 },
  { prop: 'position', label: '职位', minWidth: 140 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right' },
]

const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']
const positions = ['工程师', '高级工程师', '架构师', '经理']

const tableData = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  position: positions[i % positions.length],
  salary: 8000 + (i % 100) * 100,
}))

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  // vxe 原生虚拟滚动配置（es-plus 不理解的 vxe 原生配置放 vxeConfig 逃生舱）
  vxeConfig: {
    scrollY: { enabled: true, gt: 100 },
  },
}
</script>
