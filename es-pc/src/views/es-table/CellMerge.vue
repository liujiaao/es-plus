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
/* 行底色用「状态色的低透明度」而不是浅色调字面量：同一个 rgba 压在白底上就是
   原来的浅绿/浅橙，压在深色表体上则是同色的暗底 —— 一条规则同时服务两套主题。
   写死 #f0f9eb / #fdf6ec 的话，深色页面上会出现两行刺眼的亮色（与 docs-content.css
   里 .tip / .warning 的暗色覆盖是同一种做法，只是这里没有共享文件可挂，就地解决）。 */
:deep(.row-completed) {
  background-color: rgba(22, 163, 74, 0.12) !important;
}
:deep(.row-warning) {
  background-color: rgba(217, 119, 6, 0.12) !important;
}
</style>
