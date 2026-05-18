<template>
  <div class="example-validation-form">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :rules="rules"
      :config-btn="configBtn"
    />
  </div>
</template>

<script setup>
import { EsForm } from 'es-plus'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const formRef = ref()

const formModel = ref({
  username: '',
  email: '',
  phone: '',
  password: ''
})

// 表单验证规则
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ]
}

const formItems = [
  { prop: 'username', label: '用户名', formtype: 'Input', span: 24, attrs: { placeholder: '3-20个字符', clearable: true } },
  { prop: 'email', label: '邮箱', formtype: 'Input', span: 12, attrs: { placeholder: 'example@mail.com', clearable: true } },
  { prop: 'phone', label: '手机号', formtype: 'Input', span: 12, attrs: { placeholder: '11位手机号', clearable: true } },
  { prop: 'password', label: '密码', formtype: 'Input', span: 24, attrs: { placeholder: '至少6位', type: 'password', showPassword: true } }
]

// 按钮配置 - 使用 key: 'query' 触发表单验证
const configBtn = [
  {
    name: '提交',
    key: 'query',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: async (model, formRef) => {
     // ElMessage.success('验证通过，表单提交成功！')
       await formRef.validate()
      console.log('提交的表单数据:', model)
    }
  },
  {
    name: '重置',
    key: 'rest',
    direction: 'right',
    icon: 'RefreshLeft'
  }
]

// 确认提交 - 配合 key: 'query' 使用，组件内部会自动验证
const handleConfirm = (formRefInstance, model) => {
  ElMessage.success('验证通过，表单提交成功！')
  console.log('提交的表单数据:', model)
}

// 重置表单
const handleReset = (formRefInstance, model) => {
  ElMessage.info('表单已重置')
}
</script>

<style scoped>
.example-validation-form {
  padding: 20px;
}
</style>
