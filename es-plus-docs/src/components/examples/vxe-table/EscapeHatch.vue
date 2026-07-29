<template>
  <div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="vxeConfig 深度合并原生 vxe-grid 配置（逃生舱，不经过 es-plus 适配层）；vxeOn 事件注入（onCellClick → cell-click）" />
    <div style="margin-bottom:8px;font-size:13px;color:#606266">
      单击单元格：<el-tag v-if="clickInfo" size="small" type="info">{{ clickInfo }}</el-tag>
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
import { ref, h, computed } from 'vue'
import { ElTag } from 'element-plus'
import { EsTable } from 'es-plus'

const clickInfo = ref('')

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'level', label: '级别', width: 100,
    render: (_h: any, { value }: any) => {
      const colors: Record<string, string> = { P5: '', P6: 'warning', P7: 'success', P8: 'danger' }
      return h(ElTag, { type: colors[value] ?? '', size: 'small' }, () => value)
    }
  },
  { prop: 'department', label: '部门', width: 120 },
]

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',

  // vxeConfig：深度合并原生 vxe-grid 配置（逃生舱）
  // es-plus 不理解的 vxe 原生配置都可放这里
  vxeConfig: {
    highlightCurrentRow: true,
    rowConfig: { isHover: true, isCurrent: true },
    columnConfig: { resizable: true, minWidth: 60 },
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 100 },
  },

  // vxeOn：vxe 原生事件注入（onXxx → xxx 事件名）
  vxeOn: {
    'cell-click': ({ row, column }: any) => {
      clickInfo.value = `行:${row.name} 列:${column.title || column.field}`
    },
    'sort-change': ({ field, order }: any) => {
      console.log('[vxeOn sort-change]', field, order)
    },
  },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const levels = ['P5', 'P6', 'P7', 'P8']
const departments = ['技术部', '产品部', '设计部', '市场部']

const allData = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  level: levels[i % levels.length],
  department: departments[i % departments.length],
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
