<template>
  <div class="virtual-select-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 多选 + 跨页记忆 + 操作按钮</h4>
    <div style="margin-bottom: 12px;">
      <el-button type="primary" size="small" @click="getSelection">获取选中行</el-button>
      <el-button size="small" @click="clearSelection">清空选择</el-button>
      <el-tag v-if="selectedCount > 0" type="info" style="margin-left: 12px;">
        已选 {{ selectedCount }} 条
      </el-tag>
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

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { ElMessage, ElTag } from 'element-plus'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const selectedCount = ref(0)

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'status', label: '状态', width: 100,
    render: (_h: any, { row }: any) => {
      const statusMap: Record<string, { type: string; text: string }> = {
        active: { type: 'success', text: '活跃' },
        inactive: { type: 'info', text: '不活跃' },
        blocked: { type: 'danger', text: '封禁' },
      }
      const s = statusMap[row.status as string] || { type: 'info', text: row.status }
      return h(ElTag, { type: s.type as any, size: 'small' }, () => s.text)
    }
  },
  { prop: 'email', label: '邮箱', minWidth: 200 },
  { prop: 'role', label: '角色', width: 120 },
  { prop: 'lastLogin', label: '最后登录', width: 160 },
  { prop: 'operate', label: '操作', width: 160, fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row: any) => ElMessage.info(`编辑: ${row.name}`) },
      { name: '删除', type: 'danger', clickEvent: (row: any) => ElMessage.warning(`删除: ${row.name}`) },
    ]
  },
]

const tableOptions = {
  virtual: true,
  border: true,
  multiSelect: true,
  rowkey: 'id',
  rowHeight: 48,
  heightType: 'height' as const,
  tabHeight: 450,
  highlightCurrentRow: true,
}

const pagination = ref({ pageSize: 100000, current: 1, total: 0 })
const statuses = ['active', 'inactive', 'blocked']
const roles = ['管理员', '编辑', '审核员', '普通用户', '访客']

function generateData(count: number) {
  const data: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    const date = new Date(2023, 0, 1)
    date.setMinutes(date.getMinutes() + i * 7)
    data.push({
      id: i,
      name: `用户${i}`,
      status: statuses[i % statuses.length],
      email: `user${i}@company.com`,
      role: roles[i % roles.length],
      lastLogin: date.toLocaleString('zh-CN'),
    })
  }
  return data
}

const tableData = ref<Record<string, unknown>[]>([])

function getSelection() {
  const rows = tableRef.value?.getSelectionRows() || []
  selectedCount.value = rows.length
  ElMessage.success(`当前选中 ${rows.length} 条数据`)
}

function clearSelection() {
  tableRef.value?.clearSelection()
  selectedCount.value = 0
}

onMounted(() => {
  tableData.value = generateData(100000)
  pagination.value.total = tableData.value.length
})
</script>

<style scoped>
.virtual-select-demo {
  padding: 0;
}
</style>
