<template>
  <div class="virtual-sort-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 排序 + 固定列 + 序号</h4>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
      @change-table-sort="handleSort"
    />
    <p style="margin-top: 8px; color: #909399; font-size: 12px;">
      当前排序：{{ sortInfo || '无' }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const sortInfo = ref('')

const columns = [
  { type: 'index', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', width: 120, fixed: 'left' },
  { prop: 'age', label: '年龄', width: 80, sortable: true },
  { prop: 'score', label: '分数', width: 100, sortable: true },
  { prop: 'email', label: '邮箱', minWidth: 220 },
  { prop: 'city', label: '城市', width: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'salary', label: '薪资', width: 120, sortable: true, fixed: 'right' },
]

const tableOptions = {
  virtual: true,
  border: true,
  stripe: true,
  snIndex: false,
  rowkey: 'id',
  rowHeight: 48,
  heightType: 'height' as const,
  tabHeight: 420,
}

const pagination = ref({ pageSize: 50000, current: 1, total: 0 })

const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安']
const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']

function generateData(count: number) {
  const data: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    data.push({
      id: i,
      name: `用户${i}`,
      age: 20 + (i % 30),
      score: Math.round(Math.random() * 100),
      email: `user${i}@example.com`,
      city: cities[i % cities.length],
      department: departments[i % departments.length],
      salary: `¥${(5000 + Math.floor(Math.random() * 30000)).toLocaleString()}`,
    })
  }
  return data
}

const tableData = ref<Record<string, unknown>[]>([])

function handleSort(sortPayload: Record<string, unknown>) {
  const { prop, order } = sortPayload as { prop: string; order: string | null }
  if (!order) {
    sortInfo.value = ''
    tableData.value = generateData(50000)
  } else {
    sortInfo.value = `${prop} ${order === 'ascending' ? '升序' : '降序'}`
    tableData.value = [...tableData.value].sort((a: any, b: any) => {
      const aVal = typeof a[prop] === 'string' ? parseFloat(a[prop].replace(/[^0-9.]/g, '')) || a[prop] : a[prop]
      const bVal = typeof b[prop] === 'string' ? parseFloat(b[prop].replace(/[^0-9.]/g, '')) || b[prop] : b[prop]
      return order === 'ascending' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
  }
}

onMounted(() => {
  tableData.value = generateData(50000)
  pagination.value.total = tableData.value.length
})
</script>

<style scoped>
.virtual-sort-demo {
  padding: 0;
}
</style>
