<template>
  <div class="example-row-actions">
    <div class="role-switch">
      <span>当前角色：</span>
      <el-radio-group v-model="userRole" size="small">
        <el-radio-button value="admin">管理员</el-radio-button>
        <el-radio-button value="editor">编辑</el-radio-button>
        <el-radio-button value="viewer">只读</el-radio-button>
      </el-radio-group>
      <span class="tip">行按钮按行状态显隐，工具栏按钮按角色禁用——切换角色即可观察</span>
    </div>
    <es-table
      ref="tableRef"
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

// 角色只决定「当前用户能干什么」，与行状态是两个正交的显隐来源：
// 行状态 → btns.hidden(row)，角色 → configBtn.disabled / btns.hidden()
const userRole = ref('admin')
const tableRef = ref(null)

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

// ── 行内动作：都真的改数据 ──────────────────────────────
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

// ── 工具栏动作：新增一行、批量审核勾选行、导出真实 CSV ──
const handleAdd = () => {
  const id = Math.max(0, ...tableData.value.map(r => r.id)) + 1
  tableData.value.push({ id, name: `产品${id}`, status: 'draft', creator: '当前用户' })
  ElMessage.success('已新增一行（状态：草稿）')
}

const handleBatchApprove = () => {
  // 勾选列是声明式的，选中集合问表格要：getSelectionRows() 返回行对象引用，
  // 直接改状态即可同步回 data-source，不需要额外的 id 映射。
  const rows = tableRef.value?.getSelectionRows?.() || []
  if (!rows.length) {
    ElMessage.warning('请先勾选要审核的行')
    return
  }
  rows.forEach(row => { row.status = 'approved' })
  ElMessage.success(`已通过 ${rows.length} 条`)
}

const handleExport = () => {
  const header = ['ID', '产品名称', '状态', '创建人']
  const lines = [
    header.join(','),
    ...tableData.value.map(row => [row.id, row.name, statusMap[row.status]?.text || row.status, row.creator].join(','))
  ]
  // \uFEFF：BOM，让 Excel 按 UTF-8 打开中文不乱码
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '产品列表.csv'
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${tableData.value.length} 条`)
}

const columns = [
  { type: 'selection', width: 45 },
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
    // btns 的 hidden 是「按行求值」的函数：按钮随行状态 + 角色显隐，
    // 不需要在点击回调里再判断一次。函数里读到的 ref 会被渲染追踪，切换角色即刷新。
    btns: [
      { name: '编辑', type: 'primary', hidden: () => userRole.value === 'viewer', clickEvent: (row) => handleEdit(row) },
      // 只有草稿/已驳回的行才出现「提交审核」，只读角色不出现
      { name: '提交审核', type: 'warning', hidden: (row) => userRole.value === 'viewer' || !['draft', 'rejected'].includes(row.status), clickEvent: (row) => handleSubmit(row) },
      // 已通过的行不可删除（按行隐藏），且只有管理员能删
      { name: '删除', type: 'danger', hidden: (row) => userRole.value !== 'admin' || row.status === 'approved', clickEvent: (row) => handleDelete(row) }
    ]
  }
]

const tableOptions = {
  border: true,
  leftText: '产品列表',
  configBtn: [
    { name: '新增', type: 'primary', icon: Plus, disabled: () => userRole.value === 'viewer', click: handleAdd },
    // disabled 同样支持函数：仅管理员可批量审核（编辑与只读都置灰）
    { name: '批量审核', type: 'warning', disabled: () => userRole.value !== 'admin', click: handleBatchApprove },
    { name: '导出', type: 'success', icon: Download, code: 2, click: handleExport }
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
  color: var(--es-text-regular);
}
.role-switch .tip {
  color: var(--es-text-secondary);
  font-size: 12px;
}
</style>
