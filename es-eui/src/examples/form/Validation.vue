<template>
  <es-form
    ref="validateForm"
    :form-item-list="formItemList"
    :model="formData"
    :config-btn="configBtn"
  />
</template>

<script>
export default {
  name: 'FormValidation',
  data() {
    return {
      formData: {
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
      },
      formItemList: [
        {
          prop: 'username',
          label: '用户名',
          span: 12,
          formtype: 'Input',
          formItemOptions: {
            rules: [
              { required: true, message: '请输入用户名', trigger: 'blur' },
              { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
            ]
          },
          attrs: { placeholder: '3-20个字符' }
        },
        {
          prop: 'email',
          label: '邮箱',
          span: 12,
          formtype: 'Input',
          formItemOptions: {
            rules: [
              { required: true, message: '请输入邮箱', trigger: 'blur' },
              { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
            ]
          },
          attrs: { placeholder: 'example@email.com' }
        },
        {
          prop: 'phone',
          label: '手机号',
          span: 12,
          formtype: 'Input',
          formItemOptions: {
            rules: [
              { required: true, message: '请输入手机号', trigger: 'blur' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
            ]
          },
          attrs: { placeholder: '11位手机号' }
        },
        {
          prop: 'password',
          label: '密码',
          span: 12,
          formtype: 'Input',
          formItemOptions: {
            rules: [
              { required: true, message: '请输入密码', trigger: 'blur' },
              { min: 6, message: '密码至少6位', trigger: 'blur' }
            ]
          },
          attrs: { type: 'password', placeholder: '至少6位' }
        }
      ],
      configBtn: [
        {
          name: '提交',
          type: 'primary',
          click: (model, formRef) => {
            formRef.validate((valid) => {
              if (valid) {
                this.$message.success('验证通过！')
              } else {
                this.$message.error('请检查表单填写')
              }
            })
          }
        },
        {
          name: '重置',
          click: (model, formRef) => {
            formRef.resetFields()
          }
        }
      ]
    }
  },
  methods: {
    submitForm() {
      this.$refs.validateForm.validate((valid) => {
        if (valid) {
          this.$message.success('验证通过！')
        } else {
          this.$message.error('请检查表单填写')
        }
      })
    }
  }
}
</script>
