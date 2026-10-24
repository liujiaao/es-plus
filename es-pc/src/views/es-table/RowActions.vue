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
import { EsTable } from '@es-plus/adapter-antdv'
import { ref, h } from 'vue'
import { message, Modal, Tag } from 'ant-design-vue'

const userRole = ref('admin')

const statusMap = {
  draft: { text: '草稿', color: 'default' },
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' }
}

const tableData = ref([
  { id: 1, name: '产品A', status: 'draft', creator: '张三' },
  { id: 2, name: '产品B', status: 'pending', creator: '李四' },
  { id: 3, name: '产品C', status: 'approved', creator: '王五' },
  { id: 4, name: '产品D', status: 'rejected', creator: '赵六' },
  { id: 5, name: '产品E', status: 'pending', creator: '孙七' },
  { id: 6, name: '产品F', status: 'approved', creator: '周八' }
])

// 注意：antdv 的 Modal.confirm 返回 { destroy, update }，不是 Promise，
// 直接 await 会在弹窗出现前就继续执行（取消也照删）。这里用 onOk/onCancel 包一层。
const confirmBox = (options) => new Promise((resolve) => {
  Modal.confirm({ ...options, onOk: () => resolve(true), onCancel: () => resolve(false) })
})

const handleDelete = async (row) => {
  const ok = await confirmBox({ title: '提示', content: `确定删除 "${row.name}" 吗？`, okType: 'primary', okButtonProps: { danger: true } })
  if (!ok) return
  tableData.value = tableData.value.filter(d => d.id !== row.id)
  message.success('删除成功')
}

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '产品名称', minWidth: 120 },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', color: 'default' }
      return h(Tag, { color: s.color }, () => s.text)
    }
  },
  { prop: 'creator', label: '创建人', width: 100 },
  {
    prop: 'operate',
    label: '操作',
    width: 250,
    btns: [
      { name: '编辑', type: 'primary', 
      clickEvent: (row) => message.info(`编辑: ${row.name}`) },
      { name: '提交审核',
       type: 'primary',
        clickEvent: (row) => message.success(`已提交: ${row.name}`) },
      { name: '删除', type: 'danger',
       clickEvent: (row) => handleDelete(row) }
    ]
  }
]

const tableOptions = {
  border: true,
  // leftText: '产品列表',
  configBtn: [
    { name: '新增', type: 'primary', icon: 'Plus', code: 2, click: () => message.success('新增产品') },
    { name: '批量审核', type: 'primary', code: 2, disabled: () => userRole.value !== 'admin', click: () => message.success('批量审核') },
    { name: '导出', type: 'default', icon: 'Download', code: 2, click: () => message.success('导出数据') }
  ]
}
</script>

<style scoped>
.example-row-actions {
  padding: 0;
}
</style>
