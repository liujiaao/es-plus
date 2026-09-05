<template>
  <div>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 14px; color: #606266;">渲染引擎：</span>
      <el-radio-group v-model="engine" size="small">
        <el-radio-button value="default">el-table（默认）</el-radio-button>
        <el-radio-button value="vxe">vxe-table（高性能）</el-radio-button>
      </el-radio-group>
      <el-tag v-if="engine === 'vxe'" type="success" size="small">已切换至 vxe 引擎</el-tag>
    </div>
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

const engine = ref<'default' | 'vxe'>('default')

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'joinDate', label: '入职日期', width: 130 },
]

const tableOptions = computed(() => ({
  engine: engine.value,
  border: true,
  stripe: true,
  rowkey: 'id',
  // height:700,
  // heightType: 'height'
}))

const pagination = ref({ pageSize: 10, current: 1, total: 0 })

const departments = ['技术部', '产品部', '设计部', '市场部']
const statuses = ['在职', '离职', '试用期']

const allData = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  status: statuses[i % statuses.length],
  joinDate: `2022-${String((i % 12) + 1).padStart(2, '0')}-01`,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
