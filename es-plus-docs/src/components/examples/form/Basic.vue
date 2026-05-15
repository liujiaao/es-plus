<template>
  <div class="example-basic-form">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      @confirm="handleSubmit"
      @reset="handleReset"
    />
    <div v-if="submitted" class="result-box">
      <h4>提交结果:</h4>
      <pre>{{ JSON.stringify(formModel, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

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

const handleSubmit = (formRef, model) => {
  submitted.value = true
  ElMessage.success('表单提交成功')
  console.log('提交数据:', model)
}

const handleReset = () => {
  submitted.value = false
  ElMessage.info('表单已重置')
}
</script>

<style scoped>
.example-basic-form {
  padding: 20px;
}
.result-box {
  margin-top: 20px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
.result-box h4 {
  margin-bottom: 8px;
  color: #606266;
}
.result-box pre {
  margin: 0;
  font-size: 13px;
  color: #409eff;
}
</style>
