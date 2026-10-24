<template>
  <div class="example-custom-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true }"
    >
      <template #avatar="{ row }">
        <div class="user-avatar">
          <a-avatar :size="32" :src="row.avatar" />
          <span class="user-name">{{ row.manager }}</span>
        </div>
      </template>
      <template #status="{ row }">
        <a-tag :color="getStatusType(row.status)">
          {{ getStatusText(row.status) }}
        </a-tag>
      </template>
      <template #progress="{ row }">
        <a-progress :percent="row.progress" :status="row.progress === 100 ? 'success' : 'normal'" />
      </template>
    </es-table>

    <a-modal
      v-model:open="editOpen"
      title="编辑项目"
      ok-text="保存"
      cancel-text="取消"
      @ok="saveEdit"
    >
      <a-form layout="vertical">
        <a-form-item label="项目名称">
          <a-input v-model:value="editForm.name" placeholder="请输入项目名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'
import { Button, Modal, message } from 'ant-design-vue'

// ref 而不是普通数组：编辑/删除要能驱动表格重渲染
const tableData = ref([
  { id: 1, name: '项目A', status: 'active', progress: 75, manager: '张三', budget: 120000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' },
  { id: 2, name: '项目B', status: 'completed', progress: 100, manager: '李四', budget: 86000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' },
  { id: 3, name: '项目C', status: 'pending', progress: 30, manager: '王五', budget: 45000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' },
  { id: 4, name: '项目D', status: 'active', progress: 60, manager: '赵六', budget: 230000, avatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png' }
])

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '项目名称' },
  // 写法一：具名插槽 —— 复杂结构（头像 + 文案）交给模板
  { prop: 'avatar', label: '负责人', width: 120, scopedSlots: { customRender: 'avatar' } },
  { prop: 'status', label: '状态', width: 100, scopedSlots: { customRender: 'status' } },
  { prop: 'progress', label: '进度', width: 180, scopedSlots: { customRender: 'progress' } },
  // 写法三：formatter 只改文本、不渲染节点；同一列其余渲染路径都不受影响
  { prop: 'budget', label: '预算', width: 120, align: 'right', formatter: (row) => `¥${row.budget.toLocaleString()}` },
  {
    prop: 'action',
    label: '操作',
    // 写法二：render 函数 —— Button 是组件，子节点必须是函数式插槽，
    // 直接传字符串会触发 "Non-function value encountered for default slot" 告警
    render: (h, { row }) => h('div', [
      h(Button, { type: 'link', size: 'small', onClick: () => handleEdit(row) }, { default: () => '编辑' }),
      h(Button, { type: 'link', danger: true, size: 'small', onClick: () => handleDelete(row) }, { default: () => '删除' })
    ])
  }
]

const getStatusType = (status) => {
  const map = { active: 'processing', completed: 'success', pending: 'warning' }
  return map[status] || 'default'
}

const getStatusText = (status) => {
  const map = { active: '进行中', completed: '已完成', pending: '待开始' }
  return map[status] || status
}

// ── 行操作：改的是 tableData 本身，保存/删除后表格立刻可见 ──
const editOpen = ref(false)
const editForm = ref({ id: null, name: '' })

const handleEdit = (row) => {
  editForm.value = { id: row.id, name: row.name }
  editOpen.value = true
}

const saveEdit = () => {
  const name = editForm.value.name.trim()
  if (!name) {
    message.warning('名称不能为空')
    return
  }
  const row = tableData.value.find((r) => r.id === editForm.value.id)
  if (row) row.name = name
  editOpen.value = false
  message.success('已保存')
}

const handleDelete = (row) => {
  Modal.confirm({
    title: '删除确认',
    content: `确定删除「${row.name}」？`,
    okType: 'danger',
    onOk() {
      const idx = tableData.value.findIndex((r) => r.id === row.id)
      if (idx > -1) tableData.value.splice(idx, 1)
      message.success('已删除')
    }
  })
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
