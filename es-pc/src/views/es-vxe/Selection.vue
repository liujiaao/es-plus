<template>
  <div>
    <a-space style="margin-bottom: 10px">
      <a-button size="small" type="primary" @click="showSelected">获取选中行</a-button>
      <a-button size="small" @click="clearAll">清空选择</a-button>
      <span style="font-size: 13px; color: #909399">已选 {{ selectedCount }} 行</span>
    </a-space>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableRef = ref(null)
const selectedCount = ref(0)

const columns = [
  { type: 'selection', width: 50 },
  { type: 'snIndex', label: '序号', width: 70 },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 130 },
  { prop: 'salary', label: '薪资(元)', width: 110, align: 'right' },
]

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']

const allData = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  salary: 8000 + i * 500,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})

function showSelected() {
  const rows = tableRef.value?.getSelectionRows?.() || []
  selectedCount.value = rows.length
  message.success(`已选中 ${rows.length} 行：${rows.map((r) => r.name).join('、')}`)
}

function clearAll() {
  tableRef.value?.clearSelection?.()
  selectedCount.value = 0
}
</script>
