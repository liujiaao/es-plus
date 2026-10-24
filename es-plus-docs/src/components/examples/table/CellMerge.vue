<template>
  <div class="example-table-merge">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true, stripe: true, mergeConfig: { rowsBy: ['name', 'project'] }, rowClassName: tableRowClassName }"
    />
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/vue3'
import { ref, h } from 'vue'
import { ElProgress } from 'element-plus'

const tableData = ref([
  { id: 1, name: '部门A', project: '项目X', task: '设计', progress: 80 },
  { id: 2, name: '部门A', project: '项目X', task: '开发', progress: 60 },
  { id: 3, name: '部门A', project: '项目Y', task: '测试', progress: 90 },
  { id: 4, name: '部门B', project: '项目Z', task: '需求', progress: 100 },
  { id: 5, name: '部门B', project: '项目Z', task: '设计', progress: 45 },
  { id: 6, name: '部门C', project: '项目W', task: '开发', progress: 75 }
])

const columns = [
  { prop: 'name', label: '部门', width: 120 },
  { prop: 'project', label: '项目', width: 120 },
  { prop: 'task', label: '任务', width: 120 },
  {
    prop: 'progress',
    label: '进度',

    render: (_, { row }) => {
      return h(ElProgress, {
        percentage: row.progress,
        status: row.progress >= 80 ? 'success' : row.progress >= 50 ? '' : 'exception',
        style: 'width: 100%'
      })
    }
  }
]

// 合并单元格：声明式 mergeConfig。
// rowsBy 的顺序即分组轴 —— 先按「部门」切段，段内再按「项目」切段；
// 每段首行保留单元格（rowspan = 段长），其余行被合并掉。
// 同一份配置在 el-table / a-table / vxe 三端都成立，无需手写 span 函数。
// （函数式 tableOptions.spanMethod 仍可用，但那是单端闭包，不能跨端复用。）
const tableRowClassName = ({ row }) => {
  if (row.progress === 100) {
    return 'row-completed'
  }
  if (row.progress < 50) {
    return 'row-warning'
  }
  return ''
}
</script>

<style scoped>
.example-table-merge {
  padding: 0;
}
:deep(.row-completed) {
  background-color: #f0f9eb !important;
}
:deep(.row-warning) {
  background-color: #fdf6ec !important;
}
</style>
