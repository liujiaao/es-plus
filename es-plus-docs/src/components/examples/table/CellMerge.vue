<template>
  <div class="example-table-merge">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true, stripe: true, spanMethod: spanMethod, rowClassName: tableRowClassName }"
    />
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
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

// 合并单元格方法
const spanMethod = ({ row, column, rowIndex, columnIndex }) => {
  const currentRow = tableData.value[rowIndex]
  if (!currentRow) {
    return { rowspan: 1, colspan: 1 }
  }

  // 合并部门列 - 相同部门合并
  if (columnIndex === 0) {
    const prevRow = tableData.value[rowIndex - 1]

    if (prevRow && prevRow.name === currentRow.name) {
      return { rowspan: 0, colspan: 0 }
    }

    // 计算相同部门的连续行数
    let rowspan = 1
    for (let i = rowIndex + 1; i < tableData.value.length; i++) {
      if (tableData.value[i].name === currentRow.name) {
        rowspan++
      } else {
        break
      }
    }
    return { rowspan, colspan: 1 }
  }

  // 合并项目列 - 相同项目和部门
  if (columnIndex === 1) {
    const prevRow = tableData.value[rowIndex - 1]

    if (prevRow && prevRow.name === currentRow.name && prevRow.project === currentRow.project) {
      return { rowspan: 0, colspan: 0 }
    }

    let rowspan = 1
    for (let i = rowIndex + 1; i < tableData.value.length; i++) {
      if (tableData.value[i].name === currentRow.name && tableData.value[i].project === currentRow.project) {
        rowspan++
      } else {
        break
      }
    }
    return { rowspan, colspan: 1 }
  }

  return { rowspan: 1, colspan: 1 }
}

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
