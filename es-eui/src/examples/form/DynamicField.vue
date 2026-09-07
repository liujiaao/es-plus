<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
  />
</template>

<script>
export default {
  name: 'FormDynamicField',
  data() {
    return {
      formData: {
        userType: 'personal',
        companyName: '',
        businessLicense: '',
        personalName: '',
        idCard: ''
      },
      formItemList: [
        {
          prop: 'userType',
          label: '用户类型',
          span: 24,
          formtype: 'Radio',
          dataOptions: [
            { label: '个人用户', value: 'personal' },
            { label: '企业用户', value: 'company' }
          ],
          on: {
            change: (val) => console.log('类型切换:', val)
          }
        },
        {
          prop: 'companyName',
          label: '公司名称',
          span: 12,
          formtype: 'Input',
          attrs: { placeholder: '请输入公司名称' },
          isHiden: (model) => model.userType !== 'company'
        },
        {
          prop: 'businessLicense',
          label: '营业执照',
          span: 12,
          formtype: 'Input',
          attrs: { placeholder: '请输入营业执照号' },
          isHiden: (model) => model.userType !== 'company'
        },
        {
          prop: 'personalName',
          label: '个人姓名',
          span: 12,
          formtype: 'Input',
          attrs: { placeholder: '请输入个人姓名' },
          isHiden: (model) => model.userType !== 'personal'
        },
        {
          prop: 'idCard',
          label: '身份证号',
          span: 12,
          formtype: 'Input',
          attrs: { placeholder: '请输入身份证号' },
          isHiden: (model) => model.userType !== 'personal'
        }
      ]
    }
  }
}
</script>
