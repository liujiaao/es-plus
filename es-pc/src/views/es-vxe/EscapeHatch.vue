<template>
  <div>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="vxeConfig 深度合并原生 vxe-grid 配置（逃生舱，不经过 es-plus 适配层）；vxeOn 事件注入（cell-click 等原生事件）"
    />
    <div style="margin-bottom: 8px; font-size: 13px; color: #606266">
      单击单元格：<a-tag v-if="clickInfo" color="processing">{{ clickInfo }}</a-tag>
      <span style="margin-left: 16px">排序事件：<a-tag v-if="sortInfo" color="processing">{{ sortInfo }}</a-tag></span>
    </div>
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup>
import { ref, h, computed } from 'vue'
import { Tag } from 'ant-design-vue'
import { EsTable } from '@es-plus/adapter-antdv'

const clickInfo = ref('')
const sortInfo = ref('')

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  // sortable 是 a-table / vxe 共有的列配置，vxe 引擎原样透传给 vxe-column
  { prop: 'name', label: '姓名', minWidth: 120, sortable: true },
  {
    prop: 'level', label: '级别', width: 100,
    render: (_h, { value }) => {
      const colors = { P5: 'default', P6: 'warning', P7: 'success', P8: 'error' }
      return h(Tag, { color: colors[value] ?? 'default' }, () => value)
    },
  },
  { prop: 'department', label: '部门', width: 120 },
]

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  // vxeConfig：深度合并原生 vxe-grid 配置（逃生舱），es-plus 不理解的配置都可放这里
  vxeConfig: {
    rowConfig: { isHover: true, isCurrent: true },
    columnConfig: { resizable: true, minWidth: 60 },
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 100 },
  },
  // vxeOn：vxe 原生事件注入（只进这份配置，不污染 es-plus 的一等公民事件）
  vxeOn: {
    'cell-click': ({ row, column }) => {
      clickInfo.value = `行:${row.name} 列:${column.title || column.field}`
    },
    'sort-change': ({ field, order }) => {
      sortInfo.value = order ? `${field} ${order === 'asc' ? '升序' : '降序'}` : `${field} 取消排序`
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
