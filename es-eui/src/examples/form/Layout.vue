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
        formLayProps: {
          labelWidth: '120px',
          size: 'small',
          minFoldRows: 2
        },
        rowLayProps: {
          gutter: 20
        }
      },
      // 按钮区也是布局的一部分：direction 决定按钮落在左栏还是右栏（默认右栏）
      configBtn: [
        {
          name: '重置',
          direction: 'left',
          click: (_, formRef) => {
            formRef.resetFields()
          }
        },
        {
          name: '查询',
          type: 'primary',
          direction: 'right',
          click: (model) => {
            this.$message.success('查询参数: ' + JSON.stringify(model))
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
          attrs: { placeholder: '超过minFoldRows折叠' }
        }
      ]
    }
  }
}
</script>
