<template>
  <es-form
    :key="formKey"
    :form-item-list="formItemList"
    :model="formData"
  />
</template>

<script>
export default {
  name: 'FormDynamicRule',
  data() {
    return {
      formKey: 0,
      formData: {
        name: '',
        email: '',
        requireEmail: false
      },
      formItemList: []
    }
  },
  created() {
    this.formItemList = [
      {
        prop: 'name',
        label: '姓名',
        span: 12,
        formtype: 'Input',
        formItemOptions: {
          rules: [{ required: true, message: '请输入姓名' }]
        }
      },
      {
        prop: 'requireEmail',
        label: '需要邮箱',
        span: 12,
        formtype: 'Switch'
      },
      {
        prop: 'email',
        label: '邮箱',
        span: 12,
        formtype: 'Input',
        formItemOptions: {
          rules: this.formData.requireEmail
            ? [
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式错误' }
              ]
            : []
        },
        isHiden: () => !this.formData.requireEmail
      }
    ]
  },
  methods: {
    updateRules() {
      this.formKey++
    }
  }
}
</script>
