<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 12px;"
      description="render(h, {value, row, index}) — 与 el-table 相同的 render 函数 API，vxe 引擎通过 RenderDomTb 桥接透传"
    />
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed } from 'vue'
import { ElTag, ElProgress, ElAvatar } from 'element-plus'
import { EsTable } from 'es-plus'

const scoreColor = (score: number) => score >= 80 ? 'success' : score >= 60 ? 'warning' : 'exception'
const statusType: Record<string, any> = { active: 'success', leave: 'danger', trial: 'warning' }
const statusLabel: Record<string, string> = { active: '在职', leave: '离职', trial: '试用期' }

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  {
    prop: 'name',
    label: '员工',
    minWidth: 140,
    render: (_h: any, { row }: any) =>
      h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        h(ElAvatar, { size: 28, style: 'background:#409eff;font-size:12px' }, () => row.name[0]),
        h('span', row.name),
      ]),
  },
  {
    prop: 'status',
    label: '状态',
    width: 90,
    render: (_h: any, { value }: any) =>
      h(ElTag, { type: statusType[value], size: 'small' }, () => statusLabel[value] ?? value),
  },
  {
    prop: 'score',
    label: '绩效分',
    width: 150,
    render: (_h: any, { value }: any) =>
      h(ElProgress, {
        percentage: value,
        status: scoreColor(value),
        strokeWidth: 10,
        style: 'width:120px',
      }),
  },
  {
    prop: 'salary',
    label: '薪资',
    width: 130,
    align: 'right' as const,
    render: (_h: any, { value, row }: any) => {
      const isHigh = value > 15000
      return h('span', { style: `color:${isHigh ? '#67c23a' : '#606266'};font-weight:${isHigh ? 600 : 400}` },
        `¥${Number(value).toLocaleString()}`)
    },
  },
  { prop: 'department', label: '部门', width: 110 },
]

const tableOptions = { engine: 'vxe' as const, border: true, rowkey: 'id', stripe: true }
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
