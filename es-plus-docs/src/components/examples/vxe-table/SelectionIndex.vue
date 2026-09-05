<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="small" type="primary" @click="showSelected">获取选中行</el-button>
      <el-button size="small" @click="clearAll">清空选择</el-button>
      <span style="font-size: 13px; color: #909399;">已选 {{ selectedCount }} 行</span>
    </div>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
    <el-dialog v-model="dialogVisible" title="选中数据" width="400px">
      <pre style="max-height: 300px; overflow: auto; font-size: 12px;">{{ selectedJson }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const dialogVisible = ref(false)
const selectedJson = ref('')
const selectedCount = ref(0)

const columns = [
  { type: 'selection', width: 50 },
  { type: 'index', label: '序号', width: 70 },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 130 },
  { prop: 'salary', label: '薪资(元)', width: 110, align: 'right' as const },
]

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  // multiSelect: true,
  // snIndex: true,
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })

const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']
const allData = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  salary: (8000 + i * 500).toLocaleString(),
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})

function showSelected() {
  const rows = tableRef.value?.getSelectionRows?.() ?? []
  selectedCount.value = rows.length
  if (!rows.length) {
    ElMessage.info('请先选择数据')
    return
  }
  selectedJson.value = JSON.stringify(rows, null, 2)
  dialogVisible.value = true
}

function clearAll() {
  tableRef.value?.clearSelection?.()
  selectedCount.value = 0
}
</script>
