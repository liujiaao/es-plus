<template>
  <div class="example-crud-row-confirm">
    <es-crud-page
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const mockData = ref([
  { id: 1, title: '年度报告 2024', type: '财务', status: 'published' },
  { id: 2, title: '技术方案 v2.0', type: '技术', status: 'draft' },
  { id: 3, title: '用户调研报告', type: '产品', status: 'review' },
  { id: 4, title: 'Q1 运营数据', type: '运营', status: 'published' },
  { id: 5, title: '竞品分析', type: '产品', status: 'draft' },
  { id: 6, title: '服务器迁移方案', type: '技术', status: 'review' }
])

const schema = {
  formItems: [
    { prop: 'title', label: '标题', formtype: 'Input' },
    { prop: 'type', label: '类型', formtype: 'Select',
      dataOptions: [
        { label: '财务', value: '财务' },
        { label: '技术', value: '技术' },
        { label: '产品', value: '产品' },
        { label: '运营', value: '运营' }
      ] }
  ],
  columns: [
    { prop: 'title', label: '标题', minWidth: 160 },
    { prop: 'type', label: '类型', width: 100 },
    { prop: 'status', label: '状态', width: 100 }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async () => ({
      data: mockData.value, total: mockData.value.length, pageSize: 10, pageIndex: 1
    }),
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增文档', type: 'primary', icon: 'Plus', dialogKey: 'add' },
    { name: '批量归档', type: 'warning', confirm: '确定将所有已发布文档归档吗？', actionType: 'archive' }
  ],
  operationColumn: {
    label: '操作',
    width: 260,
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '发布', type: 'success', key: 'publish', confirm: '确定发布此文档？发布后不可撤回。' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '此操作将永久删除该文档，是否继续？' }
    ]
  },
  dialogs: {
    add: {
      title: '新增文档',
      width: '500px',
      formItems: [
        { prop: 'title', label: '标题', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入标题' }] } },
        { prop: 'type', label: '类型', formtype: 'Select',
          dataOptions: [
            { label: '财务', value: '财务' },
            { label: '技术', value: '技术' },
            { label: '产品', value: '产品' },
            { label: '运营', value: '运营' }
          ] }
      ]
    },
    edit: {
      title: '编辑文档',
      width: '500px',
      formItems: [
        { prop: 'title', label: '标题', formtype: 'Input' },
        { prop: 'type', label: '类型', formtype: 'Select',
          dataOptions: [
            { label: '财务', value: '财务' },
            { label: '技术', value: '技术' },
            { label: '产品', value: '产品' },
            { label: '运营', value: '运营' }
          ] }
      ]
    }
  }
}

const handleDialogConfirm = (dialogKey, data) => {
  ElMessage.success(`[${dialogKey}] 确认: ${data.title}`)
}

const handleBtnClick = (key, payload) => {
  if (key === 'delete') ElMessage.success(`已删除: ${payload?.title}`)
  if (key === 'publish') ElMessage.success(`已发布: ${payload?.title}`)
  if (key === 'archive') ElMessage.info('批量归档完成')
}
</script>

<style scoped>
.example-crud-row-confirm { padding: 0; }
</style>
