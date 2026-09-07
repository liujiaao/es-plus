<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
  />
</template>

<script>
export default {
  name: 'FormBasic',
  data() {
    return {
      formData: {
        name: '',
        age: '',
        email: ''
      },
      formItemList: [
        {
          prop: 'name',
          label: '姓名',
          formtype: 'Input',
          attrs: { placeholder: '请输入姓名' }
        },
        {
          prop: 'age',
          label: '年龄',
          formtype: 'Input',
          attrs: { placeholder: '请输入年龄' }
        },
        {
          prop: 'email',
          label: '邮箱',
          formtype: 'Input',
          attrs: { placeholder: '请输入邮箱' }
        }
      ]
    }
  }
}
</script>
