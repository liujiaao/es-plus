<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
    :config-btn="configBtn"
  />
</template>

<script>
export default {
  name: 'FormLayout',
  data() {
    return {
      formData: {
        field1: '',
        field2: '',
        field3: '',
        field4: '',
        field5: '',
        field6: ''
      },
      layoutProps: {
        fromLayProps: {
          labelWidth: '120px',
          size: 'small',
          minfoldRows: 2
        },
        rowLayProps: {
          gutter: 20
        }
      },
      configBtn: [
        {
          name: '查询',
          type: 'primary',
          click: (model, formRef) => {
            this.$message.success('查询参数: ' + JSON.stringify(model))
          }
        },
        {
          name: '重置',
          click: (model, formRef) => {
            formRef.resetFields()
          }
        }
      ],
      formItemList: [
        {
          prop: 'field1',
          label: '字段1',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: 'span=8 占据1/3行' }
        },
        {
          prop: 'field2',
          label: '字段2',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: 'span=8 占据1/3行' }
        },
        {
          prop: 'field3',
          label: '字段3',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: 'span=8 占据1/3行' }
        },
        {
          prop: 'field4',
          label: '字段4',
          span: 12,
          formtype: 'Input',
          attrs: { placeholder: 'span=12 占据半行' }
        },
        {
          prop: 'field5',
          label: '字段5',
          span: 12,
          formtype: 'Input',
          attrs: { placeholder: 'span=12 占据半行' }
        },
        {
          prop: 'field6',
          label: '字段6（被折叠）',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: '超过minfoldRows折叠' }
        }
      ]
    }
  },
  methods: {
    submitForm(model) {
      this.$message.success('查询参数: ' + JSON.stringify(model))
    },
    resetForm(formRef) {
      formRef.resetFields()
    }
  }
}
</script>
