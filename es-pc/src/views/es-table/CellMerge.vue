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
import { EsTable } from '@es-plus/adapter-antdv'
import { ref, h } from 'vue'
import { Progress } from 'ant-design-vue'

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
      return h(Progress, {
        percent: row.progress,
        status: row.progress >= 80 ? 'success' : row.progress >= 50 ? 'normal' : 'exception',
        style: 'width: 100%'
      })
    }
  }
]

// 合并单元格：a-table 没有 span-method prop，跨端可移植的写法是声明式 mergeConfig
// （按列「相邻行取值相等」自动分组）。函数式 spanMethod 只在 el-table / vxe 引擎可用。
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
