<template>
  <div class="example-crud-custom-footer">
    <es-crud-page
      ref="crudRef"
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
      @dialog-cancel="handleDialogCancel"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsCrudPage } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const crudRef = ref(null)

// 当前审批的行：onOpen 时记下，拒绝/通过后据此改本地状态并刷新列表
let currentRow = null

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
      // onOpen 在表单数据就绪后调用：记下当前行，供自定义按钮回写状态
      onOpen: (row) => { currentRow = row },
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
        {
          name: '拒绝',
          type: 'danger',
          key: 'reject',
          action: 'custom',
          // action: 'custom' 不会替我们接线，click 必须自己写。
          // 取值走表单实例的 getFormRef()（EsForm 不暴露 model，ADV 表单实例用 getFieldsValue() 读值）
          click: async (_instance, { close, getRefs }) => {
            const form = getRefs('dialogForm')
            try {
              await form?.validate?.()
            } catch {
              return // 校验失败：表单已标红，停在本弹窗
            }
            const remark = form?.getFormRef?.()?.getFieldsValue?.()?.remark
            if (!remark) return message.warning('请填写审批意见')
            if (currentRow) {
              currentRow.status = '已拒绝'
              crudRef.value?.refresh?.()
            }
            message.warning(`已拒绝，意见：${remark}`)
            close()
          }
        },
        { name: '通过', type: 'primary', key: 'pass', action: 'confirm' }
      ]
    }
  }
}

const handleDialogConfirm = (key, data) => {
  if (currentRow) {
    currentRow.status = '已通过'
    crudRef.value?.refresh?.()
  }
  message.success(`[${key}] 审批通过，意见: ${data.remark}`)
}

const handleDialogCancel = (key) => {
  message.info(`[${key}] 已取消`)
}
</script>

<style scoped>
.example-crud-custom-footer { padding: 0; }
</style>
