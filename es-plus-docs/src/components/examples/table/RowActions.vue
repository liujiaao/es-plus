<template>
  <div class="example-row-actions">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup>
import { ref, h } from 'vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'
import EsTable from 'es-plus/components/es-table'

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
    btns: [
      { name: '编辑', type: 'primary', 
      clickEvent: (row) => ElMessage.info(`编辑: ${row.name}`) },
      { name: '提交审核',
       type: 'warning',
        clickEvent: (row) => ElMessage.success(`已提交: ${row.name}`) },
      { name: '删除', type: 'danger',
       clickEvent: (row) => handleDelete(row) }
    ]
  }
]

const tableOptions = {
  border: true,
  // leftText: '产品列表',
  configBtn: [
    { name: '新增', type: 'primary', icon: Plus, code: 2, click: () => ElMessage.success('新增产品') },
    { name: '批量审核', type: 'warning', code: 2, disabled: () => userRole.value !== 'admin', click: () => ElMessage.success('批量审核') },
    { name: '导出', type: 'success', icon: Download, code: 2, click: () => ElMessage.success('导出数据') }
  ]
}
</script>

<style scoped>
.example-row-actions {
  padding: 0;
}
</style>
