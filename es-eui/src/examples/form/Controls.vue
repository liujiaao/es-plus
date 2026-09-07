<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
  />
</template>

<script>
export default {
  name: 'FormControls',
  data() {
    return {
      formData: {
        name: '',
        gender: '',
        hobby: [],
        status: true,
        city: '',
        date: '',
        rate: 3,
        content: ''
      },
      layoutProps: {
        fromLayProps: { labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      formItemList: [
        {
          prop: 'name',
          label: '输入框',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: '请输入' }
        },
        {
          prop: 'gender',
          label: '单选框',
          span: 8,
          formtype: 'Radio',
          dataOptions: [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' }
          ]
        },
        {
          prop: 'city',
          label: '下拉选择',
          span: 8,
          formtype: 'Select',
          attrs: { placeholder: '请选择' },
          dataOptions: [
            { label: '北京', value: 'bj' },
            { label: '上海', value: 'sh' }
          ]
        },
        {
          prop: 'hobby',
          label: '复选框',
          span: 12,
          formtype: 'Checkbox',
          dataOptions: [
            { label: '阅读', value: 'read' },
            { label: '运动', value: 'sport' },
            { label: '音乐', value: 'music' }
          ]
        },
        {
          prop: 'status',
          label: '开关',
          span: 12,
          formtype: 'Switch',
          attrs: { activeText: '启用', inactiveText: '禁用' }
        },
        {
          prop: 'date',
          label: '日期时间',
          span: 12,
          formtype: 'datePicker',
          attrs: {
            type: 'datetime',
            valueFormat: 'yyyy-MM-dd HH:mm:ss',
            placeholder: '选择日期时间'
          }
        },
        {
          prop: 'rate',
          label: '评分',
          span: 12,
          formtype: 'Rate',
          attrs: { max: 5 }
        }
      ]
    }
  }
}
</script>
