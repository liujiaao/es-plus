<template>
  <div class="example-cross-page-select">
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
      @selection-change="handleSelectionChange"
    >
      <template #default>
        <div class="toolbar">
          <el-button type="primary" :disabled="!selectedCount" @click="handleBatchAction">
            批量操作 ({{ selectedCount }} 条跨页选中)
          </el-button>
          <el-button @click="tableRef?.clearAllSelection?.()">清空所有选择</el-button>
        </div>
      </template>
    </es-table>
    <div class="hint">
      <ElAlert type="info" :closable="false" show-icon>
        <template #title>
          切换分页后选择不丢失 — <b>rowkey + cachePageSelection</b> 解决 el-table 跨页选择丢失的痛点。
          getSelectionRows() 返回所有页面的选中数据。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { ElMessage, ElTag, ElAlert, ElMessageBox } from 'element-plus'
import EsTable from 'es-plus/components/es-table'

const tableRef = ref(null)
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })

const selectedCount = ref(0)

const handleSelectionChange = (rows) => {
  selectedCount.value = rows?.length || 0
}

const statusMap = {
  active: { text: '在职', type: 'success' },
  leave: { text: '休假', type: 'warning' },
  resigned: { text: '离职', type: 'danger' }
}

const columns = [
  { type: 'selection', width: 50 },
  { prop: 'id', label: '工号', width: 80 },
  { prop: 'name', label: '姓名', width: 90 },
  { prop: 'department', label: '部门', width: 100 },
  { prop: 'position', label: '职位' },
  {
    prop: 'status', label: '状态', width: 80,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return <ElTag type={s.type} size="small">{s.text}</ElTag>
    }
  }
]

const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 5 } = params || {}
  const allData = Array.from({ length: 32 }, (_, i) => ({
    id: 1001 + i,
    name: ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'][i % 8],
    department: ['技术部', '产品部', '市场部', '财务部'][i % 4],
    position: ['工程师', '经理', '总监', '专员'][i % 4],
    status: ['active', 'leave', 'resigned'][i % 3]
  }))
  const total = allData.length
  const start = (pageIndex - 1) * pageSize
  return { data: allData.slice(start, start + pageSize), total, pageSize, pageIndex }
}

// rowkey: 唯一标识字段 → 跨页选择持久化
// cachePageSelection: 启用跨页缓存
const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/employees', method: 'GET' },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  cachePageSelection: true,
  multiSelect: true,
  heightType: 'height',
  tabHeight: 380
}

const handleBatchAction = async () => {
  const rows = tableRef.value?.getSelectionRows?.() || []
  try {
    await ElMessageBox.confirm(
      `已跨页选中 ${rows.length} 条数据（来自多个分页），确定执行批量操作？`,
      '跨页批量操作',
      { type: 'info' }
    )
    ElMessage.success(`已处理 ${rows.length} 条数据（模拟）`)
    tableRef.value?.clearAllSelection?.()
    selectedCount.value = 0
  } catch {}
}
</script>

<style scoped>
.example-cross-page-select {
  padding: 0;
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 10px;
}
.hint {
  margin-top: 12px;
}
</style>
