<template>
  <div class="virtual-select-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 多选 + 跨页记忆 + 操作按钮</h4>
    <div style="margin-bottom: 12px;">
      <a-button type="primary" size="small" @click="getSelection">获取选中行</a-button>
      <a-button size="small" @click="clearSelection">清空选择</a-button>
      <a-tag v-if="selectedCount > 0" color="blue" style="margin-left: 12px;">
        已选 {{ selectedCount }} 条
      </a-tag>
    </div>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableRef = ref(null)
const selectedCount = ref(0)

const columns = [
  { type: 'selection', width: 50 },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 140 },
  { prop: 'department', label: '部门', minWidth: 140 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right' },
]

const tableOptions = {
  // ADV 4.x 原生虚拟滚动（el-table-v2 为 Element Plus 专属，AntDV 用 :virtual 属性）
  virtual: true,
  multiSelect: true,
  rowkey: 'id',
  border: true,
}

const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']

const tableData = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  salary: 8000 + (i % 100) * 100,
}))

const pagination = ref({ pageSize: 10, current: 1, total: tableData.length })

function getSelection() {
  const rows = tableRef.value?.getSelectionRows?.() || []
  selectedCount.value = rows.length
  message.success(`已选中 ${rows.length} 条`)
}

function clearSelection() {
  tableRef.value?.clearSelection?.()
  selectedCount.value = 0
}
</script>
