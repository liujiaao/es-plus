<template>
  <div>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="render(h, {value, row, index}) — 与默认引擎相同的 render 函数 API，vxe 引擎自动桥接透传"
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
import { Tag, Progress, Avatar } from 'ant-design-vue'
import { EsTable } from '@es-plus/adapter-antdv'

// antd Progress status：success / normal / exception
const scoreStatus = (score) => (score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception')
// antd Tag color：success / error / warning
const statusColor = { active: 'success', leave: 'error', trial: 'warning' }
const statusLabel = { active: '在职', leave: '离职', trial: '试用期' }

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  {
    prop: 'name', label: '员工', minWidth: 160,
    render: (_h, { row }) =>
      h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        h(Avatar, { size: 28, style: 'background:#1677ff;font-size:12px' }, () => row.name[0]),
        h('span', row.name),
      ]),
  },
  {
    prop: 'status', label: '状态', width: 90,
    render: (_h, { value }) =>
      h(Tag, { color: statusColor[value] }, () => statusLabel[value] ?? value),
  },
  {
    prop: 'score', label: '绩效分', width: 160,
    render: (_h, { value }) =>
      h(Progress, { percent: value, status: scoreStatus(value), strokeWidth: 10, style: 'width:120px;margin:0' }),
  },
  {
    prop: 'salary', label: '薪资', width: 130, align: 'right',
    render: (_h, { value }) => {
      const isHigh = value > 15000
      return h(
        'span',
        { style: `color:${isHigh ? '#52c41a' : '#606266'};font-weight:${isHigh ? 600 : 400}` },
        `¥${Number(value).toLocaleString()}`
      )
    },
  },
  { prop: 'department', label: '部门', width: 110 },
]

const tableOptions = { engine: 'vxe', border: true, rowkey: 'id', stripe: true }
const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const departments = ['技术部', '产品部', '设计部', '市场部']
const statuses = ['active', 'leave', 'trial']

const allData = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  status: statuses[i % statuses.length],
  score: 50 + ((i * 13) % 50),
  salary: 8000 + ((i * 1700) % 20000),
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
