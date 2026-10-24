<template>
  <div class="example-custom-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true }"
    >
      <template #avatar="{ row }">
        <div class="user-avatar">
          <el-avatar :size="32" :src="row.avatar" />
          <span class="user-name">{{ row.manager }}</span>
        </div>
      </template>
      <template #status="{ row }">
        <el-tag :type="getStatusType(row.status)" size="small">
          {{ getStatusText(row.status) }}
        </el-tag>
      </template>
      <template #progress="{ row }">
        <el-progress :percentage="row.progress" :status="row.progress === 100 ? 'success' : ''" />
      </template>
    </es-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsTable } from '@es-plus/vue3'
import { ElButton, ElMessage, ElMessageBox, ElTag, ElProgress, ElAvatar } from 'element-plus'

const tableData = ref([
  { id: 1, name: '项目A', status: 'active', progress: 75, manager: '张三', budget: 120000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' },
  { id: 2, name: '项目B', status: 'completed', progress: 100, manager: '李四', budget: 86000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' },
  { id: 3, name: '项目C', status: 'pending', progress: 30, manager: '王五', budget: 45000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' },
  { id: 4, name: '项目D', status: 'active', progress: 60, manager: '赵六', budget: 230000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' }
])

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '项目名称' },
  { prop: 'avatar', label: '负责人', width: 120, scopedSlots: { customRender: 'avatar' } },
  { prop: 'status', label: '状态', width: 100, scopedSlots: { customRender: 'status' } },
  { prop: 'progress', label: '进度', width: 180, scopedSlots: { customRender: 'progress' } },
  // 第三种写法：formatter 只改「文本」，不渲染节点；表格里所有列默认都走它
  { prop: 'budget', label: '预算', width: 120, align: 'right', formatter: (row) => `¥${row.budget.toLocaleString()}` },
  {
    prop: 'action',
    label: '操作',
    // ElButton 是组件，子节点必须用函数式插槽 () => '文本'；直接传字符串会触发
    // "Non-function value encountered for default slot" 告警
    render: (h, { row }) => h('div', [
      h(ElButton, { link: true, type: 'primary', size: 'small', onClick: () => handleEdit(row) }, () => '编辑'),
      h(ElButton, { link: true, type: 'danger', size: 'small', onClick: () => handleDelete(row) }, () => '删除')
    ])
  }
]

const getStatusType = (status) => {
  const map = { active: 'primary', completed: 'success', pending: 'warning' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { active: '进行中', completed: '已完成', pending: '待开始' }
  return map[status] || status
}

const handleEdit = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('修改项目名称', '编辑', {
      inputValue: row.name,
      inputValidator: (v) => !!v || '名称不能为空'
    })
    row.name = value
    ElMessage.success('已保存')
  } catch {
    // 取消编辑
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
    const idx = tableData.value.findIndex((r) => r.id === row.id)
    if (idx > -1) tableData.value.splice(idx, 1)
    ElMessage.success('已删除')
  } catch {
    // 取消删除
  }
}
</script>

<style scoped>
.example-custom-table {
  padding: 0;
}
.user-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-name {
  font-size: 14px;
}
</style>
