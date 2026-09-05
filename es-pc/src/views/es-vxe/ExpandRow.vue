<template>
  <div>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="type: 'expand' 展开行：点击行展开，render 函数自定义展开区内容；expandConfig.trigger 控制触发方式"
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
import { ref, h, computed } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const field = (label, value) =>
  h('div', { style: 'flex:1 1 30%;min-width:180px' }, [
    h('span', { style: 'color:#909399' }, `${label}：`),
    h('span', { style: 'color:#303133' }, String(value)),
  ])

const columns = [
  {
    type: 'expand', width: 50,
    render: (_h, { row }) =>
      h('div', { style: 'padding:16px;background:#f5f7fa;border-radius:4px;display:flex;flex-wrap:wrap;gap:12px' }, [
        field('员工ID', row.id),
        field('姓名', row.name),
        field('部门', row.department),
        field('职位', row.position),
        field('手机', row.phone),
        field('邮箱', row.email),
        field('薪资', `${row.salary} 元/月`),
      ]),
  },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 130 },
  { prop: 'position', label: '职位', width: 130 },
]

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  expandConfig: { trigger: 'row' },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const positions = ['工程师', '高级工程师', '架构师', '经理', '总监']
const departments = ['技术部', '产品部', '设计部', '市场部']
const allData = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  position: positions[i % positions.length],
  phone: `138${String(10000000 + i).slice(-8)}`,
  email: `user${i + 1}@company.com`,
  salary: (8000 + i * 800).toLocaleString(),
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
