<template>
  <div class="example-dialog-dynamic-btn">
    <a-button type="primary" @click="openApprovalDialog">审批弹窗</a-button>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { message, Radio, Input } from 'ant-design-vue'
import { useDialog } from '@es-plus/adapter-antdv'

const RadioGroup = Radio.Group

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
          <RadioGroup value={action.value} onUpdate:value={(v) => { action.value = v }}>
            <Radio value="approve">通过</Radio>
            <Radio value="reject">驳回</Radio>
            <Radio value="return">退回修改</Radio>
          </RadioGroup>
        </div>
        <div>
          <label style="display: block; margin-bottom: 10px; font-weight: 500">
            {action.value === 'approve' ? '审批意见（选填）' : '审批意见（必填）'}:
          </label>
          <Input.TextArea
            value={reason.value}
            onUpdate:value={(v) => { reason.value = v }}
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
        click: (_, { close }) => {
          if (action.value !== 'approve' && !reason.value.trim()) {
            message.warning('请输入审批意见')
            return
          }
          const actionText = { approve: '通过', reject: '驳回', return: '退回' }[action.value]
          message.success(`已${actionText}`)
          close()
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
