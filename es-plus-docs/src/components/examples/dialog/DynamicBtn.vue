<template>
  <div class="example-dialog-dynamic-btn">
    <el-button type="primary" @click="openApprovalDialog">审批弹窗</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { ElMessage, ElRadioGroup, ElRadio, ElInput } from 'element-plus'
import { useDialog } from 'es-plus'

const dialog = useDialog()

const openApprovalDialog = () => {
  const action = ref('approve')
  const reason = ref('')

  dialog({
    title: '审批处理',
    width: '500px',
    render: () => (
      <div style="padding: 10px 20px">
        <div style="margin-bottom: 20px">
          <label style="display: block; margin-bottom: 10px; font-weight: 500">审批操作:</label>
          <ElRadioGroup v-model={action.value}>
            <ElRadio value="approve">通过</ElRadio>
            <ElRadio value="reject">驳回</ElRadio>
            <ElRadio value="return">退回修改</ElRadio>
          </ElRadioGroup>
        </div>
        <div>
          <label style="display: block; margin-bottom: 10px; font-weight: 500">
            {action.value === 'approve' ? '审批意见（选填）' : '审批意见（必填）'}:
          </label>
          <ElInput
            v-model={reason.value}
            type="textarea"
            rows={3}
            placeholder={action.value === 'approve' ? '请输入审批意见' : '请输入驳回/退回原因'}
          />
        </div>
      </div>
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '确定',
        type: 'primary',
        icon: 'Check',
        disabled: () => action.value !== 'approve' && !reason.value.trim(),
        click: () => {
          if (action.value !== 'approve' && !reason.value.trim()) {
            ElMessage.warning('请输入审批意见')
            return
          }
          const actionText = { approve: '通过', reject: '驳回', return: '退回' }[action.value]
          ElMessage.success(`已${actionText}`)
        }
      }
    ]
  })
}
</script>

<style scoped>
.example-dialog-dynamic-btn {
  padding: 20px;
}
</style>
