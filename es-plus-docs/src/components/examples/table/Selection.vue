<template>
  <div class="example-selection-table">
    <div class="toolbar">
      <el-button type="primary" :disabled="!selectedCount" @click="handleBatchDelete">
        批量删除 ({{ selectedCount }})
      </el-button>
      <el-button @click="handleClearAll">清空选择</el-button>
    </div>
    <es-table
      ref="tableRef"
      :data-source="currentPageData"
      :columns="columns"
      :options="tableOptions"
      :pagination="pagination"
      @selection-change="syncSelection"
      @pagination-current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
    <div class="selection-info">
      <el-alert
        :title="`已选择 ${selectedCount} 项（跨 ${selectedPages} 页）`"
        :type="selectedCount ? 'success' : 'info'"
        show-icon
      />
    </div>
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/vue3'
import { ref, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const tableRef = ref()
// 跨页并集由表格自己维护（cachePageSelection）：这里只存一份镜像给模板用。
// 注意 selection-change 的参数只是「当前页」的勾选，跨页数量必须问 getSelectionRows()。
const selectedRows = ref([])

const allData = ref([
  { id: 1, name: '张三', age: 28, department: '技术部' },
  { id: 2, name: '李四', age: 32, department: '产品部' },
  { id: 3, name: '王五', age: 24, department: '设计部' },
  { id: 4, name: '赵六', age: 30, department: '市场部' },
  { id: 5, name: '孙七', age: 26, department: '技术部' },
  { id: 6, name: '周八', age: 29, department: '产品部' },
  { id: 7, name: '吴九', age: 31, department: '设计部' },
  { id: 8, name: '郑十', age: 27, department: '市场部' },
  { id: 9, name: '钱十一', age: 33, department: '技术部' },
  { id: 10, name: '陈十二', age: 25, department: '产品部' },
  { id: 11, name: '林十三', age: 28, department: '设计部' },
  { id: 12, name: '黄十四', age: 35, department: '市场部' },
  { id: 13, name: '何十五', age: 22, department: '技术部' },
  { id: 14, name: '罗十六', age: 29, department: '产品部' },
  { id: 15, name: '梁十七', age: 31, department: '设计部' }
])

const columns = [
  { type: 'selection', width: 55 },
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '姓名' },
  { prop: 'age', label: '年龄', width: 80 },
  { prop: 'department', label: '部门' }
]

const tableOptions = {
  multiSelect: true,
  cachePageSelection: true,
  rowkey: 'id'
}

const pagination = ref({
  current: 1,
  pageSize: 5,
  total: allData.value.length,
  pageSizes: [5, 10, 15]
})

const currentPageData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  return allData.value.slice(start, end)
})

// 勾选变化（含翻页后 restoreSelectionForPage 自动回勾）时刷新镜像。
// 回勾发生在组件自己的 nextTick 里，这里等两拍再读才能拿到回勾后的并集。
const syncSelection = () => {
  nextTick(() => {
    nextTick(() => {
      selectedRows.value = tableRef.value?.getSelectionRows?.() || []
    })
  })
}

const selectedCount = computed(() => selectedRows.value.length)

// 选中的行分散在几页里 —— 按行 id 在 allData 中的位置换算页码
const selectedPages = computed(() => {
  const size = pagination.value.pageSize
  const pages = new Set()
  for (const row of selectedRows.value) {
    const index = allData.value.findIndex((item) => item.id === row.id)
    if (index > -1) pages.add(Math.floor(index / size))
  }
  return pages.size
})

const handlePageChange = (pag) => {
  pagination.value.current = pag.current
  // 翻页后组件会回勾本页已选行，selection-change 不一定再触发，手动同步一次
  syncSelection()
}

const handleSizeChange = (pag, size) => {
  pagination.value.pageSize = size
  pagination.value.current = pag.current
  // 页大小变化后页边界改变，跨页缓存的语义已经不成立，整体清空
  tableRef.value?.clearSelection?.()
  selectedRows.value = []
}

const handleClearAll = () => {
  tableRef.value?.clearSelection?.()
  selectedRows.value = []
  ElMessage.info('已清空所有选择')
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedCount.value} 项吗？`, '提示', { type: 'warning' })
    const selectedIds = selectedRows.value.map((item) => item.id)
    allData.value = allData.value.filter(item => !selectedIds.includes(item.id))
    pagination.value.total = allData.value.length
    // 删掉的行走的是响应式数据，但表格内部勾选态还留着它们的 id，一并清掉
    tableRef.value?.clearSelection?.()
    selectedRows.value = []
    ElMessage.success('删除成功')
  } catch {
    // 取消
  }
}
</script>

<style scoped>
.example-selection-table {
  padding: 0;
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}
.selection-info {
  margin-top: 16px;
}
</style>
