<template>
  <div class="example-basic-form">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
    />
    <div v-if="submitted" class="result-box">
      <h4>提交结果:</h4>
      <pre>{{ JSON.stringify(formModel, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { EsForm } from '@es-plus/adapter-antdv'

const formRef = ref()
const formModel = ref({
  name: '',
  age: '',
  email: ''
})

const submitted = ref(false)

const formItems = [
  {
    prop: 'name',
    label: '姓名',
    formtype: 'Input',
    span: 12,
    attrs: { placeholder: '请输入姓名' }
  },
  {
    prop: 'age',
    label: '年龄',
    formtype: 'Input',
    span: 12,
    attrs: { placeholder: '请输入年龄', type: 'number' }
  },
  {
    prop: 'email',
    label: '邮箱',
    formtype: 'Input',
    span: 24,
    attrs: { placeholder: '请输入邮箱' }
  }
]

/**
 * configBtn 的 click 契约是 (model, formRef, httpRequestInstance)：
 * 提交前先 validate()，失败就停；重置用内建 key 'rest'（组件会 resetFields）。
 */
const configBtn = [
  { name: '重置', key: 'rest' },
  {
    name: '提交',
    key: 'submit',
    type: 'primary',
    click: async (model, ref) => {
      const ok = await ref?.validate()
      if (!ok) return
      submitted.value = true
      message.success('表单提交成功')
    }
  }
]
</script>

<style scoped>
.example-basic-form {
  padding: 20px;
}
.result-box {
  margin-top: 20px;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 4px;
}
.result-box h4 {
  margin-bottom: 8px;
  color: #595959;
}
.result-box pre {
  margin: 0;
  font-size: 13px;
  color: #1677ff;
}
</style>
