<template>
  <div class="virtual-row-style-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 行样式 + 高亮 + 行事件</h4>
    <div style="margin-bottom: 12px; font-size: 13px; color: #909399;">
      <span>单击行高亮，双击弹出详情。红色行 = 异常，绿色行 = 完成，默认 = 进行中</span>
    </div>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
    <div v-if="clickedRow" style="margin-top: 12px; padding: 10px; background: #f5f7fa; border-radius: 4px; font-size: 13px;">
      <strong>当前选中行：</strong>{{ clickedRow.name }} — {{ clickedRow.taskName }} ({{ clickedRow.status }})
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const clickedRow = ref<Record<string, unknown> | null>(null)

const columns = [
  { type: 'index', label: '#', width: 60 },
  { prop: 'name', label: '执行人', width: 100 },
  { prop: 'taskName', label: '任务名称', width: 200 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'priority', label: '优先级', width: 80 },
  { prop: 'progress', label: '进度', width: 100 },
  { prop: 'startDate', label: '开始日期', width: 120 },
  { prop: 'deadline', label: '截止日期', width: 120 },
  { prop: 'remark', label: '备注', minWidth: 200, ellipsis: true },
]

const tableOptions = {
  virtual: true,
  border: true,
  stripe: false,
  highlightCurrentRow: true,
  rowkey: 'id',
  rowHeight: 48,
  heightType: 'height' as const,
  tabHeight: 420,
  rowClassName: ({ row }: any) => {
    if (row.status === '异常') return 'row-danger'
    if (row.status === '完成') return 'row-success'
    return ''
  },
}

const pagination = ref({ pageSize: 30000, current: 1, total: 0 })

const statuses = ['进行中', '完成', '异常', '待开始']
const priorities = ['P0', 'P1', 'P2', 'P3']
const tasks = ['接口开发', '页面设计', '单元测试', '性能优化', '代码审查', '需求分析', '部署上线', '文档编写']

function generateData(count: number) {
  const data: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    const status = statuses[i % statuses.length]
    data.push({
      id: i,
      name: `成员${(i % 15) + 1}`,
      taskName: `${tasks[i % tasks.length]}-${Math.ceil(i / 8)}`,
      status,
      priority: priorities[i % priorities.length],
      progress: status === '完成' ? '100%' : status === '异常' ? '—' : `${Math.floor(Math.random() * 80)}%`,
      startDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`,
      deadline: `2024-${String((i % 12) + 1).padStart(2, '0')}-${15 + (i % 15)}`,
      remark: `任务${i}的备注说明，这里展示了文本过长时的省略效果和Tooltip提示功能`,
    })
  }
  return data
}

const tableData = ref<Record<string, unknown>[]>([])

onMounted(() => {
  tableData.value = generateData(30000)
  pagination.value.total = tableData.value.length
})
</script>

<style>
.row-danger {
  background-color: rgba(245, 108, 108, 0.08) !important;
}
.row-success {
  background-color: rgba(103, 194, 58, 0.08) !important;
}
</style>

<style scoped>
.virtual-row-style-demo {
  padding: 0;
}
</style>
