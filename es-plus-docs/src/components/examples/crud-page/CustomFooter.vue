<template>
  <div class="example-crud-custom-footer">
    <es-crud-page
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
      @dialog-cancel="handleDialogCancel"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { ElMessage } from 'element-plus'

const mockData = [
  { id: 1, title: '采购申请 #2024001', amount: 12000, applicant: '张三', status: '待审批' },
  { id: 2, title: '报销单 #2024015', amount: 3500, applicant: '李四', status: '待审批' },
  { id: 3, title: '出差申请 #2024008', amount: 8000, applicant: '王五', status: '已通过' },
  { id: 4, title: '采购申请 #2024002', amount: 45000, applicant: '赵六', status: '已拒绝' },
  { id: 5, title: '报销单 #2024016', amount: 1200, applicant: '孙七', status: '待审批' }
]

const schema = {
  formItems: [
    { prop: 'title', label: '标题', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [
        { label: '待审批', value: '待审批' },
        { label: '已通过', value: '已通过' },
        { label: '已拒绝', value: '已拒绝' }
      ] }
  ],
  columns: [
    { prop: 'title', label: '标题', minWidth: 180 },
    { prop: 'amount', label: '金额(元)', width: 120 },
    { prop: 'applicant', label: '申请人', width: 100 },
    { prop: 'status', label: '状态', width: 100 }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async () => ({ data: mockData, total: mockData.length, pageSize: 10, pageIndex: 1 }),
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  operationColumn: {
    width: 100,
    btns: [
      { name: '审批', type: 'primary', dialogKey: 'approve' }
    ]
  },
  dialogs: {
    approve: {
      title: (row) => `审批 — ${row?.title || ''}`,
      width: '500px',
      formItems: [
        { prop: 'remark',
          label: '审批意见', 
          formtype: 'Input',
          span: 24,
          attrs: { type: 'textarea', rows: 3, placeholder: '请输入审批意见...' },
          formItemOptions: { 
            rules: [{ required: true, message: '请填写审批意见' }] }
           }
      ],
      configBtn: [
        { name: '取消', action: 'cancel' },
        { name: '拒绝', type: 'danger', key: 'reject', action: 'custom' },
        { name: '通过', type: 'success', key: 'pass', action: 'confirm' }
      ]
    }
  }
}

const handleDialogConfirm = (key, data) => {
  ElMessage.success(`[${key}] 审批通过，意见: ${data.remark}`)
}

const handleDialogCancel = (key) => {
  ElMessage.info(`[${key}] 已取消`)
}

const handleBtnClick = (key, payload) => {
  if (key === 'reject') ElMessage.warning(`已拒绝，意见: ${payload?.remark || '无'}`)
}
</script>

<style scoped>
.example-crud-custom-footer { padding: 0; }
</style>
