<template>
  <div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="toolbarConfig 工具栏：内置缩放、全屏、刷新按钮；exportConfig 支持导出 CSV/Excel（需安装 exceljs 插件）" />
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { EsTable } from 'es-plus'

const columns = [
  { type: 'snIndex', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'position', label: '职位', width: 120 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right' as const,
    formatter: (row: any) => `¥${Number(row.salary).toLocaleString()}` },
  { prop: 'joinDate', label: '入职日期', width: 130 },
]

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  toolbarConfig: {
    zoom: true,
    custom: true,
    refresh: false,
    export: true,
    print: true,
  },
  // 打印配置：vxe-table 的 print() 需要此参数才会弹出"打印数据"配置弹窗，
  // 否则跳过弹窗直接 window.print()。true 展开为 {} 即默认配置。
  printConfig: true as const,
  exportConfig: {
    type: 'csv' as const,
    filename: '员工数据',
  },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const positions = ['工程师', '高级工程师', '架构师', '经理']
const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']

const allData = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  position: positions[i % positions.length],
  salary: 8000 + i * 600,
  joinDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-01`,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
