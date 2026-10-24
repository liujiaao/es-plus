<template>
  <div class="example-row-actions">
    <div class="role-switch">
      <span>当前角色：</span>
      <el-radio-group v-model="userRole" size="small">
        <el-radio-button value="admin">管理员</el-radio-button>
        <el-radio-button value="viewer">普通用户</el-radio-button>
      </el-radio-group>
      <span class="tip">切换角色可看到工具栏按钮的 disabled 随权限变化</span>
    </div>
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/vue3'
import { ref, h } from 'vue'
import { ElMessage, ElMessageBox, ElTag, ElRadioGroup, ElRadioButton } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'

const userRole = ref('admin')

const statusMap = {
  draft: { text: '草稿', type: 'info' },
  pending: { text: '待审核', type: 'warning' },
  approved: { text: '已通过', type: 'success' },
  rejected: { text: '已驳回', type: 'danger' }
}

const tableData = ref([
  { id: 1, name: '产品A', status: 'draft', creator: '张三' },
  { id: 2, name: '产品B', status: 'pending', creator: '李四' },
  { id: 3, name: '产品C', status: 'approved', creator: '王五' },
  { id: 4, name: '产品D', status: 'rejected', creator: '赵六' },
  { id: 5, name: '产品E', status: 'pending', creator: '孙七' },
  { id: 6, name: '产品F', status: 'approved', creator: '周八' }
])

const handleEdit = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('修改产品名称', '编辑', { inputValue: row.name })
    row.name = value
    ElMessage.success('已保存')
  } catch { /* 取消 */ }
}

const handleSubmit = (row) => {
  row.status = 'pending'
  ElMessage.success(`「${row.name}」已提交审核`)
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.name}" 吗？`, '提示', { type: 'warning' })
    tableData.value = tableData.value.filter(d => d.id !== row.id)
    ElMessage.success('删除成功')
  } catch { /* 取消 */ }
}

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '产品名称', minWidth: 120 },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return h(ElTag, { type: s.type, size: 'small' }, () => s.text)
    }
  },
  { prop: 'creator', label: '创建人', width: 100 },
  {
    prop: 'operate',
    label: '操作',
    width: 250,
    // btns 的 hidden / disabled 都是「按行求值」的函数：
    // 按钮随行状态显隐，不需要在点击回调里再判断一次
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => handleEdit(row) },
      // 只有草稿/已驳回的行才出现「提交审核」
      { name: '提交审核', type: 'warning', hidden: (row) => !['draft', 'rejected'].includes(row.status), clickEvent: (row) => handleSubmit(row) },
      // 已通过的行不可删除
      { name: '删除', type: 'danger', hidden: (row) => row.status === 'approved', clickEvent: (row) => handleDelete(row) }
    ]
  }
]

const tableOptions = {
  border: true,
  configBtn: [
    { name: '新增', type: 'primary', icon: Plus, code: 2, click: () => ElMessage.success('新增产品') },
    // disabled 同样支持函数：仅管理员可批量审核
    { name: '批量审核', type: 'warning', code: 2, disabled: () => userRole.value !== 'admin', click: () => ElMessage.success('批量审核') },
    { name: '导出', type: 'success', icon: Download, code: 2, click: () => ElMessage.success('导出数据') }
  ]
}
</script>

<style scoped>
.example-row-actions {
  padding: 0;
}
.role-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}
.role-switch .tip {
  color: #909399;
  font-size: 12px;
}
</style>
