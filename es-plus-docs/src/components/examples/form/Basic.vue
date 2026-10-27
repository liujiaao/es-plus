<template>
  <div class="example-basic-form">
    <!-- 最简表单：字段、校验、布局全部来自配置，模板里只有一行 es-form -->
    <es-form :model="formModel" :form-item-list="formItems" />
    <div class="value-preview">
      <span class="label">当前模型</span>
      <code>{{ JSON.stringify(formModel) }}</code>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsForm } from '@es-plus/vue3'

const formModel = ref({
  name: '',
  age: 18,
  email: ''
})

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12, attrs: { placeholder: '请输入姓名' } },
  { prop: 'age', label: '年龄', formtype: 'InputNumber', span: 12, attrs: { min: 0, max: 150 } },
  { prop: 'email', label: '邮箱', formtype: 'Input', span: 24, attrs: { placeholder: '请输入邮箱' } }
]
</script>

<style scoped>
.example-basic-form {
  padding: 4px 0;
}
.value-preview {
  margin-top: 12px;
  padding: 10px 12px;
  background-color: var(--es-fill);
  border-radius: 4px;
  font-size: 12px;
  color: var(--es-text-regular);
  overflow-x: auto;
}
.value-preview .label {
  margin-right: 8px;
  color: var(--es-text-secondary);
}
</style>
