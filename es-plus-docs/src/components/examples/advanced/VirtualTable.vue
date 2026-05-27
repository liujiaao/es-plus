<template>
  <div class="virtual-table-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">EsTable 虚拟滚动 — 10 万行数据</h4>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)

const columns = [
  { type: 'selection', width: 60 },
  { type: 'index', label: '序号', width: 70 },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'email', label: '邮箱', minWidth: 200 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'salary', label: '薪资', width: 100, align: 'right' },
  { prop: 'joinDate', label: '入职日期', width: 120 },
  { prop: 'status', label: '状态', width: 80 },
]

const tableOptions = {
  virtual: true,
  border: true,
  // multiSelect: true,
  rowkey: 'id',
  rowHeight: 48,
  heightType: 'height' as const,
  tabHeight: 500,
}

const pagination = ref({ pageSize: 100000, current: 1, total: 0 })

const departments = ['技术部', '产品部', '设计部', '市场部', '运营部', '财务部', '人事部']
const statuses = ['在职', '离职', '休假']

function generateMockData(count: number) {
  const data: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    data.push({
      id: i,
      name: `员工${i}`,
      email: `user${i}@company.com`,
      department: departments[i % departments.length],
      salary: (5000 + Math.floor(Math.random() * 25000)).toLocaleString(),
      joinDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      status: statuses[i % statuses.length],
    })
  }
  return data
}

const tableData = ref<Record<string, unknown>[]>([])

onMounted(() => {
  tableData.value = generateMockData(100000)
  pagination.value.total = tableData.value.length
})
</script>

<style scoped>
.virtual-table-demo {
  padding: 0;
}
</style>
